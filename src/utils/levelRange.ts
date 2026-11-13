// ============================================================
// 定数筛选的区间工具（官标定数与拟合定数共用）
// ============================================================

export interface LevelValueGroup {
  label: string
  values: number[]
}

/**
 * 生成定数下拉选项：1.0 ~ max，按整数分组。
 *
 * `max` 由调用方按当前数据算出来 —— 官方定数取曲库里的最大 levelValue，
 * 拟合定数取 chart_stats 里的最大拟合值。**不写死上限**：否则新版本谱面
 * 一入池，下拉就又不够长了（原先硬编码 1..15，拟合定数超过 15 就选不到）。
 */
export function buildLevelValueGroups(max: number): LevelValueGroup[] {
  const top = Math.max(0, Math.round(max * 10) / 10)
  if (top < 1) return []

  const groups: LevelValueGroup[] = []
  for (let int = 1; int <= Math.floor(top); int++) {
    const values: number[] = []
    for (let d = 0; d <= 9; d++) {
      const v = Math.round((int + d * 0.1) * 10) / 10
      if (v > top) break
      values.push(v)
    }
    groups.push({ label: String(int), values })
  }
  return groups
}

/**
 * 定数区间是否合法：任一端为空视为合法，两端都有值时要求 `min <= max`。
 *
 * 只做判断，不做纠正 —— 用户填的值就是用户的意图，界面负责提示，不替人改。
 */
export function isLevelValueRangeValid(min?: number, max?: number): boolean {
  if (min == null || max == null) return true
  return min <= max
}
