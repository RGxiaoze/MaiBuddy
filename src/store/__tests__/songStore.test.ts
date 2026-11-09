import { describe, it, expect, beforeEach } from 'vitest'
import { useSongStore } from '../songStore'
import type { Song } from '@/types'

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

    const result = filterWith({ difficultyLevel: 0, levelValueMin: 13.0, levelValueMax: 13.0 })
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

    const result = filterWith({ difficultyLevel: 0, level: '13' })
    expect(result.map(s => s.id)).toEqual([2])
  })
})
