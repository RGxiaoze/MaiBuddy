// ============================================================
// Bilibili search URL generator
// ============================================================

/**
 * Generate a Bilibili video search URL for a specific song.
 * Keyword format: "{songTitle} maimai {difficulty} ap"
 * Uses click-based sorting to surface the most relevant videos.
 */
export function bilibiliSearchUrl(songTitle: string, difficulty: string): string {
  const query = encodeURIComponent(`${songTitle} maimai ${difficulty} ap`)
  return `https://search.bilibili.com/video?keyword=${query}&order=click`
}
