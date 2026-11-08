// ============================================================
// 谱师名归一化
//
// 数据里的同一谱师可能出现多种写法（如「緑風 犬三郎」与「はっぴー」）。
// 统计偏好时不归并会被稀释，导致同一人分成好几个、谁都进不了 Top 3。
//
// 只收录「纯单人」的别名；合作署名（"A vs B"、"A & B"、"Aとはっぴー"）
// 保持原样，不做拆分。
// ============================================================

/** 原始写法 → 常用名 */
export const DESIGNER_ALIASES: Record<string, string> = {
  '緑風 犬三郎': 'はっぴー',
  'Safata.Hz': 'サファ太',
  'Safata.GHz': 'サファ太',
  'safaTAmago': 'サファ太',
  'maimai TEAM DX': 'maimai TEAM',
}

/** 归一化为常用名；未收录的原样返回 */
export function normalizeDesignerName(name: string): string {
  const trimmed = (name ?? '').trim()
  return DESIGNER_ALIASES[trimmed] ?? trimmed
}

/** 展示用：有别名时显示「常用名（原名）」，否则原样 */
export function formatDesignerName(name: string): string {
  const trimmed = (name ?? '').trim()
  const primary = DESIGNER_ALIASES[trimmed]
  return primary ? `${primary}（${trimmed}）` : trimmed
}
