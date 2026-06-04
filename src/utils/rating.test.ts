// ============================================================
// Rating utility unit tests (TDD)
// ============================================================

import { describe, it, expect } from 'vitest'
import { computeRating, computeB50, computePushSuggestions, computeTheoreticalMaxRating } from '@/utils/rating'
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
    // 40 old songs at varying levels
    for (let i = 1; i <= 40; i++) {
      songs.push(makeSong({ id: i, isNew: false, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 + i * 0.01 })]
      }}))
    }
    // 20 new songs at varying levels
    for (let i = 41; i <= 60; i++) {
      songs.push(makeSong({ id: i, isNew: true, difficulties: {
        standard: [], dx: [makeDiff({ levelValue: 14.0 + i * 0.01 })]
      }}))
    }
    const result = computeTheoreticalMaxRating(songs)
    // Should be sum of top 35 old + top 15 new at 100.5%
    // Top old: songs 40,39,...,6 (35 songs, highest levelValues)
    // Top new: songs 60,59,...,46 (15 songs)
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

// ---- computePushSuggestions ----

describe('computePushSuggestions', () => {
  it('returns empty when B50 is empty', () => {
    const empty = { best35: [], best15: [], best35Total: 0, best15Total: 0, totalRating: 0 }
    expect(computePushSuggestions([], new Map(), empty)).toEqual([])
  })

  it('suggests chart not in B50 whose potential beats floor', () => {
    // Fill B35 to 35 with 13.8 filler → mode=13.8, stretch=13.9–14.3
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Candidate at 14.1 / 94% (inside stretch zone, below B50 floor)
    const cand = makeSong({ id: 999, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.1 })] } })
    songs.set(999, cand)
    scores.push(makeScore({ songId: 999, levelIndex: 3, levelValue: 14.1, achievements: 94.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(scores, songs, b50)
    const c = sug.find(s => s.songId === 999)
    expect(c).toBeDefined()
    expect(c!.ratingGain).toBeGreaterThan(0)
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
    const sug = computePushSuggestions(scores, map, b50)
    // Floor (song 2 at 13.0/97%) should be suggested for improvement
    const floorSug = sug.find(s => s.songId === 2)
    expect(floorSug).toBeDefined()
    expect(floorSug!.pool).toBe('b35')
    // Gain = potential(13.0, 100.5) - current(13.0, 97.0) > 0
    expect(floorSug!.ratingGain).toBeGreaterThan(0)
  })

  it('does not suggest non-floor B50 entries', () => {
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    const s2 = makeSong({ id: 2, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.0 })] } })
    const map = new Map([[1, s1], [2, s2]])
    const scores = [
      makeScore({ songId: 1, levelIndex: 3, levelValue: 14.0, achievements: 100.0 }), // top
      makeScore({ songId: 2, levelIndex: 3, levelValue: 13.0, achievements: 97.0 }),  // floor
    ]
    const b50 = computeB50(scores, map)
    const sug = computePushSuggestions(scores, map, b50)
    // Song 1 is in B50 but NOT the floor → should NOT be suggested
    expect(sug.find(s => s.songId === 1)).toBeUndefined()
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
    expect(computePushSuggestions(scores, map, b50).find(s => s.songId === 100001)).toBeUndefined()
  })

  it('sorts suggestions by ratingGain descending', () => {
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Two candidates in stretch zone (13.9–14.3): higher levelValue → higher gain
    const sA = makeSong({ id: 101, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.2 })] } })
    const sB = makeSong({ id: 102, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    songs.set(101, sA).set(102, sB)
    scores.push(
      makeScore({ songId: 101, levelIndex: 3, levelValue: 14.2, achievements: 90.0 }),
      makeScore({ songId: 102, levelIndex: 3, levelValue: 14.0, achievements: 90.0 }),
    )
    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(scores, songs, b50)
    // Both candidates should have potential > floor (14.5/97% ≈ 281)
    expect(sug.length).toBeGreaterThanOrEqual(2)
    // Sorted by gain desc: higher levelValue = higher gain
    expect(sug[0].ratingGain).toBeGreaterThanOrEqual(sug[1].ratingGain)
  })

  it('keeps highest achievement per chart when deduplicating', () => {
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    const s = makeSong({ id: 999, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.1 })] } })
    songs.set(999, s)
    scores.push(
      makeScore({ songId: 999, levelIndex: 3, levelValue: 14.1, achievements: 90.0 }),
      makeScore({ songId: 999, levelIndex: 3, levelValue: 14.1, achievements: 92.0 }),
    )
    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(scores, songs, b50)
    const c = sug.find(s => s.songId === 999)
    expect(c).toBeDefined()
    expect(c!.currentAchievements).toBe(92.0)
  })

  it('filters non-B50 charts outside stretch zone (mode+0.1 to mode+0.5)', () => {
    // Fill B35 with 13.8 charts → mode = 13.8, stretch zone = 13.9–14.3
    const { songs, scores } = fillPool(1, 35, false, 13.8, 97.0)
    // Below zone: 13.3 (< 13.9) → excluded
    const sLow = makeSong({ id: 101, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.3 })] } })
    songs.set(101, sLow)
    scores.push(makeScore({ songId: 101, levelIndex: 3, levelValue: 13.3, achievements: 97.0 }))
    // Inside zone: 14.1 / 90% → suggested
    const sIn = makeSong({ id: 102, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.1 })] } })
    songs.set(102, sIn)
    scores.push(makeScore({ songId: 102, levelIndex: 3, levelValue: 14.1, achievements: 90.0 }))
    // Above zone: 14.8 (> 14.3) → excluded
    const sHigh = makeSong({ id: 103, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.8 })] } })
    songs.set(103, sHigh)
    scores.push(makeScore({ songId: 103, levelIndex: 3, levelValue: 14.8, achievements: 97.0 }))

    const b50 = computeB50(scores, songs)
    const sug = computePushSuggestions(scores, songs, b50)
    expect(sug.find(s => s.songId === 101)).toBeUndefined()  // below zone
    expect(sug.find(s => s.songId === 102)).toBeDefined()     // in zone
    expect(sug.find(s => s.songId === 103)).toBeUndefined()   // above zone
  })

  it('falls back to mean when B35 has fewer than 5 entries', () => {
    const m = new Map<number, Song>()
    const scores: ScoreRecord[] = []
    // Only 2 entries in B35 → mode unreliable, uses mean = (13.0+14.0)/2 = 13.5
    const s1 = makeSong({ id: 1, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.0 })] } })
    const s2 = makeSong({ id: 2, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 14.0 })] } })
    m.set(1, s1).set(2, s2)
    scores.push(
      makeScore({ songId: 1, levelIndex: 3, levelValue: 13.0, achievements: 99.0 }),
      makeScore({ songId: 2, levelIndex: 3, levelValue: 14.0, achievements: 99.0 }),
    )
    // Mean = 13.5, stretch zone = 13.6–14.0
    // Candidate at 13.7 / 90%: inside stretch zone, not in B50
    const cand = makeSong({ id: 3, isNew: false, difficulties: { standard: [], dx: [makeDiff({ levelValue: 13.7 })] } })
    m.set(3, cand)
    scores.push(makeScore({ songId: 3, levelIndex: 3, levelValue: 13.7, achievements: 90.0 }))

    const b50 = computeB50(scores, m)
    const sug = computePushSuggestions(scores, m, b50)
    expect(sug.find(s => s.songId === 3)).toBeDefined()
  })
})
