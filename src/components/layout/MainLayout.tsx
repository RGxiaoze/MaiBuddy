// ============================================================
// Main layout — responsive: sidebar (desktop) + bottom nav (mobile)
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { Outlet } from 'react-router'
import Sidebar from './Sidebar'
import MobileHeader from './MobileHeader'
import MobileBottomNav from './MobileBottomNav'
import Footer from './Footer'
import DarkModeToggle from '@/components/shared/DarkModeToggle'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { useSongStore } from '@/store/songStore'
import { useScoreStore } from '@/store/scoreStore'
import { usePlayerStore } from '@/store/playerStore'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 全局数据初始化（曲库 / 本地成绩 / 本地 B50）。
  // 之前各页面各自加载，直接打开某个页面（刷新、分享钻取链接）时
  // 未被该页面加载的数据会让侧边栏显示「请登录」、推荐页显示「暂无成绩」。
  const songs = useSongStore((s) => s.songs)
  const songsLoading = useSongStore((s) => s.loading)
  const fetchSongs = useSongStore((s) => s.fetchSongs)
  const scores = useScoreStore((s) => s.scores)
  const scoresLoaded = useScoreStore((s) => s.loaded)
  const fetchAllScores = useScoreStore((s) => s.fetchAllScores)
  const localB50 = usePlayerStore((s) => s.localB50)
  const computeLocalB50 = usePlayerStore((s) => s.computeLocalB50)

  useEffect(() => {
    if (songs.length === 0 && !songsLoading) fetchSongs()
    if (!scoresLoaded) fetchAllScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!localB50 && scores.length > 0 && songs.length > 0) computeLocalB50()
  }, [localB50, scores.length, songs.length, computeLocalB50])

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), [])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar: desktop visible / mobile overlay */}
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <MobileHeader onMenuToggle={openMobile} />

        {/* Desktop top bar (theme toggle) */}
        <div className="hidden md:flex items-center justify-end px-6 py-1.5">
          <DarkModeToggle />
        </div>

        {/* Scrollable content */}
        <main className="flex-1 flex flex-col p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
          <div className="flex-1">
            <ErrorBoundary title="页面渲染出错">
              <Outlet />
            </ErrorBoundary>
          </div>
          <Footer />
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  )
}
