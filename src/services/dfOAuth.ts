// ============================================================
// 水鱼账号 OAuth（公开客户端 / 授权码 + PKCE）
//
// 额度约束：每位用户每日 200 次、应用每日 1000 次起（每多一位授权用户 +20）。
// 换票另有每小时上限 —— 因此 access token 必须缓存到过期，不得每次请求重换。
// ============================================================

import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/utils/pkce'

const AUTH_BASE = 'https://auth.diving-fish.com'

/** 公开客户端标识（不是密钥，可公开） */
export const DF_CLIENT_ID = '7e6cd51604c3dd91d1607c7a06b25cf8'

/** 必须与开发者控制台登记的回调地址逐字一致（端口不参与比对） */
export const DF_REDIRECT_URI = import.meta.env.DEV
  ? 'http://127.0.0.1:5173/'
  : 'https://rgxiaoze.github.io/MaiBuddy/'

export const DF_SCOPE = 'openid profile prober.records.read'

const VERIFIER_KEY = 'df_oauth_verifier'
const STATE_KEY = 'df_oauth_state'
const TOKEN_KEY = 'df_oauth_token'

export interface DfTokenSet {
  accessToken: string
  refreshToken?: string
  /** 绝对过期时间戳（ms） */
  expiresAt: number
}

// ---- 授权跳转 ----

/**
 * 生成授权页 URL，并把 verifier / state 暂存到 sessionStorage。
 * verifier 绝不能发出去，只在换票时使用。
 */
export async function buildAuthorizeUrl(): Promise<string> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: DF_CLIENT_ID,
    redirect_uri: DF_REDIRECT_URI,
    scope: DF_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`
}

/** 从当前 URL 读取授权码；返回 null 表示不是回调 */
export function readCallbackParams(search = window.location.search): {
  code: string; state: string
} | null {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state) return null
  return { code, state }
}

/** 校验 state 并取出本次流程的 code_verifier */
export function consumeVerifier(state: string): string {
  const expected = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  if (!expected || expected !== state) throw new Error('state 不匹配，可能遭遇 CSRF，已中止')
  if (!verifier) throw new Error('缺少 code_verifier，请重新发起登录')
  return verifier
}

// ---- 换票 ----

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

function toTokenSet(data: TokenResponse): DfTokenSet {
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

async function postToken(body: Record<string, string>): Promise<DfTokenSet> {
  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `换取令牌失败（HTTP ${res.status}）`)
  }
  return toTokenSet(data)
}

/** 用授权码换令牌 */
export async function exchangeCode(code: string, verifier: string): Promise<DfTokenSet> {
  return postToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: DF_REDIRECT_URI,
    client_id: DF_CLIENT_ID,
    code_verifier: verifier,
  })
}

/** 用 refresh token 换新令牌（公开客户端无 client_secret，靠 PKCE 担保） */
export async function refreshToken(refresh: string): Promise<DfTokenSet> {
  return postToken({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: DF_CLIENT_ID,
  })
}

// ---- 本地缓存 ----

export function loadToken(): DfTokenSet | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DfTokenSet
    return parsed?.accessToken ? parsed : null
  } catch {
    return null
  }
}

export function saveToken(token: DfTokenSet | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 存储不可用（隐私模式）时降级为仅内存可用
  }
}

/**
 * 取可用的 access token：
 * 未过期直接返回；已过期但有 refresh token 时自动续期；都没有则返回 null。
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = loadToken()
  if (!token) return null
  if (Date.now() < token.expiresAt) return token.accessToken

  if (!token.refreshToken) return null
  try {
    const next = await refreshToken(token.refreshToken)
    // 服务端可能不返回新的 refresh token，沿用旧的
    saveToken({ ...next, refreshToken: next.refreshToken ?? token.refreshToken })
    return next.accessToken
  } catch {
    saveToken(null)
    return null
  }
}
