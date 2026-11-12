// ============================================================
// Player info page — B50 query & local B50
// ============================================================

import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { Target, Download, Upload, Trash2, Plus } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import NextTargetPanel from '@/components/shared/NextTargetPanel'
import QuickScoreEntry from '@/components/shared/QuickScoreEntry'
import { exportScoresToFile } from '@/utils/exportScores'
import B50TileCard from '@/components/shared/B50TileCard'
import StatsDashboard from '@/components/shared/StatsDashboard'
import { generateStrategy } from '@/utils/strategy'
import { ENABLE_STRATEGY_PANEL } from '@/config/features'
import { computeTheoreticalMaxBoth } from '@/utils/b50'
import type { Song } from '@/types'
import type { B50Result } from '@/utils/b50'
import type { ScoreRecord } from '@/db/database'

function StrategyPanel({ b50, scores, songs, theoreticalMax }: {
  b50: B50Result; scores: ScoreRecord[]; songs: Song[]; theoreticalMax: number
}) {
  const songMap = useMemo(() => new Map(songs.map(s => [s.id, s])), [songs])
  const advice = useMemo(() => generateStrategy(b50, scores, songMap, theoreticalMax), [b50, scores, songMap, theoreticalMax])
  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <h3 className="text-sm font-semibold text-text mb-3"><Target size={16} className="inline mr-1" /> 推分路线 — {advice.tier} → {advice.nextTier}</h3>
      <p className="text-xs text-text-secondary mb-3">{advice.generalAdvice}</p>
      <ul className="space-y-1.5">{advice.actionItems.map((item, i) => <li key={i} className="flex items-start gap-2 text-xs text-text-secondary"><span className="text-primary shrink-0 mt-0.5">▸</span><span>{item}</span></li>)}</ul>
      <p className="text-xs text-text-tertiary mt-3 pt-3 border-t border-border/30">预估周期：{advice.estimatedGain}</p>
    </div>
  )
}

