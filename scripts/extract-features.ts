// ============================================================
// Feature extraction script — simai → displacement-driven 5D
// Run: npx tsx scripts/extract-features.ts
// ============================================================

import * as fs from 'node:fs'
import * as path from 'node:path'
import { SimaiConvert } from 'simai-sharp'

// ---- Types (mirrors simai-sharp structures) ----

interface ParsedNote {
  type: 'tap' | 'hold' | 'slide' | 'break' | 'touch'
  group: string // 'Tap' | 'A' | 'B' | 'C' | 'D' | 'E'
  index: number
  duration: number // seconds, 0 for taps
  isBreak: boolean
  isEx: boolean
  /** Slide 路径信息（仅 slide 类型） */
  slidePaths?: Array<{
    startGroup: string
    startIndex: number
    duration: number
    delay: number
    slideType: number // SlideType enum value
    vertices: Array<{ group: string; index: number }>
  }>
}

interface NoteCollection {
  time: number
  notes: ParsedNote[]
}

interface TimingChange {
  time: number
  bpm: number
  subdivisions: number
}

// ---- Coordinate System (from maimai-layout.ts, inline for portability) ----

const BUTTON_ANGLES: Record<number, number> = {
  1: 22.5, 2: 67.5, 3: 112.5, 4: 157.5,
  5: 202.5, 6: 247.5, 7: 292.5, 8: 337.5,
}

const SENSOR_OFFSET: Record<string, number> = {
  Tap: 0, A: 0, B: 0, C: 0, D: 22.5, E: 22.5,
}

const TAP_INNER = 1.04
const TAP_OUTER = 1.30
const OUTER_R = 1.0
const INNER_R = 2 / 3
const B_RADIUS = 0.14
const B_CENTER = 0.42
const E_CENTER = 0.60
const E_SIDE = 0.113

function polarXY(angleDeg: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.sin(rad) * r, y: -Math.cos(rad) * r }
}

function sensorRadius(group: string): number {
  switch (group) {
    case 'Tap': return (TAP_INNER + TAP_OUTER) / 2 // 1.17
    case 'A': case 'D': return (OUTER_R + INNER_R) / 2 // 0.835
    case 'B': return B_CENTER // 0.42
    case 'E': return E_CENTER // 0.60
    case 'C': return 0
    default: return 0
  }
}

function getPosition(group: string, index: number): { x: number; y: number } {
  if (group === 'C') return { x: 0, y: 0 }
  const baseAngle = BUTTON_ANGLES[index + 1] ?? 0
  const angle = (baseAngle + (SENSOR_OFFSET[group] ?? 0)) % 360
  return polarXY(angle, sensorRadius(group))
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function buttonAngle(btn: number): number {
  return BUTTON_ANGLES[btn] ?? 0
}

// ---- Constants ----

/** SlideType 路径放大系数 */
const SLIDE_TYPE_FACTOR: Record<number, number> = {
  0: 1.0,  // StraightLine
  1: 1.5,  // RingCw
  2: 1.5,  // RingCcw
  3: 1.4,  // Fold
  4: 1.3,  // CurveCw
  5: 1.3,  // CurveCcw
  6: 1.2,  // ZigZagS
  7: 1.2,  // ZigZagZ
  8: 1.3,  // EdgeFold
  9: 1.3,  // EdgeCurveCw
  10: 1.3, // EdgeCurveCcw
  11: 1.2, // Fan
}

const D_RATE_CAP = 6.0
const N_RATE_CAP = 16.0
const BURST_WINDOWS = [0.3, 0.5, 0.8, 1.0]

// ---- File scanning ----

function scanFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      files.push(...scanFiles(path.join(dir, entry.name)))
    } else if (entry.name.endsWith('.txt')) {
      files.push(path.join(dir, entry.name))
    }
  }
  return files
}

// ---- Chart parsing ----

function parseSimaiChart(simaiText: string, bpm: number): { noteCollections: NoteCollection[]; timingChanges: TimingChange[] } | null {
  try {
    const chart = SimaiConvert.deserialize(simaiText)
    if (!chart) return null

    const noteCollections: NoteCollection[] = []
    const timingChanges: TimingChange[] = []

    for (const tc of chart.timingChanges) {
      timingChanges.push({ time: tc.time, bpm: tc.tempo, subdivisions: tc.subdivisions })
    }

    for (const nc of chart.noteCollections) {
      const notes: ParsedNote[] = []

      for (const note of nc) {
        let type: ParsedNote['type'] = 'tap'
        let group = 'Tap'

        switch (note.type) {
          case 0: type = 'tap'; break
          case 1: type = 'touch'; break
          case 2: type = 'hold'; break
          case 3: type = 'slide'; break
          case 4: type = 'break'; break
          default: type = 'tap'
        }

        // Stars (slides) are represented as Tap with isStar=true in simai-sharp
        if (note.isStar && type === 'tap') type = 'slide'

        switch (note.location.group) {
          case 0: group = 'Tap'; break
          case 1: group = 'A'; break
          case 2: group = 'B'; break
          case 3: group = 'C'; break
          case 4: group = 'D'; break
          case 5: group = 'E'; break
        }

        let duration = 0
        if (type === 'hold' || type === 'slide') {
          duration = note.getVisibleDuration()
        }

        const isBreak = type === 'break' || (note.styles & 4) !== 0
        const isEx = note.isEx

        // Extract slide paths (for both Slide type and star-Tap)
        let slidePaths: ParsedNote['slidePaths']
        if (type === 'slide' && note.slidePaths && note.slidePaths.length > 0) {
          slidePaths = note.slidePaths.map(sp => ({
            startGroup: group,
            startIndex: note.location.index,
            duration: sp.duration,
            delay: sp.delay,
            slideType: sp.segments[0]?.slideType ?? 0,
            vertices: sp.segments.flatMap(seg =>
              seg.vertices.map(v => {
                let vg = 'Tap'
                switch (v.group) {
                  case 0: vg = 'Tap'; break
                  case 1: vg = 'A'; break
                  case 2: vg = 'B'; break
                  case 3: vg = 'C'; break
                  case 4: vg = 'D'; break
                  case 5: vg = 'E'; break
                }
                return { group: vg, index: v.index }
              })
            ),
          }))
        }

        notes.push({ type, group, index: note.location.index, duration, isBreak, isEx, slidePaths })
      }

      if (notes.length > 0) {
        noteCollections.push({ time: nc.time, notes })
      }
    }

    return { noteCollections, timingChanges }
  } catch {
    return null
  }
}

