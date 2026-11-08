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
import { buildExplorePool, buildPreferenceProfile, DEFAULT_MIN_VOTES, DEFAULT_LIMIT, type ExploreItem } from '@/utils/explore'
import { getBlockedSongIds, blockSong, clearBlockedSongs } from '@/db/database'
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

  // 当前数据源认定的「新曲」版本 —— 版本一旦滞后，玩家能一眼看出
  const newVersionInfo = useMemo(() => {
    const newSongs = songs.filter(s => s.isNew)
    if (newSongs.length === 0) return null
    return { version: newSongs[0].from, count: newSongs.length }
  }, [songs])

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
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set())
  const [blockedIds, setBlockedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    getBlockedSongIds().then(setBlockedIds)
  }, [])

  const handleBlock = (songId: number) => {
    blockSong(songId)
    setBlockedIds(prev => new Set(prev).add(songId))
  }

  const handleRestoreBlocked = () => {
    clearBlockedSongs()
    setBlockedIds(new Set())
    setSeenKeys(new Set())
  }

  // 难度范围：上限 = B15 最高定数 + 0.5（不推打不动的）
  //           下限 = B35 中位数 − 1.0（不推太简单的）
  const levelRange = useMemo(() => {
    const b15 = effectiveB50?.best15 ?? []
    const b35 = effectiveB50?.best35 ?? []
    if (b15.length === 0 && b35.length === 0) return {}
    const maxLevel = b15.length > 0
      ? Math.max(...b15.map(e => e.levelValue)) + 0.5
      : undefined
    let minLevel: number | undefined
    if (b35.length > 0) {
      const sorted = b35.map(e => e.levelValue).sort((a, b) => a - b)
      minLevel = sorted[Math.floor(sorted.length / 2)] - 1.0
    }
    return { minLevel, maxLevel }
  }, [effectiveB50])

  const preference = useMemo(
    () => buildPreferenceProfile(songs, playedKeys),
    [songs, playedKeys],
  )

  const exploreList = useMemo(() => {
    if (voteState !== 'ready' || songs.length === 0) return []
    const votes = getAllVoteStats()
    return buildExplorePool(songs, playedKeys, votes, {
      minVotes: DEFAULT_MIN_VOTES,
      limit: DEFAULT_LIMIT,
      ...(exploreWide ? {} : levelRange),
      seenKeys,
      blockedSongIds: blockedIds,
      preference,
    })
  }, [voteState, songs, playedKeys, exploreWide, levelRange, seenKeys, blockedIds, preference])

  const refreshExplore = () => {
    setSeenKeys(prev => {
      const next = new Set(prev)
      for (const it of exploreList) next.add(`${it.songId}-${it.levelIndex}`)
      return next
    })
  }

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
        <PushTab items={pushList} newVersion={newVersionInfo} />
      ) : (
        <ExploreTab
          items={exploreList}
          state={voteState}
          playerLevel={playerLevel}
          wide={exploreWide}
          onWiden={() => setExploreWide(true)}
          onRefresh={refreshExplore}
          onBlock={handleBlock}
          blockedCount={blockedIds.size}
          onRestore={handleRestoreBlocked}
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

/**
 * 根据「实际收益最大的目标档」生成推荐理由。
 * 目标可能被「现实目标」截断（如 14.9 定数只能期望 100.0%），
 * 写死 SSS+ 会出现「文案说推 SSS+、但 +9 分其实是推 SSS 得来的」。
 */
function describePushReason(s: PushSuggestion, maxGain: number): string {
  const cur = truncatePercent(s.currentAchievements)
  if (s.apGain && s.apGain.ratingGain >= maxGain) {
    return `当前 ${cur}%，打到 AP 可额外 +1 Rating`
  }
  const best = s.gains.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
  const label = best.targetAch >= 100.5 ? 'SSS+' : best.targetAch >= 100 ? 'SSS' : 'SS+'
  const prefix = s.precision === 'estimated' ? '当前达成率约' : '当前'
  return `${prefix} ${cur}%，推到 ${label} 可吃分`
}

// ---- 推分 ----

/** 难度排序权重：容易的排前面 */
const DIFFICULTY_RANK: Record<'easy' | 'medium' | 'hard', number> = {
  easy: 0, medium: 1, hard: 2,
}

function PushTab({ items, newVersion }: {
  items: Array<{ s: PushSuggestion; maxGain: number }>
  newVersion: { version: string; count: number } | null
}) {
  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">暂无推分建议——B50 地板分已接近理论 SSS+ 天花板，继续保持！</p>
      </div>
    )
  }

  const b15 = items.filter(i => i.s.pool !== 'b35')
  const b35 = items.filter(i => i.s.pool === 'b35')

  return (
    <div className="space-y-5">
      <p className="text-xs text-text-secondary">
        同池内按难度从易到难排列，较难吃分的折叠在组内。
        {newVersion && (
          <span className="text-text-tertiary">
            {' '}新曲池：{newVersion.version.replace('maimai でらっくす ', '')} · {newVersion.count} 首
          </span>
        )}
      </p>

      <PushGroup title="B15 池（新版本）" hint="池子小，每个版本理论上都能推" items={b15} tagColor="#B8A0E8" />
      <PushGroup title="B35 池（旧版本）" hint="老玩家的可推空间往往已被历史成绩占满" items={b35} tagColor="#5BA4CF" />
    </div>
  )
}

