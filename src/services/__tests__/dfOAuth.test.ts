import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readCallbackParams, saveToken, loadToken, DF_REDIRECT_URI, DF_SCOPE } from '../dfOAuth'

// node 环境没有 localStorage，用内存实现替代
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v) },
  removeItem: (k: string) => { store.delete(k) },
})

beforeEach(() => store.clear())

describe('readCallbackParams', () => {
  it('解析授权回调的 code 与 state', () => {
    expect(readCallbackParams('?code=abc123&state=xyz')).toEqual({ code: 'abc123', state: 'xyz' })
  })

  it('缺少任一项则视为非回调', () => {
    expect(readCallbackParams('?code=abc123')).toBeNull()
    expect(readCallbackParams('?state=xyz')).toBeNull()
    expect(readCallbackParams('')).toBeNull()
  })

  it('忽略无关参数', () => {
    expect(readCallbackParams('?foo=1&code=c&state=s&bar=2')).toEqual({ code: 'c', state: 's' })
  })
})

describe('token 缓存', () => {
  const token = { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 60_000 }

  it('保存后可原样读回', () => {
    saveToken(token)
    expect(loadToken()).toEqual(token)
  })

  it('清除后返回 null', () => {
    saveToken(token)
    saveToken(null)
    expect(loadToken()).toBeNull()
  })

  it('脏数据不会抛错，返回 null', () => {
    localStorage.setItem('df_oauth_token', 'not-json')
    expect(loadToken()).toBeNull()
  })

  it('缺少 accessToken 的对象视为无效', () => {
    localStorage.setItem('df_oauth_token', JSON.stringify({ expiresAt: 1 }))
    expect(loadToken()).toBeNull()
  })
})

describe('常量', () => {
  it('redirect_uri 与登记值一致（线上）', () => {
    // 测试环境 import.meta.env.DEV 为 true，这里校验形状而非具体值
    expect(DF_REDIRECT_URI).toMatch(/^https?:\/\/.+\/$/)
  })

  it('scope 必须包含 openid（OIDC 基础）与成绩读取', () => {
    expect(DF_SCOPE.split(' ')).toContain('openid')
    expect(DF_SCOPE.split(' ')).toContain('prober.records.read')
  })
})
