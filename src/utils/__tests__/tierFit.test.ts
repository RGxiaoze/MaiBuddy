import { describe, it, expect } from 'vitest'
import { buildTierRows, TIER_ORDER } from '../tierFit'
import type { TierRates } from '../tierRates'

const chart = { ss: 0.30, ssp: 0.20, sss: 0.10, sssp: 0.05, fc: 0.80, ap: 0.05, app: 0.01 } as TierRates
const level = { ss: 0.25, ssp: 0.16, sss: 0.08, sssp: 0.04, fc: 0.70, ap: 0.04, app: 0.01 } as TierRates

const base = {
  chartTiers: chart,
  levelTiers: level,
  officialLevelValue: 14.9,
  sssFit: 14.87,
  sssPlusFit: 15.06,
  sampleCount: 5000,
  levelChartCount: 20,
}

const row = (tier: string) => buildTierRows(base).find((r) => r.tier === tier)!

describe('buildTierRows — 结构与顺序', () => {
  it('恒为 7 行，顺序由低到高', () => {
    const rows = buildTierRows(base)
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.tier)).toEqual(TIER_ORDER)
  })
})

describe('buildTierRows — 各档的取数口径', () => {
  it('SSS 直接采用传入的 sssFit（与详情页那一行一致）', () => {
    expect(row('sss').fit).toBe(14.87)
  })

  it('SSS+ 直接采用传入的 sssPlusFit（水鱼 fit_diff）', () => {
    expect(row('sssp').fit).toBe(15.06)
  })

  it('SS 档用斜率 −1.216 换算', () => {
    // 14.9 + (-1.216) * (0.30 - 0.25) = 14.8392
    expect(row('ss').fit).toBe(14.84)
  })

  it('FC 档用斜率 −1.031 换算', () => {
    // 14.9 + (-1.031) * (0.80 - 0.70) = 14.7969
    expect(row('fc').fit).toBe(14.8)
  })
})

describe('buildTierRows — 不可用的两种原因要分开', () => {
  it('AP / AP+ 因回归质量不足而不输出（方法问题）', () => {
    expect(row('ap').fit).toBeNull()
    expect(row('ap').unavailable).toBe('low-r2')
    expect(row('app').fit).toBeNull()
    expect(row('app').unavailable).toBe('low-r2')
  })

  it('缺统计数据的档位标为 no-data（数据问题）', () => {
    const rows = buildTierRows({ ...base, chartTiers: undefined, levelTiers: undefined })
    expect(rows.find((r) => r.tier === 'ss')!.unavailable).toBe('no-data')
    expect(rows.find((r) => r.tier === 'fc')!.unavailable).toBe('no-data')
  })

  it('SSS 拿不到拟合值时标为 no-data', () => {
    const rows = buildTierRows({ ...base, sssFit: null })
    const r = rows.find((x) => x.tier === 'sss')!
    expect(r.fit).toBeNull()
    expect(r.unavailable).toBe('no-data')
  })
})

describe('buildTierRows — 低样本只标注、不隐藏', () => {
  it('样本量偏低 → lowSample 为真，数值照常给出', () => {
    const rows = buildTierRows({ ...base, sampleCount: 50 })
    const r = rows.find((x) => x.tier === 'ss')!
    expect(r.lowSample).toBe(true)
    expect(r.fit).not.toBeNull()
  })

  it('同档谱面数不足 → lowSample 为真', () => {
    const rows = buildTierRows({ ...base, levelChartCount: 2 })
    expect(rows.every((r) => r.lowSample)).toBe(true)
  })

  it('样本充足时不标注', () => {
    const rows = buildTierRows(base)
    expect(rows.every((r) => r.lowSample)).toBe(false)
  })

  it('未提供样本信息时不误标为低样本', () => {
    const rows = buildTierRows({ ...base, sampleCount: undefined, levelChartCount: undefined })
    expect(rows.every((r) => r.lowSample)).toBe(false)
  })
})
