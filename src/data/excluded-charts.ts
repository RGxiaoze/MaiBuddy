// ============================================================
// 暂时排除的谱面
//
// 用于屏蔽「因数据源问题而不宜推荐」的谱面（而非用户主动屏蔽）。
// 用户主动「不感兴趣」的屏蔽走 IndexedDB 的 exploreBlocked 表。
// ============================================================

/**
 * key 格式：`${songId}-${levelIndex}`
 */
export const EXCLUDED_CHARTS: ReadonlySet<string> = new Set([
  // Link 的 Re:MASTER（白谱）：查分器分数转换工具对 link 有特殊处理，
  // 未配置白 link 的 note 数量，该难度成绩无法正常上传（MASTER 紫谱不受影响）。
  // 上游修复后删除本行即可恢复推荐。
  '131-4',
])

/** 该谱面是否被暂时排除出推荐 */
export function isChartExcluded(songId: number, levelIndex: number): boolean {
  return EXCLUDED_CHARTS.has(`${songId}-${levelIndex}`)
}
