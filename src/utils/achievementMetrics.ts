// ============================================================
// Achievement metrics — AP/SSS+ count, rating progress, level distribution
// ============================================================

import type { ScoreRecord } from '@/db/database'

/** Single level-distribution bucket */
export interface LevelDistEntry {
  range: string
  avgAch: number
  count: number
}

/** Aggregated achievement metrics for the stats dashboard */
export interface AchievementMetrics {
  apCount: number
  sssPlusCount: number
  /** 已获 AP 带来的 Rating 加成（每个 AP +1） */
  apRatingBonus: number
  /** Rating progress as percentage (0–100) */
  ratingProgress: number
  /** Per-level-tier distribution (always 4 tiers) */
  levelDist: LevelDistEntry[]
}

/** Level-value tiers for distribution breakdown */
const LEVEL_TIERS: { range: string; lo: number; hi: number }[] = [
  { range: '13.x', lo: 13.0, hi: 13.999 },
  { range: '14.0–14.5', lo: 14.0, hi: 14.599 },
  { range: '14.6–14.9', lo: 14.6, hi: 14.999 },
  { range: '15.0+', lo: 15.0, hi: Infinity },
]

/**
 * Compute achievement-level metrics from local score records and B50 data.
 *
 * @param scores  — all locally stored score records
 * @param totalRating — current best-50 total rating
 * @param theoreticalMax — theoretical maximum rating (all charts AP)
 */
export function computeAchievementMetrics(
  scores: ScoreRecord[],
  totalRating: number,
  theoreticalMax: number,
): AchievementMetrics {
  // AP / SSS+ counts
  const apCount = scores.filter(s => s.fcType === 'ap' || s.fcType === 'app').length
  const sssPlusCount = scores.filter(s => s.achievements >= 100.5).length

  // Rating progress
  const ratingProgress = theoreticalMax > 0
    ? Math.round((totalRating / theoreticalMax) * 10000) / 100
    : 0

  // Level distribution (4 tiers)
  const levelDist: LevelDistEntry[] = LEVEL_TIERS.map(({ range, lo, hi }) => {
    const bucket = scores.filter(s => s.levelValue >= lo && s.levelValue < hi)
    const avgAch = bucket.length > 0
      ? Math.round(bucket.reduce((sum, s) => sum + s.achievements, 0) / bucket.length * 100) / 100
      : 0
    return { range, avgAch, count: bucket.length }
  })

  return { apCount, sssPlusCount, apRatingBonus: apCount, ratingProgress, levelDist }
}
