// ============================================================
// Push difficulty classification — classify how hard it is to improve a chart
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { ChartStatSummary } from '@/services/statsService'
import {
  FALLBACK_EASY_ACH, FALLBACK_MEDIUM_ACH, ALWAYS_HARD_LEVEL,
  EASY_DIFF_THRESHOLD, HARD_DIFF_THRESHOLD, SSSP_RATE_BOOST,
  MAX_ACHIEVEMENTS, TARGET_GAP_WELL_BELOW, TARGET_GAP_AT_COMFORT,
  TARGET_GAP_CLOSE, TARGET_GAP_MODERATE, TARGET_GAP_FAR, TARGET_FALLBACK_ACH,
  DIFF_WEIGHT_COMMUNITY, DIFF_WEIGHT_GAP,
  DIFF_COMPOSITE_EASY, DIFF_COMPOSITE_MEDIUM,
  DIFF_GAP_NORM_MAX, DIFF_COMMUNITY_NORM_OFFSET,
  DIFF_GAP_HARD, DIFF_GAP_MEDIUM,
  DIFF_FALLBACK_GAP_THRESHOLD,
  DIFF_LEVEL_PENALTY, DIFF_LEVEL_BASE,
} from '@/config/algorithms'

/** Clamp value to [0, 1] */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/**
 * Estimate a realistic target achievement for a chart at the given level,
 * based on the player's B35 comfort zone (baseLevel = mode of B35 levelValues).
 *
 * 算法步骤：
 * 1. 计算 gap = 目标谱面定数 − 玩家舒适区定数
 * 2. 根据 gap 分段返回合理的达成率目标：
 *    - gap ≤ −0.5：远低于舒适区 → 天花板 100.5%
 *    - −0.5 < gap ≤ 0：在舒适区内 → 天花板 100.5%
 *    - 0 < gap ≤ 0.5：紧凑伸展（覆盖完整推分区间）→ 天花板 100.5%
 *    - 0.5 < gap ≤ 1.0：中度伸展 → SSS 100.0%
 *    - 1.0 < gap ≤ 1.5：远伸展 → SS+ 99.0%
 *    - gap > 1.5：回退 → SS 98.5%
 *
 * @param levelValue - 目标谱面定数
 * @param baseLevel - 玩家 B35 舒适区定数（众数）
 * @returns 合理的目标达成率（百分比）
 */
export function realisticTargetAch(levelValue: number, baseLevel: number): number {
  const gap = levelValue - baseLevel
  if (gap <= TARGET_GAP_WELL_BELOW) return MAX_ACHIEVEMENTS
  if (gap <= TARGET_GAP_AT_COMFORT) return MAX_ACHIEVEMENTS
  if (gap <= TARGET_GAP_CLOSE) return MAX_ACHIEVEMENTS
  if (gap <= TARGET_GAP_MODERATE) return 100.0
  if (gap <= TARGET_GAP_FAR) return 99.0
  return TARGET_FALLBACK_ACH
}

// ---- 方案 C：用玩家自己的成绩定目标 ----

/** 样本：某条成绩的定数与达成率（可带谱面键，便于排除自身） */
export interface LevelSample {
  levelValue: number
  achievements: number
  key?: string
}

/** 判定「定数相近」的窗口（±） */
export const TYPICAL_WINDOW = 0.3
/** 少于该样本数时不信中位数，退回档位规则 */
export const TYPICAL_MIN_SAMPLES = 5
/** 在自己典型成绩上加多少作为可争取的目标 */
export const TYPICAL_STRETCH = 0.5
/** B15（新版本）池子小、样本偏斜，拉伸更保守 */
export const TYPICAL_STRETCH_B15 = 0.3

/**
 * 玩家在某个定数附近的**典型达成率**（中位数）。
 *
 * 样本不足时返回 null —— 宁可退回保守的档位规则，也不用一两条成绩定目标。
 */
export function typicalAchievement(
  levelValue: number,
  samples: readonly LevelSample[],
  excludeKey?: string,
): number | null {
  const near = samples
    .filter(s => s.key !== excludeKey)
    .filter(s => Math.abs(s.levelValue - levelValue) <= TYPICAL_WINDOW)
    .map(s => s.achievements)
    .sort((a, b) => a - b)

  if (near.length < TYPICAL_MIN_SAMPLES) return null
  const mid = Math.floor(near.length / 2)
  return near.length % 2 === 1 ? near[mid] : (near[mid - 1] + near[mid]) / 2
}

/**
 * 目标达成率 = min(档位天花板, 玩家典型成绩 + 0.5)。
 *
 * 档位天花板由 `realisticTargetAch` 给出；玩家样本不足时完全退化为原规则。
 * 这样「B50 里 14.1 的谱普遍只打 98%」的人不会再被推 100.5%。
 */
export function realisticTargetAchFor(
  levelValue: number,
  baseLevel: number,
  samples?: readonly LevelSample[],
  excludeKey?: string,
  stretch = TYPICAL_STRETCH,
): number {
  const tierCeiling = realisticTargetAch(levelValue, baseLevel)
  if (!samples || samples.length === 0) return tierCeiling

  const typical = typicalAchievement(levelValue, samples, excludeKey)
  if (typical === null) return tierCeiling

  return Math.min(tierCeiling, Math.min(typical + stretch, MAX_ACHIEVEMENTS))
}

