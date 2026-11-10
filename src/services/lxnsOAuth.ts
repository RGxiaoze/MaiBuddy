// ============================================================
// 落雪 LXNS OAuth（绑定 oauthCore 的 LXNS 配置）
//
// 与 DF 的关键差异：落雪的 token 端点**完整支持 CORS**，
// 纯前端可直接调用，不需要代理。
//
// 端点形状也不同于水鱼：token / revoke 都在 /api/v0 下（见下方 tokenPath）。
// 文档：https://maimai.lxns.net/docs/oauth-guide
// ============================================================

import * as core from './oauthCore'
import type { OAuthProvider, TokenSet } from './oauthCore'

export const LXNS_PROVIDER: OAuthProvider = {
  id: 'lxns',
  name: '落雪',
  authBase: 'https://maimai.lxns.net',
  clientId: 'a5a08c6a-c2f1-4bb0-bfc9-fbf0594337a4',
  /** read_player 覆盖玩家信息、谱面成绩与历史成绩 */
  scope: 'read_player',
  /** 落雪的授权端点不在根路径；token / revoke 都在 /api/v0 下 */
  tokenPath: '/api/v0/oauth/token',
  revokePath: '/api/v0/oauth/revoke',
  /**
   * dev 下跟随当前 origin：sessionStorage 按 origin 隔离，
   * 固定用 127.0.0.1 会让从 localhost 发起的授权在回跳后读不到 PKCE verifier。
   * 面板需同时登记 http://127.0.0.1:5173/ 与 http://localhost:5173/。
   */
  redirectUri: import.meta.env.DEV
    ? `${globalThis.location?.origin ?? 'http://127.0.0.1:5173'}/`
    : 'https://rgxiaoze.github.io/MaiBuddy/',
}

/** 配置是否完整（未填 clientId 时不应提供入口） */
export function isLxnsConfigured(): boolean {
  return LXNS_PROVIDER.clientId.length > 0
}

export const buildAuthorizeUrl = (): Promise<string> => core.buildAuthorizeUrl(LXNS_PROVIDER)

export function consumeVerifier(state: string): string {
  return core.consumeVerifier(state, LXNS_PROVIDER.id).verifier
}

export const exchangeCode = (code: string, verifier: string): Promise<TokenSet> =>
  core.exchangeCode(LXNS_PROVIDER, code, verifier)

export const loadToken = (): TokenSet | null => core.loadToken(LXNS_PROVIDER.id)

export const saveToken = (token: TokenSet | null): void => core.saveToken(LXNS_PROVIDER.id, token)

export const hasOAuthToken = (): boolean => core.hasToken(LXNS_PROVIDER.id)

export const getValidAccessToken = (): Promise<string | null> => core.getValidAccessToken(LXNS_PROVIDER)

export const revokeOAuth = (): Promise<void> => core.revokeToken(LXNS_PROVIDER)
