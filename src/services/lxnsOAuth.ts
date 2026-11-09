// ============================================================
// 落雪 LXNS OAuth（绑定 oauthCore 的 LXNS 配置）
//
// 与 DF 的关键差异：落雪的 token 端点**完整支持 CORS**，
// 纯前端可直接调用，不需要代理。
//
// 待办：clientId 需在落雪开发者面板创建应用后填入。
// 文档：https://maimai.lxns.net/docs/oauth-guide
// ============================================================

import * as core from './oauthCore'
import type { OAuthProvider, TokenSet } from './oauthCore'

export const LXNS_PROVIDER: OAuthProvider = {
  id: 'lxns',
  name: '落雪',
  authBase: 'https://maimai.lxns.net',
  /** TODO: 在落雪开发者面板创建应用后填入 */
  clientId: '',
  /** read_player 覆盖玩家信息、谱面成绩与历史成绩 */
  scope: 'read_player',
  redirectUri: import.meta.env.DEV
    ? 'http://127.0.0.1:5173/'
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
