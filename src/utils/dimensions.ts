// ============================================================
// Five-dimension analysis — chart & player ability scores
// ============================================================

import type { ChartDifficulty, Notes, Song } from '@/types'

// ---- Dimension weights (for normalization) ----

/** Max observed raw values for normalization — calibrated against full song library */
const NORM_MAX = {
  processing: 20000,  // BPM × total notes
  stamina: 50000,     // total notes × estimated length
  burst: 30000,       // BPM × peak density estimate
  positioning: 0.8,   // position ratio
  technique: 0.7,     // technique ratio
}

// ---- Calibration utility ----

/**
 * Calibrate NORM_MAX values by scanning all songs.
 * Call this once during development (via browser Console) to determine optimal max values.
 * Returns suggested NORM_MAX based on P95 of raw values.
 */
export function calibrateNormMax(songs: Song[]): {
  processing: number
  stamina: number
  burst: number
  positioning: number
  technique: number
} {
  const raws: Record<string, number[]> = {
    processing: [], stamina: [], burst: [], positioning: [], technique: []
  }

  for (const song of songs) {
    if (!song?.difficulties) continue
    const allDiffs = [...(song.difficulties.standard || []), ...(song.difficulties.dx || [])]
    for (const diff of allDiffs) {
      if (!diff || diff.levelValue <= 0) continue
      const notes = diff.notes
      if (!notes || notes.total === 0) continue

      const total = notes.total
      const bpm = song.bpm
      const estimatedLength = bpm > 0 ? (total / bpm) * 60 : 120

      const avgDensity = estimatedLength > 0 ? total / estimatedLength : 0

      raws.processing.push(bpm * total)
      raws.stamina.push(total * estimatedLength)
      raws.burst.push(bpm * avgDensity * 1.5)
      raws.positioning.push((notes.touch + notes.slide * 1.5 + notes.hold * 0.8) / total)
      raws.technique.push((notes.slide * 1.2 + notes.hold + notes.break + notes.touch * 1.1) / total)
    }
  }

  const p95 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.95)] || 1
  }

  const max = (arr: number[]) => Math.max(...arr, 0.01)

  return {
    processing: p95(raws.processing),
    stamina: p95(raws.stamina),
    burst: p95(raws.burst),
    positioning: max(raws.positioning),
    technique: max(raws.technique),
  }
}

/**
 * Normalize raw value to 0.0–10.0 scale.
 */
function normalize(value: number, max: number): number {
  if (value <= 0) return 0
  const result = (value / max) * 10
  return Math.min(result, 10)
}

// ---- Per-chart dimension scores ----

export interface DimensionScores {
  processing: number   // 底力
  stamina: number      // 体力
  burst: number        // 爆发
  positioning: number  // 定位
  technique: number    // 技巧
}

/** Representative chart for a dimension, used to render a clickable link */
export interface TopChart {
  songId: number
  levelIndex: number
  title: string
}

/**
 * Compute dimension scores for a single chart.
 * Uses BPM + notes data from API.
 * Song length is not available from API; estimated as total_notes / BPM × 60 (seconds).
 */
export function computeChartDimensions(chart: ChartDifficulty, bpm: number): DimensionScores {
  const notes: Notes | null = chart.notes
  if (!notes || notes.total === 0) {
    return { processing: 0, stamina: 0, burst: 0, positioning: 0, technique: 0 }
  }

  const total = notes.total
  // Estimate song duration in seconds: total notes / (BPM/60) — rough estimate
  const estimatedLength = bpm > 0 ? (total / bpm) * 60 : 120 // default ~2min

  // 底力: BPM × total notes — speed × density proxy
  const processingRaw = bpm * total

  // 体力: total notes × estimated length — cumulative physical load
  const staminaRaw = total * estimatedLength

  // 爆发: BPM × peak density (estimated as total/estimatedLength for avg, ×1.5 for peak)
  const avgDensity = estimatedLength > 0 ? total / estimatedLength : 0
  const peakDensity = avgDensity * 1.5  // peak ≈ 1.5× average density
  const burstRaw = bpm * peakDensity

  // 定位: (TOUCH + SLIDE×1.5 + HOLD×0.8) / total
  const posRaw = (notes.touch + notes.slide * 1.5 + notes.hold * 0.8) / total

  // 技巧: (SLIDE×1.2 + HOLD + BREAK + TOUCH×1.1) / total
  const techRaw = (notes.slide * 1.2 + notes.hold + notes.break + notes.touch * 1.1) / total

  return {
    processing: normalize(processingRaw, NORM_MAX.processing),
    stamina: normalize(staminaRaw, NORM_MAX.stamina),
    burst: normalize(burstRaw, NORM_MAX.burst),
    positioning: normalize(posRaw, NORM_MAX.positioning),
    technique: normalize(techRaw, NORM_MAX.technique),
  }
}

/**
 * Compute chart raw dimension values (before normalization).
 * Used for player topCharts selection with raw × dxRating formula.
 */
