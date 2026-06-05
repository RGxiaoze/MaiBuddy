// ============================================================
// Song store — fetch & filter song list
// ============================================================

import { create } from 'zustand'
import type { Song } from '@/types'
import { fetchMusicData } from '@/services/divingFishApi'
import { getCachedSongs, setCachedSongs, db, getSetting, setSetting, SONG_CACHE_TTL_MS } from '@/db/database'
import { searchAliases, getAliasIndex } from '@/data/aliases'
import { VERSION_ORDER } from '@/data/versions'
import { forceRefreshStats } from '@/services/statsService'

/** Extract max version sorting value from song list as cache fingerprint */
function computeVersionFingerprint(songs: Song[]): number {
  let max = 0
  for (const s of songs) {
    const v = VERSION_ORDER.get(s.from) ?? 0
    if (v > max) max = v
  }
  return max
}
export type SortOrder = 'asc' | 'desc'

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'default', label: '最高定数' },
  { value: 'bpm', label: 'BPM' },
  { value: 'version', label: '版本' },
]

interface AdvancedFilters {
  levelValueMin?: number
  levelValueMax?: number
  genre?: string
  version?: string           // from (e.g. "FESTiVAL")
  difficultyLevel?: number   // LevelIndex (0-4)
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
  getFilteredSongs: (searchOverride?: string) => Song[]
}

const defaultFilters: AdvancedFilters = {}

export const useSongStore = create<SongState & SongActions>((set, get) => ({
  // State
  songs: [],
  loading: false,
  error: null,
  searchQuery: '',
  advancedFilters: { ...defaultFilters },
  sortBy: 'default' as SortBy,
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
  getFilteredSongs: (searchOverride) => {
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
          // c. 谱师（遍历所有难度，排除 '未知' fallback）
          for (const d of [...song.difficulties.standard, ...song.difficulties.dx]) {
            if (d.noteDesigner && d.noteDesigner !== '未知' &&
                d.noteDesigner.toLowerCase().includes(t)) return true
          }
          // d. 别名
          if (aliasIds[i]?.has(song.id)) return true

          return false
        })
        if (!allTokensMatch) return false
      }

      // ===== 高级筛选（AND 叠加） =====
      // Genre 精确匹配
      if (advancedFilters.genre && song.genre !== advancedFilters.genre) return false

      // Version 精确匹配
      if (advancedFilters.version && song.from !== advancedFilters.version) return false

      // DifficultyLevel 筛选
      if (advancedFilters.difficultyLevel != null) {
        const hasLevel = !!song.difficulties.standard[advancedFilters.difficultyLevel] ||
                         !!song.difficulties.dx[advancedFilters.difficultyLevel]
        if (!hasLevel) return false
      }

      // LevelValue 范围筛选
      if (advancedFilters.levelValueMin != null || advancedFilters.levelValueMax != null) {
        const allDiffs = [...song.difficulties.standard, ...song.difficulties.dx]
        const inRange = allDiffs.some((d) => {
          if (advancedFilters.levelValueMin != null && d.levelValue < advancedFilters.levelValueMin) return false
          if (advancedFilters.levelValueMax != null && d.levelValue > advancedFilters.levelValueMax) return false
          return true
        })
        if (!inRange) return false
      }

      return true
    })

    // 3. 排序
    const mult = sortOrder === 'desc' ? -1 : 1
    result.sort((a, b) => {
      switch (sortBy) {
        case 'bpm':
          return (a.bpm - b.bpm) * mult
        case 'version': {
          const va = VERSION_ORDER.get(a.from) ?? 0
          const vb = VERSION_ORDER.get(b.from) ?? 0
          return (va - vb) * mult
        }
        case 'default':
        case 'levelValue': {
          const maxA = Math.max(...[...a.difficulties.standard, ...a.difficulties.dx].map(d => d.levelValue), 0)
          const maxB = Math.max(...[...b.difficulties.standard, ...b.difficulties.dx].map(d => d.levelValue), 0)
          return (maxA - maxB) * mult
        }
        default:
          return 0
      }
    })
    return result
  },
}))
