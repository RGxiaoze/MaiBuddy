import { describe, it, expect } from 'vitest'
import { readCallbackError } from '../oauthCore'

describe('readCallbackError', () => {
  it('解析用户拒绝授权', () => {
    expect(readCallbackError('?error=access_denied&state=xyz')).toEqual({
      error: 'access_denied',
      description: '',
    })
  })

  it('解析带描述的服务器错误', () => {
    expect(readCallbackError('?error=invalid_request&error_description=bad+request')).toEqual({
      error: 'invalid_request',
      description: 'bad request',
    })
  })

  it('正常回调（只有 code）返回 null', () => {
    expect(readCallbackError('?code=abc&state=xyz')).toBeNull()
  })

  it('空查询返回 null', () => {
    expect(readCallbackError('')).toBeNull()
  })
})
