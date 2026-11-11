// ============================================================
// Song store — fetch & filter song list
// ============================================================

import { create } from 'zustand'
import type { Song, ChartDifficulty, FitDiffSource } from '@/types'
import { fetchMusicData } from '@/services/divingFishApi'
import { getCachedSongs, setCachedSongs, db, getSetting, setSetting, SONG_CACHE_TTL_MS } from '@/db/database'
import { searchAliases, getAliasIndex } from '@/data/aliases'
import { VERSION_ORDER, formatVersionLabel } from '@/data/versions'
import { getInstallYear } from '@/services/installYearService'

/**
 * 曲目的版本展示标签，供筛选与列表统一使用。
 *
 * DX 时代取国服实装年对应的版本名（舞萌DX 20XX），旧框沿用日服名。
 * 实装年数据未加载时退回 `song.from`，不影响筛选可用性。
 */
export function songVersionLabel(song: { id: number; from: string; version: number }): string {
  const year = getInstallYear(song.id, 3) ?? getInstallYear(song.id, 2) ?? getInstallYear(song.id, 4)
  return formatVersionLabel(song.from, song.version, year)
}
import { forceRefreshStats, getFitDiffValue } from '@/services/statsService'
import { UTAGE_ID_THRESHOLD } from '@/config/algorithms'
import { sortSongs, type SongScoreStat } from '@/utils/songSort'
import { fetchLxnsReleaseDates, withLxnsReleaseDates } from '@/services/lxnsSongs'

/**
 * 用落雪公共曲库补齐实装日期。
 * 水鱼 music_data 的 release_date 全库为空，只能从落雪取。
 * 拉取失败时返回原数组 —— 排序仍可用，缺日期的条目排最后。
 */
async function enrichReleaseDates(songs: Song[]): Promise<Song[]> {
  if (songs.length === 0 || songs.every((s) => s.releaseDate)) return songs
  try {
    const dates = await fetchLxnsReleaseDates()
    return withLxnsReleaseDates(songs, dates)
  } catch {
    return songs
  }
}

/** Extract max version sorting value from song list as cache fingerprint */
function computeVersionFingerprint(songs: Song[]): number {
  let max = 0
  for (const s of songs) {
    const v = VERSION_ORDER.get(s.from) ?? 0
    if (v > max) max = v
  }
  return max
}
export type SortBy = 'default' | 'bpm' | 'version' | 'levelValue' | 'title' | 'achievements' | 'dxScoreRate' | 'releaseDate'
export type SortOrder = 'asc' | 'desc'

/** 拟合定数的浮点容差：用户填的边界是 0.1 精度，拟合值是计算出来的带尾数 */
const FIT_EPS = 1e-9

/**
 * 等级标签 → 拟合定数的十分位区间 `[lo, hi)`。
 * 官标 "13" 覆盖 13.0~13.4，"13+" 覆盖 13.5~13.9。
 */
function levelLabelTenths(label: string): [number, number] {
  const base = Math.round(parseFloat(label) * 10)
  return label.endsWith('+') ? [base + 5, base + 10] : [base, base + 5]
}

export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  // 标签写「添加日期」：玩家视角就是「这首歌什么时候进游戏的」，数据源自实装日期
  { value: 'releaseDate', label: '添加日期' },
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
  /**
   * 按拟合定数筛选的口径。设值时 `level` 与 `levelValueMin/Max`
   * 改比对拟合定数而非官标定数：
   * - `'sssPlus'` = 水鱼 fit_diff（详情页标 SSS+）
   * - `'sss'`     = 项目自算的 SSS 口径拟合
   * 该谱面没有对应统计数据时不匹配。
   */
  fitDiffSource?: FitDiffSource
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
  /**
   * 全服统计的加载代次。按拟合定数筛选要先拉 chart_stats，
   * 拉到后递增此值，让依赖它的列表 useMemo 重算。
   */
  statsEpoch: number
}

