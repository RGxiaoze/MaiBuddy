// ============================================================
// Chart feature tags — classify charts by note composition
// ============================================================

import type { ChartDifficulty } from '@/types'
import {
  TECH_TOUCH_MIN, TECH_SLIDE_MIN, STAR_SLIDE_MIN,
  STAMINA_NOTES_MIN, STAMINA_BPM_MIN,
  JACK_TAP_MIN, JACK_BREAK_MIN,
  JUMP_SLIDE_MAX, JUMP_TOUCH_MAX, JUMP_BREAK_MIN, JUMP_BPM_MIN,
  STREAM_TAP_MIN, STREAM_BPM_MIN,
} from '@/config/algorithms'

export type ChartTag = '交互' | '纵连' | '星星' | '跳拍' | '体力' | '技巧' | '综合'

export const ALL_TAGS: ChartTag[] = ['交互', '纵连', '星星', '跳拍', '体力', '技巧', '综合']

const TAG_META: Record<ChartTag, { label: string; desc: string }> = {
  '交互': { label: '交互', desc: 'TAP 占比高、BPM 快的交互密集型谱面' },
  '纵连': { label: '纵连', desc: 'TAP+HOLD 密集、BREAK 较多的纵向连接谱面' },
  '星星': { label: '星星', desc: 'SLIDE 占比高的滑星密集型谱面' },
  '跳拍': { label: '跳拍', desc: 'SLIDE/TOUCH 少、BREAK 占比高的跳跃拍击型谱面' },
  '体力': { label: '体力', desc: '总物量大、BPM 高的耐力型谱面' },
  '技巧': { label: '技巧', desc: 'TOUCH/SLIDE 占比很高的非标准配置技巧型谱面' },
  '综合': { label: '综合', desc: '各项均衡、无明显偏向的综合型谱面' },
}

export function getTagMeta(tag: ChartTag) {
  return TAG_META[tag]
}

/**
 * Classify a chart into a single dominant feature tag based on note composition.
 * Uses weighted heuristics to pick the most defining characteristic.
 */
export function classifyChart(chart: ChartDifficulty, bpm: number): ChartTag {
  const notes = chart.notes
  if (!notes || notes.total === 0) return '综合'

  const total = notes.total
  const tapPct = notes.tap / total
  const slidePct = notes.slide / total
  const breakPct = notes.break / total
  const touchPct = notes.touch / total

  // 技巧: TOUCH > 3% or SLIDE > 25%
  if (touchPct > TECH_TOUCH_MIN || slidePct > TECH_SLIDE_MIN) return '技巧'

  // 星星: SLIDE > 20%
  if (slidePct > STAR_SLIDE_MIN) return '星星'

  // 体力: high total notes + high BPM
  if (total > STAMINA_NOTES_MIN && bpm > STAMINA_BPM_MIN) return '体力'

  // 纵连: TAP+HOLD dominant + BREAK notable
  if (tapPct > JACK_TAP_MIN && breakPct > JACK_BREAK_MIN) return '纵连'

  // 跳拍: low SLIDE/TOUCH, high BREAK
  if (slidePct < JUMP_SLIDE_MAX && touchPct < JUMP_TOUCH_MAX && breakPct > JUMP_BREAK_MIN && bpm > JUMP_BPM_MIN) return '跳拍'

  // 交互: TAP dominant + high BPM
  if (tapPct > STREAM_TAP_MIN && bpm > STREAM_BPM_MIN) return '交互'

  return '综合'
}
