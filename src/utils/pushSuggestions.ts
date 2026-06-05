// ============================================================
// Push suggestions v2 — scan song DB instead of player scores
// Three-target gain calculation per suggestion
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import type { ChartStatSummary } from '@/services/statsService'
import { type B50Result } from './b50'
import { computeRating } from './rating'
import { classifyDifficulty, realisticTargetAch } from './difficultyTier'
import { predictLevelToAch } from './regression'
import {
  MAX_ACHIEVEMENTS, UTAGE_ID_THRESHOLD, B35_FALLBACK_LEVEL, B35_MODE_MIN_COUNT,
  SKIP_LOW_LEVEL, SKIP_LOW_ACH,
  SSSP_SORT_WEIGHT, SUGGESTION_SORT_TOLERANCE,
} from '@/config/algorithms'

// ---- Types ----

/** Three target achievement levels */
export const TARGET_LEVELS = [99, 100, 100.5] as const

/** A single target's gain info */
export interface PushGain {
  targetAch: number
  targetRating: number
  ratingGain: number
}

/** A push suggestion with three columns of gains + precision flag */
export interface PushSuggestion {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  /** Actual achievement (precise) or predicted (estimated) */
  currentAchievements: number
  currentRating: number
  pool: 'b35' | 'b15'
  difficulty: 'easy' | 'medium' | 'hard'
  sssPlusRate: number
  /** Three gains: [SS+(99%), SSS(100%), SSS+(100.5%)] */
  gains: [PushGain, PushGain, PushGain]
  /** Precision: 'precise' when player achievement is known; 'estimated' otherwise */
  precision: 'precise' | 'estimated'
}

export interface PushSuggestionsResult {
  suggestions: PushSuggestion[]
  /** Non-empty for B50-only data (no full scores imported) */
  precisionNote?: string
}

// ---- Internal helpers ----

function computeLevelMode(levels: number[], precision: number = 0.1): number {
  if (levels.length === 0) return 0
  const freq = new Map<number, number>()
  for (const lv of levels) {
    const rounded = Math.round(lv / precision) * precision
    freq.set(rounded, (freq.get(rounded) || 0) + 1)
  }
  let mode = 0
  let maxFreq = 0
  for (const [lv, f] of freq) {
    if (f > maxFreq || (f === maxFreq && lv > mode)) {
      maxFreq = f
      mode = lv
    }
  }
  return mode
}

