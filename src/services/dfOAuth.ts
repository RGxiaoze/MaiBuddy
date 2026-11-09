// ============================================================
// 水鱼账号 OAuth（绑定 oauthCore 的 DF 配置）
//
// 额度：每用户 200 次/天、应用 1000 次/天起；换票另有每小时上限，
// 因此 access token 一律缓存到过期，不在每次请求时重换。
//
// ⚠ 水鱼的 token 端点未开放 CORS，纯前端需要代理（见 workers/df-oauth-proxy.js）。
//   落雪（lxnsOAuth.ts）已支持 CORS，可直接调用。
// ============================================================

import * as core from './oauthCore'
import type { OAuthProvider, TokenSet } from './oauthCore'

export type { TokenSet } from './oauthCore'

export const DF_PROVIDER: OAuthProvider = {
  id: 'df',
  name: '水鱼',
  authBase: 'https://auth.diving-fish.com',
  clientId: '7e6cd51604c3dd91d1607c7a06b25cf8',
  scope: 'openid profile prober.records.read',
  redirectUri: import.meta.env.DEV
    ? 'http://127.0.0.1:5173/'
    : 'https://rgxiaoze.github.io/MaiBuddy/',
}

export const DF_CLIENT_ID = DF_PROVIDER.clientId
export const DF_REDIRECT_URI = DF_PROVIDER.redirectUri
export const DF_SCOPE = DF_PROVIDER.scope

export type DfTokenSet = TokenSet

// ---- 绑定 DF 的薄封装（保持既有调用签名） ----

export const buildAuthorizeUrl = (): Promise<string> => core.buildAuthorizeUrl(DF_PROVIDER)

export const readCallbackParams = core.readCallbackParams

/** 校验 state 并返回 code_verifier */
export function consumeVerifier(state: string): string {
  return core.consumeVerifier(state, DF_PROVIDER.id).verifier
}

export const exchangeCode = (code: string, verifier: string): Promise<TokenSet> =>
  core.exchangeCode(DF_PROVIDER, code, verifier)

export const refreshToken = (refresh: string): Promise<TokenSet> =>
  core.refreshAccessToken(DF_PROVIDER, refresh)

export const loadToken = (): TokenSet | null => core.loadToken(DF_PROVIDER.id)

export const saveToken = (token: TokenSet | null): void => core.saveToken(DF_PROVIDER.id, token)

export const hasOAuthToken = (): boolean => core.hasToken(DF_PROVIDER.id)

export const getValidAccessToken = (): Promise<string | null> => core.getValidAccessToken(DF_PROVIDER)

export const revokeOAuth = (): Promise<void> => core.revokeToken(DF_PROVIDER)
