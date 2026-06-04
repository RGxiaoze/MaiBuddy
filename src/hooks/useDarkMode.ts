// ============================================================
// useDarkMode — apply theme to <html> based on settings
// ============================================================

import { useEffect } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

/** Resolve effective theme: 'system' → actual OS preference */
function resolveTheme(mode: string): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode as 'light' | 'dark'
}

/** Apply theme to <html data-dark> attribute */
function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  if (theme === 'dark') {
    root.setAttribute('data-dark', '')
  } else {
    root.removeAttribute('data-dark')
  }
}

/** React hook: syncs dark mode to DOM, listens to system preference changes */
export function useDarkMode() {
  const darkMode = useSettingsStore((s) => s.darkMode)

  useEffect(() => {
    applyTheme(resolveTheme(darkMode))

    // Listen for system preference changes (only relevant in 'system' mode)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (useSettingsStore.getState().darkMode === 'system') {
        applyTheme(resolveTheme('system'))
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [darkMode])
}
