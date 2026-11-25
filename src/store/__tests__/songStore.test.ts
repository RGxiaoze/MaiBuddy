import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSongStore } from '../songStore'
import type { Song } from '@/types'

// 拟合定数来自全服统计，测试里直接按口径注入固定值。
// vi.mock 会被提升到顶部，所以数据容器必须走 vi.hoisted。
const { mockFitValues } = vi.hoisted(() => ({
  mockFitValues: new Map<string, { sssPlus?: number; sss?: number }>(),
}))

vi.mock('@/services/statsService', () => ({
  getFitDiffValue: (
    songId: number, level: string, _levelValue: number, source: 'sssPlus' | 'sss',
  ) => mockFitValues.get(`${songId}-${level}`)?.[source] ?? null,
  forceRefreshStats: vi.fn(),
}))

function diff(levelIndex: number, levelValue: number, level = '13'): {
  type: 'standard'; levelIndex: number; level: string; levelValue: number; noteDesigner: string; notes: null
} {
  return { type: 'standard', levelIndex, level, levelValue, noteDesigner: '', notes: null }
}

function song(id: number, diffs: ReturnType<typeof diff>[]): Song {
  return {
    id, title: `S${id}`, artist: 'a', bpm: 150, from: 'maimai', genre: '舞萌',
    imageUrl: '', isNew: false,
    difficulties: { standard: diffs, dx: [] },
  } as unknown as Song
}

/** 直接调 store 的过滤方法 */
function filterWith(filters: Parameters<typeof useSongStore.setState>[0] extends never ? never : Record<string, unknown>) {
  useSongStore.setState({ advancedFilters: filters } as never)
  return useSongStore.getState().getFilteredSongs('')
}

