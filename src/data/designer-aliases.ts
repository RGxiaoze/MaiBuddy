// ============================================================
// 谱师名归一化
//
// 数据里的同一谱师可能出现多种写法（如「緑風 犬三郎」与「はっぴー」、
// 「“H”ack」与「Jack」）。统计偏好时不归并会被稀释，
// 导致同一人分成好几个、谁都进不了 Top 3。
//
// 只收录「纯单人」的别名；合作署名（"A vs B"、"A & B"、"Aとはっぴー"）
// 保持原样，不拆分。
// ============================================================

/** 常见引号/括号字符，比对前统一剔除（数据里混用全角与半角） */
// " ' “ ” ‘ ’ 「 」 『 』
const NOISE_RE = /[\u0022\u0027\u201C\u201D\u2018\u2019\u300C\u300D\u300E\u300F]/g

/** 生成用于查表的规范键（去引号、压缩空白） */
function canonicalKey(name: string): string {
  return name.replace(NOISE_RE, '').replace(/\s+/g, ' ').trim()
}

/**
 * 规范键 → 常用名。
 * key 必须是 `canonicalKey()` 处理后的形式（不含引号）。
 */
export const DESIGNER_ALIASES: Record<string, string> = {
  '緑風 犬三郎': 'はっぴー',
  'Safata.Hz': 'サファ太',
  'Safata.GHz': 'サファ太',
  'safaTAmago': 'サファ太',
  'maimai TEAM DX': 'maimai TEAM',
  // 数据里写作 “H”ack（全角引号），实际就是 Jack
  'Hack': 'Jack',
  'Hack underground': 'Jack',
}

/** 归一化为常用名；未收录的原样返回 */
export function normalizeDesignerName(name: string): string {
  const trimmed = (name ?? '').trim()
  return DESIGNER_ALIASES[canonicalKey(trimmed)] ?? trimmed
}

/** 展示用：有别名时显示「常用名（原名）」，否则原样 */
export function formatDesignerName(name: string): string {
  const trimmed = (name ?? '').trim()
  const primary = DESIGNER_ALIASES[canonicalKey(trimmed)]
  return primary ? `${primary}（${trimmed}）` : trimmed
}
