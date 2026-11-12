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

/** 探索梯度：先只看社区投票前 50%，挑不出足够的未玩谱面时放宽到 70% */
const EXPLORE_TOP_PERCENT = 50
const EXPLORE_TOP_PERCENT_WIDE = 70
/** 冲分榜最多展示多少条 */
const PUSH_LIST_LIMIT = 20

import { getBlockedSongIds, blockSong, clearBlockedSongs } from '@/db/database'
import { getCoverUrl } from '@/data/constants'
import { useBackgroundStore } from '@/store/backgroundStore'
import RecommendCard from '@/components/shared/RecommendCard'
import ExploreCard from '@/components/shared/ExploreCard'
import type { PushSuggestion } from '@/utils/pushSuggestions'

type TabKey = 'push' | 'explore'

export default function Recommend() {
  const [tab, setTab] = useState<TabKey>('push')
  const { songs } = useSongStore()
  const { scores } = useScoreStore()
  const { dfBest35, dfBest15 } = usePlayerStore()
  const { suggestions, effectiveB50 } = usePushSuggestions()

  // ---- 冲分榜：核心档优先，备选档（放宽目标后补出来的）只在后面占位 ----
  const pushList = useMemo(() => {
    if (!suggestions) return []
    const scored = suggestions.map(s => ({
      s,
      maxGain: Math.max(...s.gains.map(g => g.ratingGain), s.apGain?.ratingGain ?? 0),
    }))
    scored.sort((a, b) => b.maxGain - a.maxGain)

    const core = scored.filter(i => (i.s.tier ?? 1) === 1)
    const extended = scored.filter(i => (i.s.tier ?? 1) > 1)
    const head = core.slice(0, PUSH_LIST_LIMIT)
    if (head.length >= PUSH_LIST_LIMIT) return head
    return [...head, ...extended.slice(0, PUSH_LIST_LIMIT - head.length)]
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

  // 难度范围：上限锚在 B35 众数（舒适区），下限 = B35 中位数 − 1.0。
  // 此前上限取 B15 最高定数 + 0.5 —— 一条侥幸打出的高分就会把整片探索池
  // 拉到那个强度，测试玩家反馈「匹配的曲目和自身水平不符」正是这个原因。
  const levelRange = useMemo(() => {
    const b35 = effectiveB50?.best35 ?? []
    if (b35.length === 0 && playerLevel == null) return {}
    const maxLevel = playerLevel != null ? playerLevel + 0.5 : undefined
    let minLevel: number | undefined
    if (b35.length > 0) {
      const sorted = b35.map(e => e.levelValue).sort((a, b) => a - b)
      minLevel = sorted[Math.floor(sorted.length / 2)] - 1.0
    }
    return { minLevel, maxLevel }
  }, [effectiveB50, playerLevel])

  const preference = useMemo(
    () => buildPreferenceProfile(songs, playedKeys),
    [songs, playedKeys],
  )

  // 严格排除已游玩：曾经把「3 个月没玩」的谱面放回池子，但页面上写的是
  // 「都是你没打过的」，测试玩家据此发现列表里混着自己打过的谱。
  const exploreList = useMemo(() => {
    if (voteState !== 'ready' || songs.length === 0) return []
    const votes = getAllVoteStats()
    const base = {
      minVotes: DEFAULT_MIN_VOTES,
      limit: DEFAULT_LIMIT,
      ...(exploreWide ? {} : levelRange),
      seenKeys,
      blockedSongIds: blockedIds,
      preference,
    }
    // 先只看社区投票前 50%；连这一档都挑不出足够的未玩谱面时才放宽到 70%
    const primary = buildExplorePool(songs, playedKeys, votes, {
      ...base,
      topPercent: EXPLORE_TOP_PERCENT,
    })
    if (primary.length >= DEFAULT_LIMIT) return primary
    return buildExplorePool(songs, playedKeys, votes, {
      ...base,
      topPercent: EXPLORE_TOP_PERCENT_WIDE,
    })
  }, [voteState, songs, playedKeys, exploreWide, levelRange, seenKeys, blockedIds, preference])

  const refreshExplore = () => {
    setSeenKeys(prev => {
      const next = new Set(prev)
      for (const it of exploreList) next.add(`${it.songId}-${it.levelIndex}`)
      return next
    })
  }

  // 注册本页背景：当前 Tab 第一张卡片的曲绘
  const setBgCover = useBackgroundStore((s) => s.setCover)
  const firstCoverSongId = tab === 'push' ? pushList[0]?.s.songId : exploreList[0]?.songId
  useEffect(() => {
    if (firstCoverSongId != null) setBgCover(getCoverUrl(firstCoverSongId))
  }, [firstCoverSongId, setBgCover])

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
          range={levelRange}
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
/**
 * 取「实际收益最大那一档」的当前值与目标达成率。
 * 目标可能被「现实目标」截断（如 14.9 定数只能期望 100.0%），
 * 因此不能用写死的 SSS+，必须按收益最大的那档取。
 */
function bestTargetProgress(s: PushSuggestion): { current: number; target: number } {
  const apGain = s.apGain?.ratingGain ?? -Infinity
  const bestGain = s.gains.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
  if (s.apGain && apGain >= bestGain.ratingGain) {
    return { current: s.currentAchievements, target: s.apGain.targetAch }
  }
  return { current: s.currentAchievements, target: bestGain.targetAch }
}

// ---- 推分 ----

/** 水分达到这个幅度才算「值得优先打」，低于它的折叠 */
const WATER_TAG_MIN = 0.3

const POOL_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'b35', label: '只看 B35' },
  { value: 'b15', label: '只看 B15' },
] as const

function PushTab({ items, newVersion }: {
  items: Array<{ s: PushSuggestion; maxGain: number }>
  newVersion: { version: string; count: number } | null
}) {
  // 有人只想推旧曲池，不想看新曲；也有人反过来。默认仍两组都给
  const [poolFilter, setPoolFilter] = useState<'all' | 'b35' | 'b15'>('all')

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">暂无推分建议——B50 地板分已接近理论 SSS+ 天花板，继续保持！</p>
      </div>
    )
  }

  // 核心档与备选档分开：备选是「目标更激进」的那批，单独放在末尾
  const core = items.filter(i => (i.s.tier ?? 1) === 1)
  const extended = items.filter(i => (i.s.tier ?? 1) > 1)
  const b15 = core.filter(i => i.s.pool !== 'b35')
  const b35 = core.filter(i => i.s.pool === 'b35')

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

      <div className="flex items-center gap-2">
        {POOL_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPoolFilter(value)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors cursor-pointer
              ${poolFilter === value
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'bg-surface text-text-secondary border-border hover:border-primary hover:text-primary'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {poolFilter !== 'b35' && <PushGroup title="B15 池（新版本）" items={b15} tagColor="#B8A0E8" defaultVisible={5} />}
      {poolFilter !== 'b15' && <PushGroup title="B35 池（旧版本）" items={b35} tagColor="#5BA4CF" defaultVisible={10} />}
      {extended.length > 0 && (
        <PushGroup
          title="更多备选（目标更激进）"
          items={extended}
          tagColor="#94A3B8"
          defaultVisible={5}
        />
      )}
    </div>
  )
}

