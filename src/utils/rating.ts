// ============================================================
// Rating & B50 calculation — pure functions, no side effects
// Reference: ScoreCoefficient.js from maimaidx-prober
// ============================================================

import { COEFFICIENT_TABLE } from '@/data/constants'
import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import type { ChartStatSummary } from '@/services/statsService'

// Validate coefficient table ordering at module load (dev-only guard)
if (import.meta.env.DEV) {
  for (let i = 1; i < COEFFICIENT_TABLE.length; i++) {
    if (COEFFICIENT_TABLE[i].min >= COEFFICIENT_TABLE[i - 1].min) {
      console.error(`COEFFICIENT_TABLE 未按降序排列，索引 ${i}: ${COEFFICIENT_TABLE[i].min} >= ${COEFFICIENT_TABLE[i - 1].min}`)
    }
  }
}

/**
 * Compute single-chart DX Rating.
 * Formula: floor(coeff × levelValue × min(achievements, 100.5) / 100)
 */
export function computeRating(levelValue: number, achievements: number): number {
  if (achievements <= 0 || levelValue <= 0) return 0
  const cap = Math.min(achievements, 100.5)

  for (const row of COEFFICIENT_TABLE) {
    if (cap >= row.min) {
      return Math.floor(row.coeff * levelValue * cap / 100)
    }
  }
  return 0
}

/**
 * Compute the theoretical maximum DX Rating achievable with the current song library.
 * Assumes 100.5% achievement on every song's highest-difficulty chart.
 * Caps at top 35 old-version + top 15 new-version songs (B50 structure).
 */
export function computeTheoreticalMaxRating(songs: Song[]): number {
  const oldPool: { levelValue: number }[] = []
  const newPool: { levelValue: number }[] = []

  for (const song of songs) {
    if (song.id >= 100000) continue // skip utage
    let bestLevelValue = 0
    for (const diff of [...song.difficulties.standard, ...song.difficulties.dx]) {
      if (diff.levelValue > bestLevelValue) {
        bestLevelValue = diff.levelValue
      }
    }
    if (bestLevelValue <= 0) continue
    if (song.isNew) {
      newPool.push({ levelValue: bestLevelValue })
    } else {
      oldPool.push({ levelValue: bestLevelValue })
    }
  }

  oldPool.sort((a, b) => b.levelValue - a.levelValue)
  newPool.sort((a, b) => b.levelValue - a.levelValue)

  const bestOld = oldPool.slice(0, 35)
  const bestNew = newPool.slice(0, 15)

  let total = 0
  for (const e of bestOld) total += computeRating(e.levelValue, 100.5)
  for (const e of bestNew) total += computeRating(e.levelValue, 100.5)

  return total
}

/** B50 result entry — best score for a single chart */
export interface B50Entry {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  songType: string
  achievements: number
  rate: string
  dxRating: number
  dxScore: number
  fcType: string | null
  fsType: string | null
  isNew: boolean
}

/** Full B50 result */
export interface B50Result {
  best35: B50Entry[]
  best15: B50Entry[]
  best35Total: number
  best15Total: number
  totalRating: number
}

/** A single push suggestion — a score that can replace a B50 floor entry */
export interface PushSuggestion {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  currentAchievements: number
  currentRating: number
  /** Target achievement to reach (e.g. 100.5 for theoretical ceiling) */
  targetAchievements: number
  /** Rating at target achievement */
  targetRating: number
  /** Total rating gain if this suggestion is achieved */
  ratingGain: number
  pool: 'b35' | 'b15'
  /** How hard it is to achieve the gain: easy (already close), medium, hard (large gap) */
  difficulty: 'easy' | 'medium' | 'hard'
  /** SSS+ rate from chart stats (0 if unavailable); used to prioritize 水分曲 */
  sssPlusRate: number
}

/**
 * Sort B50 entries: rating desc → levelValue desc → achievements desc
 */
