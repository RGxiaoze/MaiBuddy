// ============================================================
// Push suggestions v2 — scan song DB instead of player scores
// Three-target gain calculation per suggestion
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import type { ChartStatSummary } from '@/services/statsService'
import { type B50Result } from './b50'
import { computeRating } from './rating'
import { classifyDifficulty, achievableTargetFor, typicalAchievement, averageAtLevel, TYPICAL_STRETCH, TYPICAL_STRETCH_B15, type LevelSample } from './difficultyTier'
import { isChartExcluded } from '@/data/excluded-charts'
import { predictLevelToAch } from './regression'
import {
  MAX_ACHIEVEMENTS, UTAGE_ID_THRESHOLD, B35_FALLBACK_LEVEL, B35_MODE_MIN_COUNT,
  SKIP_LOW_LEVEL, SKIP_LOW_ACH,
  SSSP_SORT_WEIGHT, SUGGESTION_SORT_TOLERANCE,
  B15_SIZE, MAX_B15_SUGGESTIONS, MAX_B35_SUGGESTIONS,
  RECOMMEND_CAP_ABOVE_MODE, RECOMMEND_CAP_SIMPLE_ABOVE_MODE, SIMPLE_FIT_DIFF_GAP, SIMPLE_TARGET_FLOOR,
  EARLY_VERSION_MAX, PREDICT_MIN_ACH,
} from '@/config/algorithms'

// ---- Types ----

/** Three target achievement levels */
export const TARGET_LEVELS = [99, 100, 100.5] as const

/** A single target's gain info */
export interface PushGain {
  targetAch: number
  targetRating: number
  ratingGain: number
}

/** A push suggestion with three columns of gains + optional AP column */
export interface PushSuggestion {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  /** Actual achievement (precise) or predicted (estimated) */
  currentAchievements: number
  currentRating: number
  pool: 'b35' | 'b15'
  difficulty: 'easy' | 'medium' | 'hard'
  /**
   * 该谱拟合定数比官标低多少（正 = 实际比标称容易，即「水分」）。
   * 与"你的当前评级"不同，它描述的是谱面本身，对已 SSS 的谱仍有参考价值。
   */
  waterLevel?: number
  /**
   * 玩家在「该谱实际定数」同档上的平均达成率（窄口径，见 averageAtLevel）。
   * 用拟合定数（若比官标低）来取，回答「以你这一档的平均表现，
   * 够不够吃到这首的水分」。无全量成绩或样本不足时不提供。
   */
  yourBandAvg?: number
  /**
   * 拉伸档位：1 = 核心推荐（默认拉伸）；2/3 = 核心不够时逐步放宽目标补出来的
   * 备选，由调用方在列表末尾单独展示，不与核心推荐混排。
   */
  tier?: 1 | 2 | 3
  sssPlusRate: number
  /** 全服 AP 率（来自 chart_stats.fc_dist），用于 AP 推分排序 */
  apRate: number
  /** Three gains: [SS+(99%), SSS(100%), SSS+(100.5%)] */
  gains: [PushGain, PushGain, PushGain]
  /** Optional AP gain — only present when SSS+ gain is already 0 */
  apGain?: PushGain
  /** Precision: 'precise' when player achievement is known; 'estimated' otherwise */
  precision: 'precise' | 'estimated'
  /** 全服样本是否可信；false 表示样本偏斜（隐藏区域等），排序时靠后 */
  reliable?: boolean
}

export interface PushSuggestionsResult {
  suggestions: PushSuggestion[]
  /** Non-empty for B50-only data (no full scores imported) */
  precisionNote?: string
}

// ---- Internal helpers ----

function computeLevelMode(levels: number[], precision: number = 0.1): number {
  if (levels.length === 0) return 0
  const freq = new Map<number, number>()
  for (const lv of levels) {
    const rounded = Math.round(lv / precision) * precision
    freq.set(rounded, (freq.get(rounded) || 0) + 1)
  }
  let mode = 0
  let maxFreq = 0
  for (const [lv, f] of freq) {
    if (f > maxFreq || (f === maxFreq && lv > mode)) {
      maxFreq = f
      mode = lv
    }
  }
  return mode
}

