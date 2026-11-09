// ============================================================
// API format adapters — normalize Diving-Fish & LXNS → internal types
// ============================================================

import type { ChartDifficulty, DfChartInfo, DfMusic, LevelIndex, Notes, Score, Song } from '@/types'
import { VERSION_ORDER } from '@/data/versions'

// ---- Re-export DfScore for divingFishApi consumers ----

/** Normalized Diving-Fish score entry (from B50 query) */
export interface DfScore {
  songId: number
  title: string
  levelIndex: number
  level: string
  levelValue: number
  songType: 'standard' | 'dx'
  achievements: number
  dxRating: number
  dxScore: number
  rate: string
  fcType: string | null
  fsType: string | null
  /** 最近游玩日期（YYYY-MM-DD）；仅落雪提供，水鱼与在线查分没有 */
  playDate?: string
}

// ---- Internal helpers ----

/** Convert raw notes array to structured Notes object */
function notesArrayToObj(arr: number[]): Notes {
  if (arr.length < 4) {
    return { total: 0, tap: 0, hold: 0, slide: 0, touch: 0, break: 0 }
  }
  // SD (4): [TAP, HOLD, SLIDE, BREAK]  or  DX (5): [TAP, HOLD, SLIDE, TOUCH, BREAK]
  const tap = arr[0], hold = arr[1], slide = arr[2], brk = arr[3]
  const touch = arr.length >= 5 ? arr[4] : 0
  return { total: tap + hold + slide + brk + touch, tap, hold, slide, touch, break: brk }
}

// ---- Public converters ----

/**
 * 谱师名归一化。
 * Diving-Fish / LXNS 对无谱师的难度（主要是 BASIC、ADVANCED，
 * 游戏本身不标注）返回 `"-"`，直接透传会让「搜 - 命中 2762 个谱面」
 * 这类问题，也让详情页显示成一个孤零零的横杠。
 */
export function normalizeDesigner(charter?: string | null): string {
  const name = (charter ?? '').trim()
  if (!name || name === '-' || name === '未知') return '未知'
  return name
}

/** Convert Diving-Fish Music → internal Song */
export function toInternalSong(m: DfMusic, imageUrl: string): Song {
  const songType = m.type === 'SD' ? 'standard' as const : 'dx' as const

  const difficulties: ChartDifficulty[] = m.charts.map((chart, i) => ({
    type: songType,
    levelIndex: i as LevelIndex,
    level: m.level[i] ?? '?',
    levelValue: m.ds[i] ?? 0,
    noteDesigner: normalizeDesigner(chart.charter),
    notes: chart.notes.length > 0 ? notesArrayToObj(chart.notes) : null,
  }))

  return {
    id: parseInt(m.id, 10),
    title: m.title,
    artist: m.basic_info.artist,
    genre: m.basic_info.genre,
    bpm: m.basic_info.bpm,
    version: VERSION_ORDER.get(m.basic_info.from) ?? 0,
    from: m.basic_info.from,
    isNew: m.basic_info.is_new,
    imageUrl,
    difficulties: {
      standard: songType === 'standard' ? difficulties : [],
      dx: songType === 'dx' ? difficulties : [],
    },
  }
}

/** Convert Diving-Fish ChartInfo → normalized DfScore */
export function toInternalDfScore(c: DfChartInfo): DfScore {
  return {
    songId: c.song_id,
    title: c.title,
    levelIndex: c.level_index as LevelIndex,
    level: c.level,
    levelValue: c.ds,
    songType: c.type === 'SD' ? 'standard' : 'dx',
    achievements: c.achievements,
    dxRating: c.ra,
    dxScore: c.dxScore,
    rate: c.rate,
    fcType: c.fc || null,
    fsType: c.fs || null,
  }
}

/** Convert DfScore → internal Score (for IndexedDB import).
 *  Maps title→songTitle, preserves pre-computed dxRating,
 *  falls back to current date for playDate (API doesn't expose timestamps). */
export function toInternalScore(df: DfScore): Score {
  return {
    songId: df.songId,
    songTitle: df.title,
    levelIndex: df.levelIndex as LevelIndex,
    level: df.level,
    levelValue: df.levelValue,
    songType: df.songType,
    achievements: df.achievements,
    rate: df.rate as Score['rate'],
    fcType: (df.fcType as Score['fcType']) || null,
    fsType: (df.fsType as Score['fsType']) || null,
    dxScore: df.dxScore,
    dxRating: df.dxRating,
    playDate: df.playDate ?? new Date().toISOString().slice(0, 10),
  }
}
