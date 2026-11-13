// ============================================================
// 水鱼 OAuth 代理 — Cloudflare Worker
//
// 背景：auth.diving-fish.com 未返回 Access-Control-Allow-Origin，
// 浏览器端 SPA（公开客户端 + PKCE）无法直接调用 /oauth/token。
// 本 Worker 只做一件事：把这两个端点原样转发，并补上 CORS 头。
//
// 安全边界（有意保持极简，便于审计）：
//   • 只代理 /oauth/token 与 /oauth/revoke，其他路径一律 404
//   • 只允许白名单 Origin，防止被他人当作开放代理
//   • 不读取、不记录、不存储任何请求体（令牌全程只是过路）
//
// 部署：
//   1. 注册 https://dash.cloudflare.com （免费）
//   2. Workers & Pages → Create → Worker，把本文件内容粘进去
//   3. 记下分配的地址，如 https://df-oauth.<你的子域>.workers.dev
//   4. 把前端 services/dfOAuth.ts 的 AUTH_BASE 换成该地址
// ============================================================

const UPSTREAM = 'https://auth.diving-fish.com'

/** 允许调用本代理的来源 */
const ALLOWED_ORIGINS = [
  'https://rgxiaoze.github.io',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
]

/** 只转发这两个端点 */
const ALLOWED_PATHS = new Set(['/oauth/token', '/oauth/revoke'])

/**
 * 白名单校验：不在名单里的来源一律拒绝。
 *
 * 只「反射」一个合法的 ACAO 头是不够的 —— 非白名单来源虽然读不到响应，
 * 请求仍会被原样转发到上游，等于对外提供了免费的令牌转发服务
 * （可用来抹掉来源 IP、绕过上游的额度限制）。
 */
function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || ''
  return ALLOWED_ORIGINS.includes(origin)
}

function corsHeaders(request) {
  // 只在 isAllowedOrigin 通过后调用，因此这里可以安全地原样回显
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // 白名单之外（含无 Origin 的非浏览器请求）直接拒绝：不转发、不回 CORS 头
    if (!isAllowedOrigin(request)) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method !== 'POST' || !ALLOWED_PATHS.has(url.pathname)) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      })
    }

    // 原样转发请求体，不解析、不留存
    const body = await request.text()

    let upstream
    try {
      upstream = await fetch(UPSTREAM + url.pathname, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/x-www-form-urlencoded',
        },
        body,
      })
    } catch {
      return new Response(JSON.stringify({ error: 'upstream_unreachable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
      })
    }

    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        ...corsHeaders(request),
      },
    })
  },
}
