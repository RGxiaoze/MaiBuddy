// ============================================================
// 分档拟合定数：把「该谱在各档的累计率 vs 同档平均」换算成定数
//
// 纯函数，不依赖统计服务；SSS / SSS+ 两档由调用方传入，保证与详情页
// 现有那一行数字完全一致（同一屏不出现两套口径）。
// ============================================================

import {
  TIER_FIT_SLOPE,
  TIER_LOW_SAMPLE_COUNT,
  TIER_LOW_LEVEL_CHARTS,
} from '@/config/algorithms'
import type { TierRates } from './tierRates'

export type TierKey = 'ss' | 'ssp' | 'sss' | 'sssp' | 'fc' | 'ap' | 'app'

/** 表格行的展示顺序（由低到高） */
export const TIER_ORDER: TierKey[] = ['ss', 'ssp', 'sss', 'sssp', 'fc', 'ap', 'app']

export const TIER_LABELS: Record<TierKey, string> = {
  ss: '≥99%（SS）',
  ssp: '≥99.5%（SS+）',
  sss: '≥100%（SSS）',
  sssp: '≥100.5%（SSS+）',
  fc: 'FC 及以上',
  ap: 'AP 及以上',
  app: 'AP+',
}

export interface TierRow {
  tier: TierKey
  label: string
  /** 该谱在该档的累计率（0–1）；无统计数据时为空 */
  rate: number | null
  /** 同定数档的平均累计率（0–1） */
  levelRate: number | null
  /** 拟合定数；null 表示这一档算不出来 */
  fit: number | null
  /** 算不出来的原因 */
  unavailable?: 'low-r2' | 'no-data'
  /** 样本偏少：数值仍显示，但需要标注 */
  lowSample: boolean
}

export interface BuildTierRowsParams {
  /** 该谱各档累计率 */
  chartTiers?: TierRates
  /** 同定数档平均各档累计率 */
  levelTiers?: TierRates
  /** 官标定数 */
  officialLevelValue: number
  /** SSS 口径拟合值（沿用详情页现有计算）；拿不到传 null */
  sssFit: number | null
  /** SSS+ 口径（水鱼 fit_diff）；拿不到传 null */
  sssPlusFit: number | null
  /** 该谱样本量 */
  sampleCount?: number
  /** 同定数档内谱面数 */
  levelChartCount?: number
}

const round2 = (v: number): number => Math.round(v * 100) / 100

/**
 * 生成分档拟合表格的数据。
 *
 * 不可用的两种情形必须在数据层区分清楚，UI 才能给出准确提示：
 * - `low-r2`：该档回归质量不够（斜率未启用），属于**方法问题**
 * - `no-data`：缺该谱或同档的统计数据，属于**数据问题**
 */
export function buildTierRows(p: BuildTierRowsParams): TierRow[] {
  const lowSample =
    (p.levelChartCount != null && p.levelChartCount < TIER_LOW_LEVEL_CHARTS) ||
    (p.sampleCount != null && p.sampleCount < TIER_LOW_SAMPLE_COUNT)

  return TIER_ORDER.map((tier) => {
    const rate = p.chartTiers ? p.chartTiers[tier] : null
    const levelRate = p.levelTiers ? p.levelTiers[tier] : null
    const base: TierRow = {
      tier,
      label: TIER_LABELS[tier],
      rate: rate ?? null,
      levelRate: levelRate ?? null,
      fit: null,
      lowSample,
    }

    // SSS / SSS+ 用调用方传入的口径，与详情页上面那一行保持一致
    if (tier === 'sss') {
      if (p.sssFit == null) return { ...base, unavailable: 'no-data' }
      return { ...base, fit: round2(p.sssFit) }
    }
    if (tier === 'sssp') {
      if (p.sssPlusFit == null) return { ...base, unavailable: 'no-data' }
      return { ...base, fit: round2(p.sssPlusFit) }
    }

    const slope = TIER_FIT_SLOPE[tier as 'ss' | 'ssp' | 'fc']
    if (slope == null) return { ...base, unavailable: 'low-r2' }
    if (rate == null || levelRate == null) return { ...base, unavailable: 'no-data' }

    return { ...base, fit: round2(p.officialLevelValue + slope * (rate - levelRate)) }
  })
}
