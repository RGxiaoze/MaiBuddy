// ============================================================
// Sidebar navigation — collapsible on desktop, hidden on mobile
// ============================================================

import { NavLink } from 'react-router'
import UserInfoCard from './UserInfoCard'

const links = [
  { to: '/songs',    label: '曲目检索',   icon: '♪' },
  { to: '/player',   label: 'B50 一览',   icon: '👤' },
  { to: '/analysis', label: '五维分析',   icon: '📊' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const sidebarContent = (
    <nav
      className={`flex flex-col h-full transition-all duration-200
        ${collapsed ? 'w-16' : 'w-[220px]'}`}
    >
      {/* Logo area */}
      <div className={`px-4 py-5 border-b border-border ${collapsed ? 'text-center' : ''}`}>
        {collapsed ? (
          <span className="text-xl">💎</span>
        ) : (
          <>
            <h1 className="text-base font-semibold text-text m-0">舞萌DX 伴侣</h1>
            <p className="text-[11px] text-text-tertiary mt-0.5">maimai DX Companion</p>
          </>
        )}
      </div>

      {/* User info card */}
      <UserInfoCard collapsed={collapsed} />

      {/* Nav links */}
      <ul className="list-none p-0 m-0 mt-2 flex-1">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === '/songs'}
              onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm no-underline transition-colors
                ${isActive
                  ? 'bg-primary/15 text-primary border-r-2 border-accent font-medium'
                  : 'text-text-secondary hover:bg-surface-light hover:text-text border-r-2 border-transparent'
                }
                ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? link.label : undefined}
            >
              <span className="text-base shrink-0">{link.icon}</span>
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden md:block border-t border-border p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs text-text-tertiary
                     hover:bg-surface-light hover:text-text-secondary transition-colors cursor-pointer border-none bg-transparent"
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          <span className="text-sm">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span>收起</span>}
        </button>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 text-[11px] text-text-tertiary border-t border-border">
          v0.3.0
        </div>
      )}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen sticky top-0 bg-bg-surface border-r border-border shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Slide-out panel */}
          <aside className="relative bg-bg-surface border-r border-border h-full animate-slide-in">
            <div className="w-[240px] h-full">
              {sidebarContent}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
