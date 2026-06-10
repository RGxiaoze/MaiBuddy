// ============================================================
// Player info page — B50 query & local B50
// ============================================================

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router'
import { Target } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { LEVEL_INDEX_MAP, LEVEL_LABELS } from '@/data/constants'
import GradeBadge from '@/components/shared/GradeBadge'
import { FC_LABELS, FS_LABELS } from '@/data/constants'
import { computeDxStar, renderStars } from '@/utils/dxStar'
import PushSuggestions from '@/components/shared/PushSuggestions'
import { generateStrategy } from '@/utils/strategy'
import { computeTheoreticalMaxBoth } from '@/utils/b50'
import type { LevelIndex, Song } from '@/types'
import type { B50Result } from '@/utils/b50'
import type { ScoreRecord } from '@/db/database'

function B50Row({ levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes, songId }: {
  levelIndex: number; level: string; title: string; achievements: number; rate: string; dxRating: number
  fcType?: string | null; fsType?: string | null; dxScore?: number; totalNotes?: number; songId: number
}) {
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null
  return (
    <div className="grid grid-cols-subgrid col-span-full items-center p-2.5 rounded bg-bg-gray text-sm">
      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white justify-self-center" style={{ backgroundColor: levelColors.color }}>{LEVEL_LABELS[levelIndex as LevelIndex]}</span>
      <span className="text-xs font-medium text-text-secondary justify-self-center" style={{ color: levelColors.color }}>{level}</span>
      <Link to={"/songs/" + songId} className="truncate font-medium hover:text-primary hover:underline">{title}</Link>
      <span className="tabular-nums font-medium justify-self-end">{achievements.toFixed(4)}%</span>
      <span className="justify-self-center"><GradeBadge rate={rate as import('@/types').RateType} /></span>
      <span className="text-xs">{fcType && <span className="text-success font-medium">{FC_LABELS[fcType]}</span>}{fsType && <span className="text-success font-medium ml-1">{FS_LABELS[fsType]}</span>}</span>
      <span className="text-xs text-text-secondary justify-self-end tabular-nums" title={dxStar ? `DX ${dxScore}/${dxStar.maxDxScore}` : undefined}>{dxStar ? <>{renderStars(dxStar.stars) || '☆'} {dxStar.ratio.toFixed(2)}%</> : null}</span>
      <span className="tabular-nums font-semibold text-xs justify-self-end">{dxRating}</span>
    </div>
  )
}

function B50MobileCard({ levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes, songId }: {
  levelIndex: number; level: string; title: string; achievements: number; rate: string; dxRating: number
  fcType?: string | null; fsType?: string | null; dxScore?: number; totalNotes?: number; songId: number
}) {
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null
  return (
    <div className="bg-bg-gray rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: levelColors.color }}>{LEVEL_LABELS[levelIndex as LevelIndex]}</span>
        <span className="text-xs font-medium shrink-0" style={{ color: levelColors.color }}>{level}</span>
        <Link to={`/songs/${songId}`} className="text-sm font-medium truncate hover:text-primary hover:underline min-w-0">{title}</Link>
      </div>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="tabular-nums font-medium">{achievements.toFixed(4)}%</span>
        <GradeBadge rate={rate as import('@/types').RateType} />
        {fcType && <span className="text-success font-medium">{FC_LABELS[fcType]}</span>}
        {fsType && <span className="text-success font-medium">{FS_LABELS[fsType]}</span>}
        {dxStar && <span className="text-text-secondary tabular-nums text-[11px]">{renderStars(dxStar.stars) || '☆'} {dxStar.ratio.toFixed(2)}%</span>}
        <span className="tabular-nums font-semibold ml-auto">{dxRating}</span>
      </div>
    </div>
  )
}

