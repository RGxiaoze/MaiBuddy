// ============================================================
// Player store — B50 query & rating data
// ============================================================

import { create } from 'zustand'
import type { DfScore } from '@/services/adapter'
import { toInternalScore } from '@/services/adapter'
import { fetchPlayerScores, fetchPlayerRecords } from '@/services/divingFishApi'
import { computeB50, type B50Result } from '@/utils/b50'

import { useScoreStore } from './scoreStore'
import { useSongStore } from './songStore'

interface PlayerState {
  // Diving-Fish online query
  dfBest35: DfScore[]
  dfBest15: DfScore[]
  dfRating: number
  dfLoading: boolean
  dfError: string | null
  dfPlayerName: string

  // Local B50 computed from IndexedDB scores
  localB50: B50Result | null

  /** Incremented on import/update to force B50 recompute even when scores.length unchanged */
  recomputeFlag: number
}

interface PlayerActions {
  /** Query Diving-Fish API by username/friend code */
  queryPlayer: (username: string) => Promise<void>
  clearQuery: () => void
  /** Compute B50 from local IndexedDB scores */
  computeLocalB50: () => void
  /** Import ALL scores from Diving-Fish into IndexedDB using Import-Token, then refresh B50 */
  importDivingFishScores: (importToken: string) => Promise<{
    total: number; imported: number; updated: number; skipped: number; nickname: string
  }>
  /** Force B50 recompute (call after updateScore which doesn't change length) */
  incrementRecomputeFlag: () => void
}

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  dfBest35: [],
  dfBest15: [],
  dfRating: 0,
  dfLoading: false,
  dfError: null,
  dfPlayerName: '',
  localB50: null,
  recomputeFlag: 0,

  queryPlayer: async (username: string) => {
    const trimmed = username.trim()
    if (!trimmed) return
    set({ dfLoading: true, dfError: null, dfPlayerName: trimmed })
    try {
      const result = await fetchPlayerScores(trimmed)
      set({
        dfBest35: result.best35,
        dfBest15: result.best15,
        dfRating: result.rating,
        dfLoading: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '查询失败'
      set({ dfError: message, dfLoading: false })
    }
  },

  clearQuery: () => set({
    dfBest35: [],
    dfBest15: [],
    dfRating: 0,
    dfError: null,
    dfPlayerName: '',
  }),

  computeLocalB50: () => {
    const { scores } = useScoreStore.getState()
    const { songs } = useSongStore.getState()
    const songMap = new Map(songs.map((s) => [s.id, s]))
    const result = computeB50(scores, songMap)
    set({ localB50: result })
  },

  importDivingFishScores: async (importToken: string) => {
    const trimmed = importToken.trim()
    if (!trimmed) throw new Error('Import-Token 不能为空')

    // 1. Fetch ALL scores from Diving-Fish (every song × every difficulty)
    const result = await fetchPlayerRecords(trimmed)
    if (result.records.length === 0) throw new Error('该账号没有成绩数据')

    // 2. Convert DfScore → Score
    const scores = result.records.map(toInternalScore)

    // 3. Bulk upsert into IndexedDB
    const stats = await useScoreStore.getState().bulkImportScores(scores)

    // 4. Update player info + trigger B50 recompute
    set({
      dfPlayerName: result.nickname || result.username,
      dfRating: result.rating,
      dfBest35: [],
      dfBest15: [],
      dfError: null,
      recomputeFlag: get().recomputeFlag + 1,
    })

    return { ...stats, nickname: result.nickname || result.username }
  },

  incrementRecomputeFlag: () => set((s) => ({ recomputeFlag: s.recomputeFlag + 1 })),
}))
