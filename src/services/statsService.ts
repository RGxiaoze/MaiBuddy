// ============================================================
// Chart stats service — cache + precompute + query
// ============================================================

import { fetchChartStats, type ChartStatsResponse } from './divingFishApi'
import { getCachedStats, setCachedStats } from '@/db/database'

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
  /** AP 率（(fc_dist[3] + fc_dist[4]) / total_fc） */
  apRate: number
  /** 全服平均达成率 - 同难度平均达成率（正 = 比同定数容易） */
  diffFromLevelAvg: number
  /** 拟合定数 */
  fitDiff: number
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
  /** AP 率（人口加权） */
  apRate: number
}

/** std_dev 分级阈值 — 对齐 Diving-Fish Prober 官方前端 */
export const STDEV_LEVELS = [
  { max: 3.6, label: '正常', color: '#22c55e', desc: '数据分布集中，参考价值高' },
  { max: 4.2, label: '较高', color: '#eab308', desc: '数据有一定离散，整体可信' },
  { max: 4.8, label: '高',   color: '#f97316', desc: '数据离散度偏高，可能有人差/越级因素' },
  { max: Infinity, label: '极高', color: '#ef4444', desc: '数据离散度极高，个人差或越级严重，仅供参考' },
] as const

// ---- Internal state ----

let _chartStats: Map<string, ChartStatSummary> | null = null  // key: "songId-level"
let _levelAvgs: Map<string, LevelAvg> | null = null            // key: level string (e.g. "14+")
let _fitDiffAvgs: Map<number, FitDiffAvg> | null = null        // key: fit_diff 一位小数 (e.g. 14.3)
let _officialLevelAvgs: Map<number, FitDiffAvg> | null = null  // key: 官方 levelValue 一位小数 (e.g. 14.7)
let _loaded = false
let _loading = false

// ---- Public interface ----

export async function loadStats(officialLevelMap?: Map<string, number>): Promise<void> {
  // If already loaded but official avgs missing (e.g. first call from DimensionAnalysis without songs),
  // and now we have the map — build official avgs from cached data and return
  if (_loaded) {
    if (officialLevelMap && officialLevelMap.size > 0 && !_officialLevelAvgs) {
      const data = await getCachedStats()
      if (data) _officialLevelAvgs = buildOfficialLevelAvgs(data, officialLevelMap)
    }
    return
  }
  if (_loading) {
    // Wait for existing load
    while (_loading) await new Promise(r => setTimeout(r, 100))
    return
  }
  _loading = true

  try {
    // Cache-first
    let data = await getCachedStats()

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
    _loading = false
  }
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

function buildChartStats(data: ChartStatsResponse): Map<string, ChartStatSummary> {
  const map = new Map<string, ChartStatSummary>()

  for (const [songIdStr, entries] of Object.entries(data.charts)) {
    const songId = Number(songIdStr)
    for (const entry of entries) {
      // Skip padding entries (diff is null for non-existent charts like missing Re:MASTER)
      if (entry.diff == null) continue
      const key = `${songId}-${entry.diff}`
      const levelData = data.diff_data[entry.diff]

      // SSS+ rate: dist[13] / total
      const totalDist = entry.dist.reduce((s, v) => s + v, 0) || 1
      const sssRate = (entry.dist[12] || 0) / totalDist
      const sssPlusRate = (entry.dist[13] || 0) / totalDist

      // AP rate: (AP + AP+) from fc_dist
      const totalFcDist = entry.fc_dist.reduce((s, v) => s + v, 0) || 1
      const apRate = ((entry.fc_dist[3] || 0) + (entry.fc_dist[4] || 0)) / totalFcDist

      // Diff from same-level average
      const levelAvg = levelData?.achievements ?? entry.avg
      const diffFromLevelAvg = entry.avg - levelAvg

      map.set(key, {
        avg: entry.avg,
        stdDev: entry.std_dev,
        sssRate,
        sssPlusRate,
        apRate,
        diffFromLevelAvg,
        fitDiff: entry.fit_diff,
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
}

/**
 * Force-refresh chart stats — fetch from API, update IndexedDB cache,
 * and reset in-memory state so next loadStats() uses fresh data.
 * Used when song library version changes (new songs added).
 */
export async function forceRefreshStats(): Promise<void> {
  try {
    const data = await fetchChartStats()
    await setCachedStats(data)
    resetStats()
  } catch {
    // Best-effort: keep existing stats if refresh fails
  }
}
