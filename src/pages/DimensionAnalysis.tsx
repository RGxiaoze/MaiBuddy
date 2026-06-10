// ============================================================
// Five-dimension analysis page — ECharts radar chart
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Target, ClipboardList, BarChart3 } from 'lucide-react'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { usePlayerStore } from '@/store/playerStore'
import { computeChartDimensions, computeChartDimensionsRaw, computePlayerDimensions, type DimensionScores } from '@/utils/dimensions'
import { analyzeWeakness } from '@/utils/weaknessAnalysis'
import { computeAchievementMetrics } from '@/utils/achievementMetrics'
import { computeTheoreticalMaxBoth } from '@/utils/b50'
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
  processing:  { name: '底力', color: '#DC2626', desc: '贯穿全程的基本功——良好的节奏感、协调与发力，让你在交互、双押、扫键、纵连等基础配置中游刃有余。底力越强，越能从容应对高 BPM 谱面，下位谱面的难点也不再棘手。' },
  stamina:     { name: '体力', color: '#D97706', desc: '身体素质的体现——支持你长时间处理高密度配置而不掉速。体力越好，越能在反复推分中保持状态，扛住高难度谱面的持续消耗，稳扎稳打出成绩。' },
  burst:       { name: '爆发', color: '#A855F7', desc: '手速与协调的体现——处理瞬时高密度音符的能力。爆发越高，越能从容面对当前水平谱面的超高速配置。' },
  positioning: { name: '定位', color: '#22C55E', desc: '手臂在不断移动中准确击中判定点的能力。定位越准，越能从容应对反复变换位置的配置，处理一般的星星配置也更稳定。' },
  technique:   { name: '技巧', color: '#3B82F6', desc: '利用协调与记忆力，处理星星、Touch 以及各类非常规配置的能力。技巧越强，越能驾驭围绕星星和 Touch 展开的复合难点，甚至可以通过对判定的理解，用巧妙的非常规方式化解常规配置的棘手之处。' },
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

  // Achievement metrics (only when local B50 is available)
  const theoryMaxAll = useMemo(() => songs.length > 0 ? computeTheoreticalMaxBoth(songs) : { sssPlusMax: 0, apMax: 0 }, [songs])
  const theoryMax = theoryMaxAll.sssPlusMax
  const metrics = useMemo(() => {
    if (!localB50 || songs.length === 0) return null
    return computeAchievementMetrics(scores, localB50.totalRating, theoryMax)
  }, [localB50, scores, songs, theoryMax])

  // Weakness analysis (benchmarked against chart_stats)
  const weakness = useMemo(() => {
    if (scores.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    return analyzeWeakness(scores, songMap, getChartStats)
  }, [scores, songs])

  // Push route plan
  const pushRoute = useMemo(() => {
    if (!localB50 || songs.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    const suggestions = computePushSuggestions(localB50, songMap, { allScores: scores, getStats: getChartStats }).suggestions
    return generatePushRoute(localB50, suggestions, getChartStats, theoryMax)
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

      {/* Achievement metrics cards — only when local B50 is ready */}
      {!isLoading && metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {/* Card 1: Completion (AP + SSS+) */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary mb-2 font-medium">完成度</p>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">AP</span>
                <span className="text-sm font-semibold text-success">
                  {metrics.apCount} 首
                  <span className="text-xs text-text-tertiary ml-1">(+{metrics.apRatingBonus} Rating)</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-text-secondary">SSS+</span>
                <span className="text-sm font-semibold" style={{ color: '#FFD700' }}>{metrics.sssPlusCount} 首</span>
              </div>
            </div>
          </div>

          {/* Card 2: Rating progress */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary mb-2 font-medium">Rating 进度</p>
            <p className="text-2xl font-bold text-text">{localB50!.totalRating.toFixed(0)}</p>
            <div className="w-full bg-bg-gray rounded-full h-2 mt-2">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(metrics.ratingProgress, 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary mt-1 text-right">
              {metrics.ratingProgress.toFixed(1)}%
              {metrics.apRatingBonus > 0 && (
                <span className="text-success ml-1">(AP 加成 +{metrics.apRatingBonus})</span>
              )}
            </p>
          </div>

          {/* Card 3: Level distribution */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <p className="text-xs text-text-secondary mb-2 font-medium">定数分布</p>
            <div className="space-y-1">
              {metrics.levelDist.map(tier => (
                <div key={tier.range} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-text-secondary tabular-nums">{tier.range}</span>
                  <div className="flex-1 bg-bg-gray rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-accent transition-all"
                      style={{ width: `${tier.count > 0 ? Math.min((tier.count / Math.max(...metrics.levelDist.map(t => t.count), 1)) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-text font-medium w-16 text-right">
                    {tier.count > 0 ? `${tier.avgAch.toFixed(1)}%` : '—'}
                  </span>
                  <span className="tabular-nums text-text-secondary text-xs w-10 text-right">
                    {tier.count > 0 ? `${tier.count}首` : '0'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              <h3 className="text-sm font-semibold text-text mb-3">擅长的配置</h3>

              {!weakness.hasStatsData ? (
                <div className="bg-bg-gray rounded-lg p-4 text-center">
                  <p className="text-sm text-text-secondary">需要联网获取数据，以便对比各类型谱面的表现</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-secondary mb-3">{weakness.assessment}</p>

                  {/* Tag buttons */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {weakness.tagStats.filter(t => t.totalCount > 0).map(stat => (
                      <button
                        key={stat.tag}
                        onClick={() => setWeaknessTab(weaknessTab === stat.tag ? null : stat.tag)}
                        className={`px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer border-none
                          ${weaknessTab === stat.tag
                            ? 'bg-primary text-white'
                            : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}
                      >
                        {stat.label} {stat.avgAchievement.toFixed(1)}%
                      </button>
                    ))}
                  </div>

                  {/* Expanded tier detail */}
                  {weaknessTab && (() => {
                    const tab = weakness.tagStats.find(t => t.tag === weaknessTab)!
                    const meta = getTagMeta(tab.tag)
                    return (
                      <div className="border-t border-border/30 pt-3">
                        <p className="text-xs text-text-secondary mb-3">
                          <strong>{meta.label}</strong>：{meta.desc}（共 {tab.totalCount} 首）
                        </p>

                        {/* Only show tiers that need attention */}
                        {tab.tiers.filter(t => t.isWeak).length === 0 ? (
                          <p className="text-xs text-text-secondary bg-bg-gray rounded px-3 py-2">
                            该类型各定数区间表现良好，暂无需要重点关注的项目。
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {tab.tiers.filter(t => t.isWeak).map(tier => (
                              <div
                                key={tier.range}
                                className="rounded px-3 py-2 text-xs bg-warning/10 border border-warning/20"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-text">
                                    定数 {tier.range}
                                  </span>
                                  <span className="text-text-secondary tabular-nums">
                                    N={tier.count} 差距={tier.meanResidual > 0 ? '+' : ''}{tier.meanResidual.toFixed(1)}% σ={tier.stdDev.toFixed(1)}%
                                  </span>
                                </div>

                                {tier.topDraggers.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-text-tertiary">可重点关注：</span>
                                    {tier.topDraggers.map((d, i) => (
                                      <span key={d.songId} className="inline-flex items-center">
                                        <Link
                                          to={`/songs/${d.songId}`}
                                          className="text-primary hover:underline text-[11px]">
                                          {d.title}
                                      </Link>
                                      {i < tier.topDraggers.length - 1 && (
                                        <span className="text-text-tertiary mx-0.5">·</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          )}

          {/* Push route plan */}
          {pushRoute && pushRoute.phases.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-text mb-3"><ClipboardList size={16} className="inline mr-1" /> 推分路线规划</h3>
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
                    <div className="space-y-1.5">
                      {phase.songs.slice(0, 5).map(s => {
                        const maxGain = s.apGain?.ratingGain
                          ? { label: 'AP +1', gain: s.apGain.ratingGain, color: 'text-success' }
                          : s.gains[2].ratingGain > 0
                            ? { label: 'SSS+', gain: s.gains[2].ratingGain, color: 'text-text' }
                            : s.gains[1].ratingGain > 0
                              ? { label: 'SSS', gain: s.gains[1].ratingGain, color: 'text-text-secondary' }
                              : { label: 'SS+', gain: s.gains[0].ratingGain, color: 'text-text-tertiary' }
                        return (
                          <Link key={`${s.songId}-${s.levelIndex}`}
                            to={"/songs/" + s.songId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-bg-gray hover:bg-surface-light transition-colors no-underline"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-text truncate">{s.songTitle}</span>
                              <span className="text-[10px] text-text-tertiary shrink-0">{s.levelValue.toFixed(1)}</span>
                            </span>
                            <span className={`text-xs font-medium tabular-nums shrink-0 ml-2 ${maxGain.color}`}>
                              {maxGain.label} +{maxGain.gain}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-text-tertiary mt-4 pt-3 border-t border-border/30">
                <Target size={14} className="inline mr-1" />目标：{pushRoute.currentRating} → {pushRoute.targetRating}（+{pushRoute.targetRating - pushRoute.currentRating}）
              </p>
            </div>
          )}

          {/* Ladder strategy card (P0-5) */}
          {strategy && (
            <div className="bg-surface border border-border rounded-lg p-5 mt-4">
              <h3 className="text-sm font-semibold text-text mb-2">
                <BarChart3 size={16} className="inline mr-1" />定数阶梯策略
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
