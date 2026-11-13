// ============================================================
// Score ordering helpers
// ============================================================

/** 排序所需的最小结构：难度索引 + 可选主键 */
export interface LevelOrdered {
  levelIndex: number
  id?: number
}

/**
 * 按难度升序排列同一首曲目的成绩：
 * BASIC → ADVANCED → EXPERT → MASTER → Re:MASTER。
 *
 * 同一难度理论上只有一条成绩，`id` 仅作次键，保证渲染顺序稳定。
 * （此前详情页的「我的成绩」完全没有排序，顺序取决于 IndexedDB 的返回顺序，
 * 于是会随机出现 Re:MASTER 排在 MASTER 之前这类错乱。）
 */
export function sortScoresByLevel<T extends LevelOrdered>(scores: T[]): T[] {
  return [...scores].sort(
    (a, b) => a.levelIndex - b.levelIndex || (a.id ?? 0) - (b.id ?? 0),
  )
}