/**
 * 推荐定数上限：以 B35 众数（稳定水平）为锚点。
 *
 * 不用 B1 —— 一条侥幸打出的高分不该把整张推荐表拉到那个强度。
 * 实测有玩家 B1 在 14+ 而 B35 的 24/35 落在 13+，锚 B1 会满屏 14.5+。
 * 返回 null 表示没有 B50，调用方应退回旧规则。
 */
export function computeRecommendCaps(b50: B50Result): { capBase: number | null; capSimple: number | null } {
  const levels = b50.best35.length > 0
    ? b50.best35.map(e => e.levelValue)
    : b50.best15.map(e => e.levelValue)
  if (levels.length === 0) return { capBase: null, capSimple: null }

  // 样本偏少时众数不稳定（5 条里 2 条就能成众数），退回中位数
  const anchor = levels.length >= B35_MODE_MIN_COUNT
    ? computeLevelMode(levels)
    : median(levels)

  // 一位小数取整，避免 14.0 + 0.3 = 14.300000000000001 把 14.3 挡掉
  const round1 = (v: number) => Math.round(v * 10) / 10
  return {
    capBase: round1(anchor + RECOMMEND_CAP_ABOVE_MODE),
    capSimple: round1(anchor + RECOMMEND_CAP_SIMPLE_ABOVE_MODE),
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** 「特简单」：拟合定数比官标低至少 SIMPLE_FIT_DIFF_GAP，且拟合定数已知（>0） */
export function isSimpleChart(levelValue: number, fitDiff?: number): boolean {
  if (!fitDiff || fitDiff <= 0) return false
  return Math.round((levelValue - fitDiff) * 10) / 10 >= SIMPLE_FIT_DIFF_GAP
}

const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 }

/** 单池内的推荐排序：非 AP 按 SSS+ 收益降序，AP 条目统一排在后 */
function compareSuggestion(a: PushSuggestion, b: PushSuggestion): number {
  const aHasAP = !!(a.apGain && a.apGain.ratingGain > 0)
  const bHasAP = !!(b.apGain && b.apGain.ratingGain > 0)

  if (aHasAP && bHasAP) {
    if (a.apRate !== b.apRate) return b.apRate - a.apRate
    if (a.levelValue !== b.levelValue) return a.levelValue - b.levelValue
    return DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]
  }
  if (aHasAP !== bHasAP) return aHasAP ? 1 : -1

  const aScore = a.gains[2].ratingGain * (1 + a.sssPlusRate * SSSP_SORT_WEIGHT)
  const bScore = b.gains[2].ratingGain * (1 + b.sssPlusRate * SSSP_SORT_WEIGHT)
  if (Math.abs(bScore - aScore) < SUGGESTION_SORT_TOLERANCE) {
    // 同收益时：样本偏斜（隐藏区域等）的谱靠后，再按定数降序
    const aUnreliable = a.reliable === false ? 1 : 0
    const bUnreliable = b.reliable === false ? 1 : 0
    if (aUnreliable !== bUnreliable) return aUnreliable - bUnreliable
    return b.levelValue - a.levelValue
  }
  return bScore - aScore
}

/**
 * 按定数分档的加权配额。
 *
 * 纯收益排序会让高定数谱垄断列表（它们的 ratingGain 天然更大）。
 * 但只是「每档平均取」也不够 —— 推荐的主流应落在玩家舒适区附近：
 * B35 里 24/35 是 13+ 的人，该看到 13.3~13.4 的鸟与 13.0 以下的鸟加，
 * 而不是一堆贴着上限的 13.5。
 *
 * 权重以 B35 众数为原点，定数越高名额越少；低于舒适区的不受惩罚
 * （「低定数 + 更高达成率」同样是有效路线）。每档配额是硬上限，
 * 候选不够时宁可少给，也不拿上限档凑数。
 */