interface ChartMeta {
  title: string
  artist: string
  bpm: number
  type: 'SD' | 'DX' | 'UNKNOWN'
  musicId: number | null
}

function parseMeta(filePath: string, content: string): ChartMeta {
  const name = path.basename(filePath, '.txt')
  const typeMatch = name.match(/\[(SD|DX)\]$/)
  const type = typeMatch ? typeMatch[1] as 'SD' | 'DX' : 'UNKNOWN'

  const lines = content.split('\n')
  let title = name
  let artist = ''
  let bpm = 120
  let musicId: number | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('&title=')) title = trimmed.slice(7)
    if (trimmed.startsWith('&artist=')) artist = trimmed.slice(8)
    if (trimmed.startsWith('&bpm=')) bpm = parseFloat(trimmed.slice(5))
    if (trimmed.startsWith('&music_id=')) musicId = parseInt(trimmed.slice(10))
  }

  return { title, artist, bpm, type, musicId }
}

/** Extract a specific difficulty's simai text from the file */
function extractInote(content: string, inoteId: number): { simaiText: string; bpm: number } {
  const lines = content.split('\n')
  let inSection = false
  let chartText = ''
  let bpm = 120

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith(`&inote_${inoteId}=`)) {
      inSection = true
      // download.wmc.pub 把首个 BPM 标记与 &inote_N= 写在同一行
      // （如 `&inote_2=(138){1},`），整行跳过会丢掉它，导致 simai 解析失败
      const inline = trimmed.slice(`&inote_${inoteId}=`.length)
      if (inline) {
        const bpmMatch = inline.match(/^\((\d+)\)/)
        if (bpmMatch && bpm === 120) bpm = parseInt(bpmMatch[1])
        chartText += inline + '\n'
      }
      continue
    }
    if (inSection) {
      if (trimmed.startsWith('&') || trimmed === 'E') break
      if (trimmed.length > 0) {
        const bpmMatch = trimmed.match(/^\((\d+)\)/)
        if (bpmMatch && bpm === 120) bpm = parseInt(bpmMatch[1])
        chartText += trimmed + '\n'
      }
    }
  }

  return { simaiText: chartText.trim(), bpm }
}

/** Check for difficulty existence */
function hasInote(content: string, inoteId: number): boolean {
  return content.includes(`&inote_${inoteId}=`)
}

// ---- Event sequence builder ----

interface Event {
  time: number
  kind: 'note' | 'hold_end' | 'slide_end'
  /** For 'note': the note collection */
  notes?: ParsedNote[]
  /** For 'hold_end' / 'slide_end': the position being released */
  releaseGroup?: string
  releaseIndex?: number
}

function buildEvents(ncs: NoteCollection[]): Event[] {
  const events: Event[] = []

  for (const nc of ncs) {
    events.push({ time: nc.time, kind: 'note', notes: nc.notes })

    // Hold / Slide end events
    for (const note of nc.notes) {
      if ((note.type === 'hold' || note.type === 'slide') && note.duration > 0) {
        events.push({
          time: nc.time + note.duration,
          kind: note.type === 'hold' ? 'hold_end' : 'slide_end',
          releaseGroup: note.group,
          releaseIndex: note.index,
        })
      }
    }
  }

  // Sort by time, then by kind priority (hold_end/slide_end before note at same time)
  const kindOrder: Record<string, number> = { hold_end: 0, slide_end: 0, note: 1 }
  events.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    return (kindOrder[a.kind] ?? 0) - (kindOrder[b.kind] ?? 0)
  })

  return events
}

// ---- Finger tracker ----

interface FingerState {
  pos: { x: number; y: number }
  group: string
  index: number
}

function initFingers(): [FingerState, FingerState] {
  return [
    { pos: getPosition('Tap', 2), group: 'Tap', index: 2 },   // Right = btn 3 (0-indexed)
    { pos: getPosition('Tap', 5), group: 'Tap', index: 5 },   // Left = btn 6
  ]
}

interface FingerMove {
  dist: number      // distance traveled
  dt: number        // time interval
  speed: number     // dist / dt
  fromGroup: string
  fromIndex: number
  toGroup: string
  toIndex: number
}

