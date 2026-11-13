import { describe, it, expect } from 'vitest'
import { describeDfHttpError } from '../divingFishApi'

describe('describeDfHttpError', () => {
  it('400 → 查不到玩家', () => {
    expect(describeDfHttpError(400)).toContain('查不到')
  })

  it('403 → 玩家关闭了成绩查询', () => {
    expect(describeDfHttpError(403)).toContain('关闭')
  })

  it('404 → 玩家不存在', () => {
    expect(describeDfHttpError(404)).toContain('不存在')
  })

  it('429 → 查询过于频繁', () => {
    expect(describeDfHttpError(429)).toContain('频繁')
  })

  it('5xx → 服务器暂时不可用', () => {
    expect(describeDfHttpError(500)).toContain('暂时不可用')
    expect(describeDfHttpError(503)).toContain('暂时不可用')
  })

  it('未单独覆盖的状态码仍保留状态码本身，便于排查', () => {
    expect(describeDfHttpError(418)).toContain('418')
  })

  it('面向用户的文案里不再出现「请求失败：HTTP 400」这种原文', () => {
    expect(describeDfHttpError(400)).not.toContain('请求失败')
  })
})