function PushGroup({ title, hint, items, tagColor }: {
  title: string
  hint: string
  items: Array<{ s: PushSuggestion; maxGain: number }>
  tagColor: string
}) {
  const [showChallenging, setShowChallenging] = useState(false)

  if (items.length === 0) return null

  // 难度优先，其次按收益降序
  const sorted = [...items].sort((a, b) => {
    const byDiff = DIFFICULTY_RANK[a.s.difficulty] - DIFFICULTY_RANK[b.s.difficulty]
    return byDiff !== 0 ? byDiff : b.maxGain - a.maxGain
  })

  const approachable = sorted.filter(i => i.s.difficulty !== 'hard')
  const challenging = sorted.filter(i => i.s.difficulty === 'hard')
  const mainList = approachable.length > 0 ? approachable : challenging
  const foldedList = approachable.length > 0 ? challenging : []

  const renderCard = ({ s, maxGain }: { s: PushSuggestion; maxGain: number }) => (
    <RecommendCard
      key={`${s.songId}-${s.levelIndex}`}
      songId={s.songId}
      title={s.songTitle}
      levelIndex={s.levelIndex}
      levelValue={s.levelValue}
      reason={describePushReason(s, maxGain)}
      tag={s.pool === 'b35' ? 'B35 池' : 'B15 池'}
      tagColor={tagColor}
      difficulty={s.difficulty}
      gainText={maxGain > 0 ? `+${maxGain.toFixed(1)} 分` : undefined}
    />
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-text">{title}</span>
        <span className="text-[10px] text-text-tertiary tabular-nums">{items.length} 条</span>
      </div>
      <p className="text-[11px] text-text-tertiary mb-2">{hint}</p>

      <div className="space-y-2">
        {mainList.map(renderCard)}
      </div>

      {foldedList.length > 0 && (
        <>
          <button
            onClick={() => setShowChallenging(v => !v)}
            className="w-full mt-2 flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-medium text-text-secondary bg-surface border border-border hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            {showChallenging ? '收起' : `展开 ${foldedList.length} 条更有挑战的推荐`}
            <span>{showChallenging ? '▾' : '▸'}</span>
          </button>
          {showChallenging && (
            <div className="space-y-2 mt-2">
              {foldedList.map(renderCard)}
            </div>
          )}
        </>
      )}
    </div>
  )
}


// ---- 探索 ----

function ExploreTab({ items, state, playerLevel, wide, onWiden, onRefresh, onBlock, blockedCount, onRestore }: {
  items: ExploreItem[]
  state: 'idle' | 'ready' | 'failed'
  playerLevel: number | null
  wide: boolean
  onWiden: () => void
  onRefresh: () => void
  onBlock: (songId: number) => void
  blockedCount: number
  onRestore: () => void
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
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-text-secondary flex-1 leading-snug">
          都是你<strong className="text-text">没打过</strong>的谱面，
          {wide ? '覆盖全部难度' : '难度适合当前水平'}，按社区投票喜好随机挑选。
        </p>
        <button
          onClick={onRefresh}
          className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border text-text-secondary bg-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          换一批
        </button>
      </div>
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
          showExternalLink={false}
          onBlock={() => onBlock(it.songId)}
        />
      ))}

      {blockedCount > 0 && (
        <div className="pt-2 text-center">
          <button
            onClick={onRestore}
            className="text-[11px] text-text-tertiary hover:text-primary cursor-pointer border-none bg-transparent p-0 transition-colors"
          >
            已隐藏 {blockedCount} 首 · 恢复
          </button>
        </div>
      )}
    </div>
  )
}
