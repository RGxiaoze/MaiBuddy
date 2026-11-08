import { describe, it, expect } from 'vitest'
import { parseVoteResult } from '../voteService'

describe('parseVoteResult', () => {
  it('把原始条目转成胜率统计', () => {
    const map = parseVoteResult([{ music_id: '833', total_vote: 4276, down_vote: 1268 }])
    const stat = map.get(833)
    expect(stat).toBeDefined()
    expect(stat!.totalVote).toBe(4276)
    expect(stat!.upVote).toBe(3008)
    expect(stat!.winRate).toBeCloseTo(3008 / 4276, 6)
  })

  it('跳过总票数为 0 或负数的条目', () => {
    const map = parseVoteResult([
      { music_id: '1', total_vote: 0, down_vote: 0 },
      { music_id: '2', total_vote: -5, down_vote: 0 },
    ])
    expect(map.size).toBe(0)
  })

  it('跳过 down_vote 超过总票数的脏数据', () => {
    const map = parseVoteResult([{ music_id: '3', total_vote: 10, down_vote: 20 }])
    expect(map.size).toBe(0)
  })

  it('跳过非法 music_id', () => {
    const map = parseVoteResult([
      { music_id: 'abc', total_vote: 100, down_vote: 40 },
      { music_id: '', total_vote: 100, down_vote: 40 },
    ])
    expect(map.size).toBe(0)
  })

  it('同一批数据里正常条目照常保留', () => {
    const map = parseVoteResult([
      { music_id: '10', total_vote: 100, down_vote: 40 },
      { music_id: 'bad', total_vote: 50, down_vote: 10 },
      { music_id: '11', total_vote: 200, down_vote: 50 },
    ])
    expect([...map.keys()]).toEqual([10, 11])
    expect(map.get(10)!.winRate).toBeCloseTo(0.6, 6)
  })
})
