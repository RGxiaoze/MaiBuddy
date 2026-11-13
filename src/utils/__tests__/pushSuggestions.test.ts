import { describe, it, expect } from 'vitest'
import { computePushSuggestions, applyLevelQuota, type PushSuggestion } from '../pushSuggestions'
import { computeRating } from '../rating'
import type { B50Entry, B50Result } from '../b50'
import type { Song } from '@/types'
import type { ScoreRecord } from '@/db/database'

function entry(songId: number, levelValue: number, achievements: number): B50Entry {
  return {
    songId,
    songTitle: `S${songId}`,
    levelIndex: 3,
    level: `${Math.floor(levelValue)}`,
    levelValue,
    songType: 'dx',
    achievements,
    rate: 'sss',
    fcType: null,
    fsType: null,
    isNew: false,
    dxRating: computeRating(levelValue, achievements),
    dxScore: 0,
  }
}

function song(id: number, levelValue: number): Song {
  return {
    id,
    title: `S${id}`,
    artist: 'a',
    bpm: 150,
    from: 'maimai でらっくす PRiSM',
    genre: '舞萌',
    imageUrl: '',
    isNew: false,
    difficulties: {
      standard: [],
      dx: [{
        type: 'dx' as const,
        levelIndex: 3 as const,
        level: `${Math.floor(levelValue)}`,
        levelValue,
        noteDesigner: '',
        notes: null,
      }],
    },
  } as unknown as Song
}

function score(songId: number, levelValue: number, achievements: number): ScoreRecord {
  return {
    songId,
    songTitle: `S${songId}`,
    levelIndex: 3,
    level: `${Math.floor(levelValue)}`,
    levelValue,
    songType: 'dx',
    achievements,
    rate: 'sss',
    fcType: null,
    fsType: null,
    dxScore: 0,
    dxRating: computeRating(levelValue, achievements),
    dxScoreDetail: null,
  } as ScoreRecord
}

/** 造一个 B35 全在 levelValue、达成率 100.0% 的满池，便于控制地板分 */
function makeB50(levelValue: number): B50Result {
  const best35 = Array.from({ length: 35 }, (_, i) => entry(1000 + i, levelValue, 100.0))
  const total = best35.reduce((s, e) => s + e.dxRating, 0)
  return { best35, best15: [], best35Total: total, best15Total: 0, totalRating: total }
}

/** 造一条只关心定数与收益的推荐，供配额测试用 */
function sug(songId: number, levelValue: number, gain: number): PushSuggestion {
  const g = { targetAch: 100.5, targetRating: gain, ratingGain: gain }
  return {
    songId,
    songTitle: `S${songId}`,
    levelIndex: 3,
    level: `${Math.floor(levelValue)}`,
    levelValue,
    currentAchievements: 98.0,
    currentRating: 0,
    pool: 'b35',
    difficulty: 'medium',
    sssPlusRate: 0,
    apRate: 0,
    gains: [g, g, g],
    precision: 'estimated',
  } as PushSuggestion
}

describe('加权分档配额', () => {
  it('名额向舒适区集中，上限档只保留少量', () => {
    // 众数 13.2，三档各有 5 条候选
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => sug(1 + i, 13.0, 10 - i)),
      ...Array.from({ length: 5 }, (_, i) => sug(10 + i, 13.3, 10 - i)),
      ...Array.from({ length: 5 }, (_, i) => sug(20 + i, 13.5, 10 - i)),
    ]
    const out = applyLevelQuota(pool, 10, 13.2)
    const count = (lv: number) => out.filter(s => s.levelValue === lv).length

    expect(count(13.5)).toBe(1)   // mode+0.3：只给 1 条
    expect(count(13.3)).toBe(4)   // mode+0.1：4 条
    expect(count(13.0)).toBe(5)   // 舒适区及以下：5 条全给
    expect(out.length).toBe(10)
  })

  it('上限档不会独自占满名额', () => {
    // 舒适区只有 1 条候选，上限档有 10 条
    const pool = [
      sug(1, 13.0, 10),
      ...Array.from({ length: 10 }, (_, i) => sug(10 + i, 13.5, 10 - i)),
    ]
    const out = applyLevelQuota(pool, 10, 13.2)
    expect(out.filter(s => s.levelValue === 13.0)).toHaveLength(1)
    // 权重 1.0 : 0.25 → 配额 8 : 2，上限档只能拿 2 条
    expect(out.filter(s => s.levelValue === 13.5)).toHaveLength(2)
  })

  it('输出按定数升序，更高的排在后面', () => {
    const pool = [
      ...Array.from({ length: 3 }, (_, i) => sug(1 + i, 13.5, 10 - i)),
      ...Array.from({ length: 3 }, (_, i) => sug(10 + i, 13.1, 10 - i)),
    ]
    const out = applyLevelQuota(pool, 10, 13.2)
    const levels = out.map(s => s.levelValue)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })
})

