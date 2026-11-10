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
 * 阈值 = max(同档中位数 × 30%, 绝对下限 12000)。
 * **例外**：当整档中位数本身就低于绝对下限时（低难度老曲样本天然少），
 * 只按相对比例判定 —— 否则会把「样本量正常」的谱整档标成不可信。
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

  const relative = levelMedian * RELIABLE_RATIO
  // 整档样本都稀薄时，绝对下限会把整档误标；此时只看相对比例
  const threshold = levelMedian > 0 && levelMedian < minAbsolute
    ? relative
    : Math.max(relative, minAbsolute)

  return count >= threshold
}
