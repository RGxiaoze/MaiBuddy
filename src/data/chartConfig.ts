// ============================================================
// 谱面配置分类（展示文案）
//
// ⚠️ 目前**没有可靠数据源**：曲线标签需要谱面级特征（交互/扫键/纵连…），
// 计划接入 AWMC 谱面评价 API。在那之前不要用定数或 BPM 猜测分类 ——
// 之前 `guessConfigType()` 把 BPM 写死成 200，实际只是按定数瞎猜，
// 展示出来的「底力/爆发/技巧」并不可信，已移除。
//
// 接入方式：由 AWMC 的 features/patterns → 这里产生分类，
// 其余文件只消费 `getConfigTag()` 的结果，不感知数据来源。
// ============================================================

export type ConfigType = 'stamina' | 'burst' | 'tech' | 'balanced'

export interface ConfigTagMeta {
  label: string
  color: string
  desc: string
}

export const CONFIG_TAGS: Record<ConfigType, ConfigTagMeta> = {
  stamina:  { label: '底力', color: '#22C55E', desc: '持续高密度交互为主的耐力型谱面' },
  burst:    { label: '爆发', color: '#DC2626', desc: '含极高瞬时密度的爆发型谱面' },
  tech:     { label: '技巧', color: '#A855F7', desc: 'Slide 多样或 Touch 密集的技巧型谱面' },
  balanced: { label: '综合', color: '#6B7280', desc: '多项配置均衡的综合型谱面' },
}

/**
 * 取配置标签的展示元数据。
 *
 * 数据未接入前调用方传 `undefined`，返回 null —— 调用方据此不渲染标签，
 * 避免展示不可信的分类。
 */
export function getConfigTag(type?: ConfigType | null): ConfigTagMeta | null {
  if (!type) return null
  return CONFIG_TAGS[type] ?? null
}
