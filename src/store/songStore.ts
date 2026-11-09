// ============================================================
// Song store — fetch & filter song list
// ============================================================

import { create } from 'zustand'
import type { Song, ChartDifficulty } from '@/types'
import { fetchMusicData } from '@/services/divingFishApi'
import { getCachedSongs, setCachedSongs, db, getSetting, setSetting, SONG_CACHE_TTL_MS } from '@/db/database'
import { searchAliases, getAliasIndex } from '@/data/aliases'
import { VERSION_ORDER } from '@/data/versions'
import { forceRefreshStats } from '@/services/statsService'
import { UTAGE_ID_THRESHOLD } from '@/config/algorithms'
import { sortSongs, type SongScoreStat } from '@/utils/songSort'

/** Extract max version sorting value from song list as cache fingerprint */
function computeVersionFingerprint(songs: Song[]): number {
  let max = 0
  for (const s of songs) {
    const v = VERSION_ORDER.get(s.from) ?? 0
    if (v > max) max = v
  }
  return max
}
export type SortBy = 'default' | 'bpm' | 'version' | 'levelValue' | 'title' | 'achievements' | 'dxScoreRate' | 'addedAt' | 'releaseDate'
export type SortOrder = 'asc' | 'desc'

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'addedAt', label: '添加日期' },
  { value: 'releaseDate', label: '实装日期' },
  { value: 'default', label: '最高定数' },
  { value: 'bpm', label: 'BPM' },
  { value: 'version', label: '版本' },
  { value: 'title', label: '曲名' },
  { value: 'achievements', label: '成绩' },
  { value: 'dxScoreRate', label: 'DX 分数' },
]

interface AdvancedFilters {
  levelValueMin?: number
  levelValueMax?: number
  genre?: string
  /** 版本名多选（如 ["舞萌2025", "CiRCLE"]） */
  versions?: string[]
  /** 难度索引多选（0-4） */
  difficultyLevels?: number[]
  level?: string             // 歌曲等级标签（如 "14+"），谱面级精确匹配
  /** 是否把宴会场曲目（ID ≥ 100000）纳入列表，默认 false */
  includeUtage?: boolean
}

interface SongState {
  songs: Song[]
  loading: boolean
  error: string | null
  searchQuery: string
  advancedFilters: AdvancedFilters
  sortBy: SortBy
  sortOrder: SortOrder
}

interface SongActions {
  fetchSongs: () => Promise<void>
  setSearchQuery: (query: string) => void
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void
  resetFilters: () => void
  setSortBy: (sortBy: SortBy) => void
  toggleSortOrder: () => void
  /** Returns filtered songs. Pass `searchOverride` to defer search (e.g. from useDeferredValue). */
  getFilteredSongs: (searchOverride?: string, scoreStats?: Map<number, SongScoreStat>) => Song[]
}

const defaultFilters: AdvancedFilters = {}

