// ============================================================
// Push strategy — tiered advice based on player's B50 profile
// ============================================================

export interface StrategyAdvice {
  /** Current estimated tier */
  tier: string
  /** Target next tier */
  nextTier: string
  /** General advice text */
  generalAdvice: string
  /** Specific action items */
  actionItems: string[]
  /** Estimated rating gain from following advice */
  estimatedGain: string
}

/**
 * Generate tier-based push strategy based on player's B50 profile.
 * Analyzes floor rating levels to determine which tier the player is at
 * and provides targeted advice for breaking through to the next level.
 */
import type { B50Result } from './rating'
import type { ScoreRecord } from '@/db/database'
import type { Song } from '@/types'

export function generateStrategy(
  b50: B50Result,
  scores?: ScoreRecord[],
  songMap?: Map<number, Song>,
  theoreticalMax?: number,
): StrategyAdvice {
  const totalRating = b50.totalRating
  const b35AvgLevel = avgLevelValue(b50.best35)
  const b15AvgLevel = avgLevelValue(b50.best15)
  const floor35 = b50.best35.length > 0 ? b50.best35[b50.best35.length - 1] : null
  const floor15 = b50.best15.length > 0 ? b50.best15[b50.best15.length - 1] : null
  const tMax = theoreticalMax ?? 0

  // ---- Theory rating: at or above theoretical max ----
  if (tMax > 0 && totalRating >= tMax && scores && songMap) {
    return theoryRatingStrategy(b35AvgLevel, b15AvgLevel, scores, songMap)
  }

  // ---- Tier classification ----
  if (totalRating < 8000) {
    return beginnerStrategy()
  } else if (totalRating < 10000) {
    return intermediateStrategy()
  } else if (totalRating < 13000) {
    return advancedStrategy()
  } else if (totalRating < 15000) {
    return expertStrategy(b35AvgLevel, b15AvgLevel)
  } else if (totalRating < 16000) {
    return expertToMansaiStrategy(b35AvgLevel, b15AvgLevel)
  } else if (totalRating < 16200) {
    return masterStrategy(b35AvgLevel, b15AvgLevel, floor35, floor15)
  } else if (totalRating < 16400) {
    return grandmasterIntermediateStrategy(b35AvgLevel, b15AvgLevel, floor35, floor15)
  } else {
    return grandmasterStrategy(b35AvgLevel, b15AvgLevel, tMax)
  }
}

