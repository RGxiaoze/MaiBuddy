// ============================================================
// IndexedDB database — Dexie.js
// ============================================================

import Dexie, { type EntityTable } from 'dexie'
import type { Score, Song } from '@/types'

/** Score record stored in IndexedDB (differs from Score type: auto-id + date) */
export interface ScoreRecord {
  id?: number             // auto-incremented PK
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  songType: string
  achievements: number
  rate: string
  fcType: string | null
  fsType: string | null
  dxScore: number
  dxRating: number
  dxScoreDetail: {
    maxDx: number
    achievedDx: number
    missedDx: number
  } | null
  playDate: string        // ISO date
  createdAt: Date
}

/** Cached song data entry */
export interface CachedSongs {
  id?: number             // always 1 (singleton)
  data: Song[]            // serialized song array
  updatedAt: number       // timestamp (ms)
}

/** Cached alias index entry */
export interface CachedAliases {
  id?: number             // always 1 (singleton)
  data: Array<[string, number[]]>  // Map serialized as entries array (reverse: alias → songIds)
  forwardData?: Array<[number, string[]]>  // forward: songId → community alias strings
  updatedAt: number       // timestamp (ms)
}

/** Cached chart stats entry */
export interface CachedStats {
  id?: number             // always 1 (singleton)
  data: import('@/services/divingFishApi').ChartStatsResponse
  updatedAt: number       // timestamp (ms)
}

/** 投票箱（二选一）累计结果条目 — Diving-Fish vote_result */
export interface CachedVoteEntry {
  music_id: string
  total_vote: number
  down_vote: number
}

/** 投票箱偏好数据缓存（singleton） */
export interface CachedVote {
  id?: number             // always 1 (singleton)
  data: CachedVoteEntry[]
  updatedAt: number       // timestamp (ms)
}

/** 探索页「不感兴趣」屏蔽的歌曲 */
export interface BlockedSong {
  songId: number
  blockedAt: number
}

/** Settings entry (key-value store) */
export interface SettingsEntry {
  key: string             // PK
  value: unknown          // any JSON-serializable value
}

/** Database singleton */
class MaimaiDB extends Dexie {
  scores!: EntityTable<ScoreRecord, 'id'>
  songCache!: EntityTable<CachedSongs, 'id'>
  aliasCache!: EntityTable<CachedAliases, 'id'>
  statsCache!: EntityTable<CachedStats, 'id'>
  voteCache!: EntityTable<CachedVote, 'id'>
  exploreBlocked!: EntityTable<BlockedSong, 'songId'>
  settings!: EntityTable<SettingsEntry, 'key'>

  constructor() {
    super('MaimaiDB')

    this.version(1).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
    })

    // v2: add song cache table
    this.version(2).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
    })

    // v3: add alias cache table
    this.version(3).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
      aliasCache: 'id',
    })

    // v4: add chart stats cache table
    this.version(4).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
      aliasCache: 'id',
      statsCache: 'id',
    })

    // v5: add settings table
    this.version(5).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
      aliasCache: 'id',
      statsCache: 'id',
      settings: '&key',
    })

    // v6: add vote cache table (投票箱偏好数据)
    this.version(6).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
      aliasCache: 'id',
      statsCache: 'id',
      settings: '&key',
      voteCache: 'id',
    })

    // v7: add explore blocklist (探索页「不感兴趣」)
    this.version(7).stores({
      scores: '++id, songId, [songId+levelIndex], playDate',
      songCache: 'id',
      aliasCache: 'id',
      statsCache: 'id',
      settings: '&key',
      voteCache: 'id',
      exploreBlocked: 'songId',
    })
  }
}

export const db = new MaimaiDB()

// ---- Song cache helpers ----

const SONG_CACHE_KEY = 1
export const SONG_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Get cached songs if still fresh */
export async function getCachedSongs(): Promise<Song[] | null> {
  try {
    const entry = await db.songCache.get(SONG_CACHE_KEY)
    if (entry && Date.now() - entry.updatedAt < SONG_CACHE_TTL_MS) {
      return entry.data
    }
  } catch {
    // Table might not exist yet (v1 → v2 migration)
  }
  return null
}

/** Cache songs in IndexedDB */
export async function setCachedSongs(songs: Song[]): Promise<void> {
  try {
    await db.songCache.put({ id: SONG_CACHE_KEY, data: songs, updatedAt: Date.now() })
  } catch {
    // Silently fail — cache is optional
  }
}

