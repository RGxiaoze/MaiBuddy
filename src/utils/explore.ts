// ============================================================
// explore — 探索池构建
//
// 数据源：Diving-Fish 投票箱（二选一）的累计结果。
// 设计原则：宽池随机（不让人气榜固化），质量靠难度约束与偏好加权保证。
// ============================================================

import type { Song } from '@/types'

export interface VoteStat {
  /** 原始胜率 = (total - down) / total */
  winRate: number
  totalVote: number
  upVote: number
}

export interface ExploreOptions {
  /** 最低票数门槛，低于此值不参与推荐 */
  minVotes?: number
  /** 难度下限（含） */
  minLevel?: number
  /** 难度上限（含）；通常取玩家 B15 最高定数 + 0.5 */
  maxLevel?: number
  /** 返回条数 */
  limit?: number
  /** 只用平滑胜率排名前百分之多少进入随机池 */
  topPercent?: number
  /** 玩家已屏蔽（不感兴趣）的歌曲 */
  blockedSongIds?: Set<number>
  /** 已展示过的条目 key（`songId-levelIndex`），换一批时用于去重 */
  seenKeys?: Set<string>
  /** 随机源，便于测试注入 */
  random?: () => number
}

export interface ExploreItem {
  songId: number
  title: string
  levelIndex: number
  level: string
  levelValue: number
  noteDesigner: string
  /** 原始胜率（展示用） */
  winRate: number
  totalVote: number
  /** 平滑后胜率（排序用） */
  smoothRate: number
}

/** 票数门槛：实测 1294 首中 1265 首达到 30 票 */
export const DEFAULT_MIN_VOTES = 30
export const DEFAULT_LIMIT = 10

/** 默认只取胜率前 70% 进入随机池 —— 再往下就是「社区也不太喜欢」的谱面了 */
const DEFAULT_TOP_PERCENT = 70

/** 平滑强度：相当于给每首歌 20 票的「五五开」先验 */
const PRIOR_WEIGHT = 20
const PRIOR_RATE = 0.5

/**
 * 贝叶斯平滑胜率。
 *
 * 原始胜率在低票数时噪声极大（5 票 80% 会霸榜），这里向 0.5 收缩：
 * 票数越少收缩越强，票数足够时基本等于原始值。
 */
export function smoothWinRate(upVote: number, totalVote: number): number {
  if (totalVote <= 0) return PRIOR_RATE
  return (upVote + PRIOR_RATE * PRIOR_WEIGHT) / (totalVote + PRIOR_WEIGHT)
}

/**
 * 从已游玩集合推导「每首歌已游玩的最高难度索引」。
 *
 * 用于避免降级推荐：打过 Master 的人不该再被推荐这首的 Basic/Advanced/Expert。
 */
export function highestPlayedBySong(playedKeys: Set<string>): Map<number, number> {
  const map = new Map<number, number>()
  for (const key of playedKeys) {
    const [songIdStr, levelStr] = key.split('-')
    const songId = parseInt(songIdStr, 10)
    const levelIndex = parseInt(levelStr, 10)
    if (!Number.isFinite(songId) || !Number.isFinite(levelIndex)) continue
    const prev = map.get(songId)
    if (prev == null || levelIndex > prev) map.set(songId, levelIndex)
  }
  return map
}

/** 从数组里随机取 n 个（部分洗牌，不修改原数组） */
function sampleRandom<T>(arr: T[], n: number, random: () => number): T[] {
  const copy = [...arr]
  const take = Math.min(n, copy.length)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, take)
}

/**
 * 构建探索候选池。
 *
 * 流程：
 * 1. 过滤（无投票数据 / 票数不足 / 已屏蔽）
 * 2. 难度过滤（区间 + 禁止降级推荐）
 * 3. 每首歌只保留难度索引最大的一个（胜率是歌曲级数据，不去重会霸榜）
 * 4. 按平滑胜率排序，取前 `topPercent`% 组成随机池
 * 5. 排除换一批时已展示过的，再随机抽 `limit` 个
 */
export function buildExplorePool(
  songs: Song[],
  playedKeys: Set<string>,
  votes: Map<number, VoteStat>,
  options: ExploreOptions = {},
): ExploreItem[] {
  const {
    minVotes = DEFAULT_MIN_VOTES,
    minLevel,
    maxLevel,
    limit = DEFAULT_LIMIT,
    topPercent = DEFAULT_TOP_PERCENT,
    blockedSongIds,
    seenKeys,
    random = Math.random,
  } = options

  const highestPlayed = highestPlayedBySong(playedKeys)
  const picked = new Map<number, ExploreItem>()

  for (const song of songs) {
    const stat = votes.get(song.id)
    if (!stat || stat.totalVote < minVotes) continue
    if (blockedSongIds?.has(song.id)) continue

    const highest = highestPlayed.get(song.id)
    const diffs = [
      ...(song.difficulties?.standard ?? []),
      ...(song.difficulties?.dx ?? []),
    ]

    for (const diff of diffs) {
      if (!diff || diff.levelValue <= 0) continue
      if (playedKeys.has(`${song.id}-${diff.levelIndex}`)) continue
      // 禁止降级：不推荐低于该曲已游玩最高难度的谱面
      if (highest != null && diff.levelIndex < highest) continue
      if (minLevel != null && diff.levelValue < minLevel) continue
      if (maxLevel != null && diff.levelValue > maxLevel) continue

      const candidate: ExploreItem = {
        songId: song.id,
        title: song.title,
        levelIndex: diff.levelIndex,
        level: diff.level,
        levelValue: diff.levelValue,
        noteDesigner: diff.noteDesigner,
        winRate: stat.winRate,
        totalVote: stat.totalVote,
        smoothRate: smoothWinRate(stat.upVote, stat.totalVote),
      }

      const prev = picked.get(song.id)
      if (!prev || candidate.levelIndex > prev.levelIndex) picked.set(song.id, candidate)
    }
  }

  const ranked = [...picked.values()].sort((a, b) => b.smoothRate - a.smoothRate)
  if (ranked.length === 0) return []

  const poolSize = Math.max(limit, Math.ceil(ranked.length * (topPercent / 100)))
  const pool = ranked.slice(0, poolSize)

  const fresh = seenKeys
    ? pool.filter(it => !seenKeys.has(`${it.songId}-${it.levelIndex}`))
    : pool

  // 已看过的太多时回退到完整池子，避免「换一批」把自己换空
  return sampleRandom(fresh.length >= limit ? fresh : pool, limit, random)
}
