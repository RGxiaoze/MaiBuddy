import { describe, it, expect } from 'vitest'
import { parseAliasEntries, buildAliasIndex, searchAliases } from '../aliases'

describe('parseAliasEntries', () => {
  it('兼容 { code, content: [...] } 包装', () => {
    const raw = { code: 0, content: [{ SongID: 8, Name: 'True Love Song', Alias: ['真爱'] }] }
    expect(parseAliasEntries(raw)).toEqual([
      { SongID: 8, Name: 'True Love Song', Alias: ['真爱'] },
    ])
  })

  it('兼容裸数组', () => {
    const raw = [{ SongID: 9, Name: 'Color My World', Alias: ['cmw'] }]
    expect(parseAliasEntries(raw)).toHaveLength(1)
  })

  it('单条 Alias 缺失时归一为空数组，不抛错', () => {
    const raw = {
      code: 0,
      content: [
        { SongID: 1, Name: 'A' },
        { SongID: 2, Name: 'B', Alias: null },
        { SongID: 3, Name: 'C', Alias: ['c'] },
      ],
    }
    const out = parseAliasEntries(raw)
    expect(out).toHaveLength(3)
    expect(out[0].Alias).toEqual([])
    expect(out[1].Alias).toEqual([])
    expect(out[2].Alias).toEqual(['c'])
  })

  it('SongID 非数字的条目被跳过', () => {
    const raw = { content: [{ SongID: 'x', Name: 'A', Alias: [] }, { SongID: 5, Name: 'B', Alias: [] }] }
    expect(parseAliasEntries(raw).map((e) => e.SongID)).toEqual([5])
  })

  it('既无曲名也无别名的条目被跳过', () => {
    const raw = { content: [{ SongID: 6, Name: '', Alias: [] }] }
    expect(parseAliasEntries(raw)).toEqual([])
  })

  it('结构完全不对时抛错，而不是静默返回空', () => {
    expect(() => parseAliasEntries({ code: 1 })).toThrow()
    expect(() => parseAliasEntries(null)).toThrow()
  })
})

describe('buildAliasIndex', () => {
  it('曲名与别名都进索引，且统一小写', () => {
    const index = buildAliasIndex([
      { SongID: 8, Name: 'True Love Song', Alias: ['真爱', 'TRUE'] },
    ])
    expect(index.get('true love song')).toEqual([8])
    expect(index.get('真爱')).toEqual([8])
    expect(index.get('true')).toEqual([8])
  })

  it('同一别名指向多首歌时合并', () => {
    const index = buildAliasIndex([
      { SongID: 1, Name: 'A', Alias: ['同名'] },
      { SongID: 2, Name: 'B', Alias: ['同名'] },
    ])
    expect(index.get('同名')).toEqual([1, 2])
  })
})

describe('searchAliases', () => {
  const index = buildAliasIndex([
    { SongID: 8, Name: 'True Love Song', Alias: ['真爱', '糖糖'] },
    { SongID: 17, Name: 'Future', Alias: ['未来'] },
  ])

  it('按子串命中', () => {
    expect([...searchAliases('真爱', index)]).toEqual([8])
    expect([...searchAliases('糖', index)]).toEqual([8])
  })

  it('大小写不敏感', () => {
    expect([...searchAliases('FUTURE', index)]).toEqual([17])
  })

  it('无匹配返回空集合', () => {
    expect(searchAliases('不存在的别名', index).size).toBe(0)
  })

  it('索引未加载时返回空集合而不抛错', () => {
    expect(searchAliases('真爱', null).size).toBe(0)
  })

  it('空查询返回空集合', () => {
    expect(searchAliases('', index).size).toBe(0)
  })
})
