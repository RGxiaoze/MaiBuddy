// ============================================================
// Configuration recognizer — identify chart patterns
// ============================================================

import type { FrameDisplacement } from './displacement'

export type ConfigType =
  | 'interaction'    // 交互：双手交替击打不同键位
  | 'sweep'          // 扫键：3+键单向位移
  | 'circle'         // 圈：7+键覆盖半周
  | 'double_jack'    // 二纵：同键快速双击
  | 'jack'           // 纵连：同键连续3+次
  | 'single_double'  // 单双：单→双押交替
  | 'one_two'        // 1+2/2+1：一手1次一手2次
  | 'spin_interact'  // 转圈交互
  | 'return_sweep'   // 折返扫键
  | 'rest'           // 休息

export interface ConfigSegment {
  type: ConfigType
  startTime: number
  endTime: number
  density: number       // notes per second
  maxSpan: number       // max button span
  equivalentBPM: number // equivalent 16th note BPM
  switchCost: number    // cost of switching into this segment (0 = no switch)
}

/** Recognize configurations from displacement frames */
export function recognizeConfigs(
  frames: FrameDisplacement[],
  bpm: number,
  subdivisions: number[]  // from chart timing changes
): ConfigSegment[] {
  const segments: ConfigSegment[] = []
  if (frames.length === 0) return segments

  let segStart = 0
  let currentType: ConfigType | null = null

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    const nextType = classifyFrame(f, frames, i)

    if (nextType !== currentType && i > 0) {
      if (currentType && segStart < i) {
        segments.push(makeSegment(currentType, frames, segStart, i, bpm))
      }
      segStart = i
      currentType = nextType
    }
  }

  // Final segment
  if (currentType && segStart < frames.length) {
    segments.push(makeSegment(currentType, frames, segStart, frames.length, bpm))
  }

  // Calculate switch costs
  for (let i = 1; i < segments.length; i++) {
    segments[i].switchCost = computeSwitchCost(segments[i - 1], segments[i])
  }

  return segments
}

function classifyFrame(f: FrameDisplacement, frames: FrameDisplacement[], idx: number): ConfigType {
  if (f.notes === 0) return 'rest'

  // Single note with 1-3 comma gap → could be double jack
  if (f.notes === 1 && !f.isChord && idx > 0 && frames[idx - 1].notes === 1) {
    const prevF = frames[idx - 1]
    if (prevF.maxSpan === 0) return 'double_jack' // same button repeated
  }

  // Chord alternating → single_double
  if (f.isChord && idx > 0 && !frames[idx - 1].isChord && !frames[idx - 1].isTouch) {
    return 'single_double'
  }

  // Touch or slide → spin_interact or return_sweep (simplified)
  if (f.isTouch || f.isSlide) {
    if (f.maxSpan >= 3) return 'spin_interact'
    return 'interaction'
  }

  // Large span → sweep
  if (f.maxSpan >= 3) return 'sweep'

  // Default
  return 'interaction'
}

function makeSegment(
  type: ConfigType,
  frames: FrameDisplacement[],
  start: number,
  end: number,
  bpm: number
): ConfigSegment {
  const segFrames = frames.slice(start, end)
  const duration = segFrames[segFrames.length - 1].time - segFrames[0].time
  const totalNotes = segFrames.reduce((s, f) => s + f.notes, 0)
  const density = duration > 0 ? totalNotes / duration : 0
  const maxSpan = Math.max(...segFrames.map(f => f.maxSpan))
  const equivalentBPM = density * 60 / 4 * 16 // rough conversion

  return { type, startTime: frames[start].time, endTime: frames[end - 1].time, density, maxSpan, equivalentBPM, switchCost: 0 }
}

function computeSwitchCost(prev: ConfigSegment, curr: ConfigSegment): number {
  // Speed difference factor
  const speedDiff = Math.abs(curr.equivalentBPM - prev.equivalentBPM) / Math.max(prev.equivalentBPM, 1)
  // Type difference: double_jack → interaction is worst
  let typeFactor = 1.0
  if (prev.type === 'double_jack' && curr.type === 'interaction') typeFactor = 2.0
  if (curr.type === 'double_jack' && prev.type === 'interaction') typeFactor = 1.5
  return speedDiff * typeFactor
}
