// ============================================================
// 落雪曲库：实装日期补齐
//
// 水鱼 `music_data` 虽然带 release_date 字段，但**全库都是空字符串**，
// 无法用于「实装日期」排序。落雪的公共曲库接口提供真实日期，
// 无需鉴权、支持跨域，因此在这里补一层。
// ============================================================

import type { Song } from '@/types'

const API_BASE = 'https://maimai.lxns.net/api/v0'
const TIMEOUT_MS = 15_000

interface LxnsDifficultyLite {
  release_date?: string
}

interface LxnsSongLite {
  id: number
  release_date?: string
  difficulties?: {
    standard?: LxnsDifficultyLite[]
    dx?: LxnsDifficultyLite[]
  }
}

/** 取一首歌的实装日期：优先歌曲级，缺失时取各谱面里最早的一天 */
function pickReleaseDate(song: LxnsSongLite): string | null {
  const candidates: string[] = []
  if (song.release_date) candidates.push(song.release_date)
  for (const d of [...(song.difficulties?.standard ?? []), ...(song.difficulties?.dx ?? [])]) {
    if (d.release_date) candidates.push(d.release_date)
  }
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (a < b ? a : b))
}

/**
 * 拉取落雪曲库的实装日期。
 * 失败时抛错，由调用方决定是否降级（排序仍可用，只是没有日期）。
 */
export async function fetchLxnsReleaseDates(): Promise<Map<number, string>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/maimai/song/list?notes=false`, { signal: controller.signal })
    if (!res.ok) throw new Error(`曲库接口返回 HTTP ${res.status}`)
    const body = await res.json() as { songs?: LxnsSongLite[] }

    const dates = new Map<number, string>()
    for (const song of body.songs ?? []) {
      if (typeof song?.id !== 'number') continue
      const date = pickReleaseDate(song)
      if (date) dates.set(song.id, date)
    }
    return dates
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 把实装日期合并进本地曲库（不修改入参）。
 *
 * 落雪用「基础 ID」，而本曲库中 DX 谱面是独立条目（ID = 基础 + 10000），
 * 因此同一首歌的两个条目都要补上。已有日期的不覆盖。
 */
export function withLxnsReleaseDates(songs: Song[], dates: Map<number, string>): Song[] {
  if (dates.size === 0) return songs
  const baseIdOf = (id: number) => (id >= 10000 && id < 100000 ? id - 10000 : id)

  return songs.map((song) => {
    if (song.releaseDate) return song
    const date = dates.get(baseIdOf(song.id))
    return date ? { ...song, releaseDate: date } : song
  })
}
