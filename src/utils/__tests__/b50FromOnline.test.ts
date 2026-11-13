import { describe, it, expect } from 'vitest'
import { buildB50FromOnline } from '../b50'
import type { DfScore } from '@/services/adapter'

const mk = (over: Partial<DfScore>): DfScore => ({
  songId: 1,
  title: '测试曲',
  levelIndex: 3,
  level: '14',
  levelValue: 14.0,
  songType: 'dx',
  achievements: 100.0,
  dxRating: 300,
  dxScore: 2000,
  rate: 'sss',
  fcType: null,
  fsType: null,
  ...over,
})

describe('buildB50FromOnline', () => {
  it('合计 = best35 + best15', () => {
    const r = buildB50FromOnline([mk({ dxRating: 300 }), mk({ dxRating: 200 })], [mk({ dxRating: 250 })])
    expect(r.best35Total).toBe(500)
    expect(r.best15Total).toBe(250)
    expect(r.totalRating).toBe(750)
  })

  it('best15 条目标记为 isNew，best35 不标记', () => {
    const r = buildB50FromOnline([mk({})], [mk({})])
    expect(r.best35[0].isNew).toBe(false)
    expect(r.best15[0].isNew).toBe(true)
  })

  it('title 映射到 songTitle', () => {
    const r = buildB50FromOnline([mk({ title: '系ぎて' })], [])
    expect(r.best35[0].songTitle).toBe('系ぎて')
  })

  it('空数组得到 0 分', () => {
    const r = buildB50FromOnline([], [])
    expect(r.totalRating).toBe(0)
    expect(r.best35).toEqual([])
    expect(r.best15).toEqual([])
  })
})
