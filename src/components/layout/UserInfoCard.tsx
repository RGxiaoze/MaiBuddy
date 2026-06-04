// ============================================================
// User info card — sidebar player status widget
// ============================================================

import { useNavigate } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'

interface UserInfoCardProps {
  collapsed: boolean
}

export default function UserInfoCard({ collapsed }: UserInfoCardProps) {
  const navigate = useNavigate()
  const playerName = usePlayerStore((s) => s.dfPlayerName)
  const playerRating = usePlayerStore((s) => s.dfRating)
  const localB50 = usePlayerStore((s) => s.localB50)

  // Priority: localB50 totalRating → dfRating → unauthenticated
  const hasLocalData = localB50 && localB50.totalRating > 0
  const hasOnlineData = !!playerName
  const isLoggedIn = hasLocalData || hasOnlineData

  const displayRating = hasLocalData ? localB50!.totalRating : playerRating
  const displayName = hasLocalData
    ? playerName || '本地玩家'
    : playerName

  // Collapsed: compact icon view
  if (collapsed) {
    if (isLoggedIn) {
      return (
        <div
          className="flex justify-center py-3 border-b border-border"
          title={`${displayName} · Rating ${displayRating}`}
        >
          <span className="text-xs font-bold text-primary tabular-nums">
            {displayRating}
          </span>
        </div>
      )
    }
    return (
      <button
        onClick={() => navigate('/songs')}
        className="flex justify-center py-3 border-b border-border w-full cursor-pointer border-none bg-transparent
                   hover:bg-surface-light transition-colors"
        title="前往导入成绩"
      >
        <span className="text-sm">👤</span>
      </button>
    )
  }

  // Expanded: full card
  return (
    <div className="px-4 py-3 border-b border-border">
      {isLoggedIn ? (
        <div className="flex flex-col gap-0.5">
          <div className="text-sm font-medium text-text truncate">{displayName}</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-text-secondary">Rating</span>
            <span className="text-base font-bold text-primary tabular-nums">{displayRating}</span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => navigate('/songs')}
          className="w-full text-left cursor-pointer border-none bg-transparent p-0
                     hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">👤</span>
            <div>
              <div className="text-sm font-medium text-text">请登录</div>
              <div className="text-xs text-text-tertiary mt-0.5">前往导入成绩 →</div>
            </div>
          </div>
        </button>
      )}
    </div>
  )
}
