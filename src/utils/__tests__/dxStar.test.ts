import { describe, it, expect } from 'vitest'
import { computeDxStar, renderStars, DX_STAR_THRESHOLDS } from '@/utils/dxStar'

describe('DX_STAR_THRESHOLDS', () => {
  it('应该按降序排列', () => {
    for (let i = 1; i < DX_STAR_THRESHOLDS.length; i++) {
      expect(DX_STAR_THRESHOLDS[i].min).toBeLessThan(DX_STAR_THRESHOLDS[i - 1].min)
    }
  })

  it('最后一项应为 0 星保底', () => {
    const last = DX_STAR_THRESHOLDS[DX_STAR_THRESHOLDS.length - 1]
    expect(last.stars).toBe(0)
  })
})

describe('computeDxStar', () => {
  it('满分应返回 5 星', () => {
    const result = computeDxStar(300, 100)
    expect(result.ratio).toBeCloseTo(100)
    expect(result.stars).toBe(5)
    expect(result.maxDxScore).toBe(300)
  })

  it('97% 应返回 5 星', () => {
    const result = computeDxStar(291, 100)
    expect(result.stars).toBe(5)
  })

  it('95% 应返回 4 星', () => {
    const result = computeDxStar(285, 100)
    expect(result.stars).toBe(4)
  })

  it('93% 应返回 3 星', () => {
    const result = computeDxStar(279, 100)
    expect(result.stars).toBe(3)
  })

  it('0 分应返回 0 星', () => {
    const result = computeDxStar(0, 100)
    expect(result.stars).toBe(0)
    expect(result.ratio).toBe(0)
  })

  it('负数 dxScore 应返回 0', () => {
    const result = computeDxStar(-1, 100)
    expect(result.stars).toBe(0)
  })

  it('0 总物量不应崩溃', () => {
    const result = computeDxStar(100, 0)
    expect(result.stars).toBe(0)
    expect(result.maxDxScore).toBe(0)
  })
})

describe('renderStars', () => {
  it('3 星应渲染 3 个 ⭐', () => {
    expect(renderStars(3)).toBe('⭐⭐⭐')
  })

  it('0 星应返回空字符串', () => {
    expect(renderStars(0)).toBe('')
  })
})
