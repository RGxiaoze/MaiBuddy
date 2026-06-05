// ============================================================
// Sidebar navigation — collapsible on desktop, hidden on mobile
// ============================================================

import { useState } from 'react'
import { NavLink, Link } from 'react-router'
import UserInfoCard from './UserInfoCard'

const links = [
  { to: '/songs',    label: '曲目检索',   icon: '♪' },
  { to: '/player',   label: 'B50 一览',   icon: '👤' },
  { to: '/analysis', label: '五维分析',   icon: '📊' },
  { to: '/guide',     label: '使用指南',   icon: '📖' },
  { to: '/changelog', label: '更新记录',   icon: '📋' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const [aboutOpen, setAboutOpen] = useState(false)
  const sidebarContent = (
    <nav
      className={`flex flex-col h-full transition-all duration-200
        ${collapsed ? 'w-16' : 'w-[220px]'}`}
    >
      {/* Logo area */}
      <div className={`px-4 py-5 border-b border-border ${collapsed ? 'text-center' : ''}`}>
        {collapsed ? (
          <span className="text-xl font-semibold text-text-secondary">DX</span>
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

      {/* About section — collapsible */}
      <div className="border-t border-border">
        {!collapsed && (
          <button
            onClick={() => setAboutOpen(!aboutOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-tertiary
                       hover:bg-surface-light hover:text-text-secondary transition-colors
                       cursor-pointer border-none bg-transparent"
          >
            <span className="font-medium">关于</span>
            <span className={`text-xs transition-transform ${aboutOpen ? 'rotate-90' : ''}`}>▶</span>
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setAboutOpen(!aboutOpen)}
            className="w-full flex justify-center py-2 text-xs text-text-tertiary
                       hover:bg-surface-light hover:text-text-secondary transition-colors
                       cursor-pointer border-none bg-transparent"
            title="关于"
          >
            <span className="text-sm font-semibold text-text-secondary">DX</span>
          </button>
        )}

        {aboutOpen && (
          <div className={`px-4 pb-3 space-y-2 text-[11px] text-text-tertiary ${collapsed ? 'text-center px-1' : ''}`}>
            {!collapsed ? (
              <>
                <div className="leading-relaxed">
                  <p className="text-text-secondary font-medium mb-1">致谢</p>
                  <p>Diving-Fish API · Yuzu-ChaN 别名</p>
                  <p>舞萌 DX 社区数据支持</p>
                </div>
                <div className="leading-relaxed">
                  <p className="text-text-secondary font-medium mb-1">技术栈</p>
                  <p>React · TypeScript · Vite · TailwindCSS</p>
                </div>
                <p>版本 v0.4.0</p>
                <div className="flex items-center gap-3 pt-1">
                  <Link
                    to="/docs"
                    onClick={onMobileClose}
                    className="text-xs text-primary hover:underline"
                  >
                    📖 开发文档
                  </Link>
                  <a
                    href="#"
                    className="text-xs text-text-tertiary hover:text-primary transition-colors no-underline"
                    title="GitHub（暂未开放）"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub ↗
                  </a>
                </div>
              </>
            ) : (
              <div className="space-y-1 text-[10px]">
                <p className="font-medium text-text-secondary">v0.4.0</p>
                <Link to="/docs" onClick={onMobileClose} className="text-primary hover:underline block">
                  📖
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

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