function sortByRating(a: B50Entry, b: B50Entry): number {
  if (a.dxRating !== b.dxRating) return b.dxRating - a.dxRating
  if (a.levelValue !== b.levelValue) return b.levelValue - a.levelValue
  return b.achievements - a.achievements
}

/**
 * Compute B50 from local scores + song metadata.
 * `scores` — all score records in IndexedDB
 * `songMap` — Map<songId, Song> for looking up levelValue & isNew
 */
export function computeB50(scores: ScoreRecord[], songMap: Map<number, Song>): B50Result {
  // Step 1: for each (songId + levelIndex), keep only the best achievement
  const bestByChart = new Map<string, ScoreRecord>()
  for (const s of scores) {
    const key = `${s.songId}-${s.levelIndex}`
    const existing = bestByChart.get(key)
    // Note: we compare achievement to select best score per chart
    if (!existing || s.achievements > existing.achievements) {
      bestByChart.set(key, s)
    }
  }

  // Step 2: build B50 entries, computing per-chart rating
  // Determine isNew from song metadata; fall back to songType === 'dx' if song not found
  const entries: B50Entry[] = []
  for (const s of bestByChart.values()) {
    const song = songMap.get(s.songId)

    // Skip utage (song_id >= 100000)
    if (s.songId >= 100000) continue

    // For scores that already have a pre-computed dxRating, use it
    // Otherwise compute from levelValue + achievements
    const levelValue = s.levelValue
    const dxRating = s.dxRating > 0 ? s.dxRating : computeRating(levelValue, s.achievements)

    if (dxRating <= 0) continue

    entries.push({
      songId: s.songId,
      songTitle: s.songTitle,
      levelIndex: s.levelIndex,
      level: s.level,
      levelValue,
      songType: s.songType,
      achievements: s.achievements,
      rate: s.rate,
      dxRating,
      dxScore: s.dxScore,
      fcType: s.fcType,
      fsType: s.fsType,
      isNew: song?.isNew ?? false,
    })
  }

  // Step 3: sort by rating desc
  entries.sort(sortByRating)

  // Step 4: split into old (best35) and new (best15)
  const oldPool: B50Entry[] = []
  const newPool: B50Entry[] = []
  for (const e of entries) {
    if (e.isNew) {
      newPool.push(e)
    } else {
      oldPool.push(e)
    }
  }

  // Step 5: take top N
  const best35 = oldPool.slice(0, 35)
  const best15 = newPool.slice(0, 15)

  const best35Total = best35.reduce((sum, e) => sum + e.dxRating, 0)
  const best15Total = best15.reduce((sum, e) => sum + e.dxRating, 0)

  return {
    best35,
    best15,
    best35Total,
    best15Total,
    totalRating: best35Total + best15Total,
  }
}

/**
 * Find the most frequent level value in an array (mode), rounded to given precision.
 * Tie-breaking: picks the higher level value when multiple values have equal frequency.
 * Returns 0 if the array is empty.
 */
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

/**
 * Generate push suggestions based on improvement potential.
 *
 * For each chart with scores:
 * - If NOT in B50: suggests if its potential rating (at 100.5%) exceeds the floor
 * - If IS the B50 floor entry: suggests improving it further
 * Sorted by potential rating gain descending.
 */
