import { describe, it, expect } from 'vitest'
import { isReliableCount, MIN_ABSOLUTE_SAMPLE, RELIABLE_RATIO } from '../sampleReliability'

describe('isReliableCount', () => {
  it('低于同档中位数的 30% 即不可信', () => {
    const median = 50000   // 阈值 = max(15000, 12000) = 15000
    expect(isReliableCount(median * RELIABLE_RATIO, median)).toBe(true)
    expect(isReliableCount(median * RELIABLE_RATIO - 1, median)).toBe(false)
    expect(isReliableCount(median, median)).toBe(true)
  })

  it('受绝对下限保护：中位数较高时仍以 12000 兜底', () => {
    const median = 20000   // 阈值 = max(6000, 12000) = 12000
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE - 1, median)).toBe(false)
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE, median)).toBe(true)
  })

  it('整档样本稀薄（中位 < 12000）时只看相对比例，不再套绝对下限', () => {
    // 中位 5000 → 阈值 1500，2000 条样本应判可信（旧规则会因 < 12000 误标）
    expect(isReliableCount(2000, 5000)).toBe(true)
    expect(isReliableCount(1400, 5000)).toBe(false)
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
