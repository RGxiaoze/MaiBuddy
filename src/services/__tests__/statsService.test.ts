import { describe, it, expect } from 'vitest'
import { computeSssFitDiff, computeRateRank, SSS_FIT_MIN_LEVEL, SSS_FIT_SLOPE } from '../statsService'
import type { ChartStatSummary, FitDiffAvg } from '../statsService'

function makeStat(overrides: Partial<ChartStatSummary> = {}): ChartStatSummary {
  return {
    avg: 98, stdDev: 3, sssRate: 0.1, sssPlusRate: 0.2, cumSssRate: 0.3,
    apRate: 0.01, diffFromLevelAvg: 0, fitDiff: 13,
    ...overrides,
  }
}

function makeGroup(overrides: Partial<FitDiffAvg> = {}): FitDiffAvg {
  return { chartCount: 10, sssRate: 0.1, sssPlusRate: 0.2, cumSssRate: 0.3, apRate: 0.01, ...overrides }
}

describe('computeSssFitDiff', () => {
  it('定数低于 12 时不推算（SSS 率饱和，无区分度）', () => {
    expect(computeSssFitDiff(makeStat(), makeGroup(), 11.9)).toBeNull()
    expect(SSS_FIT_MIN_LEVEL).toBe(12)
  })

  it('缺数据或样本不足时返回 null', () => {
    expect(computeSssFitDiff(undefined, makeGroup(), 13)).toBeNull()
    expect(computeSssFitDiff(makeStat(), undefined, 13)).toBeNull()
    expect(computeSssFitDiff(makeStat(), makeGroup({ chartCount: 2 }), 13)).toBeNull()
  })

  it('累计 SSS 率与同档持平时，等于官方定数', () => {
    expect(computeSssFitDiff(makeStat({ cumSssRate: 0.3 }), makeGroup({ cumSssRate: 0.3 }), 13)).toBeCloseTo(13, 5)
  })

  it('累计 SSS 率高于同档平均 → 更容易 → 定数下调', () => {
    // 高出 0.1 → 13 + (-1.132 × 0.1) = 12.8868
    const result = computeSssFitDiff(makeStat({ cumSssRate: 0.4 }), makeGroup({ cumSssRate: 0.3 }), 13)
    expect(result).not.toBeNull()
    expect(result!).toBeCloseTo(13 + SSS_FIT_SLOPE * 0.1, 5)
    expect(result!).toBeLessThan(13)
  })

  it('累计 SSS 率低于同档平均 → 更难 → 定数上调', () => {
    const result = computeSssFitDiff(makeStat({ cumSssRate: 0.2 }), makeGroup({ cumSssRate: 0.3 }), 13)
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(13)
  })

  it('偏差幅度约为 SSS+ 口径的一半（同一套数据下不会剧烈跳变）', () => {
    const result = computeSssFitDiff(makeStat({ cumSssRate: 0.4 }), makeGroup({ cumSssRate: 0.3 }), 13)!
    expect(Math.abs(result - 13)).toBeLessThanOrEqual(0.2)
  })
})

describe('computeRateRank', () => {
  // 降序排列的率数组（越高越容易）
  const rates = [0.9, 0.7, 0.5, 0.3, 0.1]

  it('最高的率排第 1 易', () => {
    expect(computeRateRank(rates, 0.9)).toEqual({ rank: 1, total: 5 })
  })

  it('最低的率排最后', () => {
    expect(computeRateRank(rates, 0.1)).toEqual({ rank: 5, total: 5 })
  })

  it('介于之间时，按「比它高的数量 + 1」定位', () => {
    expect(computeRateRank(rates, 0.5)).toEqual({ rank: 3, total: 5 })
    expect(computeRateRank(rates, 0.6)).toEqual({ rank: 3, total: 5 })
  })

  it('并列时取最高位次', () => {
    expect(computeRateRank([0.9, 0.9, 0.5], 0.9)).toEqual({ rank: 1, total: 3 })
  })

  it('样本不足 3 个时返回 null（避免「2 首中第 1」的误导）', () => {
    expect(computeRateRank([0.9, 0.5], 0.9)).toBeNull()
    expect(computeRateRank([], 0.9)).toBeNull()
  })
})