export function computePushSuggestions(
  allScores: ScoreRecord[],
  songMap: Map<number, Song>,
  currentB50: B50Result,
  getStats?: (songId: number, level: string) => ChartStatSummary | undefined,
): PushSuggestion[] {
  if (currentB50.best35.length === 0 && currentB50.best15.length === 0) {
    return []
  }

  const floor35 = currentB50.best35.length > 0
    ? currentB50.best35[currentB50.best35.length - 1].dxRating : 0
  const floor15 = currentB50.best15.length > 0
    ? currentB50.best15[currentB50.best15.length - 1].dxRating : 0

  // Build set of charts already in B50 + their entry for floor detection
  const inB50 = new Set<string>()
  const floorKeys = new Set<string>()
  if (currentB50.best35.length > 0) {
    const floor = currentB50.best35[currentB50.best35.length - 1]
    floorKeys.add(`${floor.songId}-${floor.levelIndex}`)
  }
  if (currentB50.best15.length > 0) {
    const floor = currentB50.best15[currentB50.best15.length - 1]
    floorKeys.add(`${floor.songId}-${floor.levelIndex}`)
  }
  for (const e of currentB50.best35) inB50.add(`${e.songId}-${e.levelIndex}`)
  for (const e of currentB50.best15) inB50.add(`${e.songId}-${e.levelIndex}`)

  // Dedup: keep highest achievement per chart
  const bestByChart = new Map<string, ScoreRecord>()
  for (const s of allScores) {
    if (s.songId >= 100000) continue
    const key = `${s.songId}-${s.levelIndex}`
    const existing = bestByChart.get(key)
    if (!existing || s.achievements > existing.achievements) {
      bestByChart.set(key, s)
    }
  }

  // ---- Compute recommendation level range from B35 mode ----
  // Find the most common level value in B35, then recommend the stretch zone
  // just above it (mode+0.1 to mode+0.5).
  const b35Levels = currentB50.best35.map(e => e.levelValue)
  const mode = b35Levels.length >= 5
    ? computeLevelMode(b35Levels)
    : (b35Levels.length > 0 ? b35Levels.reduce((s, l) => s + l, 0) / b35Levels.length : 14)
  // Recommend charts from mode+0.1 to mode+0.5 (stretch zone just above comfort)
  const MIN_RECOMMEND_LEVEL = mode > 0 ? mode + 0.1 : 0
  const MAX_RECOMMEND_LEVEL = mode > 0 ? mode + 0.5 : 14

  const suggestions: PushSuggestion[] = []

  for (const [key, score] of bestByChart) {
    const currentRating = score.dxRating > 0
      ? score.dxRating
      : computeRating(score.levelValue, score.achievements)
    if (currentRating <= 0) continue

    // Non-B50 charts: only suggest within the stretch zone (mode+0.1 to mode+0.5)
    if (!inB50.has(key)) {
      if (score.levelValue < MIN_RECOMMEND_LEVEL || score.levelValue > MAX_RECOMMEND_LEVEL) {
        continue
      }
    }

    // Exclusion: skip sub-97% scores on sub-14 charts (likely "just playing around")
    if (score.levelValue < 14 && score.achievements < 97 && !inB50.has(key)) {
      continue
    }

    const song = songMap.get(score.songId)
    const songIsNew = song?.isNew ?? false

    // Use realistic target achievement based on player's B50 ceiling
    // instead of assuming theoretical 100.5% for all charts
    const realisticTarget = realisticTargetAch(score.levelValue, mode)
    const targetRating = computeRating(score.levelValue, Math.min(realisticTarget, 100.5))
    const stats = getStats?.(score.songId, score.level)

    if (!inB50.has(key)) {
      // Chart NOT in B50 — only suggest for its version's pool
      if (songIsNew) {
        checkPool(floor15, 'b15')
      } else {
        checkPool(floor35, 'b35')
      }
    } else if (floorKeys.has(key)) {
      // This chart IS the floor — suggest improving it
      if (targetRating > currentRating) {
        const gain = targetRating - currentRating
        const pool = currentB50.best35.some(e => `${e.songId}-${e.levelIndex}` === key) ? 'b35' as const : 'b15' as const
        suggestions.push(makeSuggestion(score, currentRating, targetRating, gain, pool, stats, realisticTarget))
      }
    }

    function checkPool(floor: number, pool: 'b35' | 'b15') {
      if (floor > 0 && targetRating > floor) {
        const gain = targetRating - floor
        // Only add if better than existing suggestion for this chart
        const existing = suggestions.find(s => s.songId === score.songId && s.levelIndex === score.levelIndex)
        if (!existing || gain > existing.ratingGain) {
          if (existing) {
            const idx = suggestions.indexOf(existing)
            suggestions.splice(idx, 1)
          }
          suggestions.push(makeSuggestion(score, currentRating, targetRating, gain, pool, stats, realisticTarget))
        }
      }
    }
  }

  // Weighted sort: boost charts that are "水分曲" (high SSS+ rate = easier than level suggests)
  // A chart with sssPlusRate=0.25 gets +50% boost; sssPlusRate=0.02 gets only +4%
  suggestions.sort((a, b) => {
    const aScore = a.ratingGain * (1 + a.sssPlusRate * 2)
    const bScore = b.ratingGain * (1 + b.sssPlusRate * 2)
    // Tie-break: prefer higher level value
    if (Math.abs(bScore - aScore) < 0.1) {
      return b.levelValue - a.levelValue
    }
    return bScore - aScore
  })
  return suggestions
}

