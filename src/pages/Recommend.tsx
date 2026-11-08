// ============================================================
// Recommend — 个性化推荐页（冲分榜 / 越级榜）
// 社区用语文案：冲分、水分曲、越级、吃分
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TrendingUp, Compass, Sparkles } from 'lucide-react'
import { useSongStore } from '@/store/songStore'
import { useScoreStore } from '@/store/scoreStore'
import { usePlayerStore } from '@/store/playerStore'
import { usePushSuggestions } from '@/hooks/usePushSuggestions'
import { loadVoteStats, getAllVoteStats, isVoteStatsLoaded, isVoteStatsFailed } from '@/services/voteService'
import { buildExplorePool, DEFAULT_MIN_VOTES, type ExploreItem } from '@/utils/explore'
import RecommendCard from '@/components/shared/RecommendCard'
import { truncatePercent } from '@/utils/format'
import type { PushSuggestion } from '@/utils/pushSuggestions'

type TabKey = 'push' | 'explore'

export default function Recommend() {
  const [tab, setTab] = useState<TabKey>('push')
  const { songs } = useSongStore()
  const { scores } = useScoreStore()
  const { dfBest35, dfBest15 } = usePlayerStore()
  const { suggestions, effectiveB50 } = usePushSuggestions()

  // ---- 冲分榜：复用推分建议，取收益最高的前 20 ----
  const pushList = useMemo(() => {
    if (!suggestions) return []
    const scored = suggestions.map(s => ({
      s,
      maxGain: Math.max(...s.gains.map(g => g.ratingGain), s.apGain?.ratingGain ?? 0),
    }))
    scored.sort((a, b) => b.maxGain - a.maxGain)
    return scored.slice(0, 20)
  }, [suggestions])

  // ---- 玩家当前水平（B35 定数众数）----
  const playerLevel = useMemo(() => {
    const entries = effectiveB50?.best35 ?? []
    if (entries.length === 0) return null
    const counts = new Map<number, number>()
    for (const e of entries) counts.set(e.levelValue, (counts.get(e.levelValue) ?? 0) + 1)
    let best = entries[0].levelValue, bestCount = 0
    for (const [lv, c] of counts) if (c > bestCount) { best = lv; bestCount = c }
    return best
  }, [effectiveB50])

  // ---- 探索：社区偏好（投票箱）+ 未游玩 + 难度适配 ----
  const [voteState, setVoteState] = useState<'idle' | 'ready' | 'failed'>('idle')
  useEffect(() => {
    let alive = true
    loadVoteStats().then(() => {
      if (!alive) return
      setVoteState(isVoteStatsLoaded() ? 'ready' : isVoteStatsFailed() ? 'failed' : 'idle')
    })
    return () => { alive = false }
  }, [])

  // 已游玩谱面：本地成绩 + 在线查分（有则合并）
  const playedKeys = useMemo(() => {
    const set = new Set<string>()
    for (const s of scores) set.add(`${s.songId}-${s.levelIndex}`)
    for (const s of dfBest35) set.add(`${s.songId}-${s.levelIndex}`)
    for (const s of dfBest15) set.add(`${s.songId}-${s.levelIndex}`)
    return set
  }, [scores, dfBest35, dfBest15])

  const [exploreWide, setExploreWide] = useState(false)

  const exploreList = useMemo(() => {
    if (voteState !== 'ready' || songs.length === 0) return []
    const votes = getAllVoteStats()
    // 有水平数据且未放宽时收窄到 ±0.5；否则全难度按社区胜率排
    const band = playerLevel != null && !exploreWide
      ? { minLevel: playerLevel - 0.5, maxLevel: playerLevel + 0.5 }
      : {}
    return buildExplorePool(songs, playedKeys, votes, {
      minVotes: DEFAULT_MIN_VOTES, limit: 20, ...band,
    })
  }, [voteState, songs, playedKeys, playerLevel, exploreWide])

  const hasB50 = !!effectiveB50

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-text m-0">推荐</h2>
      </div>
      <p className="text-xs text-text-secondary mb-4">
        基于你的成绩与能力画像，推荐值得冲分的谱面，或探索还没打过的作品。
      </p>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'push'} onClick={() => setTab('push')} icon={<TrendingUp size={14} />} label="推分" />
        <TabButton active={tab === 'explore'} onClick={() => setTab('explore')} icon={<Compass size={14} />} label="探索" />
      </div>

      {tab === 'push' && !hasB50 ? (
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-text m-0">暂无成绩数据</h3>
          <p className="text-xs text-text-secondary mt-1">
            导入成绩或查询 Diving-Fish 后自动生成推荐。
            前往<Link to="/songs" className="text-primary hover:underline font-medium">曲目检索页</Link>导入完整成绩。
          </p>
        </div>
      ) : tab === 'push' ? (
        <PushTab items={pushList} />
      ) : (
        <ExploreTab
          items={exploreList}
          state={voteState}
          playerLevel={playerLevel}
          wide={exploreWide}
          onWiden={() => setExploreWide(true)}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer border transition-colors
        ${active
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-surface border-border text-text-secondary hover:bg-surface-light'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ---- 冲分榜 ----

function PushTab({ items }: { items: Array<{ s: PushSuggestion; maxGain: number }> }) {
  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">暂无冲分推荐——B50 地板分已接近理论 SSS+ 天花板，继续保持！</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        按推分收益排序，优先吃分率高的水分曲。
      </p>
      {items.map(({ s, maxGain }) => (
        <RecommendCard
          key={`${s.songId}-${s.levelIndex}`}
          songId={s.songId}
          title={s.songTitle}
          levelIndex={s.levelIndex}
          levelValue={s.levelValue}
          reason={s.precision === 'estimated'
            ? `当前达成率约 ${truncatePercent(s.currentAchievements)}%，推到 SSS 即可吃分`
            : `当前 ${truncatePercent(s.currentAchievements)}%，推到 SSS+ 稳稳收分`}
          sssPlusRate={s.sssPlusRate}
          tag={s.pool === 'b35' ? 'B35 池' : 'B15 池'}
          tagColor={s.pool === 'b35' ? '#5BA4CF' : '#B8A0E8'}
          gainText={maxGain > 0 ? `+${maxGain.toFixed(1)} 分` : undefined}
        />
      ))}
    </div>
  )
}

// ---- 探索 ----

function ExploreTab({ items, state, playerLevel, wide, onWiden }: {
  items: ExploreItem[]
  state: 'idle' | 'ready' | 'failed'
  playerLevel: number | null
  wide: boolean
  onWiden: () => void
}) {
  if (state === 'failed') {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">
          社区偏好数据暂不可用，探索功能稍后再试。
        </p>
      </div>
    )
  }

  if (state === 'idle') {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">正在获取社区偏好数据…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">
          {playerLevel != null && !wide
            ? '这个难度区间里你几乎都打过了。'
            : '暂无可探索的谱面。'}
        </p>
        {playerLevel != null && !wide && (
          <button
            onClick={onWiden}
            className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white border-none cursor-pointer hover:bg-primary-dark transition-colors"
          >
            显示全部难度
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        都是你<strong className="text-text">没打过</strong>的谱面
        {playerLevel != null && !wide && (
          <>，难度在 <strong className="text-text">{(playerLevel - 0.5).toFixed(1)} ~ {(playerLevel + 0.5).toFixed(1)}</strong> 之间</>
        )}
        ，按社区投票喜好排序。
      </p>
      {items.map(it => (
        <RecommendCard
          key={`${it.songId}-${it.levelIndex}`}
          songId={it.songId}
          title={it.title}
          levelIndex={it.levelIndex}
          levelValue={it.levelValue}
          reason={`社区胜率 ${(it.winRate * 100).toFixed(1)}% · ${it.totalVote.toLocaleString()} 人投过${
            it.noteDesigner && it.noteDesigner !== '未知' ? ` · 谱师 ${it.noteDesigner}` : ''
          }`}
          tag="探索"
          tagColor="#5BA4CF"
          showWater={false}
        />
      ))}
    </div>
  )
}