/**
 * Classify push difficulty for a score, with optional target achievement for gap-based adjustment.
 *
 * ### 有 chart_stats + targetAchievements（综合加权模式）
 *
 * 1. 15 级谱面无论数据如何，一律归为 "hard"（个人差极大）
 * 2. 计算社区分 `[0,1]`：`(diffFromLevelAvg + OFFSET) / (OFFSET * 2)`
 *    - diff = +2.5（水分曲）→ 0.75
 *    - diff = 0（平均）→ 0.50
 *    - diff = -2（硬谱）→ 0.30
 * 3. 计算 gap 分 `[0,1]`：`1 - (targetAch - currentAch) / NORM_MAX`
 *    - gap = 2%（小gap）→ 0.87
 *    - gap = 5%（中gap）→ 0.67
 *    - gap = 10%（大gap）→ 0.33
 * 4. 复合分 = 0.6 × 社区分 + 0.4 × gap 分
 * 5. 复合分 ≥ 0.65 → easy, ≥ 0.35 → medium, < 0.35 → hard
 * 6. SSS+ 率 > 15% 时提升一档
 *
 * ### 有 chart_stats 但无 targetAchievements（仅社区数据）
 *
 * 与旧版相同：基于 diffFromLevelAvg 和 SSS+ 率。
 *
 * ### 无 chart_stats（回退路径）
 *
 * 1. 达成率 ≥ 99.5% → easy, ≥ 98.0% → medium, < 98.0% → hard
 * 2. 如有 targetAchievements：gap > 5% 时降一级
 *
 * @param score - 成绩记录
 * @param chartStats - 全服统计（可选）
 * @param targetAchievements - 目标达成率（如 100.5），用于 gap 评分
 * @returns 推分难度分类
 */
function classifyBaseDifficulty(
  score: ScoreRecord,
  chartStats?: ChartStatSummary,
  targetAchievements?: number,
): 'easy' | 'medium' | 'hard' {
  // === Path 1: chart_stats available ===
  if (chartStats) {
    // 15-level special: always "hard" — extreme individual differences
    if (score.levelValue >= ALWAYS_HARD_LEVEL) return 'hard'

    // When targetAchievements is provided, use weighted composite
    if (targetAchievements !== undefined) {
      const gap = targetAchievements - score.achievements
      const communityScore = clamp01((chartStats.diffFromLevelAvg + DIFF_COMMUNITY_NORM_OFFSET) / (DIFF_COMMUNITY_NORM_OFFSET * 2))
      const gapScore = clamp01(1 - gap / DIFF_GAP_NORM_MAX)
      const composite = DIFF_WEIGHT_COMMUNITY * communityScore + DIFF_WEIGHT_GAP * gapScore

      // Level-adjusted thresholds: higher level → stricter bar
      const levelPenalty = DIFF_LEVEL_PENALTY * Math.max(0, score.levelValue - DIFF_LEVEL_BASE)
      const easyThreshold = DIFF_COMPOSITE_EASY + levelPenalty
      const mediumThreshold = DIFF_COMPOSITE_MEDIUM + levelPenalty

      let difficulty: 'easy' | 'medium' | 'hard'
      if (composite >= easyThreshold) {
        difficulty = 'easy'
      } else if (composite >= mediumThreshold) {
        difficulty = 'medium'
      } else {
        difficulty = 'hard'
      }

      // SSS+ rate boost
      if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'hard') {
        difficulty = 'medium'
      } else if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'medium') {
        difficulty = 'easy'
      }

      return difficulty
    }

    // No targetAchievements: original community-only logic
    const diff = chartStats.diffFromLevelAvg
    let difficulty: 'easy' | 'medium' | 'hard'

    if (diff > EASY_DIFF_THRESHOLD) {
      difficulty = 'easy'
    } else if (diff > HARD_DIFF_THRESHOLD) {
      difficulty = 'medium'
    } else {
      difficulty = 'hard'
    }

    if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'hard') {
      difficulty = 'medium'
    } else if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'medium') {
      difficulty = 'easy'
    }

    return difficulty
  }

  // === Path 2: No chart_stats — achievement-only fallback ===
  if (score.achievements >= FALLBACK_EASY_ACH) {
    if (targetAchievements !== undefined && (targetAchievements - score.achievements) > DIFF_FALLBACK_GAP_THRESHOLD) {
      return 'medium'
    }
    return 'easy'
  }
  if (score.achievements >= FALLBACK_MEDIUM_ACH) {
    if (targetAchievements !== undefined && (targetAchievements - score.achievements) > DIFF_FALLBACK_GAP_THRESHOLD) {
      return 'hard'
    }
    return 'medium'
  }
  return 'hard'
}

/** easy < medium < hard 的档位序号 */
const DIFF_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 }

/**
 * 按「目标 − 当前」的差距抬升难度下限。
 *
 * 之前推分建议调用本函数时没传 targetAchievements，标签完全由全服数据决定：
 * 一首全服好打的谱，即使玩家自己只打到 98%，也会被标成「轻松」。
 */
function applyGapFloor(
  difficulty: 'easy' | 'medium' | 'hard',
  score: ScoreRecord,
  targetAchievements?: number,
): 'easy' | 'medium' | 'hard' {
  if (targetAchievements === undefined) return difficulty

  const gap = targetAchievements - score.achievements
  const floor = gap > DIFF_GAP_HARD ? 'hard' : gap > DIFF_GAP_MEDIUM ? 'medium' : 'easy'
  return DIFF_RANK[difficulty] >= DIFF_RANK[floor] ? difficulty : floor
}

/**
 * 推分/推荐场景的难度判定。
 *
 * 在基础判定（全服数据 + 定数惩罚）之上，再叠加「玩家自己离目标多远」的下限，
 * 让标签反映的是「对你难不难」，而不只是「这首谱在全服好不好吃分」。
 */
export function classifyDifficulty(
  score: ScoreRecord,
  chartStats?: ChartStatSummary,
  targetAchievements?: number,
): 'easy' | 'medium' | 'hard' {
  return applyGapFloor(
    classifyBaseDifficulty(score, chartStats, targetAchievements),
    score,
    targetAchievements,
  )
}
