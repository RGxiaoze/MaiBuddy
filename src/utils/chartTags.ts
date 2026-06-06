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

export type ChartTag = '交互' | '纵连' | '星星' | '跳拍' | '体力' | '技巧' | '综合' | '扫键' | 'Touch'

export const ALL_TAGS: ChartTag[] = ['交互', '纵连', '星星', '跳拍', '体力', '技巧', '综合', '扫键', 'Touch']

const TAG_META: Record<ChartTag, { label: string; desc: string }> = {
  '交互': { label: '交互', desc: '双手交替击打不同键位的交互密集型谱面' },
  '纵连': { label: '纵连', desc: '同键位快速连击或二纵配置突出的谱面' },
  '星星': { label: '星星', desc: 'SLIDE 占比高、路径复杂的滑星密集型谱面' },
  '跳拍': { label: '跳拍', desc: 'SLIDE/TOUCH 少、BREAK 占比高的跳跃拍击型谱面' },
  '体力': { label: '体力', desc: '长时间高密度、大幅位移的耐力消耗型谱面' },
  '技巧': { label: '技巧', desc: '非常规配置或保护套不足的技巧考验型谱面' },
  '综合': { label: '综合', desc: '各项均衡、无明显偏向的综合型谱面' },
  '扫键': { label: '扫键', desc: '连续单向位移或圈配置突出的扫键型谱面' },
  'Touch': { label: 'Touch', desc: 'Touch 传感器使用频繁的触摸型谱面' },
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

  // 扫键: high TAP + high total (dense tap patterns suggest sweeps)
  if (tapPct > 0.55 && total > 800) return '扫键'

  // Touch: significant touch presence
  if (touchPct > 0.08) return 'Touch'

  return '综合'
}
