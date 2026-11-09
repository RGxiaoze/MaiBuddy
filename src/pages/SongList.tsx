// ============================================================
// Song list / search page — search, filter, paginate, import
// ============================================================

import { useCallback, useEffect, useMemo, useState, useDeferredValue, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { useSongStore } from '@/store/songStore'
import { useBackgroundStore } from '@/store/backgroundStore'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import SearchBar from '@/components/shared/SearchBar'
import SongFilterPanel from '@/components/shared/SongFilterPanel'
import SongSortBar from '@/components/shared/SongSortBar'
import SongResultList from '@/components/shared/SongResultList'
import { getCoverUrl } from '@/data/constants'
import { loginToProber, generateImportToken } from '@/services/divingFishApi'
import { buildAuthorizeUrl } from '@/services/dfOAuth'
import {
  buildAuthorizeUrl as buildLxnsAuthorizeUrl,
  isLxnsConfigured,
  hasOAuthToken as hasLxnsToken,
  revokeOAuth as revokeLxnsOAuth,
} from '@/services/lxnsOAuth'
import { Settings, FolderOpen, X } from 'lucide-react'
import { importScoresFromFile } from '@/utils/importScores'
import { matchRateValue } from '@/utils/stats'
import { buildScoreStats } from '@/utils/songSort'

// ---- Inline: login-to-token form ----

function LoginToGetToken({ onToken, onLoginAndImport }: { onToken: (token: string) => void; onLoginAndImport: (token: string) => Promise<void> }) {
  const [loginUser, setLoginUser] = useState(() => {
    try { return localStorage.getItem('maimai-df-remember-user') || '' } catch { return '' }
  })
  const [loginPass, setLoginPass] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [remember, setRemember] = useState(() => {
    try { return localStorage.getItem('maimai-df-remember-user') !== null } catch { return false }
  })

  const handleLogin = useCallback(async () => {
    if (!loginUser.trim() || !loginPass.trim()) return
    setLoginLoading(true)
    setLoginError(null)
    setLoginSuccess(false)
    try {
      await loginToProber(loginUser.trim(), loginPass)
      const token = await generateImportToken()
      setLoginSuccess(true)
      setLoginPass('')
      if (remember) {
        try { localStorage.setItem('maimai-df-remember-user', loginUser.trim()) } catch {}
      } else {
        try { localStorage.removeItem('maimai-df-remember-user') } catch {}
      }
      // Save token + trigger import
      onToken(token)
      await onLoginAndImport(token)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoginLoading(false)
    }
  }, [loginUser, loginPass, onToken, onLoginAndImport, remember])

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-text-secondary mb-1 font-medium">Diving-Fish 用户名</label>
        <input
          type="text"
          value={loginUser}
          onChange={(e) => setLoginUser(e.target.value)}
          placeholder="输入 Diving-Fish 用户名"
          className="w-full px-3 py-2 rounded-md border border-border text-sm
                     focus:outline-none focus:border-primary bg-surface transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1 font-medium">密码</label>
        <input
          type="password"
          value={loginPass}
          onChange={(e) => setLoginPass(e.target.value)}
          placeholder="输入 Diving-Fish 密码"
          className="w-full px-3 py-2 rounded-md border border-border text-sm
                     focus:outline-none focus:border-primary bg-surface transition-colors"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-border cursor-pointer accent-primary"
        />
        记住账号
      </label>
      <button
        onClick={handleLogin}
        disabled={loginLoading || !loginUser.trim() || !loginPass.trim()}
        className="w-full px-4 py-2.5 rounded-md bg-primary text-white text-sm font-semibold
                   hover:bg-primary-dark active:scale-[0.98] transition-all cursor-pointer
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      >
        {loginLoading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            登录并导入中...
          </span>
        ) : '登录并导入'}
      </button>
      {loginError && (
        <p className="text-xs text-error bg-error/5 rounded-md px-3 py-2">{loginError}</p>
      )}
      {loginSuccess && (
        <p className="text-xs text-success bg-success/5 rounded-md px-3 py-2">✓ Token 已获取，正在导入成绩...</p>
      )}
    </div>
  )
}

// ---- Main page component ----

