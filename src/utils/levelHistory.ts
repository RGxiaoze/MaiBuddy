// ============================================================
// 定数变迁的纯逻辑：摘要（徽章文案）与折线图序列
//
// 数据来源是年度快照（2020–2025），只保存「变化点」：
//   [[2020, 12.8], [2023, 12.9]] 表示 2020 起是 12.8，2023 起是 12.9。
// ============================================================

/** 一个年度快照点：[年份, 定数] */
export type LevelPoint = [year: number, value: number]

/** 徽章所需的最小信息 */
export interface ChangeSummary {
  /** 最早一年的定数 */
  earliest: number
  /** 最新一年的定数 */
  latest: number
  /** 变化次数（相邻快照不同即 +1） */
  count: number
  /** 最近一次变化的年份 */
  latestYear: number
  /** 净变化量（latest − earliest），保留两位 */
  delta: number
}

/** 比较定数时的浮点容差（数据是一位小数，理论上不会出现尾数） */
const EPS = 1e-9

/**
 * 汇总一组年度快照。
 *
 * 返回 null 表示「没有可展示的变更」——只有一个快照、或数值从头到尾没变过。
 * 调用方据此决定是否显示徽章。
 */
export function summarizeChanges(points: LevelPoint[]): ChangeSummary | null {
  if (points.length < 2) return null

  const sorted = [...points].sort((a, b) => a[0] - b[0])

  let count = 0
  let latestYear = sorted[0][0]
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i][1] - sorted[i - 1][1]) > EPS) {
      count += 1
      latestYear = sorted[i][0]
    }
  }
  if (count === 0) return null

  const earliest = sorted[0][1]
  const latest = sorted[sorted.length - 1][1]

  return {
    earliest,
    latest,
    count,
    latestYear,
    delta: Math.round((latest - earliest) * 100) / 100,
  }
}

/** 折线图所需的数据序列 */
export interface ChartSeries {
  /** X 轴标签：年份字符串，末尾可能是「当前」 */
  labels: string[]
  /** Y 轴数值；null 表示该年尚无快照（不连线） */
  values: (number | null)[]
  /** 当前值是否与最后一个年度快照不同（用于图表下方的滞后提示） */
  currentDiffers: boolean
}

/**
 * 构造折线图序列。
 *
 * @param points       变化点（只含变化的年份）
 * @param currentValue 曲库里的当前定数；null 表示拿不到（不追加「当前」点）
 * @param years        要展开的年份列表
 *
 * 没有快照的年份沿用前一个值，画出阶梯；首个快照之前的年份留 null，不连线。
 */
export function buildChartSeries(
  points: LevelPoint[],
  currentValue: number | null,
  years: number[],
): ChartSeries {
  const sorted = [...points].sort((a, b) => a[0] - b[0])
  const labels: string[] = []
  const values: (number | null)[] = []

  if (sorted.length > 0) {
    for (const year of years) {
      labels.push(String(year))
      let value: number | null = null
      for (const [pointYear, pointValue] of sorted) {
        if (pointYear <= year) value = pointValue
        else break
      }
      values.push(value)
    }
  }

  const lastSnapshot = sorted.length > 0 ? sorted[sorted.length - 1][1] : null
  const currentDiffers =
    currentValue != null && lastSnapshot != null && Math.abs(currentValue - lastSnapshot) > EPS

  if (currentValue != null) {
    labels.push('当前')
    values.push(currentValue)
  }

  return { labels, values, currentDiffers }
}
