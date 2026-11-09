// ============================================================
// stats — 成绩统计页分组统计（我的记录式统计面板）
// 按 难度 / 歌曲等级 / 达成等级 / 曲包 四个维度筛选曲库与成绩，
// 输出曲目总数、已游玩、评级分布、平均达成率、AP 数、最高定数。
// 口径：曲目总数/已游玩按曲目（songId 去重），评级/达成率/AP 按全部成绩。
// ============================================================

import type { LevelIndex, Song } from '@/types'
import type { ScoreRecord } from '@/db/database'
import { LEVEL_INDEX_MAP } from '@/data/constants'
import { UTAGE_ID_THRESHOLD } from '@/config/algorithms'

export type StatsDimension = 'difficulty' | 'level' | 'rate' | 'genre'

/** 统计面板筛选条件 */
export interface StatsFilter {
  dimension: StatsDimension
  /** 'all' 或维度具体值（如 'MASTER' / '14+' / 'sssp' / '流行&动漫'） */
  value: string
  /** 难度二级筛选（仅 rate / genre 维度生效），'all' 表示全部难度 */
  difficulty: 'all' | LevelIndex
}

export interface RateDistEntry {
  key: 'sssp' | 'sss' | 'ss' | 's'
  label: string
  count: number
}

/** 分组统计结果 */
export interface GroupedStats {
  /** 符合筛选的曲目总数（songId 去重） */
  totalSongs: number
  /** 已游玩曲目数（有 ≥1 条符合条件成绩） */
  playedSongs: number
  /** 游玩率 0–100（1 位小数） */
  playRate: number
  /** SSS+/SSS/SS/S 评级分布（按全部成绩计数） */
  rateDist: RateDistEntry[]
  /** 平均达成率（2 位小数） */
  avgAchievement: number
  /** AP / AP+ 成绩数 */
  apCount: number
  /** AP+（app）成绩数 */
  apPlusCount: number
  /** 最高定数 */
  maxLevelValue: number
  /** 最高定数对应曲名 */
  maxLevelTitle: string
}

// ---- 标签常量 ----

export const ALL_TAB = { value: 'all', label: '全部' }

export const DIFFICULTY_TABS: { value: string; label: string }[] = [
  ALL_TAB,
  ...[0, 1, 2, 3, 4].map(i => ({ value: String(i), label: LEVEL_INDEX_MAP[i as LevelIndex].label })),
]

/** 达成等级 — 评级组 */
export const RATE_TABS: { value: string; label: string }[] = [
  ALL_TAB,
  { value: 'sssp', label: 'SSS+' },
  { value: 'sss', label: 'SSS' },
  { value: 'ss', label: 'SS' },
  { value: 's', label: 'S' },
  { value: 'below_s', label: 'S以下' },
]

/** 达成等级 — FC 组 */
export const FC_TABS: { value: string; label: string }[] = [
  { value: 'app', label: 'AP+' },
  { value: 'ap', label: 'AP' },
  { value: 'fcp', label: 'FC+' },
  { value: 'fc', label: 'FC' },
]

/** 达成等级 — FS 组 */
export const FS_TABS: { value: string; label: string }[] = [
  { value: 'fsdp', label: 'FDX+' },
  { value: 'fsd', label: 'FDX' },
  { value: 'fsp', label: 'FS+' },
  { value: 'fs', label: 'FS' },
]

// ---- 标签生成器 ----

/** 动态提取曲库中的歌曲等级标签，按定数升序 */
export function getLevelTabs(songs: Song[]): { value: string; label: string }[] {
  const order = new Map<string, number>()
  for (const song of songs) {
    for (const d of [...song.difficulties.standard, ...song.difficulties.dx]) {
      if (d.levelValue <= 0) continue
      const cur = order.get(d.level)
      if (cur == null || d.levelValue < cur) order.set(d.level, d.levelValue)
    }
  }
  const levels = [...order.entries()].sort((a, b) => a[1] - b[1]).map(([level]) => level)
  return [ALL_TAB, ...levels.map(level => ({ value: level, label: level }))]
}

/** 动态提取曲库中的曲包（genre）标签，去重并按中文排序 */
export function getGenreTabs(songs: Song[]): { value: string; label: string }[] {
  const genres = [...new Set(songs.map(s => s.genre).filter(Boolean))]
  genres.sort((a, b) => a.localeCompare(b, 'zh'))
  return [ALL_TAB, ...genres.map(g => ({ value: g, label: g }))]
}

// ---- 统计实现 ----

function chartKey(songId: number, levelIndex: number, songType: string): string {
  return `${songId}-${levelIndex}-${songType}`
}

