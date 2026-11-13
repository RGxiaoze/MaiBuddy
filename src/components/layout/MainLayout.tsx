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
import { useBackgroundStore } from '@/store/backgroundStore'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // 全局数据初始化（曲库 / 本地成绩 / 本地 B50）。
  // 之前各页面各自加载，直接打开某个页面（刷新、分享钻取链接）时
  // 未被该页面加载的数据会让侧边栏显示「请登录」、推荐页显示「暂无成绩」。
  // 只订阅长度而不是整份数组：数组作为订阅目标时，任何一次成绩导入/删除
  // 都会让整个页面外壳（侧边栏、移动底栏、页脚、背景层）跟着重渲染。
  const songCount = useSongStore((s) => s.songs.length)
  const songsLoading = useSongStore((s) => s.loading)
  const fetchSongs = useSongStore((s) => s.fetchSongs)
  const scoreCount = useScoreStore((s) => s.scores.length)
  const scoresLoaded = useScoreStore((s) => s.loaded)
  const fetchAllScores = useScoreStore((s) => s.fetchAllScores)
  const localB50 = usePlayerStore((s) => s.localB50)
  const computeLocalB50 = usePlayerStore((s) => s.computeLocalB50)
  const bgCover = useBackgroundStore((s) => s.coverUrl)

  // 背景交叉淡入：两图层交替「前台」，切换时旧图淡出、新图淡入，
  // 两张各自 0 → 0.16 同时过渡，叠加强度基本恒定，不会闪一下。
  const [bgSlots, setBgSlots] = useState<[string | null, string | null]>([bgCover, null])
  const [bgFront, setBgFront] = useState(0)
  useEffect(() => {
    if (bgCover === bgSlots[bgFront]) return
    const back = 1 - bgFront
    setBgSlots((prev) => {
      const next: [string | null, string | null] = [prev[0], prev[1]]
      next[back] = bgCover
      return next
    })
    setBgFront(back)
  }, [bgCover, bgFront, bgSlots])

  useEffect(() => {
    if (songCount === 0 && !songsLoading) fetchSongs()
    if (!scoresLoaded) fetchAllScores()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!localB50 && scoreCount > 0 && songCount > 0) computeLocalB50()
  }, [localB50, scoreCount, songCount, computeLocalB50])

  const toggleCollapsed = useCallback(() => setCollapsed((v) => !v), [])
  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex min-h-dvh relative">
      {/* 全局背景：由各页面注册「本页第一个封面」，无封面的页面继承上一页。
          两张图层交叉淡入，避免换页时背景突变。 */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none bg-center bg-cover"
        style={{
          backgroundImage: bgSlots[0] ? `url(${bgSlots[0]})` : undefined,
          filter: 'blur(50px) saturate(1.3)',
          opacity: bgSlots[0] && bgFront === 0 ? 0.16 : 0,
          transform: 'scale(1.15)',
          transition: 'opacity 300ms ease',
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none bg-center bg-cover"
        style={{
          backgroundImage: bgSlots[1] ? `url(${bgSlots[1]})` : undefined,
          filter: 'blur(50px) saturate(1.3)',
          opacity: bgSlots[1] && bgFront === 1 ? 0.16 : 0,
          transform: 'scale(1.15)',
          transition: 'opacity 300ms ease',
        }}
      />
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
