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
export async function fetchMyScores(accessToken: string): Promise<LxnsScore[]> {
  let res: Response
  try {
    res = await fetchWithTimeout(`${API_BASE}/user/maimai/player/scores`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('无法连接落雪服务器，请检查网络')
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('落雪授权已失效或权限不足，请重新授权')
  }
  if (!res.ok) {
    throw new Error(`读取成绩失败（HTTP ${res.status}）`)
  }

  const data = await res.json()
  return Array.isArray(data) ? (data as LxnsScore[]) : []
}

/** 读取当前授权用户的基本信息 */
export async function fetchMyPlayer(accessToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/user/maimai/player`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
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
    if (!raw || typeof raw.song_id !== 'number') continue
    if (typeof raw.achievements !== 'number') continue

    const song = songMap.get(raw.song_id)
    if (!song) continue

    const songType = raw.type === 'dx' ? 'dx' : 'standard'
    const diffs = songType === 'dx' ? song.difficulties.dx : song.difficulties.standard
    const diff = diffs.find((d) => d.levelIndex === raw.level_index)
    if (!diff) continue

    out.push({
      songId: song.id,
      title: song.title,
      levelIndex: raw.level_index,
      level: raw.level ?? diff.level,
      levelValue: diff.levelValue,
      songType,
      achievements: raw.achievements,
      dxRating: raw.dx_rating ?? 0,
      dxScore: raw.dx_score ?? 0,
      rate: raw.rate ?? '',
      fcType: raw.fc ?? null,
      fsType: raw.fs ?? null,
    })
  }

  return out
}
