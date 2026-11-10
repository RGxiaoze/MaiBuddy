import { describe, it, expect } from 'vitest'
import { isReliableCount, MIN_ABSOLUTE_SAMPLE, RELIABLE_RATIO } from '../sampleReliability'

describe('isReliableCount', () => {
  it('低于同档中位数的 30% 即不可信', () => {
    const median = 50000   // 阈值 = max(15000, 12000) = 15000
    expect(isReliableCount(median * RELIABLE_RATIO, median)).toBe(true)
    expect(isReliableCount(median * RELIABLE_RATIO - 1, median)).toBe(false)
    expect(isReliableCount(median, median)).toBe(true)
  })

  it('受绝对下限保护：中位数极小时也不放过稀薄样本', () => {
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE - 1, 10)).toBe(false)
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE, 10)).toBe(true)
  })

  it('无样本或非法值一律不可信', () => {
    expect(isReliableCount(0, 20000)).toBe(false)
    expect(isReliableCount(Number.NaN, 20000)).toBe(false)
  })

  it('档位中位数为 0（新配信）时退回绝对下限', () => {
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE + 1, 0)).toBe(true)
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE - 1, 0)).toBe(false)
  })
})
