import { describe, it, expect } from 'vitest'
import { getMaxFitDiffValue, isStatsLoaded, resetStats } from '../statsService'

describe('getMaxFitDiffValue', () => {
  it('统计未加载时返回 null，调用方据此退回官方定数上限', () => {
    resetStats()
    expect(isStatsLoaded()).toBe(false)
    expect(getMaxFitDiffValue()).toBeNull()
  })
})
