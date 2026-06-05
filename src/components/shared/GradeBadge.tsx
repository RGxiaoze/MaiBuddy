// ============================================================
// Colored grade badge — pure text, no background
// ============================================================
// SSS/SSS+ 彩虹色：每个 S 从左到右为 黄→蓝→红，+ 号黄色
// SS+ / SS / S+ / S：黄色文字
// AAA 及以下：按 RATE_COLORS 着色（无背景）

import type { RateType } from '@/types'
import { RATE_COLORS, RATE_DISPLAY } from '@/data/constants'

/** Per-character colors for SSS (黄/蓝/红) */
const SSS_CHAR_COLORS = ['#FFD700', '#3B82F6', '#EF4444']
/** + 号颜色 (黄) */
const PLUS_COLOR = '#FFD700'

interface GradeBadgeProps {
  rate: RateType
  className?: string
}

export default function GradeBadge({ rate, className = '' }: GradeBadgeProps) {
  // Rainbow SSS / SSS+
  if (rate === 'sss' || rate === 'sssp') {
    return (
      <span className={`inline-flex items-center text-[11px] font-bold leading-tight ${className}`}>
        {SSS_CHAR_COLORS.map((color, i) => (
          <span key={i} style={{ color }}>S</span>
        ))}
        {rate === 'sssp' && (
          <span style={{ color: PLUS_COLOR }}>+</span>
        )}
      </span>
    )
  }

  // All other rates — pure text, no background
  const textColor = RATE_COLORS[rate] || '#999'
  const display = RATE_DISPLAY[rate] || rate
  return (
    <span
      className={`text-[11px] font-bold leading-tight ${className}`}
      style={{ color: textColor }}
    >
      {display}
    </span>
  )
}
