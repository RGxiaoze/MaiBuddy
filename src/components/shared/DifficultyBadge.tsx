// ============================================================
// Colored difficulty badge (BASIC/ADVANCED/EXPERT/MASTER/ReMASTER)
// ============================================================

import type { LevelIndex } from '@/types'
import { LEVEL_INDEX_MAP, LEVEL_LABELS } from '@/data/constants'

interface DifficultyBadgeProps {
  levelIndex: LevelIndex
  className?: string
}

export default function DifficultyBadge({ levelIndex, className = '' }: DifficultyBadgeProps) {
  const colors = LEVEL_INDEX_MAP[levelIndex]
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[11px] font-medium text-white leading-tight ${className}`}
      style={{ backgroundColor: colors.color }}
    >
      {LEVEL_LABELS[levelIndex]}
    </span>
  )
}
