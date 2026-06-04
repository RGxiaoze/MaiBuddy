// ============================================================
// DX Score star rating — compute star count from DX score ratio
// ============================================================

/** DX star thresholds — DX score ratio (%) → star count */
export const DX_STAR_THRESHOLDS = [
  { min: 97, stars: 5 },
  { min: 95, stars: 4 },
  { min: 93, stars: 3 },
  { min: 90, stars: 2 },
  { min: 85, stars: 1 },
  { min: 0,  stars: 0 },
]

/**
 * Compute DX score ratio, star count, and theoretical max.
 *
 * @param dxScore   Player's actual DX score
 * @param totalNotes Total note count for the chart
 * @returns ratio (percentage, raw precision — use .toFixed(2) for display), stars (0-5), maxDxScore (totalNotes × 3)
 */
export function computeDxStar(dxScore: number, totalNotes: number): {
  ratio: number
  stars: number
  maxDxScore: number
} {
  const maxDxScore = totalNotes * 3
  if (maxDxScore <= 0 || dxScore < 0) return { ratio: 0, stars: 0, maxDxScore: 0 }
  const ratio = (dxScore / maxDxScore) * 100
  const stars = DX_STAR_THRESHOLDS.find(t => ratio >= t.min)?.stars ?? 0
  return { ratio, stars, maxDxScore }
}

/** Render star count as Unicode ⭐ string. Returns ☆ for zero stars. */
export function renderStars(stars: number): string {
  return stars > 0 ? '⭐'.repeat(stars) : ''
}
