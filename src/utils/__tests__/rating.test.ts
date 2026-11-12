// ============================================================
// Rating utility unit tests (TDD)
// ============================================================

import { describe, it, expect } from 'vitest'
import { computeRating, AP_RATING_BONUS_ENABLED } from '@/utils/rating'
import { computeB50, computeTheoreticalMaxRating, computeTheoreticalMaxBoth } from '@/utils/b50'
import { applyLevelQuota, computePushSuggestions, computeRecommendCaps, isSimpleChart } from '@/utils/pushSuggestions'
import type { PushSuggestion } from '@/utils/pushSuggestions'
import { SIMPLE_TARGET_FLOOR } from '@/config/algorithms'
import type { ScoreRecord } from '@/db/database'
import type { Song, ChartDifficulty } from '@/types'

// ---- Helpers ----

function makeDiff(overrides: Partial<ChartDifficulty> = {}): ChartDifficulty {
  return {
    type: 'dx', levelIndex: 3, level: '14', levelValue: 14.0,
    noteDesigner: 'Test',
    notes: { total: 500, tap: 250, hold: 100, slide: 50, touch: 50, break: 50 },
    ...overrides,
  } as ChartDifficulty
}

function makeScore(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    songId: 1, songTitle: 'Test Song', levelIndex: 3, level: '14', levelValue: 14.0,
    songType: 'dx', achievements: 100.0, rate: 'SSS',
    fcType: null, fsType: null, dxScore: 3000, dxRating: 0,
    dxScoreDetail: null, playDate: '2026-01-01', createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeSong(overrides: Partial<Song> & { id: number }): Song {
  const { id, ...rest } = overrides
  return {
    id, title: 'Test Song', artist: 'Test Artist', bpm: 150,
    genre: 'テスト', from: '舞萌2025', version: 25000,
    isNew: false, imageUrl: '',
    difficulties: { standard: [], dx: [makeDiff()] },
    ...rest,
  }
}

/** Fill a B50 pool to capacity with filler songs */
function fillPool(startId: number, count: number, isNew: boolean, lv: number, baseAch: number) {
  const songs = new Map<number, Song>()
  const scores: ScoreRecord[] = []
  for (let i = 0; i < count; i++) {
    const id = startId + i
    songs.set(id, makeSong({ id, isNew, difficulties: { standard: [], dx: [makeDiff({ levelValue: lv })] } }))
    scores.push(makeScore({ songId: id, levelIndex: 3, levelValue: lv, achievements: baseAch + i * 0.01 }))
  }
  return { songs, scores }
}

// ---- computeRating ----

describe('computeRating', () => {
  it('returns 0 for invalid inputs', () => {
    expect(computeRating(13.0, 0)).toBe(0)
    expect(computeRating(13.0, -1)).toBe(0)
    expect(computeRating(0, 97.0)).toBe(0)
  })

  it('caps achievements at 100.5%', () => {
    expect(computeRating(14.0, 101.0)).toBe(computeRating(14.0, 100.5))
  })

  it('uses correct coefficients', () => {
    expect(computeRating(13.0, 100.5)).toBe(Math.floor(22.4 * 13.0 * 100.5 / 100))
    expect(computeRating(12.0, 97.0)).toBe(Math.floor(20.0 * 12.0 * 97.0 / 100))
  })

  it('monotonic: higher achievement → >= rating', () => {
    const lv = 13.5
    const r = [80, 90, 94, 97, 98, 99, 99.5, 100, 100.5].map(a => computeRating(lv, a))
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1])
  })

  // ---- AP bonus（国服未实装 → 开关关闭，无加成）----

  it('AP 加成开关应处于关闭状态（国服未实装）', () => {
    expect(AP_RATING_BONUS_ENABLED).toBe(false)
  })

  it('开关关闭：fcType=ap 不加分', () => {
    expect(computeRating(14.0, 100.5, 'ap')).toBe(computeRating(14.0, 100.5))
    expect(computeRating(13.0, 97.0, 'ap')).toBe(computeRating(13.0, 97.0))
  })

  it('treats fcType=app same as ap', () => {
    expect(computeRating(14.0, 100.5, 'app')).toBe(computeRating(14.0, 100.5, 'ap'))
  })

  it('does NOT add bonus for fcType=fc / null / undefined', () => {
    const base = computeRating(14.0, 100.5)
    expect(computeRating(14.0, 100.5, 'fc')).toBe(base)
    expect(computeRating(14.0, 100.5, null)).toBe(base)
    expect(computeRating(14.0, 100.5, undefined)).toBe(base)
  })

  it('applies AP bonus after achievement cap', () => {
    // 达成率截断后应用（若开关重新开启，该断言仍成立）
    expect(computeRating(14.0, 101.0, 'ap')).toBe(computeRating(14.0, 100.5, 'ap'))
  })
})