describe('getFilteredSongs — 谱面级条件必须同一谱面满足', () => {
  beforeEach(() => {
    useSongStore.setState({ searchQuery: '', sortBy: 'default', sortOrder: 'desc' } as never)
  })

  it('BASIC + 13.0：只有「BASIC 谱面本身是 13.0」才匹配', () => {
    // S1: BASIC 5.0 + MASTER 13.0 → 不匹配（13.0 是 MASTER 的，不是 BASIC 的）
    // S2: BASIC 13.0          → 匹配
    useSongStore.setState({
      songs: [song(1, [diff(0, 5.0), diff(3, 13.0)]), song(2, [diff(0, 13.0)])],
    } as never)

    const result = filterWith({ difficultyLevels: [0], levelValueMin: 13.0, levelValueMax: 13.0 })
    expect(result.map(s => s.id)).toEqual([2])
  })

  it('不指定难度时，任一谱面落在定数区间即可', () => {
    useSongStore.setState({
      songs: [song(1, [diff(0, 5.0), diff(3, 13.0)]), song(2, [diff(0, 12.0)])],
    } as never)

    const result = filterWith({ levelValueMin: 13.0, levelValueMax: 13.0 })
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('等级标签与难度同样按同一谱面判断', () => {
    // S1: BASIC 标签"5" + MASTER 标签"13"  → 查「BASIC + 13」不该命中
    // S2: BASIC 标签"13"                    → 命中
    useSongStore.setState({
      songs: [
        song(1, [diff(0, 5.0, '5'), diff(3, 13.0, '13')]),
        song(2, [diff(0, 13.0, '13')]),
      ],
    } as never)

    const result = filterWith({ difficultyLevels: [0], level: '13' })
    expect(result.map(s => s.id)).toEqual([2])
  })
})

describe('官标与拟合是两套独立条件', () => {
  beforeEach(() => {
    useSongStore.setState({ searchQuery: '', sortBy: 'default', sortOrder: 'desc' } as never)
    mockFitValues.clear()
    // S1 官标 14.0（标签 14） 水鱼拟合 13.2
    // S2 官标 13.0（标签 13） 水鱼拟合 14.2
    // S3 官标 13.5（标签 13+）水鱼拟合 13.2
    // S4 官标 13.6（标签 13+）水鱼拟合 13.9
    useSongStore.setState({
      songs: [
        song(1, [diff(3, 14.0, '14')]),
        song(2, [diff(3, 13.0, '13')]),
        song(3, [diff(3, 13.5, '13+')]),
        song(4, [diff(3, 13.6, '13+')]),
      ],
    } as never)
    mockFitValues.set('1-14', { sssPlus: 13.2, sss: 13.8 })
    mockFitValues.set('2-13', { sssPlus: 14.2, sss: 12.6 })
    mockFitValues.set('3-13+', { sssPlus: 13.2, sss: 13.1 })
    mockFitValues.set('4-13+', { sssPlus: 13.9, sss: 13.9 })
  })

  it('核心场景：官标 13+ 大类里，筛拟合定数 ≤ 13.6', () => {
    // S3：官标 13+ 且拟合 13.2 → 命中
    // S4：官标 13+ 但拟合 13.9 → 排除
    // S1：拟合 13.2 也在区间内，但官标是 14，不属于 13+ 大类 → 排除
    const result = filterWith({ level: '13+', fitDiffSource: 'sssPlus', fitLevelValueMax: 13.6 })
    expect(result.map(s => s.id)).toEqual([3])
  })

  it('只设拟合区间时，官标不参与限制', () => {
    const result = filterWith({ fitDiffSource: 'sssPlus', fitLevelValueMax: 13.4 })
    expect(result.map(s => s.id).sort()).toEqual([1, 3])
  })

  it('只设官标条件时，拟合不参与限制', () => {
    expect(filterWith({ level: '13+' }).map(s => s.id).sort()).toEqual([3, 4])
  })

  it('官标区间与拟合上限同时生效', () => {
    const result = filterWith({
      levelValueMin: 13.5, levelValueMax: 13.6,
      fitDiffSource: 'sssPlus', fitLevelValueMax: 13.5,
    })
    // S3 官标 13.5 / 拟合 13.2 → 命中；S4 官标 13.6 但拟合 13.9 → 排除
    expect(result.map(s => s.id)).toEqual([3])
  })

  it('切换口径会改变拟合条件的判定', () => {
    const result = filterWith({ fitDiffSource: 'sss', fitLevelValueMax: 13.6 })
    // SSS 口径下：S1 13.8 排除、S2 12.6 命中、S3 13.1 命中、S4 13.9 排除
    expect(result.map(s => s.id).sort()).toEqual([2, 3])
  })

  it('未勾选口径时，拟合区间字段不起作用', () => {
    const result = filterWith({ fitLevelValueMax: 13.0 })
    expect(result.map(s => s.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('缺少统计数据的谱面不匹配任何拟合条件', () => {
    mockFitValues.delete('3-13+')
    const result = filterWith({ fitDiffSource: 'sssPlus', fitLevelValueMax: 13.6 })
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('拟合区间填反时不生效（不静默交换两端）', () => {
    const result = filterWith({ fitDiffSource: 'sssPlus', fitLevelValueMin: 14.0, fitLevelValueMax: 13.0 })
    expect(result.map(s => s.id).sort()).toEqual([1, 2, 3, 4])
  })

  it('官标区间填反时同样不生效', () => {
    const result = filterWith({ levelValueMin: 14.0, levelValueMax: 13.0 })
    expect(result.map(s => s.id).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('宴会场收纳', () => {
  beforeEach(() => {
    useSongStore.setState({ searchQuery: '', sortBy: 'default', sortOrder: 'desc' } as never)
    useSongStore.setState({
      songs: [song(1, [diff(3, 13.0)]), song(100001, [diff(3, 0, '?')])],
    } as never)
  })

  it('默认隐藏宴会场曲目（ID ≥ 100000）', () => {
    const result = filterWith({})
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('开启 includeUtage 后宴会场参与列表', () => {
    const result = filterWith({ includeUtage: true })
    expect(result.map(s => s.id).sort()).toEqual([1, 100001])
  })
})
