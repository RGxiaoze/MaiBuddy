// ============================================================
// OAuth 通用核心（授权码 + PKCE）
//
// 供多家授权服务器复用：水鱼 auth.diving-fish.com、落雪 maimai.lxns.net。
// 每家只需要提供一份 OAuthProvider 配置。
//
// 注意：水鱼的 token 端点未开放 CORS，纯前端只能借助代理；
// 落雪已完整支持 CORS，可直接调用。
// ============================================================

import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/utils/pkce'

export interface OAuthProvider {
  /** 存储隔离用的短标识，如 'df' / 'lxns' */
  id: string
  /** 展示名 */
  name: string
  /** 授权服务器根地址 */
  authBase: string
  clientId: string
  scope: string
  redirectUri: string
  /** token 端点路径，默认 /oauth/token（水鱼需换成代理地址时在此覆盖） */
  tokenPath?: string
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  /** 绝对过期时间戳（ms） */
  expiresAt: number
}

const PENDING_KEY = 'oauth_pending_provider'
const tokenKey = (id: string) => `oauth_token_${id}`
const verifierKey = (id: string) => `oauth_verifier_${id}`
const stateKey = (id: string) => `oauth_state_${id}`

const tokenEndpoint = (p: OAuthProvider) => `${p.authBase}${p.tokenPath ?? '/oauth/token'}`

// ---- 授权跳转 ----

export async function buildAuthorizeUrl(p: OAuthProvider): Promise<string> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  sessionStorage.setItem(PENDING_KEY, p.id)
  sessionStorage.setItem(verifierKey(p.id), verifier)
  sessionStorage.setItem(stateKey(p.id), state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    scope: p.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${p.authBase}/oauth/authorize?${params.toString()}`
}

/** 从 URL 读取授权码；返回 null 表示当前不是回调 */
export function readCallbackParams(search = window.location.search): { code: string; state: string } | null {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return null
  return { code, state }
}

/** 本次回调属于哪家授权服务器（由发起授权时记录） */
export function readPendingProviderId(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

/**
 * 校验 state 并取出 code_verifier。
 * @param state      回调带回的 state
 * @param providerId 期望的授权服务器 id；不传则用发起时记录的
 */
export function consumeVerifier(state: string, providerId?: string): { verifier: string; providerId: string } {
  const id = providerId ?? readPendingProviderId()
  if (!id) throw new Error('找不到本次授权的来源，请重新发起登录')

  const expected = sessionStorage.getItem(stateKey(id))
  const verifier = sessionStorage.getItem(verifierKey(id))
  sessionStorage.removeItem(stateKey(id))
  sessionStorage.removeItem(verifierKey(id))
  sessionStorage.removeItem(PENDING_KEY)

  if (!expected || expected !== state) throw new Error('state 不匹配，可能遭遇 CSRF，已中止')
  if (!verifier) throw new Error('缺少 code_verifier，请重新发起登录')
  return { verifier, providerId: id }
}

// ---- 换票 ----

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

function toTokenSet(data: TokenResponse): TokenSet {
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || '换取令牌失败')
  }
  const ttlMs = (data.expires_in ?? 600) * 1000
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // 提前 30 秒视为过期，避免边界上刚好失效
    expiresAt: Date.now() + Math.max(0, ttlMs - 30_000),
  }
}

async function postToken(p: OAuthProvider, body: Record<string, string>): Promise<TokenSet> {
  let res: Response
  try {
    res = await fetch(tokenEndpoint(p), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    })
  } catch {
    // 浏览器在 CORS 失败时只给 TypeError，翻译成可操作的说明
    throw new Error(
      `${p.name} 的授权服务器无法从浏览器直接访问（未开放跨域），` +
      '请改用其它导入方式。'
    )
  }
  const data = (await res.json()) as TokenResponse
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `换取令牌失败（HTTP ${res.status}）`)
  }
  return toTokenSet(data)
}

export async function exchangeCode(p: OAuthProvider, code: string, verifier: string): Promise<TokenSet> {
  return postToken(p, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: p.redirectUri,
    client_id: p.clientId,
    code_verifier: verifier,
  })
}

export async function refreshAccessToken(p: OAuthProvider, refresh: string): Promise<TokenSet> {
  return postToken(p, {
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: p.clientId,
  })
}

// ---- 本地缓存（按 provider 隔离） ----

export function loadToken(providerId: string): TokenSet | null {
  try {
    const raw = localStorage.getItem(tokenKey(providerId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenSet
    return parsed?.accessToken ? parsed : null
  } catch {
    return null
  }
}

export function saveToken(providerId: string, token: TokenSet | null): void {
  try {
    if (token) localStorage.setItem(tokenKey(providerId), JSON.stringify(token))
    else localStorage.removeItem(tokenKey(providerId))
  } catch {
    // 存储不可用（隐私模式）时降级
  }
}

export function hasToken(providerId: string): boolean {
  return loadToken(providerId) != null
}

/**
 * 取可用的 access token：未过期直接返回；过期且有 refresh token 时自动续期。
 */
export async function getValidAccessToken(p: OAuthProvider): Promise<string | null> {
  const token = loadToken(p.id)
  if (!token) return null
  if (Date.now() < token.expiresAt) return token.accessToken
  if (!token.refreshToken) return null

  try {
    const next = await refreshAccessToken(p, token.refreshToken)
    saveToken(p.id, { ...next, refreshToken: next.refreshToken ?? token.refreshToken })
    return next.accessToken
  } catch {
    saveToken(p.id, null)
    return null
  }
}

/**
 * 撤销授权：通知服务端并清空本地令牌。
 * 撤销失败也照样清本地——不能让用户卡在登录态里。
 */
export async function revokeToken(p: OAuthProvider): Promise<void> {
  const token = loadToken(p.id)
  if (!token) return
  const target = token.refreshToken ?? token.accessToken
  try {
    await fetch(`${p.authBase}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: target, client_id: p.clientId }).toString(),
    })
  } catch {
    // 忽略：本地令牌仍会清除
  } finally {
    saveToken(p.id, null)
  }
}
