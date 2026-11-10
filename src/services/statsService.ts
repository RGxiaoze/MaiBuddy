// ============================================================
// Chart stats service — cache + precompute + query
// ============================================================

import { fetchChartStats, type ChartStatsResponse } from './divingFishApi'
import { getCachedStats, setCachedStats } from '@/db/database'
import { isReliableCount } from '@/utils/sampleReliability'
import { getInstallYear, loadInstallYear } from './installYearService'
import { FIT_DIFF_YEAR_CORRECTION, SSS_FIT_YEAR_CORRECTION } from '@/config/algorithms'

// ---- Precomputed data structures ----

export interface ChartStatSummary {
  /** 全服平均达成率 */
  avg: number
  /** 达成率标准差 */
  stdDev: number
  /** SSS 率（dist[12] / total — 纯 SSS 不含 SSS+） */
  sssRate: number
  /** SSS+ 率（dist[13] / total） */
  sssPlusRate: number
  /** 累计 SSS 及以上率（(dist[12] + dist[13]) / total）—— 达到 SSS 的宽松口径 */
  cumSssRate: number
  /** AP 率（(fc_dist[3] + fc_dist[4]) / total_fc） */
  apRate: number
  /** 全服平均达成率 - 同难度平均达成率（正 = 比同定数容易） */
  diffFromLevelAvg: number
  /** 拟合定数（已按实装年校正） */
  fitDiff: number
  /** 校正前的原始拟合定数，供详情页并列展示 */
  fitDiffRaw?: number
  /** SSS 口径拟合定数（已按实装年校正）；仅 ≥12 级且样本足够时提供 */
  sssFitDiff?: number
  /** 校正前的 SSS 口径拟合定数 */
  sssFitDiffRaw?: number
  /** 该谱面的国服实装年；未知时为空 */
  installYear?: number | null
  /** 样本量（打过该谱的人数）；缺省表示数据源未提供 */
  sampleCount?: number
  /**
   * 样本是否可信。
   * 隐藏/联动区域的谱只有解锁玩家会打，样本偏斜 → fit_diff 系统性偏低，
   * 这类谱不应用来判定「简单」或参与排序加权。
   * `undefined` 表示未知（旧缓存/测试夹具），按可信处理。
   */
  reliable?: boolean
}

export interface LevelAvg {
  /** 该难度等级全服平均达成率 */
  achievements: number
  /** 该难度 SSS 率（人口加权） */
  sssRate: number
  /** 该难度 SSS+ 率（人口加权） */
  sssPlusRate: number
  /** 该难度 AP 率（人口加权） */
  apRate: number
}

export interface FitDiffAvg {
  /** 该定数覆盖的谱面数 */
  chartCount: number
  /** SSS 率（人口加权） */
  sssRate: number
  /** SSS+ 率（人口加权） */
  sssPlusRate: number
  /** 累计 SSS 及以上率（人口加权） */
  cumSssRate: number
  /** AP 率（人口加权） */
  apRate: number
}

/** std_dev 分级阈值 — 阈值对齐 Diving-Fish Prober 官方前端；
 *  desc 写成直接结论，σ 数值在界面上只作为次要信息展示 */
export const STDEV_LEVELS = [
  { max: 3.6, label: '正常', color: '#22c55e', desc: '这个谱面大家的成绩很集中，横向对比可信' },
  { max: 4.2, label: '较高', color: '#eab308', desc: '成绩略有分散，整体参考价值仍然可靠' },
  { max: 4.8, label: '高',   color: '#f97316', desc: '成绩分散偏大，可能受个人差或越级影响' },
  { max: Infinity, label: '极高', color: '#ef4444', desc: '成绩非常分散，数据仅供参考' },
] as const

// ---- SSS 口径拟合定数 ----

/**
 * SSS 口径拟合定数的斜率。
 *
 * 来源：2026-11-09 用全量 chart_stats（5561 个样本谱面）试算 —— 以「累计 SSS
 * 及以上率」(dist[12]+dist[13]) 相对同官方定数档的偏差，对社区 fit_diff 偏差
 * 做线性回归，斜率 -1.132（R² 0.376）。
 *
 * 局限：单指标解释力有限。分段验证中 12~13.9 区间方向一致率 78%；
 * 低于 12 的谱面 SSS 率接近饱和（部分谱面 60%~90% 玩家都能 SSS），无区分度；
 * 15 级样本太少。因此只在 12 级以上展示。
 */
export const SSS_FIT_SLOPE = -1.132

