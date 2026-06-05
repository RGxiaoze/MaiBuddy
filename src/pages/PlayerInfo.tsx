// ============================================================
// Player info page — B50 query & local B50
// ============================================================

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { LEVEL_INDEX_MAP, LEVEL_LABELS } from '@/data/constants'
import GradeBadge from '@/components/shared/GradeBadge'
import { FC_LABELS, FS_LABELS } from '@/data/constants'
import { computeDxStar, renderStars } from '@/utils/dxStar'
import PushSuggestions from '@/components/shared/PushSuggestions'
import { generateStrategy } from '@/utils/strategy'
import { computeTheoreticalMaxRating } from '@/utils/b50'
import type { LevelIndex, Song } from '@/types'
import type { B50Result } from '@/utils/b50'
import type { ScoreRecord } from '@/db/database'

/** Shared B50 row component — works for both Diving-Fish and local B50 entries */
function B50Row({ levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes, songId }: {
  levelIndex: number
  level: string
  title: string
  achievements: number
  rate: string
  dxRating: number
  fcType?: string | null
  fsType?: string | null
  dxScore?: number
  totalNotes?: number
  songId: number
}) {
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]

  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null

  return (
    <div className="grid grid-cols-subgrid col-span-full items-center p-2.5 rounded bg-bg-gray text-sm">
      {/* Difficulty badge */}
      <span
        className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white justify-self-center"
        style={{ backgroundColor: levelColors.color }}
      >
        {LEVEL_LABELS[levelIndex as LevelIndex]}
      </span>

      {/* Level */}
      <span className="text-xs font-medium text-text-secondary justify-self-center" style={{ color: levelColors.color }}>
        {level}
      </span>

      {/* Song title */}
      <Link to={"/songs/" + songId} className="truncate font-medium hover:text-primary hover:underline">{title}</Link>

      {/* Achievement */}
      <span className="tabular-nums font-medium justify-self-end">
        {achievements.toFixed(4)}%
      </span>

      {/* Rate */}
      <span className="justify-self-center">
        <GradeBadge rate={rate as import('@/types').RateType} />
      </span>

      {/* FC/FS — always render placeholder for column alignment */}
      <span className="text-xs">
        {fcType && <span className="text-success font-medium">{FC_LABELS[fcType]}</span>}
        {fsType && <span className="text-success font-medium ml-1">{FS_LABELS[fsType]}</span>}
      </span>

      {/* DX 星数 — always render placeholder for column alignment */}
      <span className="text-xs text-text-secondary justify-self-end tabular-nums"
            title={dxStar ? `DX ${dxScore}/${dxStar.maxDxScore}` : undefined}>
        {dxStar ? <>{renderStars(dxStar.stars) || '☆'} {dxStar.ratio.toFixed(2)}%</> : null}
      </span>

      {/* DX Rating */}
      <span className="tabular-nums font-semibold text-xs justify-self-end">
        {dxRating}
      </span>
    </div>
  )
}

