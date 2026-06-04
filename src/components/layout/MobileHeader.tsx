// ============================================================
// Mobile top header bar (hamburger menu trigger + theme toggle)
// ============================================================

import DarkModeToggle from '@/components/shared/DarkModeToggle'

interface MobileHeaderProps {
  onMenuToggle: () => void
}

export default function MobileHeader({ onMenuToggle }: MobileHeaderProps) {
  return (
    <header className="md:hidden sticky top-0 z-30 bg-bg-surface/95 backdrop-blur border-b border-border
                       flex items-center justify-between px-4 h-12">
      {/* Hamburger */}
      <button
        onClick={onMenuToggle}
        className="flex flex-col gap-1 p-1.5 bg-transparent border-none cursor-pointer"
        aria-label="菜单"
      >
        <span className="block w-5 h-0.5 rounded-sm bg-text-secondary" />
        <span className="block w-5 h-0.5 rounded-sm bg-text-secondary" />
        <span className="block w-3.5 h-0.5 rounded-sm bg-text-secondary" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-sm">💎</span>
        <span className="text-sm font-semibold text-text">舞萌DX 伴侣</span>
      </div>

      {/* Theme toggle */}
      <DarkModeToggle />
    </header>
  )
}
