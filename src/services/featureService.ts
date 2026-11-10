// ============================================================
// Feature service — load & query pre-computed simai features
// ============================================================

import type { DimensionScores } from '@/utils/dimensions'

// ---- Types matching simai_features.json ----

interface FeatureEntry {
  title: string
  artist: string
  bpm: number
  type: string
  musicId: number | null
  difficulties: Record<string, {
    raw: {
      processing: number
      stamina: number
      burst: number
      positioning5a?: number
      positioning5b?: number
      technique: number
    }
    normalized: DimensionScores
    meta: {
      longestNoRest: number
      restRatio: number
      peakCount: number
      timingChangeCount?: number
      slideTypeCount?: number
    }
  }>
}

interface FeaturesFile {
  songs: Record<string, FeatureEntry>
  norms: Record<string, number>
  stats: Record<string, { min: number; max: number; p95: number; count: number }>
}

// ---- Internal state ----

let _features: FeaturesFile | null = null
let _loading = false
let _loadPromise: Promise<FeaturesFile | null> | null = null

// ---- Normalization forwarder (for player dimensions) ----

export function getFeatureNorms(): Record<string, number> | null {
  return _features?.norms ?? null
}

// ---- Loading ----

const DATA_URL = `${import.meta.env.BASE_URL}data/simai_features.json`

/**
 * 优先取 gzip 版（4.5 MB → 872 KB）。
 *
 * 原始 JSON 由 `scripts/extract-features.ts` 手动生成、被 gitignore，
 * CI 从不产生它 —— 线上一直 404，五维页拿不到谱面特征却照常渲染。
 * 因此把压缩版提交进仓库，由 Vite 原样拷进产物。
 */
async function fetchCompressed(): Promise<FeaturesFile> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('浏览器不支持 DecompressionStream')
  }
  const res = await fetch(`${DATA_URL}.gz`)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  return JSON.parse(text) as FeaturesFile
}

export async function loadFeatures(): Promise<FeaturesFile | null> {
  if (_features) return _features
  if (_loading && _loadPromise) return _loadPromise

  _loading = true
  _loadPromise = fetchCompressed()
    .catch(() => fetch(DATA_URL).then(res => {
      // 本地开发通常有未压缩版本；线上没有则应报错而不是静默空数据
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<FeaturesFile>
    }))
    .then(data => {
      _features = data
      _loading = false
      return _features
    })
    .catch(err => {
      console.warn('Failed to load simai_features:', err)
      _loading = false
      _features = null
      return null
    })

  return _loadPromise
}

export function isFeaturesLoaded(): boolean {
  return _features !== null
}

// ---- Lookup ----

/**
 * Match an API song to its simai features entry.
 * Tries: musicId → title (with type normalization) → title (loose)
 */
function findFeatureEntry(
  songTitle: string,
  songId?: number,
  isDx?: boolean,
): FeatureEntry | null {
  if (!_features) return null

  // Strategy 1: exact key match (features key = "title [type][type]")
  const typeSuffix = isDx !== undefined ? ` [${isDx ? 'DX' : 'SD'}][${isDx ? 'DX' : 'SD'}]` : ''
  if (typeSuffix) {
    const fullKey = songTitle + typeSuffix
    if (_features.songs[fullKey]) return _features.songs[fullKey]
  }

  // Strategy 2: match by title (strip type markers from both)
  const cleanApiTitle = songTitle.replace(/\s*\[(SD|DX)\]\s*/g, '').trim().toLowerCase()
  for (const entry of Object.values(_features.songs)) {
    const cleanEntryTitle = entry.title.replace(/\s*\[(SD|DX)\]\s*/g, '').trim().toLowerCase()
    if (cleanEntryTitle === cleanApiTitle) return entry
  }

  // Strategy 3: fuzzy match (strip all special chars)
  const fuzzyApi = songTitle.replace(/[・！？\s\[\]SDXdx]/g, '').toLowerCase()
  for (const entry of Object.values(_features.songs)) {
    const fuzzyEntry = entry.title.replace(/[・！？\s\[\]SDXdx]/g, '').toLowerCase()
    if (fuzzyEntry === fuzzyApi) return entry
  }

  // Strategy 4: match by music_id (last resort — ID systems may differ)
  if (songId !== undefined) {
    for (const entry of Object.values(_features.songs)) {
      if (entry.musicId === songId) return entry
    }
  }

  return null
}

/** Map inote_id → levelIndex — same for SD and DX: 2=Basic, 3=Adv, 4=Exp, 5=Mas, 6=ReMas */
function inoteToLevelIndex(inoteId: number): number {
  const map: Record<number, number> = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4 }
  return map[inoteId] ?? -1
}

/**
 * Get pre-computed dimension scores for a chart.
 * Returns null if features not loaded or chart not found.
 */
export function getChartFeatures(
  songTitle: string,
  levelIndex: number,
  songId?: number,
  isDx?: boolean,
): DimensionScores | null {
  const entry = findFeatureEntry(songTitle, songId, isDx)
  if (!entry) return null

  // levelIndex → inote_id lookup
  for (const [diffKey, diffData] of Object.entries(entry.difficulties)) {
    const inoteId = parseInt(diffKey.replace('lv_', ''))
    const li = inoteToLevelIndex(inoteId)
    if (li === levelIndex) {
      return {
        processing: diffData.normalized.processing,
        stamina: diffData.normalized.stamina,
        burst: diffData.normalized.burst,
        positioning: diffData.normalized.positioning,
        technique: diffData.normalized.technique,
      }
    }
  }

  return null
}

/**
 * Get raw (pre-normalization) dimension scores.
 */
export function getChartFeaturesRaw(
  songTitle: string,
  levelIndex: number,
  songId?: number,
  isDx?: boolean,
): DimensionScores | null {
  const entry = findFeatureEntry(songTitle, songId, isDx)
  if (!entry) return null

  for (const [diffKey, diffData] of Object.entries(entry.difficulties)) {
    const inoteId = parseInt(diffKey.replace('lv_', ''))
    const li = inoteToLevelIndex(inoteId)
    if (li === levelIndex) {
      return {
        processing: diffData.raw.processing,
        stamina: diffData.raw.stamina,
        burst: diffData.raw.burst,
        positioning: ((diffData.raw.positioning5a ?? 0) + (diffData.raw.positioning5b ?? 0)) / 2,
        technique: diffData.raw.technique,
      }
    }
  }

  return null
}
