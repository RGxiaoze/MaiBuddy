// ============================================================
// Player store — 本地成绩与在线查分两套互不干扰的数据
//
// 历史教训：原先 dfPlayerName / dfRating 被「在线查分」和三种「导入」共用，
// 而 dfBest35 / dfBest15 只有在线查分才会填。于是清空本地成绩后，侧栏仍挂着
// 一个没有 B50 明细的孤儿 Rating，推荐页却因为没有明细而整页为空。
// 现在按来源拆成两套：imported*（本地那批成绩的账号信息）与 online*（在线查分）。
// ============================================================

import { create } from 'zustand'
import type { DfScore } from '@/services/adapter'
import { toInternalScore } from '@/services/adapter'
import { fetchPlayerScores, fetchPlayerRecords, fetchPlayerRecordsOAuth } from '@/services/divingFishApi'
import { fetchMyScores, fetchMyPlayer, toDfScores, type LxnsAuth } from '@/services/lxnsApi'
import { computeB50, type B50Result } from '@/utils/b50'

import { useScoreStore } from './scoreStore'
import { useSongStore } from './songStore'

interface PlayerState {
  // ---- 本地：由已导入的成绩计算 ----
  localB50: B50Result | null
  /** 导入时缓存的账号名，描述的是那批已导入的成绩；清空成绩时一并清掉 */
  importedPlayerName: string
  /** 导入时缓存的 Rating，仅供侧栏展示，不参与推荐计算 */
  importedRating: number

  // ---- 在线查分：与本地完全独立 ----
  onlinePlayerName: string
  onlineRating: number
  onlineBest35: DfScore[]
  onlineBest15: DfScore[]
  onlineLoading: boolean
  onlineError: string | null

  /** Incremented on import/update to force B50 recompute even when scores.length unchanged */
  recomputeFlag: number
}

interface PlayerActions {
  /** Query Diving-Fish API by username/friend code */
  queryPlayer: (username: string) => Promise<void>
  clearQuery: () => void
  /** Compute B50 from local IndexedDB scores */
  computeLocalB50: () => void
  /** 清空本地成绩后调用：只清本地这一套，在线查分结果原样保留 */
  clearLocalPlayer: () => void
  /** Import ALL scores from Diving-Fish into IndexedDB using Import-Token, then refresh B50 */
  importDivingFishScores: (importToken: string, onProgress?: (current: number, total: number) => void) => Promise<{
    total: number; imported: number; updated: number; skipped: number; nickname: string
  }>
  /** 通过 OAuth access token 导入（查询对象由令牌决定，不再传 username/token） */
  importScoresViaOAuth: (accessToken: string, onProgress?: (current: number, total: number) => void) => Promise<{
    total: number; imported: number; updated: number; skipped: number; nickname: string
  }>
  /** 通过落雪凭据导入：OAuth 令牌或账号详情里生成的个人 API 密钥 */
  importScoresViaLxns: (token: string, auth?: LxnsAuth, onProgress?: (current: number, total: number) => void) => Promise<{
    total: number; imported: number; updated: number; skipped: number; nickname: string
  }>
  /** Force B50 recompute (call after updateScore which doesn't change length) */
  incrementRecomputeFlag: () => void
}

