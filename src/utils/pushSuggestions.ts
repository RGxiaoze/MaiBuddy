// ============================================================
// Push suggestions v2 — scan song DB instead of player scores
// Three-target gain calculation per suggestion
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import type { ChartStatSummary } from '@/services/statsService'
import { type B50Result } from './b50'
import { computeRating } from './rating'
import { classifyDifficulty, realisticTargetAchFor, type LevelSample } from './difficultyTier'
import { isChartExcluded } from '@/data/excluded-charts'
import { predictLevelToAch } from './regression'
import {
  MAX_ACHIEVEMENTS, UTAGE_ID_THRESHOLD, B35_FALLBACK_LEVEL, B35_MODE_MIN_COUNT,
  SKIP_LOW_LEVEL, SKIP_LOW_ACH,
  SSSP_SORT_WEIGHT, SUGGESTION_SORT_TOLERANCE,
  B15_SIZE, MAX_B15_SUGGESTIONS, MAX_B35_SUGGESTIONS,
  RECOMMEND_CAP_ABOVE_B1, RECOMMEND_CAP_SIMPLE, SIMPLE_FIT_DIFF_GAP, SIMPLE_TARGET_FLOOR,
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

/** A push suggestion with three columns of gains + optional AP column */
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
  /** 全服 AP 率（来自 chart_stats.fc_dist），用于 AP 推分排序 */
  apRate: number
  /** Three gains: [SS+(99%), SSS(100%), SSS+(100.5%)] */
  gains: [PushGain, PushGain, PushGain]
  /** Optional AP gain — only present when SSS+ gain is already 0 */
  apGain?: PushGain
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

/**
 * 推荐定数上限：以 B50 中 Rating 最高的那条（B1）为锚点。
 * 返回 null 表示没有 B50，调用方应退回旧规则。
 */
export function computeRecommendCaps(b50: B50Result): { capBase: number | null; capSimple: number | null } {
  const b1 = [...b50.best35, ...b50.best15]
    .reduce<typeof b50.best35[number] | null>((best, e) => (!best || e.dxRating > best.dxRating ? e : best), null)
  if (!b1) return { capBase: null, capSimple: null }

  // 一位小数取整，避免 14.0 + 0.2 = 14.200000000000001 把 14.2 挡掉
  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    capBase: round1(b1.levelValue + RECOMMEND_CAP_ABOVE_B1),
    capSimple: round1(b1.levelValue + RECOMMEND_CAP_SIMPLE),
  }
}

/** 「特简单」：拟合定数比官标低至少 SIMPLE_FIT_DIFF_GAP，且拟合定数已知（>0） */
export function isSimpleChart(levelValue: number, fitDiff?: number): boolean {
  if (!fitDiff || fitDiff <= 0) return false
  return Math.round((levelValue - fitDiff) * 10) / 10 >= SIMPLE_FIT_DIFF_GAP
}