/** 收集符合筛选的谱面集合（含 SD/DX 双版本）与曲目集合 */
function collectCharts(songs: Song[], filter: StatsFilter): { charts: Set<string>; songIds: Set<number> } {
  const charts = new Set<string>()
  const songIds = new Set<number>()
  for (const song of songs) {
    // 宴会场（ID ≥ 100000）没有定数与难度数据，不参与统计口径
    if (song.id >= UTAGE_ID_THRESHOLD) continue
    const diffs = [
      ...song.difficulties.standard.map(d => ({ ...d, type: 'standard' as const })),
      ...song.difficulties.dx.map(d => ({ ...d, type: 'dx' as const })),
    ]
    let matched = false
    for (const d of diffs) {
      if (filter.dimension === 'difficulty' && filter.value !== 'all' && String(d.levelIndex) !== filter.value) continue
      if (filter.dimension === 'level' && filter.value !== 'all' && d.level !== filter.value) continue
      if (filter.dimension === 'genre' && filter.value !== 'all' && song.genre !== filter.value) continue
      if (filter.difficulty !== 'all' && d.levelIndex !== filter.difficulty) continue
      charts.add(chartKey(song.id, d.levelIndex, d.type))
      matched = true
    }
    if (matched) songIds.add(song.id)
  }
  return { charts, songIds }
}

/**
 * rate / fc / fs 值匹配（达成等级维度）。
 * 支持聚合值：'ss'（ssp+ss）、's'（sp+s）、'below_s'（aaa 及以下）。
 */
export function matchRateValue(s: ScoreRecord, value: string): boolean {
  switch (value) {
    case 'all':
      return true
    case 'sssp':
      return s.rate === 'sssp'
    case 'sss':
      return s.rate === 'sss'
    case 'ss':
      return s.rate === 'ssp' || s.rate === 'ss'
    case 's':
      return s.rate === 'sp' || s.rate === 's'
    case 'below_s':
      return !['sssp', 'sss', 'ssp', 'ss', 'sp', 's'].includes(s.rate)
    case 'app':
    case 'ap':
    case 'fcp':
    case 'fc':
      return s.fcType === value
    case 'fsdp':
    case 'fsd':
    case 'fsp':
    case 'fs':
      return s.fsType === value
    default:
      return false
  }
}

/** 评级 → 分布条分组（仅 S 及以上） */
function groupRate(rate: string): RateDistEntry['key'] | null {
  if (rate === 'sssp') return 'sssp'
  if (rate === 'sss') return 'sss'
  if (rate === 'ssp' || rate === 'ss') return 'ss'
  if (rate === 'sp' || rate === 's') return 's'
  return null
}

const RATE_DIST_DEFS: { key: RateDistEntry['key']; label: string }[] = [
  { key: 'sssp', label: 'SSS+' },
  { key: 'sss', label: 'SSS' },
  { key: 'ss', label: 'SS' },
  { key: 's', label: 'S' },
]

/**
 * 按筛选条件计算分组统计。
 * @param scores — 全部本地成绩
 * @param songs — 曲库
 * @param filter — 筛选条件
 */
export function computeStats(scores: ScoreRecord[], songs: Song[], filter: StatsFilter): GroupedStats {
  const { charts, songIds } = collectCharts(songs, filter)

  const scorable = scores.filter(s =>
    charts.has(chartKey(s.songId, s.levelIndex, s.songType)) &&
    (filter.dimension !== 'rate' || matchRateValue(s, filter.value)),
  )

  // 曲目总数 / 已游玩
  const playedSongIds = new Set(scorable.map(s => s.songId))
  const totalSongs = songIds.size
  const playedSongs = playedSongIds.size

  // 平均达成率
  const avgAchievement = scorable.length > 0
    ? Math.round(scorable.reduce((sum, s) => sum + s.achievements, 0) / scorable.length * 100) / 100
    : 0

  // AP 数
  const apCount = scorable.filter(s => s.fcType === 'ap' || s.fcType === 'app').length
  const apPlusCount = scorable.filter(s => s.fcType === 'app').length

  // 最高定数
  let maxLevelValue = 0
  let maxLevelTitle = ''
  for (const s of scorable) {
    if (s.levelValue > maxLevelValue) {
      maxLevelValue = s.levelValue
      maxLevelTitle = s.songTitle
    }
  }

  // 评级分布
  const rateDist: RateDistEntry[] = RATE_DIST_DEFS.map(def => ({
    ...def,
    count: scorable.filter(s => groupRate(s.rate) === def.key).length,
  }))

  return {
    totalSongs,
    playedSongs,
    playRate: totalSongs > 0 ? Math.round(playedSongs / totalSongs * 1000) / 10 : 0,
    rateDist,
    avgAchievement,
    apCount,
    apPlusCount,
    maxLevelValue,
    maxLevelTitle,
  }
}