/** 推算 SSS 定数所需的最低官方定数 */
export const SSS_FIT_MIN_LEVEL = 12

/**
 * 推算「SSS 口径拟合定数」。
 *
 * 社区 fit_diff 主要由 SSS+ 率驱动（相关 -0.81），几乎不反映 SSS 难度
 * （与本谱 SSS 率相关仅 -0.16）。这里改用「达到 SSS 及以上」的比例相对
 * 同官方定数档的偏差来估算。
 *
 * @returns SSS 口径定数；定数低于 12 或样本不足时返回 null
 */
export function computeSssFitDiff(
  chartStat: ChartStatSummary | undefined,
  officialLevelAvg: FitDiffAvg | undefined,
  officialLevelValue: number,
): number | null {
  if (!chartStat || !officialLevelAvg) return null
  if (officialLevelValue < SSS_FIT_MIN_LEVEL) return null
  if (officialLevelAvg.chartCount < 3) return null
  const deviation = chartStat.cumSssRate - officialLevelAvg.cumSssRate
  const raw = officialLevelValue + SSS_FIT_SLOPE * deviation
  // SSS 口径同样存在新曲偏移，按实装年校正
  const year = chartStat.installYear ?? null
  const correction = year !== null ? (SSS_FIT_YEAR_CORRECTION[year] ?? 0) : 0
  return raw + correction
}

// ---- 同定数档内排名 ----

export type RateMetric = 'sss' | 'sssPlus' | 'ap'

/** 该档所有谱面的三率（已按降序排序） */
interface LevelRateBucket {
  sss: number[]
  sssPlus: number[]
  ap: number[]
}

let _officialLevelRates: Map<number, LevelRateBucket> | null = null

/** 少于该样本数不显示排名，避免「2 首中第 1」的误导 */
const MIN_RANK_SAMPLES = 3

/**
 * 计算某个率在同档中的位次（1 = 最容易）。
 *
 * @param sortedDesc 该档所有谱面的率，**必须按降序排列**
 * @param value      本谱面的率
 * @returns 位次与样本数；样本不足时返回 null
 */
export function computeRateRank(
  sortedDesc: number[],
  value: number,
): { rank: number; total: number } | null {
  if (sortedDesc.length < MIN_RANK_SAMPLES) return null
  // 并列取最高位次：只数「严格高于」自己的数量
  let higher = 0
  for (const rate of sortedDesc) {
    if (rate > value) higher++
    else break
  }
  return { rank: higher + 1, total: sortedDesc.length }
}

/**
 * 该谱面在「同官方定数档」中的排名（1 = 最容易拿到该评级）。
 */
export function getRateRank(
  officialLevelValue: number,
  metric: RateMetric,
  value: number,
): { rank: number; total: number } | null {
  if (!_officialLevelRates) return null
  const bucket = _officialLevelRates.get(Math.round(officialLevelValue * 10) / 10)
  if (!bucket) return null
  return computeRateRank(bucket[metric], value)
}

// ---- Internal state ----

let _chartStats: Map<string, ChartStatSummary> | null = null  // key: "songId-level"
let _levelAvgs: Map<string, LevelAvg> | null = null            // key: level string (e.g. "14+")
let _fitDiffAvgs: Map<number, FitDiffAvg> | null = null        // key: fit_diff 一位小数 (e.g. 14.3)
let _officialLevelAvgs: Map<number, FitDiffAvg> | null = null  // key: 官方 levelValue 一位小数 (e.g. 14.7)
let _loaded = false
let _loadPromise: Promise<void> | null = null

// ---- Public interface ----

