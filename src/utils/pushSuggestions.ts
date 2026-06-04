// ============================================================
// Push suggestions — generate improvement recommendations for B50
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import type { ChartStatSummary } from '@/services/statsService'
import { type B50Result } from './b50'
import { computeRating } from './rating'
import { classifyDifficulty, realisticTargetAch } from './difficultyTier'
import {
  MAX_ACHIEVEMENTS, UTAGE_ID_THRESHOLD, B35_FALLBACK_LEVEL, B35_MODE_MIN_COUNT,
  SKIP_LOW_LEVEL, SKIP_LOW_ACH,
  SSSP_SORT_WEIGHT, SUGGESTION_SORT_TOLERANCE,
} from '@/config/algorithms'

/** A single push suggestion — a score that can replace a B50 floor entry */
export interface PushSuggestion {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  currentAchievements: number
  currentRating: number
  /** Target achievement to reach */
  targetAchievements: number
  /** Rating at target achievement */
  targetRating: number
  /** Total rating gain if this suggestion is achieved */
  ratingGain: number
  pool: 'b35' | 'b15'
  /** How hard it is to achieve the gain */
  difficulty: 'easy' | 'medium' | 'hard'
  /** SSS+ rate from chart stats (0 if unavailable) */
  sssPlusRate: number
}

/**
 * Find the most frequent level value in an array (mode), rounded to given precision.
 * Tie-breaking: picks the higher level value when multiple values have equal frequency.
 *
 * @param levels - 定数数组
 * @param precision - 舍入精度（默认 0.1）
 * @returns 众数定数值，空数组返回 0
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

function makeSuggestion(
  score: ScoreRecord, currentRating: number, targetRating: number,
  gain: number, pool: 'b35' | 'b15',
  chartStats?: ChartStatSummary,
  targetAch: number = MAX_ACHIEVEMENTS,
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
 * Generate push suggestions based on improvement potential.
 *
 * 算法步骤：
 * 1. 确定 B35/B15 两池的地板分（最低 Rating 的成绩）
 * 2. 对每首谱面取最高达成率的成绩，跳过宴会场
 * 3. 计算 B35 定数众数作为玩家舒适区，推荐伸展区（众数+0.1 到 +0.5）
 * 4. 不在 B50 中的谱面：若目标 Rating > 地板分且落在伸展区内 → 生成建议
 * 5. 已是 B50 地板曲目的谱面：若提升达成率能涨分 → 生成建议
 * 6. 排除"随便打打"的低定数低达成率成绩（定数 < 14 且达成率 < 97%）
 * 7. 按加权分排序：ratingGain × (1 + sssPlusRate × 2)，优先水分曲
 *
 * @param allScores - 所有本地成绩
 * @param songMap - Map<songId, Song> 用于查 isNew
 * @param currentB50 - 当前 B50 结果
 * @param getStats - 可选的全服统计查询回调
 * @returns 推分建议列表（按优先级排序）
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

  // Build set of charts already in B50 + their floor entry for floor detection
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
    if (s.songId >= UTAGE_ID_THRESHOLD) continue
    const key = `${s.songId}-${s.levelIndex}`
    const existing = bestByChart.get(key)
    if (!existing || s.achievements > existing.achievements) {
      bestByChart.set(key, s)
    }
  }

  // ---- Compute recommendation level range from B35 mode ----
  const b35Levels = currentB50.best35.map(e => e.levelValue)
  const mode = b35Levels.length >= B35_MODE_MIN_COUNT
    ? computeLevelMode(b35Levels)
    : (b35Levels.length > 0 ? b35Levels.reduce((s, l) => s + l, 0) / b35Levels.length : B35_FALLBACK_LEVEL)
  // Recommend charts from mode+0.1 to mode+0.5 (stretch zone just above comfort)
  const MIN_RECOMMEND_LEVEL = mode > 0 ? mode + 0.1 : 0
  const MAX_RECOMMEND_LEVEL = mode > 0 ? mode + 0.5 : B35_FALLBACK_LEVEL

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
    if (score.levelValue < SKIP_LOW_LEVEL && score.achievements < SKIP_LOW_ACH && !inB50.has(key)) {
      continue
    }

    const song = songMap.get(score.songId)
    const songIsNew = song?.isNew ?? false

    // Use realistic target achievement based on player's B50 ceiling
    const realisticTarget = realisticTargetAch(score.levelValue, mode)
    const targetRating = computeRating(score.levelValue, Math.min(realisticTarget, MAX_ACHIEVEMENTS))
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
  suggestions.sort((a, b) => {
    const aScore = a.ratingGain * (1 + a.sssPlusRate * SSSP_SORT_WEIGHT)
    const bScore = b.ratingGain * (1 + b.sssPlusRate * SSSP_SORT_WEIGHT)
    if (Math.abs(bScore - aScore) < SUGGESTION_SORT_TOLERANCE) {
      return b.levelValue - a.levelValue
    }
    return bScore - aScore
  })
  return suggestions
}
