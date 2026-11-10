import { describe, it, expect } from 'vitest'
import { isReliableCount, MIN_ABSOLUTE_SAMPLE, RELIABLE_RATIO } from '../sampleReliability'

describe('isReliableCount', () => {
  it('达到同档中位数的一半即可信', () => {
    expect(isReliableCount(500, 1000)).toBe(true)
    expect(isReliableCount(1000 * RELIABLE_RATIO, 1000)).toBe(true)
  })

  it('低于同档中位数一半时不可信', () => {
    expect(isReliableCount(1000 * RELIABLE_RATIO - 1, 1000)).toBe(false)
  })

  it('受绝对下限保护：中位数极小时也不放过稀薄样本', () => {
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE - 1, 10)).toBe(false)
    expect(isReliableCount(MIN_ABSOLUTE_SAMPLE, 10)).toBe(true)
  })

  it('无样本或非法值一律不可信', () => {
    expect(isReliableCount(0, 1000)).toBe(false)
    expect(isReliableCount(Number.NaN, 1000)).toBe(false)
  })

  it('档位中位数为 0（新配信）时退回绝对下限', () => {
    expect(isReliableCount(25, 0)).toBe(true)
    expect(isReliableCount(5, 0)).toBe(false)
  })
})