function makeSuggestion(
  songId: number, songTitle: string,
  levelIndex: number, level: string, levelValue: number,
  currentAch: number, currentRating: number,
  pool: 'b35' | 'b15',
  difficulty: 'easy' | 'medium' | 'hard',
  sssPlusRate: number,
  apRate: number,
  precision: 'precise' | 'estimated',
  floorRating: number,
  targetLevels: readonly number[],
  mode: number,
  samples: readonly LevelSample[],
  excludeKey?: string,
  targetCeiling?: number,
): PushSuggestion {
  const ceiling = Math.min(
    realisticTargetAchFor(levelValue, mode, samples, excludeKey),
    targetCeiling ?? MAX_ACHIEVEMENTS,
  )
  const gains: PushGain[] = targetLevels.map((targetAch) => {
    const cappedTarget = Math.min(ceiling, targetAch)
    const targetRating = computeRating(levelValue, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
    const ratingGain = targetRating - floorRating
    // targetAch 存「实际可达成的目标」（可能被现实目标截断），
    // 否则 UI 会显示「推到 SSS+」却按 SSS 的收益计算，文案与数字对不上
    return { targetAch: Math.min(cappedTarget, MAX_ACHIEVEMENTS), targetRating, ratingGain: Math.max(0, ratingGain) }
  })

  // AP gain: only when SSS+ gain is already 0 (no more rating from achievement)
  let apGain: PushGain | undefined
  if (gains[2].ratingGain === 0) {
    const cappedTarget = Math.min(ceiling, MAX_ACHIEVEMENTS)
    const apRating = computeRating(levelValue, cappedTarget, 'ap')
    const apGainVal = Math.max(0, apRating - floorRating)
    if (apGainVal > 0) {
      apGain = { targetAch: MAX_ACHIEVEMENTS, targetRating: apRating, ratingGain: apGainVal }
    }
  }

  return {
    songId, songTitle, levelIndex, level, levelValue,
    currentAchievements: currentAch,
    currentRating,
    pool,
    difficulty,
    sssPlusRate,
    apRate,
    gains: gains as [PushGain, PushGain, PushGain],
    apGain,
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
  // 方案 C：用玩家自己在该定数段的典型成绩定目标（带谱面键，便于排除自身）
  const b50Samples: LevelSample[] = [
    ...currentB50.best35.map(e => ({ levelValue: e.levelValue, achievements: e.achievements, key: `${e.songId}-${e.levelIndex}` })),
    ...currentB50.best15.map(e => ({ levelValue: e.levelValue, achievements: e.achievements, key: `${e.songId}-${e.levelIndex}` })),
  ]
  const predictFn = predictLevelToAch(b50Scores)

  // 4. Build precise layer: B50 entries + all available scores
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
      if (inB50.has(key)) continue
      const existing = preciseScores.get(key)
      if (existing === undefined || s.achievements > existing) {
        preciseScores.set(key, s.achievements)
      }
    }
  }

  // 5. Compute mode and stretch zone
  const b35Levels = currentB50.best35.map(e => e.levelValue)
  const mode = b35Levels.length >= B35_MODE_MIN_COUNT
    ? computeLevelMode(b35Levels)
    : (b35Levels.length > 0 ? b35Levels.reduce((s, l) => s + l, 0) / b35Levels.length : B35_FALLBACK_LEVEL)
  // Upper bound: 以「当前最强一手」B1（Rating 最高的那条，可能来自 B15）为锚点。
  // 旧规则只看 B50 定数众数：B35 全是 13.8 鸟加的人也会被推 14.4 的谱。
  const { capBase, capSimple } = computeRecommendCaps(currentB50)

  // 无 B50 时退回旧规则，保证新用户仍有建议
  const STRETCH_UPPER_B35 = capBase ?? (mode > 14 ? mode + 0.3 : (mode > 0 ? mode + 0.5 : B35_FALLBACK_LEVEL))
  const STRETCH_UPPER_B15 = capBase ?? (mode > 0 ? mode + 1.0 : B35_FALLBACK_LEVEL)
  // Unified lower bound: mode - 1.0 (covers both B35 optimization and B15 floor replacement)
  const STRETCH_LOWER = mode > 0 ? Math.max(0, mode - 1.0) : 0
  // Progressive widening: when a pool has few entries, widen its lower bound to capture more candidates.
  const b15NotFull = currentB50.best15.length < B15_SIZE
  const b35NotFull = currentB50.best35.length < 35
  let B15_STRETCH_LOWER: number
  let B35_STRETCH_LOWER: number
  if (!b15NotFull) {
    B15_STRETCH_LOWER = STRETCH_LOWER
  } else if (currentB50.best15.length >= 5) {
    B15_STRETCH_LOWER = Math.max(0, mode - 0.5)
  } else {
    B15_STRETCH_LOWER = 0
  }
  if (!b35NotFull) {
    B35_STRETCH_LOWER = STRETCH_LOWER
  } else if (currentB50.best35.length >= 5) {
    B35_STRETCH_LOWER = Math.max(0, mode - 0.5)
  } else {
    B35_STRETCH_LOWER = 0
  }

  // 6. Scan song DB for candidates
  const suggestions: PushSuggestion[] = []
  const seenChart = new Set<string>()

  for (const song of songMap.values()) {
    // Scan both DX and standard charts to cover old-version (B35) and new-version (B15) pools
    const allDiffs = [...song.difficulties.dx, ...song.difficulties.standard]
    for (const diff of allDiffs) {
      const key = `${song.id}-${diff.levelIndex}`
      // Skip utage
      if (song.id >= UTAGE_ID_THRESHOLD) continue
      if (seenChart.has(key)) continue
      seenChart.add(key)

      const lv = diff.levelValue
      if (lv <= 0) continue
      const isNew = song.isNew

      // Filter: in stretch zone OR already in B50
      // 破顶候选（B1+0.2 ~ B1+0.4）先放行，稍后按拟合定数判定是否「特简单」
      if (inB50.has(key)) {
      } else {
        const minZ = isNew ? B15_STRETCH_LOWER : B35_STRETCH_LOWER
        const maxZ = isNew ? STRETCH_UPPER_B15 : STRETCH_UPPER_B35
        if (lv < minZ || lv > (capSimple ?? maxZ)) continue
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

      // 数据源异常、暂不推荐的谱面（见 excluded-charts）
      if (isChartExcluded(song.id, diff.levelIndex)) continue

      const stats = getStats?.(song.id, diff.level)

      // 破顶判定：超过 B1+0.2 的候选只允许「特简单」的谱（拟合定数比官标低 ≥0.3），
      // 且目标封顶在鸟（100.0%），避免「推上去也打不到」。
      let targetCeiling: number | undefined
      if (!inB50.has(key) && capBase !== null && lv > capBase) {
        if (!isSimpleChart(lv, stats?.fitDiff)) continue
        targetCeiling = SIMPLE_TARGET_FLOOR
      }

      if (!inB50.has(key)) {
        // Chart NOT in B50 — suggest for its version's pool
        const pool = isNew ? 'b15' as const : 'b35' as const
        const floorRating = pool === 'b15' ? floor15 : floor35

        const cand = makeSuggestion(
          song.id, song.title, diff.levelIndex, diff.level, lv,
          currentAch, currentRating, pool,
          classifyDifficulty(
            { levelValue: lv, achievements: currentAch } as ScoreRecord,
            stats,
            realisticTargetAchFor(lv, mode, b50Samples, key),
          ),
          stats?.sssPlusRate ?? 0,
          stats?.apRate ?? 0,
          precision,
          floorRating,
          TARGET_LEVELS,
          mode,
          b50Samples,
          key,
          targetCeiling,
        )
        // Only add if at least one gain > 0 (or AP gain exists)
        if (cand.gains.some(g => g.ratingGain > 0) || (cand.apGain && cand.apGain.ratingGain > 0)) {
          suggestions.push(cand)
        }
      } else if (inB50.has(key)) {
        // 已在 B50 池内（地板或非地板都算）：把当前成绩往上推，总分直接增加。
        // 此前只处理地板，导致「池内但非地板」的条目（如 B15 第 5 位还差一点 SSS+）
        // 既不进新候选分支、也不进地板分支，被完全跳过。
        const pool = currentB50.best35.some(e => `${e.songId}-${e.levelIndex}` === key) ? 'b35' as const : 'b15' as const

        // Calculate gains against current rating (improving this score)
        const realistic = realisticTargetAchFor(lv, mode, b50Samples, key)
        // 已有成绩已超过「现实目标」时，说明模型低估了玩家在此定数的水平，
        // 不再把目标向下截断——否则「100.24% 打到 100.0 目标」会被判为无提升空间。
        const capFor = (targetAch: number) =>
          currentAch >= realistic ? targetAch : Math.min(realistic, targetAch)
        const lifts: PushGain[] = TARGET_LEVELS.map((targetAch) => {
          const cappedTarget = capFor(targetAch)
          const targetRating = computeRating(lv, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
          const ratingGain = Math.max(0, targetRating - currentRating)
          // 同上：存实际可达成的目标，保证文案与收益一致
          return { targetAch: Math.min(cappedTarget, MAX_ACHIEVEMENTS), targetRating, ratingGain }
        })

        // AP gain for floor entry — compute before filter check
        let floorApGain: PushGain | undefined
        if (lifts[2].ratingGain === 0) {
          const cappedTarget = Math.min(realisticTargetAchFor(lv, mode, b50Samples, key), MAX_ACHIEVEMENTS)
          const apRatingFloor = computeRating(lv, cappedTarget, 'ap')
          const apGainFloor = Math.max(0, apRatingFloor - currentRating)
          if (apGainFloor > 0) {
            floorApGain = { targetAch: MAX_ACHIEVEMENTS, targetRating: apRatingFloor, ratingGain: apGainFloor }
          }
        }

        // 难度按「收益最大的那一档」衡量玩家还差多远，
        // 否则卡片写着 +19 分、标签却是「轻松」
        const bestLift = lifts.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
        const chosenTarget = floorApGain && floorApGain.ratingGain > bestLift.ratingGain
          ? floorApGain.targetAch
          : bestLift.targetAch

        // Include if any gain > 0 or AP gain exists (SSS+ already achievable)
        if (lifts.some(g => g.ratingGain > 0) || (floorApGain && floorApGain.ratingGain > 0)) {
          suggestions.push({
            songId: song.id, songTitle: song.title,
            levelIndex: diff.levelIndex, level: diff.level, levelValue: lv,
            currentAchievements: currentAch,
            currentRating,
            pool,
            difficulty: classifyDifficulty({ levelValue: lv, achievements: currentAch } as ScoreRecord, stats, chosenTarget),
            sssPlusRate: stats?.sssPlusRate ?? 0,
            apRate: stats?.apRate ?? 0,
            gains: lifts as [PushGain, PushGain, PushGain],
            apGain: floorApGain,
            precision,
          })
        }
      }
    }
  }

  // 7. Sort: non-AP entries by SSS+ gain descending; AP entries by apRate descending
  const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 }
  suggestions.sort((a, b) => {
    const aHasAP = !!(a.apGain && a.apGain.ratingGain > 0)
    const bHasAP = !!(b.apGain && b.apGain.ratingGain > 0)

    // AP entries sort by apRate (desc) → levelValue (asc) → difficulty
    if (aHasAP && bHasAP) {
      if (a.apRate !== b.apRate) return b.apRate - a.apRate
      if (a.levelValue !== b.levelValue) return a.levelValue - b.levelValue
      return DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]
    }
    // Non-AP entries come before AP entries
    if (aHasAP !== bHasAP) return aHasAP ? 1 : -1

    // Both non-AP: sort by SSS+ gain descending
    const aGain = a.gains[2].ratingGain
    const bGain = b.gains[2].ratingGain
    const aScore = aGain * (1 + a.sssPlusRate * SSSP_SORT_WEIGHT)
    const bScore = bGain * (1 + b.sssPlusRate * SSSP_SORT_WEIGHT)
    if (Math.abs(bScore - aScore) < SUGGESTION_SORT_TOLERANCE) {
      return b.levelValue - a.levelValue
    }
    return bScore - aScore
  })

  // Cap per pool (B35 / B15 各用各的上限)
  const b35Pool = suggestions.filter(s => s.pool === 'b35')
  const b15Pool = suggestions.filter(s => s.pool === 'b15')
  if (b35Pool.length > MAX_B35_SUGGESTIONS) b35Pool.length = MAX_B35_SUGGESTIONS
  if (b15Pool.length > MAX_B15_SUGGESTIONS) b15Pool.length = MAX_B15_SUGGESTIONS
  suggestions.length = 0
  suggestions.push(...b35Pool, ...b15Pool)

  // 8. Precision note
  const hasEstimated = suggestions.some(s => s.precision === 'estimated')
  const precisionNote = !allScores && hasEstimated
    ? '推分建议基于 B50 数据 + 社区统计生成（未导入完整成绩）。导入完整成绩可获得更精准的个人化推荐。'
    : undefined

  return { suggestions, precisionNote }
}
