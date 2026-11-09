// ============================================================
// 落雪 LXNS API
//
// • 公共 API（曲目列表等）无需认证
// • 个人 API 使用 OAuth access token（Authorization: Bearer）
// • 落雪已开放 CORS，纯前端可直接调用，不需要代理
//
// 文档：https://maimai.lxns.net/docs/api/maimai
// ============================================================

import type { LxnsScore, Song } from '@/types'
import type { DfScore } from './adapter'

const API_BASE = 'https://maimai.lxns.net/api/v0'
const TIMEOUT_MS = 15_000

/**
 * 落雪有两种凭据，请求头不同（文档「鉴权方式」）：
 * • OAuth access token → `Authorization: Bearer <token>`
 * • 个人 API 密钥       → `X-User-Token: <key>`
 * 混用一律 401，所以必须显式区分。
 */
export type LxnsAuth = 'oauth' | 'user'

function authHeaders(token: string, auth: LxnsAuth): Record<string, string> {
  return auth === 'user' ? { 'X-User-Token': token } : { Authorization: `Bearer ${token}` }
}

/**
 * 个人 / OAuth API 的响应外层包了 `{ success, code, message?, data }`，
 * 公共 API 则直接返回数据本身。两种形态都要能吃。
 */
function unwrap<T>(raw: unknown): T | null {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return ((raw as { data?: T }).data ?? null)
  }
  return (raw as T) ?? null
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 读取当前授权用户的全部成绩。
 * 对应「个人 API」——查询对象由 access token 决定，不需要 friend_code。
 */
export async function fetchMyScores(accessToken: string, auth: LxnsAuth = 'oauth'): Promise<LxnsScore[]> {
  let res: Response
  try {
    res = await fetchWithTimeout(`${API_BASE}/user/maimai/player/scores`, {
      headers: authHeaders(accessToken, auth),
    })
  } catch {
    throw new Error('无法连接落雪服务器，请检查网络')
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('落雪授权失败：凭据无效或已过期，请重新获取')
  }
  if (!res.ok) {
    throw new Error(`读取成绩失败（HTTP ${res.status}）`)
  }

  const data = unwrap<LxnsScore[]>(await res.json())
  return Array.isArray(data) ? data : []
}

/** 读取当前授权用户的基本信息 */
export async function fetchMyPlayer(accessToken: string, auth: LxnsAuth = 'oauth'): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/user/maimai/player`, {
      headers: authHeaders(accessToken, auth),
    })
    if (!res.ok) return null
    return unwrap<Record<string, unknown>>(await res.json())
  } catch {
    return null
  }
}

/**
 * 落雪 Score → 内部 DfScore，复用现有导入管线。
 *
 * 落雪的 Score 不含定数，需要从曲库补；找不到对应曲目/难度的条目直接跳过，
 * 避免把脏数据写进本地库。
 */
export function toDfScores(rawScores: LxnsScore[], songMap: Map<number, Song>): DfScore[] {
  const out: DfScore[] = []

  for (const raw of rawScores) {
    if (!raw || typeof raw.achievements !== 'number') continue

    // 官方文档的 Score 结构体用 id；早期版本用 song_id。两者兼容，同时存在时以 song_id 为准。
    const rawId = raw.song_id ?? raw.id
    if (typeof rawId !== 'number') continue

    // 本项目曲库来自水鱼：DX 谱面是独立条目，ID = 标准 ID + 10000。
    // 落雪用同一个 ID + type 区分，因此要先换算回曲库的键，再回退到基础 ID。
    const isDx = raw.type === 'dx'
    const song = songMap.get(isDx ? rawId + 10000 : rawId) ?? songMap.get(rawId)
    if (!song) continue

    // 依 type 优先取对应谱面列表，取不到再退到另一侧（兼容「合并」与「DX 独立条目」两种曲库模型）
    const dxDiff = song.difficulties.dx.find((d) => d.levelIndex === raw.level_index)
    const sdDiff = song.difficulties.standard.find((d) => d.levelIndex === raw.level_index)
    const preferred = isDx
      ? (dxDiff && { diff: dxDiff, type: 'dx' as const })
      : (sdDiff && { diff: sdDiff, type: 'standard' as const })
    const fallback = isDx
      ? (sdDiff && { diff: sdDiff, type: 'standard' as const })
      : (dxDiff && { diff: dxDiff, type: 'dx' as const })
    const match = preferred || fallback
    if (!match) continue

    out.push({
      songId: song.id,
      title: song.title,
      levelIndex: raw.level_index,
      level: raw.level ?? match.diff.level,
      levelValue: match.diff.levelValue,
      songType: match.type,
      achievements: raw.achievements,
      // 落雪给的是 8 位小数浮点（如 310.86037512），舞萌口径是整数
      dxRating: Math.floor(raw.dx_rating ?? 0),
      dxScore: raw.dx_score ?? 0,
      rate: raw.rate ?? '',
      fcType: raw.fc ?? null,
      fsType: raw.fs ?? null,
      // 落雪给的是 UTC 时间戳，取日期部分即可（探索用「多久没玩」）
      playDate: raw.play_time ? raw.play_time.slice(0, 10) : undefined,
    })
  }

  return out
}