export async function loadStats(officialLevelMap?: Map<string, number>): Promise<void> {
  // 实装年数据用于校正拟合定数，必须先行加载（失败时内部降级为空表，校正量为 0）
  await loadInstallYear()

  // If loaded but the data is empty (previous load failed silently), retry
  if (_loaded && _chartStats && _chartStats.size === 0) {
    _loaded = false
    _loadPromise = null
  }

  // If already loaded but official avgs missing (e.g. first call from DimensionAnalysis without songs),
  // and now we have the map — build official avgs from cached data and return
  if (_loaded) {
    if (officialLevelMap && officialLevelMap.size > 0 && !_officialLevelAvgs) {
      const data = await getCachedStats()
      if (data) _officialLevelAvgs = buildOfficialLevelAvgs(data, officialLevelMap)
    }
    return
  }

  // If a load is already in progress, wait for it
  if (_loadPromise) {
    await _loadPromise
    // After the existing load completes, check if official avgs need building
    if (_loaded && officialLevelMap && officialLevelMap.size > 0 && !_officialLevelAvgs) {
      const data = await getCachedStats()
      if (data) _officialLevelAvgs = buildOfficialLevelAvgs(data, officialLevelMap)
    }
    return
  }

  // Start a new load
  _loadPromise = (async () => {
    try {
      // Cache-first
      let data = await getCachedStats()

      if (data) {
        // Validate cache: data.charts must be a non-empty object
        const chartCount = Object.keys(data.charts || {}).length
        if (chartCount === 0) {
          console.warn('statsService: 缓存数据为空，尝试从 API 重新获取')
          data = null as unknown as ChartStatsResponse // invalidate cache
        } else if (!hasSampleCount(data)) {
          // 旧缓存没有 cnt（样本量）：无法做可信度判定，视为过期，重新拉取
          console.warn('statsService: 缓存缺少样本量，重新获取')
          data = null as unknown as ChartStatsResponse
        }
      }

      if (!data) {
        data = await fetchChartStats()
        // Background write (don't block)
        setCachedStats(data).catch(() => {})
      } else {
        // Background refresh
        fetchChartStats().then(d => setCachedStats(d)).catch(() => {})
      }

      _chartStats = buildChartStats(data)
      _levelAvgs = buildLevelAvgs(data)
      _fitDiffAvgs = buildFitDiffAvgs(data)
      if (officialLevelMap && officialLevelMap.size > 0) {
        _officialLevelAvgs = buildOfficialLevelAvgs(data, officialLevelMap)
      }
      _loaded = true
    } catch (err) {
      console.warn('statsService: 加载 chart_stats 失败', err)
      if (!_chartStats) _chartStats = new Map()
      if (!_levelAvgs) _levelAvgs = new Map()
      if (!_fitDiffAvgs) _fitDiffAvgs = new Map()
      if (!_officialLevelAvgs) _officialLevelAvgs = new Map()
      _loaded = true
    } finally {
      _loadPromise = null
    }
  })()

  return _loadPromise
}

export function getChartStats(songId: number, level: string): ChartStatSummary | undefined {
  return _chartStats?.get(`${songId}-${level}`)
}

export function getLevelAvg(level: string): LevelAvg | undefined {
  return _levelAvgs?.get(level)
}

export function getFitDiffAvg(fitDiff: number): FitDiffAvg | undefined {
  const key = Math.round(fitDiff * 10) / 10
  return _fitDiffAvgs?.get(key)
}

/** 按官方定数（一位小数）查询同定数全服平均率 */
export function getOfficialLevelAvg(levelValue: number): FitDiffAvg | undefined {
  const key = Math.round(levelValue * 10) / 10
  return _officialLevelAvgs?.get(key)
}

export function isStatsLoaded(): boolean {
  return _loaded
}

// ---- Internal precomputation ----

/**
 * 缓存数据里是否带样本量（`cnt`）。
 * 早期缓存没有这个字段 —— 缺它就无法判定样本可信度，需要重新拉取。
 */
export function hasSampleCount(data: ChartStatsResponse): boolean {
  for (const entries of Object.values(data.charts ?? {})) {
    for (const entry of entries) {
      if (typeof (entry as { cnt?: number }).cnt === 'number') return true
    }
  }
  return false
}