describe('水分谱不该被漏掉', () => {
  const stats = (fitDiff: number) => () => ({
    avg: 99, stdDev: 1, sssRate: 0.2, sssPlusRate: 0.3, cumSssRate: 0.5,
    apRate: 0.05, diffFromLevelAvg: 0.5, fitDiff,
    sampleCount: 500, reliable: true,
  })

  it('官标 13.9、拟合 13.5：按实际定数算目标，能拿到鸟加', () => {
    const b50 = makeB50(13.5) // 众数 13.5 → 上限 13.8
    const songs = new Map([[7000, song(7000, 13.9)]])
    // 玩家在 13.5 档普遍 100%，在 13.9 档从没打过
    const scores = Array.from({ length: 8 }, (_, i) => score(8000 + i, 13.5, 100.0))

    const { suggestions } = computePushSuggestions(b50, songs, {
      allScores: scores,
      getStats: stats(13.5),
    })
    const hit = suggestions.find((s) => s.songId === 7000)

    expect(hit).toBeDefined()
    // 目标按 13.5 的能力算 = 100.5，且没有因为官标 13.9 超上限而被封顶在鸟
    expect(Math.max(...hit!.gains.map((g) => g.targetAch))).toBe(100.5)
    expect(hit!.fitDelta).toBe(-0.4) // 拟合 13.5 − 官标 13.9
  })

  it('官标超上限但拟合也超上限时，仍按破顶处理（封顶在鸟）', () => {
    const b50 = makeB50(13.5) // 上限 13.8
    const songs = new Map([[7001, song(7001, 14.3)]])
    const scores = Array.from({ length: 8 }, (_, i) => score(8100 + i, 13.5, 100.0))

    const { suggestions } = computePushSuggestions(b50, songs, {
      allScores: scores,
      getStats: stats(13.9), // 拟合 13.9 仍高于上限 13.8
    })
    const hit = suggestions.find((s) => s.songId === 7001)

    if (hit) {
      expect(Math.max(...hit.gains.map((g) => g.targetAch))).toBeLessThanOrEqual(100.0)
    }
  })
})

describe('空池不产生虚高收益', () => {
  it('B15 为空时，低定数新曲不该因为「地板是 0」被推荐', () => {
    // B35 全是 14.0@100% → 地板 rating 约 302；B15 空
    const b50 = makeB50(14.0)
    expect(b50.best15).toHaveLength(0)

    // 12.8 的新曲推到顶也只有约 286，超不过 B35 地板
    const lowNew = song(7010, 12.8)
    ;(lowNew as unknown as { isNew: boolean }).isNew = true
    const songs = new Map([[7010, lowNew]])

    const { suggestions } = computePushSuggestions(b50, songs)

    // 修复前 floor15 = 0，这条收益 = 目标 rating − 0，会把整张列表占满
    expect(suggestions.some((s) => s.songId === 7010)).toBe(false)
  })
})

