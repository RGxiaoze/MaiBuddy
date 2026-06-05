import { describe, it, expect } from 'vitest'
import { analyzeWeakness, type StatsGetter } from '../weaknessAnalysis'
import type { ScoreRecord } from '@/db/database'

function makeScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    id: 1, songId: 1, songTitle: 'Test', levelIndex: 3, level: '14+',
    levelValue: 14.7, songType: 'dx', achievements: 99.0, rate: 'ssp',
    fcType: null, fsType: null, dxScore: 2000, dxRating: 200,
    dxScoreDetail: null, playDate: '2025-01-01', createdAt: new Date(),
    ...overrides,
  }
}

function makeSongMap(overrides: Record<number, { bpm: number; tap?: number; total?: number }> = {}) {
  const map = new Map()
  for (const [id, cfg] of Object.entries(overrides)) {
    const total = cfg.total ?? 500
    map.set(Number(id), {
      id: Number(id),
      title: `Song ${id}`,
      bpm: cfg.bpm,
      difficulties: {
        standard: [],
        dx: [{
          levelIndex: 3, levelValue: 14.7, level: '14+',
          notes: { tap: cfg.tap ?? 250, hold: 100, slide: 80, break: 20, touch: 5, total },
          noteDesigner: 'Test',
        }],
      },
    })
  }
  return map
}

describe('analyzeWeakness', () => {
  it('returns hasStatsData=false when stats getter returns nothing', () => {
    const scores = [makeScore({ songId: 1 })]

    // Song needs to match chartTag classification
    // 250 tap / 500 total = 0.5 tapPct, bpm 150 → not 交互 (tapPct < 0.60)
    // Check: tapPct=0.5, bpm=150, breakPct=0.04 → 体力 (总物量大) or falls through to 综合
    // Actually with total=500 and bpm=150, total/bpm=3.33 → below 4, so NOT 体力
    // breakPct=0.04 < 0.08, slidePct=0.16 < 0.30, touchPct=0.10 < 0.20, holdPct=0.20 < 0.25
    // → 综合
    const songMap = makeSongMap({ 1: { bpm: 150, tap: 250, total: 500 } })
    const noStats: StatsGetter = () => undefined

    const result = analyzeWeakness(scores, songMap, noStats)
    expect(result.hasStatsData).toBe(false)
    expect(result.assessment).toContain('联网')
  })

  it('detects weak tier when mean residual < −1.5% with N ≥ 5', () => {
    const scores = Array.from({ length: 5 }, (_, i) =>
      makeScore({ songId: i + 1, levelValue: 14.7, achievements: 95.0, level: '14+', songTitle: `Song ${i + 1}` })
    )
    const songMap = makeSongMap(
      Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, { bpm: 150, tap: 250, total: 500 }]))
    )
    // All charts have chartAvg 97.0 → residual = 95 − 97 = −2.0 (weak)
    const stats: StatsGetter = (sid) => ({ avg: 97.0, stdDev: 2.0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.7 })

    const result = analyzeWeakness(scores, songMap, stats)
    expect(result.hasStatsData).toBe(true)

    // Find the 綜合 tag
    const comprehensive = result.tagStats.find(t => t.tag === '综合')
    expect(comprehensive).toBeDefined()
    // 14.x tier should be weak
    const tier14 = comprehensive!.tiers.find(t => t.range === '14.x')
    expect(tier14).toBeDefined()
    expect(tier14!.isWeak).toBe(true)
    expect(tier14!.meanResidual).toBeCloseTo(-2.0, 1)
    expect(tier14!.count).toBe(5)
  })

  it('does not flag weak when N < 5', () => {
    const scores = Array.from({ length: 3 }, (_, i) =>
      makeScore({ songId: i + 1, levelValue: 14.7, achievements: 94.0, level: '14+', songTitle: `Song ${i + 1}` })
    )
    const songMap = makeSongMap(
      Object.fromEntries(Array.from({ length: 3 }, (_, i) => [i + 1, { bpm: 150, tap: 250, total: 500 }]))
    )
    const stats: StatsGetter = (sid) => ({ avg: 97.0, stdDev: 2.0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.7 })

    const result = analyzeWeakness(scores, songMap, stats)
    const comprehensive = result.tagStats.find(t => t.tag === '综合')
    const tier14 = comprehensive!.tiers.find(t => t.range === '14.x')
    expect(tier14!.isWeak).toBe(false) // N=3 < 5
  })

  it('reports balanced assessment when no weak tiers', () => {
    const scores = Array.from({ length: 5 }, (_, i) =>
      makeScore({ songId: i + 1, levelValue: 14.7, achievements: 98.0, level: '14+', songTitle: `Song ${i + 1}` })
    )
    const songMap = makeSongMap(
      Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, { bpm: 150, tap: 250, total: 500 }]))
    )
    const stats: StatsGetter = (sid) => ({ avg: 97.0, stdDev: 2.0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.7 })

    const result = analyzeWeakness(scores, songMap, stats)
    // mean residual = 98.0 − 97.0 = +1.0 (not weak)
    expect(result.assessment).toContain('均衡')
  })

  it('returns top 3 draggers sorted by most negative residual', () => {
    const scores = Array.from({ length: 5 }, (_, i) =>
      makeScore({ songId: i + 1, levelValue: 14.7, achievements: 95.0 - i, level: '14+', songTitle: `Song ${i + 1}` })
    )
    const songMap = makeSongMap(
      Object.fromEntries(Array.from({ length: 5 }, (_, i) => [i + 1, { bpm: 150, tap: 250, total: 500 }]))
    )
    const stats: StatsGetter = (sid) => ({ avg: 97.0, stdDev: 2.0, sssRate: 0, sssPlusRate: 0, apRate: 0, diffFromLevelAvg: 0, fitDiff: 14.7 })

    const result = analyzeWeakness(scores, songMap, stats)
    const comprehensive = result.tagStats.find(t => t.tag === '综合')
    const tier14 = comprehensive!.tiers.find(t => t.range === '14.x')

    // Top 3 draggers should be the 3 with worst residuals
    // Song 5 (achievements=91, residual=-6), Song 4 (92,-5), Song 3 (93,-4)
    expect(tier14!.topDraggers).toHaveLength(3)
    expect(tier14!.topDraggers[0].songId).toBe(5) // worst
    expect(tier14!.topDraggers[1].songId).toBe(4)
    expect(tier14!.topDraggers[2].songId).toBe(3)
  })
})
