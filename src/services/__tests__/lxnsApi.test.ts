import { describe, it, expect } from 'vitest'
import { toDfScores } from '../lxnsApi'
import type { LxnsScore, Song } from '@/types'

function diff(levelIndex: number, level: string, levelValue: number) {
  return { type: 'standard' as const, levelIndex, level, levelValue, noteDesigner: '', notes: null }
}

function song(id: number, standard: ReturnType<typeof diff>[], dx: ReturnType<typeof diff>[] = []): Song {
  return {
    id, title: `Song ${id}`, artist: 'a', bpm: 150, from: 'maimai', genre: '舞萌',
    imageUrl: '', isNew: false,
    difficulties: { standard, dx },
  } as unknown as Song
}

const map = new Map<number, Song>([
  [1, song(1, [diff(3, '13+', 13.7)], [diff(3, '14', 14.0)])],
  [2, song(2, [diff(0, '5', 5.0)])],
])

function raw(overrides: Partial<LxnsScore>): LxnsScore {
  return { song_id: 1, level_index: 3, achievements: 100.5, ...overrides } as LxnsScore
}

describe('toDfScores', () => {
  it('正常转换为内部结构，定数从曲库补齐', () => {
    const out = toDfScores([raw({ dx_rating: 320, dx_score: 2500, rate: 'sssp', fc: 'fc', fs: 'sync' })], map)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      songId: 1,
      title: 'Song 1',
      levelIndex: 3,
      level: '13+',
      levelValue: 13.7,
      songType: 'standard',
      achievements: 100.5,
      dxRating: 320,
      dxScore: 2500,
      rate: 'sssp',
      fcType: 'fc',
      fsType: 'sync',
    })
  })

  it('type=dx 时取 dx 难度谱面', () => {
    const out = toDfScores([raw({ type: 'dx' })], map)
    expect(out[0].songType).toBe('dx')
    expect(out[0].levelValue).toBe(14.0)
  })

  it('曲库中找不到该曲目时跳过', () => {
    const out = toDfScores([raw({ song_id: 999 })], map)
    expect(out).toHaveLength(0)
  })

  it('找不到对应难度时跳过', () => {
    const out = toDfScores([raw({ level_index: 4 })], map)
    expect(out).toHaveLength(0)
  })

  it('缺少关键字段的脏数据被跳过', () => {
    const out = toDfScores([
      { song_id: 1, level_index: 3 } as LxnsScore,
      { level_index: 3, achievements: 100 } as LxnsScore,
    ], map)
    expect(out).toHaveLength(0)
  })

  it('缺失的可选字段给默认值', () => {
    const out = toDfScores([raw({})], map)
    expect(out[0].dxRating).toBe(0)
    expect(out[0].dxScore).toBe(0)
    expect(out[0].rate).toBe('')
    expect(out[0].fcType).toBeNull()
    expect(out[0].fsType).toBeNull()
  })

  it('level 字段优先用落雪返回值', () => {
    const out = toDfScores([raw({ level: '13' })], map)
    expect(out[0].level).toBe('13')
  })
})
