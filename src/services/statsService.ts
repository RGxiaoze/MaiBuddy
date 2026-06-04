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

// ---- Internal state ----

let _chartStats: Map<string, ChartStatSummary> | null = null  // key: "songId-levelIndex"
let _levelAvgs: Map<string, LevelAvg> | null = null            // key: level string (e.g. "12")
let _loaded = false
let _loading = false

// ---- Public interface ----

export async function loadStats(): Promise<void> {
  if (_loaded) return
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
    _loaded = true
  } catch (err) {
    console.warn('statsService: 加载 chart_stats 失败', err)
    if (!_chartStats) _chartStats = new Map()
    if (!_levelAvgs) _levelAvgs = new Map()
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
      const levelStr = String(Math.floor(entry.fit_diff))
      const levelData = data.diff_data[levelStr]

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

/** Reset cache (for manual refresh) */
export function resetStats(): void {
  _chartStats = null
  _levelAvgs = null
  _loaded = false
}
