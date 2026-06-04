// ============================================================
// Knowledge base — lazy load from public/data/kb.json
// ============================================================

export interface LadderStrategy {
  min: number
  max: number
  content: string
}

export interface AchievementInfo {
  name: string
  content: string
}

export interface KnowledgeBase {
  ladderStrategies: Record<string, LadderStrategy>
  achievements: Record<string, AchievementInfo>
}

let _kb: KnowledgeBase | null = null
let _loadPromise: Promise<KnowledgeBase> | null = null

/**
 * Load knowledge base JSON. Lazy — first call triggers fetch.
 * On failure, returns empty KB (graceful degradation).
 */
export async function loadKB(): Promise<KnowledgeBase> {
  if (_kb) return _kb

  if (_loadPromise) return _loadPromise

  _loadPromise = (async () => {
    try {
      const res = await fetch('/data/kb.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      _kb = await res.json()
      return _kb!
    } catch (err) {
      console.warn('知识库加载失败:', err)
      // Return empty fallback
      _kb = { ladderStrategies: {}, achievements: {} }
      return _kb
    }
  })()

  return _loadPromise
}

/**
 * Get ladder strategy for a given rating.
 * Returns the matching tier, or null if no match.
 */
export function getLadderStrategy(kb: KnowledgeBase, rating: number): LadderStrategy | null {
  for (const strategy of Object.values(kb.ladderStrategies)) {
    if (rating >= strategy.min && rating <= strategy.max) {
      return strategy
    }
  }
  return null
}

/**
 * Get achievement info by name.
 */
export function getAchievementInfo(kb: KnowledgeBase, name: string): AchievementInfo | undefined {
  return kb.achievements[name]
}
