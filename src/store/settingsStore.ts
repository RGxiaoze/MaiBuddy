// ============================================================
// Settings store — user preferences backed by IndexedDB
// ============================================================

import { create } from 'zustand'
import { getSetting, setSetting, DEFAULT_SETTINGS } from '@/db/database'

type DarkMode = 'light' | 'dark' | 'system'

interface SettingsState {
  darkMode: DarkMode
  pushTargetAch: number
  loaded: boolean

  loadSettings: () => Promise<void>
  setDarkMode: (mode: DarkMode) => Promise<void>
  setPushTargetAch: (ach: number) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: DEFAULT_SETTINGS.darkMode,
  pushTargetAch: DEFAULT_SETTINGS.pushTargetAch,
  loaded: false,

  loadSettings: async () => {
    const darkMode = await getSetting<DarkMode>('darkMode', DEFAULT_SETTINGS.darkMode)
    const pushTargetAch = await getSetting<number>('pushTargetAch', DEFAULT_SETTINGS.pushTargetAch)
    set({ darkMode, pushTargetAch, loaded: true })
  },

  setDarkMode: async (mode) => {
    await setSetting('darkMode', mode)
    set({ darkMode: mode })
  },

  setPushTargetAch: async (ach) => {
    await setSetting('pushTargetAch', ach)
    set({ pushTargetAch: ach })
  },
}))