function StrategyPanel({ b50, scores, songs, theoreticalMax }: {
  b50: B50Result; scores: ScoreRecord[]; songs: Song[]; theoreticalMax: number
}) {
  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs])
  const advice = useMemo(() => generateStrategy(b50, scores, songMap, theoreticalMax), [b50, scores, songMap, theoreticalMax])
  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <h3 className="text-sm font-semibold text-text mb-3"><Target size={16} className="inline mr-1" /> 推分路线 — {advice.tier} → {advice.nextTier}</h3>
      <p className="text-xs text-text-secondary mb-3">{advice.generalAdvice}</p>
      <ul className="space-y-1.5">{advice.actionItems.map((item, i) => <li key={i} className="flex items-start gap-2 text-xs text-text-secondary"><span className="text-primary shrink-0 mt-0.5">▸</span><span>{item}</span></li>)}</ul>
      <p className="text-xs text-text-tertiary mt-3 pt-3 border-t border-border/30">预估周期：{advice.estimatedGain}</p>
    </div>
  )
}

export default function PlayerInfo() {
  const [activeTab, setActiveTab] = useState<'online' | 'local'>('local')
  const [clearConfirming, setClearConfirming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [b15Collapsed, setB15Collapsed] = useState(true)
  const [b35Collapsed, setB35Collapsed] = useState(true)
  const [dfB15Collapsed, setDfB15Collapsed] = useState(true)
  const [dfB35Collapsed, setDfB35Collapsed] = useState(true)

  const { scores, loaded: scoresLoaded, fetchAllScores, clearAllScores } = useScoreStore()
  const { songs, fetchSongs } = useSongStore()
  const { dfBest35, dfBest15, dfRating, dfLoading, dfError, dfPlayerName, queryPlayer, clearQuery, localB50, computeLocalB50, recomputeFlag } = usePlayerStore()
  const [username, setUsername] = useState(dfPlayerName)

  useEffect(() => { if (songs.length === 0) fetchSongs(); if (!scoresLoaded) fetchAllScores() }, [])
  useEffect(() => { if (scores.length > 0 && songs.length > 0) computeLocalB50() }, [scores.length, songs.length, recomputeFlag])

  const theoreticalMaxAll = useMemo(() => songs.length === 0 ? { sssPlusMax: 0, apMax: 0 } : computeTheoreticalMaxBoth(songs), [songs])
  const theoreticalMax = theoreticalMaxAll.sssPlusMax

  // Prebuilt songId-levelIndex → totalNotes map (avoids O(n×m) find on every render)
  const totalNotesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of songs) {
      for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (d.notes?.total) map.set(`${s.id}-${d.levelIndex}`, d.notes.total)
      }
    }
    return map
  }, [songs])

  const getTotalNotes = (songId: number, levelIndex: number): number | undefined => {
    return totalNotesMap.get(`${songId}-${levelIndex}`)
  }

  const handleQuery = () => { if (username.trim()) queryPlayer(username.trim()) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleQuery() }
  const handleClearScores = async () => { setClearing(true); await clearAllScores(); usePlayerStore.setState({ localB50: null }); setClearing(false); setClearConfirming(false) }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-text mb-4">B50 一览</h2>

      <div className="flex gap-1 mb-4">
        <button onClick={() => setActiveTab('local')} className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors border-none ${activeTab === 'local' ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}>本地成绩</button>
        <button onClick={() => setActiveTab('online')} className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors border-none ${activeTab === 'online' ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}><span className="sm:hidden">在线查分</span><span className="hidden sm:inline">Diving-Fish 查分</span></button>
      </div>

      {activeTab === 'online' && (<>
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入玩家名称（查 B50）" className="flex-1 px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-surface" />
            <button onClick={handleQuery} disabled={dfLoading || !username.trim()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{dfLoading ? '查询中...' : <><span className="sm:hidden">查询</span><span className="hidden sm:inline">查询 B50</span></>}</button>
            {dfPlayerName && <button onClick={clearQuery} className="px-3 py-2 rounded-md border border-border text-sm text-text-secondary hover:bg-bg-gray transition-colors cursor-pointer"><span className="sm:hidden">✕</span><span className="hidden sm:inline">清除</span></button>}
          </div>
        </div>
        {dfError && <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-4 text-sm text-error">{dfError}</div>}
        {dfLoading && <div className="bg-surface border border-border rounded-lg p-8 text-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-text-secondary mt-3">正在查询 B50 数据...</p></div>}
        {!dfLoading && !dfError && dfPlayerName && (<>
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <div className="flex items-baseline gap-4"><div><span className="text-sm text-text-secondary">玩家：</span><span className="text-base font-semibold text-text ml-1">{dfPlayerName}</span></div><div><span className="text-sm text-text-secondary">总 DX Rating：</span><span className="text-2xl font-bold text-primary ml-1">{dfRating}</span></div></div>
            <div className="flex gap-6 mt-3 text-xs text-text-secondary"><span>旧版本 Best 35：<strong className="text-text">{dfBest35.reduce((s, e) => s + e.dxRating, 0)}</strong></span><span>新版本 Best 15：<strong className="text-text">{dfBest15.reduce((s, e) => s + e.dxRating, 0)}</strong></span></div>
          </div>
          {dfBest35.length + dfBest15.length === 0 ? <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-secondary text-sm">该玩家暂无 B50 数据</div> : <div className="flex flex-col gap-4">
            {dfBest15.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setDfB15Collapsed(!dfB15Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><h3 className="text-sm font-semibold text-text m-0">新版本 Best {dfBest15.length}</h3><span className="text-xs text-text-tertiary shrink-0">{dfB15Collapsed ? `展开全部 ${dfBest15.length} 条 ▶` : '收起 ▲'}</span></button>
              {dfBest15.length < 15 && <p className="text-xs text-warning mb-2 bg-warning/5 rounded px-3 py-2">新版本还差 <strong>{15 - dfBest15.length}</strong> 首填满 B15，继续加油！</p>}
              {(() => {
                const displayed = dfB15Collapsed ? dfBest15.slice(0, 5) : dfBest15
                const hasMore = dfB15Collapsed && dfBest15.length > 5
                return <>
                  <div className="relative">
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>{displayed.map((entry, i) => <B50Row key={`new-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    <div className="md:hidden space-y-1.5">{displayed.map((entry, i) => <B50MobileCard key={`new-m-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setDfB15Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {dfBest15.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {dfBest35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setDfB35Collapsed(!dfB35Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><h3 className="text-sm font-semibold text-text m-0">旧版本 Best {dfBest35.length}</h3><span className="text-xs text-text-tertiary shrink-0">{dfB35Collapsed ? `展开全部 ${dfBest35.length} 条 ▶` : '收起 ▲'}</span></button>
              {(() => {
                const displayed = dfB35Collapsed ? dfBest35.slice(0, 5) : dfBest35
                const hasMore = dfB35Collapsed && dfBest35.length > 5
                return <>
                  <div className="relative">
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>{displayed.map((entry, i) => <B50Row key={`old-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    <div className="md:hidden space-y-1.5">{displayed.map((entry, i) => <B50MobileCard key={`old-m-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setDfB35Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {dfBest35.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {dfBest15.length === 0 && dfBest35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4"><h3 className="text-sm font-semibold text-text mb-2">新版本 Best 0</h3><p className="text-xs text-warning bg-warning/5 rounded px-3 py-2">新版本暂无成绩，还差 <strong>15</strong> 首填满 B15。去推分建议看看哪些曲目值得练习吧！</p></div>}
          </div>}
        </>)}
        {!dfLoading && !dfError && !dfPlayerName && <div className="bg-surface border border-border rounded-lg px-4 py-3 text-center text-sm text-text-secondary">输入玩家名称查询 B50 — 或 <Link to="/songs?import=1" className="text-primary hover:underline font-medium">请登录导入完整成绩</Link></div>}
      </>)}

      {activeTab === 'local' && (<>
        {!localB50 || (localB50.best35.length === 0 && localB50.best15.length === 0) ? (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 text-center"><span className="text-sm text-text-secondary">暂无本地成绩 — </span><Link to="/songs?import=1" className="text-sm text-primary hover:underline font-medium">请登录导入</Link></div>
        ) : (<>
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <div className="flex items-baseline gap-4"><div><span className="text-sm text-text-secondary">总 DX Rating（本地）：</span><span className="text-2xl font-bold text-primary ml-1">{localB50.totalRating}</span></div></div>
            <div className="flex gap-6 mt-3 text-xs text-text-secondary"><span>旧版本 Best {localB50.best35.length}：<strong className="text-text">{localB50.best35Total}</strong></span><span>新版本 Best {localB50.best15.length}：<strong className="text-text">{localB50.best15Total}</strong></span></div>
          </div>
          <div className="flex flex-col gap-4">
            {localB50.best15.length === 0 && localB50.best35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4"><h3 className="text-sm font-semibold text-text mb-2">新版本 Best 0</h3><p className="text-xs text-warning bg-warning/5 rounded px-3 py-2">新版本暂无成绩，还差 <strong>15</strong> 首填满 B15。去推分建议看看哪些曲目值得练习吧！</p></div>}
            {localB50.best15.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setB15Collapsed(!b15Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text m-0">新版本 Best {localB50.best15.length}</h3><span className="text-[10px] text-text-tertiary tabular-nums">计 {localB50.best15Total} 分</span></div><span className="text-xs text-text-tertiary shrink-0">{b15Collapsed ? `展开全部 ${localB50.best15.length} 条 ▶` : '收起 ▲'}</span></button>
              {localB50.best15.length < 15 && <p className="text-xs text-warning mb-2 bg-warning/5 rounded px-3 py-2">新版本还差 <strong>{15 - localB50.best15.length}</strong> 首填满 B15，继续加油！</p>}
              {(() => {
                const displayed = b15Collapsed ? localB50.best15.slice(0, 5) : localB50.best15
                const hasMore = b15Collapsed && localB50.best15.length > 5
                return <>
                  <div className="relative">
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>{displayed.map((entry, i) => <B50Row key={`loc-new-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    <div className="md:hidden space-y-1.5">{displayed.map((entry, i) => <B50MobileCard key={`loc-new-m-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setB15Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {localB50.best15.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {localB50.best35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setB35Collapsed(!b35Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text m-0">旧版本 Best {localB50.best35.length}</h3><span className="text-[10px] text-text-tertiary tabular-nums">计 {localB50.best35Total} 分</span></div><span className="text-xs text-text-tertiary shrink-0">{b35Collapsed ? `展开全部 ${localB50.best35.length} 条 ▶` : '收起 ▲'}</span></button>
              {(() => {
                const displayed = b35Collapsed ? localB50.best35.slice(0, 5) : localB50.best35
                const hasMore = b35Collapsed && localB50.best35.length > 5
                return <>
                  <div className="relative">
                    <div className="hidden md:grid gap-y-1" style={{ gridTemplateColumns: '4.5rem 2rem 1fr 5rem 2.5rem 3.5rem 6.5rem 3rem' }}>{displayed.map((entry, i) => <B50Row key={`loc-old-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    <div className="md:hidden space-y-1.5">{displayed.map((entry, i) => <B50MobileCard key={`loc-old-m-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setB35Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {localB50.best35.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
          </div>
          {localB50 && localB50.best35.length + localB50.best15.length > 0 && <StrategyPanel b50={localB50} scores={scores} songs={songs} theoreticalMax={theoreticalMax} />}
          <div className="mt-6 pt-4 border-t border-border">
            {!clearConfirming ? <button onClick={() => setClearConfirming(true)} disabled={clearing} className="px-3 py-1.5 rounded-md border border-error/40 text-error/80 text-xs hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{clearing ? '清除中...' : '清除本地成绩数据'}</button>
            : <div className="flex items-center gap-3"><span className="text-sm text-text-secondary">确认清除全部本地成绩？此操作不可撤销。</span><button onClick={handleClearScores} disabled={clearing} className="px-3 py-1.5 rounded-md bg-error text-white text-xs font-medium hover:bg-error/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{clearing ? '清除中...' : '确认清除'}</button><button onClick={() => setClearConfirming(false)} disabled={clearing} className="px-3 py-1.5 rounded-md border border-border text-text-secondary text-xs hover:bg-bg-gray transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">取消</button></div>}
          </div>
        </>)}
      </>)}

      <PushSuggestions theoreticalMax={theoreticalMax} />
    </div>
  )
}
