// ============================================================
// Five-dimension analysis page — ECharts radar chart
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { usePlayerStore } from '@/store/playerStore'
import { computeChartDimensions, computeChartDimensionsRaw, computePlayerDimensions, type DimensionScores } from '@/utils/dimensions'
import { analyzeWeakness } from '@/utils/weaknessAnalysis'
import { recommendPracticeSongs } from '@/utils/practiceRecommend'
import { generatePushRoute } from '@/utils/routePlanner'
import { computePushSuggestions } from '@/utils/pushSuggestions'
import { getTagMeta, type ChartTag } from '@/utils/chartTags'
import { loadStats, getChartStats, isStatsLoaded } from '@/services/statsService'
import { loadKB, getLadderStrategy, type KnowledgeBase } from '@/utils/knowledgeBase'
import type { ChartDifficulty } from '@/types'
import RadarChart, { type RadarDataPoint } from '@/components/charts/RadarChart'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

const DIM_ORDER: (keyof DimensionScores)[] = ['processing', 'stamina', 'burst', 'positioning', 'technique']

const DIM_META: Record<keyof DimensionScores, { name: string; color: string; desc: string }> = {
  processing:  { name: '底力', color: '#DC2626', desc: '高速高密度谱面的即时读谱与执行能力。主要由 BPM × 总物量决定。' },
  stamina:     { name: '体力', color: '#D97706', desc: '长时间持续高负荷不掉速不掉准的耐力。主要由总物量 × 曲长决定。' },
  burst:       { name: '爆发', color: '#A855F7', desc: '极高峰值密度段的冲击处理能力。主要由 BPM × 峰值密度决定。' },
  positioning: { name: '定位', color: '#22C55E', desc: '宽广屏幕范围准确触击目标位置。主要由 TOUCH+SLIDE+HOLD 占比决定。' },
  technique:   { name: '技巧', color: '#3B82F6', desc: 'SLIDE折返/TOUCH阵/HOLD复杂度等非标准配置。主要由 SLIDE+BREAK+TOUCH 占比决定。' },
}

