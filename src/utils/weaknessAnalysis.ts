// ============================================================
// Personal weakness analysis — chart_stats benchmarked
// ============================================================
// Algorithm:
//   1. Classify every played chart into 1 of 7 tags
//   2. Within each tag, split into 3 level tiers (13.x / 14.x / 15.x)
//   3. For each (tag × tier) cell, compute residual = playerAch − chartAvg
//   4. Flag weak cells: mean residual < −1.5%, N ≥ 5
//   5. Show top 3 worst-residual charts per weak cell

import { classifyChart, type ChartTag, ALL_TAGS, getTagMeta } from './chartTags'
import type { Song, ChartDifficulty } from '@/types'
import type { ScoreRecord } from '@/db/database'
import type { ChartStatSummary } from '@/services/statsService'

// ---- Configuration ----

/** Minimum samples per (tag × tier) cell to flag as weak */
const MIN_SAMPLE = 5
/** Residual below this threshold marks a weakness */
const WEAK_RESIDUAL = -1.5

/** Level tiers for stratification */
const LEVEL_TIERS: { range: string; lo: number; hi: number }[] = [
  { range: '13.x', lo: 13.0, hi: 14.0 },
  { range: '14.x', lo: 14.0, hi: 15.0 },
  { range: '15.x', lo: 15.0, hi: Infinity },
]

// ---- Types ----

/** A single chart reference for "top dragger" display */
export interface DraggerRef {
  songId: number
  title: string
  levelIndex: number
}

/** Per-tier statistics within a tag */
export interface TierResidual {
  range: string
  /** Number of charts in this tier with chart_stats data */
  count: number
  /** Mean of (playerAchievement − chartAvg) across all charts in this tier */
  meanResidual: number
  /** Standard deviation of residuals */
  stdDev: number
  /** Whether this tier is flagged as weak */
  isWeak: boolean
  /** Top 3 charts dragging the average down (most negative residuals) */
  topDraggers: DraggerRef[]
}

export interface TagWeaknessStats {
  tag: ChartTag
  label: string
  desc: string
  /** Total charts of this tag played */
  totalCount: number
  /** Overall average achievement (across all tiers) */
  avgAchievement: number
  /** Per-tier residual breakdown (always 3 entries: 13.x / 14.x / 15.x) */
  tiers: TierResidual[]
}

export interface WeaknessResult {
  tagStats: TagWeaknessStats[]
  /** Whether chart_stats data was available for benchmarking */
  hasStatsData: boolean
  /** Human-readable assessment sentence */
  assessment: string
}

// ---- Public API ----

/** Stats getter type — injected for testability */
export type StatsGetter = (songId: number, level: string) => ChartStatSummary | undefined

/**
 * Analyze player weakness by comparing per-chart achievement to global averages.
 *
 * @param scores   — all locally stored score records
 * @param songMap  — songId → Song lookup
 * @param getStats — chart_stats lookup (inject getChartStats for prod, mock for tests)
 */
export function analyzeWeakness(
  scores: ScoreRecord[],
  songMap: Map<number, Song>,
  getStats: StatsGetter,
): WeaknessResult {
  // ---- Step 1: classify every score into (tag × tier) buckets ----
  // Structure: Map<tag, Map<tier_idx, {achievements, residuals, songRefs}[]>>
  type ChartEntry = {
    achievements: number
    residual: number | null // null if chart_stats unavailable
    songId: number
    title: string
    levelIndex: number
  }

  const buckets = new Map<ChartTag, Map<number, ChartEntry[]>>()
  for (const tag of ALL_TAGS) {
    const tierMap = new Map<number, ChartEntry[]>()
    LEVEL_TIERS.forEach((_, i) => tierMap.set(i, []))
    buckets.set(tag, tierMap)
  }

  let hasStatsData = false

  for (const score of scores) {
    const song = songMap.get(score.songId)
    if (!song) continue

    const allDiffs: ChartDifficulty[] = [
      ...(song.difficulties?.standard || []),
      ...(song.difficulties?.dx || []),
    ]
    const diff = allDiffs.find(d => d.levelIndex === score.levelIndex)
    if (!diff) continue

    const tag = classifyChart(diff, song.bpm)

    // Determine level tier
    const lv = score.levelValue
    let tierIdx = LEVEL_TIERS.findIndex(t => lv >= t.lo && lv < t.hi)
    if (tierIdx < 0) tierIdx = LEVEL_TIERS.length - 1 // fallback

    // Compute residual against chart_stats
    const stats = getStats(score.songId, score.level)
    let residual: number | null = null
    if (stats) {
      hasStatsData = true
      residual = score.achievements - stats.avg
    }

    buckets.get(tag)!.get(tierIdx)!.push({
      achievements: score.achievements,
      residual,
      songId: score.songId,
      title: score.songTitle,
      levelIndex: score.levelIndex,
    })
  }

  // ---- Step 2: aggregate per-tag + per-tier ----
  const tagStats: TagWeaknessStats[] = ALL_TAGS.map(tag => {
    const tierMap = buckets.get(tag)!
    let totalCount = 0
    let sumAch = 0

    const tiers: TierResidual[] = LEVEL_TIERS.map((tier, i) => {
      const entries = tierMap.get(i) || []
      const withStats = entries.filter(e => e.residual !== null)
      const residuals = withStats.map(e => e.residual!)

      const count = withStats.length
      const meanResidual = count > 0
        ? Math.round(residuals.reduce((s, r) => s + r, 0) / count * 100) / 100
        : 0
      const variance = count > 1
        ? residuals.reduce((s, r) => s + (r - meanResidual) ** 2, 0) / (count - 1)
        : 0
      const stdDev = Math.round(Math.sqrt(variance) * 100) / 100
      const isWeak = count >= MIN_SAMPLE && meanResidual < WEAK_RESIDUAL

      // Top 3 draggers — charts with most negative residual
      const sorted = [...withStats].sort((a, b) => (a.residual ?? 0) - (b.residual ?? 0))
      const topDraggers: DraggerRef[] = sorted.slice(0, 3).map(e => ({
        songId: e.songId,
        title: e.title,
        levelIndex: e.levelIndex,
      }))

      totalCount += entries.length
      sumAch += entries.reduce((s, e) => s + e.achievements, 0)

      return { range: tier.range, count, meanResidual, stdDev, isWeak, topDraggers }
    })

    const avgAchievement = totalCount > 0
      ? Math.round(sumAch / totalCount * 100) / 100
      : 0
    const meta = getTagMeta(tag)

    return { tag, label: meta.label, desc: meta.desc, totalCount, avgAchievement, tiers }
  })

  // ---- Step 3: assessment ----
  let assessment: string
  if (!hasStatsData) {
    assessment = '需要联网获取数据，以对比各类型谱面的表现。'
  } else {
    const weakTiers = tagStats.flatMap(t =>
      t.tiers.filter(ti => ti.isWeak).map(ti => ({ label: t.label, range: ti.range }))
    )
    if (weakTiers.length === 0) {
      assessment = '各方面发展均衡，各类型谱面的表现都不错，继续保持！'
    } else {
      const top = weakTiers.slice(0, 2)
      const parts = top.map(w => `「${w.label}（${w.range}）」`)
      assessment = `可以更多关注的类型为 ${parts.join(' 和 ')}，这些区间还有提升空间，多练练会有进步！`
    }
  }

  return { tagStats, hasStatsData, assessment }
}
