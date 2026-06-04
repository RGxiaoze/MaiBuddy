// ============================================================
// Colored grade badge (SSS+/SSS/SS/S/AAA/AA/A/B/C/D)
// ============================================================

import type { RateType } from '@/types'
import { RATE_COLORS, RATE_DISPLAY } from '@/data/constants'

interface GradeBadgeProps {
  rate: RateType
  className?: string
}

export default function GradeBadge({ rate, className = '' }: GradeBadgeProps) {
  const color = RATE_COLORS[rate] || '#999'
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[11px] font-bold text-white leading-tight ${className}`}
      style={{ backgroundColor: color }}
    >
      {RATE_DISPLAY[rate] || rate}
    </span>
  )
}