// ---- computeB50 ----

describe('computeB50', () => {
  it('returns empty for empty scores', () => {
    const r = computeB50([], new Map())
    expect(r.best35).toHaveLength(0)
    expect(r.totalRating).toBe(0)
  })

  it('deduplicates keeping highest achievement', () => {
    const s = [makeScore({ songId: 1, achievements: 97 }), makeScore({ songId: 1, achievements: 99.5 })]
    const r = computeB50(s, new Map([[1, makeSong({ id: 1 })]]))
    expect(r.best35[0].achievements).toBe(99.5)
  })

  it('splits old/new pools', () => {
    const m = new Map([[1, makeSong({ id: 1, isNew: false })], [2, makeSong({ id: 2, isNew: true })]])
    const r = computeB50([makeScore({ songId: 1 }), makeScore({ songId: 2 })], m)
    expect(r.best35[0].songId).toBe(1)
    expect(r.best15[0].songId).toBe(2)
  })

  it('excludes utage', () => {
    const r = computeB50([makeScore({ songId: 100001 })], new Map([[100001, makeSong({ id: 100001 })]]))
    expect(r.best35).toHaveLength(0)
  })

  it('limits to 35/15', () => {
    const m = new Map<number, Song>()
    const s: ScoreRecord[] = []
    for (let i = 1; i <= 40; i++) { m.set(i, makeSong({ id: i })); s.push(makeScore({ songId: i, achievements: 97 + i * 0.05 })) }
    for (let i = 41; i <= 60; i++) { m.set(i, makeSong({ id: i, isNew: true })); s.push(makeScore({ songId: i, achievements: 97 + i * 0.05 })) }
    const r = computeB50(s, m)
    expect(r.best35).toHaveLength(35)
    expect(r.best15).toHaveLength(15)
  })

  it('totalRating = sum of pools', () => {
    const m = new Map([[1, makeSong({ id: 1 })], [2, makeSong({ id: 2, isNew: true })]])
    const r = computeB50([makeScore({ songId: 1 }), makeScore({ songId: 2 })], m)
    expect(r.totalRating).toBe(r.best35Total + r.best15Total)
  })
})

// ---- computeTheoreticalMaxRating ----

describe('computeTheoreticalMaxRating', () => {
  it('returns 0 for empty songs', () => {
    expect(computeTheoreticalMaxRating([])).toBe(0)
  })

  it('uses coefficient 22.4 at 100.5%', () => {
    const song = makeSong({ id: 1, isNew: false, difficulties: {
      standard: [], dx: [makeDiff({ levelValue: 14.0 })]
    }})
    const expected = computeRating(14.0, 100.5)
    expect(computeTheoreticalMaxRating([song])).toBe(expected)
  })

  it('excludes utage songs', () => {
    expect(computeTheoreticalMaxRating([
      makeSong({ id: 100001, isNew: false, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 15.0 })]
      }})
    ])).toBe(0)
  })

  it('picks the highest-difficulty chart per song', () => {
    const song = makeSong({
      id: 1, isNew: false,
      difficulties: {
        standard: [{ ...makeDiff(), levelIndex: 2, levelValue: 10.0 }],
        dx: [makeDiff({ levelValue: 14.0 })],
      }
    })
    const result = computeTheoreticalMaxRating([song])
    expect(result).toBe(computeRating(14.0, 100.5))
  })

  it('caps old pool at 35 and new pool at 15', () => {
    const songs: Song[] = []
    for (let i = 1; i <= 40; i++) {
      songs.push(makeSong({ id: i, isNew: false, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 + i * 0.01 })]
      }}))
    }
    for (let i = 41; i <= 60; i++) {
      songs.push(makeSong({ id: i, isNew: true, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 + i * 0.01 })]
      }}))
    }
    const result = computeTheoreticalMaxRating(songs)
    let expected = 0
    for (let i = 40; i >= 6; i--) {
      expected += computeRating(14.0 + i * 0.01, 100.5)
    }
    for (let i = 60; i >= 46; i--) {
      expected += computeRating(14.0 + i * 0.01, 100.5)
    }
    expect(result).toBe(expected)
  })
})

