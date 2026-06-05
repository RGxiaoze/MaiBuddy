// ============================================================
// Score store — CRUD + IndexedDB sync
// ============================================================

import { create } from 'zustand'
import type { Score } from '@/types'
import {
  addScore as dbAddScore,
  bulkUpsertScores,
  clearAllScores as dbClearAllScores,
  deleteScore as dbDeleteScore,
  getAllScores,
  updateScore as dbUpdateScore,
  toScoreRecord,
  type ScoreRecord,
} from '@/db/database'

interface ScoreState {
  scores: ScoreRecord[]
  loading: boolean
  loaded: boolean
  fetchAllScores: () => Promise<void>
  addScore: (score: Score) => Promise<number>
  updateScore: (id: number, updates: Partial<ScoreRecord>) => Promise<void>
  deleteScore: (id: number) => Promise<void>
  getScoresBySong: (songId: number) => ScoreRecord[]
  bulkImportScores: (scores: Score[], onProgress?: (current: number, total: number) => void) => Promise<{
    total: number; imported: number; updated: number; skipped: number
  }>
  clearAllScores: () => Promise<void>
}

export const useScoreStore = create<ScoreState>((set, get) => ({
  scores: [],
  loading: false,
  loaded: false,

  fetchAllScores: async () => {
    set({ loading: true })
    const scores = await getAllScores()
    set({ scores, loading: false, loaded: true })
  },

  addScore: async (score) => {
    const record = toScoreRecord(score)
    const id = await dbAddScore(record)
    // Mutate local array — avoids O(n) full DB rescan
    set((state) => ({
      scores: [{ ...record, id, createdAt: new Date() }, ...state.scores],
    }))
    return id
  },

  updateScore: async (id, updates) => {
    await dbUpdateScore(id, updates)
    set((state) => ({
      scores: state.scores.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }))
  },

  deleteScore: async (id) => {
    await dbDeleteScore(id)
    set((state) => ({
      scores: state.scores.filter((s) => s.id !== id),
    }))
  },

  getScoresBySong: (songId) => {
    return get().scores.filter((s) => s.songId === songId)
  },

  bulkImportScores: async (scores, onProgress) => {
    const records = scores.map((s) => toScoreRecord(s))
    const result = await bulkUpsertScores(records, onProgress)
    // Refetch all scores to sync local array with DB (includes id, createdAt)
    const allScores = await getAllScores()
    set({ scores: allScores })
    return result
  },

  clearAllScores: async () => {
    await dbClearAllScores()
    set({ scores: [], loaded: false })
  },
}))
