// ============================================================
// 样本可信度
//
// 隐藏区域 / 联动区域的曲目只有解锁的玩家会打，样本天然偏斜：
// 能打到的人往往已有相当熟练度 → 全服达成率偏高 → 拟合定数系统性偏低。
// 因此不能无条件相信 fit_diff，先用样本量筛一道。
// ============================================================

/** 绝对样本下限：低于此值一律视为不可信 */
export const MIN_ABSOLUTE_SAMPLE = 12000

/** 相对同档中位数的比例下限（低于它即不可信） */
export const RELIABLE_RATIO = 0.3

/**
 * 样本量是否可信。
 *
 * @param count       该谱的样本量
 * @param levelMedian 同官标档位（如 "13+"）所有谱样本量的中位数
 */
export function isReliableCount(
  count: number,
  levelMedian: number,
  minAbsolute = MIN_ABSOLUTE_SAMPLE,
): boolean {
  if (!Number.isFinite(count) || count <= 0) return false
  const threshold = Math.max(levelMedian * RELIABLE_RATIO, minAbsolute)
  return count >= threshold
}
