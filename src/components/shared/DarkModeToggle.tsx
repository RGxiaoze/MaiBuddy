// ============================================================
// DarkModeToggle — three-way theme switcher (light / dark / system)
// ============================================================

import { Sun, Moon, Monitor } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'

type Mode = 'light' | 'dark' | 'system'

const OPTIONS: { mode: Mode; icon: typeof Sun; label: string }[] = [
  { mode: 'light',  icon: Sun,    label: '浅色' },
  { mode: 'dark',   icon: Moon,   label: '暗色' },
  { mode: 'system', icon: Monitor, label: '系统' },
]

export default function DarkModeToggle() {
  const darkMode = useSettingsStore((s) => s.darkMode)
  const setDarkMode = useSettingsStore((s) => s.setDarkMode)

  return (
    <div className="flex items-center rounded-lg bg-bg-gray border border-border p-0.5" role="radiogroup">
      {OPTIONS.map(({ mode, icon: Icon, label }) => {
        const active = darkMode === mode
        return (
          <button
            key={mode}
            onClick={() => setDarkMode(mode)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium
                       transition-colors cursor-pointer border-none
                       ${active
                         ? 'bg-surface text-primary shadow-sm'
                         : 'text-text-tertiary hover:text-text-secondary bg-transparent'
                       }`}
            title={`${label}主题`}
            aria-pressed={active}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
