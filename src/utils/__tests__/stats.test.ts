import { describe, it, expect } from 'vitest'
import {
  computeStats, getLevelTabs, getGenreTabs,
  DIFFICULTY_TABS, RATE_TABS, FC_TABS, FS_TABS,
  type StatsFilter,
} from '@/utils/stats'
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

/** 测试曲库：song1 流行&动漫(标准Master 14.0 + DX Re:Master 14.8)、song2 东方Project(DX Master 14.5)、song3 流行&动漫(标准Basic 4.0) */
function makeSongs(): Song[] {
  return [
    makeSong({
      id: 1, title: 'Song1', genre: '流行&动漫',
      difficulties: {
        standard: [makeDiff({ levelIndex: 3, level: '14', levelValue: 14.0 })],
        dx: [makeDiff({ type: 'dx', levelIndex: 4, level: '14+', levelValue: 14.8 })],
      },
    }),
    makeSong({
      id: 2, title: 'Song2', genre: '东方Project',
      difficulties: {
        standard: [],
        dx: [makeDiff({ type: 'dx', levelIndex: 3, level: '14+', levelValue: 14.5 })],
      },
    }),
    makeSong({
      id: 3, title: 'Song3', genre: '流行&动漫',
      difficulties: {
        standard: [makeDiff({ levelIndex: 0, level: '4', levelValue: 4.0 })],
        dx: [],
      },
    }),
  ]
}

/** 测试成绩：s1 是 song1 Re:MASTER(AP/SSS+/FDX+)、s2 是 song1 Master(SS/FC)、s3 是 song2 Master(SSS/FC+/FS+)、s4 是 song3 Basic(AAA) */
function makeScores(): ScoreRecord[] {
  return [
    makeScore({ songId: 1, songTitle: 'Song1', levelIndex: 4, level: '14+', levelValue: 14.8, songType: 'dx', achievements: 100.5, rate: 'sssp', fcType: 'ap', fsType: 'fsdp', dxRating: 330 }),
    makeScore({ id: 2, songId: 1, songTitle: 'Song1', levelIndex: 3, level: '14', levelValue: 14.0, songType: 'standard', achievements: 97.5, rate: 'ss', fcType: 'fc', dxRating: 250 }),
    makeScore({ id: 3, songId: 2, songTitle: 'Song2', levelIndex: 3, level: '14+', levelValue: 14.5, songType: 'dx', achievements: 100.0, rate: 'sss', fcType: 'fcp', fsType: 'fsp', dxRating: 280 }),
    makeScore({ id: 4, songId: 3, songTitle: 'Song3', levelIndex: 0, level: '4', levelValue: 4.0, songType: 'standard', achievements: 88.0, rate: 'aaa', dxRating: 50 }),
  ]
}

const allFilter: StatsFilter = { dimension: 'difficulty', value: 'all', difficulty: 'all' }

describe('computeStats — 基础统计', () => {
  it('空成绩应全为 0', () => {
    const s = computeStats([], makeSongs(), allFilter)
    expect(s.totalSongs).toBe(3)
    expect(s.playedSongs).toBe(0)
    expect(s.playRate).toBe(0)
    expect(s.avgAchievement).toBe(0)
    expect(s.apCount).toBe(0)
    expect(s.apPlusCount).toBe(0)
    expect(s.maxLevelValue).toBe(0)
    expect(s.maxLevelTitle).toBe('')
    expect(s.rateDist.map(r => r.count)).toEqual([0, 0, 0, 0])
  })

  it('全部维度应统计全部曲目与全部成绩', () => {
    const s = computeStats(makeScores(), makeSongs(), allFilter)
    expect(s.totalSongs).toBe(3)
    expect(s.playedSongs).toBe(3)
    expect(s.playRate).toBe(100)
    expect(s.avgAchievement).toBe(96.5)   // (100.5+97.5+100+88)/4
    expect(s.apCount).toBe(1)
    expect(s.apPlusCount).toBe(0)         // s1 是 ap 而非 app
    expect(s.maxLevelValue).toBe(14.8)
    expect(s.maxLevelTitle).toBe('Song1')
    expect(s.rateDist).toEqual([
      { key: 'sssp', label: 'SSS+', count: 1 },
      { key: 'sss', label: 'SSS', count: 1 },
      { key: 'ss', label: 'SS', count: 1 },
      { key: 's', label: 'S', count: 0 },
    ])
  })

  it('同曲多难度成绩应全部计入（不按曲目去重）', () => {
    const s = computeStats(makeScores(), makeSongs(), { ...allFilter, value: 'all' })
    expect(s.avgAchievement).toBe(96.5)
  })
})