function makeSuggestion(
  songId: number, songTitle: string,
  levelIndex: number, level: string, levelValue: number,
  currentAch: number, currentRating: number,
  pool: 'b35' | 'b15',
  difficulty: 'easy' | 'medium' | 'hard',
  sssPlusRate: number,
  precision: 'precise' | 'estimated',
  floorRating: number,
  targetLevels: readonly number[],
  mode: number,
): PushSuggestion {
  const gains: PushGain[] = targetLevels.map((targetAch) => {
    const cappedTarget = Math.min(realisticTargetAch(levelValue, mode), targetAch)
    const targetRating = computeRating(levelValue, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
    const ratingGain = targetRating - floorRating
    return { targetAch, targetRating, ratingGain: Math.max(0, ratingGain) }
  })

  return {
    songId, songTitle, levelIndex, level, levelValue,
    currentAchievements: currentAch,
    currentRating,
    pool,
    difficulty,
    sssPlusRate,
    gains: gains as [PushGain, PushGain, PushGain],
    precision,
  }
}

// ---- Main export ----

/**
 * Generate push suggestions.
 *
 * Scans the full song database for charts in the player's stretch zone
 * (mode+0.1 to mode+0.5), computes three-target gains, and marks precision.
 *
 * @param currentB50 - B50 data (from local compute or Diving-Fish query)
 * @param songMap - full song database Map<songId, Song>
 * @param options.allScores - optional: extends precise layer beyond B50
 * @param options.getStats - optional: chart stats for difficulty classification
 * @returns { suggestions, precisionNote }
 */
export function computePushSuggestions(
  currentB50: B50Result,
  songMap: Map<number, Song>,
  options?: {
    allScores?: ScoreRecord[]
    getStats?: (songId: number, level: string) => ChartStatSummary | undefined
  },
): PushSuggestionsResult {
  const allScores = options?.allScores
  const getStats = options?.getStats

  if (currentB50.best35.length === 0 && currentB50.best15.length === 0) {
    return { suggestions: [] }
  }

  // 1. B50 floors
  const floor35 = currentB50.best35.length > 0
    ? currentB50.best35[currentB50.best35.length - 1].dxRating : 0
  const floor15 = currentB50.best15.length > 0
    ? currentB50.best15[currentB50.best15.length - 1].dxRating : 0

  // 2. Build inB50 + floorKeys
  const inB50 = new Set<string>()
  const floorKeys = new Set<string>()
  if (currentB50.best35.length > 0) {
    floorKeys.add(`${currentB50.best35[currentB50.best35.length - 1].songId}-${currentB50.best35[currentB50.best35.length - 1].levelIndex}`)
  }
  if (currentB50.best15.length > 0) {
    floorKeys.add(`${currentB50.best15[currentB50.best15.length - 1].songId}-${currentB50.best15[currentB50.best15.length - 1].levelIndex}`)
  }
  for (const e of currentB50.best35) inB50.add(`${e.songId}-${e.levelIndex}`)
  for (const e of currentB50.best15) inB50.add(`${e.songId}-${e.levelIndex}`)

  // 3. Regression: predict achievement from B50 level values
  const b50Scores = [
    ...currentB50.best35.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
    ...currentB50.best15.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
  ]
  const predictFn = predictLevelToAch(b50Scores)

  // 4. Build precise layer set: B50 entries always precise + allScores within 2%
  const PRECISE_TOLERANCE = 2.0
  const preciseScores = new Map<string, number>() // key → achievements
  for (const e of currentB50.best35) {
    preciseScores.set(`${e.songId}-${e.levelIndex}`, e.achievements)
  }
  for (const e of currentB50.best15) {
    preciseScores.set(`${e.songId}-${e.levelIndex}`, e.achievements)
  }
  if (allScores) {
    for (const s of allScores) {
      const key = `${s.songId}-${s.levelIndex}`
      if (inB50.has(key)) continue  // skip B50 entries (already in preciseScores)
      const predicted = predictFn(s.levelValue)
      if (Math.abs(s.achievements - predicted) <= PRECISE_TOLERANCE) {
        const existing = preciseScores.get(key)
        if (existing === undefined || s.achievements > existing) {
          preciseScores.set(key, s.achievements)
        }
      }
    }
  }

  // 5. Compute mode and stretch zone
  const b35Levels = currentB50.best35.map(e => e.levelValue)
  const mode = b35Levels.length >= B35_MODE_MIN_COUNT
    ? computeLevelMode(b35Levels)
    : (b35Levels.length > 0 ? b35Levels.reduce((s, l) => s + l, 0) / b35Levels.length : B35_FALLBACK_LEVEL)
  const STRETCH_UPPER = mode > 0 ? mode + 0.5 : B35_FALLBACK_LEVEL
  // Unified lower bound: mode - 1.0 (covers both B35 optimization and B15 floor replacement)
  const STRETCH_LOWER = mode > 0 ? Math.max(0, mode - 1.0) : 0
  // B15 special: when B15 has empty slots (version reset), tighten lower to avoid green/yellow chart noise
  const B15_FULL_COUNT = 15
  const b15NotFull = currentB50.best15.length < B15_FULL_COUNT
  const B15_STRETCH_LOWER = b15NotFull ? Math.max(0, mode - 0.5) : STRETCH_LOWER

  // 6. Scan song DB for candidates
  const suggestions: PushSuggestion[] = []
  const seenChart = new Set<string>()

  for (const song of songMap.values()) {
    for (const diff of song.difficulties.dx) {
      const key = `${song.id}-${diff.levelIndex}`
      // Skip utage
      if (song.id >= UTAGE_ID_THRESHOLD) continue
      if (seenChart.has(key)) continue
      seenChart.add(key)

      const lv = diff.levelValue
      const isNew = song.isNew

      // Filter: in stretch zone OR already in B50
      if (inB50.has(key)) {
      } else {
        const minZ = isNew ? B15_STRETCH_LOWER : STRETCH_LOWER
        if (lv < minZ || lv > STRETCH_UPPER) continue
      }

      // Determine precision + current achievements
      let currentAch: number
      let precision: 'precise' | 'estimated'
      const preciseAch = preciseScores.get(key)

      if (preciseAch !== undefined) {
        // B50 entries: filter low-ach noise for non-floor non-B50 entries
        if (!inB50.has(key) && lv < SKIP_LOW_LEVEL && preciseAch < SKIP_LOW_ACH) continue
        currentAch = preciseAch
        precision = 'precise'
      } else {
        currentAch = predictFn(lv)
        precision = 'estimated'
      }

      const currentRating = computeRating(lv, currentAch)
      if (currentRating <= 0) continue

      const stats = getStats?.(song.id, diff.level)

      if (!inB50.has(key)) {
        // Chart NOT in B50 — suggest for its version's pool
        const pool = isNew ? 'b15' as const : 'b35' as const
        const floorRating = pool === 'b15' ? floor15 : floor35

        const cand = makeSuggestion(
          song.id, song.title, diff.levelIndex, diff.level, lv,
          currentAch, currentRating, pool,
          classifyDifficulty({ levelValue: lv, achievements: currentAch } as ScoreRecord, stats, 100.5),
          stats?.sssPlusRate ?? 0,
          precision,
          floorRating,
          TARGET_LEVELS,
          mode,
        )
        // Only add if at least one gain > 0
        if (cand.gains.some(g => g.ratingGain > 0)) {
          suggestions.push(cand)
        }
      } else if (floorKeys.has(key)) {
        // This is the B50 floor — suggest improving it
        const pool = currentB50.best35.some(e => `${e.songId}-${e.levelIndex}` === key) ? 'b35' as const : 'b15' as const

        // Calculate gains against current rating (improving this score)
        const lifts: PushGain[] = TARGET_LEVELS.map((targetAch) => {
          const cappedTarget = Math.min(realisticTargetAch(lv, mode), targetAch)
          const targetRating = computeRating(lv, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
          const ratingGain = Math.max(0, targetRating - currentRating)
          return { targetAch, targetRating, ratingGain }
        })

        if (lifts.some(g => g.ratingGain > 0)) {
          suggestions.push({
            songId: song.id, songTitle: song.title,
            levelIndex: diff.levelIndex, level: diff.level, levelValue: lv,
            currentAchievements: currentAch,
            currentRating,
            pool,
            difficulty: classifyDifficulty({ levelValue: lv, achievements: currentAch } as ScoreRecord, stats),
            sssPlusRate: stats?.sssPlusRate ?? 0,
            gains: lifts as [PushGain, PushGain, PushGain],
            precision,
          })
        }
      }
    }
  }

  // 7. Sort by SSS+ gain descending (weighted by SSS+ rate for "水分曲" boost)
  suggestions.sort((a, b) => {
    const aGain = a.gains[2].ratingGain  // SSS+ gain
    const bGain = b.gains[2].ratingGain
    const aScore = aGain * (1 + a.sssPlusRate * SSSP_SORT_WEIGHT)
    const bScore = bGain * (1 + b.sssPlusRate * SSSP_SORT_WEIGHT)
    if (Math.abs(bScore - aScore) < SUGGESTION_SORT_TOLERANCE) {
      return b.levelValue - a.levelValue
    }
    return bScore - aScore
  })

  // 8. Precision note
  const hasEstimated = suggestions.some(s => s.precision === 'estimated')
  const precisionNote = !allScores && hasEstimated
    ? '推分建议基于 B50 数据 + 社区统计生成（未导入完整成绩）。导入完整成绩可获得更精准的个人化推荐。'
    : undefined

  return { suggestions, precisionNote }
}
