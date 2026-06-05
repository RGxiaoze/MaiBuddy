import { describe, it, expect } from 'vitest'
import { computeAchievementMetrics } from '../achievementMetrics'
import type { ScoreRecord } from '@/db/database'

function makeScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 1,
    songId: 1,
    songTitle: 'Test',
    levelIndex: 3,
    level: '14+',
    levelValue: 14.7,
    songType: 'dx',
    achievements: 99.0,
    rate: 'ssp',
    fcType: null,
    fsType: null,
    dxScore: 2000,
    dxRating: 200,
    dxScoreDetail: null,
    playDate: '2025-01-01',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('computeAchievementMetrics', () => {
  it('returns zeroes for empty scores', () => {
    const result = computeAchievementMetrics([], 15000, 16000)
    expect(result.apCount).toBe(0)
    expect(result.sssPlusCount).toBe(0)
    expect(result.ratingProgress).toBeCloseTo(93.75, 1)
    expect(result.levelDist.every(d => d.count === 0)).toBe(true)
  })

  it('counts AP correctly', () => {
    const scores = [
      makeScore({ fcType: 'ap', achievements: 100.0, levelValue: 14.0 }),
      makeScore({ fcType: 'app', achievements: 101.0, levelValue: 14.5 }),
      makeScore({ fcType: 'fc', achievements: 99.0, levelValue: 14.0 }),
    ]
    const result = computeAchievementMetrics(scores, 15000, 16000)
    expect(result.apCount).toBe(2)
  })

  it('counts SSS+ correctly', () => {
    const scores = [
      makeScore({ achievements: 100.5, levelValue: 14.0 }),
      makeScore({ achievements: 101.0, levelValue: 14.5 }),
      makeScore({ achievements: 100.4999, levelValue: 14.0 }),
    ]
    const result = computeAchievementMetrics(scores, 15000, 16000)
    expect(result.sssPlusCount).toBe(2)
  })

  it('computes rating progress', () => {
    const result = computeAchievementMetrics([], 15000, 16000)
    expect(result.ratingProgress).toBe(93.75)
  })

  it('handles zero theoretical max', () => {
    const result = computeAchievementMetrics([makeScore()], 15000, 0)
    expect(result.ratingProgress).toBe(0)
  })

  it('groups level distribution into 4 tiers', () => {
    const scores = [
      makeScore({ songId: 1, levelValue: 13.5, achievements: 99.0 }),
      makeScore({ songId: 2, levelValue: 13.8, achievements: 98.0 }),
      makeScore({ songId: 3, levelValue: 14.2, achievements: 97.0 }),
      makeScore({ songId: 4, levelValue: 14.5, achievements: 96.0 }),
      makeScore({ songId: 5, levelValue: 14.7, achievements: 95.0 }),
      makeScore({ songId: 6, levelValue: 14.9, achievements: 94.0 }),
      makeScore({ songId: 7, levelValue: 15.0, achievements: 93.0 }),
    ]
    const result = computeAchievementMetrics(scores, 15000, 16000)

    expect(result.levelDist).toHaveLength(4)

    // 13.x: songs 1,2 → avg (99+98)/2 = 98.5
    expect(result.levelDist[0].range).toBe('13.x')
    expect(result.levelDist[0].count).toBe(2)
    expect(result.levelDist[0].avgAch).toBeCloseTo(98.5, 1)

    // 14.0-14.5: songs 3,4 → avg (97+96)/2 = 96.5
    expect(result.levelDist[1].range).toBe('14.0–14.5')
    expect(result.levelDist[1].count).toBe(2)
    expect(result.levelDist[1].avgAch).toBeCloseTo(96.5, 1)

    // 14.6-14.9: songs 5,6 → avg (95+94)/2 = 94.5
    expect(result.levelDist[2].range).toBe('14.6–14.9')
    expect(result.levelDist[2].count).toBe(2)
    expect(result.levelDist[2].avgAch).toBeCloseTo(94.5, 1)

    // 15.0+: song 7 → avg 93
    expect(result.levelDist[3].range).toBe('15.0+')
    expect(result.levelDist[3].count).toBe(1)
    expect(result.levelDist[3].avgAch).toBeCloseTo(93, 1)
  })

  it('uses all scores regardless of achievements', () => {
    const scores = [
      makeScore({ songId: 1, levelValue: 13.5, achievements: 50.0 }),
    ]
    const result = computeAchievementMetrics(scores, 0, 100)
    expect(result.levelDist[0].count).toBe(1)
    expect(result.sssPlusCount).toBe(0)
  })
})