// ---- Score CRUD helpers ----

export async function addScore(score: Omit<ScoreRecord, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.scores.add({ ...score, createdAt: new Date() })
  return id as number
}

export async function updateScore(id: number, updates: Partial<ScoreRecord>): Promise<number> {
  return db.scores.update(id, updates)
}

export async function deleteScore(id: number): Promise<void> {
  return db.scores.delete(id)
}

/** Get all scores for a specific song+levelIndex */
export async function getScoresBySong(songId: number, levelIndex: number): Promise<ScoreRecord[]> {
  return db.scores
    .where('[songId+levelIndex]')
    .equals([songId, levelIndex])
    .sortBy('playDate')
}

/** Get all scores for a song (all difficulties) */
export async function getScoresBySongId(songId: number): Promise<ScoreRecord[]> {
  return db.scores
    .where('songId')
    .equals(songId)
    .sortBy('playDate')
}

/** Get all stored scores */
export async function getAllScores(): Promise<ScoreRecord[]> {
  return db.scores.orderBy('playDate').reverse().toArray()
}

/** Clear all scores from IndexedDB */
export async function clearAllScores(): Promise<void> {
  return db.scores.clear()
}

/**
 * Bulk-upsert scores from Diving-Fish import.
 * For each incoming score, checks [songId+levelIndex] against existing records:
 *   - No existing → INSERT
 *   - Higher achievements → UPDATE in place
 *   - Lower/equal achievements → SKIP (preserve local better score)
 * Runs in a single transaction for atomicity.
 */
export async function bulkUpsertScores(
  scores: Omit<ScoreRecord, 'id' | 'createdAt'>[],
  onProgress?: (current: number, total: number) => void,
): Promise<{ total: number; imported: number; updated: number; skipped: number }> {
  const allExisting = await db.scores.toArray()
  const existingMap = new Map<string, ScoreRecord>()
  for (const s of allExisting) {
    const key = `${s.songId}-${s.levelIndex}`
    const prev = existingMap.get(key)
    if (!prev || s.achievements > prev.achievements) {
      existingMap.set(key, s)
    }
  }

  let imported = 0
  let updated = 0
  let skipped = 0

  const total = scores.length
  await db.transaction('rw', db.scores, async () => {
    for (let i = 0; i < scores.length; i++) {
      const score = scores[i]
      const key = `${score.songId}-${score.levelIndex}`
      const existing = existingMap.get(key)

      if (!existing) {
        await db.scores.add({ ...score, createdAt: new Date() })
        imported++
      } else if (score.achievements > existing.achievements) {
        await db.scores.update(existing.id!, { ...score, createdAt: new Date() })
        updated++
      } else {
        skipped++
      }

      // Report progress every 50 items
      if (onProgress && i % 50 === 0) {
        onProgress(i + 1, total)
      }
    }
  })

  // Final progress report
  if (onProgress) onProgress(total, total)

  return { total: scores.length, imported, updated, skipped }
}

// ---- Alias cache helpers ----

const ALIAS_CACHE_KEY = 1
const ALIAS_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Get cached alias index if still fresh */
export async function getCachedAliases(): Promise<Map<string, number[]> | null> {
  try {
    const entry = await db.aliasCache.get(ALIAS_CACHE_KEY)
    if (entry && Date.now() - entry.updatedAt < ALIAS_CACHE_TTL_MS) {
      return new Map(entry.data)
    }
  } catch {
    // Table might not exist yet (v2 → v3 migration)
  }
  return null
}

/** Cache alias index in IndexedDB (reverse + forward maps) */
export async function setCachedAliases(
  index: Map<string, number[]>,
  forward?: Map<number, string[]>,
): Promise<void> {
  try {
    await db.aliasCache.put({
      id: ALIAS_CACHE_KEY,
      data: Array.from(index.entries()),
      forwardData: forward ? Array.from(forward.entries()) : undefined,
      updatedAt: Date.now(),
    })
  } catch {
    // Silently fail — cache is optional
  }
}

/** Get cached forward alias map (songId → community aliases) if fresh */
export async function getCachedAliasForward(): Promise<Map<number, string[]> | null> {
  try {
    const entry = await db.aliasCache.get(ALIAS_CACHE_KEY)
    if (entry && entry.forwardData && Date.now() - entry.updatedAt < ALIAS_CACHE_TTL_MS) {
      return new Map(entry.forwardData)
    }
  } catch {
    // Table might not exist yet
  }
  return null
}

