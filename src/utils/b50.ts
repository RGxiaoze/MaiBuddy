// ============================================================
// B50 composition — compute best-50 rating from local scores
// ============================================================

import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'
import { computeRating } from './rating'
import { MAX_ACHIEVEMENTS, UTAGE_ID_THRESHOLD, B35_SIZE, B15_SIZE } from '@/config/algorithms'

/** B50 result entry — best score for a single chart */
export interface B50Entry {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  songType: string
  achievements: number
  rate: string
  dxRating: number
  dxScore: number
  fcType: string | null
  fsType: string | null
  isNew: boolean
}

/** Full B50 result */
export interface B50Result {
  best35: B50Entry[]
  best15: B50Entry[]
  best35Total: number
  best15Total: number
  totalRating: number
}

/**
 * Sort B50 entries: rating desc → levelValue desc → achievements desc.
 */
export function sortByRating(a: B50Entry, b: B50Entry): number {
  if (a.dxRating !== b.dxRating) return b.dxRating - a.dxRating
  if (a.levelValue !== b.levelValue) return b.levelValue - a.levelValue
  return b.achievements - a.achievements
}

/**
 * Compute the theoretical maximum DX Rating achievable with the current song library.
 *
 * 算法步骤：
 * 1. 遍历所有曲目，跳过宴会场（ID ≥ 100000）
 * 2. 每首曲取最高定数谱面，按 isNew 分入旧曲池和新曲池
 * 3. 各池按定数降序排列，取前 B35/B15 首
 * 4. 假设每首谱面达成率为 100.5%，累加 Rating
 *
 * @param songs - 全曲库列表
 * @returns 理论最高 DX Rating
 */
export function computeTheoreticalMaxRating(songs: Song[]): number {
  const oldPool: { levelValue: number }[] = []
  const newPool: { levelValue: number }[] = []

  for (const song of songs) {
    if (song.id >= UTAGE_ID_THRESHOLD) continue // skip utage
    let bestLevelValue = 0
    for (const diff of [...song.difficulties.standard, ...song.difficulties.dx]) {
      if (diff.levelValue > bestLevelValue) {
        bestLevelValue = diff.levelValue
      }
    }
    if (bestLevelValue <= 0) continue
    if (song.isNew) {
      newPool.push({ levelValue: bestLevelValue })
    } else {
      oldPool.push({ levelValue: bestLevelValue })
    }
  }

  oldPool.sort((a, b) => b.levelValue - a.levelValue)
  newPool.sort((a, b) => b.levelValue - a.levelValue)

  const bestOld = oldPool.slice(0, B35_SIZE)
  const bestNew = newPool.slice(0, B15_SIZE)

  let total = 0
  for (const e of bestOld) total += computeRating(e.levelValue, MAX_ACHIEVEMENTS)
  for (const e of bestNew) total += computeRating(e.levelValue, MAX_ACHIEVEMENTS)

  return total
}

/**
 * Compute B50 from local scores + song metadata.
 *
 * 算法步骤：
 * 1. 对每个 (songId + levelIndex) 组合保留最高达成率的成绩
 * 2. 跳过宴会场曲目（ID ≥ 100000）
 * 3. 为每条成绩计算 DX Rating（优先用已有的 dxRating，否则公式计算）
 * 4. 按 Rating 降序 → 定数降序 → 达成率降序排列
 * 5. 按 isNew 分成旧曲池（取前 B35 首）和新曲池（取前 B15 首）
 * 6. 分别累加两池的 Rating 总和
 *
 * @param scores - IndexedDB 中所有成绩记录
 * @param songMap - Map<songId, Song> 用于查 isNew 和曲目元数据
 * @returns B50 结果（两池条目 + 各池总和 + 总 Rating）
 */
export function computeB50(scores: ScoreRecord[], songMap: Map<number, Song>): B50Result {
  // Step 1: for each (songId + levelIndex), keep only the best achievement
  const bestByChart = new Map<string, ScoreRecord>()
  for (const s of scores) {
    const key = `${s.songId}-${s.levelIndex}`
    const existing = bestByChart.get(key)
    if (!existing || s.achievements > existing.achievements) {
      bestByChart.set(key, s)
    }
  }

  // Step 2: build B50 entries, computing per-chart rating
  const entries: B50Entry[] = []
  for (const s of bestByChart.values()) {
    const song = songMap.get(s.songId)

    // Skip utage (song_id >= UTAGE_ID_THRESHOLD)
    if (s.songId >= UTAGE_ID_THRESHOLD) continue

    // For scores that already have a pre-computed dxRating, use it
    // Otherwise compute from levelValue + achievements
    const levelValue = s.levelValue
    const dxRating = s.dxRating > 0 ? s.dxRating : computeRating(levelValue, s.achievements)

    if (dxRating <= 0) continue

    entries.push({
      songId: s.songId,
      songTitle: s.songTitle,
      levelIndex: s.levelIndex,
      level: s.level,
      levelValue,
      songType: s.songType,
      achievements: s.achievements,
      rate: s.rate,
      dxRating,
      dxScore: s.dxScore,
      fcType: s.fcType,
      fsType: s.fsType,
      isNew: song?.isNew ?? false,
    })
  }

  // Step 3: sort by rating desc
  entries.sort(sortByRating)

  // Step 4: split into old (best35) and new (best15)
  const oldPool: B50Entry[] = []
  const newPool: B50Entry[] = []
  for (const e of entries) {
    if (e.isNew) {
      newPool.push(e)
    } else {
      oldPool.push(e)
    }
  }

  // Step 5: take top N
  const best35 = oldPool.slice(0, B35_SIZE)
  const best15 = newPool.slice(0, B15_SIZE)

  const best35Total = best35.reduce((sum, e) => sum + e.dxRating, 0)
  const best15Total = best15.reduce((sum, e) => sum + e.dxRating, 0)

  return {
    best35,
    best15,
    best35Total,
    best15Total,
    totalRating: best35Total + best15Total,
  }
}
