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

export interface PushHookResult {
  /** Effective B50 (DF data takes priority when player explicitly queried) */
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
  const { localB50, dfBest35, dfBest15, dfRating, dfPlayerName } = usePlayerStore()
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
    const useDF = dfPlayerName && (dfBest35.length > 0 || dfBest15.length > 0)

    if (!useDF && localB50) return localB50
    if (dfBest35.length === 0 && dfBest15.length === 0) return null

    const toB50Entry = (s: typeof dfBest35[number], isNew: boolean) => ({
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

    const best35 = dfBest35.map(s => toB50Entry(s, false))
    const best15 = dfBest15.map(s => toB50Entry(s, true))
    const best35Total = best35.reduce((sum, e) => sum + e.dxRating, 0)
    const best15Total = best15.reduce((sum, e) => sum + e.dxRating, 0)

    return { best35, best15, best35Total, best15Total, totalRating: best35Total + best15Total }
  }, [localB50, dfBest35, dfBest15, dfPlayerName])

  const b50Rating = effectiveB50?.totalRating ?? dfRating

  const result = useMemo(() => {
    if (!effectiveB50 || songs.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    return computePushSuggestions(effectiveB50, songMap, {
      allScores: scores.length > 0 ? scores : undefined,
      getStats: getChartStats,
    })
  }, [effectiveB50, localB50, scores, songs, statsReady, dfPlayerName, dfBest35, dfBest15])

  return {
    effectiveB50,
    b50Rating,
    suggestions: result?.suggestions ?? null,
    precisionNote: result?.precisionNote,
    theoryMax: theoryMaxAll.sssPlusMax,
    theoryMaxAP: theoryMaxAll.apMax,
  }
}
