// ============================================================
// DX Rating core formula — single-chart rating calculation
// ============================================================

import { COEFFICIENT_TABLE } from '@/data/constants'
import { MAX_ACHIEVEMENTS } from '@/config/algorithms'
import type { RateType } from '@/types'

/**
 * 达成率 → 评级。
 *
 * 注意这里**不能**复用 COEFFICIENT_TABLE 的 `rate` 字段：那张表按 rating 系数
 * 分段（如 99.0~99.4999 单独一段），不等于评级分段（99.0 起就是 SS+）。
 */
const RANK_THRESHOLDS: ReadonlyArray<{ min: number; rank: RateType }> = [
  { min: 100.5, rank: 'sssp' },
  { min: 100.0, rank: 'sss' },
  { min: 99.0, rank: 'ssp' },
  { min: 98.0, rank: 'ss' },
  { min: 97.0, rank: 'sp' },
  { min: 95.0, rank: 's' },
  { min: 90.0, rank: 'aaa' },
  { min: 80.0, rank: 'aa' },
  { min: 75.0, rank: 'a' },
  { min: 70.0, rank: 'bbb' },
  { min: 60.0, rank: 'bb' },
  { min: 0, rank: 'b' },
]

/** 达成率 → 评级，用于「预计能打到哪一档」的展示 */
export function rankOfAchievement(achievements: number): RateType {
  const cap = Math.min(achievements, MAX_ACHIEVEMENTS)
  for (const row of RANK_THRESHOLDS) {
    if (cap >= row.min) return row.rank
  }
  return 'b'
}

// Validate coefficient table ordering at module load (dev-only guard)
if (import.meta.env.DEV) {
  for (let i = 1; i < COEFFICIENT_TABLE.length; i++) {
    if (COEFFICIENT_TABLE[i].min >= COEFFICIENT_TABLE[i - 1].min) {
      console.error(`COEFFICIENT_TABLE 未按降序排列，索引 ${i}: ${COEFFICIENT_TABLE[i].min} >= ${COEFFICIENT_TABLE[i - 1].min}`)
    }
  }
}

/**
 * AP Rating 加成开关：`fcType === 'ap'/'app'` 时每条额外 +1。
 * 日服已实装；**国服未实装，暂时禁用**。国服实装后改为 `true`。
 */
export const AP_RATING_BONUS_ENABLED = false

/**
 * 根据达成率计算单首谱面的 DX Rating。
 *
 * 公式：`floor(coefficient × levelValue × min(achievements, 100.5) / 100)`
 * AP 加成：`fcType === 'ap' || 'app'` 时额外 +1（受 AP_RATING_BONUS_ENABLED 控制）
 *
 * 算法步骤：
 * 1. 将达成率截断至 100.5%（超出部分无效）
 * 2. 遍历 24 段 COEFFICIENT_TABLE 查找达成率对应的系数
 * 3. 计算 `floor(系数 × 定数 × 达成率 / 100)` 并返回整数
 * 4. 达成率 ≤ 0 或定数 ≤ 0 时返回 0
 * 5. AP 判定时额外 +1（开关开启时）
 *
 * @param levelValue - 谱面定数（如 14.3）
 * @param achievements - 达成率百分比（如 98.5）
 * @param fcType - FC 类型，'ap'/'app' 时额外 +1（受开关控制）
 * @returns DX Rating 整数值
 */
export function computeRating(levelValue: number, achievements: number, fcType?: string | null): number {
  if (achievements <= 0 || levelValue <= 0) return 0
  const cap = Math.min(achievements, MAX_ACHIEVEMENTS)

  let rating = 0
  for (const row of COEFFICIENT_TABLE) {
    if (cap >= row.min) {
      rating = Math.floor(row.coeff * levelValue * cap / 100)
      break
    }
  }

  // AP bonus: +1 rating for All Perfect（国服未实装，见 AP_RATING_BONUS_ENABLED）
  if (AP_RATING_BONUS_ENABLED && (fcType === 'ap' || fcType === 'app')) {
    rating += 1
  }

  return rating
}
