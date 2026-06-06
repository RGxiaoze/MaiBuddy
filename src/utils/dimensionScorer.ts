// ============================================================
// Five-dimension scorer — displacement-driven rating
// ============================================================

import type { FrameDisplacement } from './displacement'
import type { ConfigSegment } from './configRecognition'

export interface DimensionScores {
  baseStrength: number    // 底力 0-10
  stamina: number         // 体力 0-10
  burst: number           // 爆发 0-10
  technique: number       // 技巧 0-10
  positioning: number    // 定位 0-10
}

/**
 * Score five dimensions from displacement frames and config segments.
 */
export function scoreDimensions(
  frames: FrameDisplacement[],
  segments: ConfigSegment[],
  bpm: number
): DimensionScores {
  const duration = frames[frames.length - 1]?.time ?? 0

  // ---- 底力: longest sustained high-density window ----
  const windowSec = 4 // 4-second sliding window
  let maxSustained = 0
  for (let i = 0; i < frames.length; i++) {
    let j = i
    while (j < frames.length && frames[j].time - frames[i].time < windowSec) j++
    const segFrames = frames.slice(i, j)
    const density = segFrames.reduce((s, f) => s + f.notes, 0) / windowSec
    if (density > maxSustained) maxSustained = density
  }
  const baseStrength = Math.min(10, (maxSustained / 10) * 10) // 10 notes/s = score 10

  // ---- 体力: shoulder + forearm pools with BPM weighting ----
  const eqBPM = bpm // use chart's base BPM
  const shoulderSegs = segments.filter(s => s.type === 'sweep' || s.type === 'circle' || s.type === 'spin_interact')
  const forearmSegs = segments.filter(s => s.type === 'interaction' || s.type === 'single_double' || s.type === 'double_jack')

  // Shoulder: displacement × speed × duration, slow recovery
  const shoulderLoad = shoulderSegs.reduce((s, seg) =>
    s + seg.density * seg.maxSpan * (seg.endTime - seg.startTime), 0)
  // Forearm: density × duration × double_factor
  const forearmLoad = forearmSegs.reduce((s, seg) =>
    s + seg.density * (seg.endTime - seg.startTime) * 1.0, 0)
  // Scale by BPM ratio (200 = baseline)
  const bpmScale = eqBPM / 200
  const stamina = Math.min(10, (shoulderLoad * 0.15 + forearmLoad * 0.1) * bpmScale)

  // ---- 爆发: peak equivalent BPM × gradient × switch cost ----
  const burstSegs = segments.filter(s => s.equivalentBPM > 0)
  const peakBPM = burstSegs.length > 0 ? Math.max(...burstSegs.map(s => s.equivalentBPM)) : 0
  // Gradient: peak vs median of non-peak segments
  const others = burstSegs.filter(s => s.equivalentBPM < peakBPM * 0.8)
  const medianBPM = others.length > 0
    ? others.sort((a, b) => a.equivalentBPM - b.equivalentBPM)[Math.floor(others.length / 2)].equivalentBPM
    : bpm
  const gradient = Math.max(1, peakBPM / Math.max(medianBPM, 1))
  const maxSwitch = Math.max(...segments.map(s => s.switchCost), 0)
  const burst = Math.min(10, (peakBPM / 350) * 10 * gradient * (1 + maxSwitch * 0.3))

  // ---- 技巧: config diversity + touch + unprotected sweeps ----
  const configTypes = new Set(segments.map(s => s.type))
  const typeCount = configTypes.size
  const slideRatio = frames.filter(f => f.isSlide).length / Math.max(frames.length, 1)
  const touchRatio = frames.filter(f => f.isTouch).length / Math.max(frames.length, 1)
  const sweepCount = segments.filter(s => s.type === 'sweep' || s.type === 'circle').length
  const technique = Math.min(10,
    (typeCount / 7) * 4 +        // config diversity (max ~7 types)
    slideRatio * 15 +             // slide usage
    touchRatio * 10 +             // touch usage
    (sweepCount / 20) * 3         // sweep frequency
  )

  // ---- 定位: direction-weighted displacement ----
  const totalDisplacement = frames.reduce((s, f) => s + f.distance, 0)
  const avgSpan = frames.reduce((s, f) => s + f.maxSpan, 0) / Math.max(frames.length, 1)
  const positioning = Math.min(10,
    (totalDisplacement / Math.max(duration, 1) / 5) * 10 * 0.5 +
    avgSpan * 2 * 0.5
  )

  return { baseStrength, stamina, burst, technique, positioning }
}
