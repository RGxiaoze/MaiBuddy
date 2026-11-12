// ============================================================
// explore — 探索池构建
//
// 数据源：Diving-Fish 投票箱（二选一）的累计结果。
// 设计原则：宽池随机（不让人气榜固化），质量靠难度约束与偏好加权保证。
// ============================================================

import type { Song, ChartDifficulty } from '@/types'
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
  /**
   * 允许已游玩谱面进入池子（仍保留「禁止降级」）。
   * 用于「全都打过了」的兜底：此时排除已玩会让池子永远为空。
   */
  allowPlayed?: boolean
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
  /** 你在这首的当前达成率（仅热身路线提供，用来说明「你已经打得很稳」） */
  currentAch?: number
  /** 该谱拟合定数（仅挑战路线提供，比官标更能代表实际难度） */
  fitDiff?: number
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

/** 「很久没玩」可信判定所需的最少不同游玩日期数 */
export const MIN_DISTINCT_PLAY_DATES = 10

/**
 * 找出「很久没玩」的谱面 key（`songId-levelIndex`）。
 *
 * **当前未接入 UI**：探索页此前用它把 3 个月没玩的谱面放回池子，
 * 但页面文案写的是「都是你没打过的」，测试玩家据此发现列表混着打过的谱。
 * 现在探索严格排除已游玩，本函数保留以便将来做成显式开关。
 *
 * 数据可信度是关键：水鱼 API 不含时间戳，导入后 playDate 全是导入当天；
 * 落雪提供真实的 play_time。若把导入日期当游玩日期，推荐会完全失效，
 * 因此要求成绩里至少有 `minDistinctDates` 个不同的游玩日期才启用。
 *
 * @param months 多久算「很久」（默认 3 个月）
 */
