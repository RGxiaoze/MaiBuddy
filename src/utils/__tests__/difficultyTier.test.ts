import { describe, it, expect } from 'vitest'
import { realisticTargetAch, classifyDifficulty } from '@/utils/difficultyTier'
import type { ScoreRecord } from '@/db/database'
import { MAX_ACHIEVEMENTS } from '@/config/algorithms'

function makeScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 1, songId: 1, songTitle: 'Test', levelIndex: 3, level: '14',
    levelValue: 14.0, songType: 'dx', achievements: 99.0, rate: 'ss',
    dxRating: 0, dxScore: 2700, fcType: null, fsType: null, playDate: '',
    dxScoreDetail: null, createdAt: new Date(),
    ...overrides,
  }
}

describe('realisticTargetAch', () => {
  it('远低于舒适区应返回天花板', () => {
    expect(realisticTargetAch(13.5, 14.0)).toBe(MAX_ACHIEVEMENTS)
  })

  it('舒适区内应返回天花板', () => {
    expect(realisticTargetAch(14.0, 14.0)).toBe(MAX_ACHIEVEMENTS)
  })

  it('紧凑伸展应返回天花板', () => {
    expect(realisticTargetAch(14.2, 14.0)).toBe(MAX_ACHIEVEMENTS)
  })

  it('中度伸展应返回 100.0 (SSS)', () => {
    expect(realisticTargetAch(14.4, 14.0)).toBe(100.0)
  })

  it('远伸展应返回 99.0 (SS)', () => {
    expect(realisticTargetAch(14.8, 14.0)).toBe(99.0)
  })

  it('超远应返回 98.5 (SS+)', () => {
    expect(realisticTargetAch(15.5, 14.0)).toBe(98.5)
  })

  it('舒适区为 0 时鸿沟极大应返回回退值', () => {
    // gap = 13.0 > 1.0 → 回退达成率
    expect(realisticTargetAch(13.0, 0)).toBe(98.5)
  })
})

describe('classifyDifficulty', () => {
  it('无 chart_stats 时，≥99.5% → easy', () => {
    expect(classifyDifficulty(makeScore({ achievements: 99.5 }))).toBe('easy')
  })

  it('无 chart_stats 时，98.0-99.4% → medium', () => {
    expect(classifyDifficulty(makeScore({ achievements: 98.0 }))).toBe('medium')
  })

  it('无 chart_stats 时，<98.0% → hard', () => {
    expect(classifyDifficulty(makeScore({ achievements: 97.0 }))).toBe('hard')
  })

  it('15 级谱面永远为 hard', () => {
    const s = makeScore({ levelValue: 15.0, achievements: 100.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 5, fitDiff: 15 })).toBe('hard')
  })

  it('大水分曲（diff > 2.0）→ easy', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 3.0, fitDiff: 14 })).toBe('easy')
  })

  it('硬谱（diff ≤ -1.0）→ hard', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 })).toBe('hard')
  })

  it('高 SSS+ 率可将 hard 提升至 medium', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0.2, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 })).toBe('medium')
  })
})
