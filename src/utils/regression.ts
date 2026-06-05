// ============================================================
// Simple linear regression — predict achievement from level value
// ============================================================

/**
 * Fit a simple least-squares linear regression: y = slope * x + intercept.
 * Returns { slope, intercept }.
 */
export function fitLinearRegression(points: [number, number][]): { slope: number; intercept: number } {
  if (points.length === 0) return { slope: 0, intercept: 0 }

  const n = points.length
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0

  for (const [x, y] of points) {
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX
  // Use 1e-6 to handle floating-point noise when all x values are (nominally) equal,
  // while preserving meaningful variance (smallest denominator for L and L+0.1 is ≈0.01)
  if (Math.abs(denominator) < 1e-6) {
    // All x values equal — horizontal line at mean y
    return { slope: 0, intercept: sumY / n }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/**
 * Create a prediction function from B50 scores.
 * Input: B50 entry-like objects with levelValue and achievements.
 * Output: a function that maps level → predicted achievable achievement.
 *
 * Predicted values are clamped to [80, 100.5] to keep estimates in the achievable range.
 */
export function predictLevelToAch(
  b50Scores: { levelValue: number; achievements: number }[],
): (level: number) => number {
  const points: [number, number][] = b50Scores.map((s) => [s.levelValue, s.achievements])
  const { slope, intercept } = fitLinearRegression(points)

  return (level: number): number => {
    const raw = slope * level + intercept
    // Clamp between 80% and MAX_ACHIEVEMENTS (100.5%)
    return Math.max(80, Math.min(100.5, Math.round(raw * 10) / 10))
  }
}
