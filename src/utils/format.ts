// ============================================================
// 数值格式化工具
// ============================================================

/**
 * 保留指定小数位并**直接截断**（绝不四舍五入）。
 *
 * 用于达成率显示：成绩 100.4967 应显示 100.49，不能因进位变成 100.50，
 * 否则玩家会误以为已经达成更高档位。
 *
 * 不使用 `toFixed` —— 它是四舍五入；也不使用 `Math.floor(x * 100)` ——
 * 浮点误差会把 100.49 算成 10048.999… 而降成 100.48。这里直接按
 * `Number.toString()` 的最短精确表示切字符串，规避两类问题。
 *
 * @param value  原始数值，如 100.4967
 * @param digits 保留小数位数，默认 2
 * @returns 截断后的字符串，如 '100.49'
 */
export function truncatePercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(digits)

  const text = Math.abs(value).toString()
  // 极小值会变成科学计数法（如 1e-7），按 0 处理
  if (text.includes('e') || text.includes('E')) return (0).toFixed(digits)

  const [intPart, decPart = ''] = text.split('.')
  const padded = (decPart + '0'.repeat(digits)).slice(0, digits)
  const sign = value < 0 ? '-' : ''

  return `${sign}${intPart}.${padded}`
}

/**
 * 收益数值取整显示（如 Rating 增益）。
 *
 * 收益是"多拿几分"的量级，小数位没有决策价值，反而让卡片显得杂乱，
 * 因此统一四舍五入到整数，并去掉可能残留的 `.0`。
 *
 * @param value 原始增益，如 13.4
 * @returns 整数或整数小数字符串，如 '13'、'0'
 */
export function formatGain(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value)
  return String(rounded)
}
