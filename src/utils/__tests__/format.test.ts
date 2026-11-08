import { describe, it, expect } from 'vitest'
import { truncatePercent } from '../format'

describe('truncatePercent', () => {
  it('保留两位小数，多余位直接截断', () => {
    expect(truncatePercent(100.4967)).toBe('100.49')
    expect(truncatePercent(98.1234)).toBe('98.12')
  })

  it('绝不进位（100.49 不能变成 100.50）', () => {
    expect(truncatePercent(100.4999)).toBe('100.49')
    expect(truncatePercent(100.9999)).toBe('100.99')
    expect(truncatePercent(99.9999)).toBe('99.99')
  })

  it('本身只有两位小数时原样保留', () => {
    expect(truncatePercent(100.49)).toBe('100.49')
    expect(truncatePercent(100.5)).toBe('100.50')
  })

  it('整数补足两位小数', () => {
    expect(truncatePercent(100)).toBe('100.00')
    expect(truncatePercent(0)).toBe('0.00')
  })

  it('第三位是 5 也不进位', () => {
    expect(truncatePercent(100.005)).toBe('100.00')
    expect(truncatePercent(100.495)).toBe('100.49')
  })

  it('支持自定义小数位数', () => {
    expect(truncatePercent(100.4967, 1)).toBe('100.4')
    expect(truncatePercent(100.4967, 4)).toBe('100.4967')
  })
})
