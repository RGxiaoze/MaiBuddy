// ============================================================
// PKCE 工具（RFC 7636）
//
// 授权码流程要求 code_challenge_method=S256；水鱼强制 PKCE，
// 机密客户端也不例外。verifier 只保存在本机会话里，绝不发出去。
// ============================================================

/** BASE64URL 编码（去除 padding，替换 +/ 为 -_） */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * 生成 code_verifier。
 * RFC 7636 要求 43–128 个 unreserved 字符；64 字节 base64url 后为 86 字符。
 */
export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(64))
}

/** 生成 state，用于防 CSRF —— 回调时必须与存储值逐一比对 */
export function generateState(): string {
  return base64UrlEncode(randomBytes(16))
}

/** code_challenge = BASE64URL(SHA-256(verifier)) */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}
