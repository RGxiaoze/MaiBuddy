import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge, generateState, base64UrlEncode } from '../pkce'

describe('base64UrlEncode', () => {
  it('输出 URL 安全字符（无 + / =）', () => {
    const bytes = new Uint8Array([251, 255, 191, 0, 1, 2])
    const out = base64UrlEncode(bytes)
    expect(out).not.toMatch(/[+/=]/)
  })
})

describe('generateCodeVerifier', () => {
  it('长度符合 RFC 7636（43–128 字符）', () => {
    const v = generateCodeVerifier()
    expect(v.length).toBeGreaterThanOrEqual(43)
    expect(v.length).toBeLessThanOrEqual(128)
  })

  it('只含 URL 安全字符', () => {
    const v = generateCodeVerifier()
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('每次生成都不同', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })
})

describe('generateState', () => {
  it('非空且不重复', () => {
    const a = generateState()
    expect(a.length).toBeGreaterThan(8)
    expect(a).not.toBe(generateState())
  })
})

describe('generateCodeChallenge', () => {
  it('匹配 RFC 7636 附录 B 的测试向量', async () => {
    // verifier → S256 challenge 的官方示例
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = await generateCodeChallenge(verifier)
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('不同 verifier 产出不同 challenge', async () => {
    const a = await generateCodeChallenge(generateCodeVerifier())
    const b = await generateCodeChallenge(generateCodeVerifier())
    expect(a).not.toBe(b)
  })

  it('challenge 无 padding', async () => {
    const c = await generateCodeChallenge(generateCodeVerifier())
    expect(c).not.toContain('=')
  })
})