export default function PlayerInfo() {
  const [activeTab, setActiveTab] = useState<'overview' | 'b50' | 'online'>('overview')
  const [b15Collapsed, setB15Collapsed] = useState(true)
  const [b35Collapsed, setB35Collapsed] = useState(true)
  const [dfB15Collapsed, setDfB15Collapsed] = useState(true)
  const [dfB35Collapsed, setDfB35Collapsed] = useState(true)

  const { scores, loaded: scoresLoaded, fetchAllScores, clearAllScores } = useScoreStore()
  const { songs, fetchSongs } = useSongStore()
  const { dfBest35, dfBest15, dfRating, dfLoading, dfError, dfPlayerName, queryPlayer, clearQuery, localB50, computeLocalB50, recomputeFlag } = usePlayerStore()
  const [username, setUsername] = useState(dfPlayerName)
  const [showQuickEntry, setShowQuickEntry] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { if (songs.length === 0) fetchSongs(); if (!scoresLoaded) fetchAllScores() }, [])
  useEffect(() => { if (scores.length > 0 && songs.length > 0) computeLocalB50() }, [scores.length, songs.length, recomputeFlag])

  const theoreticalMaxAll = useMemo(() => songs.length === 0 ? { sssPlusMax: 0, apMax: 0 } : computeTheoreticalMaxBoth(songs), [songs])
  const theoreticalMax = theoreticalMaxAll.sssPlusMax

  // Prebuilt songId-levelIndex → totalNotes map (avoids O(n×m) find on every render)
  const totalNotesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of songs) {
      for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (d.notes?.total) map.set(`${s.id}-${d.levelIndex}`, d.notes.total)
      }
    }
    return map
  }, [songs])

  const getTotalNotes = (songId: number, levelIndex: number): number | undefined => {
    return totalNotesMap.get(`${songId}-${levelIndex}`)
  }

  const handleQuery = () => { if (username.trim()) queryPlayer(username.trim()) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleQuery() }
  const handleClearScores = async () => { await clearAllScores(); usePlayerStore.setState({ localB50: null }) }

  const handleClearScoresWithConfirm = () => {
    if (scores.length === 0) { alert('暂无本地成绩可清除'); return }
    if (!window.confirm(`确定清除全部 ${scores.length} 条本地成绩？此操作不可撤销。`)) return
    handleClearScores()
  }

  const handleExport = async () => {
    if (scores.length === 0) { alert('暂无本地成绩可导出'); return }
    await exportScoresToFile(scores)
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-text mb-4">成绩统计</h2>

      {/* 三个 Tab：总览 / B50 / 在线查分。每屏只承载一类内容，避免长页堆叠 */}
      <div className="flex gap-1 mb-4">
        {([
          { key: 'overview', label: '总览' },
          { key: 'b50', label: 'B50' },
          { key: 'online', label: '在线查分' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors border-none
              ${activeTab === t.key ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 总览：统计面板（筛选联动 + 钻取） */}
      {activeTab === 'overview' && <StatsDashboard />}

      {/* 成绩管理工具栏：只在看成绩的 Tab 出现 */}
      {(activeTab === 'b50' || activeTab === 'online') && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-1.5">
          <button onClick={() => setShowQuickEntry(true)} className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer border-none" title="快捷录入成绩">
            <Plus size={13} className="inline mr-0.5" /><span className="hidden sm:inline">录入</span>
          </button>
          <button onClick={() => navigate('/songs?import=1')} className="px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors cursor-pointer" title="导入成绩">
            <Download size={13} className="inline mr-0.5" /><span className="hidden sm:inline">导入</span>
          </button>
          <button onClick={handleExport} className="px-2.5 py-1.5 rounded-md bg-surface border border-border text-xs text-text-secondary hover:border-primary hover:text-primary transition-colors cursor-pointer" title="导出成绩">
            <Upload size={13} className="inline mr-0.5" /><span className="hidden sm:inline">导出</span>
          </button>
          <button onClick={handleClearScoresWithConfirm} className="px-2.5 py-1.5 rounded-md border border-error/40 text-error/80 text-xs hover:bg-error/10 transition-colors cursor-pointer" title="清除本地成绩">
            <Trash2 size={13} className="inline mr-0.5" /><span className="hidden sm:inline">清除</span>
          </button>
          </div>
        </div>
      )}

      {activeTab === 'online' && (<>
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={handleKeyDown} placeholder="输入玩家名称（查 B50）" className="flex-1 px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary bg-surface" />
            <button onClick={handleQuery} disabled={dfLoading || !username.trim()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{dfLoading ? '查询中...' : <><span className="sm:hidden">查询</span><span className="hidden sm:inline">查询 B50</span></>}</button>
            {dfPlayerName && <button onClick={clearQuery} className="px-3 py-2 rounded-md border border-border text-sm text-text-secondary hover:bg-bg-gray transition-colors cursor-pointer"><span className="sm:hidden">✕</span><span className="hidden sm:inline">清除</span></button>}
          </div>
        </div>
        {dfError && <div className="bg-error/10 border border-error/30 rounded-lg p-4 mb-4 text-sm text-error">{dfError}</div>}
        {dfLoading && <div className="bg-surface border border-border rounded-lg p-8 text-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" /><p className="text-sm text-text-secondary mt-3">正在查询 B50 数据...</p></div>}
        {!dfLoading && !dfError && dfPlayerName && (<>
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <div className="flex items-baseline gap-4"><div><span className="text-sm text-text-secondary">玩家：</span><span className="text-base font-semibold text-text ml-1">{dfPlayerName}</span></div><div><span className="text-sm text-text-secondary">总 DX Rating：</span><span className="text-2xl font-bold text-primary ml-1">{dfRating}</span></div></div>
            <div className="flex gap-6 mt-3 text-xs text-text-secondary"><span>旧版本 Best 35：<strong className="text-text">{dfBest35.reduce((s, e) => s + e.dxRating, 0)}</strong></span><span>新版本 Best 15：<strong className="text-text">{dfBest15.reduce((s, e) => s + e.dxRating, 0)}</strong></span></div>
          </div>
          {dfBest35.length + dfBest15.length === 0 ? <div className="bg-surface border border-border rounded-lg p-8 text-center text-text-secondary text-sm">该玩家暂无 B50 数据</div> : <div className="flex flex-col gap-4">
            {dfBest15.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setDfB15Collapsed(!dfB15Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><h3 className="text-sm font-semibold text-text m-0">新版本 Best {dfBest15.length}</h3><span className="text-xs text-text-tertiary shrink-0">{dfB15Collapsed ? `展开全部 ${dfBest15.length} 条 ▶` : '收起 ▲'}</span></button>
              {dfBest15.length < 15 && <p className="text-xs text-warning mb-2 bg-warning/5 rounded px-3 py-2">新版本还差 <strong>{15 - dfBest15.length}</strong> 首填满 B15，继续加油！</p>}
              {(() => {
                const displayed = dfB15Collapsed ? dfBest15.slice(0, 5) : dfBest15
                const hasMore = dfB15Collapsed && dfBest15.length > 5
                return <>
                  <div className="relative">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{displayed.map((entry, i) => <B50TileCard key={`new-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} levelValue={entry.levelValue} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setDfB15Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {dfBest15.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {dfBest35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setDfB35Collapsed(!dfB35Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><h3 className="text-sm font-semibold text-text m-0">旧版本 Best {dfBest35.length}</h3><span className="text-xs text-text-tertiary shrink-0">{dfB35Collapsed ? `展开全部 ${dfBest35.length} 条 ▶` : '收起 ▲'}</span></button>
              {(() => {
                const displayed = dfB35Collapsed ? dfBest35.slice(0, 5) : dfBest35
                const hasMore = dfB35Collapsed && dfBest35.length > 5
                return <>
                  <div className="relative">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{displayed.map((entry, i) => <B50TileCard key={`old-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} levelValue={entry.levelValue} title={entry.title} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setDfB35Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {dfBest35.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {dfBest15.length === 0 && dfBest35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4"><h3 className="text-sm font-semibold text-text mb-2">新版本 Best 0</h3><p className="text-xs text-warning bg-warning/5 rounded px-3 py-2">新版本暂无成绩，还差 <strong>15</strong> 首填满 B15。去推分建议看看哪些曲目值得练习吧！</p></div>}
          </div>}
        </>)}
        {!dfLoading && !dfError && !dfPlayerName && <div className="bg-surface border border-border rounded-lg px-4 py-3 text-center text-sm text-text-secondary">输入玩家名称查询 B50 — 或 <Link to="/songs?import=1" className="text-primary hover:underline font-medium">请登录导入完整成绩</Link></div>}
      </>)}

      {activeTab === 'b50' && (<>
        {!localB50 || (localB50.best35.length === 0 && localB50.best15.length === 0) ? (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 text-center"><span className="text-sm text-text-secondary">暂无本地成绩 — </span><Link to="/songs?import=1" className="text-sm text-primary hover:underline font-medium">请登录导入</Link></div>
        ) : (<>
          <div className="bg-surface border border-border rounded-lg p-5 mb-4">
            <div className="flex items-baseline gap-4"><div><span className="text-sm text-text-secondary">总 DX Rating（本地）：</span><span className="text-2xl font-bold text-primary ml-1">{localB50.totalRating}</span></div></div>
            <div className="flex gap-6 mt-3 text-xs text-text-secondary"><span>旧版本 Best {localB50.best35.length}：<strong className="text-text">{localB50.best35Total}</strong></span><span>新版本 Best {localB50.best15.length}：<strong className="text-text">{localB50.best15Total}</strong></span></div>
          </div>
          <div className="flex flex-col gap-4">
            {localB50.best15.length === 0 && localB50.best35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4"><h3 className="text-sm font-semibold text-text mb-2">新版本 Best 0</h3><p className="text-xs text-warning bg-warning/5 rounded px-3 py-2">新版本暂无成绩，还差 <strong>15</strong> 首填满 B15。去推分建议看看哪些曲目值得练习吧！</p></div>}
            {localB50.best15.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setB15Collapsed(!b15Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text m-0">新版本 Best {localB50.best15.length}</h3><span className="text-[10px] text-text-tertiary tabular-nums">计 {localB50.best15Total} 分</span></div><span className="text-xs text-text-tertiary shrink-0">{b15Collapsed ? `展开全部 ${localB50.best15.length} 条 ▶` : '收起 ▲'}</span></button>
              {localB50.best15.length < 15 && <p className="text-xs text-warning mb-2 bg-warning/5 rounded px-3 py-2">新版本还差 <strong>{15 - localB50.best15.length}</strong> 首填满 B15，继续加油！</p>}
              {(() => {
                const displayed = b15Collapsed ? localB50.best15.slice(0, 5) : localB50.best15
                const hasMore = b15Collapsed && localB50.best15.length > 5
                return <>
                  <div className="relative">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{displayed.map((entry, i) => <B50TileCard key={`loc-new-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} levelValue={entry.levelValue} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setB15Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {localB50.best15.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
            {localB50.best35.length > 0 && <div className="bg-surface border border-border rounded-lg p-4">
              <button onClick={() => setB35Collapsed(!b35Collapsed)} className="w-full flex items-center justify-between cursor-pointer border-none bg-transparent p-0 mb-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold text-text m-0">旧版本 Best {localB50.best35.length}</h3><span className="text-[10px] text-text-tertiary tabular-nums">计 {localB50.best35Total} 分</span></div><span className="text-xs text-text-tertiary shrink-0">{b35Collapsed ? `展开全部 ${localB50.best35.length} 条 ▶` : '收起 ▲'}</span></button>
              {(() => {
                const displayed = b35Collapsed ? localB50.best35.slice(0, 5) : localB50.best35
                const hasMore = b35Collapsed && localB50.best35.length > 5
                return <>
                  <div className="relative">
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">{displayed.map((entry, i) => <B50TileCard key={`loc-old-${entry.songId}-${entry.levelIndex}-${i}`} songId={entry.songId} levelIndex={entry.levelIndex} level={entry.level} levelValue={entry.levelValue} title={entry.songTitle} achievements={entry.achievements} rate={entry.rate} dxRating={entry.dxRating} fcType={entry.fcType} fsType={entry.fsType} dxScore={entry.dxScore} totalNotes={getTotalNotes(entry.songId, entry.levelIndex)} />)}</div>
                    {hasMore && (
                      <button onClick={() => setB35Collapsed(false)} className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full" style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}>
                        <span className="text-xs text-primary font-medium hover:underline">展开全部 {localB50.best35.length} 条 ▾</span>
                      </button>
                    )}
                  </div>
                </>
              })()}
            </div>}
          </div>
          {ENABLE_STRATEGY_PANEL && localB50 && localB50.best35.length + localB50.best15.length > 0 && <StrategyPanel b50={localB50} scores={scores} songs={songs} theoreticalMax={theoreticalMax} />}

          {/* 推分建议统一在推荐页，这里只保留 Top 3 速览 */}
          <NextTargetPanel />
        </>)}
      </>)}

      {/* 快捷录入弹窗 */}
      {showQuickEntry && <QuickScoreEntry onClose={() => setShowQuickEntry(false)} />}
    </div>
  )
}