export default function SongList() {
  const {
    songs, loading, error,
    searchQuery, advancedFilters,
    fetchSongs, setSearchQuery, setAdvancedFilters, getFilteredSongs,
    sortBy, sortOrder,
  } = useSongStore()
  const importDivingFishScores = usePlayerStore((s) => s.importDivingFishScores)
  const importScoresViaLxns = usePlayerStore((s) => s.importScoresViaLxns)

  const [showAdvanced, setShowAdvanced] = useState(false)

  // 成绩维度钻取过滤（?rate= / ?fc= / ?fs=）：仅显示有匹配成绩的曲目
  const [playedFilter, setPlayedFilter] = useState<string | null>(null)
  const scores = useScoreStore((s) => s.scores)

  // ---- Import modal state ----
  const [searchParams, setSearchParams] = useSearchParams()
  const [showImport, setShowImport] = useState(false)
  
  // Auto-open import modal when ?import=1 query param is present
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setShowImport(true)
    }
  }, [searchParams])

  // Apply drill-down filters from URL (?lv= ?level= ?genre= ?rate= ?fc= ?fs=)
  useEffect(() => {
    const lv = searchParams.get('lv')
    const level = searchParams.get('level')
    const genre = searchParams.get('genre')
    const rate = searchParams.get('rate')
    const fc = searchParams.get('fc')
    const fs = searchParams.get('fs')
    if (lv || level || genre) {
      setAdvancedFilters({
        ...(lv ? { difficultyLevels: [Number(lv)] } : {}),
        ...(level ? { level } : {}),
        ...(genre ? { genre } : {}),
      })
    }
    const played = rate || fc || fs
    if (played) setPlayedFilter(played)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lock body scroll when import modal is open
  useEffect(() => {
    if (showImport) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [showImport])

  const closeImport = () => {
    setShowImport(false)
    // Reset import state on close
    setImportResult(null)
    setImportError(null)
    setImportProgress(null)
    if (searchParams.get('import') === '1') {
      setSearchParams(prev => { prev.delete('import'); return prev }, { replace: true })
    }
  }
  const [importToken, setImportToken] = useState(() => {
    try { return localStorage.getItem('maimai-df-import-token') || '' } catch { return '' }
  })
  const [rememberToken, setRememberToken] = useState(() => {
    try { return localStorage.getItem('maimai-df-import-token') !== null } catch { return false }
  })
  const saveImportToken = (token: string) => {
    setImportToken(token)
    if (rememberToken) {
      try { localStorage.setItem('maimai-df-import-token', token) } catch {}
    }
  }
  const fetchAllScores = useScoreStore((s) => s.fetchAllScores)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{
    total: number; imported: number; updated: number; skipped: number; nickname: string
  } | null>(null)
  const [fileImporting, setFileImporting] = useState(false)
  const [fileImportResult, setFileImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-close import modal after successful import (2.5s delay)
  useEffect(() => {
    if (importResult && !importing) {
      const timer = setTimeout(() => closeImport(), 2500)
      return () => clearTimeout(timer)
    }
  }, [importResult, importing])

  // Fetch on first load
  useEffect(() => {
    if (songs.length === 0 && !loading && !error) {
      fetchSongs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Defer search to avoid blocking keystrokes
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Memoize filtered results
  // 成绩摘要供「成绩 / DX 分数 / 添加日期」三种排序使用
  const scoreStats = useMemo(() => buildScoreStats(songs, scores), [songs, scores])
  const filteredSongs = useMemo(
    () => {
      const base = getFilteredSongs(deferredSearchQuery, scoreStats)
      // 成绩维度钻取：仅保留有匹配成绩的曲目。
      // 若同时带难度（?lv=），难度应作用于「成绩所属难度」而非「曲目包含该难度」，
      // 否则统计卡上的数字（如 SSS+ & MASTER = 1241）与列表条数（1318）对不上。
      if (!playedFilter) return base
      const drillLevel = advancedFilters.difficultyLevels?.[0]
      return base.filter(song => scores.some(sc =>
        sc.songId === song.id &&
        matchRateValue(sc, playedFilter) &&
        (drillLevel == null || sc.levelIndex === drillLevel)
      ))
    },
    [songs, deferredSearchQuery, advancedFilters, sortBy, sortOrder, getFilteredSongs, playedFilter, scores, scoreStats]
  )

  // 注册本页背景：列表第一首的封面
  const setBgCover = useBackgroundStore((s) => s.setCover)
  const firstSongId = filteredSongs[0]?.id
  useEffect(() => {
    if (firstSongId != null) setBgCover(getCoverUrl(firstSongId))
  }, [firstSongId, setBgCover])

  // ---- Import handler ----
  /** 跳转到水鱼授权页；授权完成后由 App 顶层的 OAuthCallbackHandler 接手 */
  const handleOAuthLogin = useCallback(async () => {
    try {
      const url = await buildAuthorizeUrl()
      window.location.href = url
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '无法发起授权')
    }
  }, [])

  // Login + direct import (one-click flow)
  const handleLoginAndImport = useCallback(async (token: string) => {
    saveImportToken(token)
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    setImportProgress(null)
    try {
      const stats = await importDivingFishScores(token, (current, total) => {
        setImportProgress({ current, total })
      })
      setImportResult(stats)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }, [importDivingFishScores, saveImportToken])

  // ---- 落雪 LXNS ----
  const [lxnsKey, setLxnsKey] = useState('')

  /** 跳转到落雪授权页；授权完成后由 App 顶层的 OAuthCallbackHandler 接手 */
  const handleLxnsOAuthLogin = useCallback(async () => {
    try {
      window.location.href = await buildLxnsAuthorizeUrl()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '无法发起落雪授权')
    }
  }, [])

  /** 落雪个人 API 密钥导入：密钥只用于本次请求，不写入本地存储 */
  const handleLxnsKeyImport = useCallback(async (token: string) => {
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    setImportProgress(null)
    try {
      const stats = await importScoresViaLxns(token, 'user', (current, total) => {
        setImportProgress({ current, total })
      })
      setImportResult(stats)
      setLxnsKey('')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }, [importScoresViaLxns])

  const handleLxnsRevoke = useCallback(async () => {
    if (!window.confirm('退出落雪授权？\n\n只会撤销授权并清除本地令牌，已导入的成绩不受影响。')) return
    await revokeLxnsOAuth()
    closeImport()
  }, [])

  // ---- (Export moved to B50 page toolbar & sidebar user menu) ----

  // ---- File import handler ----
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileImporting(true)
    setFileImportResult(null)
    try {
      // 落雪 CSV 不含定数，需用本地曲库补齐（与在线导入同一套换算）
      const songMap = new Map(useSongStore.getState().songs.map((s) => [s.id, s]))
      const result = await importScoresFromFile(file, songMap)
      if (result.errors && result.errors.length > 0) {
        setFileImportResult(result.errors.map((e) => e.message).join('\n'))
      } else {
        setFileImportResult(
          `导入完成：共 ${result.total} 条，新增 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`
        )
        // Reload scores from DB to update in-memory state
        await fetchAllScores()
      }
    } catch (err) {
      setFileImportResult(err instanceof Error ? err.message : '导入失败')
    } finally {
      setFileImporting(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      e.target.value = ''
    }
  }

  // ---- Render: Loading (or initial state before fetch) ----
  if (loading || (songs.length === 0 && !error)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span>加载曲目数据中...</span>
        </div>
      </div>
    )
  }

  // ---- Render: Error ----
  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <span className="text-3xl">⚠️</span>
          <h2 className="text-base font-medium text-error">加载失败</h2>
          <p className="text-sm text-text-secondary">{error}</p>
          <button
            onClick={() => fetchSongs()}
            className="px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-dark transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  // ---- Render: Content ----
  return (
    <div className="max-w-5xl">

      {/* Header + search */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text mb-4">曲目检索</h2>

        {/* Desktop toolbar */}
        <div className="hidden md:flex gap-2">
          <div className="flex-1">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="多关键词用空格分隔 — 搜索曲名、作者、谱师或别名..."
            />
          </div>
          {/* Sort controls */}
          <SongSortBar />
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors cursor-pointer
              ${showAdvanced ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}
          >
            <Settings size={14} className="mr-1" />高级搜索
          </button>
        </div>

        {/* Mobile toolbar — search full-width + icon buttons */}
        <div className="md:hidden space-y-2">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="搜索曲名、作者、谱师、别名..."
          />
          <div className="flex gap-1.5 flex-wrap">
            <SongSortBar compact />
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                ${showAdvanced ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}
              title="高级搜索"
            >
              <Settings size={14} />筛选
            </button>
          </div>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && <SongFilterPanel />}

      {/* Song list */}
      <SongResultList songs={filteredSongs} />

      {/* ============================================================
          Import modal (inline — migrated from PlayerInfo)
      ============================================================ */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeImport}
          />
          {/* Modal card */}
          <div className="relative bg-surface rounded-xl border border-border shadow-lg p-4 sm:p-6 w-full max-w-[520px] max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-text">导入完整成绩</h3>
              <button
                onClick={closeImport}
                className="p-1 rounded text-text-tertiary hover:text-text hover:bg-surface-light transition-colors cursor-pointer border-none bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-secondary mb-4">
              从水鱼或落雪导入<strong>全部曲目×全部难度</strong>成绩到本地浏览器存储
            </p>

            {/* OAuth 授权：两种环境都可用，是生产环境的主推方式 */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 sm:p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary text-white">水鱼</span>
                <p className="text-xs text-text font-medium">通过水鱼账号授权，一步导入</p>
              </div>
              <button
                onClick={handleOAuthLogin}
                className="w-full py-2 rounded-md text-sm font-semibold bg-primary text-white border-none cursor-pointer hover:bg-primary-dark transition-colors"
              >
                授权并导入
              </button>
              <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
                在你自己的水鱼账号页面完成登录与授权，本站接触不到你的密码。
              </p>

              {/* 同一张卡内提供备用方式：授权不可用时直接用 Import-Token */}
              <details open={!import.meta.env.DEV} className="mt-3 pt-3 border-t border-primary/15 text-xs text-text-secondary">
                <summary className="hover:text-primary transition-colors select-none cursor-pointer">
                  {import.meta.env.DEV ? '备用：使用 Import-Token 导入' : '无法授权？使用 Import-Token 导入'}
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-text-tertiary leading-relaxed">
                    在 Diving-Fish 网站「编辑个人资料」中生成 Token 后粘贴到下方
                  </p>
                  <input
                    type="password"
                    value={importToken}
                    onChange={(e) => saveImportToken(e.target.value)}
                    placeholder="粘贴 Import-Token"
                    className="w-full px-3 py-2 rounded-md border border-border text-sm font-mono
                               focus:outline-none focus:border-primary bg-surface transition-colors"
                  />
                  <button
                    onClick={() => handleLoginAndImport(importToken.trim())}
                    disabled={importing || !importToken.trim()}
                    className="w-full px-4 py-2.5 rounded-md bg-surface border border-border text-text-secondary text-sm font-medium
                               hover:border-primary hover:text-primary transition-all cursor-pointer
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? '导入中...' : '用 Token 导入'}
                  </button>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary select-none">
                    <input
                      type="checkbox"
                      checked={rememberToken}
                      onChange={(e) => {
                        setRememberToken(e.target.checked)
                        if (!e.target.checked) { try { localStorage.removeItem('maimai-df-import-token') } catch {} }
                        else if (importToken.trim()) { try { localStorage.setItem('maimai-df-import-token', importToken.trim()) } catch {} }
                      }}
                      className="w-3.5 h-3.5 rounded border-border cursor-pointer accent-primary"
                    />
                    记住 Token
                  </label>
                </div>
              </details>
            </div>

            {/* 落雪：朋友的主力数据源，与水鱼并列 */}
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 sm:p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent text-white">落雪</span>
                <p className="text-xs text-text font-medium">通过落雪咖啡屋账号导入</p>
              </div>

              {isLxnsConfigured() ? (
                <button
                  onClick={handleLxnsOAuthLogin}
                  className="w-full py-2 rounded-md text-sm font-semibold bg-accent text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
                >
                  授权落雪并导入
                </button>
              ) : (
                <p className="text-[11px] text-text-tertiary leading-relaxed">
                  落雪授权尚未配置应用 ID，请使用下方的个人 API 密钥导入。
                </p>
              )}

              <details className="mt-2">
                <summary className="text-[11px] text-text-tertiary cursor-pointer select-none hover:text-primary transition-colors">
                  使用个人 API 密钥导入
                </summary>
                <div className="mt-2 space-y-2">
                  <input
                    type="password"
                    value={lxnsKey}
                    onChange={(e) => setLxnsKey(e.target.value)}
                    placeholder="粘贴落雪个人 API 密钥"
                    className="w-full px-3 py-2 rounded-md border border-border text-sm font-mono
                               focus:outline-none focus:border-primary bg-surface transition-colors"
                  />
                  <button
                    onClick={() => handleLxnsKeyImport(lxnsKey.trim())}
                    disabled={importing || !lxnsKey.trim()}
                    className="w-full px-4 py-2.5 rounded-md bg-surface border border-border text-text-secondary text-sm font-medium
                               hover:border-primary hover:text-primary transition-all cursor-pointer
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? '导入中...' : '导入'}
                  </button>
                  <p className="text-[10px] text-text-tertiary">密钥只用于本次请求，不会保存在本地。</p>
                </div>
              </details>

              {hasLxnsToken() && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                  <span className="text-[11px] text-text-tertiary">已授权落雪账号</span>
                  <button
                    onClick={handleLxnsRevoke}
                    className="text-[11px] text-error hover:underline cursor-pointer border-none bg-transparent p-0"
                  >
                    退出授权
                  </button>
                </div>
              )}
            </div>

            {/* 账号密码登录：仅在开发环境可用。
                它依赖 Vite 代理把 JWT cookie 重写到 localhost；
                生产环境直连 diving-fish.com 时，跨域 cookie 会被浏览器拦截。 */}
            {import.meta.env.DEV && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 sm:p-4 mb-3">
                <p className="text-[11px] text-text-secondary mb-2">
                  以下方式依赖 Vite 代理，仅本机开发时可用
                </p>
                <LoginToGetToken onToken={saveImportToken} onLoginAndImport={handleLoginAndImport} />
              </div>
            )}

            {/* Import progress */}
            {importing && (
              <div className="mt-4">
                {importProgress ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>正在写入本地数据库...</span>
                      <span className="tabular-nums">{importProgress.current} / {importProgress.total}</span>
                    </div>
                    <div className="w-full bg-bg-gray rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-200"
                        style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-text-secondary mt-3">正在从 Diving-Fish 获取成绩列表...</p>
                  </div>
                )}
              </div>
            )}

            {/* Import error */}
            {importError && (
              <div className="mt-4 bg-error/10 border border-error/30 rounded-lg p-4 text-sm text-error">
                <p className="font-medium">导入失败</p>
                <p className="mt-1">{importError}</p>
              </div>
            )}

            {/* Import success */}
            {importResult && !importing && (
              <div className="mt-4 bg-success/10 border border-success/30 rounded-lg p-4 text-sm">
                <p className="font-medium text-success">导入完成</p>
                <div className="mt-1 space-y-0.5 text-text-secondary">
                  <p>玩家：<strong className="text-text">{importResult.nickname}</strong>，从 Diving-Fish 获取了 <strong className="text-text">{importResult.total}</strong> 条成绩</p>
                  <p>新增 <strong className="text-text">{importResult.imported}</strong> 条，更新 <strong className="text-text">{importResult.updated}</strong> 条</p>
                  {importResult.skipped > 0 && (
                    <p>跳过 <strong className="text-text">{importResult.skipped}</strong> 条（本地已有更高达成率）</p>
                  )}
                </div>
                <p className="text-text-secondary text-xs mt-2">
                  完整成绩已保存到本地，可前往「B50 一览」查看
                </p>
              </div>
            )}

            {/* File import section */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-text-secondary mb-2">
                或从文件恢复成绩（保留最高达成率）：本站导出的 JSON 备份，或落雪导出的成绩 CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                onChange={handleFileImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={fileImporting}
                className="px-4 py-2 rounded-md border border-border bg-surface text-sm text-text-secondary
                           hover:border-primary hover:text-primary transition-colors cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fileImporting ? '导入中...' : <><FolderOpen size={14} className="mr-1 inline" />选择文件</>}
              </button>

              {fileImportResult && (
                <div className={`mt-3 rounded-lg p-3 text-sm whitespace-pre-wrap ${
                  fileImportResult.startsWith('导入完成')
                    ? 'bg-success/10 border border-success/30 text-text-secondary'
                    : 'bg-error/10 border border-error/30 text-error'
                }`}>
                  {fileImportResult}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
