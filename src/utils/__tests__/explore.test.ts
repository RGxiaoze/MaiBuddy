import { describe, it, expect } from 'vitest'
import { buildExplorePool, smoothWinRate } from '../explore'
import type { Song } from '@/types'

function makeDiff(levelIndex: number, levelValue: number, level = '13'): {
  type: 'standard'; levelIndex: number; level: string; levelValue: number; noteDesigner: string; notes: null
} {
  return { type: 'standard', levelIndex, level, levelValue, noteDesigner: 'Jack', notes: null }
}

function makeSong(id: number, title: string, diffs: ReturnType<typeof makeDiff>[]): Song {
  return {
    id, title, artist: 'artist', bpm: 150, from: 'maimai',
    genre: '舞萌', imageUrl: '', isNew: false,
    difficulties: { standard: diffs, dx: [] },
  } as unknown as Song
}

const vote = (winRate: number, totalVote: number) => ({
  winRate, totalVote, upVote: Math.round(winRate * totalVote),
})

describe('smoothWinRate', () => {
  it('小样本被拉向先验，不会霸榜', () => {
    // 3 票全胜：原始 1.0，平滑后应显著低于 1.0
    expect(smoothWinRate(3, 3)).toBeLessThan(0.7)
  })

  it('大样本基本保持原值', () => {
    const r = smoothWinRate(5300, 7439)
    expect(r).toBeGreaterThan(0.65)
    expect(r).toBeLessThan(0.75)
  })

  it('大样本始终排在同样原始胜率的小样本之上', () => {
    expect(smoothWinRate(6000, 8000)).toBeGreaterThan(smoothWinRate(3, 3))
  })
})

describe('buildExplorePool', () => {
  it('排除已游玩谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)], [2, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(['1-3']), votes, { minVotes: 30 })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('排除无投票数据的谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(pool.map(p => p.songId)).toEqual([1])
  })

  it('排除票数低于阈值的谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(1.0, 5)], [2, vote(0.5, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('给定难度区间时只保留区间内谱面', () => {
    const songs = [
      makeSong(1, 'A', [makeDiff(2, 11)]),
      makeSong(2, 'B', [makeDiff(3, 13)]),
      makeSong(3, 'C', [makeDiff(3, 14.8)]),
    ]
    const votes = new Map([[1, vote(0.6, 500)], [2, vote(0.6, 500)], [3, vote(0.6, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, minLevel: 12.5, maxLevel: 13.5 })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('按平滑胜率降序排列', () => {
    const songs = [
      makeSong(1, 'low', [makeDiff(3, 13)]),
      makeSong(2, 'high', [makeDiff(3, 13)]),
      makeSong(3, 'mid', [makeDiff(3, 13)]),
    ]
    const votes = new Map([[1, vote(0.30, 800)], [2, vote(0.70, 800)], [3, vote(0.50, 800)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(pool.map(p => p.songId)).toEqual([2, 3, 1])
  })

  it('同一首歌只保留难度索引最大的一个（避免同曲霸榜）', () => {
    const songs = [makeSong(1, 'A', [makeDiff(2, 12), makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.6, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(pool).toHaveLength(1)
    expect(pool[0].levelIndex).toBe(3)
  })

  it('去重后仍按胜率排序', () => {
    const songs = [
      makeSong(1, 'A', [makeDiff(2, 12), makeDiff(3, 13)]),
      makeSong(2, 'B', [makeDiff(3, 13)]),
    ]
    const votes = new Map([[1, vote(0.4, 500)], [2, vote(0.8, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(pool.map(p => p.songId)).toEqual([2, 1])
  })

  it('limit 限制返回条数', () => {
    const songs = Array.from({ length: 30 }, (_, i) => makeSong(i + 1, `S${i}`, [makeDiff(3, 13)]))
    const votes = new Map(songs.map((s, i) => [s.id, vote(0.5 + i * 0.001, 500)]))
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, limit: 10 })
    expect(pool).toHaveLength(10)
  })

  it('携带谱面元信息供卡片展示', () => {
    const songs = [makeSong(1, 'Song A', [makeDiff(3, 13.4, '13+')])]
    const votes = new Map([[1, vote(0.7, 500)]])
    const [item] = buildExplorePool(songs, new Set(), votes, { minVotes: 30 })
    expect(item).toMatchObject({
      songId: 1, title: 'Song A', levelIndex: 3, level: '13+',
      levelValue: 13.4, noteDesigner: 'Jack', totalVote: 500,
    })
    expect(item.winRate).toBeCloseTo(0.7, 5)
  })
})
