import { describe, it, expect } from 'vitest'
import { computeTierRates } from '../tierRates'

// 取自真实 chart_stats 的一条 12 级谱面（cnt = 14503）
const DIST = [49, 8, 11, 6, 12, 175, 285, 608, 586, 1039, 898, 1327, 3178, 6321]
const FC_DIST = [3882, 3221, 5487, 978, 935]

describe('computeTierRates — 达成率轴', () => {
  it('≥100.5 只取 dist[13]', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.sssp).toBeCloseTo(6321 / 14503, 5)
  })

  it('≥100 取 dist[12..13]（与现有 cumSssRate 一致）', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.sss).toBeCloseTo((3178 + 6321) / 14503, 5)
  })

  it('≥99.5 取 dist[11..13]、≥99 取 dist[10..13]', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.ssp).toBeCloseTo((1327 + 3178 + 6321) / 14503, 5)
    expect(r.ss).toBeCloseTo((898 + 1327 + 3178 + 6321) / 14503, 5)
  })

  it('累计率必须单调不增：ss ≥ ssp ≥ sss ≥ sssp', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.ss).toBeGreaterThanOrEqual(r.ssp)
    expect(r.ssp).toBeGreaterThanOrEqual(r.sss)
    expect(r.sss).toBeGreaterThanOrEqual(r.sssp)
  })
})

describe('computeTierRates — 判定轴', () => {
  it('FC 及以上 = fc_dist[1..4]（索引 0 是「未 FC」）', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.fc).toBeCloseTo((3221 + 5487 + 978 + 935) / 14503, 5)
  })

  it('AP 及以上 = fc_dist[3]+[4]，与现有 apRate 算法一致', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.ap).toBeCloseTo((978 + 935) / 14503, 5)
  })

  it('AP+ = 仅 fc_dist[4]', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.app).toBeCloseTo(935 / 14503, 5)
  })

  it('判定累计率单调：fc ≥ ap ≥ app', () => {
    const r = computeTierRates(DIST, FC_DIST)
    expect(r.fc).toBeGreaterThanOrEqual(r.ap)
    expect(r.ap).toBeGreaterThanOrEqual(r.app)
  })
})

describe('computeTierRates — 健壮性', () => {
  it('空数组返回全 0，不产生 NaN', () => {
    const r = computeTierRates([], [])
    for (const v of Object.values(r)) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBe(0)
    }
  })

  it('数组偏短时缺失位置按 0 处理', () => {
    const r = computeTierRates([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 10, 0], [10])
    expect(r.ss).toBeCloseTo(15 / 15, 5)
    expect(r.fc).toBe(0)
    expect(r.app).toBe(0)
  })
})
