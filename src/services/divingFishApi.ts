// ============================================================
// Diving-Fish API service (primary data source)
// ============================================================

import type { DfChartInfo, DfMusic, Song } from '@/types'
import { getCoverUrl } from '@/data/constants'
import { toInternalSong, toInternalDfScore } from './adapter'
import type { DfScore } from './adapter'

const API_BASE = '/api/maimaidxprober'
const TIMEOUT_MS = 10_000

// ---- Internal helpers ----

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal, ...options })
    if (!res.ok) {
      throw new Error(`Diving-Fish API 请求失败：HTTP ${res.status}`)
    }
    return res
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时：Diving-Fish API 无响应，请检查网络连接')
    }
    if (err instanceof TypeError) {
      throw new Error('网络错误：无法连接到 Diving-Fish API，请检查网络')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ---- Public API ----

/**
 * Fetch all song metadata.
 * Returns internal Song[] format.
 */
export async function fetchMusicData(): Promise<Song[]> {
  const res = await fetchWithTimeout(`${API_BASE}/music_data`)
  const data: DfMusic[] = await res.json()

  return data.map((m) => toInternalSong(m, getCoverUrl(m.id)))
}

/**
 * Fetch player B50 scores by username or friend code.
 * Returns parsed B50 result with pre-computed ratings.
 */
export async function fetchPlayerScores(username: string): Promise<{ best35: DfScore[]; best15: DfScore[]; rating: number }> {
  const res = await fetchWithTimeout(`${API_BASE}/query/player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, b50: true }),
  })

  const data = await res.json()

  // Diving-Fish returns HTTP 200 even for errors, with {"message": "..."}
  if (!data.charts) {
    throw new Error(data.message || '玩家不存在或无 B50 数据')
  }

  return {
    best35: data.charts.sd.map(toInternalDfScore),
    best15: data.charts.dx.map(toInternalDfScore),
    rating: data.rating,
  }
}

// ---- Full score import ----

/**
 * Login to Diving-Fish with username/password.
 * Browser automatically stores the JWT cookie via Vite proxy cookieDomainRewrite.
 * After login, call generateImportToken() to get the Import-Token.
 */
export async function loginToProber(username: string, password: string): Promise<void> {
  await fetchWithTimeout(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  // JWT cookie is automatically stored by browser (proxy rewrites domain → localhost)
}

/**
 * Generate/retrieve Import-Token (requires prior login so JWT cookie is sent).
 * Returns the Import-Token string for use in fetchPlayerRecords.
 */
export async function generateImportToken(): Promise<string> {
  const res = await fetchWithTimeout(`${API_BASE}/player/import_token`, {
    method: 'PUT',
  })
  const data = await res.json()

  if (!data.token) {
    throw new Error(data.message || '获取 Import-Token 失败')
  }

  return data.token
}

/**
 * Fetch ALL player scores (every song × every difficulty).
 * Requires Import-Token header — user generates this on Diving-Fish profile page.
 */
export async function fetchPlayerRecords(importToken: string): Promise<{
  records: DfScore[]
  rating: number
  additionalRating: number
  nickname: string
  username: string
}> {
  const res = await fetchWithTimeout(`${API_BASE}/player/records`, {
    method: 'GET',
    headers: { 'Import-Token': importToken },
  })

  const data = await res.json()

  // Token invalid or expired (server may return 200 with error for some edge cases)
  if (!data.records || !Array.isArray(data.records)) {
    throw new Error(data.message || 'Import-Token 无效或已过期')
  }

  return {
    records: (data.records as DfChartInfo[]).map(toInternalDfScore),
    rating: data.rating ?? 0,
    additionalRating: data.additional_rating ?? 0,
    nickname: data.nickname || data.username || '',
    username: data.username || '',
  }
}

// ---- Chart stats types ----

export interface ChartStatEntry {
  cnt: number
  diff: number
  fit_diff: number
  avg: number
  avg_dx: number
  std_dev: number
  dist: number[]
  fc_dist: number[]
}

export interface DiffDataEntry {
  achievements: number
  dist: number[]
  fc_dist: number[]
}

export interface ChartStatsResponse {
  charts: Record<string, ChartStatEntry[]>
  diff_data: Record<string, DiffDataEntry>
}

// ---- Chart stats API ----

/** Fetch global chart statistics from Diving-Fish. No auth required. */
export async function fetchChartStats(): Promise<ChartStatsResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/chart_stats`)
  const data = await res.json()

  if (!data.charts) {
    throw new Error('chart_stats 响应缺少 charts 字段')
  }

  return data as ChartStatsResponse
}
