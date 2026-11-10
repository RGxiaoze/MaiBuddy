import { describe, it, expect } from 'vitest'
import { realisticTargetAch, classifyDifficulty, typicalAchievement, realisticTargetAchFor } from '@/utils/difficultyTier'
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
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 5, fitDiff: 15 })).toBe('hard')
  })

  it('大水分曲（diff > 2.0）→ easy', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 3.0, fitDiff: 14 })).toBe('easy')
  })

  it('硬谱（diff ≤ -1.0）→ hard', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 })).toBe('hard')
  })

  it('高 SSS+ 率可将 hard 提升至 medium', () => {
    const s = makeScore({ levelValue: 14.0 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0.2, cumSssRate: 0.2, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 })).toBe('medium')
  })

  // ---- 加权模式（有 targetAchievements） ----

  it('小gap(2%)+水分曲(diff=+2.5) → medium（gap 2 > 1.0 抬到适中）', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 98.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14 }, 100.5)).toBe('medium')
  })

  it('中gap(6%)+平均谱(diff=0) → hard（gap 6 > 3.0 抬到挑战）', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 94.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14 }, 100.5)).toBe('hard')
  })

  it('大gap(12%)+水分曲(diff=+2.5) → hard（差距过大，全服好打也不改变）', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 88.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14 }, 100.5)).toBe('hard')
  })

  it('大gap(12%)+硬谱(diff=-2) → hard', () => {
    const s = makeScore({ levelValue: 14.0, achievements: 88.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14 }, 100.5)).toBe('hard')
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
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 14.5 }, 100.5)).toBe('medium')
  })

  it('14.5 平均谱+中gap(6%) → hard（差距过大）', () => {
    const s = makeScore({ levelValue: 14.5, achievements: 94.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.5 }, 100.5)).toBe('hard')
  })

  it('14.5 硬谱+大gap(12%) → hard（未达 0.475 medium 线）', () => {
    const s = makeScore({ levelValue: 14.5, achievements: 88.5 })
    // composite=0.26, mediumThreshold=0.475 → hard
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 14.5 }, 100.5)).toBe('hard')
  })

  it('13.0 水分曲+中gap(6%) → hard（差距过大）', () => {
    const s = makeScore({ levelValue: 13.0, achievements: 94.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 13.0 }, 100.5)).toBe('hard')
  })

  it('13.0 水分曲+小gap(2%) → medium（gap 2 > 1.0 抬到适中）', () => {
    const s = makeScore({ levelValue: 13.0, achievements: 98.5 })
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: 2.5, fitDiff: 13.0 }, 100.5)).toBe('medium')
  })

  it('12.0 硬谱+大gap → hard（阈值完全不调整）', () => {
    const s = makeScore({ levelValue: 12.0, achievements: 88.5 })
    // composite=0.26, mediumThreshold=0.35 → hard
    expect(classifyDifficulty(s, { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0, diffFromLevelAvg: -2.0, fitDiff: 12.0 }, 100.5)).toBe('hard')
  })

  // ---- 差距下限：只看「你还差多远」，与全服数据无关 ----

  const easyStats = { avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0.3, cumSssRate: 0.3, apRate: 0, diffFromLevelAvg: 3.5, fitDiff: 14.1 }

  it('差距 1.8%：全服都说好打，也至少是「适中」', () => {
    // 好友反馈的真实案例：98.7% → 100.5%，原本被标成「轻松」
    const s = makeScore({ levelValue: 14.1, achievements: 98.7 })
    expect(classifyDifficulty(s, easyStats, 100.5)).toBe('medium')
  })

  it('差距 3.2%：直接「挑战」', () => {
    const s = makeScore({ levelValue: 14.1, achievements: 97.3 })
    expect(classifyDifficulty(s, easyStats, 100.5)).toBe('hard')
  })

  it('差距 0.3%：维持「轻松」', () => {
    const s = makeScore({ levelValue: 14.1, achievements: 100.2 })
    expect(classifyDifficulty(s, easyStats, 100.5)).toBe('easy')
  })

  it('未传目标时不应用差距下限（保持原有行为）', () => {
    const s = makeScore({ levelValue: 14.1, achievements: 97.0 })
    expect(classifyDifficulty(s, easyStats)).toBe('easy')
  })
})

// ---- 方案 C：用玩家自己的成绩定目标 ----

const levelSamples = (achievements: number[], levelValue = 14.1) =>
  achievements.map((a, i) => ({ levelValue, achievements: a, key: `s${i}-3` }))

describe('typicalAchievement', () => {
  it('取定数附近成绩的中位数', () => {
    expect(typicalAchievement(14.1, levelSamples([98.0, 98.5, 99.0, 99.5, 99.9]))).toBe(99.0)
  })

  it('只统计窗口内的样本（±0.3）', () => {
    const samples = [
      ...levelSamples([98.0, 98.5, 99.0, 99.5, 99.9]),
      { levelValue: 15.0, achievements: 80.0, key: 'far-3' }, // 窗口外
    ]
    expect(typicalAchievement(14.1, samples)).toBe(99.0)
  })

  it('样本不足 5 条时返回 null（不信中位数）', () => {
    expect(typicalAchievement(14.1, levelSamples([98.0, 98.5, 99.0]))).toBeNull()
  })

  it('可排除指定谱面，避免自身成绩抬高基准', () => {
    const samples = levelSamples([98.0, 98.5, 99.0, 99.5, 100.5])
    expect(typicalAchievement(14.1, samples)).toBe(99.0)
    // 排除那条 100.5 后剩 4 条 → 不足样本数
    expect(typicalAchievement(14.1, samples, 's4-3')).toBeNull()
  })
})

describe('realisticTargetAchFor', () => {
  it('目标受玩家典型成绩约束：典型 98% → 天花板 98.5%', () => {
    const samples = levelSamples([97.8, 98.0, 98.0, 98.2, 98.4])
    expect(realisticTargetAchFor(14.1, 14.1, samples)).toBeCloseTo(98.5, 5)
  })

  it('玩家水平够高时不压低目标', () => {
    const samples = levelSamples([100.2, 100.4, 100.5, 100.5, 100.5])
    expect(realisticTargetAchFor(14.1, 14.1, samples)).toBe(100.5)
  })

  it('样本不足时退回到档位规则', () => {
    // 定数远高于舒适区（gap 1.0）→ 档位规则给 99.0
    expect(realisticTargetAchFor(15.0, 14.0, levelSamples([98.0, 98.5]))).toBe(99.0)
  })

  it('不传样本时行为与旧规则一致', () => {
    expect(realisticTargetAchFor(15.0, 14.0)).toBe(realisticTargetAch(15.0, 14.0))
  })
})