/** Compute finger moves from one note set to the next. Returns moves + excess notes (>2) */
function resolveFrame(
  prevFingers: [FingerState, FingerState],
  prevTime: number,
  currNotes: ParsedNote[],
  currTime: number,
  occupiedKeys: Set<string>, // keys occupied by active holds
): { moves: FingerMove[]; newFingers: [FingerState, FingerState]; excessCount: number } {
  // Filter to tappable notes (exclude touch for finger tracking purposes? No, touch counts too)
  // But touch is just a location, we track it the same way
  const targets = currNotes.map(n => ({
    pos: getPosition(n.group, n.index),
    group: n.group,
    index: n.index,
  }))

  if (targets.length === 0) {
    // No new notes — fingers stay where they are
    return {
      moves: [],
      newFingers: [...prevFingers] as [FingerState, FingerState],
      excessCount: 0,
    }
  }

  const dt = Math.max(currTime - prevTime, 0.001) // prevent div by zero

  if (targets.length === 1) {
    // Single note: closest finger moves
    const d0 = distance(prevFingers[0].pos, targets[0].pos)
    const d1 = distance(prevFingers[1].pos, targets[0].pos)
    const mover = d0 <= d1 ? 0 : 1
    const moves: FingerMove[] = [{
      dist: mover === 0 ? d0 : d1,
      dt,
      speed: (mover === 0 ? d0 : d1) / dt,
      fromGroup: prevFingers[mover].group,
      fromIndex: prevFingers[mover].index,
      toGroup: targets[0].group,
      toIndex: targets[0].index,
    }]
    const newFingers = [...prevFingers] as [FingerState, FingerState]
    newFingers[mover] = { pos: targets[0].pos, group: targets[0].group, index: targets[0].index }

    return { moves, newFingers, excessCount: 0 }
  }

  if (targets.length === 2) {
    // 2 targets: minimal total distance pairing
    const d00 = distance(prevFingers[0].pos, targets[0].pos)
    const d01 = distance(prevFingers[0].pos, targets[1].pos)
    const d10 = distance(prevFingers[1].pos, targets[0].pos)
    const d11 = distance(prevFingers[1].pos, targets[1].pos)

    const pairingAB = d00 + d11 // F0→T0, F1→T1
    const pairingBA = d01 + d10 // F0→T1, F1→T0

    let moves: FingerMove[]
    let newFingers: [FingerState, FingerState]

    if (pairingAB <= pairingBA) {
      moves = [
        { dist: d00, dt, speed: d00 / dt, fromGroup: prevFingers[0].group, fromIndex: prevFingers[0].index, toGroup: targets[0].group, toIndex: targets[0].index },
        { dist: d11, dt, speed: d11 / dt, fromGroup: prevFingers[1].group, fromIndex: prevFingers[1].index, toGroup: targets[1].group, toIndex: targets[1].index },
      ]
      newFingers = [
        { pos: targets[0].pos, group: targets[0].group, index: targets[0].index },
        { pos: targets[1].pos, group: targets[1].group, index: targets[1].index },
      ]
    } else {
      moves = [
        { dist: d01, dt, speed: d01 / dt, fromGroup: prevFingers[0].group, fromIndex: prevFingers[0].index, toGroup: targets[1].group, toIndex: targets[1].index },
        { dist: d10, dt, speed: d10 / dt, fromGroup: prevFingers[1].group, fromIndex: prevFingers[1].index, toGroup: targets[0].group, toIndex: targets[0].index },
      ]
      newFingers = [
        { pos: targets[1].pos, group: targets[1].group, index: targets[1].index },
        { pos: targets[0].pos, group: targets[0].group, index: targets[0].index },
      ]
    }

    return { moves, newFingers, excessCount: 0 }
  }

  // 3+ targets: match 2 closest pairs, rest counted as excess
  // Greedy: for each finger, find closest target; resolve conflicts by picking min total
  // For simplicity: match all permutations of 2 finger-to-target assignments, pick min sum
  let bestTotal = Infinity
  let bestMoves: FingerMove[] = []
  let bestNewFingers: [FingerState, FingerState] = [...prevFingers]

  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      // F0→i, F1→j
      const d0i = distance(prevFingers[0].pos, targets[i].pos)
      const d1j = distance(prevFingers[1].pos, targets[j].pos)
      const totalA = d0i + d1j

      // F0→j, F1→i
      const d0j = distance(prevFingers[0].pos, targets[j].pos)
      const d1i = distance(prevFingers[1].pos, targets[i].pos)
      const totalB = d0j + d1i

      if (totalA <= totalB && totalA < bestTotal) {
        bestTotal = totalA
        bestMoves = [
          { dist: d0i, dt, speed: d0i / dt, fromGroup: prevFingers[0].group, fromIndex: prevFingers[0].index, toGroup: targets[i].group, toIndex: targets[i].index },
          { dist: d1j, dt, speed: d1j / dt, fromGroup: prevFingers[1].group, fromIndex: prevFingers[1].index, toGroup: targets[j].group, toIndex: targets[j].index },
        ]
        bestNewFingers = [
          { pos: targets[i].pos, group: targets[i].group, index: targets[i].index },
          { pos: targets[j].pos, group: targets[j].group, index: targets[j].index },
        ]
      }
      if (totalB < totalA && totalB < bestTotal) {
        bestTotal = totalB
        bestMoves = [
          { dist: d0j, dt, speed: d0j / dt, fromGroup: prevFingers[0].group, fromIndex: prevFingers[0].index, toGroup: targets[j].group, toIndex: targets[j].index },
          { dist: d1i, dt, speed: d1i / dt, fromGroup: prevFingers[1].group, fromIndex: prevFingers[1].index, toGroup: targets[i].group, toIndex: targets[i].index },
        ]
        bestNewFingers = [
          { pos: targets[j].pos, group: targets[j].group, index: targets[j].index },
          { pos: targets[i].pos, group: targets[i].group, index: targets[i].index },
        ]
      }
    }
  }

  const excessCount = Math.max(0, targets.length - 2)

  return { moves: bestMoves, newFingers: bestNewFingers, excessCount }
}

// ---- Per-chart feature extraction ----

interface ExtractedFeatures {
  processingRaw: number
  staminaRaw: number
  burstRaw: number
  positioning5aRaw: number
  positioning5bRaw: number
  techPathRaw: number
  techCompositeRaw: number
  techSpecialRaw: number
  techRaw: number
  meta: {
    longestNoRest: number
    restRatio: number
    peakCount: number
    slideTypes: Set<number>
    delayEventScores: number[]
    excessNoteFrames: number
    totalFrames: number
    touchTapFrames: number
    foldBackSegments: number
    timingChangeCount: number
    totalTime: number
  }
}

