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
} from '@/config/algorithms'

/**
 * Estimate a realistic target achievement for a chart at the given level,
 * based on the player's B35 comfort zone (baseLevel = mode of B35 levelValues).
 *
 * 算法步骤：
 * 1. 计算 gap = 目标谱面定数 − 玩家舒适区定数
 * 2. 根据 gap 分段返回合理的达成率目标：
 *    - gap ≤ −0.5：远低于舒适区 → 天花板 100.5%
 *    - −0.5 < gap ≤ 0：在舒适区内 → 天花板 100.5%
 *    - 0 < gap ≤ 0.3：紧凑伸展 → 天花板 100.5%
 *    - 0.3 < gap ≤ 0.5：中度伸展 → SSS 100.0%
 *    - 0.5 < gap ≤ 1.0：远伸展 → SS 99.0%（B50 地板曲目的上限）
 *    - gap > 1.0：回退 → SS+ 98.5%
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

/**
 * Classify push difficulty for a score using chart_stats data when available.
 * Falls back to achievement-only logic when stats are not loaded.
 *
 * 算法步骤（有 chart_stats 时）：
 * 1. 15 级谱面无论数据如何，一律归为 "hard"（个人差极大）
 * 2. 计算 diffFromLevelAvg（谱面全服平均达成率 − 同级全服平均达成率）
 * 3. diff > 2.0 → easy（水分曲，比同级容易很多）
 * 4. diff > −1.0 → medium（正常难度）
 * 5. diff ≤ −1.0 → hard（硬谱，比同级难）
 * 6. SSS+ 率 > 15% 时提升一档：hard → medium, medium → easy
 *
 * 算法步骤（无 chart_stats 回退）：
 * 1. 达成率 ≥ 99.5% → easy
 * 2. 达成率 ≥ 98.0% → medium
 * 3. 其余 → hard
 *
 * @param score - 成绩记录
 * @param chartStats - 全服统计（可选）
 * @returns 推分难度分类
 */
export function classifyDifficulty(
  score: ScoreRecord,
  chartStats?: ChartStatSummary,
): 'easy' | 'medium' | 'hard' {
  // Fallback: no chart_stats loaded
  if (!chartStats) {
    if (score.achievements >= FALLBACK_EASY_ACH) return 'easy'
    if (score.achievements >= FALLBACK_MEDIUM_ACH) return 'medium'
    return 'hard'
  }

  // 15-level special: always "hard" — extreme individual differences
  if (score.levelValue >= ALWAYS_HARD_LEVEL) return 'hard'

  // Core: diff from same-level average
  const diff = chartStats.diffFromLevelAvg
  let difficulty: 'easy' | 'medium' | 'hard'

  if (diff > EASY_DIFF_THRESHOLD) {
    difficulty = 'easy'
  } else if (diff > HARD_DIFF_THRESHOLD) {
    difficulty = 'medium'
  } else {
    difficulty = 'hard'
  }

  // SSS+ rate boost: high SSS+ rate means the chart is easier than label suggests
  if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'hard') {
    difficulty = 'medium'
  } else if (chartStats.sssPlusRate > SSSP_RATE_BOOST && difficulty === 'medium') {
    difficulty = 'easy'
  }

  return difficulty
}
