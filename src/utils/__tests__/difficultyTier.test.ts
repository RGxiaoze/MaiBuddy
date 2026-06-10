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
    // gap = 0.6 (> 0.3, ≤ 0.7) → TARGET_GAP_MODERATE
    expect(realisticTargetAch(14.6, 14.0)).toBe(100.0)
  })

  it('远伸展应返回 99.0 (SS+)', () => {
    // gap = 1.2 (> 0.7, ≤ 1.2) → TARGET_GAP_FAR
    expect(realisticTargetAch(15.2, 14.0)).toBe(99.0)
  })

  it('超远应返回 98.5 (SS)', () => {
    // gap = 1.6 (> 1.2) → fallback
    expect(realisticTargetAch(15.6, 14.0)).toBe(98.5)
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

  // ---- 加权模式（有 targetAchievements） ----

  it('小gap(2%)+水分曲(diff=+2.5) → easy', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 98.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14 }, 100.5)).toBe('easy')
  })

  it('中gap(6%)+平均谱(diff=0) → medium', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 94.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14 }, 100.5)).toBe('medium')
  })

  it('大gap(12%)+水分曲(diff=+2.5) → medium', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 88.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14 }, 100.5)).toBe('medium')
  })

  it('大gap(12%)+硬谱(diff=-2) → hard', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 88.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 }, 100.5)).toBe('hard')
  })

  // ---- 无 chart_stats + targetAchievements（gap 修正） ----

  it('无 stats：99.5% → easy（gap=1 ≤5, 不降级）', () => {
    expect(classifyDifficulty(makeScore({ achievements: 99.5 }), undefined, 100.5)).toBe('easy')
  })

  it('无 stats：98.0% → medium（gap=2.5 ≤5, 不降级）', () => {
    expect(classifyDifficulty(makeScore({ achievements: 98.0 }), undefined, 100.5)).toBe('medium')
  })

  it('无 stats：<98.0% → hard（gap 修正不适用，已为 hard）', () => {
    expect(classifyDifficulty(makeScore({ achievements: 93.0 }), undefined, 100.5)).toBe('hard')
  })

  // ---- 定数梯度：高级别阈值更严 ----

  it('14.5 水分曲+小gap(2%) → medium（阈值上调）', () => {
    const s = makeScore({ levelValue: 14.5, achievements: 98.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14.5 }, 100.5)).toBe('medium')
  })

  it('14.5 平均谱+中gap(6%) → medium', () => {
    const s = makeScore({ levelValue: 14.5, achievements: 94.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.5 }, 100.5)).toBe('medium')
  })

  it('14.5 硬谱+大gap(12%) → hard（未达 0.475 medium 线）', () => {
    const s = makeScore({ levelValue: 14.5, achievements: 88.5 })
    // composite=0.26, mediumThreshold=0.475 → hard
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14.5 }, 100.5)).toBe('hard')
  })

  it('13.0 水分曲+中gap(6%) → easy（阈值不变，0.54 >= 0.65？不，0.54 < 0.65 → medium）', () => {
    const s = makeScore({ levelValue: 13.0, achievements: 94.5 })
    // composite=0.54, easyThreshold=0.65+0=0.65, mediumThreshold=0.35+0=0.35 → medium
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 13.0 }, 100.5)).toBe('medium')
  })

  it('13.0 水分曲+小gap(2%) → easy（阈值不变）', () => {
    const s = makeScore({ levelValue: 13.0, achievements: 98.5 })
    // composite=0.797, easyThreshold=0.65 → easy
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 13.0 }, 100.5)).toBe('easy')
  })

  it('12.0 硬谱+大gap → hard（阈值完全不调整）', () => {
    const s = makeScore({ levelValue: 12.0, achievements: 88.5 })
    // composite=0.26, mediumThreshold=0.35 → hard
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 12.0 }, 100.5)).toBe('hard')
  })
})