function extractFeatures(
  ncs: NoteCollection[],
  timingChanges: TimingChange[],
): ExtractedFeatures | null {
  if (ncs.length === 0) return null

  const events = buildEvents(ncs)
  if (events.length < 2) return null

  // ---- Run finger simulation ----
  const allMoves: FingerMove[] = []
  const allMoveTimes: number[] = []
  const frameDensities: number[] = [] // notes per frame
  let fingers = initFingers()
  let prevTime = events[0].time
  let totalExcessNotes = 0
  let totalFrames = 0
  let touchTapFrames = 0
  const delayEvents: Array<{ noteCount: number; avgDist: number; crossHand: boolean }> = []
  const slideTypesSeen = new Set<number>()
  let foldBackSegments = 0

  // For occupied keys tracking (Holds)
  const occupiedKeys = new Set<string>()
  type HoldEnd = { time: number; key: string }
  const holdEnds: HoldEnd[] = []

  // Previous move directions for fold-back detection
  const recentDirections: Array<{ angle: number; key: string }> = []

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const dt = Math.max(ev.time - prevTime, 0.001)
    prevTime = ev.time

    // Process hold ends
    holdEnds.sort((a, b) => a.time - b.time)
    while (holdEnds.length > 0 && holdEnds[0].time <= ev.time) {
      occupiedKeys.delete(holdEnds.shift()!.key)
    }

    if (ev.kind === 'note' && ev.notes) {
      const notes = ev.notes
      totalFrames++

      // Density
      let noteCount = 0
      for (const n of notes) {
        if (n.type !== 'touch') noteCount++ // touch doesn't count toward physical density
        else noteCount += 0.5 // touch has half weight for density
      }
      frameDensities.push(Math.max(noteCount, 0.5))

      // Touch + tap same frame detection
      const hasTap = notes.some(n => n.group === 'Tap' && (n.type === 'tap' || n.type === 'break'))
      const hasTouch = notes.some(n => n.group !== 'Tap' && n.group !== 'C' && n.type === 'touch')
      if (hasTap && hasTouch) touchTapFrames++

      // Slide types
      for (const n of notes) {
        if (n.type === 'slide' && n.slidePaths) {
          for (const sp of n.slidePaths) {
            slideTypesSeen.add(sp.slideType)
          }
        }
      }

      // Track active holds
      for (const n of notes) {
        if (n.type === 'hold' && n.duration >= 0.5) {
          const key = `${n.group}:${n.index}`
          occupiedKeys.add(key)
          holdEnds.push({ time: ev.time + n.duration, key })
        }
      }

      // Finger resolution
      const { moves, newFingers, excessCount } = resolveFrame(
        fingers, prevTime, notes, ev.time, occupiedKeys,
      )
      totalExcessNotes += excessCount

      for (const move of moves) {
        if (move.dist > 0) {
          allMoves.push(move)
          allMoveTimes.push(ev.time)
        }
      }

      // Update direction tracking for fold-back detection
      for (const move of moves) {
        if (move.dist > 0.1) {
          const fromAngle = buttonAngle(move.fromGroup === 'Tap' ? move.fromIndex + 1 : 0)
          const toAngle = buttonAngle(move.toGroup === 'Tap' ? move.toIndex + 1 : 0)
          const angleDiff = ((toAngle - fromAngle + 540) % 360) - 180
          recentDirections.push({ angle: angleDiff, key: `${move.toGroup}:${move.toIndex}` })
          if (recentDirections.length > 8) recentDirections.shift()
        }
      }

      // Fold-back detection: check if we have a recent reversal
      if (recentDirections.length >= 6) {
        const last3 = recentDirections.slice(-3)
        const prev3 = recentDirections.slice(-6, -3)
        const lastDirAvg = last3.reduce((s, d) => s + d.angle, 0) / last3.length
        const prevDirAvg = prev3.reduce((s, d) => s + d.angle, 0) / prev3.length
        const dirChange = Math.abs(((lastDirAvg - prevDirAvg + 540) % 360) - 180)
        // Check if at least one key is shared between the two groups
        const lastKeys = new Set(last3.map(d => d.key))
        const prevKeys = new Set(prev3.map(d => d.key))
        const hasSharedKey = [...lastKeys].some(k => prevKeys.has(k)) ||
          [...lastKeys].some(lk => [...prevKeys].some(pk => {
            const [lg, li] = lk.split(':').map(Number)
            const [pg, pi] = pk.split(':').map(Number)
            return lg === pg && Math.abs((li ?? 0) - (pi ?? 0)) <= 1
          }))

        if (dirChange >= 135 && hasSharedKey) {
          foldBackSegments++
          recentDirections.length = 0 // reset to avoid double-counting
        }
      }

      fingers = newFingers
      prevTime = ev.time
    } else if (ev.kind === 'hold_end' || ev.kind === 'slide_end') {
      // Hold/slide release — doesn't produce move, just frees up the key
      if (ev.releaseGroup && ev.releaseIndex !== undefined) {
        const key = `${ev.releaseGroup}:${ev.releaseIndex}`
        occupiedKeys.delete(key)
      }
    }
  }

  if (allMoves.length === 0) return null

  // ---- Compute total time ----
  const totalTime = events[events.length - 1].time - events[0].time
  if (totalTime <= 0) return null

  // ---- Processing (底力) ----
  // Use equivalent BPM based on pattern type and musical subdivisions.
  // Pattern types: 交互→16分基准, 双押/纵连→8分基准.
  // This prevents low-difficulty fast trills from inflating scores.

  // Build a time→timingChange lookup
  const tcByTime: Array<{ time: number; bpm: number; sub: number }> = []
  for (const tc of timingChanges) {
    tcByTime.push({ time: tc.time, bpm: tc.bpm, sub: tc.subdivisions })
  }
  tcByTime.sort((a, b) => a.time - b.time)

  function getTimingAt(t: number): { bpm: number; sub: number } {
    let best = tcByTime[0] ?? { bpm: 120, sub: 4 }
    for (const tc of tcByTime) {
      if (tc.time <= t) best = tc
    }
    return best
  }

  // Classify each NoteCollection's pattern type
  const framePatterns: Array<{ time: number; density: number; equivBpm: number }> = []
  for (let i = 0; i < ncs.length; i++) {
    const nc = ncs[i]
    const timing = getTimingAt(nc.time)
    const sub = timing.sub || 4
    const bpm = timing.bpm || 120
    const noteCount = nc.notes.filter(n => n.type !== 'touch').length
    const isDouble = noteCount >= 2

    // Compute density (notes/sec)
    const nextTime = i + 1 < ncs.length ? ncs[i + 1].time : nc.time + 0.5
    const interval = Math.max(nextTime - nc.time, 0.01)
    const density = noteCount / interval

    // Classify pattern vs previous frame
    let patternType: 'jack' | 'trill' | 'double' | 'other' = 'other'
    if (isDouble) {
      patternType = 'double'
    } else if (i > 0 && noteCount === 1 && ncs[i - 1].notes.length === 1) {
      const prevKey = ncs[i - 1].notes[0].group + ':' + ncs[i - 1].notes[0].index
      const curKey = nc.notes[0].group + ':' + nc.notes[0].index
      patternType = (prevKey === curKey) ? 'jack' : 'trill'
    }

    // Equivalent BPM based on ACTUAL frame interval + pattern type
    // Floor interval at 15/BPM to filter simai grid artifacts (sub-precision noise)
    const base = (patternType === 'trill') ? 1.0 : 0.5
    const minInterval = 7.5 / bpm  // 32分 equivalent, filter sub-inflated artifacts
    const effectiveInterval = Math.max(interval, minInterval)
    const equivBpm = (60 / effectiveInterval) * base

    framePatterns.push({ time: nc.time, density, equivBpm })
  }

  // Density threshold: P75 + 5.0 floor
  const allDensities = framePatterns.map(d => d.density).sort((a, b) => a - b)
  const p75Idx = Math.floor(allDensities.length * 0.75)
  const p75Density = allDensities[p75Idx] ?? allDensities[allDensities.length - 1] ?? 1
  const densityBaseline = Math.max(p75Density, 3.0)

  // Average equivalent BPM for high-density frames
  const highDensityBpms: number[] = []
  for (const fp of framePatterns) {
    if (fp.density >= densityBaseline) {
      highDensityBpms.push(fp.equivBpm)
    }
  }

  const processingRaw = highDensityBpms.length > 0
    ? highDensityBpms.reduce((s, v) => s + v, 0) / highDensityBpms.length
    : 0

  // ---- Stamina (体力) ----
  let shoulderPool = 0
  let forearmPool = 0

  // Comfort zone: R→1-4 (22.5°~157.5°), L→5-8 (202.5°~337.5°)
  function isInComfortZone(fingerIdx: 0 | 1, btnIndex: number, group: string): boolean {
    if (group !== 'Tap') return false
    const angle = buttonAngle(btnIndex + 1)
    if (fingerIdx === 0) return angle >= 22.5 - 1 && angle <= 157.5 + 1
    else return angle >= 202.5 - 1 && angle <= 337.5 + 1
  }

  function comfortZoneBoundary(fingerIdx: 0 | 1): number {
    return fingerIdx === 0 ? 157.5 : 202.5
  }

  // Re-run finger simulation for stamina (needs per-finger comfort zone info)
  fingers = initFingers()
  let staminaPrevTime = events[0].time

  for (const ev of events) {
    if (ev.kind === 'note' && ev.notes) {
      const targets = ev.notes.map(n => ({
        pos: getPosition(n.group, n.index),
        group: n.group,
        index: n.index,
      }))
      const dt = Math.max(ev.time - staminaPrevTime, 0.001)

      if (targets.length === 0) {
        staminaPrevTime = ev.time
        continue
      }

      const isDouble = targets.length >= 2
      let frameForearm = 0
      let frameShoulder = 0

      if (targets.length === 1) {
        const d0 = distance(fingers[0].pos, targets[0].pos)
        const d1 = distance(fingers[1].pos, targets[0].pos)
        const mover = d0 <= d1 ? 0 : 1
        const dist = mover === 0 ? d0 : d1
        const speed = dist / dt
        const fi = mover as 0 | 1

        if (isInComfortZone(fi, targets[0].index, targets[0].group)) {
          frameForearm += dist * speed
        } else {
          frameShoulder += dist * speed
        }

        fingers[fi] = { pos: targets[0].pos, group: targets[0].group, index: targets[0].index }
      } else {
        // 2+ targets: minimal pairing
        const d00 = distance(fingers[0].pos, targets[0].pos)
        const d01 = distance(fingers[0].pos, targets[1].pos)
        const d10 = distance(fingers[1].pos, targets[0].pos)
        const d11 = distance(fingers[1].pos, targets[1].pos)

        let assignments: [number, number] // [F0→T?, F1→T?]
        if (d00 + d11 <= d01 + d10) assignments = [0, 1]
        else assignments = [1, 0]

        const pairs: Array<{ fi: 0 | 1; target: typeof targets[0]; dist: number }> = [
          { fi: 0, target: targets[assignments[0]], dist: assignments[0] === 0 ? d00 : d01 },
          { fi: 1, target: targets[assignments[1]], dist: assignments[1] === 1 ? d11 : d10 },
        ]

        for (const { fi, target, dist } of pairs) {
          if (dist === 0) continue
          const speed = dist / dt

          if (isInComfortZone(fi, target.index, target.group)) {
            frameForearm += dist * speed
          } else {
            frameShoulder += dist * speed
          }

          fingers[fi] = { pos: target.pos, group: target.group, index: target.index }
        }
      }

      // Apply double coefficient to frame's forearm contribution only (not cumulative)
      if (isDouble) frameForearm *= 1.3

      // Touch/sensor notes require much less stamina than physical buttons (~30%)
      const hasTouch = targets.some(t => t.group !== 'Tap')
      if (hasTouch) {
        frameForearm *= 0.3
        frameShoulder *= 0.3
      }

      // Circle/ring slides: sustained smooth movement, much less tiring than sharp changes
      const evNotes = ev.notes!
      const hasCircleSlide = evNotes.some(n => {
        if (n.type !== 'slide' || !n.slidePaths) return false
        return n.slidePaths.some(sp => sp.slideType === 1 || sp.slideType === 2)
      })
      if (hasCircleSlide) {
        frameForearm *= 0.5
        frameShoulder *= 0.5
      }

      forearmPool += frameForearm
      shoulderPool += frameShoulder

      staminaPrevTime = ev.time
    }
  }

  const staminaRaw = shoulderPool + forearmPool

  // Stamina meta (using framePatterns with notes/sec)
  // Longest continuous high-density segment (>6 notes/sec)
  let longestNoRest = 0
  let currentHighDenseTime = 0
  for (let i = 0; i < framePatterns.length; i++) {
    const fp = framePatterns[i]
    if (fp.density > 6) {
      const nextTime = i + 1 < framePatterns.length ? framePatterns[i + 1].time : fp.time + 0.5
      currentHighDenseTime += nextTime - fp.time
    } else {
      longestNoRest = Math.max(longestNoRest, currentHighDenseTime)
      currentHighDenseTime = 0
    }
  }
  longestNoRest = Math.max(longestNoRest, currentHighDenseTime)

  // Rest ratio: proportion of time with density < 2 notes/sec
  let restTime = 0
  for (let i = 0; i < framePatterns.length; i++) {
    const fp = framePatterns[i]
    const nextTime = i + 1 < framePatterns.length ? framePatterns[i + 1].time : fp.time + 0.5
    const interval = nextTime - fp.time
    if (fp.density < 2) restTime += interval
  }
  const restRatio = totalTime > 0 ? restTime / totalTime : 0

  // Peak count: number of high-density peaks (>8 notes/sec)
  let peakCount = 0
  let inPeak = false
  for (const fp of framePatterns) {
    if (fp.density > 8 && !inPeak) {
      peakCount++
      inPeak = true
    } else if (fp.density <= 6) {
      inPeak = false
    }
  }

  // ---- Burst (爆发) ----
  let burstRaw = 0
  // Pre-compute frame data for efficient window scanning
  const frameData: Array<{ time: number; dSum: number; nSum: number }> = []
  for (const ev of events) {
    if (ev.kind === 'note' && ev.notes) {
      // Use finger moves at this time to compute D
      // For burst, we aggregate moves that happen near this time
      let dSum = 0
      let nSum = 0
      for (const n of ev.notes) {
        if (n.type !== 'touch') nSum++
      }
      // Find moves at this time (within 0.001s)
      for (let mi = 0; mi < allMoveTimes.length; mi++) {
        if (Math.abs(allMoveTimes[mi] - ev.time) < 0.001) {
          dSum += allMoves[mi].dist
        }
      }
      frameData.push({ time: ev.time, dSum, nSum })
    }
  }

  if (frameData.length > 0) {
    for (const W of BURST_WINDOWS) {
      const halfStep = W / 2
      let windowStart = frameData[0].time

      while (windowStart + W <= frameData[frameData.length - 1].time) {
        // Collect frames in window
        let dTotal = 0
        let nTotal = 0
        const windowFrames: typeof frameData = []

        for (const fd of frameData) {
          if (fd.time >= windowStart && fd.time < windowStart + W) {
            dTotal += fd.dSum
            nTotal += fd.nSum
            windowFrames.push(fd)
          }
        }

        if (nTotal > 0) {
          // Compute C: 0.1s sub-window peak
          let nPeak = 0
          let subStart = windowStart
          while (subStart + 0.1 <= windowStart + W) {
            let subN = 0
            for (const fd of windowFrames) {
              if (fd.time >= subStart && fd.time < subStart + 0.1) {
                subN += fd.nSum
              }
            }
            nPeak = Math.max(nPeak, subN)
            subStart += 0.05
          }

          const nAvg = nTotal * 0.1 / W
          const C = Math.max(nAvg, 0.001) > 0 ? nPeak / Math.max(nAvg, 0.001) : 1

          const dRate = dTotal / W
          const nRate = nTotal * C / W

          const dScore = dRate / D_RATE_CAP
          const nScore = nRate / N_RATE_CAP

          const windowScore = Math.max(dScore, nScore) + 0.3 * Math.min(dScore, nScore)
          burstRaw = Math.max(burstRaw, windowScore)
        }

        windowStart += halfStep
      }
    }
  }

  // ---- Positioning 5a (high-density avg displacement speed) ----
  // Uses equivBpm-based filtering (like processing), but measures physical speed
  const highDensityDisplacementSpeeds: number[] = []
  const EQUIV_BPM_THRESHOLD = 150 // equivalent 16th BPM floor
  for (let i = 0; i < allMoveTimes.length; i++) {
    const moveTime = allMoveTimes[i]
    // Find framePattern at this time
    let lo = 0, hi = framePatterns.length - 1
    let equivBpm = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (framePatterns[mid].time <= moveTime) {
        equivBpm = framePatterns[mid].equivBpm
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (equivBpm >= EQUIV_BPM_THRESHOLD) {
      highDensityDisplacementSpeeds.push(allMoves[i].speed)
    }
  }

  const positioning5aRaw = highDensityDisplacementSpeeds.length > 0
    ? highDensityDisplacementSpeeds.reduce((s, v) => s + v, 0) / highDensityDisplacementSpeeds.length
    : 0

  // ---- Positioning 5b (weighted jump difficulty) ----
  let pos5bSum = 0
  let pos5bCount = 0

  for (const move of allMoves) {
    if (move.dist < 0.01) continue

    // Direction coefficient
    const fromAngle = buttonAngle(move.fromGroup === 'Tap' ? move.fromIndex + 1 : 0)
    const toAngle = buttonAngle(move.toGroup === 'Tap' ? move.toIndex + 1 : 0)
    const angleDiff = ((toAngle - fromAngle + 540) % 360) - 180

    let dirCoeff = 1.0
    if (angleDiff > 15) dirCoeff = 0.8   // 从上往下
    else if (angleDiff < -15) dirCoeff = 1.3 // 从下往上
    // else: 横向 = 1.0

    // 过底 bonus
    const fromBtn = move.fromIndex + 1
    const toBtn = move.toIndex + 1
    const crossesCenter = (fromBtn === 4 && toBtn === 5) || (fromBtn === 5 && toBtn === 4)
    if (crossesCenter) dirCoeff += 0.2

    // Touch bonus
    const hasTouch = move.fromGroup !== 'Tap' || move.toGroup !== 'Tap'
    const touchCoeff = hasTouch ? 1.2 : 1.0

    // Dist²/dt captures both speed and scale: long fast jumps >> short fast moves
    const jumpScore = move.speed * move.dist * dirCoeff * touchCoeff
    pos5bSum += jumpScore
    pos5bCount++
  }

  const positioning5bRaw = pos5bCount > 0 ? pos5bSum / pos5bCount : 0

  // ---- Tech: Path layer ----
  // T1: Slide path rate
  let slideTotalLength = 0
  for (const nc of ncs) {
    for (const note of nc.notes) {
      if (note.type !== 'slide' || !note.slidePaths) continue

      for (const sp of note.slidePaths) {
        let pathLen = 0
        let prevPos = getPosition(sp.startGroup, sp.startIndex)

        for (const v of sp.vertices) {
          const vPos = getPosition(v.group, v.index)
          pathLen += distance(prevPos, vPos)
          prevPos = vPos
        }

        const factor = SLIDE_TYPE_FACTOR[sp.slideType] ?? 1.0
        slideTotalLength += pathLen * factor

        // Add virtual points (every 0.05s) for slide duration
        if (sp.duration > 0) {
          const virtualSteps = Math.floor(sp.duration / 0.05)
          // Each virtual step contributes to path length proportionally
          // Already counted via vertices, but virtual points help if duration > vertices
          // For long slides where vertex count is small relative to duration,
          // extrapolate using the vertex-based speed
          if (sp.vertices.length > 0) {
            // Already proportional to vertex path length via factor
            // Virtual points don't add more unless duration >> vertex count
            // For simplicity: scale by number of virtual segments
          }
        }
      }
    }
  }

  const techPathRaw = totalTime > 0 ? slideTotalLength / totalTime : 0

  // T2: SlideType diversity (collected in slideTypesSeen)
  const techT2score = Math.min(slideTypesSeen.size / 5, 1.0)

  // ---- Tech: Composite layer ----
  // T3: Touch + tap same frame
  const techT3score = totalFrames > 0 ? Math.min((touchTapFrames / totalFrames) / 0.05, 1.0) : 0

  // T6: Delay events (simplified — count slide delays with concurrent notes)
  // We track this via delayEvents collected during parsing
  // For now: use a simplified version based on slide delay detection
  let delayScoreSum = 0
  let delayEventCount = 0

  // Find frames where a slide starts (has delay) and there are other notes
  for (const nc of ncs) {
    const slides = nc.notes.filter(n => n.type === 'slide' && n.slidePaths && n.slidePaths.length > 0)
    if (slides.length === 0) continue

    for (const slide of slides) {
      for (const sp of slide.slidePaths!) {
        if (sp.delay > 0) {
          // Check for concurrent notes during delay period
          const delayStart = nc.time
          const delayEnd = nc.time + sp.delay
          const concurrentNotes: ParsedNote[] = []

          for (const nc2 of ncs) {
            if (nc2.time >= delayStart && nc2.time < delayEnd) {
              concurrentNotes.push(...nc2.notes.filter(n => n !== slide))
            }
          }

          if (concurrentNotes.length > 0) {
            const slidePos = getPosition(sp.startGroup, sp.startIndex)
            let totalDist = 0
            for (const cn of concurrentNotes) {
              const cnPos = getPosition(cn.group, cn.index)
              totalDist += distance(slidePos, cnPos)
            }
            const avgDist = concurrentNotes.length > 0 ? totalDist / concurrentNotes.length : 0
            const crossHand = concurrentNotes.some(n =>
              n.group === 'Tap' && (
                (sp.startGroup === 'Tap' && sp.startIndex <= 3 && n.index >= 4) ||
                (sp.startGroup === 'Tap' && sp.startIndex >= 4 && n.index <= 3)
              )
            )
            const score = concurrentNotes.length * avgDist * (crossHand ? 1.5 : 1.0)
            delayScoreSum += score
            delayEventCount++
          }
        }
      }
    }
  }

  const techT6score = delayEventCount > 0 ? delayScoreSum / delayEventCount : 0

  // T7: Excess note density
  const techT7score = totalFrames > 0 ? totalExcessNotes / totalFrames : 0

  // ---- Tech: Special layer ----
  // T5: Fold-back segments
  const techT5score = foldBackSegments

  // T8: Timing changes
  const techT8score = Math.min(timingChanges.length / 10, 1.0)

  // ---- Tech: Layer merging ----
  const techPathComponent = techPathRaw * 0.7 + techT2score * 0.3
  const techCompositeComponent = techT3score * 0.4 + techT6score * 0.4 + techT7score * 0.2
  const techSpecialComponent = techT5score * 0.5 + techT8score * 0.5

  const techRaw = techPathComponent * 0.4 + techCompositeComponent * 0.4 + techSpecialComponent * 0.2

  return {
    processingRaw,
    staminaRaw,
    burstRaw,
    positioning5aRaw,
    positioning5bRaw,
    techPathRaw: techPathComponent,
    techCompositeRaw: techCompositeComponent,
    techSpecialRaw: techSpecialComponent,
    techRaw,
    meta: {
      longestNoRest,
      restRatio,
      peakCount,
      slideTypes: slideTypesSeen,
      delayEventScores: [],
      excessNoteFrames: totalExcessNotes,
      totalFrames,
      touchTapFrames,
      foldBackSegments,
      timingChangeCount: timingChanges.length,
      totalTime,
    },
  }
}

