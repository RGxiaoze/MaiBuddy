// ============================================================
// 各达成档位的累计率
//
// 数据来自 Diving-Fish chart_stats：
//   dist    —— 达成率分布，14 个桶（<50 / 50-60 / … / 100-100.5 / ≥100.5）
//   fc_dist —— 判定分布，5 个桶，互斥且覆盖全体（未FC / FC / FC+ / AP / AP+）
//
// 这两条映射已在 2026-11-26 用 5632 个真实谱面核对：
//   dist 长度恒为 14、fc_dist 恒为 5；两者之和都等于样本量 cnt；
//   fc 总量 ≤ 达成率总量。详见 开发日志/2026-11-26.md。
// ============================================================

/** 七个档位的累计率（0–1） */
export interface TierRates {
  /** ≥99%（SS） */
  ss: number
  /** ≥99.5%（SS+） */
  ssp: number
  /** ≥100%（SSS）—— 与历史 cumSssRate 同口径 */
  sss: number
  /** ≥100.5%（SSS+） */
  sssp: number
  /** FC 及以上（含 FC+/AP/AP+） */
  fc: number
  /** AP 及以上（含 AP+）—— 与历史 apRate 同口径 */
  ap: number
  /** 仅 AP+ */
  app: number
}

/** 越界索引按 0 处理，避免脏数据把结果变成 NaN */
const at = (arr: readonly number[], i: number): number => arr[i] ?? 0

/**
 * 由 dist / fc_dist 计算七档累计率。
 *
 * 达成率与判定都取**累计**口径：≥99 包含 SSS/SSS+；FC 包含 FC+/AP/AP+。
 * 这样梯度单调，符合「达成某一档及以上」的直觉。
 */
export function computeTierRates(dist: readonly number[], fcDist: readonly number[]): TierRates {
  const total = dist.reduce((sum, v) => sum + (v || 0), 0)
  const fcTotal = fcDist.reduce((sum, v) => sum + (v || 0), 0)
  const d = total || 1
  const f = fcTotal || 1

  const d10 = at(dist, 10)
  const d11 = at(dist, 11)
  const d12 = at(dist, 12)
  const d13 = at(dist, 13)

  return {
    ss: (d10 + d11 + d12 + d13) / d,
    ssp: (d11 + d12 + d13) / d,
    sss: (d12 + d13) / d,
    sssp: d13 / d,
    fc: (at(fcDist, 1) + at(fcDist, 2) + at(fcDist, 3) + at(fcDist, 4)) / f,
    ap: (at(fcDist, 3) + at(fcDist, 4)) / f,
    app: at(fcDist, 4) / f,
  }
}