export function buildStaleKeys(
  scores: Array<{ songId: number; levelIndex: number; playDate?: string }>,
  months = 3,
  minDistinctDates = MIN_DISTINCT_PLAY_DATES,
  now = new Date(),
): Set<string> {
  const dates = new Set<string>()
  const byChart = new Map<string, string>()
  for (const s of scores) {
    if (!s.playDate) continue
    dates.add(s.playDate)
    byChart.set(`${s.songId}-${s.levelIndex}`, s.playDate)
  }
  if (dates.size < minDistinctDates) return new Set()

  const cutoff = new Date(now)
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const stale = new Set<string>()
  for (const [key, date] of byChart) {
    if (date < cutoffStr) stale.add(key)
  }
  return stale
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
    allowPlayed,
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
      // 「很久没玩」的谱面允许回到池子；全都打过时由 allowPlayed 整体放开
      if (!allowPlayed && playedKeys.has(key) && !staleKeys?.has(key)) continue
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

// ============================================================
// 按目的分路线
//
// 「探索」对每个人含义不同：想热身、想听歌、想挑战。用成绩推断必然出错
// （顶尖玩家几乎全 AP、新手成绩是别人帮选的），所以交给玩家自己选。
// ============================================================

/** 探索目的 */
export type ExplorePurpose = 'warmup' | 'listen' | 'challenge' | 'random'

/** 路线共用的最小成绩结构（避免 utils 依赖 db 类型） */
export interface RouteScore {
  songId: number
  levelIndex: number
  achievements: number
  fcType?: string | null
}

export interface RouteOptions {
  /** B35 定数众数，热身取舒适区、挑战取上探基准 */
  mode: number
  /** 当前成绩，用于判断已玩与水平 */
  scores: readonly RouteScore[]
  /** 拟合定数查询；缺省时挑战退回官方定数 */
  getFitDiff?: (songId: number, level: string) => number | undefined
  blockedSongIds?: Set<number>
  seenKeys?: Set<string>
  limit?: number
  topPercent?: number
  random?: () => number
  preference?: PreferenceProfile
}

/** 一条路线的候选（已算好口碑与个人数据） */
interface CandidateCtx {
  song: Song
  diff: ChartDifficulty
  key: string
  smoothRate: number
  currentAch?: number
  fitDiff?: number
}

/** 理论值：达成率到顶或达成 AP，重打没有意义 */
function isPerfect(score: RouteScore | undefined): boolean {
  if (!score) return false
  if (score.achievements >= 100.5) return true
  return score.fcType === 'ap' || score.fcType === 'app'
}

/**
 * 三条路线的共同骨架：遍历候选 → 谓词筛选 → 打分 → 排序取池 → 抽样。
 * 各路线只需要提供 `accept` 与 `scoreOf`。
 */
function buildRoute(
  songs: Song[],
  votes: Map<number, VoteStat>,
  opts: RouteOptions,
  accept: (ctx: CandidateCtx) => boolean,
  scoreOf: (ctx: CandidateCtx) => number,
): ExploreItem[] {
  const {
    scores,
    getFitDiff,
    blockedSongIds,
    seenKeys,
    limit = DEFAULT_LIMIT,
    topPercent = DEFAULT_TOP_PERCENT,
    random = Math.random,
    preference,
  } = opts

  const byKey = new Map<string, RouteScore>()
  for (const s of scores) byKey.set(`${s.songId}-${s.levelIndex}`, s)

  const picked = new Map<number, ExploreItem>()

  for (const song of songs) {
    if (blockedSongIds?.has(song.id)) continue

    const stat = votes.get(song.id)
    const smoothRate = stat ? smoothWinRate(stat.upVote, stat.totalVote) : PRIOR_RATE

    const diffs = [
      ...(song.difficulties?.standard ?? []),
      ...(song.difficulties?.dx ?? []),
    ]

    for (const diff of diffs) {
      if (!diff || diff.levelValue <= 0) continue
      if (isChartExcluded(song.id, diff.levelIndex)) continue

      const key = `${song.id}-${diff.levelIndex}`
      const score = byKey.get(key)
      const ctx: CandidateCtx = {
        song,
        diff,
        key,
        smoothRate,
        currentAch: score?.achievements,
        fitDiff: getFitDiff?.(song.id, diff.level),
      }

      if (!accept(ctx)) continue

      let finalScore = scoreOf(ctx)
      if (preference) {
        if (preference.designers.has(normalizeDesignerName(diff.noteDesigner))) finalScore += PREFERENCE_BOOST
        if (song.genre && preference.rareGenres.has(song.genre)) finalScore += PREFERENCE_BOOST
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
        winRate: stat?.winRate ?? PRIOR_RATE,
        totalVote: stat?.totalVote ?? 0,
        smoothRate,
        score: finalScore,
        currentAch: ctx.currentAch,
        fitDiff: ctx.fitDiff,
      }

      const prev = picked.get(song.id)
      if (!prev || candidate.levelIndex > prev.levelIndex) picked.set(song.id, candidate)
    }
  }

  const ranked = [...picked.values()].sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return []

  const poolSize = Math.max(limit, Math.ceil(ranked.length * (topPercent / 100)))
  const pool = ranked.slice(0, poolSize)
  const fresh = seenKeys ? pool.filter(it => !seenKeys.has(`${it.songId}-${it.levelIndex}`)) : pool
  return sampleRandom(fresh.length >= limit ? fresh : pool, limit, random)
}

/** 舒适区下限：与推分页一致，众数 − 1.0 */
const COMFORT_LOWER = 1.0
/** 舒适区上限：众数 + 0.3 */
const COMFORT_UPPER = 0.3

/**
 * 热身：推你打过且定数在舒适区内的谱，成绩越高越优先。
 * 目标是「一上手就能找到感觉」，不是涨分。
 */
export function buildWarmupPool(
  songs: Song[],
  votes: Map<number, VoteStat>,
  opts: RouteOptions,
): ExploreItem[] {
  const lo = opts.mode - COMFORT_LOWER
  const hi = opts.mode + COMFORT_UPPER
  return buildRoute(
    songs, votes, opts,
    (ctx) => ctx.currentAch !== undefined
      && ctx.diff.levelValue >= lo
      && ctx.diff.levelValue <= hi,
    (ctx) => ctx.currentAch ?? 0,
  )
}

/**
 * 听歌：音乐优先。不限定数、不限是否玩过、不排除 AP —— 好歌就是好歌。
 * 排序只看社区口碑（新曲无票时回落到先验 0.5）。
 */
export function buildListenPool(
  songs: Song[],
  votes: Map<number, VoteStat>,
  opts: RouteOptions,
): ExploreItem[] {
  return buildRoute(songs, votes, opts, () => true, (ctx) => ctx.smoothRate)
}

/** 挑战上探的下限（众数 + 1.0）与上限（众数 + 2.0） */
const CHALLENGE_MIN_STEP = 1.0
const CHALLENGE_MAX_STEP = 2.0
/** 「实际难度也超出水平」的拟合定数门槛 */
const CHALLENGE_FIT_MARGIN = 0.5

/**
 * 挑战：官方定数上探，或拟合定数高出当前水平的谱。
 * 只看官标会推出一堆水谱（标称 14.5 实际 13.8），只看拟合会推出标称很低的谱
 * —— 玩家一看定数就不想打。两个条件取并集，排序按实际难度（拟合优先）。
 */
export function buildChallengePool(
  songs: Song[],
  votes: Map<number, VoteStat>,
  opts: RouteOptions,
): ExploreItem[] {
  const { mode, scores } = opts
  const byKey = new Map<string, RouteScore>()
  for (const s of scores) byKey.set(`${s.songId}-${s.levelIndex}`, s)

  return buildRoute(
    songs, votes, opts,
    (ctx) => {
      const bigByOfficial = ctx.diff.levelValue >= mode + CHALLENGE_MIN_STEP
        && ctx.diff.levelValue <= mode + CHALLENGE_MAX_STEP
      const bigByFit = ctx.fitDiff !== undefined
        && ctx.fitDiff > mode + CHALLENGE_FIT_MARGIN
        && ctx.diff.levelValue <= mode + CHALLENGE_MAX_STEP
      if (!bigByOfficial && !bigByFit) return false
      // 已经 AP / 理论值的不算挑战
      if (isPerfect(byKey.get(ctx.key))) return false
      return true
    },
    (ctx) => ctx.fitDiff ?? ctx.diff.levelValue,
  )
}

/** 按目的分发。`random` 保持现有行为不变。 */
export function buildPoolByPurpose(
  purpose: ExplorePurpose,
  songs: Song[],
  playedKeys: Set<string>,
  votes: Map<number, VoteStat>,
  opts: RouteOptions & ExploreOptions,
): ExploreItem[] {
  switch (purpose) {
    case 'warmup':
      return buildWarmupPool(songs, votes, opts)
    case 'listen':
      return buildListenPool(songs, votes, opts)
    case 'challenge':
      return buildChallengePool(songs, votes, opts)
    case 'random':
    default:
      return buildExplorePool(songs, playedKeys, votes, opts)
  }
}