// ---- Stats cache helpers ----

const STATS_CACHE_KEY = 1
const STATS_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Get cached chart stats if still fresh */
export async function getCachedStats(): Promise<import('@/services/divingFishApi').ChartStatsResponse | null> {
  try {
    const entry = await db.statsCache.get(STATS_CACHE_KEY)
    if (entry && Date.now() - entry.updatedAt < STATS_CACHE_TTL_MS) {
      return entry.data
    }
  } catch {
    // Table might not exist yet (v3 → v4 migration)
  }
  return null
}

/** Cache chart stats in IndexedDB */
export async function setCachedStats(
  data: import('@/services/divingFishApi').ChartStatsResponse,
): Promise<void> {
  try {
    await db.statsCache.put({ id: STATS_CACHE_KEY, data, updatedAt: Date.now() })
  } catch {
    // Silently fail — cache is optional
  }
}

// ---- Vote cache helpers ----

const VOTE_CACHE_KEY = 1
/** 投票箱结果每天最多拉一次：接口未文档化，尽量低频 */
const VOTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Get cached vote_result if still fresh */
export async function getCachedVotes(): Promise<CachedVoteEntry[] | null> {
  try {
    const entry = await db.voteCache.get(VOTE_CACHE_KEY)
    if (entry && Date.now() - entry.updatedAt < VOTE_CACHE_TTL_MS) {
      return entry.data
    }
  } catch {
    // Table might not exist yet (v5 → v6 migration)
  }
  return null
}

/** Cache vote_result in IndexedDB */
export async function setCachedVotes(data: CachedVoteEntry[]): Promise<void> {
  try {
    await db.voteCache.put({ id: VOTE_CACHE_KEY, data, updatedAt: Date.now() })
  } catch {
    // Silently fail — cache is optional
  }
}

// ---- Explore blocklist helpers ----

/** 读取探索页已屏蔽的歌曲 id 集合 */
export async function getBlockedSongIds(): Promise<Set<number>> {
  try {
    const rows = await db.exploreBlocked.toArray()
    return new Set(rows.map(r => r.songId))
  } catch {
    return new Set()
  }
}

/** 把某首歌加入探索屏蔽列表 */
export async function blockSong(songId: number): Promise<void> {
  try {
    await db.exploreBlocked.put({ songId, blockedAt: Date.now() })
  } catch {
    // Silently fail — 屏蔽失败不应阻塞浏览
  }
}

/** 清空探索屏蔽列表 */
export async function clearBlockedSongs(): Promise<void> {
  try {
    await db.exploreBlocked.clear()
  } catch {
    // ignore
  }
}

/** Convert Score (app type) → ScoreRecord (DB type) */
export function toScoreRecord(s: Score, createdAt?: Date): Omit<ScoreRecord, 'id'> {
  return {
    songId: s.songId,
    songTitle: s.songTitle,
    levelIndex: s.levelIndex,
    level: s.level,
    levelValue: s.levelValue,
    songType: s.songType,
    achievements: s.achievements,
    rate: s.rate,
    fcType: s.fcType ?? null,
    fsType: s.fsType ?? null,
    dxScore: s.dxScore,
    dxRating: s.dxRating,
    dxScoreDetail: s.dxScoreDetail ?? null,
    playDate: s.playDate,
    createdAt: createdAt ?? new Date(),
  }
}

// ---- Settings helpers ----

/** Default settings — used when no stored value exists */
export const DEFAULT_SETTINGS = {
  darkMode: 'system' as 'light' | 'dark' | 'system',
  pushTargetAch: 100.5,
}

/** Get a single setting value with fallback */
export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  try {
    const entry = await db.settings.get(key)
    return entry ? (entry.value as T) : fallback
  } catch {
    return fallback
  }
}

/** Write a setting value */
export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    await db.settings.put({ key, value })
  } catch {
    // Silently fail — settings are optional
  }
}

/** Get all settings as a Map */
export async function getAllSettings(): Promise<Map<string, unknown>> {
  try {
    const entries = await db.settings.toArray()
    return new Map(entries.map((e) => [e.key, e.value]))
  } catch {
    return new Map()
  }
}