interface SongActions {
  fetchSongs: () => Promise<void>
  setSearchQuery: (query: string) => void
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void
  resetFilters: () => void
  /** 全服统计加载完成后调用，触发按拟合定数的筛选重算 */
  bumpStatsEpoch: () => void
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
  sortBy: 'releaseDate' as SortBy,
  sortOrder: 'desc' as SortOrder,
  statsEpoch: 0,

  // Actions
  fetchSongs: async () => {
    set({ loading: true, error: null })
    try {
      // Try fresh cache first
      const cached = await getCachedSongs()
      if (cached && cached.length > 0) {
        set({ songs: cached, loading: false })
        // 旧缓存没有实装日期，后台补齐一次（失败就保持原样，排序仍可用）
        if (cached.some((s) => !s.releaseDate)) {
          enrichReleaseDates(cached)
            .then(async (filled) => {
              if (filled === cached) return
              set({ songs: filled })
              await setCachedSongs(filled)
            })
            .catch(() => { /* 保持原样 */ })
        }
        // Background refresh with version fingerprint check
        fetchMusicData()
          .then(async (fresh) => {
            const oldVersion = await getSetting<number>('cache_version', 0)
            const newVersion = computeVersionFingerprint(fresh)
            const filled = await enrichReleaseDates(fresh)
            set({ songs: filled })
            setCachedSongs(filled)
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
      const fresh = await fetchMusicData()
      const songs = await enrichReleaseDates(fresh)
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

  bumpStatsEpoch: () => set((state) => ({ statsEpoch: state.statsEpoch + 1 })),

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

      // Version 多选（按展示口径匹配：DX 时代用国服版本名，旧框沿用日服名）
      if (advancedFilters.versions?.length && !advancedFilters.versions.includes(songVersionLabel(song))) return false

      // DifficultyLevel / LevelValue / Level 三个条件都是「谱面级」的，
      // 必须由**同一个谱面**同时满足：
      // 「BASIC 且 13.0」= 存在一个 BASIC 谱面且它的定数就是 13.0，
      // 而不是「有 BASIC 谱面」+「有某个 13.0 谱面」（那可能是两首不同的谱）。
      const chartPredicates: Array<(d: ChartDifficulty) => boolean> = []
      if (advancedFilters.difficultyLevels?.length) {
        const want = advancedFilters.difficultyLevels
        chartPredicates.push(d => want.includes(d.levelIndex))
      }

      // 勾选了拟合口径时，等级与定数条件改比对拟合定数。
      // 没有统计数据（或该口径不适用）的谱面返回 null —— 不满足任何拟合条件，
      // 而不是退回官标，否则筛选结果会混入两种口径。
      const fitSource = advancedFilters.fitDiffSource
      const fitOf = fitSource
        ? (d: ChartDifficulty): number | null =>
            getFitDiffValue(song.id, d.level, d.levelValue, fitSource)
        : null

      if (advancedFilters.levelValueMin != null) {
        const min = advancedFilters.levelValueMin
        chartPredicates.push(fitOf
          ? d => { const v = fitOf(d); return v !== null && v >= min - FIT_EPS }
          : d => d.levelValue >= min)
      }
      if (advancedFilters.levelValueMax != null) {
        const max = advancedFilters.levelValueMax
        chartPredicates.push(fitOf
          ? d => { const v = fitOf(d); return v !== null && v <= max + FIT_EPS }
          : d => d.levelValue <= max)
      }
      if (advancedFilters.level) {
        const lv = advancedFilters.level
        if (fitOf) {
          // 官标等级标签是 0.5 宽的区间（"13+" = 13.5~13.9），
          // 用十分位整数比较，避开拟合定数的浮点尾数
          const [lo, hi] = levelLabelTenths(lv)
          chartPredicates.push(d => {
            const v = fitOf(d)
            if (v === null) return false
            const tenths = Math.round(v * 10)
            return tenths >= lo && tenths < hi
          })
        } else {
          chartPredicates.push(d => d.level === lv)
        }
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
