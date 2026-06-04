import { describe, it, expect } from 'vitest'
import { classifyChart, getTagMeta, ALL_TAGS } from '@/utils/chartTags'
import type { ChartDifficulty } from '@/types'

function makeChart(overrides: Partial<ChartDifficulty['notes']> & { bpm?: number } = {}): { chart: ChartDifficulty; bpm: number } {
  const notes = {
    total: 100, tap: 60, hold: 10, slide: 20, touch: 5, break: 5,
    ...overrides,
  }
  notes.total = notes.tap + notes.hold + notes.slide + notes.touch + notes.break
  return {
    chart: {
      type: 'dx', levelIndex: 3, level: '14', levelValue: 14.0,
      noteDesigner: 'test', notes,
    },
    bpm: overrides.bpm ?? 150,
  }
}

describe('getTagMeta', () => {
  it('每个标签应有 label 和 desc', () => {
    for (const tag of ALL_TAGS) {
      const meta = getTagMeta(tag)
      expect(meta.label).toBeTruthy()
      expect(meta.desc).toBeTruthy()
    }
  })
})

describe('classifyChart', () => {
  it('TOUCH > 3% 应判定为技巧', () => {
    const { chart, bpm } = makeChart({ tap: 80, touch: 10, slide: 5, hold: 3, break: 2 })
    expect(classifyChart(chart, bpm)).toBe('技巧')
  })

  it('SLIDE > 25% 应判定为技巧', () => {
    const { chart, bpm } = makeChart({ tap: 60, slide: 30, hold: 5, touch: 3, break: 2 })
    expect(classifyChart(chart, bpm)).toBe('技巧')
  })

  it('SLIDE 20-25% 无 TOUCH 应判定为星星', () => {
    const { chart, bpm } = makeChart({ tap: 70, slide: 22, hold: 5, touch: 1, break: 2 })
    expect(classifyChart(chart, bpm)).toBe('星星')
  })

  it('高物量高 BPM 应判定为体力', () => {
    const bigChart: ChartDifficulty = {
      type: 'dx', levelIndex: 3, level: '14', levelValue: 14.0,
      noteDesigner: 'test',
      notes: { total: 1000, tap: 830, hold: 80, slide: 50, touch: 20, break: 20 },
    }
    expect(classifyChart(bigChart, 180)).toBe('体力')
  })

  it('高 TAP 高 BPM 应判定为交互', () => {
    const { chart, bpm } = makeChart({ tap: 62, slide: 18, hold: 17, touch: 1, break: 2, bpm: 170 })
    expect(classifyChart(chart, bpm)).toBe('交互')
  })

  it('空音符应返回综合', () => {
    const chart: ChartDifficulty = {
      type: 'dx', levelIndex: 3, level: '14', levelValue: 14.0,
      noteDesigner: 'test', notes: null,
    }
    expect(classifyChart(chart, 150)).toBe('综合')
  })
})
