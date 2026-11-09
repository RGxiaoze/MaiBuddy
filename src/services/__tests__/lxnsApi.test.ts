import { describe, it, expect, vi, afterEach } from 'vitest'
import { toDfScores, fetchMyScores, fetchMyPlayer } from '../lxnsApi'
import type { LxnsScore, Song } from '@/types'

function diff(levelIndex: number, level: string, levelValue: number) {
  return { type: 'standard' as const, levelIndex, level, levelValue, noteDesigner: '', notes: null }
}

function song(id: number, standard: ReturnType<typeof diff>[], dx: ReturnType<typeof diff>[] = []): Song {
  return {
    id, title: `Song ${id}`, artist: 'a', bpm: 150, from: 'maimai', genre: '舞萌',
    imageUrl: '', isNew: false,
    difficulties: { standard, dx },
  } as unknown as Song
}

const map = new Map<number, Song>([
  [1, song(1, [diff(3, '13+', 13.7)], [diff(3, '14', 14.0)])],
  [2, song(2, [diff(0, '5', 5.0)])],
])

function raw(overrides: Partial<LxnsScore>): LxnsScore {
  return { song_id: 1, level_index: 3, achievements: 100.5, ...overrides } as LxnsScore
}

describe('toDfScores', () => {
  it('正常转换为内部结构，定数从曲库补齐', () => {
    const out = toDfScores([raw({ dx_rating: 320, dx_score: 2500, rate: 'sssp', fc: 'fc', fs: 'sync' })], map)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      songId: 1,
      title: 'Song 1',
      levelIndex: 3,
      level: '13+',
      levelValue: 13.7,
      songType: 'standard',
      achievements: 100.5,
      dxRating: 320,
      dxScore: 2500,
      rate: 'sssp',
      fcType: 'fc',
      fsType: 'sync',
    })
  })

  it('type=dx 时取 dx 难度谱面', () => {
    const out = toDfScores([raw({ type: 'dx' })], map)
    expect(out[0].songType).toBe('dx')
    expect(out[0].levelValue).toBe(14.0)
  })

  it('曲库中找不到该曲目时跳过', () => {
    const out = toDfScores([raw({ song_id: 999 })], map)
    expect(out).toHaveLength(0)
  })

  it('找不到对应难度时跳过', () => {
    const out = toDfScores([raw({ level_index: 4 })], map)
    expect(out).toHaveLength(0)
  })

  it('缺少关键字段的脏数据被跳过', () => {
    const out = toDfScores([
      { song_id: 1, level_index: 3 } as LxnsScore,
      { level_index: 3, achievements: 100 } as LxnsScore,
    ], map)
    expect(out).toHaveLength(0)
  })

  it('缺失的可选字段给默认值', () => {
    const out = toDfScores([raw({})], map)
    expect(out[0].dxRating).toBe(0)
    expect(out[0].dxScore).toBe(0)
    expect(out[0].rate).toBe('')
    expect(out[0].fcType).toBeNull()
    expect(out[0].fsType).toBeNull()
  })

  it('level 字段优先用落雪返回值', () => {
    const out = toDfScores([raw({ level: '13' })], map)
    expect(out[0].level).toBe('13')
  })

  // 官方文档的 Score 结构体把曲目 ID 命名为 id；早期版本是 song_id。
  it('曲目 ID 用 id 字段时同样能转换', () => {
    const out = toDfScores([{ id: 1, level_index: 3, achievements: 100.5 } as LxnsScore], map)
    expect(out).toHaveLength(1)
    expect(out[0].songId).toBe(1)
  })

  it('id 与 song_id 同时存在时以 song_id 为准', () => {
    const out = toDfScores([{ id: 2, song_id: 1, level_index: 3, achievements: 100.5 } as LxnsScore], map)
    expect(out[0].songId).toBe(1)
    expect(out[0].levelValue).toBe(13.7)
  })

  // 本项目曲库来自水鱼：DX 谱面是独立条目，ID = 标准 ID + 10000。
  // 落雪用同一个 ID + type 区分，转换时必须换算回曲库的键，否则 DX 谱面全部丢失。
  it('type=dx 时换算到曲库的 +10000 条目', () => {
    const dxOnly = new Map<number, Song>([[10001, song(10001, [], [diff(3, '14', 14.0)])]])
    const out = toDfScores([{ id: 1, type: 'dx', level_index: 3, achievements: 100.5 } as LxnsScore], dxOnly)
    expect(out).toHaveLength(1)
    expect(out[0].songId).toBe(10001)
    expect(out[0].songType).toBe('dx')
    expect(out[0].levelValue).toBe(14.0)
  })

  it('type=standard 时仍用基础 ID', () => {
    const sdOnly = new Map<number, Song>([[1, song(1, [diff(3, '13+', 13.7)])]])
    const out = toDfScores([{ id: 1, type: 'standard', level_index: 3, achievements: 100.5 } as LxnsScore], sdOnly)
    expect(out[0].songId).toBe(1)
    expect(out[0].songType).toBe('standard')
  })
})

describe('落雪凭据与响应解析', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockJson(body: unknown, status = 200) {
    const spy = vi.fn(async () => new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', spy)
    return spy
  }

  function sentHeaders(spy: ReturnType<typeof vi.fn>) {
    return (spy.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>
  }

  it('个人 API 密钥使用 X-User-Token 头', async () => {
    const spy = mockJson({ success: true, code: 200, data: [] })
    await fetchMyScores('KEY', 'user')
    const headers = sentHeaders(spy)
    expect(headers['X-User-Token']).toBe('KEY')
    expect(headers.Authorization).toBeUndefined()
  })

  it('OAuth 令牌默认使用 Authorization: Bearer', async () => {
    const spy = mockJson({ success: true, code: 200, data: [] })
    await fetchMyScores('TOKEN')
    const headers = sentHeaders(spy)
    expect(headers.Authorization).toBe('Bearer TOKEN')
    expect(headers['X-User-Token']).toBeUndefined()
  })

  it('解开外层信封取出 data 数组', async () => {
    mockJson({ success: true, code: 200, data: [{ song_id: 1, level_index: 3, achievements: 100 }] })
    const out = await fetchMyScores('KEY', 'user')
    expect(out).toHaveLength(1)
  })

  it('直接返回裸数组时也能处理', async () => {
    mockJson([{ song_id: 1, level_index: 3, achievements: 100 }])
    const out = await fetchMyScores('KEY', 'user')
    expect(out).toHaveLength(1)
  })

  it('401 时抛出凭据失效提示', async () => {
    mockJson({ success: false, code: 401, message: 'unauthorized' }, 401)
    await expect(fetchMyScores('BAD', 'user')).rejects.toThrow(/凭据无效/)
  })

  it('fetchMyPlayer 同样解开信封', async () => {
    mockJson({ success: true, code: 200, data: { name: '小泽', rating: 16230 } })
    await expect(fetchMyPlayer('KEY', 'user')).resolves.toMatchObject({ name: '小泽', rating: 16230 })
  })
})
