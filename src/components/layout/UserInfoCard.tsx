// ============================================================
// UserInfoCard — sidebar player status + score management menu
// 点击用户名 → 成绩管理菜单（导入/导出/清除/查看 B50）
// ============================================================

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { exportScoresToFile, exportScoresAsLxnsCsv } from '@/utils/exportScores'
import { User, Download, Upload, Trash2, BarChart3, ChevronDown, LogOut } from 'lucide-react'
import { hasOAuthToken, revokeOAuth } from '@/services/dfOAuth'
import { hasOAuthToken as hasLxnsToken, revokeOAuth as revokeLxnsOAuth } from '@/services/lxnsOAuth'

interface UserInfoCardProps {
  collapsed: boolean
}

export default function UserInfoCard({ collapsed }: UserInfoCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const playerName = usePlayerStore((s) => s.importedPlayerName)
  const playerRating = usePlayerStore((s) => s.importedRating)
  const localB50 = usePlayerStore((s) => s.localB50)
  const scores = useScoreStore((s) => s.scores)
  const clearAllScores = useScoreStore((s) => s.clearAllScores)

  // 本地成绩与在线查询是两份互相独立的数据，不能揉成同一个数字。
  // dfPlayerName / dfRating 是「导入或在线查询时缓存」的，清空本地成绩时
  // 不应该连带抹掉 —— 用户清的是本地，不是在线。
  const localRating = localB50 && localB50.totalRating > 0 ? localB50.totalRating : null
  const onlineRating = playerRating > 0 ? playerRating : null
  const hasLocalData = localRating !== null
  const hasOnlineData = !!playerName
  const isLoggedIn = hasLocalData || hasOnlineData
  const displayName = playerName || (hasLocalData ? '本地玩家' : '')

  // 折叠态只有一个数字的位置：优先本地，其次在线，title 里把两者都写清楚
  const compactRating = localRating ?? onlineRating
  const compactTitle = [
    displayName || '玩家',
    localRating !== null ? `本地 Rating ${localRating}` : null,
    onlineRating !== null ? `在线 Rating ${onlineRating}` : null,
  ].filter(Boolean).join(' · ')

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleExport = async () => {
    setMenuOpen(false)
    if (scores.length === 0) {
      alert('暂无本地成绩可导出')
      return
    }
    await exportScoresToFile(scores)
  }

  const handleExportCsv = () => {
    setMenuOpen(false)
    if (scores.length === 0) {
      alert('暂无本地成绩可导出')
      return
    }
    exportScoresAsLxnsCsv(scores)
  }

  const handleClear = async () => {
    setMenuOpen(false)
    if (!window.confirm(`确定清除全部 ${scores.length} 条本地成绩？此操作不可撤销。\n\n在线查询结果不受影响。`)) return
    await clearAllScores()
    usePlayerStore.setState({ localB50: null })
  }

  const [oauthLinked, setOauthLinked] = useState(() => hasOAuthToken())
  const [lxnsLinked, setLxnsLinked] = useState(() => hasLxnsToken())

  // 授权回调发生在别处，打开菜单时重新确认一次授权状态
  useEffect(() => {
    if (menuOpen) {
      setOauthLinked(hasOAuthToken())
      setLxnsLinked(hasLxnsToken())
    }
  }, [menuOpen])

  const handleRevokeOAuth = async () => {
    if (!window.confirm('退出水鱼账号授权？\n\n只会撤销授权并清除本地令牌，已导入的成绩不受影响。')) return
    await revokeOAuth()
    setOauthLinked(false)
    setMenuOpen(false)
  }

  const handleRevokeLxns = async () => {
    if (!window.confirm('退出落雪账号授权？\n\n只会撤销授权并清除本地令牌，已导入的成绩不受影响。')) return
    await revokeLxnsOAuth()
    setLxnsLinked(false)
    setMenuOpen(false)
  }

  const menuItems = [
    { label: '导入成绩', desc: '水鱼 / 落雪账号 / Token / 备份文件', Icon: Download, onClick: () => { setMenuOpen(false); navigate('/songs?import=1') } },
    { label: '导出成绩', desc: '导出为 JSON 备份文件', Icon: Upload, onClick: handleExport },
    { label: '导出落雪 CSV', desc: '列与落雪导出一致，可回流到落雪', Icon: Upload, onClick: handleExportCsv },
    { label: '查看 B50', desc: '本地成绩与在线查分', Icon: BarChart3, onClick: () => { setMenuOpen(false); navigate('/player') } },
    ...(oauthLinked
      ? [{ label: '退出水鱼授权', desc: '撤销授权并清除本地令牌', Icon: LogOut, onClick: handleRevokeOAuth }]
      : []),
    ...(lxnsLinked
      ? [{ label: '退出落雪授权', desc: '撤销授权并清除本地令牌', Icon: LogOut, onClick: handleRevokeLxns }]
      : []),
    { label: '清除本地成绩', desc: `共 ${scores.length} 条，不可撤销`, Icon: Trash2, danger: true, onClick: handleClear },
  ]

  // Collapsed: compact icon view
  if (collapsed) {
    if (isLoggedIn) {
      return (
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex justify-center py-3 border-b border-border w-full cursor-pointer border-none bg-transparent hover:bg-surface-light transition-colors relative"
          title={compactTitle}
        >
          <span className="text-xs font-bold text-primary tabular-nums">{compactRating}</span>
          {menuOpen && <MenuPanel items={menuItems} ref={menuRef} />}
        </button>
      )
    }
    return (
      <button
        onClick={() => navigate('/songs?import=1')}
        className="flex justify-center py-3 border-b border-border w-full cursor-pointer border-none bg-transparent hover:bg-surface-light transition-colors"
        title="导入完整成绩"
      >
        <span className="text-sm"><User size={18} /></span>
      </button>
    )
  }

  // Expanded: full card with management menu
  return (
    <div className="px-4 py-3 border-b border-border relative" ref={menuRef}>
      {isLoggedIn ? (
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full text-left cursor-pointer border-none bg-transparent p-0 hover:opacity-80 transition-opacity"
          title="成绩管理"
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-text truncate">{displayName}</span>
              <ChevronDown size={12} className={`text-text-tertiary transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              {localRating !== null && (
                <span className="flex items-baseline gap-1" title="来自本地成绩">
                  <span className="text-[10px] text-text-tertiary">本地</span>
                  <span className="text-base font-bold text-primary tabular-nums">{localRating}</span>
                </span>
              )}
              {onlineRating !== null && (
                <span className="flex items-baseline gap-1" title="来自在线查分，与本地成绩相互独立">
                  <span className="text-[10px] text-text-tertiary">在线</span>
                  <span className="text-base font-bold text-accent tabular-nums">{onlineRating}</span>
                </span>
              )}
            </div>
            <span className="text-[10px] text-text-tertiary mt-0.5">{scores.length} 条本地成绩 · 点击管理</span>
          </div>
        </button>
      ) : (
        <button
          onClick={() => navigate('/songs?import=1')}
          className="w-full text-left cursor-pointer border-none bg-transparent p-0 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm"><User size={18} /></span>
            <div>
              <div className="text-sm font-medium text-text">请登录</div>
              <div className="text-xs text-text-tertiary mt-0.5">导入完整成绩 →</div>
            </div>
          </div>
        </button>
      )}

      {menuOpen && isLoggedIn && <MenuPanel items={menuItems} ref={menuRef} />}
    </div>
  )
}

/** Dropdown menu panel for score management */
const MenuPanel = ({ items, ref }: {
  items: Array<{ label: string; desc: string; Icon: typeof Download; danger?: boolean; onClick: () => void }>
  ref: React.Ref<HTMLDivElement>
}) => (
  <div
    ref={ref}
    className="absolute left-3 right-3 top-full mt-1 z-50 bg-surface border border-border rounded-lg shadow-lg py-1 overflow-hidden"
  >
    {items.map(({ label, desc, Icon, danger, onClick }) => (
      <button
        key={label}
        onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer border-none bg-transparent transition-colors hover:bg-surface-light ${danger ? 'text-error' : 'text-text'}`}
      >
        <Icon size={15} className={danger ? 'text-error' : 'text-text-secondary'} />
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-medium">{label}</span>
          <span className={`block text-[10px] truncate ${danger ? 'text-error/70' : 'text-text-tertiary'}`}>{desc}</span>
        </span>
      </button>
    ))}
  </div>
)
