// ============================================================
// 分档拟合定数：把「该谱在各档的累计率 vs 同档平均」换算成定数
//
// 纯函数，不依赖统计服务；SSS / SSS+ 两档由调用方传入，保证与详情页
// 现有那一行数字完全一致（同一屏不出现两套口径）。
// ============================================================

import {
  TIER_FIT_SLOPE,
  TIER_FIT_R2,
  SSS_FIT_R2,
  TIER_CONFIDENCE_HIGH,
  TIER_CONFIDENCE_MEDIUM,
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

/** 可信度三档：由该档回归的 R² 决定 */
export type Confidence = 'high' | 'medium' | 'low'

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export interface TierRow {
  tier: TierKey
  label: string
  /** 拟合定数；null 表示缺数据算不出来 */
  fit: number | null
  /** 可信度；null 表示无数据无法评估 */
  confidence: Confidence | null
  /** 该档回归质量不足（可信度低），UI 需给出提示 */
  weakRegression: boolean
  /** 样本偏少：数值仍显示，但需要标注 */
  lowSample: boolean
  /** 算不出来的唯一原因是缺数据 */
  unavailable?: 'no-data'
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

function confidenceOf(r2: number): Confidence {
  if (r2 >= TIER_CONFIDENCE_HIGH) return 'high'
  if (r2 >= TIER_CONFIDENCE_MEDIUM) return 'medium'
  return 'low'
}

/**
 * 生成分档拟合表格的数据。
 *
 * 每一档都尽量给出数值 + 可信度，而不是因为回归质量差就显示「—」——
 * 「算不出来」和「算得出来但仅供参考」是两件事，混在一起会误导。
 * 只有**缺数据**才返回 fit: null。
 */
export function buildTierRows(p: BuildTierRowsParams): TierRow[] {
  const lowSample =
    (p.levelChartCount != null && p.levelChartCount < TIER_LOW_LEVEL_CHARTS) ||
    (p.sampleCount != null && p.sampleCount < TIER_LOW_SAMPLE_COUNT)

  return TIER_ORDER.map((tier) => {
    const base: TierRow = {
      tier,
      label: TIER_LABELS[tier],
      fit: null,
      confidence: null,
      weakRegression: false,
      lowSample,
    }

    // SSS+ 直接用水鱼实测 fit_diff，是这里可信度最高的来源
    if (tier === 'sssp') {
      if (p.sssPlusFit == null) return { ...base, unavailable: 'no-data' }
      return { ...base, fit: round2(p.sssPlusFit), confidence: 'high' }
    }

    // SSS 走既有的 SSS_FIT_SLOPE，可信度取其回归 R²
    if (tier === 'sss') {
      if (p.sssFit == null) return { ...base, unavailable: 'no-data' }
      const confidence = confidenceOf(SSS_FIT_R2)
      return { ...base, fit: round2(p.sssFit), confidence, weakRegression: confidence === 'low' }
    }

    const key = tier as 'ss' | 'ssp' | 'fc' | 'ap' | 'app'
    const slope = TIER_FIT_SLOPE[key]
    const r2 = TIER_FIT_R2[key]
    if (slope == null || r2 == null) return { ...base, unavailable: 'no-data' }

    const rate = p.chartTiers ? p.chartTiers[tier] : undefined
    const levelRate = p.levelTiers ? p.levelTiers[tier] : undefined
    if (rate == null || levelRate == null) return { ...base, unavailable: 'no-data' }

    const confidence = confidenceOf(r2)
    return {
      ...base,
      fit: round2(p.officialLevelValue + slope * (rate - levelRate)),
      confidence,
      weakRegression: confidence === 'low',
    }
  })
}
