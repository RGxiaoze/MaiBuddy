// ============================================================
// explore — 探索池构建
//
// 数据源：Diving-Fish 投票箱（二选一）的累计结果，
// 反映「社区真实偏好」而非难度推断。
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
  /** 难度上限（含） */
  maxLevel?: number
  /** 返回条数上限 */
  limit?: number
}

export interface ExploreItem {
  songId: number
  title: string
  levelIndex: number
  level: string
  levelValue: number
  noteDesigner: string
  /** 原始胜率（展示用，真实值） */
  winRate: number
  totalVote: number
  /** 平滑后胜率（排序用） */
  smoothRate: number
}

/** 票数门槛：实测 1294 首中 1265 首达到 30 票 */
export const DEFAULT_MIN_VOTES = 30
export const DEFAULT_LIMIT = 20

/** 平滑强度：相当于给每首歌 20 票的「五五开」先验 */
const PRIOR_WEIGHT = 20
const PRIOR_RATE = 0.5

/**
 * 贝叶斯平滑胜率。
 *
 * 原始胜率在低票数时噪声极大（`Technicians High` 5 票 80% 会霸榜），
 * 这里向 0.5 收缩：票数越少收缩越强，票数足够时基本等于原始值。
 */
export function smoothWinRate(upVote: number, totalVote: number): number {
  if (totalVote <= 0) return PRIOR_RATE
  return (upVote + PRIOR_RATE * PRIOR_WEIGHT) / (totalVote + PRIOR_WEIGHT)
}

/**
 * 构建探索候选池。
 *
 * 规则：排除已游玩 → 排除无投票数据/票数不足 → 难度区间过滤 →
 * 按平滑胜率降序 → **每首歌只保留一个难度** → 截断。
 *
 * 胜率是「歌曲」级别的数据，同一首歌的多个难度胜率完全相同，
 * 若不去重会出现「同一首歌的 4 个难度占满前四名」。
 * 保留难度索引最大的那个（Master / Re:Master 优先），最具代表性。
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
  } = options

  /** songId → 该歌当前选中的条目（保留 levelIndex 最大的） */
  const picked = new Map<number, ExploreItem>()

  for (const song of songs) {
    const stat = votes.get(song.id)
    if (!stat || stat.totalVote < minVotes) continue

    const diffs = [
      ...(song.difficulties?.standard ?? []),
      ...(song.difficulties?.dx ?? []),
    ]

    for (const diff of diffs) {
      if (!diff || diff.levelValue <= 0) continue
      if (playedKeys.has(`${song.id}-${diff.levelIndex}`)) continue
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
      if (!prev || candidate.levelIndex > prev.levelIndex) {
        picked.set(song.id, candidate)
      }
    }
  }

  const items = [...picked.values()]
  items.sort((a, b) => b.smoothRate - a.smoothRate)
  return items.slice(0, limit)
}