function buildChartStats(data: ChartStatsResponse): Map<string, ChartStatSummary> {
  const map = new Map<string, ChartStatSummary>()

  // 先按官标档位收集样本量，算出各档中位数，用于判定「样本偏斜」
  const countsByLevel = new Map<string, number[]>()
  for (const entries of Object.values(data.charts)) {
    for (const entry of entries) {
      if (entry.diff == null) continue
      const count = entry.cnt ?? entry.dist.reduce((s, v) => s + v, 0)
      const bucket = countsByLevel.get(entry.diff)
      if (bucket) bucket.push(count)
      else countsByLevel.set(entry.diff, [count])
    }
  }

  const medianByLevel = new Map<string, number>()
  for (const [level, counts] of countsByLevel) {
    counts.sort((a, b) => a - b)
    const mid = Math.floor(counts.length / 2)
    medianByLevel.set(level, counts.length % 2 === 1 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2)
  }


  for (const [songIdStr, entries] of Object.entries(data.charts)) {
    const songId = Number(songIdStr)
    for (let levelIndex = 0; levelIndex < entries.length; levelIndex++) {
      const entry = entries[levelIndex]
      // Skip padding entries (diff is null for non-existent charts like missing Re:MASTER)
      if (entry.diff == null) continue
      const key = `${songId}-${entry.diff}`
      const levelData = data.diff_data[entry.diff]

      // SSS+ rate: dist[13] / total
      const totalDist = entry.dist.reduce((s, v) => s + v, 0) || 1
      const sssRate = (entry.dist[12] || 0) / totalDist
      const sssPlusRate = (entry.dist[13] || 0) / totalDist
      // 累计 SSS 及以上：SSS 与 SSS+ 是互斥区间（100.0~100.4999 / ≥100.5），相加才是「达到 SSS」
      const cumSssRate = ((entry.dist[12] || 0) + (entry.dist[13] || 0)) / totalDist

      // AP rate: (AP + AP+) from fc_dist
      const totalFcDist = entry.fc_dist.reduce((s, v) => s + v, 0) || 1
      const apRate = ((entry.fc_dist[3] || 0) + (entry.fc_dist[4] || 0)) / totalFcDist

      // Diff from same-level average
      const levelAvg = levelData?.achievements ?? entry.avg
      const diffFromLevelAvg = entry.avg - levelAvg

      // 按实装年校正拟合定数（新曲世代水鱼系统性偏低）
      const installYear = getInstallYear(songId, levelIndex)
      const correction = installYear !== null ? (FIT_DIFF_YEAR_CORRECTION[installYear] ?? 0) : 0
      const fitDiffRaw = entry.fit_diff
      const fitDiff = fitDiffRaw + correction

      map.set(key, {
        avg: entry.avg,
        stdDev: entry.std_dev,
        sssRate,
        sssPlusRate,
        cumSssRate,
        apRate,
        diffFromLevelAvg,
        fitDiff,
        fitDiffRaw,
        installYear,
        sampleCount: entry.cnt ?? totalDist,
        reliable: isReliableCount(entry.cnt ?? totalDist, medianByLevel.get(entry.diff) ?? 0),
      })
    }
  }

  return map
}

function buildLevelAvgs(data: ChartStatsResponse): Map<string, LevelAvg> {
  const map = new Map<string, LevelAvg>()
  for (const [level, entry] of Object.entries(data.diff_data)) {
    const totalDist = entry.dist.reduce((s, v) => s + v, 0) || 1
    const totalFcDist = entry.fc_dist.reduce((s, v) => s + v, 0) || 1

    map.set(level, {
      achievements: entry.achievements,
      sssRate: (entry.dist[12] || 0) / totalDist,
      sssPlusRate: (entry.dist[13] || 0) / totalDist,
      apRate: ((entry.fc_dist[3] || 0) + (entry.fc_dist[4] || 0)) / totalFcDist,
    })
  }
  return map
}

function buildFitDiffAvgs(data: ChartStatsResponse): Map<number, FitDiffAvg> {
  const groups = new Map<number, { dist: number[]; fc_dist: number[]; count: number }>()

  for (const entries of Object.values(data.charts)) {
    for (const entry of entries) {
      if (entry.diff == null) continue
      const key = Math.round(entry.fit_diff * 10) / 10
      let group = groups.get(key)
      if (!group) {
        group = { dist: new Array(14).fill(0), fc_dist: new Array(5).fill(0), count: 0 }
        groups.set(key, group)
      }
      // Accumulate per-chart dist/fc_dist (population-weighted by cnt)
      for (let i = 0; i < 14; i++) group.dist[i] += (entry.dist[i] || 0)
      for (let i = 0; i < 5; i++) group.fc_dist[i] += (entry.fc_dist[i] || 0)
      group.count++
    }
  }

  const map = new Map<number, FitDiffAvg>()
  for (const [key, group] of groups) {
    const totalDist = group.dist.reduce((s, v) => s + v, 0) || 1
    const totalFcDist = group.fc_dist.reduce((s, v) => s + v, 0) || 1
    map.set(key, {
      chartCount: group.count,
      sssRate: (group.dist[12] || 0) / totalDist,
      sssPlusRate: (group.dist[13] || 0) / totalDist,
      cumSssRate: ((group.dist[12] || 0) + (group.dist[13] || 0)) / totalDist,
      apRate: ((group.fc_dist[3] || 0) + (group.fc_dist[4] || 0)) / totalFcDist,
    })
  }
  return map
}

