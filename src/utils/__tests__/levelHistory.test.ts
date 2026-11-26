import { describe, it, expect } from 'vitest'
import { summarizeChanges, buildChartSeries, type LevelPoint } from '../levelHistory'

describe('summarizeChanges — 徽章文案所需的最小信息', () => {
  it('只有一个点（从未变更）返回 null', () => {
    expect(summarizeChanges([[2020, 12.8]])).toBeNull()
  })

  it('两个点但数值相同（视为未变更）返回 null', () => {
    expect(summarizeChanges([[2020, 12.8], [2023, 12.8]])).toBeNull()
  })

  it('单次变更给出起止值与年份', () => {
    const s = summarizeChanges([[2020, 12.8], [2024, 13.0]])
    expect(s).toEqual({ earliest: 12.8, latest: 13.0, count: 1, latestYear: 2024, delta: 0.2 })
  })

  it('多次变更累计次数，latestYear 取最后一次', () => {
    const s = summarizeChanges([[2020, 12.8], [2022, 12.9], [2024, 13.0], [2025, 13.1]])
    expect(s?.count).toBe(3)
    expect(s?.latestYear).toBe(2025)
    expect(s?.earliest).toBe(12.8)
    expect(s?.latest).toBe(13.1)
    expect(s?.delta).toBeCloseTo(0.3, 5)
  })

  it('下调时 delta 为负', () => {
    const s = summarizeChanges([[2020, 13.2], [2023, 13.0]])
    expect(s?.delta).toBeCloseTo(-0.2, 5)
  })

  it('空数组返回 null', () => {
    expect(summarizeChanges([])).toBeNull()
  })
})

describe('buildChartSeries — 折线图数据', () => {
  const points: LevelPoint[] = [[2020, 12.8], [2023, 12.9]]

  it('没有快照的年份沿用前一个值（阶梯形）', () => {
    const s = buildChartSeries(points, null, [2020, 2021, 2022, 2023])
    expect(s.values).toEqual([12.8, 12.8, 12.8, 12.9])
  })

  it('首个快照之前的年份留空，不连线', () => {
    const s = buildChartSeries([[2023, 12.9]], null, [2020, 2021, 2022, 2023])
    expect(s.values).toEqual([null, null, null, 12.9])
  })

  it('末尾追加「当前」点，并标记是否与最后快照不同', () => {
    const same = buildChartSeries(points, 12.9, [2020, 2023])
    expect(same.labels.at(-1)).toBe('当前')
    expect(same.currentDiffers).toBe(false)

    const diff = buildChartSeries(points, 13.0, [2020, 2023])
    expect(diff.values.at(-1)).toBe(13.0)
    expect(diff.currentDiffers).toBe(true)
  })

  it('当前值缺失时，只画年度快照，不追加当前点', () => {
    const s = buildChartSeries(points, null, [2020, 2023])
    expect(s.labels).toEqual(['2020', '2023'])
    expect(s.currentDiffers).toBe(false)
  })

  it('空快照且无当前值时返回空序列', () => {
    const s = buildChartSeries([], null, [2020, 2021])
    expect(s.labels).toEqual([])
    expect(s.values).toEqual([])
  })
})
