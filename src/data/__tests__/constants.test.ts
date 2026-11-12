import { describe, it, expect } from 'vitest'
import { getCoverUrl } from '../constants'

// 落雪按「基础 ID」存曲绘；本项目曲库来自水鱼，DX 谱面是独立条目（ID = 基础 + 10000），
// 所以 DX 条目必须先取余回基础 ID，否则指向不存在的文件。
describe('getCoverUrl', () => {
  const host = 'https://assets2.lxns.net/maimai/jacket'

  it('标准谱面直接使用自身 ID', () => {
    expect(getCoverUrl(1736)).toBe(`${host}/1736.png`)
  })

  it('DX 条目取余回基础 ID', () => {
    expect(getCoverUrl(11736)).toBe(`${host}/1736.png`)
    expect(getCoverUrl(10030)).toBe(`${host}/30.png`)
  })

  it('超过 11000 的 DX 条目同样换算（原实现只覆盖 10001–11000）', () => {
    expect(getCoverUrl(11818)).toBe(`${host}/1818.png`)
  })

  it('宴会场（≥ 100000）不参与换算', () => {
    expect(getCoverUrl(100001)).toBe(`${host}/100001.png`)
  })

  it('接受字符串 ID', () => {
    expect(getCoverUrl('11820')).toBe(`${host}/1820.png`)
  })

  it('thumb 变体指向本地缩略图，DX 条目同样换算', () => {
    const base = import.meta.env.BASE_URL
    expect(getCoverUrl(1736, 'thumb')).toBe(`${base}covers/1736.webp`)
    expect(getCoverUrl(11736, 'thumb')).toBe(`${base}covers/1736.webp`)
  })
})
