// ============================================================
// usePushSuggestions — reusable hook for push suggestion data
// Extracted from PushSuggestions.tsx for Recommend page reuse
// ============================================================

import { useMemo, useState, useEffect } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { computePushSuggestions, type PushSuggestion } from '@/utils/pushSuggestions'
import { computeTheoreticalMaxBoth, type B50Result } from '@/utils/b50'
import { loadStats, getChartStats, isStatsLoaded } from '@/services/statsService'

/** 核心推荐少于这个条数时，依次放宽拉伸补足 */
const MIN_CORE_SUGGESTIONS = 8
/**
 * 三档拉伸倍率：默认（B35 0.5 / B15 0.3）→ 0.8 / 0.48 → 1.0 / 0.6。
 * B15 按同一倍率缩放，始终比 B35 保守 40%。
 */
const STRETCH_TIERS = [1, 1.6, 2] as const

export interface PushHookResult {  /** Effective B50 (DF data takes priority when player explicitly queried) */
  effectiveB50: B50Result | null
  /** Current total rating */
  b50Rating: number
  /** Push suggestions (null when no B50 data) */
  suggestions: PushSuggestion[] | null
  /** Precision note when using DF-only data (estimated achievements) */
  precisionNote?: string
  /** Theoretical SSS+ max */
  theoryMax: number
  /** Theoretical AP max */
  theoryMaxAP: number
}

export function usePushSuggestions(): PushHookResult {
  const { localB50, onlineBest35, onlineBest15, onlineRating, onlinePlayerName } = usePlayerStore()
  const { scores } = useScoreStore()
  const { songs } = useSongStore()

  const [statsReady, setStatsReady] = useState(isStatsLoaded())

  useEffect(() => {
    if (!statsReady) {
      loadStats().then(() => setStatsReady(true)).catch(() => {})
    }
  }, [statsReady])

  const theoryMaxAll = useMemo(() => {
    if (songs.length === 0) return { sssPlusMax: 0, apMax: 0 }
    return computeTheoreticalMaxBoth(songs)
  }, [songs])

  const effectiveB50 = useMemo<B50Result | null>(() => {
    const useOnline = onlinePlayerName && (onlineBest35.length > 0 || onlineBest15.length > 0)

    if (!useOnline && localB50) return localB50
    if (onlineBest35.length === 0 && onlineBest15.length === 0) return null

    const toB50Entry = (s: typeof onlineBest35[number], isNew: boolean) => ({
      songId: s.songId,
      songTitle: s.title,
      levelIndex: s.levelIndex,
      level: s.level,
      levelValue: s.levelValue,
      songType: s.songType,
      achievements: s.achievements,
      rate: s.rate,
      dxRating: s.dxRating,
      dxScore: s.dxScore,
      fcType: s.fcType,
      fsType: s.fsType,
      isNew,
    })

    const best35 = onlineBest35.map(s => toB50Entry(s, false))
    const best15 = onlineBest15.map(s => toB50Entry(s, true))
    const best35Total = best35.reduce((sum, e) => sum + e.dxRating, 0)
    const best15Total = best15.reduce((sum, e) => sum + e.dxRating, 0)

    return { best35, best15, best35Total, best15Total, totalRating: best35Total + best15Total }
  }, [localB50, onlineBest35, onlineBest15, onlinePlayerName])

  const b50Rating = effectiveB50?.totalRating ?? onlineRating

  const result = useMemo(() => {
    if (!effectiveB50 || songs.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    const opts = {
      allScores: scores.length > 0 ? scores : undefined,
      getStats: getChartStats,
    }

    // 分档补足：核心档（默认拉伸）不够时才逐级放宽目标。
    // 放宽后的条目 tier 更大，由 UI 单独放在列表末尾，不与核心推荐混排。
    const merged: PushSuggestion[] = []
    const seen = new Set<string>()
    let precisionNote: string | undefined

    for (let i = 0; i < STRETCH_TIERS.length; i++) {
      const tier = (i + 1) as 1 | 2 | 3
      const r = computePushSuggestions(effectiveB50, songMap, {
        ...opts,
        stretchScale: STRETCH_TIERS[i],
      })
      precisionNote ??= r.precisionNote

      for (const s of r.suggestions) {
        const key = `${s.songId}-${s.levelIndex}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push({ ...s, tier })
      }

      // 核心档已经够多，就不用再放宽
      if (tier === 1 && merged.length >= MIN_CORE_SUGGESTIONS) break
    }

    return { suggestions: merged, precisionNote }
  }, [effectiveB50, localB50, scores, songs, statsReady, onlinePlayerName, onlineBest35, onlineBest15])

  return {
    effectiveB50,
    b50Rating,
    suggestions: result?.suggestions ?? null,
    precisionNote: result?.precisionNote,
    theoryMax: theoryMaxAll.sssPlusMax,
    theoryMaxAP: theoryMaxAll.apMax,
  }
}
