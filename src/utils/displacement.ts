// ============================================================
// Displacement calculator — computes per-frame arm movement
// ============================================================

import { getPosition } from '../../research/maimai-layout'
import type { ParsedChart } from './chartParser'

export interface FrameDisplacement {
  time: number
  notes: number           // number of simultaneous notes
  maxSpan: number         // max button step span in this frame
  distance: number        // total cartesian distance moved (sum of all notes)
  avgDistance: number     // average distance per note
  isChord: boolean        // true if 2+ notes
  isTouch: boolean        // includes touch sensor
  isSlide: boolean        // includes slide
}

/** Compute per-frame displacement from parsed chart */
export function computeDisplacement(chart: ParsedChart): FrameDisplacement[] {
  const frames: FrameDisplacement[] = []
  let prevPositions: Array<{ x: number; y: number; group: string; index: number }> = []

  for (const nc of chart.noteCollections) {
    const notes = nc.notes
    if (notes.length === 0) {
      // Empty frame = rest
      frames.push({
        time: nc.time,
        notes: 0,
        maxSpan: 0,
        distance: 0,
        avgDistance: 0,
        isChord: false,
        isTouch: false,
        isSlide: false,
      })
      continue
    }

    const positions = notes.map(n => ({
      ...getPosition(n.group, n.index),
      group: n.group,
      index: n.index,
    }))

    // Calculate distances from previous positions
    let totalDist = 0
    let maxSpan = 0

    for (const pos of positions) {
      let minDist = Infinity
      for (const prev of prevPositions) {
        const dx = pos.x - prev.x
        const dy = pos.y - prev.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < minDist) minDist = d
      }
      if (minDist < Infinity) {
        totalDist += minDist
      }
    }

    // Calculate max button span
    const buttonIndices = notes.filter(n => n.group === 'Tap').map(n => n.index)
    if (buttonIndices.length >= 2) {
      for (let i = 0; i < buttonIndices.length; i++) {
        for (let j = i + 1; j < buttonIndices.length; j++) {
          const rawDiff = Math.abs(buttonIndices[i] - buttonIndices[j])
          const span = Math.min(rawDiff, 8 - rawDiff)
          if (span > maxSpan) maxSpan = span
        }
      }
    }

    frames.push({
      time: nc.time,
      notes: notes.length,
      maxSpan,
      distance: totalDist,
      avgDistance: notes.length > 0 ? totalDist / notes.length : 0,
      isChord: notes.length >= 2,
      isTouch: notes.some(n => n.group !== 'Tap'),
      isSlide: notes.some(n => n.type === 'slide'),
    })

    prevPositions = positions
  }

  return frames
}

/** Calculate the time gap between consecutive frames */
export function getFrameGaps(frames: FrameDisplacement[]): number[] {
  const gaps: number[] = []
  for (let i = 1; i < frames.length; i++) {
    gaps.push(frames[i].time - frames[i - 1].time)
  }
  return gaps
}