/** 空掉的在线查分结果：导入时用它清场，避免上一轮查到的别人数据混进推荐 */
const emptyOnline = {
  onlinePlayerName: '',
  onlineRating: 0,
  onlineBest35: [] as DfScore[],
  onlineBest15: [] as DfScore[],
  onlineLoading: false,
  onlineError: null,
}

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  // 本地
  localB50: null,
  importedPlayerName: '',
  importedRating: 0,

  // 在线
  onlinePlayerName: '',
  onlineRating: 0,
  onlineBest35: [],
  onlineBest15: [],
  onlineLoading: false,
  onlineError: null,

  recomputeFlag: 0,

  queryPlayer: async (username: string) => {
    const trimmed = username.trim()
    if (!trimmed) return
    set({ onlineLoading: true, onlineError: null, onlinePlayerName: trimmed })
    try {
      const result = await fetchPlayerScores(trimmed)
      set({
        onlineBest35: result.best35,
        onlineBest15: result.best15,
        onlineRating: result.rating,
        onlineLoading: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '查询失败'
      set({ onlineError: message, onlineLoading: false })
    }
  },

  clearQuery: () => set({ ...emptyOnline }),

  computeLocalB50: () => {
    const { scores } = useScoreStore.getState()
    const { songs } = useSongStore.getState()
    const songMap = new Map(songs.map((s) => [s.id, s]))
    const result = computeB50(scores, songMap)
    set({ localB50: result })
  },

  clearLocalPlayer: () => set({
    localB50: null,
    importedPlayerName: '',
    importedRating: 0,
  }),

  importDivingFishScores: async (importToken: string, onProgress?: (current: number, total: number) => void) => {
    const trimmed = importToken.trim()
    if (!trimmed) throw new Error('Import-Token 不能为空')

    // 1. Fetch ALL scores from Diving-Fish (every song × every difficulty)
    const result = await fetchPlayerRecords(trimmed)
    if (result.records.length === 0) throw new Error('该账号没有成绩数据')

    // 2. Convert DfScore → Score
    const scores = result.records.map(toInternalScore)

    // 3. Bulk upsert into IndexedDB
    const stats = await useScoreStore.getState().bulkImportScores(scores, onProgress)

    // 4. 只写「本地」这一套；同时清掉上一轮在线查分结果，避免别的账号混进来
    set({
      ...emptyOnline,
      importedPlayerName: result.nickname || result.username,
      importedRating: result.rating,
      recomputeFlag: get().recomputeFlag + 1,
    })

    return { ...stats, nickname: result.nickname || result.username }
  },

  incrementRecomputeFlag: () => set((s) => ({ recomputeFlag: s.recomputeFlag + 1 })),

  importScoresViaOAuth: async (accessToken: string, onProgress?: (current: number, total: number) => void) => {
    const result = await fetchPlayerRecordsOAuth(accessToken)
    if (result.records.length === 0) throw new Error('该账号没有成绩数据')

    const scores = result.records.map(toInternalScore)
    const stats = await useScoreStore.getState().bulkImportScores(scores, onProgress)

    set({
      ...emptyOnline,
      importedPlayerName: result.nickname || result.username,
      importedRating: result.rating,
      recomputeFlag: get().recomputeFlag + 1,
    })

    return { ...stats, nickname: result.nickname || result.username }
  },

  importScoresViaLxns: async (token: string, auth: LxnsAuth = 'oauth', onProgress?: (current: number, total: number) => void) => {
    const rawScores = await fetchMyScores(token, auth)
    if (rawScores.length === 0) throw new Error('该账号没有成绩数据')

    // 落雪的成绩不含定数，依赖本地曲库补齐；补不上的条目在 toDfScores 内被丢弃
    const { songs } = useSongStore.getState()
    const songMap = new Map(songs.map((s) => [s.id, s]))
    const scores = toDfScores(rawScores, songMap).map(toInternalScore)
    if (scores.length === 0) {
      throw new Error('落雪返回的成绩无法匹配本地曲库，请先刷新曲库后重试')
    }

    const stats = await useScoreStore.getState().bulkImportScores(scores, onProgress)

    const player = await fetchMyPlayer(token, auth)
    const nickname = typeof player?.name === 'string' && player.name ? player.name : '落雪玩家'
    const rating = typeof player?.rating === 'number' ? player.rating : 0

    set({
      ...emptyOnline,
      importedPlayerName: nickname,
      importedRating: rating,
      recomputeFlag: get().recomputeFlag + 1,
    })

    return { ...stats, nickname }
  },
}))
