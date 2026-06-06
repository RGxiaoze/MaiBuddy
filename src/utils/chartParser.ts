// ============================================================
// Chart parser — simai → MaiChart AST via simai-sharp-ts
// ============================================================

import { SimaiConvert, SimaiFile } from 'simai-sharp'

export interface ParsedChart {
  bpm: number
  noteCollections: Array<{
    time: number          // seconds from start
    notes: Array<{
      type: 'tap' | 'hold' | 'slide' | 'break' | 'touch' | 'ex'
      group: string       // 'Tap' | 'A' | 'B' | 'C' | 'D' | 'E'
      index: number       // 0-7 (button index)
      duration: number    // seconds, 0 for taps
      isBreak: boolean
      isEx: boolean
    }>
  }>
  timingChanges: Array<{
    time: number
    bpm: number
    subdivisions: number
  }>
}

/** Parse a simai chart string into structured AST */
export function parseChart(simaiText: string, bpm: number): ParsedChart {
  const chart = SimaiConvert.deserialize(simaiText)
  if (!chart) throw new Error('Failed to parse simai chart')

  const noteCollections: ParsedChart['noteCollections'] = []
  const timingChanges: ParsedChart['timingChanges'] = []

  // Extract timing changes
  for (const tc of chart.timingChanges) {
    timingChanges.push({
      time: tc.time,
      bpm: tc.tempo,
      subdivisions: tc.subdivisions,
    })
  }

  // Extract notes
  for (const nc of chart.noteCollections) {
    const notes: ParsedChart['noteCollections'][0]['notes'] = []

    for (const note of nc) {
      let type: ParsedChart['noteCollections'][0]['notes'][0]['type'] = 'tap'
      let group = 'Tap'
      let duration = 0

      // Map NoteType
      switch (note.type) {
        case 0: type = 'tap'; break      // Tap
        case 1: type = 'touch'; break    // Touch
        case 2: type = 'hold'; break     // Hold
        case 3: type = 'slide'; break    // Slide
        case 4: type = 'break'; break    // Break
        default: type = 'tap'
      }

      // Map NoteGroup
      switch (note.location.group) {
        case 0: group = 'Tap'; break
        case 1: group = 'A'; break
        case 2: group = 'B'; break
        case 3: group = 'C'; break
        case 4: group = 'D'; break
        case 5: group = 'E'; break
      }

      // Duration for holds/slides
      if (type === 'hold' || type === 'slide') {
        duration = note.getVisibleDuration()
      }

      const isBreak = type === 'break' || (note.styles & 4) !== 0 // NoteStyles.Break
      const isEx = note.isEx

      notes.push({
        type,
        group,
        index: note.location.index,
        duration,
        isBreak,
        isEx,
      })
    }

    if (notes.length > 0) {
      noteCollections.push({ time: nc.time, notes })
    }
  }

  return { bpm, noteCollections, timingChanges }
}

/** Parse a maidata.txt file content, extracting a specific difficulty */
export function parseMaidataFile(content: string, inoteId: number = 5): ParsedChart {
  const file = new SimaiFile('')
  // SimaiFile can't parse from string directly, so we extract the inote section
  const lines = content.split('\n')
  let inSection = false
  let chartText = ''
  let bpm = 120

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`&inote_${inoteId}=`)) {
      inSection = true
      continue
    }
    if (inSection) {
      if (trimmed.startsWith('&') || trimmed === 'E') break
      // Extract BPM — use FIRST encountered (initial), not last
      const bpmMatch = trimmed.match(/^\((\d+)\)/)
      if (bpmMatch && bpm === 120) bpm = parseInt(bpmMatch[1])
      chartText += trimmed + '\n'
    }
  }

  return parseChart(chartText.trim(), bpm)
}
