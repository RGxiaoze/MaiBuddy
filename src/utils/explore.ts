// ============================================================
// explore — 探索池构建
//
// 数据源：Diving-Fish 投票箱（二选一）的累计结果。
// 设计原则：宽池随机（不让人气榜固化），质量靠难度约束与偏好加权保证。
// ============================================================

import type { Song } from '@/types'
import { normalizeDesignerName } from '@/data/designer-aliases'
import { isChartExcluded } from '@/data/excluded-charts'

/** 从已游玩数据推断出的偏好画像 */
export interface PreferenceProfile {
  /** 偏好的谱师（归一化名） */
  designers: Set<string>
  /** 较少游玩的曲风 */
  rareGenres: Set<string>
}

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
  /**
   * 「很久没玩」的谱面 key（`songId-levelIndex`）。
   * 这些谱面仍属于已游玩，但允许重新进入推荐池 —— 给玩遍全部谱面的玩家用。
   */
  staleKeys?: Set<string>
  /** 随机源，便于测试注入 */
  random?: () => number
  /** 偏好画像：命中偏好谱师 / 冷门曲风时小幅加权 */
  preference?: PreferenceProfile
}

export interface ExploreItem {
  songId: number
  title: string
  levelIndex: number
  level: string
  levelValue: number
  noteDesigner: string
  /** 曲目分类（POPS&ANIME 等） */
  genre: string
  /** 所属版本（maimai MiLK 等） */
  from: string
  /** BPM */
  bpm: number
  /** 原始胜率（展示用） */
  winRate: number
  totalVote: number
  /** 平滑后胜率（排序用） */
  smoothRate: number
  /** 最终排序分 = 平滑胜率 + 偏好加成 */
  score: number
}

/** 偏好加成的权重（相对胜率，量级小，只做微调） */
const PREFERENCE_BOOST = 0.05

/**
 * 从已游玩数据推断偏好画像。
 *
 * - 谱师：按已游玩谱面频次取 Top N（使用归一化后的常用名）
 * - 曲风：游玩数低于中位数的曲风视为「冷门」，给探索加成
 */
export function buildPreferenceProfile(
  songs: Song[],
  playedChartKeys: Set<string>,
  topN = 3,
): PreferenceProfile {
  const designerCounts = new Map<string, number>()
  const genreCounts = new Map<string, number>()

  for (const song of songs) {
    for (const key of ['standard', 'dx'] as const) {
      for (const diff of (song.difficulties?.[key] ?? [])) {
        if (!diff || !playedChartKeys.has(`${song.id}-${diff.levelIndex}`)) continue
        const name = normalizeDesignerName(diff.noteDesigner)
        if (name && name !== '未知') designerCounts.set(name, (designerCounts.get(name) ?? 0) + 1)
        if (song.genre) genreCounts.set(song.genre, (genreCounts.get(song.genre) ?? 0) + 1)
      }
    }
  }

  const designers = new Set(
    [...designerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([name]) => name),
  )

  const sortedCounts = [...genreCounts.values()].sort((a, b) => a - b)
  const median = sortedCounts.length > 0
    ? sortedCounts[Math.floor(sortedCounts.length / 2)]
    : 0
  const rareGenres = new Set(
    [...genreCounts.entries()].filter(([, count]) => count <= median).map(([genre]) => genre),
  )

  return { designers, rareGenres }
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
    preference,
    staleKeys,
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
      if (isChartExcluded(song.id, diff.levelIndex)) continue
      const key = `${song.id}-${diff.levelIndex}`
      // 「很久没玩」的谱面允许回到池子（给已经玩遍的玩家）
      if (playedKeys.has(key) && !staleKeys?.has(key)) continue
      // 禁止降级：不推荐低于该曲已游玩最高难度的谱面
      if (highest != null && diff.levelIndex < highest) continue
      if (minLevel != null && diff.levelValue < minLevel) continue
      if (maxLevel != null && diff.levelValue > maxLevel) continue

      const smoothRate = smoothWinRate(stat.upVote, stat.totalVote)

      // 偏好加成：命中偏好谱师 / 冷门曲风各 +0.05（相对胜率是微调，不喧宾夺主）
      let score = smoothRate
      if (preference) {
        if (preference.designers.has(normalizeDesignerName(diff.noteDesigner))) score += PREFERENCE_BOOST
        if (song.genre && preference.rareGenres.has(song.genre)) score += PREFERENCE_BOOST
      }

      const candidate: ExploreItem = {
        songId: song.id,
        title: song.title,
        levelIndex: diff.levelIndex,
        level: diff.level,
        levelValue: diff.levelValue,
        noteDesigner: diff.noteDesigner,
        genre: song.genre ?? '',
        from: song.from ?? '',
        bpm: song.bpm ?? 0,
        winRate: stat.winRate,
        totalVote: stat.totalVote,
        smoothRate,
        score,
      }

      const prev = picked.get(song.id)
      if (!prev || candidate.levelIndex > prev.levelIndex) picked.set(song.id, candidate)
    }
  }

  const ranked = [...picked.values()].sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return []

  const poolSize = Math.max(limit, Math.ceil(ranked.length * (topPercent / 100)))
  const pool = ranked.slice(0, poolSize)

  const fresh = seenKeys
    ? pool.filter(it => !seenKeys.has(`${it.songId}-${it.levelIndex}`))
    : pool

  // 已看过的太多时回退到完整池子，避免「换一批」把自己换空
  return sampleRandom(fresh.length >= limit ? fresh : pool, limit, random)
}