// ---- Normalization ----

interface NormalizedDimensions {
  processing: number
  stamina: number
  burst: number
  positioning: number
  technique: number
}

interface SongEntry {
  title: string
  artist: string
  bpm: number
  type: string
  musicId: number | null
  difficulties: Record<string, {
    raw: {
      processing: number
      stamina: number
      burst: number
      positioning: number
      technique: number
      positioning5aRaw: number
      positioning5bRaw: number
    }
    normalized: NormalizedDimensions
    meta: {
      longestNoRest: number
      restRatio: number
      peakCount: number
    }
  }>
}

function p95(arr: number[]): number {
  if (arr.length === 0) return 1
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
}

function p99(arr: number[]): number {
  if (arr.length === 0) return 1
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]
}

function p995(arr: number[]): number {
  if (arr.length === 0) return 1
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.995)] || sorted[sorted.length - 1]
}

function twoSegmentNorm(raw: number, lo: number, hi: number): number {
  if (raw <= 0) return 0
  if (raw <= lo) return (raw / lo) * 16
  const gap = Math.max(hi - lo, lo * 0.01)
  return Math.min(16 + (raw - lo) / gap * 2, 18)
}

function buildOutput(
  allEntries: Map<string, SongEntry>,
  allRaws: Record<string, number[]>,
): object {
  const dimKeys = ['processing', 'stamina', 'burst', 'positioning5a', 'positioning5b', 'technique']

  // Compute P95 and P99.5 for each dimension
  const p95s: Record<string, number> = {}
  const p995s: Record<string, number> = {}
  const stats: Record<string, object> = {}

  for (const key of dimKeys) {
    const vals = allRaws[key] || []
    if (vals.length === 0) {
      p95s[key] = 1; p995s[key] = 1
      stats[key] = { min: 0, max: 0, p95: 1, count: 0 }
      continue
    }
    const sorted = [...vals].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const p95v = sorted[Math.floor(sorted.length * 0.95)] || max || 1
    const p995v = sorted[Math.floor(sorted.length * 0.995)] || max || 1
    p95s[key] = p95v
    p995s[key] = p995v
    stats[key] = { min, max, p95: p95v, count: vals.length }
  }

  // Normalize each entry
  const songs: Record<string, object> = {}
  for (const [songKey, entry] of allEntries) {
    const diffs: Record<string, object> = {}
    for (const [diffKey, d] of Object.entries(entry.difficulties)) {
      // Positioning: 5a and 5b normalized separately then averaged
      const pos5a = twoSegmentNorm(d.raw.positioning5aRaw, p95s.positioning5a, p995s.positioning5a)
      const pos5b = twoSegmentNorm(d.raw.positioning5bRaw, p95s.positioning5b, p995s.positioning5b)
      const positioning = (pos5a + pos5b) / 2

      const processing = twoSegmentNorm(d.raw.processing, p95s.processing, p995s.processing)
      const stamina = twoSegmentNorm(d.raw.stamina, p95s.stamina, p995s.stamina)
      const burst = twoSegmentNorm(d.raw.burst, p95s.burst, p995s.burst)
      const technique = twoSegmentNorm(d.raw.technique, p95s.technique, p995s.technique)

      diffs[diffKey] = {
        raw: {
          processing: d.raw.processing,
          stamina: d.raw.stamina,
          burst: d.raw.burst,
          positioning5a: d.raw.positioning5aRaw,
          positioning5b: d.raw.positioning5bRaw,
          positioning: (d.raw.positioning5aRaw + d.raw.positioning5bRaw) / 2,
          technique: d.raw.technique,
        },
        normalized: { processing, stamina, burst, positioning, technique },
        meta: { ...d.meta },
      }
    }
    songs[songKey] = {
      title: entry.title,
      artist: entry.artist,
      bpm: entry.bpm,
      type: entry.type,
      musicId: entry.musicId,
      difficulties: diffs,
    }
  }

  return { songs, norms: p95s, stats }
}