function avgLevelValue(entries: { levelValue: number }[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((s, e) => s + e.levelValue, 0) / entries.length
}

// ---- Tier strategies ----

function beginnerStrategy(): StrategyAdvice {
  return {
    tier: '入门 (紫框)',
    nextTier: '铜框 (12000+)',
    generalAdvice: '当前处于入门阶段，首要任务是广泛游玩、积累曲目覆盖。不必刻意追求高达成率，先保证 B35 和 B15 两池都有足够的曲目填充。',
    actionItems: [
      '优先把 12~13 级谱面打到 SS+(99.5%) 以上，快速填满 B35',
      '新版本曲目（B15）优先打，因为候选池小、推分效率高',
      '不必死磕单一谱面追求 SSS+(100.5%)，鸟(SSS)已经足够',
      '保持每周至少玩 10-15 首不同曲目，扩大曲库覆盖',
    ],
    estimatedGain: '按此策略每月可稳定提升 500~1000 分',
  }
}

function intermediateStrategy(): StrategyAdvice {
  return {
    tier: '进阶 (铜~银框)',
    nextTier: '金框 (14000+)',
    generalAdvice: '已积累一定曲目量，B50 开始成型。此时应关注"吃分"效率——优先挑选定数高但拟合难度低的谱面（水分曲），以较低达成率换较高 Rating 增益。',
    actionItems: [
      '使用推分建议中的 B15 优先策略：新曲打到 SS+(99.5%) 就能替换 B15 地板',
      '13.5~13.9 的水分曲是当前阶段性价比最高的推分目标',
      'B35 低于 12.5 定数的成绩优先替换，用 13+~14 级 SS+ 以上成绩顶掉',
      '关注社区 B50 分析/锐评视频，了解同分段其他玩家的推分路径',
    ],
    estimatedGain: '按此策略可在 1~2 个月内冲击金框',
  }
}

function advancedStrategy(): StrategyAdvice {
  return {
    tier: '高阶 (金框)',
    nextTier: '白金框 (14500~14999)',
    generalAdvice: '已进入高阶玩家行列。B50 地板分逐渐逼近个人能力天花板，推分需要更精确的策略：优先推 B15 新曲，B35 重点关注定数 13.9~14.2 区间的 SSS/SSS+。',
    actionItems: [
      'B15 新曲优先填满 14+ 定数，至少 SS+ 即可超越 B15 地板',
      'B35 中被 13.0 以下定数占据的位置，用 13.8+ SSS+ 替换',
      '遇到瓶颈时不要死磕，退回去练习基本功（交互、纵连、星星防蹭）',
      '开始关注自己的五维短板，针对性选择练习曲',
    ],
    estimatedGain: '保持稳定游玩可在 2~3 个月内冲击白金框',
  }
}

function expertStrategy(
  b35Avg: number, b15Avg: number,
): StrategyAdvice {
  return {
    tier: '专家 (白金框)',
    nextTier: '万六 (16000+)',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。冲万六(16000)的关键是全 B50 平均定数达到 14.2+，且 SSS+ 占比超过 60%。B15 需要全部 14.5+ SSS。`,
    actionItems: [
      'B15 池全力冲击 14.5+ 定数的 SSS+，这是万六最重要的门槛',
      'B35 地板分在 14.0 以下的全部替换为 14.3+ SSS+',
      '精推高定数低拟合的水分 14.5~14.8 谱面，追求 SSS+',
      '对于 15.0 级谱面，至少保持 SS+(99.5%) 不要掉分',
    ],
    estimatedGain: '万六通常需要 3~6 个月的集中推分周期',
  }
}

// ---- 冲击万六 (15000–16000) ----

function expertToMansaiStrategy(
  b35Avg: number, b15Avg: number,
): StrategyAdvice {
  return {
    tier: '冲击万六',
    nextTier: '万六 (16000+)',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。已进入冲击万六(16000)的关键阶段，此时每一分的提升都需要精打细算。`,
    actionItems: [
      'B15 全部冲击 14.8+ SSS+，这是万六最核心的门槛',
      'B35 地板定数需提升至 14.5+，所有 14.0 以下成绩全部替换',
      '15.0 级谱面至少保持 SSS，争取部分达到 SSS+',
      '回到基础练习：交互速度、星星防蹭精度、跳拍准度——这些基本功是万六的最后障碍',
    ],
    estimatedGain: '冲击万六通常需要 3~6 个月的集中推分周期',
  }
}

function masterStrategy(
  b35Avg: number, b15Avg: number,
  floor35: { songTitle: string; levelValue: number; dxRating: number; achievements: number } | null,
  floor15: { songTitle: string; levelValue: number; dxRating: number; achievements: number } | null,
): StrategyAdvice {
  const items: string[] = [
    'B15 全部冲击 14.9+ SSS+，部分可尝试 100.5%',
    'B35 地板定数需提升至 14.5+，所有 14.0 以下成绩全部替换',
    '15 级精选谱面冲击 SSS+',
  ]
  if (floor35) {
    items.push(`当前 B35 地板：《${floor35.songTitle}》${floor35.levelValue} ${floor35.achievements.toFixed(4)}% (Rating ${floor35.dxRating})，优先替换`)
  }
  if (floor15) {
    items.push(`当前 B15 地板：《${floor15.songTitle}》${floor15.levelValue} ${floor15.achievements.toFixed(4)}% (Rating ${floor15.dxRating})，优先替换`)
  }
  items.push('关注社区 ranker 的推分分析视频，寻找高性价比水分曲')

  return {
    tier: '万六',
    nextTier: '14+攻克 (16200+)',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。已达成万六(16000)，向14+攻克(16200)进发。此时每一分的提升都需要精打细算。`,
    actionItems: items,
    estimatedGain: '万六到14+攻克通常需要 6~12 个月，重点在于基本功突破而非策略优化',
  }
}

// ---- 万六五 (16200–16400) ----

function grandmasterIntermediateStrategy(
  b35Avg: number, b15Avg: number,
  floor35: { songTitle: string; levelValue: number; dxRating: number; achievements: number } | null,
  floor15: { songTitle: string; levelValue: number; dxRating: number; achievements: number } | null,
): StrategyAdvice {
  const items: string[] = [
    'B50 全部冲击 15.0+ 高达成率，这是冲击理论最核心的门槛',
    'B35 地板分提升至 14.7+',
    '15 级精选谱面冲击 SSS+，部分争取 100.5%',
  ]
  if (floor35) {
    items.push(`当前 B35 地板：《${floor35.songTitle}》${floor35.levelValue} ${floor35.achievements.toFixed(4)}% (Rating ${floor35.dxRating})，优先替换`)
  }
  if (floor15) {
    items.push(`当前 B15 地板：《${floor15.songTitle}》${floor15.levelValue} ${floor15.achievements.toFixed(4)}% (Rating ${floor15.dxRating})，优先替换`)
  }
  items.push('剩余低定数谱面全部推至 100.5%，补齐地板分')

  return {
    tier: '14+攻克',
    nextTier: '冲击理论 (16400+)',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。14+攻克区间，继续推分需精打细算，距离理论最高 Rating 仅一步之遥。`,
    actionItems: items,
    estimatedGain: '14+攻克到冲击理论通常需要 3~6 个月',
  }
}

// ---- 冲击理论 (16400 – theoreticalMax) ----

function grandmasterStrategy(
  b35Avg: number, b15Avg: number,
  theoreticalMax: number,
): StrategyAdvice {
  return {
    tier: '冲击理论',
    nextTier: theoreticalMax > 0 ? `理论Rating (${theoreticalMax})` : '理论Rating',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。距离理论最高${theoreticalMax > 0 ? ` ${theoreticalMax}` : ''}仅一步之遥。B50 全部冲击 15.0+ 高达成率，剩余低定数全部推至 100.5%。`,
    actionItems: [
      'B50 全部冲击 15.0+ 高达成率，补齐所有地板分',
      '15 级谱面的 FDX/AP 练习',
      '关注社区高分段 ranker 的手元与攻略，学习进阶手法',
      '理论 Rating 的达成通常需要年度级别的持续投入',
    ],
    estimatedGain: theoreticalMax > 0
      ? `目标：${theoreticalMax} Rating，每 1 分的提升都需要大量练习`
      : '每 1 分的提升都需要大量练习',
  }
}

// ---- 理论Rating (>= theoreticalMax) ----

function theoryRatingStrategy(
  b35Avg: number, b15Avg: number,
  scores: ScoreRecord[],
  songMap: Map<number, Song>,
): StrategyAdvice {
  // Find 14-14+ charts not yet AP'd
  const apSet = new Set<string>()
  for (const s of scores) {
    if (s.fcType === 'ap' || s.fcType === 'app') {
      apSet.add(`${s.songId}-${s.levelIndex}`)
    }
  }

  const unApCharts: { title: string; level: string; levelValue: number }[] = []
  for (const [id, song] of songMap) {
    const allDiffs = [...song.difficulties.standard, ...song.difficulties.dx]
    for (const diff of allDiffs) {
      if (diff.levelValue >= 14.0 && diff.levelValue < 15.0) {
        const key = `${id}-${diff.levelIndex}`
        if (!apSet.has(key)) {
          unApCharts.push({
            title: song.title,
            level: diff.level,
            levelValue: diff.levelValue,
          })
        }
      }
    }
  }

  unApCharts.sort((a, b) => b.levelValue - a.levelValue)
  const apPreview = unApCharts.slice(0, 5)
    .map(c => `《${c.title}》${c.levelValue}`).join('、')
  const apItem = unApCharts.length > 0
    ? `未 AP 的 14-14+ 谱面：${apPreview}${unApCharts.length > 5 ? `等 ${unApCharts.length} 首` : ''}`
    : '14-14+ 谱面已全部 AP，冲击 15 级 AP 吧！'

  return {
    tier: '理论Rating',
    nextTier: '将牌 / 极牌 / 神牌',
    generalAdvice: `B35 平均定数 ${b35Avg.toFixed(1)}，B15 平均定数 ${b15Avg.toFixed(1)}。已达理论最高 Rating，Rating 提升空间为零。转向成就系统：将牌（全曲 SSS）、极牌（全曲 FC）、神牌（全曲 AP）。`,
    actionItems: [
      apItem,
      '将牌：当前版本全曲 BASIC-MASTER 达到 SSS (100.0%)',
      '极牌：当前版本全曲 BASIC-MASTER 达到 FC 或 FDX',
      '神牌：当前版本全曲 BASIC-MASTER 达到 AP (All Perfect)',
    ],
    estimatedGain: 'Rating 已达理论最大值，转向成就系统挑战',
  }
}