/** Target achievement used for push suggestions (theoretical ceiling) */
const TARGET_ACHIEVEMENTS = 100.5

/**
 * Estimate a realistic target achievement for a chart at the given level,
 * based on the player's B35 comfort zone (mode).
 * Charts at or near comfort zone → theoretical ceiling (100.5%).
 * Charts in stretch zone (mode+0.3~0.5) → SSS (100.0%).
 */
function realisticTargetAch(levelValue: number, baseLevel: number): number {
  const gap = levelValue - baseLevel
  if (gap <= -0.5) return 100.5   // well within comfort zone
  if (gap <= 0)   return 100.5   // at comfort level → target theoretical
  if (gap <= 0.3) return 100.5   // close stretch → still aim for theoretical
  if (gap <= 0.5) return 100.0   // moderate stretch → SSS
  if (gap <= 1.0) return 99.0    // far stretch (beyond MAX_RECOMMEND, for B50 floor entries)
  return 98.5
}

function makeSuggestion(
  score: ScoreRecord, currentRating: number, targetRating: number,
  gain: number, pool: 'b35' | 'b15',
  chartStats?: ChartStatSummary,
  targetAch: number = TARGET_ACHIEVEMENTS,
): PushSuggestion {
  return {
    songId: score.songId,
    songTitle: score.songTitle,
    levelIndex: score.levelIndex,
    level: score.level,
    levelValue: score.levelValue,
    currentAchievements: score.achievements,
    currentRating,
    targetAchievements: targetAch,
    targetRating,
    ratingGain: gain,
    pool,
    difficulty: classifyDifficulty(score, chartStats),
    sssPlusRate: chartStats?.sssPlusRate ?? 0,
  }
}

/**
 * Classify push difficulty for a score using chart_stats data when available.
 * Falls back to achievement-only logic when stats are not loaded.
 */
function classifyDifficulty(
  score: ScoreRecord,
  chartStats?: ChartStatSummary,
): 'easy' | 'medium' | 'hard' {
  // Fallback: no chart_stats loaded
  if (!chartStats) {
    if (score.achievements >= 99.5) return 'easy'
    if (score.achievements >= 98.0) return 'medium'
    return 'hard'
  }

  // 15-level special: always "hard"
  if (score.levelValue >= 15) return 'hard'

  // Core: diff from same-level average
  const diff = chartStats.diffFromLevelAvg
  let difficulty: 'easy' | 'medium' | 'hard'

  if (diff > 2.0) {
    difficulty = 'easy'
  } else if (diff > -1.0) {
    difficulty = 'medium'
  } else {
    difficulty = 'hard'
  }

  // SSS+ rate boost
  if (chartStats.sssPlusRate > 0.15 && difficulty === 'hard') {
    difficulty = 'medium'
  } else if (chartStats.sssPlusRate > 0.15 && difficulty === 'medium') {
    difficulty = 'easy'
  }

  return difficulty
}
