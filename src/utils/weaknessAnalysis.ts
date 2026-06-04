// ============================================================
// Personal weakness analysis — identify player's weak chart types
// ============================================================

import { classifyChart, type ChartTag, ALL_TAGS, getTagMeta } from './chartTags'
import type { Song, ChartDifficulty } from '@/types'
import type { ScoreRecord } from '@/db/database'

export interface TagStats {
  tag: ChartTag
  label: string
  desc: string
  /** Number of charts of this type played at ≥ 97% */
  strongCount: number
  /** Number of charts of this type played at < 97% */
  weakCount: number
  /** Average achievement for this tag */
  avgAchievement: number
  /** Total charts of this type played */
  totalCount: number
}

export interface WeaknessResult {
  /** Per-tag statistics */
  tagStats: TagStats[]
  /** Primary weakness (worst avg achievement) */
  primaryWeakness: ChartTag | null
  /** Secondary weakness */
  secondaryWeakness: ChartTag | null
  /** Overall assessment */
  assessment: string
}

/**
 * Analyze player's weakness by grouping low-achievement scores by chart tag.
 */
export function analyzeWeakness(
  scores: ScoreRecord[],
  songMap: Map<number, Song>,
): WeaknessResult {
  // Build tag → achievements[]
  const tagAchievements = new Map<ChartTag, number[]>()
  for (const tag of ALL_TAGS) tagAchievements.set(tag, [])

  for (const score of scores) {
    const song = songMap.get(score.songId)
    if (!song) continue

    const allDiffs: ChartDifficulty[] = [...(song.difficulties?.standard || []), ...(song.difficulties?.dx || [])]
    const diff = allDiffs.find(d => d.levelIndex === score.levelIndex)
    if (!diff) continue

    const tag = classifyChart(diff, song.bpm)
    tagAchievements.get(tag)!.push(score.achievements)
  }

  // Build stats per tag
  const tagStats: TagStats[] = ALL_TAGS.map(tag => {
    const achievements = tagAchievements.get(tag) || []
    const strongCount = achievements.filter(a => a >= 97).length
    const weakCount = achievements.filter(a => a < 97).length
    const avgAchievement = achievements.length > 0
      ? achievements.reduce((s, a) => s + a, 0) / achievements.length
      : 0
    const meta = getTagMeta(tag)

    return {
      tag,
      label: meta.label,
      desc: meta.desc,
      strongCount,
      weakCount,
      avgAchievement,
      totalCount: achievements.length,
    }
  })

  // Find worst tags (only among tags with ≥ 3 scores to avoid noise)
  const scored = tagStats.filter(t => t.totalCount >= 3)
  scored.sort((a, b) => a.avgAchievement - b.avgAchievement)

  const primaryWeakness = scored.length > 0 ? scored[0].tag : null
  const secondaryWeakness = scored.length > 1 ? scored[1].tag : null

  // Generate assessment
  let assessment: string
  if (!primaryWeakness) {
    assessment = '数据不足，需要更多不同配置的谱面成绩来进行短板分析。'
  } else {
    const primaryMeta = getTagMeta(primaryWeakness)
    const primaryStats = tagStats.find(t => t.tag === primaryWeakness)!
    assessment = `主要短板为「${primaryMeta.label}」类型谱面（共 ${primaryStats.totalCount} 首，平均达成率 ${primaryStats.avgAchievement.toFixed(2)}%）。${primaryMeta.desc}。${primaryStats.weakCount} 首未达到 97%，建议优先提升此类配置。`
  }

  return { tagStats, primaryWeakness, secondaryWeakness, assessment }
}
