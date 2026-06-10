// ============================================================
// Empty state placeholder
// ============================================================

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
}

export default function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-text-secondary">
      {icon && <span className="text-2xl">{icon}</span>}
      <p className="text-sm">{message}</p>
    </div>
  )
}