export default function DimensionAnalysis() {
  const { scores, loaded: scoresLoaded, fetchAllScores } = useScoreStore()
  const { songs, loading: songsLoading, fetchSongs } = useSongStore()

  useEffect(() => {
    if (!scoresLoaded) fetchAllScores()
    if (songs.length === 0 && !songsLoading) fetchSongs()
    if (!isStatsLoaded()) loadStats().catch(() => {})
  }, [scoresLoaded, songs.length, songsLoading, fetchAllScores, fetchSongs])

  // Knowledge base state
  const [kb, setKb] = useState<KnowledgeBase | null>(null)
  useEffect(() => { loadKB().then(setKb) }, [])

  // Build chart dimension map (normalized + raw)
  const chartDimensions = useMemo(() => {
    const map = new Map<string, DimensionScores>()
    for (const song of songs) {
      if (!song?.difficulties) continue
      const allDiffs: ChartDifficulty[] = [...(song.difficulties.standard || []), ...(song.difficulties.dx || [])]
      for (const diff of allDiffs) {
        if (!diff || diff.levelValue <= 0) continue
        const key = `${song.id}-${diff.levelIndex}`
        try {
          map.set(key, computeChartDimensions(diff, song.bpm))
        } catch {
          // Skip charts with invalid note data
        }
      }
    }
    return map
  }, [songs])

  // Build raw dimension map (for topCharts selection)
  const chartRawDimensions = useMemo(() => {
    const map = new Map<string, DimensionScores>()
    for (const song of songs) {
      if (!song?.difficulties) continue
      const allDiffs: ChartDifficulty[] = [...(song.difficulties.standard || []), ...(song.difficulties.dx || [])]
      for (const diff of allDiffs) {
        if (!diff || diff.levelValue <= 0) continue
        const key = `${song.id}-${diff.levelIndex}`
        try {
          map.set(key, computeChartDimensionsRaw(diff, song.bpm))
        } catch {
          // Skip
        }
      }
    }
    return map
  }, [songs])

  // Compute player dimensions
  const playerDims = useMemo(() => {
    const scoreData = scores.map(s => ({
      songId: s.songId, levelIndex: s.levelIndex,
      achievements: s.achievements, songTitle: s.songTitle,
    }))
    return computePlayerDimensions(scoreData, chartDimensions, chartRawDimensions)
  }, [scores, chartDimensions, chartRawDimensions])

  // Build radar chart data
  const radarData: RadarDataPoint[] = useMemo(() => {
    if (!playerDims) return []
    return [{
      name: '玩家能力',
      value: DIM_ORDER.map(d => playerDims[d]),
      color: '#5BA4CF',
    }]
  }, [playerDims])

  const dimLabels = DIM_ORDER.map(d => DIM_META[d].name)

  const { localB50 } = usePlayerStore()

  // Weakness analysis
  const weakness = useMemo(() => {
    if (scores.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    return analyzeWeakness(scores, songMap)
  }, [scores, songs])

  // Cleared charts (≥ 97%)
  const clearedCharts = useMemo(() => {
    const set = new Set<string>()
    for (const s of scores) {
      if (s.achievements >= 97) set.add(`${s.songId}-${s.levelIndex}`)
    }
    return set
  }, [scores])

  // Push route plan
  const pushRoute = useMemo(() => {
    if (!localB50 || songs.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    const suggestions = computePushSuggestions(scores, songMap, localB50, getChartStats)
    return generatePushRoute(localB50, suggestions, getChartStats)
  }, [localB50, scores, songs])

  // Current ladder strategy
  const strategy = useMemo(() => {
    if (!kb || !localB50) return null
    return getLadderStrategy(kb, localB50.totalRating)
  }, [kb, localB50])

  const [weaknessTab, setWeaknessTab] = useState<ChartTag | null>(null)

  const isLoading = songsLoading || !scoresLoaded

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-text mb-4">五维分析</h2>

      {isLoading ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-text-secondary mt-3">加载数据中...</p>
        </div>
      ) : !playerDims ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <h3 className="text-base font-medium text-text mt-3 mb-1">数据不足</h3>
          <p className="text-sm text-text-secondary">
            需要至少一条达成率 ≥ 97% 的成绩才能进行五维分析
          </p>
        </div>
      ) : (
        <ErrorBoundary title="五维分析页面渲染出错">
          {/* Radar chart */}
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <h3 className="text-sm font-semibold text-text mb-2">玩家能力维度</h3>
            <p className="text-xs text-text-secondary mb-4">
              基于 {playerDims.chartCount} 首达成率 ≥ 97% 的谱面计算（平方加权平均）
            </p>
            <RadarChart
              dimensions={dimLabels}
              max={10}
              data={radarData}
              className="w-full"
            />

            {/* Legend / dimension scores */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {DIM_ORDER.map(dim => {
                const meta = DIM_META[dim]
                return (
                  <div key={dim} className="text-center">
                    <div className="text-lg font-bold" style={{ color: meta.color }}>
                      {playerDims[dim].toFixed(1)}
                    </div>
                    <div className="text-[10px] text-text-secondary">{meta.name}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dimension details */}
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <h3 className="text-sm font-semibold text-text mb-3">维度说明与代表谱面</h3>
            <div className="flex flex-col gap-3">
              {DIM_ORDER.map(dim => {
                const meta = DIM_META[dim]
                return (
                  <div key={dim} className="flex items-start gap-3 text-sm border-b border-border/20 pb-3 last:border-0 last:pb-0">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.name} {playerDims[dim].toFixed(1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-text-secondary text-xs m-0">{meta.desc}</p>
                      {playerDims.topCharts[dim] && (
                        <p className="text-xs text-primary m-0 mt-1">
                          代表谱面：
                          <Link to={"/songs/" + playerDims.topCharts[dim].songId} className="hover:underline">
                            {playerDims.topCharts[dim].title}
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Weakness analysis */}
          {weakness && (
            <div className="bg-surface border border-border rounded-lg p-5 mb-4">
              <h3 className="text-sm font-semibold text-text mb-3">谱面类型短板分析</h3>
              <p className="text-xs text-text-secondary mb-3">{weakness.assessment}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {weakness.tagStats.filter(t => t.totalCount > 0).map(stat => {
                  const isWeak = weakness.primaryWeakness === stat.tag || weakness.secondaryWeakness === stat.tag
                  return (
                    <button
                      key={stat.tag}
                      onClick={() => setWeaknessTab(weaknessTab === stat.tag ? null : stat.tag)}
                      className={`px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer border-none
                        ${weaknessTab === stat.tag
                          ? 'bg-primary text-white'
                          : isWeak
                            ? 'bg-error/10 text-error border border-error/20'
                            : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}
                    >
                      {stat.label} {stat.avgAchievement.toFixed(1)}%
                      {isWeak && stat.tag === weakness.primaryWeakness && ' ⚠'}
                    </button>
                  )
                })}
              </div>

              {weaknessTab && (() => {
                const tab = weakness.tagStats.find(t => t.tag === weaknessTab)!
                const meta = getTagMeta(tab.tag)
                const recs = recommendPracticeSongs(tab.tag, songs, clearedCharts, 3)
                return (
                  <div className="border-t border-border/30 pt-3">
                    <p className="text-xs text-text-secondary mb-2">
                      <strong>{meta.label}</strong>：{meta.desc}（已玩 {tab.totalCount} 首，达标 {tab.strongCount} 首，待提升 {tab.weakCount} 首）
                    </p>
                    {recs.length > 0 && (
                      <>
                        <p className="text-xs text-text-secondary mb-2">递进练习推荐：</p>
                        <div className="flex flex-wrap gap-1.5">
                          {recs.map(ps => (
                            <Link key={`${ps.songId}-${ps.levelIndex}`}
                              to={"/songs/" + ps.songId}
                              className={`px-2 py-1 rounded text-[11px] hover:underline ${ps.alreadyCleared ? 'bg-bg-gray text-text-tertiary' : 'bg-primary/5 text-primary'}`}>
                              {ps.songTitle} {ps.level} ({ps.levelValue})
                              {ps.alreadyCleared ? ' ✓' : ''}
                            </Link>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Push route plan */}
          {pushRoute && pushRoute.phases.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text mb-3">📋 推分路线规划</h3>
              <p className="text-xs text-text-secondary mb-4">{pushRoute.summary}</p>

              <div className="flex flex-col gap-3">
                {pushRoute.phases.map(phase => (
                  <div key={phase.phase} className="border border-border/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-text">
                        阶段 {phase.phase}：{phase.title}
                      </span>
                      <span className="text-xs text-primary font-medium">
                        预估 +{phase.estimatedGain} 分
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mb-2">
                      目标达成率：{phase.targetAchievement}，{phase.songCount} 首候选曲目
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {phase.songs.slice(0, 5).map(s => (
                        <Link key={`${s.songId}-${s.levelIndex}`}
                          to={"/songs/" + s.songId}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-bg-gray text-text-secondary hover:underline">
                          {s.songTitle} {s.levelValue}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-text-tertiary mt-4 pt-3 border-t border-border/30">
                🎯 目标：{pushRoute.currentRating} → {pushRoute.targetRating}（+{pushRoute.targetRating - pushRoute.currentRating}）
              </p>
            </div>
          )}

          {/* Ladder strategy card (P0-5) */}
          {strategy && (
            <div className="bg-surface border border-border rounded-lg p-5 mt-4">
              <h3 className="text-sm font-semibold text-text mb-2">
                📊 定数阶梯策略
              </h3>
              <p className="text-xs text-text-secondary mb-2">
                当前段位：{strategy.min}–{strategy.max} 分
              </p>
              <div className="text-xs text-text whitespace-pre-line leading-relaxed">
                {strategy.content}
              </div>
            </div>
          )}
        </ErrorBoundary>
      )}
    </div>
  )
}
