// ============================================================
// DX Rating core formula — single-chart rating calculation
// ============================================================

import { COEFFICIENT_TABLE } from '@/data/constants'
import { MAX_ACHIEVEMENTS } from '@/config/algorithms'

// Validate coefficient table ordering at module load (dev-only guard)
if (import.meta.env.DEV) {
  for (let i = 1; i < COEFFICIENT_TABLE.length; i++) {
    if (COEFFICIENT_TABLE[i].min >= COEFFICIENT_TABLE[i - 1].min) {
      console.error(`COEFFICIENT_TABLE 未按降序排列，索引 ${i}: ${COEFFICIENT_TABLE[i].min} >= ${COEFFICIENT_TABLE[i - 1].min}`)
    }
  }
}

/**
 * 根据达成率计算单首谱面的 DX Rating。
 *
 * 公式：`floor(coefficient × levelValue × min(achievements, 100.5) / 100)`
 * AP 加成：`fcType === 'ap' || 'app'` 时额外 +1（日服已实装，国服待跟进）
 *
 * 算法步骤：
 * 1. 将达成率截断至 100.5%（超出部分无效）
 * 2. 遍历 24 段 COEFFICIENT_TABLE 查找达成率对应的系数
 * 3. 计算 `floor(系数 × 定数 × 达成率 / 100)` 并返回整数
 * 4. 达成率 ≤ 0 或定数 ≤ 0 时返回 0
 * 5. AP 判定时额外 +1
 *
 * @param levelValue - 谱面定数（如 14.3）
 * @param achievements - 达成率百分比（如 98.5）
 * @param fcType - FC 类型，'ap'/'app' 时额外 +1
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

  // AP bonus: +1 rating for All Perfect
  if (fcType === 'ap' || fcType === 'app') {
    rating += 1
  }

  return rating
}
