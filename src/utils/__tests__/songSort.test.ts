import { describe, it, expect } from 'vitest'
import { sortSongs, buildScoreStats } from '../songSort'
import type { Song, ChartDifficulty } from '@/types'

function diff(levelIndex: number, levelValue: number, notes = 1000): ChartDifficulty {
  return {
    type: 'standard', levelIndex: levelIndex as 0 | 1 | 2 | 3 | 4, level: '13', levelValue,
    noteDesigner: '', notes: { total: notes, tap: 0, hold: 0, slide: 0, touch: 0, break: 0 },
  }
}

function song(id: number, diffs: ChartDifficulty[], overrides: Partial<Song> = {}): Song {
  return {
    id, title: `S${id}`, artist: 'a', bpm: 150, from: 'maimai', genre: '舞萌',
    imageUrl: '', isNew: false, difficulties: { standard: diffs, dx: [] },
    ...overrides,
  } as unknown as Song
}

describe('buildScoreStats', () => {
  const songs = [
    song(1, [diff(3, 13.0, 1000)]),
    song(2, [diff(3, 14.0, 500)]),
  ]

  it('取每首的最高达成率', () => {
    const stats = buildScoreStats(songs, [
      { songId: 1, levelIndex: 3, achievements: 98.0, dxScore: 2000 },
      { songId: 1, levelIndex: 3, achievements: 100.5, dxScore: 2100 },
    ])
    expect(stats.get(1)?.achievements).toBe(100.5)
  })

  it('DX 分数率 = dxScore ÷ (总物量 × 3)，取最高', () => {
    // 总物量 1000 → 满分 3000
    const stats = buildScoreStats(songs, [
      { songId: 1, levelIndex: 3, achievements: 99.0, dxScore: 2400 },
      { songId: 1, levelIndex: 3, achievements: 98.0, dxScore: 2700 },
    ])
    expect(stats.get(1)?.dxScoreRate).toBeCloseTo(0.9, 5)
  })

  it('未游玩曲目不在结果里', () => {
    const stats = buildScoreStats(songs, [])
    expect(stats.size).toBe(0)
  })
})

describe('sortSongs', () => {
  const songs = [
    song(1, [diff(3, 13.0)], { releaseDate: '2024-01-01' }),
    song(2, [diff(3, 14.5)], { releaseDate: '2025-01-01' }),
    song(3, [diff(3, 12.0)], { releaseDate: '2023-01-01' }),
  ]
  const stats = new Map([
    [1, { achievements: 99.0, dxScoreRate: 0.8 }],
    [2, { achievements: 97.5, dxScoreRate: 0.95 }],
  ])

  it('按定数降序（默认）', () => {
    expect(sortSongs(songs, { sortBy: 'default', sortOrder: 'desc' }).map(s => s.id)).toEqual([2, 1, 3])
  })

  it('按成绩降序：已游玩在前，未游玩排最后', () => {
    expect(sortSongs(songs, { sortBy: 'achievements', sortOrder: 'desc', scoreStats: stats }).map(s => s.id))
      .toEqual([1, 2, 3])
  })

  it('按成绩升序：同样把未游玩排最后', () => {
    expect(sortSongs(songs, { sortBy: 'achievements', sortOrder: 'asc', scoreStats: stats }).map(s => s.id))
      .toEqual([2, 1, 3])
  })

  it('按 DX 分数降序', () => {
    expect(sortSongs(songs, { sortBy: 'dxScoreRate', sortOrder: 'desc', scoreStats: stats }).map(s => s.id))
      .toEqual([2, 1, 3])
  })

  it('缺省 scoreStats 时不报错，按 id 稳定排列', () => {
    const out = sortSongs(songs, { sortBy: 'achievements', sortOrder: 'desc' })
    expect(out).toHaveLength(3)
  })

  // 界面上「添加日期」= 曲目实装日期（水鱼无数据，来自落雪 release_date）
  it('按添加日期（实装日期）降序：新曲在前', () => {
    expect(sortSongs(songs, { sortBy: 'releaseDate', sortOrder: 'desc' }).map(s => s.id)).toEqual([2, 1, 3])
  })

  it('按添加日期（实装日期）升序：老曲在前', () => {
    expect(sortSongs(songs, { sortBy: 'releaseDate', sortOrder: 'asc' }).map(s => s.id)).toEqual([3, 1, 2])
  })

  it('缺日期的曲目排在最后', () => {
    const withMissing = [...songs, song(4, [diff(3, 13.0)])]
    expect(sortSongs(withMissing, { sortBy: 'releaseDate', sortOrder: 'desc' }).map(s => s.id).at(-1)).toBe(4)
  })

  it('都没成绩时按实装日期兜底', () => {
    const empty = new Map<number, { achievements: number; dxScoreRate: number }>()
    expect(sortSongs(songs, { sortBy: 'achievements', sortOrder: 'desc', scoreStats: empty }).map(s => s.id))
      .toEqual([2, 1, 3])
  })

  it('不修改输入数组', () => {
    const input = [...songs]
    sortSongs(input, { sortBy: 'achievements', sortOrder: 'desc', scoreStats: stats })
    expect(input.map(s => s.id)).toEqual([1, 2, 3])
  })
})
