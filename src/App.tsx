// ============================================================
// App root — React Router v7 configuration
// ============================================================

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import MainLayout from '@/components/layout/MainLayout'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { loadAliasData } from '@/data/aliases'
import { useSettingsStore } from '@/store/settingsStore'
import { useDarkMode } from '@/hooks/useDarkMode'
import './App.css'

// Route-level code splitting — each page loaded on demand
const SongList = lazy(() => import('@/pages/SongList'))
const SongDetail = lazy(() => import('@/pages/SongDetail'))
const PlayerInfo = lazy(() => import('@/pages/PlayerInfo'))
const DimensionAnalysis = lazy(() => import('@/pages/DimensionAnalysis'))
const Guide = lazy(() => import('@/pages/Guide'))
const Changelog = lazy(() => import('@/pages/Changelog'))
const Docs = lazy(() => import('@/pages/Docs'))

/** Thin loading placeholder shown while a route chunk loads */
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-text-secondary">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  // Kick off alias data loading and settings loading on app startup
  useEffect(() => { loadAliasData(); loadSettings() }, [])

  // Apply dark mode to <html> based on settings
  useDarkMode()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/songs" replace />} />
          <Route path="/songs" element={<Suspense fallback={<PageLoader />}><SongList /></Suspense>} />
          <Route path="/songs/:songId" element={<Suspense fallback={<PageLoader />}><SongDetail /></Suspense>} />
          <Route path="/player" element={<Suspense fallback={<PageLoader />}><ErrorBoundary title="B50 一览页面渲染出错"><PlayerInfo /></ErrorBoundary></Suspense>} />
          <Route path="/analysis" element={<Suspense fallback={<PageLoader />}><ErrorBoundary title="五维分析页面渲染出错"><DimensionAnalysis /></ErrorBoundary></Suspense>} />
          <Route path="/guide" element={<Suspense fallback={<PageLoader />}><Guide /></Suspense>} />
          <Route path="/changelog" element={<Suspense fallback={<PageLoader />}><Changelog /></Suspense>} />
          <Route path="/docs" element={<Suspense fallback={<PageLoader />}><Docs /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