/**
 * Build official level-value averages (grouped by official levelValue rounded to 1 decimal).
 * Cross-references chart_stats entries with music_data via `officialLevelMap`.
 * @param data - chart_stats API response
 * @param officialLevelMap - `${songId}-${levelIndex}` → official levelValue
 */
function buildOfficialLevelAvgs(
  data: ChartStatsResponse,
  officialLevelMap: Map<string, number>,
): Map<number, FitDiffAvg> {
  const groups = new Map<number, { dist: number[]; fc_dist: number[]; count: number }>()
  // 同时收集每个谱面的三率，供「同档排名」使用
  const rateBuckets = new Map<number, LevelRateBucket>()

  for (const [songIdStr, entries] of Object.entries(data.charts)) {
    for (let levelIndex = 0; levelIndex < entries.length; levelIndex++) {
      const entry = entries[levelIndex]
      if (entry.diff == null) continue
      const levelKey = `${songIdStr}-${levelIndex}`
      const officialLv = officialLevelMap.get(levelKey)
      if (officialLv == null) continue
      const key = Math.round(officialLv * 10) / 10
      let group = groups.get(key)
      if (!group) {
        group = { dist: new Array(14).fill(0), fc_dist: new Array(5).fill(0), count: 0 }
        groups.set(key, group)
      }
      for (let i = 0; i < 14; i++) group.dist[i] += (entry.dist[i] || 0)
      for (let i = 0; i < 5; i++) group.fc_dist[i] += (entry.fc_dist[i] || 0)
      group.count++

      const chartTotal = (entry.dist || []).reduce((s, v) => s + v, 0)
      if (chartTotal > 0) {
        let bucket = rateBuckets.get(key)
        if (!bucket) {
          bucket = { sss: [], sssPlus: [], ap: [] }
          rateBuckets.set(key, bucket)
        }
        bucket.sss.push((entry.dist[12] || 0) / chartTotal)
        bucket.sssPlus.push((entry.dist[13] || 0) / chartTotal)
        const fcTotal = (entry.fc_dist || []).reduce((s, v) => s + v, 0)
        if (fcTotal > 0) {
          bucket.ap.push(((entry.fc_dist[3] || 0) + (entry.fc_dist[4] || 0)) / fcTotal)
        }
      }
    }
  }

  // 存为降序数组，供 getRateRank 二分定位
  _officialLevelRates = new Map()
  for (const [key, bucket] of rateBuckets) {
    _officialLevelRates.set(key, {
      sss: [...bucket.sss].sort((a, b) => b - a),
      sssPlus: [...bucket.sssPlus].sort((a, b) => b - a),
      ap: [...bucket.ap].sort((a, b) => b - a),
    })
  }

  const map = new Map<number, FitDiffAvg>()
  for (const [key, group] of groups) {
    const totalDist = group.dist.reduce((s, v) => s + v, 0) || 1
    const totalFcDist = group.fc_dist.reduce((s, v) => s + v, 0) || 1
    map.set(key, {
      chartCount: group.count,
      sssRate: (group.dist[12] || 0) / totalDist,
      sssPlusRate: (group.dist[13] || 0) / totalDist,
      cumSssRate: ((group.dist[12] || 0) + (group.dist[13] || 0)) / totalDist,
      apRate: ((group.fc_dist[3] || 0) + (group.fc_dist[4] || 0)) / totalFcDist,
    })
  }
  return map
}

/** Reset cache (for manual refresh) */
export function resetStats(): void {
  _chartStats = null
  _levelAvgs = null
  _fitDiffAvgs = null
  _officialLevelAvgs = null
  _loaded = false
  _loadPromise = null
}

/**
 * Force-refresh chart stats — fetch from API, update IndexedDB cache,
 * and rebuild in-memory state atomically. Unlike resetStats(), this
 * keeps _loaded=true so existing components don't lose their data.
 * Used when song library version changes (new songs added).
 */
export async function forceRefreshStats(): Promise<void> {
  try {
    const data = await fetchChartStats()
    await setCachedStats(data)
    // Rebuild in-memory from fresh data (atomic replacement)
    _chartStats = buildChartStats(data)
    _levelAvgs = buildLevelAvgs(data)
    _fitDiffAvgs = buildFitDiffAvgs(data)
    // _officialLevelAvgs depends on external officialLevelMap — clear so
    // next loadStats() call with a map will rebuild it
    _officialLevelAvgs = null
    _loaded = true
    _loadPromise = null
  } catch {
    // Best-effort: keep existing stats if refresh fails
  }
}