export function computeChartDimensionsRaw(chart: ChartDifficulty, bpm: number): DimensionScores {
  const notes: Notes | null = chart.notes
  if (!notes || notes.total === 0) {
    return { processing: 0, stamina: 0, burst: 0, positioning: 0, technique: 0 }
  }

  const total = notes.total
  const estimatedLength = bpm > 0 ? (total / bpm) * 60 : 120

  const avgDensity = estimatedLength > 0 ? total / estimatedLength : 0

  return {
    processing: bpm * total,
    stamina: total * estimatedLength,
    burst: bpm * avgDensity * 1.5,
    positioning: (notes.touch + notes.slide * 1.5 + notes.hold * 0.8) / total,
    technique: (notes.slide * 1.2 + notes.hold + notes.break + notes.touch * 1.1) / total,
  }
}

// ---- Player ability calculation ----

export interface PlayerDimensions {
  processing: number
  stamina: number
  burst: number
  positioning: number
  technique: number
  chartCount: number
  topCharts: {
    processing: TopChart | null
    stamina: TopChart | null
    burst: TopChart | null
    positioning: TopChart | null
    technique: TopChart | null
  }
}

/**
 * Map achievement to ability contribution factor.
 * 97% → 0.6, 98% → 0.7, 99% → 0.8, 99.5% → 0.9, 100% → 0.95, 100.5% → 1.0
 */
function achievementFactor(ach: number): number {
  if (ach >= 100.5) return 1.0
  if (ach >= 100.0) return 0.95
  if (ach >= 99.5) return 0.9
  if (ach >= 99.0) return 0.8
  if (ach >= 98.0) return 0.7
  return 0.6 // ≥ 97%
}

/**
 * Compute player dimensional abilities from scores + song data.
 * Only scores with achievement ≥ 97% are counted.
 * Formula: Σ(dimension² × factor) / Σ(dimension²) — squared weighted average
 *
 * @param chartRawDims — raw (pre-normalization) chart dimensions for topCharts selection
 */
export function computePlayerDimensions(
  scores: Array<{ songId: number; levelIndex: number; achievements: number; songTitle: string }>,
  chartDimensions: Map<string, DimensionScores>,  // key: "songId-levelIndex"
  chartRawDims?: Map<string, DimensionScores>,     // key: "songId-levelIndex", raw values
): PlayerDimensions | null {
  // Filter: ≥ 97%, only one best per chart
  const bestByChart = new Map<string, { id: string; ach: number; title: string; dims: DimensionScores }>()
  for (const s of scores) {
    if (s.achievements < 97) continue
    const key = `${s.songId}-${s.levelIndex}`
    const dims = chartDimensions.get(key)
    if (!dims) continue
    const existing = bestByChart.get(key)
    if (!existing || s.achievements > existing.ach) {
      bestByChart.set(key, { id: key, ach: s.achievements, title: s.songTitle, dims })
    }
  }

  if (bestByChart.size === 0) return null

  // Squared weighted average per dimension
  const dims: (keyof DimensionScores)[] = ['processing', 'stamina', 'burst', 'positioning', 'technique']
  const result: PlayerDimensions = {
    processing: 0, stamina: 0, burst: 0, positioning: 0, technique: 0,
    chartCount: bestByChart.size,
    topCharts: { processing: null, stamina: null, burst: null, positioning: null, technique: null },
  }

  // Track top chart per dimension — use raw × dxRating when available
  const topByDim = new Map<keyof DimensionScores, { score: number; songId: number; levelIndex: number; title: string }>()

  for (const dim of dims) {
    let numerator = 0
    let denominator = 0

    for (const entry of bestByChart.values()) {
      const dimScore = entry.dims[dim]
      const squared = dimScore * dimScore
      const factor = achievementFactor(entry.ach)
      // Cubic-weighted: Σ(s³ × f) / Σ(s²) = s²-weighted average of (s × f)
      // This produces values in 0–10 range (s ∈ [0,10], f ∈ [0.6,1.0])
      numerator += squared * dimScore * factor
      denominator += squared

      // Representative chart: raw × dxRating (or fallback to dimScore × factor)
      if (chartRawDims) {
        const rawDims = chartRawDims.get(entry.id)
        if (rawDims) {
          const rawScore = rawDims[dim]
          // Achievement serves as quality multiplier for representative score
          const repScore = rawScore * entry.ach
          const existing = topByDim.get(dim)
          if (!existing || repScore > existing.score) {
            const [sid, li] = entry.id.split('-').map(Number)
            topByDim.set(dim, { score: repScore, songId: sid, levelIndex: li, title: entry.title })
          }
        }
      } else {
        // Fallback: use normalized dimScore × factor
        const weighted = dimScore * factor
        const existing = topByDim.get(dim)
        if (!existing || weighted > existing.score) {
          const [sid, li] = entry.id.split('-').map(Number)
          topByDim.set(dim, { score: weighted, songId: sid, levelIndex: li, title: entry.title })
        }
      }
    }

    result[dim] = denominator > 0 ? numerator / denominator : 0
    const topEntry = topByDim.get(dim)
    result.topCharts[dim] = topEntry ? { songId: topEntry.songId, levelIndex: topEntry.levelIndex, title: topEntry.title } : null
  }

  return result
}
