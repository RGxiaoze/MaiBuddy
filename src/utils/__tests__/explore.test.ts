import { describe, it, expect } from 'vitest'
import { buildExplorePool, smoothWinRate, highestPlayedBySong, buildStaleKeys } from '../explore'
import type { Song } from '@/types'

function makeDiff(levelIndex: number, levelValue: number, level = '13'): {
  type: 'standard'; levelIndex: number; level: string; levelValue: number; noteDesigner: string; notes: null
} {
  return { type: 'standard', levelIndex, level, levelValue, noteDesigner: 'Jack', notes: null }
}

function makeSong(id: number, title: string, diffs: ReturnType<typeof makeDiff>[]): Song {
  return {
    id, title, artist: 'artist', bpm: 150, from: 'maimai',
    genre: '舞萌', imageUrl: '', isNew: false,
    difficulties: { standard: diffs, dx: [] },
  } as unknown as Song
}

const vote = (winRate: number, totalVote: number) => ({
  winRate, totalVote, upVote: Math.round(winRate * totalVote),
})

/** 确定性随机源：不交换，保持输入顺序 */
const noShuffle = () => 0

describe('smoothWinRate', () => {
  it('小样本被拉向先验，不会霸榜', () => {
    expect(smoothWinRate(3, 3)).toBeLessThan(0.7)
  })

  it('大样本基本保持原值', () => {
    const r = smoothWinRate(5300, 7439)
    expect(r).toBeGreaterThan(0.65)
    expect(r).toBeLessThan(0.75)
  })

  it('大样本始终排在同样原始胜率的小样本之上', () => {
    expect(smoothWinRate(6000, 8000)).toBeGreaterThan(smoothWinRate(3, 3))
  })
})

describe('highestPlayedBySong', () => {
  it('取同一首歌已游玩的最高难度索引', () => {
    const map = highestPlayedBySong(new Set(['1-0', '1-3', '1-2', '2-1']))
    expect(map.get(1)).toBe(3)
    expect(map.get(2)).toBe(1)
  })

  it('忽略非法 key', () => {
    const map = highestPlayedBySong(new Set(['bad', '1-x', '2-2']))
    expect(map.get(2)).toBe(2)
    expect(map.size).toBe(1)
  })
})

describe('buildStaleKeys', () => {
  const now = new Date('2026-11-09T00:00:00Z')
  /** 生成 n 条不同日期的成绩；idFrom 用于避免两组数据的 songId 重叠 */
  const manyDates = (n: number, dateFrom = 0, idFrom = 0) =>
    Array.from({ length: n }, (_, i) => ({
      songId: idFrom + i + 1,
      levelIndex: 3,
      playDate: new Date(Date.UTC(2026, 0, 1) + (dateFrom + i) * 86_400_000).toISOString().slice(0, 10),
    }))

  it('日期种类太少时视为时间数据不可信，返回空集', () => {
    // 水鱼导入：所有成绩都是导入当天
    const scores = Array.from({ length: 500 }, (_, i) => ({ songId: i + 1, levelIndex: 3, playDate: '2026-11-09' }))
    expect(buildStaleKeys(scores, 3, 10, now).size).toBe(0)
  })

  it('分几天导入的水鱼数据同样不可信（日期种类不足 10）', () => {
    const scores = [1, 2, 3].flatMap(d => ({ songId: d, levelIndex: 3, playDate: `2026-06-0${d}` }))
    expect(buildStaleKeys(scores, 3, 10, now).size).toBe(0)
  })

  it('时间数据可信时，超过 3 个月没玩的谱面被选中', () => {
    const old = manyDates(10, 0, 0)       // songId 1-10，2026-01-01 起，早已超过 3 个月
    const recent = manyDates(10, 300, 100) // songId 101-110，2026-10-28 起，未超过
    const stale = buildStaleKeys([...old, ...recent], 3, 10, now)
    expect(stale.size).toBe(10)
    expect(stale.has('1-3')).toBe(true)
    expect(stale.has('101-3')).toBe(false)
  })

  it('无 playDate 的成绩被忽略', () => {
    const scores = [...manyDates(10), { songId: 99, levelIndex: 3, playDate: undefined as unknown as string }]
    const stale = buildStaleKeys(scores, 3, 10, now)
    expect(stale.has('99-3')).toBe(false)
  })
})

