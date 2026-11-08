import { describe, it, expect } from 'vitest'
import { normalizeDesigner } from '../adapter'

describe('normalizeDesigner', () => {
  it('保留正常谱师名', () => {
    expect(normalizeDesigner('ぴちネコ')).toBe('ぴちネコ')
    expect(normalizeDesigner('Luxizhel')).toBe('Luxizhel')
  })

  it('把 API 的占位符 "-" 归一为未知', () => {
    // BASIC / ADVANCED 游戏本身不标注谱师，API 用 "-" 占位
    expect(normalizeDesigner('-')).toBe('未知')
  })

  it('空值与纯空白归一为未知', () => {
    expect(normalizeDesigner(undefined)).toBe('未知')
    expect(normalizeDesigner('')).toBe('未知')
    expect(normalizeDesigner('   ')).toBe('未知')
  })

  it('已经是未知的保持未知', () => {
    expect(normalizeDesigner('未知')).toBe('未知')
  })

  it('去除首尾空白', () => {
    expect(normalizeDesigner('  Jack  ')).toBe('Jack')
  })
})
