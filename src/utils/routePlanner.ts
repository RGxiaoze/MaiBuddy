// ============================================================
// Push route planner — generate phased push roadmaps
// ============================================================

import { type B50Result, type PushSuggestion } from './rating'
import type { ChartStatSummary } from '@/services/statsService'

export interface RoutePhase {
  /** Phase number */
  phase: number
  /** Phase title */
  title: string
  /** Target levelValue range */
  levelRange: string
  /** Number of songs to push in this phase */
  songCount: number
  /** Target achievement rate */
  targetAchievement: string
  /** Estimated total rating gain */
  estimatedGain: number
  /** Songs to push (top N from suggestions in this range) */
  songs: PushSuggestion[]
}

export interface PushRoute {
  /** Current total rating */
  currentRating: number
  /** Target total rating */
  targetRating: number
  /** Phased plan */
  phases: RoutePhase[]
  /** Overall summary */
  summary: string
}

/**
 * Generate a phased push route plan based on B50 floor analysis.
 * Groups push suggestions into difficulty tiers, using chart_stats when available
 * to prioritize easier-than-average charts and set realistic targets.
 */
export function generatePushRoute(
  b50: B50Result,
  suggestions: PushSuggestion[],
  getStats?: (songId: number, level: string) => ChartStatSummary | undefined,
): PushRoute | null {
  if (suggestions.length === 0) return null

  // Filter: exclude 15-level for players below 14500
  const filtered = b50.totalRating < 14500
    ? suggestions.filter(s => s.levelValue < 15)
    : suggestions

  // Boost charts easier than their level average
  const scored = filtered.map(s => {
    const stats = getStats?.(s.songId, s.level)
    let boost = 0
    if (stats) {
      // Bonus for charts easier than same-level average
      if (stats.diffFromLevelAvg > 1.5) boost = 2
      else if (stats.diffFromLevelAvg > 0.5) boost = 1
    }
    return { ...s, _boost: boost }
  })

  // Sort: boost priority → rating gain desc
  scored.sort((a, b) => b._boost - a._boost || b.ratingGain - a.ratingGain)

  // Define tier boundaries
  const tiers = [
    { min: 10.0, max: 12.5, title: '低定数区 (10.0~12.5)', defaultAch: 'SSS+ (100.5%)' },
    { min: 12.5, max: 13.5, title: '中定数区 (12.5~13.5)', defaultAch: 'SSS (100.0%)' },
    { min: 13.5, max: 14.0, title: '高定数区 (13.5~14.0)', defaultAch: 'SS+ (99.5%)' },
    { min: 14.0, max: 99.0, title: '超高定数区 (14.0+)', defaultAch: 'SS (99.0%)+' },
  ]

  const phases: RoutePhase[] = []
  let usedIds = new Set<string>()

  for (const tier of tiers) {
    const tierSongs = scored.filter(s => {
      const key = `${s.songId}-${s.levelIndex}`
      return s.levelValue >= tier.min && s.levelValue < tier.max && !usedIds.has(key)
    })

    if (tierSongs.length === 0) continue

    // Take top 5 per tier
    const top = tierSongs.slice(0, 5)
    for (const s of top) usedIds.add(`${s.songId}-${s.levelIndex}`)

    const estimatedGain = top.reduce((sum, s) => sum + s.ratingGain, 0)

    // Dynamic target: use chart_stats when available to make realistic targets
    const statsSamples = top
      .map(s => getStats?.(s.songId, s.level))
      .filter(Boolean) as ChartStatSummary[]
    let targetAch = tier.defaultAch
    if (statsSamples.length > 0) {
      const avgFullServer = statsSamples.reduce((sum, st) => sum + st.avg, 0) / statsSamples.length
      if (avgFullServer > 99.5) targetAch = 'SSS+ (100.5%)'
      else if (avgFullServer > 98) targetAch = 'SSS (100.0%)'
      else targetAch = 'SS+ (99.5%)'
    }

    phases.push({
      phase: phases.length + 1,
      title: tier.title,
      levelRange: `${tier.min.toFixed(1)}~${tier.max < 99 ? tier.max.toFixed(1) : '15.0'}`,
      songCount: top.length,
      targetAchievement: targetAch,
      estimatedGain,
      songs: top,
    })
  }

  const totalGain = phases.reduce((s, p) => s + p.estimatedGain, 0)

  return {
    currentRating: b50.totalRating,
    targetRating: b50.totalRating + totalGain,
    phases,
    summary: `按此路线分 ${phases.length} 个阶段推分，预估可提升 ${totalGain} 分（${b50.totalRating} → ${b50.totalRating + totalGain}）。优先推 B15 新曲、优先推定数高但拟合难度低的谱面。`,
  }
}