/** Mobile card version of B50Row — shows as a card instead of grid row */
function B50MobileCard({ levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes, songId }: {
  levelIndex: number, level: string, title: string, achievements: number, rate: string, dxRating: number,
  fcType?: string | null, fsType?: string | null, dxScore?: number, totalNotes?: number, songId: number
}) {
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null

  return (
    <div className="bg-bg-gray rounded-lg p-3 space-y-1.5">
      {/* Row 1: difficulty badge + level + song title */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white shrink-0"
              style={{ backgroundColor: levelColors.color }}>
          {LEVEL_LABELS[levelIndex as LevelIndex]}
        </span>
        <span className="text-xs font-medium shrink-0" style={{ color: levelColors.color }}>{level}</span>
        <Link to={`/songs/${songId}`} className="text-sm font-medium truncate hover:text-primary hover:underline min-w-0">
          {title}
        </Link>
      </div>

      {/* Row 2: achievement + rate + FC/FS + DX stars + DX rating */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="tabular-nums font-medium">{achievements.toFixed(4)}%</span>
        <GradeBadge rate={rate as import('@/types').RateType} />
        {fcType && <span className="text-success font-medium">{FC_LABELS[fcType]}</span>}
        {fsType && <span className="text-success font-medium">{FS_LABELS[fsType]}</span>}
        {dxStar && (
          <span className="text-text-secondary tabular-nums text-[11px]">
            {renderStars(dxStar.stars) || '☆'} {dxStar.ratio.toFixed(2)}%
          </span>
        )}
        <span className="tabular-nums font-semibold ml-auto">{dxRating}</span>
      </div>
    </div>
  )
}

/** Strategy advice panel based on B50 tier analysis */
function StrategyPanel({ b50, scores, songs, theoreticalMax }: {
  b50: B50Result
  scores: ScoreRecord[]
  songs: Song[]
  theoreticalMax: number
}) {
  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs])
  const advice = useMemo(
    () => generateStrategy(b50, scores, songMap, theoreticalMax),
    [b50, scores, songMap, theoreticalMax],
  )

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <h3 className="text-sm font-semibold text-text mb-3">
        🎯 推分路线 — {advice.tier} → {advice.nextTier}
      </h3>
      <p className="text-xs text-text-secondary mb-3">{advice.generalAdvice}</p>

      <ul className="space-y-1.5">
        {advice.actionItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
            <span className="text-primary shrink-0 mt-0.5">▸</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-tertiary mt-3 pt-3 border-t border-border/30">
        预估周期：{advice.estimatedGain}
      </p>
    </div>
  )
}