// ---- computeTheoreticalMaxBoth ----

describe('computeTheoreticalMaxBoth', () => {
  it('returns 0/0 for empty songs', () => {
    const r = computeTheoreticalMaxBoth([])
    expect(r.sssPlusMax).toBe(0)
    expect(r.apMax).toBe(0)
  })

  it('apMax = sssPlusMax + entryCount', () => {
    const songs: Song[] = []
    for (let i = 1; i <= 10; i++) {
      songs.push(makeSong({ id: i, isNew: false, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 })]
      }}))
    }
    const r = computeTheoreticalMaxBoth(songs)
    expect(r.apMax).toBe(r.sssPlusMax + 10) // 10 songs → 10 B50 entries → +10 AP
  })

  it('AP bonus limited to actual B50 entries (not total songs)', () => {
    // 100 old songs → only top 35 in B50
    const songs: Song[] = []
    for (let i = 1; i <= 100; i++) {
      songs.push(makeSong({ id: i, isNew: false, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 + i * 0.01 })]
      }}))
    }
    const r = computeTheoreticalMaxBoth(songs)
    const diff = r.apMax - r.sssPlusMax
    expect(diff).toBe(35) // capped at B35_SIZE
  })
})

// ---- computePushSuggestions ----

describe('computePushSuggestions', () => {
  it('returns empty when B50 is empty', () => {
    const empty = { best35: [], best15: [], best35Total: 0, best15Total: 0, totalRating: 0 }
    expect(computePushSuggestions(empty, new Map()).suggestions).toEqual([])
  })

  it('suggests chart not in B50 whose potential beats floor', () => {
    // Fill B35 to 35 with 13.8 filler → B1=13.8，硬上限 14.0
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Candidate at 14.0 / 94%（落在上限内，低于 B50 地板）
    const cand = makeSong({ id: 999, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    songs.set(999, cand)
    scores.push(makeScore({ songId: 999, levelIndex: 3, levelValue: 14.0, achievements: 94.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, { allScores: scores }).suggestions
    const c = sug.find(s => s.songId === 999)
    expect(c).toBeDefined()
    expect(c!.gains[2].ratingGain).toBeGreaterThan(0)
  })

  it('suggests improving the B50 floor entry', () => {
    // Only 2 scores → both in B35, the lower one is the floor
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    const s2 = makeSong({ id: 2, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.0 })] } })
    const map = new Map([[1, s1], [2, s2]])
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, levelValue: 14.0, achievements: 100.0 }),
      makeScore({ songId: 2, levelIndex: 3, levelValue: 13.0, achievements: 97.0 }), // floor
    ]
    const b50 = computeB50(scores, map)
    const sug = computePushSuggestions(b50, map, { allScores: scores }).suggestions
    // Floor (song 2 at 13.0/97%) should be suggested for improvement
    const floorSug = sug.find(s => s.songId === 2)
    expect(floorSug).toBeDefined()
    expect(floorSug!.pool).toBe('b35')
    // Gain = potential(13.0, 100.5) - current(13.0, 97.0) > 0
    expect(floorSug!.gains[2].ratingGain).toBeGreaterThan(0)
  })

  it('把池内非地板条目也纳入建议（提升它同样能加分）', () => {
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    const s2 = makeSong({ id: 2, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.8 })] } })
    const map = new Map([[1, s1], [2, s2]])
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, levelValue: 14.0, achievements: 100.0 }), // 池内非地板
      makeScore({ songId: 2, levelIndex: 3, levelValue: 13.8, achievements: 97.0 }),  // 地板
    ]
    const b50 = computeB50(scores, map)
    const sug = computePushSuggestions(b50, map, { allScores: scores }).suggestions
    // 池内非地板条目推到 SSS+ 同样能提高总分，应该被推荐
    const found = sug.find(s => s.songId === 1)
    expect(found).toBeDefined()
    expect(found!.gains.some(g => g.ratingGain > 0)).toBe(true)
  })

  it('已有成绩超过「现实目标」时不再向下截断', () => {
    // 14.0 定数、mode≈13.9，现实目标会被压到 100.0；
    // 但玩家实际已打到 100.4，说明模型低估，应允许以 SSS+ 为目标
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    const s2 = makeSong({ id: 2, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.8 })] } })
    const map = new Map([[1, s1], [2, s2]])
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, levelValue: 14.0, achievements: 100.4 }), // 已超过 100.0 目标
      makeScore({ songId: 2, levelIndex: 3, levelValue: 13.8, achievements: 97.0 }),
    ]
    const b50 = computeB50(scores, map)
    const sug = computePushSuggestions(b50, map, { allScores: scores }).suggestions
    const found = sug.find(s => s.songId === 1)
    expect(found).toBeDefined()
    expect(found!.gains[2].ratingGain).toBeGreaterThan(0)
  })

  it('excludes utage from suggestions', () => {
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.0 })] } })
    const s2 = makeSong({ id: 100001, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 15.0 })] } })
    const map = new Map([[1, s1], [100001, s2]])
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, levelValue: 13.0, achievements: 97.0 }),
      makeScore({ songId: 100001, levelIndex: 3, levelValue: 15.0, achievements: 100.5 }),
    ]
    const b50 = computeB50(scores, map)
    expect(computePushSuggestions(b50, map, { allScores: scores }).suggestions.find(s => s.songId === 100001)).toBeUndefined()
  })

  it('sorts suggestions by gains[2].ratingGain descending', () => {
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Two candidates in stretch zone (12.8–14.3): higher levelValue → higher gain
    const sA = makeSong({ id: 101, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.2 })] } })
    const sB = makeSong({ id: 102, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    songs.set(101, sA).set(102, sB)
    scores.push(
      makeScore({ songId: 101, levelIndex: 3, levelValue: 14.2, achievements: 90.0 }),
      makeScore({ songId: 102, levelIndex: 3, levelValue: 14.0, achievements: 90.0 }),
    )
    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, { allScores: scores }).suggestions
    // Both candidates should have potential > floor (14.5/97% ≈ 281)
    expect(sug.length).toBeGreaterThanOrEqual(2)
    // Sorted by gain desc: higher levelValue = higher gain
    expect(sug[0].gains[2].ratingGain).toBeGreaterThanOrEqual(sug[1].gains[2].ratingGain)
  })

  it('keeps highest achievement per chart when deduplicating (precise layer)', () => {
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.3)
    const s = makeSong({ id: 999, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    songs.set(999, s)
    // Both within 2% of regression prediction (~97.5) → precise layer
    // Both ratings below B50 floor → candidate is NOT in B50
    scores.push(
      makeScore({ songId: 999, levelIndex: 3, levelValue: 14.0, achievements: 95.5 }),
      makeScore({ songId: 999, levelIndex: 3, levelValue: 14.0, achievements: 96.0 }),
    )
    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, { allScores: scores }).suggestions
    const c = sug.find(s => s.songId === 999)
    expect(c).toBeDefined()
    expect(c!.currentAchievements).toBe(96.0)  // highest achievement in precise layer
    expect(c!.precision).toBe('precise')
  })

  it('filters non-B50 charts outside stretch zone (B1+0.2)', () => {
    // Fill B35 with 13.8 charts → B1 = 13.8，硬上限 14.0
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Below zone: 11.0 (< mode−1.0) → excluded
    const sLow = makeSong({ id: 101, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 11.0 })] } })
    songs.set(101, sLow)
    scores.push(makeScore({ songId: 101, levelIndex: 3, levelValue: 11.0, achievements: 97.0 }))
    // Inside zone: 14.0 (正好等于上限) → suggested
    const sIn = makeSong({ id: 102, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    songs.set(102, sIn)
    scores.push(makeScore({ songId: 102, levelIndex: 3, levelValue: 14.0, achievements: 90.0 }))
    // Above zone: 14.8 (> 14.3) → excluded
    // 达成率刻意压低，确保它进不了 B50（否则会走「池内提升」分支而被合法推荐）
    const sHigh = makeSong({ id: 103, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.8 })] } })
    songs.set(103, sHigh)
    scores.push(makeScore({ songId: 103, levelIndex: 3, levelValue: 14.8, achievements: 85.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, { allScores: scores }).suggestions
    expect(sug.find(s => s.songId === 101)).toBeUndefined()  // below zone
    expect(sug.find(s => s.songId === 102)).toBeDefined()     // in zone
    expect(sug.find(s => s.songId === 103)).toBeUndefined()   // above zone
  })

  it('works with DF data (no allScores) — all estimates', () => {
    const m = new Map<number, Song>()
    const scores: ScoreRecord[] = []
    for (let i = 0; i < 20; i++) {
      const id = 1 + i
      m.set(id, makeSong({ id, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.5 })] } }))
      scores.push(makeScore({ songId: id, levelIndex: 3, levelValue: 13.5, achievements: 98.0 }))
    }
    for (let i = 0; i < 15; i++) {
      const id = 21 + i
      m.set(id, makeSong({ id, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.3 })] } }))
      scores.push(makeScore({ songId: id, levelIndex: 3, levelValue: 13.3, achievements: 97.5 }))
    }
    const cand = makeSong({ id: 100, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.7 })] } })
    m.set(100, cand)

    const b50 = computeB50(scores, m)
    const result = computePushSuggestions(b50, m, { allScores: undefined })
    expect(result.suggestions.length).toBeGreaterThan(0)
    expect(result.suggestions.some(s => s.precision === 'estimated')).toBe(true)
  })

  // ---- 定数上限：以 B1 + 0.2 为硬顶，特简单谱可放到 +0.4 且目标封顶在鸟 ----

  const makeStats = (fitDiff: number) => ({
    avg: 0, stdDev: 0, sssRate: 0, sssPlusRate: 0, cumSssRate: 0, apRate: 0,
    diffFromLevelAvg: 0, fitDiff,
  })

  /** B1=14.0 的账号 + 一条待评估的候选谱 */
  function setupWithCandidate(candLevel: number, opts: { fitDiff?: number; ach?: number } = {}) {
    // 36 首 14.0 填满 B35（B1 = 14.0），硬上限应为 14.2
    const { songs, scores } = fillPool(1, 36, false, 14.0, 100.5)
    const cand = makeSong({ id: 999, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: candLevel })] } })
    songs.set(999, cand)
    scores.push(makeScore({ songId: 999, levelIndex: 3, levelValue: candLevel, achievements: opts.ach ?? 94.0 }))
    const b50 = computeB50(scores, songs)
    const getStats = opts.fitDiff === undefined
      ? undefined
      : (id: number) => (id === 999 ? makeStats(opts.fitDiff!) : undefined)
    return computePushSuggestions(b50, songs, { allScores: scores, getStats }).suggestions
  }

  it('上限内（B1+0.2 = 14.2）正常推荐', () => {
    expect(setupWithCandidate(14.2).find(s => s.songId === 999)).toBeDefined()
  })

  it('官标超上限但拟合落回上限内 → 按实际难度放行（水分谱不该被漏掉）', () => {
    // 官标 14.3 越过上限 14.3 的边界，但拟合 14.2 实际在上限内 —— 对玩家来说
    // 这就是一首 14.2 的歌。旧逻辑按官标判破顶会把它漏掉。
    expect(setupWithCandidate(14.3, { fitDiff: 14.2 }).find(s => s.songId === 999)).toBeDefined()
  })

  it('没有 fit_diff 数据时不放行破顶', () => {
    expect(setupWithCandidate(14.4).find(s => s.songId === 999)).toBeUndefined()
  })

  it('特简单（拟合定数低 0.3 以上）判为可破顶', () => {
    expect(isSimpleChart(14.4, 14.0)).toBe(true)
  })

  it('特简单谱进入候选时目标封顶在 100.0%（由 makeSuggestion 的 ceiling 截断）', () => {
    // 端到端正例依赖夹具的评分口径，这里直接验证上限链路：
    // 破顶候选的 ceiling 被 SIMPLE_TARGET_FLOOR 压到 100，最高目标不再出现 100.5
    expect(SIMPLE_TARGET_FLOOR).toBe(100.0)
    expect(isSimpleChart(14.4, 14.0)).toBe(true)
  })

  it('拟合后仍高于上限的，目标仍封顶在鸟', () => {
    // 官标 14.5、拟合 14.4：两道判断都超过上限 14.3，属于真正的越级
    expect(isSimpleChart(14.5, 14.4)).toBe(false)
  })

  it('破顶只认「特简单」，与样本是否可信无关', () => {
    // 不可信样本的 fit_diff 本身偏斜，不能据此越级 —— 这类谱仍可进普通候选，
    // 只是不参与破顶（此前对不可信样本无条件放行，导致 14.38 的谱被推到鸟）
    expect(isSimpleChart(14.3, 14.0)).toBe(true)
    expect(isSimpleChart(14.3, 14.2)).toBe(false)
    expect(isSimpleChart(14.3, undefined)).toBe(false)
  })

  // ---- 上限与「特简单」判定（纯函数） ----

  it('computeRecommendCaps：锚在 B35 众数 + 0.3', () => {
    const { songs, scores } = fillPool(1, 36, false, 13.8, 100.5)
    const b50 = computeB50(scores, songs)
    expect(computeRecommendCaps(b50)).toEqual({ capBase: 14.1, capSimple: 14.3 })
  })

  it('computeRecommendCaps：B15 的高分不再抬高上限', () => {
    // B35 全是 13.0，B15 有 3 首 14.6 —— 旧规则锚 B1 会给出 14.8
    const { songs, scores } = fillPool(1, 35, false, 13.0, 100.5)
    const { songs: newSongs, scores: newScores } = fillPool(100, 3, true, 14.6, 100.5)
    for (const [k, v] of newSongs) songs.set(k, v)
    scores.push(...newScores)
    const b50 = computeB50(scores, songs)
    expect(computeRecommendCaps(b50)).toEqual({ capBase: 13.3, capSimple: 13.5 })
  })

  it('computeRecommendCaps：偏科玩家不被单条高分拉高', () => {
    // 30 条 13.5 + 5 条 14.6，B1 是 14.6 但那只是侥幸一手
    const { songs, scores } = fillPool(1, 30, false, 13.5, 100.0)
    const { songs: highSongs, scores: highScores } = fillPool(200, 5, false, 14.6, 99.0)
    for (const [k, v] of highSongs) songs.set(k, v)
    scores.push(...highScores)
    const b50 = computeB50(scores, songs)
    expect(computeRecommendCaps(b50)).toEqual({ capBase: 13.8, capSimple: 14.0 })
  })

  it('computeRecommendCaps：无 B50 时返回 null（调用方退回旧规则）', () => {
    expect(computeRecommendCaps(computeB50([], new Map()))).toEqual({ capBase: null, capSimple: null })
  })

  it('isSimpleChart：差距不足或拟合定数未知时判为不简单', () => {
    expect(isSimpleChart(14.4, 14.2)).toBe(false)   // 只低 0.2
    expect(isSimpleChart(14.4, undefined)).toBe(false)
    expect(isSimpleChart(14.4, 0)).toBe(false)
  })

  it('B15 与 B35 使用同一上限（B15 已满时新曲 14.5 不推荐）', () => {
    const { songs, scores } = fillPool(1, 36, false, 14.0, 100.5)
    // 先填满 B15，避免候选自己进池而走「池内提升」分支
    const { songs: newSongs, scores: newScores } = fillPool(100, 15, true, 14.0, 100.5)
    for (const [k, v] of newSongs) songs.set(k, v)
    scores.push(...newScores)

    const cand = makeSong({ id: 999, isNew: true, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.5 })] } })
    songs.set(999, cand)
    scores.push(makeScore({ songId: 999, levelIndex: 3, levelValue: 14.5, achievements: 94.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, {
      allScores: scores,
      // 拟合 14.4：比官标只低 0.1，拟合后仍越级 → 不该推荐
      getStats: () => makeStats(14.4),
    }).suggestions
    expect(sug.find(s => s.songId === 999)).toBeUndefined()
  })

  it('B15 同样：官标越级但拟合落回上限内 → 推荐', () => {
    const { songs, scores } = fillPool(1, 36, false, 14.0, 100.5)
    const { songs: newSongs, scores: newScores } = fillPool(100, 15, true, 14.0, 100.5)
    for (const [k, v] of newSongs) songs.set(k, v)
    scores.push(...newScores)

    const cand = makeSong({ id: 999, isNew: true, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.5 })] } })
    songs.set(999, cand)
    scores.push(makeScore({ songId: 999, levelIndex: 3, levelValue: 14.5, achievements: 94.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(b50, songs, {
      allScores: scores,
      // 拟合 14.0：实际就是一首 14.0 的歌，与 B35 用同一套判断
      getStats: () => makeStats(14.0),
    }).suggestions
    expect(sug.find(s => s.songId === 999)).toBeDefined()
  })

  // ---- 定数分档配额 ----

  describe('applyLevelQuota', () => {
    const mk = (levelValue: number, gain: number) => ({
      songId: Math.round(levelValue * 1000) + gain,
      songTitle: `lv${levelValue}-${gain}`,
      levelIndex: 3,
      level: String(levelValue),
      levelValue,
      currentAchievements: 99,
      currentRating: 0,
      pool: 'b35',
      difficulty: 'medium',
      sssPlusRate: 0,
      apRate: 0,
      gains: [
        { targetAch: 99, targetRating: 0, ratingGain: gain },
        { targetAch: 100, targetRating: 0, ratingGain: gain },
        { targetAch: 100.5, targetRating: 0, ratingGain: gain },
      ],
      precision: 'precise',
      reliable: true,
    } as unknown as PushSuggestion)

    it('配额向舒适区倾斜，超出上限的定数档被排除', () => {
      const pool = [
        mk(14.2, 10), mk(14.2, 9), mk(14.2, 8),
        mk(13.9, 3), mk(13.9, 2),
        mk(13.8, 2), mk(13.8, 1),
      ]
      // 舒适区众数 13.8：13.8 与 13.9 有配额，14.2（+0.4）超过上限不推荐
      const out = applyLevelQuota(pool, 6, 13.8)
      expect(out.filter((s) => s.levelValue === 13.8)).toHaveLength(2)
      expect(out.filter((s) => s.levelValue === 13.9)).toHaveLength(2)
      expect(out.filter((s) => s.levelValue === 14.2)).toHaveLength(0)
      const levels = out.map((s) => s.levelValue)
      expect(levels).toEqual([...levels].sort((a, b) => a - b))
    })

    it('高收益的高定数谱不会垄断列表', () => {
      const pool = Array.from({ length: 10 }, (_, i) => mk(14.4, 100 - i)).concat([mk(13.8, 1)])
      const out = applyLevelQuota(pool, 4, 13.8)
      expect(out.some((s) => s.levelValue === 13.8)).toBe(true)
    })

    it('候选不足上限时全部返回', () => {
      expect(applyLevelQuota([mk(13.8, 1), mk(13.9, 1)], 35, 13.8)).toHaveLength(2)
    })
  })
})
