// ============================================================
// Mobile bottom navigation bar
// ============================================================

import { NavLink } from 'react-router'
import { Music, User, BarChart3 } from 'lucide-react'

const tabs = [
  { to: '/songs',    label: '曲目',   Icon: Music },
  { to: '/player',   label: 'B50',    Icon: User },
  { to: '/analysis', label: '分析',   Icon: BarChart3 },
]

export default function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-surface border-t border-border
                    flex items-center justify-around h-14 safe-bottom">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/songs'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 flex-1 h-full no-underline
             transition-colors text-xs
            ${isActive
              ? 'text-primary'
              : 'text-text-tertiary'
            }`
          }
        >
          <tab.Icon size={20} />
          <span className="text-[11px]">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