export function applyLevelQuota(pool: PushSuggestion[], max: number, mode: number): PushSuggestion[] {
  const byLevel = new Map<number, PushSuggestion[]>()
  for (const s of pool) {
    const key = Math.round(s.levelValue * 10) / 10
    const list = byLevel.get(key)
    if (list) list.push(s)
    else byLevel.set(key, [s])
  }
  for (const list of byLevel.values()) list.sort(compareSuggestion)

  const levels = [...byLevel.keys()].sort((a, b) => a - b)
  const weights = new Map<number, number>()
  let totalWeight = 0
  for (const lv of levels) {
    const w = quotaWeight(lv - mode)
    if (w <= 0) continue
    weights.set(lv, w)
    totalWeight += w
  }

  // 全部落在上限之外（候选通常已被 capBase 过滤，这里只是兜底）
  if (totalWeight === 0) {
    return pool.slice().sort(compareSuggestion).slice(0, max)
  }

  const out: PushSuggestion[] = []
  for (const lv of levels) {
    const w = weights.get(lv)
    if (w === undefined) continue
    // 至少给 1 条，避免整档被四舍五入抹掉
    const quota = Math.max(1, Math.round(max * w / totalWeight))
    out.push(...byLevel.get(lv)!.slice(0, quota))
  }

  // 定数升序：定数更高的自然靠后
  out.sort((a, b) => a.levelValue - b.levelValue || compareSuggestion(a, b))
  return out.slice(0, max)
}

/**
 * 分档权重：`offset` = 该档定数 − 舒适区众数。
 * 0.05 的容差用于吸收 13.3 − 13.2 这类浮点尾数。
 */
function quotaWeight(offset: number): number {
  if (offset <= 0.05) return 1.0
  if (offset <= 0.15) return 0.8
  if (offset <= 0.25) return 0.5
  if (offset <= 0.35) return 0.25
  return 0
}

