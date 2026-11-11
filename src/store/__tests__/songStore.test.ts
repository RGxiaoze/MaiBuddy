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

describe('按拟合定数筛选', () => {
  beforeEach(() => {
    useSongStore.setState({ searchQuery: '', sortBy: 'default', sortOrder: 'desc' } as never)
    mockFitValues.clear()
    // S1 官标 14.0，水鱼拟合 13.2，自算 SSS 拟合 13.8
    // S2 官标 13.0，水鱼拟合 14.2，自算 SSS 拟合 12.6
    useSongStore.setState({
      songs: [song(1, [diff(3, 14.0, '14')]), song(2, [diff(3, 13.0, '13')])],
    } as never)
    mockFitValues.set('1-14', { sssPlus: 13.2, sss: 13.8 })
    mockFitValues.set('2-13', { sssPlus: 14.2, sss: 12.6 })
  })

  it('SSS+ 口径（水鱼 fit_diff）：定数区间按拟合值匹配', () => {
    const result = filterWith({ fitDiffSource: 'sssPlus', levelValueMin: 13.0, levelValueMax: 13.4 })
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('SSS 口径（自算）：同一区间不命中这两首', () => {
    const result = filterWith({ fitDiffSource: 'sss', levelValueMin: 13.0, levelValueMax: 13.4 })
    expect(result.map(s => s.id)).toEqual([])
  })

  it('等级筛选按拟合定数换算：13+ 覆盖 13.5~13.9', () => {
    // S1 自算拟合 13.8 → "13+"；S2 自算拟合 12.6 → "12+"
    const result = filterWith({ fitDiffSource: 'sss', level: '13+' })
    expect(result.map(s => s.id)).toEqual([1])
  })

  it('同一首歌因口径不同落入不同等级档', () => {
    // S1：水鱼 13.2 → "13"，自算 13.8 → "13+"
    expect(filterWith({ fitDiffSource: 'sssPlus', level: '13' }).map(s => s.id)).toEqual([1])
    expect(filterWith({ fitDiffSource: 'sssPlus', level: '13+' }).map(s => s.id)).toEqual([])
  })

  it('拟合值 13.5 归入 13+（含下边界）', () => {
    mockFitValues.set('1-14', { sssPlus: 13.5, sss: 13.5 })
    expect(filterWith({ fitDiffSource: 'sssPlus', level: '13+' }).map(s => s.id)).toEqual([1])
  })

  it('未勾选拟合口径时仍按官标定数', () => {
    expect(filterWith({ level: '14' }).map(s => s.id)).toEqual([1])
    expect(filterWith({ fitDiffSource: undefined, level: '14' }).map(s => s.id)).toEqual([1])
  })

  it('缺少统计数据的谱面不匹配任何拟合筛选', () => {
    mockFitValues.delete('1-14')
    expect(filterWith({ fitDiffSource: 'sssPlus', level: '13' }).map(s => s.id)).toEqual([])
  })

  it('SSS 口径下该谱面算不出拟合值时不匹配', () => {
    mockFitValues.set('1-14', { sssPlus: 13.2 })
    expect(filterWith({ fitDiffSource: 'sss', level: '13+' }).map(s => s.id)).toEqual([])
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
