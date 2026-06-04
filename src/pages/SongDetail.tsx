// ============================================================
// Song detail page — info, chart, DX Rating, scores
// ============================================================

import { useState, useEffect, useMemo, memo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSongStore } from '@/store/songStore'
import { useScoreStore } from '@/store/scoreStore'
import { FC_LABELS, FS_LABELS, LEVEL_INDEX_MAP, LEVEL_LABELS, RATE_COLORS, RATE_DISPLAY } from '@/data/constants'
import type { ChartDifficulty, LevelIndex, Score } from '@/types'
import type { ScoreRecord } from '@/db/database'
import { computeRating } from '@/utils/rating'
import { computeDxStar, renderStars } from '@/utils/dxStar'
import { getAliasesForSong, loadAliasData } from '@/data/aliases'
import ScoreForm from '@/components/shared/ScoreForm'
import { loadStats, getChartStats, getLevelAvg, getFitDiffAvg, getOfficialLevelAvg, STDEV_LEVELS } from '@/services/statsService'

export default function SongDetail() {
  const { songId } = useParams<{ songId: string }>()
  const navigate = useNavigate()

  const { songs, loading, error, fetchSongs } = useSongStore()
  const { scores, fetchAllScores, loaded: scoresLoaded, deleteScore: deleteScoreAction } = useScoreStore()

  const [selectedLevel, setSelectedLevel] = useState<LevelIndex>(3) // default MASTER
  const [showScoreForm, setShowScoreForm] = useState(false)
  const [editingScore, setEditingScore] = useState<Score | undefined>(undefined)

  // Fetch data if not loaded
  useEffect(() => {
    if (songs.length === 0 && !loading && !error) fetchSongs()
    if (!scoresLoaded) fetchAllScores()
  }, [songs.length, loading, error, scoresLoaded, fetchSongs, fetchAllScores])

  const song = songs.find((s) => s.id === Number(songId))

  // Aliases (loaded asynchronously, non-blocking)
  const [aliases, setAliases] = useState<string[]>([])
  useEffect(() => {
    loadAliasData().then(() => {
      if (song) setAliases(getAliasesForSong(song.id))
    })
  }, [song?.id])

  // Chart stats (non-blocking background load, pass officialLevelMap when songs available)
  const [statsLoaded, setStatsLoaded] = useState(false)
  useEffect(() => {
    if (songs.length === 0) return
    const officialLevelMap = new Map<string, number>()
    for (const s of songs) {
      for (const diff of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (diff.levelValue > 0) {
          officialLevelMap.set(`${s.id}-${diff.levelIndex}`, diff.levelValue)
        }
      }
    }
    loadStats(officialLevelMap).then(() => setStatsLoaded(true)).catch(() => setStatsLoaded(true))
  }, [songs.length])

  // Pre-compute derived values (safe even when song is undefined, before early returns)
  const allDiffs = song ? [...song.difficulties.standard, ...song.difficulties.dx] : []
  const currentDiff = allDiffs.find((d) => d.levelIndex === selectedLevel) as ChartDifficulty | undefined
  const levelColors = LEVEL_INDEX_MAP[selectedLevel]

  // Scores for this song — memoized to avoid O(n) scan + new array ref on every render
  const songScores = useMemo(
    () => song ? scores.filter((s) => s.songId === song.id) : [],
    [scores, song?.id]
  )

  const ratingRefs = [50, 60, 70, 75, 80, 90, 94, 97, 98, 99, 99.5, 100, 100.5]

  // Precompute DX Rating table — only recalculates when levelValue changes
  const ratingTable = useMemo(() => {
    if (!currentDiff || currentDiff.levelValue <= 0) return null
    return ratingRefs.map((r) => computeRating(currentDiff.levelValue, r))
  }, [currentDiff?.levelValue])

  // Precompute chart stats for distribution display
  const chartStats = useMemo(() => {
    if (!statsLoaded || !song || !currentDiff) return undefined
    return getChartStats(song.id, currentDiff.level)
  }, [statsLoaded, song?.id, currentDiff?.levelIndex])

  const levelAvg = useMemo(() => {
    if (!statsLoaded || !currentDiff) return undefined
    return getLevelAvg(currentDiff.level)
  }, [statsLoaded, currentDiff?.level])

  const fitDiffAvg = useMemo(() => {
    if (!statsLoaded || !chartStats) return undefined
    return getFitDiffAvg(chartStats.fitDiff)
  }, [statsLoaded, chartStats?.fitDiff])

  const officialLevelAvg = useMemo(() => {
    if (!statsLoaded || !currentDiff) return undefined
    return getOfficialLevelAvg(currentDiff.levelValue)
  }, [statsLoaded, currentDiff?.levelValue])

  const stdDevLevel = chartStats
    ? STDEV_LEVELS.find(l => chartStats.stdDev < l.max) ?? STDEV_LEVELS[STDEV_LEVELS.length - 1]
    : undefined

  // ---- Loading / initial state ----
  // songs.length === 0 && !error means data hasn't arrived yet (first render or page refresh)
  if (loading || (songs.length === 0 && !error)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span>加载曲目数据中...</span>
        </div>
      </div>
    )
  }

  // ---- Not found (data loaded, song ID doesn't match) ----
  if (!song) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <span className="text-3xl">🔍</span>
          <span>曲目未找到 (ID: {songId})</span>
          <button onClick={() => navigate('/songs')} className="text-sm text-primary hover:underline cursor-pointer">
            返回曲目列表
          </button>
        </div>
      </div>
    )
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除这条成绩？')) return
    await deleteScoreAction(id)
  }

  const handleEdit = (score: ScoreRecord) => {
    const mapped: Score = {
      songId: score.songId,
      songTitle: score.songTitle,
      levelIndex: score.levelIndex as LevelIndex,
      level: score.level,
      levelValue: score.levelValue,
      songType: score.songType as Score['songType'],
      achievements: score.achievements,
      rate: score.rate as Score['rate'],
      fcType: score.fcType as Score['fcType'],
      fsType: score.fsType as Score['fsType'],
      dxScore: score.dxScore,
      dxRating: score.dxRating,
      dxScoreDetail: score.dxScoreDetail ?? undefined,
      playDate: score.playDate,
    }
    setEditingScore(mapped)
    setShowScoreForm(true)
  }

  // ---- Render ----
  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/songs')}
        className="text-sm text-text-secondary hover:text-primary mb-4 flex items-center gap-1 cursor-pointer"
      >
        ← 返回曲目列表
      </button>

      {/* Basic info */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex gap-5">
          {/* Cover */}
          <img
            src={song.imageUrl}
            alt={song.title}
            loading="lazy"
            className="w-32 h-32 rounded-lg object-cover shrink-0 bg-bg-gray"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />

          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="text-lg font-semibold text-text m-0">{song.title}</h2>
            <p className="text-sm text-text-secondary">{song.artist}</p>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-text-secondary shrink-0 leading-5">别名：</span>
                {aliases.map((a, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-primary/5 text-text-secondary">
                    {a}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-1 text-xs text-text-secondary">
              <span>BPM: <strong className="text-text">{song.bpm}</strong></span>
              <span>版本: <strong className="text-text">{song.from}</strong></span>
              <span>分类: <strong className="text-text">{song.genre}</strong></span>
            </div>
          </div>
        </div>

        {/* Difficulty tabs */}
        <div className="flex gap-1 mt-4">
          {([0, 1, 2, 3, 4] as LevelIndex[]).map((idx) => {
            const diff = allDiffs.find((d) => d.levelIndex === idx)
            if (!diff || diff.levelValue === 0) return null
            const colors = LEVEL_INDEX_MAP[idx]
            const isSelected = selectedLevel === idx
            return (
              <button
                key={idx}
                onClick={() => setSelectedLevel(idx)}
                className="px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer border-none"
                style={{
                  backgroundColor: isSelected ? colors.color : 'transparent',
                  color: isSelected ? '#fff' : colors.color,
                  border: isSelected ? '1px solid transparent' : `1px solid ${colors.color}40`,
                }}
              >
                {LEVEL_LABELS[idx]} {diff.level}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart info */}
      {currentDiff && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-4">
          <h3 className="text-sm font-semibold text-text mb-3">谱面信息 — {LEVEL_LABELS[selectedLevel]} <span style={{ color: levelColors.color }}>{currentDiff.level}</span></h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-secondary">定数：</span>
              <strong>{currentDiff.levelValue}</strong>
            </div>
            <div>
              <span className="text-text-secondary">谱师：</span>
              <strong>{currentDiff.noteDesigner}</strong>
            </div>

            {currentDiff.notes && (
              <>
                <div>总物量：<strong>{currentDiff.notes.total}</strong></div>
                <div>TAP：<strong>{currentDiff.notes.tap}</strong></div>
                <div>HOLD：<strong>{currentDiff.notes.hold}</strong></div>
                <div>SLIDE：<strong>{currentDiff.notes.slide}</strong></div>
                {currentDiff.notes.touch > 0 && (
                  <div>TOUCH：<strong>{currentDiff.notes.touch}</strong></div>
                )}
                <div>BREAK：<strong>{currentDiff.notes.break}</strong></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 全服达成分布 */}
      {chartStats && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-4">
          <h3 className="text-sm font-semibold text-text mb-3">全服达成分布</h3>

          {/* StdDev classification banner — always shown */}
          {stdDevLevel && (
            <div
              className="mb-3 px-3 py-2 rounded-md text-xs"
              style={{ backgroundColor: `${stdDevLevel.color}10`, border: `1px solid ${stdDevLevel.color}30`, color: stdDevLevel.color }}
            >
              σ = {chartStats.stdDev.toFixed(1)} — {stdDevLevel.label}：{stdDevLevel.desc}
            </div>
          )}

          {/* Three-column rate display */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* SSS Rate */}
            <RateDiffCard
              label="SSS 率"
              rate={chartStats.sssRate}
              levelAvg={levelAvg?.sssRate}
              officialLevelAvgRate={officialLevelAvg?.sssRate}
              officialLevelCount={officialLevelAvg?.chartCount}
              levelValue={currentDiff?.levelValue}
              fitDiffAvgRate={fitDiffAvg?.sssRate}
              fitDiffCount={fitDiffAvg?.chartCount}
              fitDiffValue={chartStats.fitDiff}
            />

            {/* SSS+ Rate */}
            <RateDiffCard
              label="SSS+ 率"
              rate={chartStats.sssPlusRate}
              levelAvg={levelAvg?.sssPlusRate}
              officialLevelAvgRate={officialLevelAvg?.sssPlusRate}
              officialLevelCount={officialLevelAvg?.chartCount}
              levelValue={currentDiff?.levelValue}
              fitDiffAvgRate={fitDiffAvg?.sssPlusRate}
              fitDiffCount={fitDiffAvg?.chartCount}
              fitDiffValue={chartStats.fitDiff}
            />

            {/* AP Rate */}
            <RateDiffCard
              label="AP 率"
              rate={chartStats.apRate}
              levelAvg={levelAvg?.apRate}
              officialLevelAvgRate={officialLevelAvg?.apRate}
              officialLevelCount={officialLevelAvg?.chartCount}
              levelValue={currentDiff?.levelValue}
              fitDiffAvgRate={fitDiffAvg?.apRate}
              fitDiffCount={fitDiffAvg?.chartCount}
              fitDiffValue={chartStats.fitDiff}
            />
          </div>

          {/* 拟合定数行 */}
          {currentDiff && chartStats.fitDiff != null && (() => {
            const delta = chartStats.fitDiff - currentDiff.levelValue
            const sign = delta >= 0 ? '+' : ''
            const deltaColor = Math.abs(delta) <= FIT_DIFF_GRAY ? '#9CA3AF'
              : delta > 0 ? '#ef4444' : '#22c55e'
            return (
              <div className="mt-3 pt-3 border-t border-border/30 text-xs text-center">
                <span className="text-text-secondary">拟合定数 </span>
                <span className="font-semibold text-text">{chartStats.fitDiff.toFixed(2)}</span>
                <span className="text-text-tertiary"> — </span>
                <span style={{ color: deltaColor }}>{sign}{Math.abs(delta).toFixed(2)}</span>
                <span className="text-text-tertiary"> vs 官方定数 {currentDiff.levelValue.toFixed(1)}</span>
              </div>
            )
          })()}
        </div>
      )}

      {/* DX Rating reference */}
      {ratingTable && (
        <div className="bg-surface border border-border rounded-lg p-5 mb-4">
          <h3 className="text-sm font-semibold text-text mb-3">DX Rating 对照</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary">
                  <th className="text-left py-1 pr-3 font-medium">达成率</th>
                  {ratingRefs.map((r) => (
                    <th key={r} className="text-right px-2 font-medium">{r}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 text-text-secondary">Rating</td>
                  {ratingTable.map((v, i) => (
                    <td key={i} className="text-right px-2 tabular-nums font-medium">
                      {v}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scores module */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text m-0">我的成绩</h3>
          <button
            onClick={() => { setEditingScore(undefined); setShowScoreForm(true) }}
            className="px-3 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary-dark transition-colors cursor-pointer"
          >
            + 录入成绩
          </button>
        </div>

        {songScores.length === 0 ? (
          <p className="text-sm text-text-secondary py-4 text-center">
            暂无成绩记录
          </p>
        ) : (
          <div className="grid gap-y-2" style={{ gridTemplateColumns: '4.5rem 5rem 3rem 3.5rem 1fr 3.5rem 4.5rem' }}>
            <ScoreHeader />
            {songScores.map((score: ScoreRecord) => (
              <ScoreRow key={score.id} score={score} allDiffs={allDiffs} onEdit={() => handleEdit(score)} onDelete={() => score.id && handleDelete(score.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Score form modal */}
      {showScoreForm && (
        <ScoreForm
          song={song}
          defaultLevelIndex={selectedLevel}
          existingScore={editingScore}
          onClose={() => setShowScoreForm(false)}
        />
      )}
    </div>
  )
}

/** Column header row — matches ScoreRow column widths for alignment */
function ScoreHeader() {
  return (
    <div className="grid grid-cols-subgrid col-span-full items-center px-3 py-1.5 text-xs text-text-secondary font-medium">
      <span className="justify-self-center">难度</span>
      <span className="justify-self-end tabular-nums">达成率</span>
      <span className="justify-self-center">评级</span>
      <span>FC/FS</span>
      <span className="justify-self-end tabular-nums">DX 分数</span>
      <span className="justify-self-end tabular-nums">日期</span>
      <span className="justify-self-end">操作</span>
    </div>
  )
}

/** Single score row display — React.memo avoids re-rendering unchanged rows */
const ScoreRow = memo(function ScoreRow({ score, allDiffs, onEdit, onDelete }: { score: ScoreRecord; allDiffs: ChartDifficulty[]; onEdit: () => void; onDelete: () => void }) {
  const rateColor = RATE_COLORS[score.rate as keyof typeof RATE_COLORS] || '#999'
  const levelColors = LEVEL_INDEX_MAP[score.levelIndex as LevelIndex]

  // Compute DX star rating from dxScore and chart note count
  const currentDiff = allDiffs.find((d) => d.levelIndex === score.levelIndex)
  const totalNotes = currentDiff?.notes?.total
  const dxStar = totalNotes && totalNotes > 0 ? computeDxStar(score.dxScore, totalNotes) : null

  return (
    <div className="grid grid-cols-subgrid col-span-full items-center p-3 rounded bg-bg-gray text-sm">
      {/* Difficulty badge */}
      <span
        className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white justify-self-center"
        style={{ backgroundColor: levelColors.color }}
      >
        {LEVEL_LABELS[score.levelIndex as LevelIndex]}
      </span>

      {/* Achievements */}
      <span className="tabular-nums font-medium justify-self-end">{score.achievements.toFixed(4)}%</span>

      {/* Grade */}
      <span
        className="px-1.5 py-0.5 rounded text-[11px] font-bold justify-self-center"
        style={{ backgroundColor: rateColor, color: '#fff' }}
      >
        {RATE_DISPLAY[score.rate as keyof typeof RATE_DISPLAY] || score.rate}
      </span>

      {/* FC/FS — always render placeholder for column alignment */}
      <span className="text-xs">
        {score.fcType && <span className="text-success font-medium">{FC_LABELS[score.fcType]}</span>}
        {score.fsType && <span className="text-success font-medium ml-1">{FS_LABELS[score.fsType]}</span>}
      </span>

      {/* DX Score + 星数 — unified outer span for column width consistency */}
      <span className="text-xs justify-self-end tabular-nums"
            title={dxStar ? `DX ${score.dxScore}/${dxStar.maxDxScore} (${dxStar.ratio.toFixed(2)}%)` : undefined}>
        {dxStar ? (
          <span className="inline-flex items-center gap-1 justify-end">
            <span className="tabular-nums">{renderStars(dxStar.stars) || '☆'}</span>
            <span className="tabular-nums text-text-secondary">
              DX {score.dxScore}/{dxStar.maxDxScore}
            </span>
            <span className="tabular-nums text-text-tertiary">
              ({dxStar.ratio.toFixed(2)}%)
            </span>
          </span>
        ) : (
          <span className="text-text-secondary">DX {score.dxScore}</span>
        )}
      </span>

      {/* Date */}
      <span className="text-xs text-text-secondary justify-self-end">
        {new Date(score.playDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
      </span>

      {/* Actions */}
      <span className="flex gap-1 justify-self-end">
        <button onClick={onEdit} className="text-xs text-primary hover:underline cursor-pointer">
          编辑
        </button>
        <button onClick={onDelete} className="text-xs text-error hover:underline cursor-pointer">
          删除
        </button>
      </span>
    </div>
  )
})

// ---- 全服达成分布子组件 ----

/** 灰化边界（百分点）—— 基于 chart_stats 5,286 首谱面真实分布统计 */
const GRAY_ZONES: Record<string, number> = {
  'SSS 率': 2.0,
  'SSS+ 率': 2.0,
  'AP 率': 0.3,
}
/** 拟合定数差值灰化边界（fit_diff 精度 0.001） */
const FIT_DIFF_GRAY = 0.05

/** 标签着色（用户确认的配色体系） */
const LABEL_STYLES: Record<string, React.CSSProperties> = {
  'SSS 率': {
    background: 'linear-gradient(90deg, #FFD700, #FF6B6B, #FF69B4, #FFD700)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
  },
  'SSS+ 率': {
    background: 'linear-gradient(90deg, #FFD700, #FF6B6B, #FF69B4, #FFD700)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
  },
  'AP 率': {
    color: '#F97316',
    fontWeight: 600,
  },
}

function getDiffColor(diff: number, label: string): string {
  const grayZone = (GRAY_ZONES[label] ?? 2.0) / 100
  if (Math.abs(diff) < grayZone) return '#9CA3AF'
  return diff >= 0 ? '#22c55e' : '#ef4444'
}

function diffSign(d: number): string {
  return d >= 0 ? `+${(d * 100).toFixed(1)}` : (d * 100).toFixed(1)
}

/** Single rate column: absolute value + vs 官标等级 + vs 官标定数 + 拟合后 vs 官标定数 */
function RateDiffCard({ label, rate, levelAvg, officialLevelAvgRate, officialLevelCount, levelValue, fitDiffAvgRate, fitDiffCount, fitDiffValue }: {
  label: string
  rate: number
  levelAvg?: number
  officialLevelAvgRate?: number
  officialLevelCount?: number
  levelValue?: number
  fitDiffAvgRate?: number
  fitDiffCount?: number
  fitDiffValue?: number
}) {
  const pct = (rate * 100).toFixed(1)
  const diffVsLevel = levelAvg != null ? rate - levelAvg : null
  const diffVsOfficial = officialLevelAvgRate != null ? rate - officialLevelAvgRate : null
  const showOfficial = diffVsOfficial != null && officialLevelCount != null && officialLevelCount >= 3
  const diffVsFit = fitDiffAvgRate != null ? rate - fitDiffAvgRate : null
  const showFitDiff = diffVsFit != null && fitDiffCount != null && fitDiffCount >= 3

  return (
    <div className="bg-bg-gray rounded-md px-3 py-4">
      <div className="text-xs mb-1" style={LABEL_STYLES[label] || {}}>{label}</div>
      <div className="text-lg font-bold text-text tabular-nums">{pct}%</div>
      {/* Row 1: vs 官标等级 */}
      {diffVsLevel != null ? (
        <div className="text-xs mt-0.5 tabular-nums font-medium" style={{ color: getDiffColor(diffVsLevel, label) }}>
          {diffSign(diffVsLevel)}% vs 官标等级
        </div>
      ) : (
        <div className="text-xs text-text-tertiary mt-0.5">--</div>
      )}
      {/* Row 2: vs 官标定数 */}
      {showOfficial && (
        <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: getDiffColor(diffVsOfficial!, label) }}>
          {diffSign(diffVsOfficial!)}% vs 官标定数({levelValue?.toFixed(1)})
        </div>
      )}
      {/* Row 3: 拟合后 vs 官标定数 */}
      {showFitDiff && (
        <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: getDiffColor(diffVsFit!, label) }}>
          {diffSign(diffVsFit!)}% 拟合后 vs 官标定数({fitDiffValue?.toFixed(1)})
        </div>
      )}
    </div>
  )
}
