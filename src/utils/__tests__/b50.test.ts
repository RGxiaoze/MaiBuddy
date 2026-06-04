import { describe, it, expect } from 'vitest'
import { computeB50, computeTheoreticalMaxRating } from '@/utils/b50'
import type { ScoreRecord } from '@/db/database'
import type { Song, ChartDifficulty } from '@/types'

function makeScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 1, songId: 1, songTitle: 'Test', levelIndex: 3, level: '14',
    levelValue: 14.0, songType: 'dx', achievements: 99.0, rate: 'ss',
    dxRating: 0, dxScore: 2700, fcType: null, fsType: null, playDate: '',
    dxScoreDetail: null, createdAt: new Date(),
    ...overrides,
  }
}

function makeDiff(overrides: Partial<ChartDifficulty> = {}): ChartDifficulty {
  return { type: 'standard', levelIndex: 3, level: '14', levelValue: 14.0, noteDesigner: '', notes: null, ...overrides }
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 1, title: 'Test', artist: 'Artist', bpm: 150, from: 'DX', genre: 'POPS', imageUrl: '',
    isNew: false, version: 24000, difficulties: { standard: [makeDiff()], dx: [] },
    ...overrides,
  }
}

describe('computeB50', () => {
  it('空成绩应返回空 B50', () => {
    const result = computeB50([], new Map())
    expect(result.best35).toHaveLength(0)
    expect(result.best15).toHaveLength(0)
    expect(result.totalRating).toBe(0)
  })

  it('单个成绩应正确填充', () => {
    const scores = [makeScore({ songId: 1, dxRating: 200 })]
    const songMap = new Map([[1, makeSong({ id: 1 })]])
    const result = computeB50(scores, songMap)
    expect(result.best35).toHaveLength(1)
    expect(result.totalRating).toBe(200)
  })

  it('新曲和旧曲应分别分入两池', () => {
    const scores = [
      makeScore({ songId: 1, dxRating: 100, levelIndex: 0 }),
      makeScore({ songId: 2, dxRating: 200, levelIndex: 0 }),
    ]
    const songMap = new Map([
      [1, makeSong({ id: 1, isNew: false })],
      [2, makeSong({ id: 2, isNew: true })],
    ])
    const result = computeB50(scores, songMap)
    expect(result.best35).toHaveLength(1)
    expect(result.best15).toHaveLength(1)
    expect(result.best35[0].songId).toBe(1)
    expect(result.best15[0].songId).toBe(2)
  })

  it('同谱面多条成绩应只保留最高达成率', () => {
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, achievements: 99.0 }),
      makeScore({ songId: 1, levelIndex: 3, achievements: 100.0 }),
    ]
    const songMap = new Map([[1, makeSong({ id: 1 })]])
    const result = computeB50(scores, songMap)
    expect(result.best35).toHaveLength(1)
    expect(result.best35[0].achievements).toBe(100.0)
  })

  it('宴会场曲目应被排除', () => {
    const scores = [makeScore({ songId: 100000, dxRating: 500 })]
    const result = computeB50(scores, new Map())
    expect(result.best35).toHaveLength(0)
  })

  it('无 dxRating 时应用公式计算', () => {
    const scores = [makeScore({ songId: 1, dxRating: 0, levelValue: 14.0, achievements: 100.5 })]
    const songMap = new Map([[1, makeSong({ id: 1 })]])
    const result = computeB50(scores, songMap)
    expect(result.totalRating).toBeGreaterThan(0)
  })
})

describe('computeTheoreticalMaxRating', () => {
  it('空曲库应返回 0', () => {
    expect(computeTheoreticalMaxRating([])).toBe(0)
  })

  it('应累加最高定数的前 B35/B15 首', () => {
    const songs: Song[] = []
    for (let i = 1; i <= 60; i++) {
      songs.push(makeSong({ id: i, isNew: i <= 20 }))
    }
    const result = computeTheoreticalMaxRating(songs)
    expect(result).toBeGreaterThan(0)
  })

  it('宴会场曲目应被排除', () => {
    const songs = [makeSong({ id: 100000 })]
    expect(computeTheoreticalMaxRating(songs)).toBe(0)
  })
})
