import { describe, it, expect } from 'vitest'
import { withLxnsReleaseDates } from '../lxnsSongs'
import type { Song } from '@/types'

function song(id: number, releaseDate?: string): Song {
  return {
    id, title: `S${id}`, artist: 'a', bpm: 150, from: 'maimai', genre: '舞萌',
    imageUrl: '', isNew: false, releaseDate,
    difficulties: { standard: [], dx: [] },
  } as unknown as Song
}

describe('withLxnsReleaseDates', () => {
  const dates = new Map([[8, '2019-12-05'], [112, '2021-03-18']])

  it('按基础 ID 补齐实装日期', () => {
    const out = withLxnsReleaseDates([song(8)], dates)
    expect(out[0].releaseDate).toBe('2019-12-05')
  })

  it('DX 独立条目（基础 + 10000）也补上同一天', () => {
    const out = withLxnsReleaseDates([song(10008)], dates)
    expect(out[0].releaseDate).toBe('2019-12-05')
  })

  it('已有日期的曲目不被覆盖', () => {
    const out = withLxnsReleaseDates([song(8, '2000-01-01')], dates)
    expect(out[0].releaseDate).toBe('2000-01-01')
  })

  it('查不到日期的曲目保持原样', () => {
    const out = withLxnsReleaseDates([song(999)], dates)
    expect(out[0].releaseDate).toBeUndefined()
  })

  it('日期表为空时原样返回，不做无谓复制', () => {
    const input = [song(8)]
    expect(withLxnsReleaseDates(input, new Map())).toBe(input)
  })

  it('不修改入参数组', () => {
    const input = [song(8)]
    withLxnsReleaseDates(input, dates)
    expect(input[0].releaseDate).toBeUndefined()
  })
})