describe('水分标签', () => {
  it('拟合定数低于官标时给出水量', () => {
    const b50 = makeB50(13.5)
    const songs = new Map([[5004, song(5004, 13.7)]])
    const getStats = () => ({
      avg: 99, stdDev: 1, sssRate: 0.2, sssPlusRate: 0.3, cumSssRate: 0.5,
      apRate: 0.05, diffFromLevelAvg: 0.5, fitDiff: 13.2,
      sampleCount: 500, reliable: true,
    })

    const { suggestions } = computePushSuggestions(b50, songs, { getStats })
    const hit = suggestions.find((s) => s.songId === 5004)

    expect(hit).toBeDefined()
    expect(hit!.fitDelta).toBe(-0.5) // 拟合 13.2 − 官标 13.7
  })

  it('拟合定数高于官标（更难）时给正值，供 UI 标红', () => {
    const b50 = makeB50(13.5)
    const songs = new Map([[5005, song(5005, 13.7)]])
    const getStats = () => ({
      avg: 98, stdDev: 1, sssRate: 0.1, sssPlusRate: 0.05, cumSssRate: 0.15,
      apRate: 0.01, diffFromLevelAvg: -0.5, fitDiff: 14.0,
      sampleCount: 500, reliable: true,
    })

    const { suggestions } = computePushSuggestions(b50, songs, { getStats })
    const hit = suggestions.find((s) => s.songId === 5005)

    // 拟合 14.0 − 官标 13.7 = +0.3，实际比标称难
    expect(hit?.fitDelta).toBe(0.3)
  })
})

describe('推荐不越过舒适区上限', () => {
  it('B15 池为空时，下限也不放开到低定数', () => {
    // B35 全 13.5、B15 一条没有；7 级新曲不该因为「池子空」就被推荐
    const b50 = makeB50(13.5)
    const lowSong = song(6000, 7.0)
    ;(lowSong as unknown as { isNew: boolean }).isNew = true
    const songs = new Map([[6000, lowSong]])

    const { suggestions } = computePushSuggestions(b50, songs)
    expect(suggestions.some((s) => s.songId === 6000)).toBe(false)
  })

  it('B35 全在 13.5 时，不推荐 14.0 的谱', () => {
    const b50 = makeB50(13.5) // 众数 13.5 → 上限 13.8
    const songs = new Map([
      [5003, song(5003, 14.0)], // 越过上限
      [5004, song(5004, 13.7)], // 落在上限内
    ])

    const { suggestions } = computePushSuggestions(b50, songs)

    expect(suggestions.some((s) => s.songId === 5003)).toBe(false)
    expect(suggestions.every((s) => s.levelValue <= 13.8)).toBe(true)
    expect(suggestions.some((s) => s.songId === 5004)).toBe(true)
  })
})

describe('收益计算：目标不高于当前成绩时不得计分', () => {
  it('本地成绩已达 SSS+、但 B50 还是旧快照（不含该谱）→ 不产生推荐', () => {
    // 地板 13.0@100.0%，候选 13.2 本地已打到 100.5%（rating 高于地板）
    const b50 = makeB50(13.0)
    const songs = new Map([[5000, song(5000, 13.2)]])
    const scores = [score(5000, 13.2, 100.5)]

    const { suggestions } = computePushSuggestions(b50, songs, { allScores: scores })

    // 三档都没有提升空间，AP 加成又未实装 → 整条不该出现在推荐里。
    // 修复前这里会算出「目标 100.5% − 地板」的正收益，但玩家早就打到了。
    expect(suggestions.some((s) => s.songId === 5000)).toBe(false)
  })

  it('目标档低于当前成绩时该档不计分，但更高档仍正常计分', () => {
    // 候选 13.2 当前 100.0%：SS(99%) 与 SSS(100%) 两档都无提升，SSS+ 仍有
    const b50 = makeB50(13.0)
    const songs = new Map([[5001, song(5001, 13.2)]])
    const scores = [score(5001, 13.2, 100.0)]

    const { suggestions } = computePushSuggestions(b50, songs, { allScores: scores })
    const hit = suggestions.find((s) => s.songId === 5001)

    expect(hit).toBeDefined()
    expect(hit!.gains[0].ratingGain).toBe(0)
    expect(hit!.gains[1].ratingGain).toBe(0)
    expect(hit!.gains[2].ratingGain).toBeGreaterThan(0)
  })

  it('当前成绩低于地板时，仍按地板为基准计算收益', () => {
    // 候选 13.2 当前 98.0%（rating 低于地板），推到 SSS+ 才能进池
    const b50 = makeB50(13.0)
    const songs = new Map([[5002, song(5002, 13.2)]])
    const scores = [score(5002, 13.2, 98.0)]

    const { suggestions } = computePushSuggestions(b50, songs, { allScores: scores })
    const hit = suggestions.find((s) => s.songId === 5002)

    expect(hit).toBeDefined()
    expect(hit!.gains[2].ratingGain).toBeGreaterThan(0)
  })
})
