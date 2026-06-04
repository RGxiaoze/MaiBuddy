import type { LevelIndex, RateType, SongType } from '@/types'

// ---- Difficulty level mappings ----

export const LEVEL_INDEX_MAP: Record<LevelIndex, { label: string; color: string }> = {
  0: { label: 'BASIC',   color: '#22C55E' },
  1: { label: 'ADVANCED', color: '#EAB308' },
  2: { label: 'EXPERT',   color: '#EF4444' },
  3: { label: 'MASTER',   color: '#A855F7' },
  4: { label: 'Re:MASTER', color: '#EC4899' },
}

export const LEVEL_LABELS: Record<LevelIndex, string> = {
  0: 'Basic', 1: 'Advanced', 2: 'Expert', 3: 'Master', 4: 'Re:Master',
}

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
  sssp: '#FFD700', sss: '#C0C0C0', ssp: '#CD7F32', ss: '#CD7F32',
  sp: '#22C55E',   s: '#22C55E',
  aaa: '#3B82F6',  aa: '#3B82F6',  a: '#3B82F6',
  bbb: '#D97706',  bb: '#6B7280',  b: '#6B7280',
  c: '#6B7280',    d: '#6B7280',
}

// ---- FC/FS labels ----

export const FC_LABELS: Record<string, string> = {
  app: 'AP+', ap: 'AP', fcp: 'FC+', fc: 'FC',
}

export const FS_LABELS: Record<string, string> = {
  fsdp: 'FDX+', fsd: 'FDX', fsp: 'FS+', fs: 'FS',
}

// ---- Cover image URL ----

export function getCoverUrl(songId: number | string): string {
  const id = typeof songId === 'string' ? parseInt(songId, 10) : songId
  // Special range: 10001–11000 subtract 10000
  const rawId = id >= 10001 && id <= 11000 ? id - 10000 : id
  return `https://www.diving-fish.com/covers/${String(rawId).padStart(5, '0')}.png`
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
