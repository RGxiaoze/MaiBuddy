// ============================================================
// songSort — 曲目列表排序
//
// 检索页与统计页共用。成绩维度的排序需要成绩数据，
// 因此把它做成纯函数，由调用方传入 scoreStats（没有成绩时传 undefined）。
// ============================================================

import type { Song } from '@/types'
import { VERSION_ORDER } from '@/data/versions'

export type SortBy =
  | 'default'
  | 'bpm'
  | 'version'
  | 'levelValue'
  | 'title'
  /** 最高达成率 */
  | 'achievements'
  /** 最高 DX 分数率 = dxScore ÷ (总物量 × 3) */
  | 'dxScoreRate'
  /** 最近一次添加成绩的时间（数据库 createdAt） */
  | 'addedAt'

export type SortOrder = 'asc' | 'desc'

/** 单曲的成绩摘要（取该曲全部谱面里的最高值） */
export interface SongScoreStat {
  achievements: number
  dxScoreRate: number
  /** 最近一次添加这条成绩的时间（ms） */
  addedAt: number
}

export interface SortOptions {
  sortBy: SortBy
  sortOrder: SortOrder
  /** 成绩摘要；成绩维度排序必需，其他维度可省略 */
  scoreStats?: Map<number, SongScoreStat>
}

/** 该曲最高定数 */
function maxLevelValue(song: Song): number {
  let max = 0
  for (const d of [...song.difficulties.standard, ...song.difficulties.dx]) {
    if (d.levelValue > max) max = d.levelValue
  }
  return max
}

/**
 * 汇总每首曲目的成绩摘要（最高达成率 / 最高 DX 分数率）。
 * DX 分数率需要谱面总物量，从曲库补齐；取不到物量的谱面按 0 处理。
 */
export function buildScoreStats(
  songs: Song[],
  scores: Array<{ songId: number; levelIndex: number; achievements: number; dxScore: number; createdAt?: Date | string | number }>,
): Map<number, SongScoreStat> {
  const notesByChart = new Map<string, number>()
  for (const s of songs) {
    for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
      const total = d.notes?.total ?? 0
      if (total > 0) notesByChart.set(`${s.id}-${d.levelIndex}`, total)
    }
  }

  const stats = new Map<number, SongScoreStat>()
  for (const sc of scores) {
    const total = notesByChart.get(`${sc.songId}-${sc.levelIndex}`)
    const rate = total && total > 0 ? sc.dxScore / (total * 3) : 0
    const addedAt = toTimestamp(sc.createdAt)

    const prev = stats.get(sc.songId)
    if (!prev) {
      stats.set(sc.songId, { achievements: sc.achievements, dxScoreRate: rate, addedAt })
    } else {
      stats.set(sc.songId, {
        achievements: Math.max(prev.achievements, sc.achievements),
        dxScoreRate: Math.max(prev.dxScoreRate, rate),
        addedAt: Math.max(prev.addedAt, addedAt),
      })
    }
  }
  return stats
}

/** createdAt 可能是 Date / ISO 字符串 / 毫秒数；无法解析时按 0 处理 */
function toTimestamp(value?: Date | string | number): number {
  if (value == null) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * 按指定维度排序（不修改输入数组）。
 *
 * 成绩维度：未游玩的曲目始终排在最后，不受升/降序影响 ——
 * 「最低成绩」的语义不是「没打过」。
 */
export function sortSongs(songs: Song[], { sortBy, sortOrder, scoreStats }: SortOptions): Song[] {
  const mult = sortOrder === 'desc' ? -1 : 1
  const result = [...songs]

  const statOf = (song: Song): SongScoreStat | undefined => scoreStats?.get(song.id)

  result.sort((a, b) => {
    switch (sortBy) {
      case 'bpm':
        return (a.bpm - b.bpm) * mult
      case 'version': {
        const va = VERSION_ORDER.get(a.from) ?? 0
        const vb = VERSION_ORDER.get(b.from) ?? 0
        return (va - vb) * mult
      }
      case 'title':
        // 曲名以日文假名 / 汉字 / 英文混合为主，按日文排序规则比较
        return a.title.localeCompare(b.title, 'ja') * mult
      case 'achievements':
      case 'dxScoreRate':
      case 'addedAt': {
        const sa = statOf(a)
        const sb = statOf(b)
        // 都没成绩时按最高定数兜底，避免默认排序下列表看起来乱序
        if (!sa && !sb) return maxLevelValue(b) - maxLevelValue(a)
        if (!sa) return 1
        if (!sb) return -1
        return (sa[sortBy] - sb[sortBy]) * mult
      }
      case 'default':
      case 'levelValue':
        return (maxLevelValue(a) - maxLevelValue(b)) * mult
      default:
        return 0
    }
  })

  return result
}
