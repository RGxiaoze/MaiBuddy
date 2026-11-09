// ============================================================
// Score export — JSON backup / LXNS-compatible CSV
// ============================================================

import type { ScoreRecord } from '@/db/database'
import { buildLxnsCsv } from '@/utils/lxnsCsv'

/** 触发浏览器下载 */
function download(content: BlobPart, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
  download(JSON.stringify(payload, null, 2), 'application/json', `maimai-scores-${date}.json`)
}

/**
 * Export scores as a LXNS-compatible CSV（列与落雪导出完全一致，可回流到落雪）。
 * File name format: maimai-scores-YYYY-MM-DD.csv
 */
export function exportScoresAsLxnsCsv(scores: ScoreRecord[]): void {
  const date = new Date().toISOString().slice(0, 10)
  download(buildLxnsCsv(scores), 'text/csv;charset=utf-8', `maimai-scores-${date}.csv`)
}