describe('computeStats — 难度维度', () => {
  it('MASTER 应只统计有 Master 谱面的曲目', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'difficulty', value: '3', difficulty: 'all' })
    expect(s.totalSongs).toBe(2)          // song1 std + song2 dx
    expect(s.playedSongs).toBe(2)
    expect(s.avgAchievement).toBe(98.75)  // (97.5+100)/2
    expect(s.apCount).toBe(0)
    expect(s.maxLevelValue).toBe(14.5)
    expect(s.maxLevelTitle).toBe('Song2')
  })

  it('RE:MASTER 应只统计有 Re:Master 谱面的曲目', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'difficulty', value: '4', difficulty: 'all' })
    expect(s.totalSongs).toBe(1)
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(100.5)
  })
})

describe('computeStats — 歌曲等级维度', () => {
  it('14+ 应统计所有 level 为 14+ 的谱面（song1 DX 与 song2 DX）', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'level', value: '14+', difficulty: 'all' })
    expect(s.totalSongs).toBe(2)
    expect(s.playedSongs).toBe(2)
    expect(s.avgAchievement).toBe(100.25) // (100.5+100)/2
  })
})

describe('computeStats — 达成等级维度', () => {
  it('SSS+ 应只统计 sssp 成绩（曲库不做评级过滤）', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'rate', value: 'sssp', difficulty: 'all' })
    expect(s.totalSongs).toBe(3)          // 曲库全部
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(100.5)
  })

  it('S 组应包含 sp 与 s 评级', () => {
    const scores = [
      ...makeScores(),
      makeScore({ id: 5, songId: 3, songTitle: 'Song3', levelIndex: 0, level: '4', levelValue: 4.0, songType: 'standard', achievements: 91.0, rate: 's' }),
    ]
    const s = computeStats(scores, makeSongs(), { dimension: 'rate', value: 's', difficulty: 'all' })
    expect(s.playedSongs).toBe(1)
  })

  it('S 以下应聚合 aaa 及更低评级', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'rate', value: 'below_s', difficulty: 'all' })
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(88)
  })

  it('FC 标记应精确匹配 fcType', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'rate', value: 'ap', difficulty: 'all' })
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(100.5)
  })

  it('FS 标记应精确匹配 fsType', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'rate', value: 'fsp', difficulty: 'all' })
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(100)
  })

  it('达成维度应支持难度二级筛选', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'rate', value: 'ss', difficulty: 3 })
    expect(s.totalSongs).toBe(2)          // 有 Master 谱面的曲目
    expect(s.playedSongs).toBe(1)         // 仅 s2（Master 且 SS）
  })
})

describe('computeStats — 曲包维度', () => {
  it('流行&动漫 应统计该曲包全部曲目', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'genre', value: '流行&动漫', difficulty: 'all' })
    expect(s.totalSongs).toBe(2)
    expect(s.playedSongs).toBe(2)
    expect(s.avgAchievement).toBe(95.33)  // (100.5+97.5+88)/3
  })

  it('曲包维度应支持难度二级筛选', () => {
    const s = computeStats(makeScores(), makeSongs(), { dimension: 'genre', value: '东方Project', difficulty: 3 })
    expect(s.totalSongs).toBe(1)
    expect(s.playedSongs).toBe(1)
    expect(s.avgAchievement).toBe(100)
  })
})

describe('标签生成器', () => {
  it('DIFFICULTY_TABS 应含全部与 5 个难度', () => {
    expect(DIFFICULTY_TABS.map(t => t.label)).toEqual(['全部', 'BASIC', 'ADVANCED', 'EXPERT', 'MASTER', 'Re:MASTER'])
  })

  it('RATE_TABS / FC_TABS / FS_TABS 应符合设计', () => {
    expect(RATE_TABS.map(t => t.value)).toEqual(['all', 'sssp', 'sss', 'ss', 's', 'below_s'])
    expect(FC_TABS.map(t => t.label)).toEqual(['AP+', 'AP', 'FC+', 'FC'])
    expect(FS_TABS.map(t => t.label)).toEqual(['FDX+', 'FDX', 'FS+', 'FS'])
  })

  it('getLevelTabs 应按定数升序去重', () => {
    const tabs = getLevelTabs(makeSongs())
    expect(tabs.map(t => t.label)).toEqual(['全部', '4', '14', '14+'])
  })

  it('getGenreTabs 应去重并按中文排序', () => {
    const tabs = getGenreTabs(makeSongs())
    expect(tabs.map(t => t.label)).toEqual(['全部', '东方Project', '流行&动漫'])
  })
})
