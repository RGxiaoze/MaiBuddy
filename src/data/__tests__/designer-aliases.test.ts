import { describe, it, expect } from 'vitest'
import { normalizeDesignerName, formatDesignerName } from '../designer-aliases'

describe('normalizeDesignerName', () => {
  it('全角引号包裹的 “H”ack 归并为 Jack', () => {
    expect(normalizeDesignerName('“H”ack')).toBe('Jack')
    expect(normalizeDesignerName('“H”ack underground')).toBe('Jack')
  })

  it('緑風 犬三郎 归并为 はっぴー', () => {
    expect(normalizeDesignerName('緑風 犬三郎')).toBe('はっぴー')
  })

  it('サファ太的各写法归并', () => {
    expect(normalizeDesignerName('Safata.Hz')).toBe('サファ太')
    expect(normalizeDesignerName('safaTAmago')).toBe('サファ太')
  })

  it('未收录的名字原样返回', () => {
    expect(normalizeDesignerName('ぴちネコ')).toBe('ぴちネコ')
    expect(normalizeDesignerName('Jack')).toBe('Jack')
  })

  it('合作署名不拆分', () => {
    expect(normalizeDesignerName('Jack vs 某S氏')).toBe('Jack vs 某S氏')
    expect(normalizeDesignerName('はっぴー vs Jack')).toBe('はっぴー vs Jack')
  })

  it('空值与空白安全处理', () => {
    expect(normalizeDesignerName('')).toBe('')
    expect(normalizeDesignerName('   ')).toBe('')
  })
})

describe('formatDesignerName', () => {
  it('有别名时显示「常用名（原名）」', () => {
    expect(formatDesignerName('“H”ack')).toBe('Jack（“H”ack）')
    expect(formatDesignerName('緑風 犬三郎')).toBe('はっぴー（緑風 犬三郎）')
  })

  it('无别名时原样显示', () => {
    expect(formatDesignerName('ぴちネコ')).toBe('ぴちネコ')
  })
})