function makeSuggestion(
  songId: number, songTitle: string,
  levelIndex: number, level: string, levelValue: number,
  currentAch: number, currentRating: number,
  pool: 'b35' | 'b15',
  difficulty: 'easy' | 'medium' | 'hard',
  sssPlusRate: number,
  apRate: number,
  precision: 'precise' | 'estimated',
  floorRating: number,
  targetLevels: readonly number[],
  /** 可达成的目标达成率，由调用方用 achievableTargetFor 算好 */
  achievableTarget: number,
  targetCeiling?: number,
): PushSuggestion {
  const ceiling = Math.min(achievableTarget, targetCeiling ?? MAX_ACHIEVEMENTS)
  // 基准取「池子地板」与「当前成绩」的较高者。
  // 只跟地板比会漏掉一种情况：本地成绩已经打上去了，但 B50 还是旧快照
  // （在线查分与本地成绩不同步），于是「推到 100.0%」仍被算成有收益，
  // 而玩家当前已经是 100.5%。
  const baseline = Math.max(floorRating, currentRating)
  const gains: PushGain[] = targetLevels.map((targetAch) => {
    const cappedTarget = Math.min(ceiling, targetAch)
    const targetRating = computeRating(levelValue, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
    // targetAch 存「实际可达成的目标」（可能被现实目标截断），
    // 否则 UI 会显示「推到 SSS+」却按 SSS 的收益计算，文案与数字对不上
    return { targetAch: Math.min(cappedTarget, MAX_ACHIEVEMENTS), targetRating, ratingGain: Math.max(0, targetRating - baseline) }
  })

  // AP gain: only when SSS+ gain is already 0 (no more rating from achievement)
  let apGain: PushGain | undefined
  if (gains[2].ratingGain === 0) {
    const cappedTarget = Math.min(ceiling, MAX_ACHIEVEMENTS)
    const apRating = computeRating(levelValue, cappedTarget, 'ap')
    const apGainVal = Math.max(0, apRating - baseline)
    if (apGainVal > 0) {
      apGain = { targetAch: MAX_ACHIEVEMENTS, targetRating: apRating, ratingGain: apGainVal }
    }
  }

  return {
    songId, songTitle, levelIndex, level, levelValue,
    currentAchievements: currentAch,
    currentRating,
    pool,
    difficulty,
    sssPlusRate,
    apRate,
    gains: gains as [PushGain, PushGain, PushGain],
    apGain,
    precision,
  }
}

// ---- Main export ----

/**
 * Generate push suggestions.
 *
 * Scans the full song database for charts in the player's stretch zone
 * (mode+0.1 to mode+0.5), computes three-target gains, and marks precision.
 *
 * @param currentB50 - B50 data (from local compute or Diving-Fish query)
 * @param songMap - full song database Map<songId, Song>
 * @param options.allScores - optional: extends precise layer beyond B50
 * @param options.getStats - optional: chart stats for difficulty classification
 * @returns { suggestions, precisionNote }
 */
export function computePushSuggestions(
  currentB50: B50Result,
  songMap: Map<number, Song>,
  options?: {
    allScores?: ScoreRecord[]
    getStats?: (songId: number, level: string) => ChartStatSummary | undefined
    /**
     * 拉伸倍率：1 = 默认（B35 0.5 / B15 0.3）。
     * 核心推荐不够时，调用方会依次用 1.6、2.0 再算一轮补足，
     * 结果标记为 tier 2 / 3 放在列表末尾。
     */
    stretchScale?: number
  },
): PushSuggestionsResult {
  const allScores = options?.allScores
  const getStats = options?.getStats
  const stretchScale = options?.stretchScale ?? 1

  if (currentB50.best35.length === 0 && currentB50.best15.length === 0) {
    return { suggestions: [] }
  }

  // 1. B50 floors
  const floor35 = currentB50.best35.length > 0
    ? currentB50.best35[currentB50.best35.length - 1].dxRating : 0
  const floor15 = currentB50.best15.length > 0
    ? currentB50.best15[currentB50.best15.length - 1].dxRating : 0

  // 2. Build inB50 + floorKeys
  const inB50 = new Set<string>()
  const floorKeys = new Set<string>()
  if (currentB50.best35.length > 0) {
    floorKeys.add(`${currentB50.best35[currentB50.best35.length - 1].songId}-${currentB50.best35[currentB50.best35.length - 1].levelIndex}`)
  }
  if (currentB50.best15.length > 0) {
    floorKeys.add(`${currentB50.best15[currentB50.best15.length - 1].songId}-${currentB50.best15[currentB50.best15.length - 1].levelIndex}`)
  }
  for (const e of currentB50.best35) inB50.add(`${e.songId}-${e.levelIndex}`)
  for (const e of currentB50.best15) inB50.add(`${e.songId}-${e.levelIndex}`)

  // 3. Regression: predict achievement from B50 level values
  const b50Scores = [
    ...currentB50.best35.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
    ...currentB50.best15.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
  ]
  // 方案 C：用玩家自己在该定数段的典型成绩定目标（带谱面键，便于排除自身）
  const b50Samples: LevelSample[] = [
    ...currentB50.best35.map(e => ({ levelValue: e.levelValue, achievements: e.achievements, key: `${e.songId}-${e.levelIndex}` })),
    ...currentB50.best15.map(e => ({ levelValue: e.levelValue, achievements: e.achievements, key: `${e.songId}-${e.levelIndex}` })),
  ]
  const predictFn = predictLevelToAch(b50Scores)

  // 全量成绩样本（含没进 B50 的），用于「同定数中位数」预测。
  // 线性回归只用 50 个高分点，对偏科玩家会系统性高估。
  // 低于 PREDICT_MIN_ACH 的记录是初见/试玩，不代表能力，不能拉低预测。
  const allSamples: LevelSample[] = allScores
    ? allScores
        .filter(s => s.achievements >= PREDICT_MIN_ACH)
        .map(s => ({ levelValue: s.levelValue, achievements: s.achievements, key: `${s.songId}-${s.levelIndex}` }))
    : []

  /**
   * 预测玩家在某定数能打到的达成率。
   *
   * 回退顺序：全量成绩的同定数中位数 → B50 的同定数中位数 → 线性回归。
   * 前两级要求同一定数 ±0.3 内至少 5 条成绩，样本不够时宁可退回回归，
   * 也不拿一两条成绩当结论。
   */
  const predictAch = (lv: number, excludeKey?: string): number => {
    const fromAll = typicalAchievement(lv, allSamples, excludeKey)
    if (fromAll !== null) return fromAll
    const fromB50 = typicalAchievement(lv, b50Samples, excludeKey)
    if (fromB50 !== null) return fromB50
    return predictFn(lv)
  }

  // 4. Build precise layer: B50 entries + all available scores
  const preciseScores = new Map<string, number>() // key → achievements
  for (const e of currentB50.best35) {
    preciseScores.set(`${e.songId}-${e.levelIndex}`, e.achievements)
  }
  for (const e of currentB50.best15) {
    preciseScores.set(`${e.songId}-${e.levelIndex}`, e.achievements)
  }
  if (allScores) {
    for (const s of allScores) {
      const key = `${s.songId}-${s.levelIndex}`
      if (inB50.has(key)) continue
      const existing = preciseScores.get(key)
      if (existing === undefined || s.achievements > existing) {
        preciseScores.set(key, s.achievements)
      }
    }
  }

  // 5. Compute mode and stretch zone
  const b35Levels = currentB50.best35.map(e => e.levelValue)
  const mode = b35Levels.length >= B35_MODE_MIN_COUNT
    ? computeLevelMode(b35Levels)
    : (b35Levels.length > 0 ? b35Levels.reduce((s, l) => s + l, 0) / b35Levels.length : B35_FALLBACK_LEVEL)
  // Upper bound: 以 B35 众数（稳定水平）为锚点，见 computeRecommendCaps。
  const { capBase, capSimple } = computeRecommendCaps(currentB50)

  // 无 B50 时退回旧规则，保证新用户仍有建议
  const STRETCH_UPPER_B35 = capBase ?? (mode > 14 ? mode + 0.3 : (mode > 0 ? mode + 0.5 : B35_FALLBACK_LEVEL))
  const STRETCH_UPPER_B15 = capBase ?? (mode > 0 ? mode + 1.0 : B35_FALLBACK_LEVEL)
  // Unified lower bound: mode - 1.0 (covers both B35 optimization and B15 floor replacement)
  const STRETCH_LOWER = mode > 0 ? Math.max(0, mode - 1.0) : 0
  // Progressive widening: when a pool has few entries, widen its lower bound to capture more candidates.
  // 但**最多只放宽到 mode − 1.0**：池子是空的，不等于该从 1 级开始找。
  // 此前空池会把下限设成 0，导致 B15 一条都没有的玩家被推 7 级新曲。
  const b15NotFull = currentB50.best15.length < B15_SIZE
  const b35NotFull = currentB50.best35.length < 35
  let B15_STRETCH_LOWER = STRETCH_LOWER
  let B35_STRETCH_LOWER = STRETCH_LOWER
  if (b15NotFull && currentB50.best15.length >= 5) {
    B15_STRETCH_LOWER = Math.max(0, mode - 0.5)
  }
  if (b35NotFull && currentB50.best35.length >= 5) {
    B35_STRETCH_LOWER = Math.max(0, mode - 0.5)
  }

  // 6. Scan song DB for candidates
  const suggestions: PushSuggestion[] = []
  const seenChart = new Set<string>()

  for (const song of songMap.values()) {
    // Scan both DX and standard charts to cover old-version (B35) and new-version (B15) pools
    const allDiffs = [...song.difficulties.dx, ...song.difficulties.standard]
    for (const diff of allDiffs) {
      const key = `${song.id}-${diff.levelIndex}`
      // Skip utage
      if (song.id >= UTAGE_ID_THRESHOLD) continue
      if (seenChart.has(key)) continue
      seenChart.add(key)

      const lv = diff.levelValue
      if (lv <= 0) continue
      const isNew = song.isNew
      /**
       * 早期曲（GreeN PLUS 及以前）的拟合异常率 10.4%，是后期 3.2% 的 3.3 倍。
       * 原因是早期制谱思路不规范、配置少见不规律，不是定数调整。
       * `version === 0` 表示版本未知，按正常处理。
       */
      const isEarlyChart = song.version > 0 && song.version <= EARLY_VERSION_MAX
      // B15（新版本）池子小、样本偏斜，目标拉伸更保守。
      // 乘以 stretchScale 得到分档：1 = 默认（B35 0.5 / B15 0.3），
      // 调用方在核心推荐不够时会用 1.6、2.0 再各算一轮补足。
      const stretch = (isNew ? TYPICAL_STRETCH_B15 : TYPICAL_STRETCH) * stretchScale

      // Filter: in stretch zone OR already in B50
      // 破顶候选（B1+0.2 ~ B1+0.4）先放行，稍后按拟合定数判定是否「特简单」
      if (inB50.has(key)) {
      } else {
        const minZ = isNew ? B15_STRETCH_LOWER : B35_STRETCH_LOWER
        const maxZ = isNew ? STRETCH_UPPER_B15 : STRETCH_UPPER_B35
        if (lv < minZ || lv > (capSimple ?? maxZ)) continue
      }

      // Determine precision + current achievements
      let currentAch: number
      let precision: 'precise' | 'estimated'
      const preciseAch = preciseScores.get(key)

      if (preciseAch !== undefined) {
        // B50 entries: filter low-ach noise for non-floor non-B50 entries
        if (!inB50.has(key) && lv < SKIP_LOW_LEVEL && preciseAch < SKIP_LOW_ACH) continue
        currentAch = preciseAch
        precision = 'precise'
      } else {
        currentAch = predictAch(lv, key)
        precision = 'estimated'
      }

      const currentRating = computeRating(lv, currentAch)
      if (currentRating <= 0) continue

      // 数据源异常、暂不推荐的谱面（见 excluded-charts）
      if (isChartExcluded(song.id, diff.levelIndex)) continue

      const stats = getStats?.(song.id, diff.level)

      // 「该谱实际定数」：有拟合用拟合，否则用官标。
      // 破顶判定、目标计算、标签都必须基于它 —— 否则「官标 13.9、拟合只有 13.5」
      // 的水分谱会被当成 13.9 处理：既算出「你 13.9 打不动」的低目标，
      // 又被封顶在鸟，拿不到本该到手的鸟加。
      const effectiveLevel = stats?.fitDiff && stats.fitDiff > 0 ? stats.fitDiff : lv

      // 破顶判定：**官标**超过上限（众数 + 0.3）的候选，只允许「特简单」的谱
      // （拟合定数比官标低 ≥0.3）。这道保护按官标判断 —— 玩家看到的是官标，
      // 官标都超限的谱必须先证明自己确实简单。
      let targetCeiling: number | undefined
      if (!inB50.has(key) && capBase !== null && lv > capBase) {
        // 破顶依赖 fit_diff 判断「是否特简单」。样本不可信时 fit_diff 本身偏斜，
        // 不能据此越级 —— 这类谱仍可进普通候选（由上面的 capSimple 筛选），
        // 只是不参与破顶。此前对不可信样本无条件放行，导致 14.38 的谱被推到鸟。
        if (!isSimpleChart(lv, stats?.fitDiff)) continue
        // 封顶与否看**实际定数**：拟合后已落回上限内的（如官标 13.9、拟合 13.5），
        // 对玩家来说就是一首 13.5 的歌，不该被压到鸟、拿不到本该到手的鸟加。
        if (effectiveLevel > capBase) targetCeiling = SIMPLE_TARGET_FLOOR
      }

      // 目标达成率：优先按玩家全量成绩的同档中位数，见 achievableTargetFor
      const achievable = achievableTargetFor(effectiveLevel, mode, allSamples, b50Samples, key, stretch)

      if (!inB50.has(key)) {
        // Chart NOT in B50 — suggest for its version's pool
        const pool = isNew ? 'b15' as const : 'b35' as const
        const floorRating = pool === 'b15' ? floor15 : floor35

        const cand = makeSuggestion(
          song.id, song.title, diff.levelIndex, diff.level, lv,
          currentAch, currentRating, pool,
          classifyDifficulty(
            { levelValue: lv, achievements: currentAch } as ScoreRecord,
            stats,
            achievable,
          ),
          stats?.sssPlusRate ?? 0,
          stats?.apRate ?? 0,
          precision,
          floorRating,
          TARGET_LEVELS,
          achievable,
          targetCeiling,
        )
        cand.reliable = stats?.reliable !== false && !isEarlyChart
        // 水分：拟合法比官标低多少。只对「更低」有意义——拟合更高的谱没有水分可吃
        if (stats?.fitDiff && stats.fitDiff > 0) {
          const water = Math.round((lv - stats.fitDiff) * 10) / 10
          if (water > 0) cand.waterLevel = water
        }
        // 「该档平均」只对**没打过**的谱有意义：它是对这首的预期。
        // 已经打出成绩的谱，卡片上显示的是真实成绩，再挂个全档平均只会让人困惑
        // （实测有谱打到 100%+，而同档平均只有 96%，两个数字互相打脸）。
        cand.yourBandAvg = precision === 'estimated'
          ? (averageAtLevel(effectiveLevel, allSamples, key) ?? undefined)
          : undefined
        // Only add if at least one gain > 0 (or AP gain exists)
        if (cand.gains.some(g => g.ratingGain > 0) || (cand.apGain && cand.apGain.ratingGain > 0)) {
          suggestions.push(cand)
        }
      } else if (inB50.has(key)) {
        // 已在 B50 池内（地板或非地板都算）：把当前成绩往上推，总分直接增加。
        // 此前只处理地板，导致「池内但非地板」的条目（如 B15 第 5 位还差一点 SSS+）
        // 既不进新候选分支、也不进地板分支，被完全跳过。
        const pool = currentB50.best35.some(e => `${e.songId}-${e.levelIndex}` === key) ? 'b35' as const : 'b15' as const

        // Calculate gains against current rating (improving this score)
        const realistic = achievable
        // 已有成绩已超过「现实目标」时，说明模型低估了玩家在此定数的水平，
        // 不再把目标向下截断——否则「100.24% 打到 100.0 目标」会被判为无提升空间。
        const capFor = (targetAch: number) =>
          currentAch >= realistic ? targetAch : Math.min(realistic, targetAch)
        const lifts: PushGain[] = TARGET_LEVELS.map((targetAch) => {
          const cappedTarget = capFor(targetAch)
          const targetRating = computeRating(lv, Math.min(cappedTarget, MAX_ACHIEVEMENTS))
          const ratingGain = Math.max(0, targetRating - currentRating)
          // 同上：存实际可达成的目标，保证文案与收益一致
          return { targetAch: Math.min(cappedTarget, MAX_ACHIEVEMENTS), targetRating, ratingGain }
        })

        // AP gain for floor entry — compute before filter check
        let floorApGain: PushGain | undefined
        if (lifts[2].ratingGain === 0) {
          const cappedTarget = Math.min(achievable, MAX_ACHIEVEMENTS)
          const apRatingFloor = computeRating(lv, cappedTarget, 'ap')
          const apGainFloor = Math.max(0, apRatingFloor - currentRating)
          if (apGainFloor > 0) {
            floorApGain = { targetAch: MAX_ACHIEVEMENTS, targetRating: apRatingFloor, ratingGain: apGainFloor }
          }
        }

        // 难度按「收益最大的那一档」衡量玩家还差多远，
        // 否则卡片写着 +19 分、标签却是「轻松」
        const bestLift = lifts.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
        const chosenTarget = floorApGain && floorApGain.ratingGain > bestLift.ratingGain
          ? floorApGain.targetAch
          : bestLift.targetAch

        // Include if any gain > 0 or AP gain exists (SSS+ already achievable)
        if (lifts.some(g => g.ratingGain > 0) || (floorApGain && floorApGain.ratingGain > 0)) {
          suggestions.push({
            songId: song.id, songTitle: song.title,
            levelIndex: diff.levelIndex, level: diff.level, levelValue: lv,
            currentAchievements: currentAch,
            currentRating,
            pool,
            difficulty: classifyDifficulty({ levelValue: lv, achievements: currentAch } as ScoreRecord, stats, chosenTarget),
            waterLevel: stats?.fitDiff && stats.fitDiff > 0 && lv - stats.fitDiff > 0
              ? Math.round((lv - stats.fitDiff) * 10) / 10
              : undefined,
            // 池内条目必然已有成绩，不挂「该档平均」（见候选分支的说明）
            sssPlusRate: stats?.sssPlusRate ?? 0,
            apRate: stats?.apRate ?? 0,
            gains: lifts as [PushGain, PushGain, PushGain],
            apGain: floorApGain,
            precision,
            reliable: stats?.reliable !== false && !isEarlyChart,
          })
        }
      }
    }
  }

  // 7. 按定数分档配额：低定数（靠近地板）优先，避免高收益的高定数谱垄断列表
  const b35Pool = applyLevelQuota(suggestions.filter((s) => s.pool === 'b35'), MAX_B35_SUGGESTIONS, mode)
  const b15Pool = applyLevelQuota(suggestions.filter((s) => s.pool === 'b15'), MAX_B15_SUGGESTIONS, mode)
  suggestions.length = 0
  suggestions.push(...b35Pool, ...b15Pool)

  // 8. Precision note
  const hasEstimated = suggestions.some(s => s.precision === 'estimated')
  const precisionNote = !allScores && hasEstimated
    ? '推分建议基于 B50 数据 + 社区统计生成（未导入完整成绩）。导入完整成绩可获得更精准的个人化推荐。'
    : undefined

  return { suggestions, precisionNote }
}
