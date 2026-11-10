import type { LevelIndex, RateType, SongType } from '@/types'

// ---- Difficulty level mappings ----

export interface LevelColor {
  label: string
  /** 主标识色：用于曲绘占位、星标、图表等强调处 */
  color: string
  /** 徽章底色 */
  badgeBg: string
  /** 徽章字色 */
  badgeFg: string
}

// Re:MASTER 采用游戏内一致的浅底紫字（白底在带阴影的卡片上仍可分辨）
export const LEVEL_INDEX_MAP: Record<LevelIndex, LevelColor> = {
  0: { label: 'BASIC',     color: '#22C55E', badgeBg: '#22C55E', badgeFg: '#FFFFFF' },
  1: { label: 'ADVANCED',  color: '#EAB308', badgeBg: '#EAB308', badgeFg: '#FFFFFF' },
  2: { label: 'EXPERT',    color: '#EF4444', badgeBg: '#EF4444', badgeFg: '#FFFFFF' },
  3: { label: 'MASTER',    color: '#A855F7', badgeBg: '#A855F7', badgeFg: '#FFFFFF' },
  4: { label: 'Re:MASTER', color: '#7C3AED', badgeBg: '#F5F3FF', badgeFg: '#7C3AED' },
}

export const LEVEL_LABELS: Record<LevelIndex, string> = {
  0: 'Basic', 1: 'Advanced', 2: 'Expert', 3: 'Master', 4: 'Re:Master',
}

/**
 * 难度/等级徽章的统一宽度。
 *
 * 等级有 "7" / "10+" / "14" / "15+" 等形态，宽度不一致时同一行里参差不齐。
 * 用固定宽度（而非 min-width）+ 居中 + 等宽数字，保证一位/两位、带不带 "+" 都一样宽。
 * 32px 足够容纳 11px 字号下的 "15+"。
 */
export const LEVEL_BADGE_CLASS = 'inline-flex items-center justify-center w-8 tabular-nums'

// ---- Song type labels ----

export const SONG_TYPE_LABELS: Record<SongType, string> = {
  standard: '标准',
  dx: 'DX',
}

// ---- Grade / Rate mappings ----

export const RATE_DISPLAY: Record<RateType, string> = {
  sssp: 'SSS+', sss: 'SSS', ssp: 'SS+', ss: 'SS',
  sp: 'S+',    s: 'S',
  aaa: 'AAA',  aa: 'AA',  a: 'A',
  bbb: 'BBB',  bb: 'BB',  b: 'B',
  c: 'C',      d: 'D',
}

export const RATE_COLORS: Record<RateType, string> = {
  sssp: '#FFD700', sss: '#C0C0C0', ssp: '#FFD700', ss: '#FFD700',
  sp: '#FFD700',   s: '#FFD700',
  aaa: '#EF4444',  aa: '#EF4444',  a: '#EF4444',
  bbb: '#3B82F6',  bb: '#3B82F6',  b: '#3B82F6',
  c: '#3B82F6',    d: '#3B82F6',
}

// ---- FC/FS labels ----

export const FC_LABELS: Record<string, string> = {
  app: 'AP+', ap: 'AP', fcp: 'FC+', fc: 'FC',
}

export const FS_LABELS: Record<string, string> = {
  fsdp: 'FDX+', fsd: 'FDX', fsp: 'FS+', fs: 'FS', sync: 'SYNC',
}

// ---- Cover image URL ----

export function getCoverUrl(songId: number | string): string {
  const id = typeof songId === 'string' ? parseInt(songId, 10) : songId
  // 落雪按「基础 ID」存曲绘。本项目曲库来自水鱼，DX 谱面是独立条目
  // （ID = 基础 + 10000），需取余回基础 ID；100000 以上是宴会场，不参与换算。
  const baseId = id >= 10000 && id < 100000 ? id % 10000 : id
  return `https://assets2.lxns.net/maimai/jacket/${baseId}.png`
}

// ---- Coefficient table for Rating calculation (24 thresholds) ----
// Reference: ScoreCoefficient.js from maimaidx-prober
// Algorithm: find first row where achievement >= min → use that coeff
// Formula: floor(coeff × levelValue × min(achievement, 100.5) / 100)

export const COEFFICIENT_TABLE: Array<{ min: number; coeff: number; rate: string }> = [
  { min: 100.5,    coeff: 22.4, rate: 'sssp' },
  { min: 100.4999, coeff: 22.2, rate: 'sss' },
  { min: 100.0,    coeff: 21.6, rate: 'sss' },
  { min: 99.9999,  coeff: 21.4, rate: 'ssp' },
  { min: 99.5,     coeff: 21.1, rate: 'ssp' },
  { min: 99.0,     coeff: 20.8, rate: 'ss' },
  { min: 98.9999,  coeff: 20.6, rate: 'sp' },
  { min: 98.0,     coeff: 20.3, rate: 'sp' },
  { min: 97.0,     coeff: 20.0, rate: 's' },
  { min: 96.9999,  coeff: 17.6, rate: 's' },
  { min: 94.0,     coeff: 16.8, rate: 'aaa' },
  { min: 90.0,     coeff: 15.2, rate: 'aa' },
  { min: 80.0,     coeff: 13.6, rate: 'a' },
  { min: 79.9999,  coeff: 12.8, rate: 'bbb' },
  { min: 75.0,     coeff: 12.0, rate: 'bbb' },
  { min: 70.0,     coeff: 11.2, rate: 'bb' },
  { min: 60.0,     coeff: 9.6,  rate: 'b' },
  { min: 50.0,     coeff: 8.0,  rate: 'c' },
  { min: 40.0,     coeff: 6.4,  rate: 'd' },
  { min: 30.0,     coeff: 4.8,  rate: 'd' },
  { min: 20.0,     coeff: 3.2,  rate: 'd' },
  { min: 10.0,     coeff: 1.6,  rate: 'd' },
  { min: 0.0,      coeff: 0.0,  rate: 'd' },
]

// ---- Achievement → RateType mapping ----

export function achievementsToRate(achievements: number): RateType {
  if (achievements >= 100.5) return 'sssp'
  if (achievements >= 100.0) return 'sss'
  if (achievements >= 99.5)  return 'ssp'
  if (achievements >= 99.0)  return 'ss'
  if (achievements >= 98.0)  return 'sp'
  if (achievements >= 97.0)  return 's'
  if (achievements >= 94.0)  return 'aaa'
  if (achievements >= 90.0)  return 'aa'
  if (achievements >= 80.0)  return 'a'
  if (achievements >= 75.0)  return 'bbb'
  if (achievements >= 70.0)  return 'bb'
  if (achievements >= 60.0)  return 'b'
  if (achievements >= 50.0)  return 'c'
  return 'd'
}
