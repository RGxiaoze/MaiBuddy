// ============================================================
// Practice song recommendation — find songs to train weaknesses
// ============================================================

import { classifyChart, type ChartTag, getTagMeta } from './chartTags'
import type { Song, ChartDifficulty } from '@/types'

export interface PracticeSong {
  songId: number
  songTitle: string
  levelIndex: number
  level: string
  levelValue: number
  tag: ChartTag
  reason: string
  /** Whether the player already has a 97%+ score on this chart */
  alreadyCleared: boolean
}

/**
 * Recommend practice songs for a specific chart tag (weakness).
 * Progressive difficulty: start from low levelValue, step up by ~0.5.
 * Excludes charts the player has already cleared at ≥ 97%.
 */
export function recommendPracticeSongs(
  targetTag: ChartTag,
  songs: Song[],
  clearedCharts: Set<string>, // "songId-levelIndex" of charts with ≥ 97% achievement
  maxPerLevel = 2,
): PracticeSong[] {
  const tagMeta = getTagMeta(targetTag)
  const results: PracticeSong[] = []

  // Filter songs matching the target tag
  const tagged: Array<{ song: Song; diff: ChartDifficulty }> = []
  for (const song of songs) {
    const allDiffs: ChartDifficulty[] = [...(song.difficulties?.standard || []), ...(song.difficulties?.dx || [])]
    for (const diff of allDiffs) {
      if (diff.levelValue <= 0) continue
      if (classifyChart(diff, song.bpm) === targetTag) {
        tagged.push({ song, diff })
      }
    }
  }

  // Sort by levelValue ascending
  tagged.sort((a, b) => a.diff.levelValue - b.diff.levelValue)

  // Pick progressive difficulty: step by ~0.5
  const picked = new Set<string>()
  let lastLevel = -1

  for (const { song, diff } of tagged) {
    const key = `${song.id}-${diff.levelIndex}`
    if (picked.has(key)) continue

    const alreadyCleared = clearedCharts.has(key)

    // Skip if already cleared AND we're targeting non-cleared only
    // (but include some cleared ones as reference)
    if (alreadyCleared && diff.levelValue > lastLevel + 0.8) {
      // Include one cleared chart per level as reference
    }

    // Progressive: only pick if levelValue stepped up enough
    if (diff.levelValue >= lastLevel + 0.3 || results.length === 0) {
      const countAtLevel = results.filter(r => Math.abs(r.levelValue - diff.levelValue) < 0.2).length
      if (countAtLevel >= maxPerLevel) continue

      results.push({
        songId: song.id,
        songTitle: song.title,
        levelIndex: diff.levelIndex,
        level: diff.level,
        levelValue: diff.levelValue,
        tag: targetTag,
        reason: `${tagMeta.label}类谱面（定数 ${diff.levelValue}），${alreadyCleared ? '已达标但可作为巩固练习' : '适合针对性提升'}`,
        alreadyCleared,
      })
      picked.add(key)
      lastLevel = diff.levelValue
    }

    // Cap at 15 recommendations
    if (results.length >= 15) break
  }

  return results
}
