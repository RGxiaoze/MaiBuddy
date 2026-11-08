// ============================================================
// voteService — Diving-Fish 投票箱（二选一）偏好数据
//
// 该端点未写入官方 API 文档（属公开但未承诺的接口），
// 因此：24h 缓存 + 失败静默降级 + 一个自然日最多请求一次。
// ============================================================

import { getCachedVotes, setCachedVotes } from '@/db/database'
import type { CachedVoteEntry } from '@/db/database'
import type { VoteStat } from '@/utils/explore'

const API_BASE = import.meta.env.DEV
  ? '/api/maimaidxprober'
  : 'https://www.diving-fish.com/api/maimaidxprober'

const TIMEOUT_MS = 10_000

// ---- Internal state ----

let _stats: Map<number, VoteStat> | null = null
let _loadPromise: Promise<void> | null = null
let _failed = false

/**
 * 把接口原始条目转成 `songId → VoteStat`。
 *
 * `down_vote > total_vote` 之类的脏数据直接跳过，避免算出负数胜率。
 */
export function parseVoteResult(entries: CachedVoteEntry[]): Map<number, VoteStat> {
  const map = new Map<number, VoteStat>()
  for (const entry of entries) {
    const id = parseInt(entry.music_id, 10)
    const total = entry.total_vote
    if (!Number.isFinite(id) || !Number.isFinite(total) || total <= 0) continue
    const down = entry.down_vote ?? 0
    if (down < 0 || down > total) continue
    const up = total - down
    map.set(id, { winRate: up / total, totalVote: total, upVote: up })
  }
  return map
}

/** 投票数据是否已成功加载 */
export function isVoteStatsLoaded(): boolean {
  return _stats != null
}

/** 投票数据是否拉取失败（UI 用于降级提示） */
export function isVoteStatsFailed(): boolean {
  return _failed
}

export function getVoteStat(songId: number): VoteStat | undefined {
  return _stats?.get(songId)
}

export function getAllVoteStats(): Map<number, VoteStat> {
  return _stats ?? new Map()
}

/**
 * 加载投票结果。缓存优先，失败不抛错（仅置失败标记）。
 */
export async function loadVoteStats(): Promise<void> {
  if (_stats) return
  if (_loadPromise) return _loadPromise

  const run = async () => {
    try {
      const cached = await getCachedVotes()
      if (cached && cached.length > 0) {
        _stats = parseVoteResult(cached)
        return
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      let payload: unknown
      try {
        const res = await fetch(`${API_BASE}/vote_result`, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        payload = await res.json()
      } finally {
        clearTimeout(timer)
      }

      if (!Array.isArray(payload) || payload.length === 0) throw new Error('empty payload')

      const entries = payload as CachedVoteEntry[]
      await setCachedVotes(entries)
      _stats = parseVoteResult(entries)
    } catch {
      _failed = true
    }
  }

  _loadPromise = run()
  try {
    await _loadPromise
  } finally {
    _loadPromise = null
  }
}
