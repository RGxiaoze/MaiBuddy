// ============================================================
// Song list / search page — search, filter, paginate, import
// ============================================================

import { useCallback, useEffect, useMemo, useState, useDeferredValue, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSongStore, SORT_OPTIONS } from '@/store/songStore'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import SearchBar from '@/components/shared/SearchBar'
import Pagination from '@/components/shared/Pagination'
import { LEVEL_INDEX_MAP } from '@/data/constants'
import { VERSION_ORDER, getVersionDisplay } from '@/data/versions'
import { loginToProber, generateImportToken } from '@/services/divingFishApi'
import { Settings, Download, Upload, Music, FolderOpen, X } from 'lucide-react'
import { exportScoresToFile } from '@/utils/exportScores'
import { importScoresFromFile } from '@/utils/importScores'
import { getAllScores } from '@/db/database'
import type { LevelIndex, Song } from '@/types'

const PAGE_SIZE = 50

/** Level preset buttons: .0-.5 for plain number, .6-.9 for + suffix */
const LEVEL_PRESETS = [
  { label: '13',  min: 13.0, max: 13.5 },
  { label: '13+', min: 13.6, max: 13.9 },
  { label: '14',  min: 14.0, max: 14.5 },
  { label: '14+', min: 14.6, max: 14.9 },
  { label: '15',  min: 15.0, max: 15.0 },
]

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
  const navigate = useNavigate()
  const {
    songs, loading, error,
    searchQuery, advancedFilters,
    fetchSongs, setSearchQuery, setAdvancedFilters, resetFilters, getFilteredSongs,
    sortBy, sortOrder, setSortBy, toggleSortOrder,
  } = useSongStore()
  const importDivingFishScores = usePlayerStore((s) => s.importDivingFishScores)

  const [showAdvanced, setShowAdvanced] = useState(false)

  // ---- Import modal state ----
  const [searchParams, setSearchParams] = useSearchParams()
  const [showImport, setShowImport] = useState(false)
  
  // Auto-open import modal when ?import=1 query param is present
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      setShowImport(true)
    }
  }, [searchParams])

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
  const [exporting, setExporting] = useState(false)
  const [fileImporting, setFileImporting] = useState(false)
  const [fileImportResult, setFileImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- Pagination state ----
  const [page, setPage] = useState(0)

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

  // Deduplicate versions & genres for filter dropdowns
  const versions = useMemo(() => {
    const set = new Set(songs.map((s) => s.from).filter(Boolean))
    return [...set].sort((a, b) => (VERSION_ORDER.get(a) ?? 0) - (VERSION_ORDER.get(b) ?? 0))
  }, [songs])

  const genres = useMemo(() => {
    const set = new Set(songs.map((s) => s.genre).filter(Boolean))
    return [...set].sort()
  }, [songs])

  // Defer search to avoid blocking keystrokes
  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Memoize filtered results
  const filteredSongs = useMemo(
    () => getFilteredSongs(deferredSearchQuery),
    [songs, deferredSearchQuery, advancedFilters, sortBy, sortOrder, getFilteredSongs]
  )

  // Reset page when any filter or sort changes
  useEffect(() => {
    setPage(0)
  }, [deferredSearchQuery, advancedFilters, sortBy, sortOrder])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const pagedSongs = useMemo(
    () => filteredSongs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredSongs, page]
  )

  const handlePageChange = (p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Precompute pair map once per full song list (stable across pagination)
  const pairMap = useMemo(() => {
    const map = new Map<string, { standard?: Song; dx?: Song }>()
    for (const s of songs) {
      const key = `${s.title}|${s.artist}|${s.bpm}`
      const entry = map.get(key) || {}
      if (s.difficulties.standard.length > 0) entry.standard = s
      if (s.difficulties.dx.length > 0) entry.dx = s
      map.set(key, entry)
    }
    return map
  }, [songs])

  // Precompute display data for current page, including paired song info
  const songDisplayData = useMemo(() => {
    return pagedSongs.map((song) => {
      const key = `${song.title}|${song.artist}|${song.bpm}`
      const pair = pairMap.get(key)
      const hasPair = pair && pair.standard && pair.dx

      // Level labels from this song only (not merged)
      const levelLabels: { idx: LevelIndex; label: string; color: string }[] = []
      const diffs = [...song.difficulties.standard, ...song.difficulties.dx]
      for (const d of diffs) {
        if (d.level && d.level !== '0') {
          const colors = LEVEL_INDEX_MAP[d.levelIndex]
          if (colors) levelLabels.push({ idx: d.levelIndex, label: d.level, color: colors.color })
        }
      }
      levelLabels.sort((a, b) => a.idx - b.idx)

      return { song, levelLabels, hasPair: !!hasPair, pair }
    })
  }, [pagedSongs, pairMap])

  // ---- Import handler ----
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

  // ---- Export handler ----
  const handleExport = async () => {
    setExporting(true)
    try {
      const scores = await getAllScores()
      exportScoresToFile(scores)
    } finally {
      setExporting(false)
    }
  }

  // ---- File import handler ----
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileImporting(true)
    setFileImportResult(null)
    try {
      const result = await importScoresFromFile(file)
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

  // ---- Handle level preset click ----
  const handlePresetClick = (preset: { min: number; max: number }) => {
    const current = { ...advancedFilters }
    // Toggle off if already selected
    if (current.levelValueMin === preset.min && current.levelValueMax === preset.max) {
      setAdvancedFilters({ levelValueMin: undefined, levelValueMax: undefined })
    } else {
      setAdvancedFilters({ levelValueMin: preset.min, levelValueMax: preset.max })
    }
  }

  const isPresetActive = (preset: { min: number; max: number }) =>
    advancedFilters.levelValueMin === preset.min && advancedFilters.levelValueMax === preset.max

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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-2 rounded-md border border-border bg-surface text-sm text-text-secondary
                       focus:outline-none focus:border-primary cursor-pointer"
            title="排序方式"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={toggleSortOrder}
            className="px-2 py-2 rounded-md border border-border bg-surface text-sm text-text-secondary
                       hover:border-primary transition-colors cursor-pointer"
            title={sortOrder === 'desc' ? '降序 ↓' : '升序 ↑'}
          >
            {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors cursor-pointer
              ${showAdvanced ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}
          >
            <Settings size={14} className="mr-1" />高级搜索
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors cursor-pointer
                       bg-surface text-text-secondary border-border hover:border-primary"
          >
            <Download size={14} className="mr-1" />导入成绩
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors cursor-pointer
                       bg-surface text-text-secondary border-border hover:border-primary
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} className="mr-1" />导出成绩
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
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary
                         focus:outline-none focus:border-primary cursor-pointer"
              title="排序方式"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={toggleSortOrder}
              className="px-2 py-1.5 rounded-md border border-border bg-surface text-xs text-text-secondary
                         hover:border-primary transition-colors cursor-pointer"
              title={sortOrder === 'desc' ? '降序 ↓' : '升序 ↑'}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                ${showAdvanced ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}
              title="高级搜索"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                         bg-surface text-text-secondary border-border hover:border-primary"
              title="导入成绩"
            >
<Download size={14} />
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                         bg-surface text-text-secondary border-border hover:border-primary
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="导出成绩"
            >
              <Upload size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="bg-bg-gray border border-border rounded-lg p-4 mb-6 space-y-3">
          {/* Level presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-secondary mr-1">定数预设:</span>
            {LEVEL_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer border-none
                  ${isPresetActive(preset)
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-secondary hover:bg-surface-light'
                  }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Level range inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              最低定数
              <input
                type="number"
                min={1} max={15} step={0.1}
                value={advancedFilters.levelValueMin ?? ''}
                onChange={(e) => setAdvancedFilters({ levelValueMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="px-2 py-1.5 rounded border border-border text-sm focus:outline-none focus:border-primary bg-surface"
                placeholder="1.0"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              最高定数
              <input
                type="number"
                min={1} max={15} step={0.1}
                value={advancedFilters.levelValueMax ?? ''}
                onChange={(e) => setAdvancedFilters({ levelValueMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="px-2 py-1.5 rounded border border-border text-sm focus:outline-none focus:border-primary bg-surface"
                placeholder="15.0"
              />
            </label>

            {/* Version filter */}
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              版本
              <select
                value={advancedFilters.version ?? ''}
                onChange={(e) => setAdvancedFilters({ version: e.target.value || undefined })}
                className="px-2 py-1.5 rounded border border-border text-sm bg-surface focus:outline-none focus:border-primary"
              >
                <option value="">全部版本</option>
                {versions.map((v) => (
                  <option key={v} value={v}>{getVersionDisplay(v)}</option>
                ))}
              </select>
            </label>

            {/* Genre filter */}
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              分类
              <select
                value={advancedFilters.genre ?? ''}
                onChange={(e) => setAdvancedFilters({ genre: e.target.value || undefined })}
                className="px-2 py-1.5 rounded border border-border text-sm bg-surface focus:outline-none focus:border-primary"
              >
                <option value="">全部分类</option>
                {genres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>

            {/* Difficulty filter */}
            <label className="flex flex-col gap-1 text-xs text-text-secondary">
              难度
              <select
                value={advancedFilters.difficultyLevel != null ? advancedFilters.difficultyLevel : ''}
                onChange={(e) => setAdvancedFilters({ difficultyLevel: e.target.value ? parseInt(e.target.value) : undefined })}
                className="px-2 py-1.5 rounded border border-border text-sm bg-surface focus:outline-none focus:border-primary"
              >
                <option value="">全部难度</option>
                {Object.entries(LEVEL_INDEX_MAP).map(([idx, { label }]) => (
                  <option key={idx} value={idx}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Reset button */}
          <div className="flex justify-end">
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-md border border-border text-sm text-text-secondary
                         hover:bg-primary/10 transition-colors cursor-pointer"
            >
              重置筛选条件
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-text-secondary mb-3">
        共 {filteredSongs.length} 首曲目
        {filteredSongs.length > PAGE_SIZE && ` · 第 ${page + 1}/${totalPages} 页`}
      </p>

      {/* Song list */}
      {filteredSongs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-text-secondary">
          <Music size={28} className="text-text-tertiary" />
          <p className="text-sm">未找到匹配曲目</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {songDisplayData.map(({ song, levelLabels, hasPair, pair }) => (
              <button
                key={song.id}
                onClick={() => navigate(`/songs/${song.id}`)}
                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-lg bg-surface border border-border/50
                           hover:border-primary hover:shadow-sm transition-all text-left cursor-pointer w-full"
              >
                {/* Mobile: cover + title row, desktop: cover thumbnail inline */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <img
                    src={song.imageUrl}
                    alt={song.title}
                    className="w-12 h-12 rounded object-cover shrink-0 bg-bg-gray"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect fill="%23EBEEF3" width="48" height="48"/><text x="24" y="28" text-anchor="middle" fill="%23999" font-size="14">♪</text></svg>'
                    }}
                  />
                  <div className="sm:hidden flex-1 min-w-0">
                    <div className="font-medium text-sm text-text truncate">{song.title}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {levelLabels.map(({ idx, label, color }) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white leading-tight"
                          style={{ backgroundColor: color }}
                        >
                          {label}
                        </span>
                      ))}
                      {song.difficulties.standard.length > 0 && (
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] leading-tight border border-border/50 shrink-0
                            ${hasPair ? 'cursor-pointer hover:border-primary' : 'text-text-tertiary bg-surface-light'}`}
                          onClick={(e) => { if (hasPair && pair?.standard) { e.stopPropagation(); navigate('/songs/' + pair.standard.id) } }}
                        >标</span>
                      )}
                      {song.difficulties.dx.length > 0 && (
                        <span
                          className={`px-1 py-0.5 rounded text-[9px] leading-tight shrink-0
                            ${hasPair ? 'cursor-pointer hover:bg-primary/20' : 'text-primary bg-primary/10'}`}
                          onClick={(e) => { if (hasPair && pair?.dx) { e.stopPropagation(); navigate('/songs/' + pair.dx.id) } }}
                        >DX</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop song info (hidden on mobile) */}
                <div className="hidden sm:block flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-text truncate">{song.title}</span>
                    {song.difficulties.standard.length > 0 && (
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] leading-tight border border-border/50 shrink-0
                          ${hasPair ? 'cursor-pointer hover:border-primary' : 'text-text-tertiary bg-surface-light'}`}
                        onClick={(e) => { if (hasPair && pair?.standard) { e.stopPropagation(); navigate('/songs/' + pair.standard.id) } }}
                      >标</span>
                    )}
                    {song.difficulties.dx.length > 0 && (
                      <span
                        className={`px-1 py-0.5 rounded text-[9px] leading-tight shrink-0
                          ${hasPair ? 'cursor-pointer hover:bg-primary/20' : 'text-primary bg-primary/10'}`}
                        onClick={(e) => { if (hasPair && pair?.dx) { e.stopPropagation(); navigate('/songs/' + pair.dx.id) } }}
                      >DX</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary truncate">{song.artist}</div>
                </div>

                {/* Mobile: artist + metadata row */}
                <div className="sm:hidden flex items-center gap-2 text-xs text-text-secondary pt-0.5">
                  <span className="truncate">{song.artist}</span>
                  <span className="text-text-tertiary">|</span>
                  <span className="tabular-nums shrink-0">BPM {song.bpm}</span>
                  <span className="text-text-tertiary">|</span>
                  <span className="truncate shrink-0">{getVersionDisplay(song.from)}</span>
                </div>

                {/* Desktop: Difficulty badges + BPM + version */}
                <div className="hidden sm:flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <div className="flex gap-1">
                    {levelLabels.map(({ idx, label, color }) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[11px] font-medium text-white leading-tight"
                        style={{ backgroundColor: color }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-text-secondary tabular-nums w-14 text-right">{song.bpm}</span>
                  <span className="text-[10px] text-text-tertiary w-16 text-right">{song.from}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}

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
              导入 Diving-Fish 的<strong>全部曲目×全部难度</strong>成绩到本地浏览器存储
            </p>

            {/* Auto-login — preferred method */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 sm:p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary text-white">推荐</span>
                <p className="text-xs text-text font-medium">Diving-Fish 账号登录，一步导入</p>
              </div>
              <LoginToGetToken onToken={saveImportToken} onLoginAndImport={handleLoginAndImport} />
            </div>

            {/* Manual Token input — fallback, collapsible */}
            <details className="text-xs text-text-secondary cursor-pointer group mt-3">
              <summary className="hover:text-primary transition-colors select-none py-1">备用手动导入 — 已有 Import-Token 时使用</summary>
              <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                <p className="text-text-tertiary leading-relaxed">在 Diving-Fish 网站「编辑个人资料」中生成 Token 后粘贴到下方</p>
                <div>
                  <label className="block text-xs text-text-secondary mb-1 font-medium">Import-Token</label>
                  <input
                    type="password"
                    value={importToken}
                    onChange={(e) => saveImportToken(e.target.value)}
                    placeholder="粘贴 Import-Token"
                    className="w-full px-3 py-2 rounded-md border border-border text-sm font-mono
                               focus:outline-none focus:border-primary bg-surface transition-colors"
                  />
                </div>
                <button
                  onClick={() => handleLoginAndImport(importToken.trim())}
                  disabled={importing || !importToken.trim()}
                  className="w-full px-4 py-2.5 rounded-md bg-surface border border-border text-text-secondary text-sm font-medium
                             hover:border-primary hover:text-primary transition-all cursor-pointer
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? '导入中...' : '导入'}
                </button>
              </div>
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
            </details>

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
                或从之前导出的 JSON 文件恢复成绩（保留最高达成率）：
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
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
                {fileImporting ? '导入中...' : <><FolderOpen size={14} className="mr-1 inline" />选择备份文件</>}
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