export const useSongStore = create<SongState & SongActions>((set, get) => ({
  // State
  songs: [],
  loading: false,
  error: null,
  searchQuery: '',
  advancedFilters: { ...defaultFilters },
  sortBy: 'addedAt' as SortBy,
  sortOrder: 'desc' as SortOrder,

  // Actions
  fetchSongs: async () => {
    set({ loading: true, error: null })
    try {
      // Try fresh cache first
      const cached = await getCachedSongs()
      if (cached && cached.length > 0) {
        set({ songs: cached, loading: false })
        // Background refresh with version fingerprint check
        fetchMusicData()
          .then(async (fresh) => {
            const oldVersion = await getSetting<number>('cache_version', 0)
            const newVersion = computeVersionFingerprint(fresh)
            set({ songs: fresh })
            setCachedSongs(fresh)
            if (newVersion > oldVersion) {
              await setSetting('cache_version', newVersion)
              // New songs detected → refresh stats as well
              forceRefreshStats()
            }
          })
          .catch(() => { /* keep cached version */ })
        return
      }
      // No fresh cache — fetch from API
      const songs = await fetchMusicData()
      set({ songs, loading: false })
      setCachedSongs(songs)
      setSetting('cache_version', computeVersionFingerprint(songs))
    } catch (err) {
      // Try stale cache as fallback (extend by 1 hour)
      try {
        const entry = await db.songCache.get(1)
        if (entry && entry.data?.length > 0) {
          await db.songCache.put({ id: 1, data: entry.data, updatedAt: Date.now() - SONG_CACHE_TTL_MS + 3600_000 })
          set({ songs: entry.data, loading: false })
          return
        }
      } catch { /* no stale cache either */ }
      const message = err instanceof Error ? err.message : '未知错误'
      set({ error: message, loading: false })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setAdvancedFilters: (filters) =>
    set((state) => ({
      advancedFilters: { ...state.advancedFilters, ...filters },
    })),

  resetFilters: () =>
    set({ searchQuery: '', advancedFilters: { ...defaultFilters } }),

  setSortBy: (sortBy) => set({ sortBy }),

  toggleSortOrder: () => set((state) => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' })),

  // Derived: filter songs client-side (multi-keyword AND search)
  getFilteredSongs: (searchOverride, scoreStats) => {
    const { songs, searchQuery, advancedFilters, sortBy, sortOrder } = get()
    const rawQuery = (searchOverride ?? searchQuery).trim()
    const aliasIndex = getAliasIndex()

    // 1. 分词：空格分隔，过滤空 token
    const tokens = rawQuery ? rawQuery.split(/\s+/).filter(t => t.length > 0) : []
    const hasTokens = tokens.length > 0

    // 2. 预先收集别名匹配结果（每个 token 一个 Set）
    const aliasIds: Array<Set<number>> = hasTokens
      ? tokens.map(t => searchAliases(t, aliasIndex))
      : []

    const result = songs.filter((song) => {
      // ===== 多关键词 AND 搜索 =====
      if (hasTokens) {
        const allTokensMatch = tokens.every((token, i) => {
          const t = token.toLowerCase()

          // a. 曲名
          if (song.title.toLowerCase().includes(t)) return true
          // b. 曲师
          if (song.artist.toLowerCase().includes(t)) return true
          // c. 谱师（遍历所有难度，排除无谱师的占位值；
          //    历史曲库缓存里未经过 normalizeDesigner 的 '-' 也要排除）
          for (const d of [...song.difficulties.standard, ...song.difficulties.dx]) {
            if (d.noteDesigner && d.noteDesigner !== '未知' && d.noteDesigner !== '-' &&
                d.noteDesigner.toLowerCase().includes(t)) return true
          }
          // d. 别名
          if (aliasIds[i]?.has(song.id)) return true

          return false
        })
        if (!allTokensMatch) return false
      }

      // ===== 高级筛选（AND 叠加） =====
      // 宴会场（ID ≥ 100000）没有定数与难度数据，等级显示为「?」，
      // 混在主列表里会污染排序与筛选，默认隐藏。
      if (!advancedFilters.includeUtage && song.id >= UTAGE_ID_THRESHOLD) return false

      // Genre 精确匹配
      if (advancedFilters.genre && song.genre !== advancedFilters.genre) return false

      // Version 多选
      if (advancedFilters.versions?.length && !advancedFilters.versions.includes(song.from)) return false

      // DifficultyLevel / LevelValue / Level 三个条件都是「谱面级」的，
      // 必须由**同一个谱面**同时满足：
      // 「BASIC 且 13.0」= 存在一个 BASIC 谱面且它的定数就是 13.0，
      // 而不是「有 BASIC 谱面」+「有某个 13.0 谱面」（那可能是两首不同的谱）。
      const chartPredicates: Array<(d: ChartDifficulty) => boolean> = []
      if (advancedFilters.difficultyLevels?.length) {
        const want = advancedFilters.difficultyLevels
        chartPredicates.push(d => want.includes(d.levelIndex))
      }
      if (advancedFilters.levelValueMin != null) {
        const min = advancedFilters.levelValueMin
        chartPredicates.push(d => d.levelValue >= min)
      }
      if (advancedFilters.levelValueMax != null) {
        const max = advancedFilters.levelValueMax
        chartPredicates.push(d => d.levelValue <= max)
      }
      if (advancedFilters.level) {
        const lv = advancedFilters.level
        chartPredicates.push(d => d.level === lv)
      }

      if (chartPredicates.length > 0) {
        const allDiffs = [...song.difficulties.standard, ...song.difficulties.dx]
        if (!allDiffs.some(d => chartPredicates.every(fn => fn(d)))) return false
      }

      return true
    })

    // 3. 排序（成绩维度需要外部传入 scoreStats）
    return sortSongs(result, { sortBy, sortOrder, scoreStats })
  },
}))