function PushGroup({ title, items, tagColor, defaultVisible }: {
  title: string
  items: Array<{ s: PushSuggestion; maxGain: number }>
  tagColor: string
  /** 默认展开的条数，其余折叠在「展开全部」里 */
  defaultVisible: number
}) {
  const [showChallenging, setShowChallenging] = useState(false)
  const [showAll, setShowAll] = useState(false)

  if (items.length === 0) return null

  // 水分大的排前面（实际比标称容易 = 更好吃），同水分按收益降序
  const sorted = [...items].sort((a, b) => {
    const byWater = (b.s.waterLevel ?? 0) - (a.s.waterLevel ?? 0)
    return byWater !== 0 ? byWater : b.maxGain - a.maxGain
  })

  // 有明显水分的直接展示，没水分的折叠——玩家一眼看到的是「好啃的」
  const strong = sorted.filter(i => (i.s.waterLevel ?? 0) >= WATER_TAG_MIN)
  const weak = sorted.filter(i => (i.s.waterLevel ?? 0) < WATER_TAG_MIN)
  const mainList = strong.length > 0 ? strong : weak
  const foldedList = strong.length > 0 ? weak : []

  const renderCard = ({ s, maxGain }: { s: PushSuggestion; maxGain: number }) => (
    <RecommendCard
      key={`${s.songId}-${s.levelIndex}`}
      songId={s.songId}
      title={s.songTitle}
      levelIndex={s.levelIndex}
      levelValue={s.levelValue}
      gain={maxGain}
      progress={bestTargetProgress(s)}
      tag={s.pool === 'b35' ? 'B35 池' : 'B15 池'}
      tagColor={tagColor}
      waterLevel={s.waterLevel}
      sssPlusRate={s.sssPlusRate}
      yourBandAvg={s.yourBandAvg}
    />
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-text">{title}</span>
        <span className="text-[10px] text-text-tertiary tabular-nums">{items.length} 条</span>
      </div>

      <div className="space-y-2">
        {(showAll ? mainList : mainList.slice(0, defaultVisible)).map(renderCard)}
      </div>

      {mainList.length > defaultVisible && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full mt-2 flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-medium text-text-secondary bg-surface border border-border hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          {showAll ? '收起' : `展开全部 ${mainList.length} 条`}
          <span>{showAll ? '▾' : '▸'}</span>
        </button>
      )}

      {foldedList.length > 0 && (
        <>
          <button
            onClick={() => setShowChallenging(v => !v)}
            className="w-full mt-2 flex items-center justify-center gap-1 py-2 rounded-md text-[11px] font-medium text-text-secondary bg-surface border border-border hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            {showChallenging ? '收起' : `展开 ${foldedList.length} 条水分更少的推荐`}
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

function ExploreTab({ items, state, playerLevel, wide, range, onWiden, onRefresh, onBlock, blockedCount, onRestore }: {
  items: ExploreItem[]
  state: 'idle' | 'ready' | 'failed'
  playerLevel: number | null
  wide: boolean
  /** 当前生效的定数范围，用于如实描述筛选依据 */
  range: { minLevel?: number; maxLevel?: number }
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
          {wide
            ? '覆盖全部难度'
            : range.minLevel != null && range.maxLevel != null
              ? `定数 ${range.minLevel.toFixed(1)}~${range.maxLevel.toFixed(1)}，围绕你的舒适区`
              : '难度适合当前水平'}
          ，按社区投票喜好随机挑选。
        </p>
        <button
          onClick={onRefresh}
          className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border text-text-secondary bg-surface hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          换一批
        </button>
      </div>
      {items.map(it => (
        <ExploreCard
          key={`${it.songId}-${it.levelIndex}`}
          item={it}
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
