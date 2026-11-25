import { describe, it, expect } from 'vitest'
import { buildLevelValueGroups, isLevelValueRangeValid, shouldShowLevelValue } from '../levelRange'

describe('buildLevelValueGroups', () => {
  it('上限 15 时最大值正好是 15.0', () => {
    const groups = buildLevelValueGroups(15)
    expect(Math.max(...groups.flatMap((g) => g.values))).toBe(15)
  })

  it('上限超过 15 时能生成 15.1 以上的选项（拟合定数可超 15）', () => {
    const groups = buildLevelValueGroups(15.4)
    const all = groups.flatMap((g) => g.values)
    expect(all).toContain(15.3)
    expect(Math.max(...all)).toBe(15.4)
  })

  it('按整数分组，组标签即整数', () => {
    const groups = buildLevelValueGroups(3.2)
    expect(groups.map((g) => g.label)).toEqual(['1', '2', '3'])
  })

  it('上限不足 1 时不会产出空数组以外的异常', () => {
    expect(buildLevelValueGroups(0.5)).toEqual([])
  })
})

describe('isLevelValueRangeValid', () => {
  it('任一端为空都视为有效', () => {
    expect(isLevelValueRangeValid(undefined, undefined)).toBe(true)
    expect(isLevelValueRangeValid(14.5, undefined)).toBe(true)
    expect(isLevelValueRangeValid(undefined, 13)).toBe(true)
  })

  it('min ≤ max 有效（含相等）', () => {
    expect(isLevelValueRangeValid(13, 14.5)).toBe(true)
    expect(isLevelValueRangeValid(14, 14)).toBe(true)
  })

  it('min > max 无效', () => {
    expect(isLevelValueRangeValid(14.5, 13)).toBe(false)
  })
})

describe('shouldShowLevelValue', () => {
  it('没有任何筛选时不显示定数', () => {
    expect(shouldShowLevelValue({})).toBe(false)
  })

  it('只勾难度时不显示（难度徽章已表达该信息）', () => {
    expect(shouldShowLevelValue({ difficultyLevels: [3] })).toBe(false)
  })

  it('用了定数区间时显示', () => {
    expect(shouldShowLevelValue({ levelValueMin: 14 })).toBe(true)
    expect(shouldShowLevelValue({ levelValueMax: 14.5 })).toBe(true)
  })

  it('用了等级标签时显示', () => {
    expect(shouldShowLevelValue({ level: '14+' })).toBe(true)
  })

  it('用了拟合定数口径时显示', () => {
    expect(shouldShowLevelValue({ fitDiffSource: 'sssPlus' })).toBe(true)
  })

  it('值为 undefined 与缺失等价', () => {
    expect(shouldShowLevelValue({ levelValueMin: undefined, level: undefined })).toBe(false)
  })
})