export default function PlayerInfo() {
  const [activeTab, setActiveTab] = useState<'online' | 'local'>('online')

  // Clear data state
  const [clearConfirming, setClearConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)

  const { scores, loaded: scoresLoaded, fetchAllScores, clearAllScores } = useScoreStore()
  const { songs, fetchSongs } = useSongStore()
  const {
    dfBest35, dfBest15, dfRating, dfLoading, dfError, dfPlayerName,
    queryPlayer, clearQuery, localB50, computeLocalB50,
    recomputeFlag,
  } = usePlayerStore()

  // Preserve username across page navigation via Zustand
  const [username, setUsername] = useState(dfPlayerName)

  // Fetch data if not loaded
  useEffect(() => {
    if (songs.length === 0) fetchSongs()
    if (!scoresLoaded) fetchAllScores()
  }, [])

  // Compute local B50 when scores/songs change
  useEffect(() => {
    if (scores.length > 0 && songs.length > 0) {
      computeLocalB50()
    }
  }, [scores.length, songs.length, recomputeFlag])

  // Compute theoretical max rating from available songs
  const theoreticalMax = useMemo(() => {
    if (songs.length === 0) return 0
    return computeTheoreticalMaxRating(songs)
  }, [songs])

  // Helper: look up total notes for a chart from song store
  const getTotalNotes = (songId: number, levelIndex: number): number | undefined => {
    const song = songs.find(s => s.id === songId)
    if (!song) return undefined
    const allDiffs = [...song.difficulties.standard, ...song.difficulties.dx]
    return allDiffs.find(d => d.levelIndex === levelIndex)?.notes?.total
  }

  const handleQuery = () => {
    if (username.trim()) queryPlayer(username.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleQuery()
  }

  const handleClearScores = async () => {
    setClearing(true)
    await clearAllScores()
    usePlayerStore.setState({ localB50: null })
    setClearing(false)
    setClearConfirming(false)
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-text mb-4">玩家信息</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setActiveTab('online')}
          className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors border-none
            ${activeTab === 'online' ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}
        >
          Diving-Fish 查分
        </button>
        <button
          onClick={() => setActiveTab('local')}
          className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors border-none
            ${activeTab === 'local' ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}
        >
          本地 B50
        </button>
      </div>

      {/* ---- Online tab: Diving-Fish query ---- */}
      {activeTab === 'online' && (
        <>
          {/* B50 query input */}
          <div className="bg-surface border border-border rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入玩家名称（查 B50）"
                className="flex-1 px-3 py-2 rounded-md border border-border text-sm
                           focus:outline-none focus:border-primary bg-surface"
              />
              <button
                onClick={handleQuery}
                disabled={dfLoading || !username.trim()}
                className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium
                           hover:bg-primary-dark transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dfLoading ? '查询中...' : '查询 B50'}
              </button>
              {dfPlayerName && (
                <button
                  onClick={clearQuery}
                  className="px-3 py-2 rounded-md border border-border text-sm
                             text-text-secondary hover:bg-bg-gray transition-colors cursor-pointer"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {dfError && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-4 text-sm text-error">
              {dfError}
            </div>
          )}

          {/* Loading skeleton */}
          {dfLoading && (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-text-secondary mt-3">正在查询 B50 数据...</p>
            </div>
          )}

          {/* Results */}
          {!dfLoading && !dfError && dfPlayerName && (
            <>
              {/* Rating summary */}
              <div className="bg-surface border border-border rounded-lg p-5 mb-4">
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-sm text-text-secondary">玩家：</span>
                    <span className="text-base font-semibold text-text ml-1">{dfPlayerName}</span>
                  </div>
                  <div>
                    <span className="text-sm text-text-secondary">总 DX Rating：</span>
                    <span className="text-2xl font-bold text-primary ml-1">{dfRating}</span>
                  </div>
                </div>
                <div className="flex gap-6 mt-3 text-xs text-text-secondary">
                  <span>旧版本 Best 35：<strong className="text-text">{dfBest35.reduce((s, e) => s + e.dxRating, 0)}</strong></span>
                  <span>新版本 Best 15：<strong className="text-text">{dfBest15.reduce((s, e) => s + e.dxRating, 0)}</strong></span>
                </div>
              </div>

              {/* B50 list */}
              {dfBest35.length + dfBest15.length === 0 ? (
                <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-secondary text-sm">
                  该玩家暂无 B50 数据
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* New version — Best 15 */}
                  {dfBest15.length > 0 && (
                    <div className="bg-surface border border-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-text mb-3">
                        新版本 Best {dfBest15.length}
                      </h3>
                      <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>
                        {dfBest15.map((entry, i) => (
                          <B50Row key={`new-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.title} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                        ))}
                      </div>
                      <div className="md:hidden space-y-1.5">
                        {dfBest15.map((entry, i) => (
                          <B50MobileCard key={`new-m-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.title} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Old version — Best 35 */}
                  {dfBest35.length > 0 && (
                    <div className="bg-surface border border-border rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-text mb-3">
                        旧版本 Best {dfBest35.length}
                      </h3>
                      <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>
                        {dfBest35.map((entry, i) => (
                          <B50Row key={`old-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.title} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                        ))}
                      </div>
                      <div className="md:hidden space-y-1.5">
                        {dfBest35.map((entry, i) => (
                          <B50MobileCard key={`old-m-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.title} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!dfLoading && !dfError && !dfPlayerName && (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <span className="text-3xl">🔍</span>
              <h3 className="text-base font-medium text-text mt-3 mb-1">Diving-Fish 查分</h3>
              <p className="text-sm text-text-secondary">
                输入 Diving-Fish 查分器的玩家名称，查询 B50 数据和总 DX Rating
              </p>
              <p className="text-sm text-text-secondary mt-3">
                需要导入完整成绩？请前往
                {' '}
                <Link to="/songs" className="text-primary hover:text-primary-dark underline">
                  曲目查询页
                </Link>
                {' '}
                使用导入功能
              </p>
            </div>
          )}
        </>
      )}

      {/* ---- Local tab: computed B50 from IndexedDB ---- */}
      {activeTab === 'local' && (
        <>
          {!localB50 || (localB50.best35.length === 0 && localB50.best15.length === 0) ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <span className="text-3xl">📝</span>
              <h3 className="text-base font-medium text-text mt-3 mb-1">暂无本地成绩</h3>
              <p className="text-sm text-text-secondary">
                尚无本地成绩，请前往
                {' '}
                <Link to="/songs" className="text-primary hover:text-primary-dark underline">
                  曲目查询页
                </Link>
                {' '}
                导入成绩
              </p>
            </div>
          ) : (
            <>
              {/* Local rating summary */}
              <div className="bg-surface border border-border rounded-lg p-5 mb-4">
                <div className="flex items-baseline gap-4">
                  <div>
                    <span className="text-sm text-text-secondary">总 DX Rating（本地）：</span>
                    <span className="text-2xl font-bold text-primary ml-1">{localB50.totalRating}</span>
                  </div>
                </div>
                <div className="flex gap-6 mt-3 text-xs text-text-secondary">
                  <span>旧版本 Best {localB50.best35.length}：<strong className="text-text">{localB50.best35Total}</strong></span>
                  <span>新版本 Best {localB50.best15.length}：<strong className="text-text">{localB50.best15Total}</strong></span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* New version — Best 15 */}
                {localB50.best15.length > 0 && (
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-text mb-3">
                      新版本 Best {localB50.best15.length}
                    </h3>
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>
                      {localB50.best15.map((entry, i) => (
                        <B50Row key={`loc-new-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.songTitle} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                      ))}
                    </div>
                    <div className="md:hidden space-y-1.5">
                      {localB50.best15.map((entry, i) => (
                        <B50MobileCard key={`loc-new-m-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.songTitle} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Old version — Best 35 */}
                {localB50.best35.length > 0 && (
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-text mb-3">
                      旧版本 Best {localB50.best35.length}
                    </h3>
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>
                      {localB50.best35.map((entry, i) => (
                        <B50Row key={`loc-old-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.songTitle} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                      ))}
                    </div>
                    <div className="md:hidden space-y-1.5">
                      {localB50.best35.map((entry, i) => (
                        <B50MobileCard key={`loc-old-m-${entry.songId}-${entry.levelIndex}-${i}`}
                          songId={entry.songId}
                          levelIndex={entry.levelIndex} level={entry.level}
                          title={entry.songTitle} achievements={entry.achievements}
                          rate={entry.rate} dxRating={entry.dxRating}
                          fcType={entry.fcType} fsType={entry.fsType}
                          dxScore={entry.dxScore}
                          totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Strategy advice */}
              {localB50 && localB50.best35.length + localB50.best15.length > 0 && (
                <StrategyPanel b50={localB50} scores={scores} songs={songs} theoreticalMax={theoreticalMax} />
              )}

              {/* Clear local data */}
              <div className="mt-6 pt-4 border-t border-border">
                {!clearConfirming ? (
                  <button
                    onClick={() => setClearConfirming(true)}
                    disabled={clearing}
                    className="px-3 py-1.5 rounded-md border border-error/40 text-error/80 text-xs
                               hover:bg-error/10 transition-colors cursor-pointer
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {clearing ? '清除中...' : '清除本地成绩数据'}
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary">
                      确认清除全部本地成绩？此操作不可撤销。
                    </span>
                    <button
                      onClick={handleClearScores}
                      disabled={clearing}
                      className="px-3 py-1.5 rounded-md bg-error text-white text-xs font-medium
                                 hover:bg-error/80 transition-colors cursor-pointer
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {clearing ? '清除中...' : '确认清除'}
                    </button>
                    <button
                      onClick={() => setClearConfirming(false)}
                      disabled={clearing}
                      className="px-3 py-1.5 rounded-md border border-border text-text-secondary text-xs
                                 hover:bg-bg-gray transition-colors cursor-pointer
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Push suggestions — visible for both Diving-Fish and Local tabs */}
      <PushSuggestions theoreticalMax={theoreticalMax} />
    </div>
  )
}