describe('buildExplorePool', () => {
  it('排除已游玩谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)], [2, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(['1-3']), votes, { minVotes: 30, random: noShuffle })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  // 玩过很多谱面的玩家需要「很久没玩」的推荐：这些谱面仍在 playedKeys 里，
  // 但由调用方判定为「超过阈值没碰过」后放进 staleKeys，允许重新进入池子。
  it('很久没玩的谱面可以回到池子', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(['1-3']), votes, {
      minVotes: 30, random: noShuffle, staleKeys: new Set(['1-3']),
    })
    expect(pool.map(p => p.songId)).toEqual([1])
  })

  it('未在 staleKeys 里的已游玩谱面仍被排除', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)], [2, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(['1-3', '2-3']), votes, {
      minVotes: 30, random: noShuffle, staleKeys: new Set(['1-3']),
    })
    expect(pool.map(p => p.songId)).toEqual([1])
  })

  it('排除无投票数据的谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool.map(p => p.songId)).toEqual([1])
  })

  it('排除票数低于阈值的谱面', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(1.0, 5)], [2, vote(0.5, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('排除已屏蔽的歌曲', () => {
    const songs = [makeSong(1, 'A', [makeDiff(3, 13)]), makeSong(2, 'B', [makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.7, 500)], [2, vote(0.7, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, random: noShuffle, blockedSongIds: new Set([1]),
    })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('难度区间外的谱面被排除', () => {
    const songs = [
      makeSong(1, 'A', [makeDiff(2, 11)]),
      makeSong(2, 'B', [makeDiff(3, 13)]),
      makeSong(3, 'C', [makeDiff(3, 14.8)]),
    ]
    const votes = new Map([[1, vote(0.6, 500)], [2, vote(0.6, 500)], [3, vote(0.6, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, minLevel: 12.5, maxLevel: 13.5, random: noShuffle,
    })
    expect(pool.map(p => p.songId)).toEqual([2])
  })

  it('禁止降级推荐：打过 Master 后不再推荐该曲的低难度', () => {
    const songs = [makeSong(1, 'A', [makeDiff(0, 5), makeDiff(2, 11), makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.6, 500)]])
    // 已游玩 Master(3)，Basic(0) 与 Expert(2) 都不该出现
    const pool = buildExplorePool(songs, new Set(['1-3']), votes, { minVotes: 30, random: noShuffle })
    expect(pool).toHaveLength(0)
  })

  it('向上推荐不设限：只打过 Expert 时 Master 仍可推荐', () => {
    const songs = [makeSong(1, 'A', [makeDiff(2, 11), makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.6, 500)]])
    const pool = buildExplorePool(songs, new Set(['1-2']), votes, { minVotes: 30, random: noShuffle })
    expect(pool).toHaveLength(1)
    expect(pool[0].levelIndex).toBe(3)
  })

  it('按平滑胜率降序（不洗牌时）', () => {
    const songs = [
      makeSong(1, 'low', [makeDiff(3, 13)]),
      makeSong(2, 'high', [makeDiff(3, 13)]),
      makeSong(3, 'mid', [makeDiff(3, 13)]),
    ]
    const votes = new Map([[1, vote(0.30, 800)], [2, vote(0.70, 800)], [3, vote(0.50, 800)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool.map(p => p.songId)).toEqual([2, 3, 1])
  })

  it('同一首歌只保留难度索引最大的一个', () => {
    const songs = [makeSong(1, 'A', [makeDiff(2, 12), makeDiff(3, 13)])]
    const votes = new Map([[1, vote(0.6, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool).toHaveLength(1)
    expect(pool[0].levelIndex).toBe(3)
  })

  it('默认返回 10 条', () => {
    const songs = Array.from({ length: 30 }, (_, i) => makeSong(i + 1, `S${i}`, [makeDiff(3, 13)]))
    const votes = new Map(songs.map((s, i) => [s.id, vote(0.5 + i * 0.001, 500)]))
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool).toHaveLength(10)
  })

  it('宽池：只在胜率前 70% 里抽', () => {
    // 10 首，limit=2，topPercent=70 → 池子大小 7；最差的 3 首永远抽不到
    const songs = Array.from({ length: 10 }, (_, i) => makeSong(i + 1, `S${i}`, [makeDiff(3, 13)]))
    const votes = new Map(songs.map((s, i) => [s.id, vote(0.5 + i * 0.01, 500)]))
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, limit: 2, topPercent: 70, random: noShuffle,
    })
    expect(pool).toHaveLength(2)
    expect(pool.map(p => p.songId)).toEqual([10, 9])
  })

  it('换一批时排除已展示过的条目', () => {
    const songs = [
      makeSong(1, 'A', [makeDiff(3, 13)]),
      makeSong(2, 'B', [makeDiff(3, 13)]),
      makeSong(3, 'C', [makeDiff(3, 13)]),
    ]
    const votes = new Map([[1, vote(0.7, 500)], [2, vote(0.6, 500)], [3, vote(0.5, 500)]])
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, limit: 2, random: noShuffle, seenKeys: new Set(['1-3']),
    })
    expect(pool.map(p => p.songId)).toEqual([2, 3])
  })

  it('携带谱面元信息供卡片展示', () => {
    const songs = [makeSong(1, 'Song A', [makeDiff(3, 13.4, '13+')])]
    const votes = new Map([[1, vote(0.7, 500)]])
    const [item] = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(item).toMatchObject({
      songId: 1, title: 'Song A', levelIndex: 3, level: '13+',
      levelValue: 13.4, noteDesigner: 'Jack', totalVote: 500,
    })
    expect(item.winRate).toBeCloseTo(0.7, 5)
  })
})

describe('偏好加权', () => {
  const songWith = (id: number, designer: string, genre = '舞萌'): Song => ({
    id, title: `S${id}`, artist: 'a', bpm: 150, from: 'maimai', genre,
    imageUrl: '', isNew: false,
    difficulties: {
      standard: [{ type: 'standard', levelIndex: 3, level: '13', levelValue: 13, noteDesigner: designer, notes: null }],
      dx: [],
    },
  } as unknown as Song)

  it('命中偏好谱师时排序上浮（可反超微弱胜率差）', () => {
    const songs = [songWith(1, 'Jack'), songWith(2, 'はっぴー')]
    const votes = new Map([[1, vote(0.60, 800)], [2, vote(0.62, 800)]])
    const preference = { designers: new Set(['Jack']), rareGenres: new Set<string>() }
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, random: noShuffle, preference,
    })
    expect(pool.map(p => p.songId)).toEqual([1, 2])
  })

  it('无偏好画像时保持纯胜率排序', () => {
    const songs = [songWith(1, 'Jack'), songWith(2, 'はっぴー')]
    const votes = new Map([[1, vote(0.60, 800)], [2, vote(0.62, 800)]])
    const pool = buildExplorePool(songs, new Set(), votes, { minVotes: 30, random: noShuffle })
    expect(pool.map(p => p.songId)).toEqual([2, 1])
  })

  it('谱师别名归一化后仍能命中偏好', () => {
    const songs = [songWith(1, '緑風 犬三郎'), songWith(2, 'Jack')]
    const votes = new Map([[1, vote(0.60, 800)], [2, vote(0.62, 800)]])
    const preference = { designers: new Set(['はっぴー']), rareGenres: new Set<string>() }
    const pool = buildExplorePool(songs, new Set(), votes, {
      minVotes: 30, random: noShuffle, preference,
    })
    expect(pool.map(p => p.songId)).toEqual([1, 2])
  })
})