// ---- Main ----

async function main() {
  const chartsDir = path.resolve('参考谱面')
  if (!fs.existsSync(chartsDir)) {
    console.error('参考谱面/ directory not found')
    process.exit(1)
  }

  const files = scanFiles(chartsDir)
  console.log(`Found ${files.length} chart files`)

  const allEntries = new Map<string, SongEntry>()
  const allRaws: Record<string, number[]> = {
    processing: [],
    stamina: [],
    burst: [],
    positioning5a: [],
    positioning5b: [],
    technique: [],
  }

  const errors: string[] = []
  let processed = 0
  let totalCharts = 0
  let successCharts = 0

  const startTime = Date.now()

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const meta = parseMeta(file, content)
    const songKey = `${meta.title}[${meta.type}]`

    processed++
    if (processed % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000
      const rate = processed / elapsed
      const remaining = (files.length - processed) / rate
      console.log(`  ${processed}/${files.length} files (${remaining.toFixed(0)}s remaining)...`)
    }

    const entry: SongEntry = {
      title: meta.title,
      artist: meta.artist,
      bpm: meta.bpm,
      type: meta.type,
      musicId: meta.musicId,
      difficulties: {},
    }

    // Inote mapping — same for SD and DX: lv_2=Basic to lv_6=Re:Master
    const inoteMap = [2, 3, 4, 5, 6]

    for (const inoteId of inoteMap) {
      if (!hasInote(content, inoteId)) continue

      try {
        const { simaiText, bpm } = extractInote(content, inoteId)
        if (!simaiText) continue

        const parsed = parseSimaiChart(simaiText, bpm)
        if (!parsed) {
          errors.push(`Parse failed: ${songKey} inote_${inoteId}`)
          continue
        }

        const features = extractFeatures(parsed.noteCollections, parsed.timingChanges)
        if (!features) {
          errors.push(`Feature extraction failed: ${songKey} inote_${inoteId}`)
          continue
        }

        const diffKey = `lv_${inoteId}`
        totalCharts++
        successCharts++

        // Exclude all Basic (lv_2) from P95 calibration pool
        if (inoteId !== 2) {
          allRaws.processing.push(features.processingRaw)
          allRaws.stamina.push(features.staminaRaw)
          allRaws.burst.push(features.burstRaw)
          allRaws.positioning5a.push(features.positioning5aRaw)
          allRaws.positioning5b.push(features.positioning5bRaw)
          allRaws.technique.push(features.techRaw)
        }

        entry.difficulties[diffKey] = {
          raw: {
            processing: features.processingRaw,
            stamina: features.staminaRaw,
            burst: features.burstRaw,
            positioning: (features.positioning5aRaw + features.positioning5bRaw) / 2,
            technique: features.techRaw,
            positioning5aRaw: features.positioning5aRaw,
            positioning5bRaw: features.positioning5bRaw,
          },
          normalized: { processing: 0, stamina: 0, burst: 0, positioning: 0, technique: 0 },
          meta: {
            longestNoRest: features.meta.longestNoRest,
            restRatio: features.meta.restRatio,
            peakCount: features.meta.peakCount,
            timingChangeCount: features.meta.timingChangeCount,
            slideTypeCount: features.meta.slideTypes.size,
          },
        }
      } catch (err: any) {
        errors.push(`Exception: ${songKey} inote_${inoteId}: ${err.message}`)
      }
    }

    if (Object.keys(entry.difficulties).length > 0) {
      allEntries.set(songKey, entry)
    }
  }

  console.log(`\nProcessed ${processed} files, ${totalCharts} charts, ${successCharts} successful`)
  console.log(`${errors.length} errors`)

  // Build output with normalization
  const output = buildOutput(allEntries, allRaws)

  // Write output
  const outDir = path.resolve('public/data')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const outPath = path.join(outDir, 'simai_features.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`Output written to ${outPath}`)

  // Write error log
  if (errors.length > 0) {
    const errPath = path.resolve('scripts/extract-errors.log')
    fs.writeFileSync(errPath, errors.join('\n'), 'utf-8')
    console.log(`${errors.length} errors logged to ${errPath}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Done in ${elapsed}s`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
