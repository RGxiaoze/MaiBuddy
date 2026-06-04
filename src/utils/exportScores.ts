// ============================================================
// Score export — JSON download of all local scores
// ============================================================

import type { ScoreRecord } from '@/db/database'

/**
 * Export scores array as a downloadable JSON file.
 * File name format: maimai-scores-YYYY-MM-DD.json
 */
export function exportScoresToFile(scores: ScoreRecord[]): void {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: scores.length,
    scores: scores.map((s) => ({
      songId: s.songId,
      songTitle: s.songTitle,
      levelIndex: s.levelIndex,
      level: s.level,
      levelValue: s.levelValue,
      songType: s.songType,
      achievements: s.achievements,
      rate: s.rate,
      fcType: s.fcType,
      fsType: s.fsType,
      dxScore: s.dxScore,
      dxRating: s.dxRating,
      dxScoreDetail: s.dxScoreDetail,
      playDate: s.playDate,
    })),
  }

  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `maimai-scores-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
