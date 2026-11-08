// ============================================================
// Recommend — 个性化推荐页（冲分榜 / 越级榜）
// 社区用语文案：冲分、水分曲、越级、吃分
// ============================================================

import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TrendingUp, Rocket, Sparkles } from 'lucide-react'
import { useSongStore } from '@/store/songStore'
import { useScoreStore } from '@/store/scoreStore'
import { usePlayerStore } from '@/store/playerStore'
import { usePushSuggestions } from '@/hooks/usePushSuggestions'
import { getChartStats } from '@/services/statsService'
import RecommendCard from '@/components/shared/RecommendCard'
import { truncatePercent } from '@/utils/format'
import type { PushSuggestion } from '@/utils/pushSuggestions'

type TabKey = 'push' | 'advance'

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

  // ---- 越级榜：未游玩谱面，定数 = 玩家水平 +0.5 ~ +1.0 ----
  const advanceList = useMemo(() => {
    if (!playerLevel || songs.length === 0) return []

    // 已游玩谱面集合
    const played = new Set<string>()
    for (const s of scores) played.add(`${s.songId}-${s.levelIndex}`)
    for (const s of dfBest35) played.add(`${s.songId}-${s.levelIndex}`)
    for (const s of dfBest15) played.add(`${s.songId}-${s.levelIndex}`)

    const lo = playerLevel + 0.5
    const hi = playerLevel + 1.0

    const items: Array<{
      songId: number; title: string; levelIndex: number; levelValue: number
      sssPlusRate?: number; water: number
    }> = []

    for (const song of songs) {
      if (!song?.difficulties) continue
      const allDiffs = [...(song.difficulties.standard || []), ...(song.difficulties.dx || [])]
      for (const diff of allDiffs) {
        if (!diff || diff.levelValue <= 0) continue
        if (diff.levelValue < lo || diff.levelValue > hi) continue
        // 15 级谱面只有 3 首且都是顶格难度，不适合作为「越级」练习目标
        if (diff.levelValue >= 15) continue
        if (played.has(`${song.id}-${diff.levelIndex}`)) continue
        const stats = getChartStats(song.id, diff.level)
        const sssPlusRate = stats?.sssPlusRate
        // 水分度：定数低 + SSS+ 率低 → 更水（好推）
        const water = (hi - diff.levelValue) / (hi - lo) * 0.5 + (sssPlusRate !== undefined ? (1 - sssPlusRate) * 0.5 : 0.3)
        items.push({
          songId: song.id, title: song.title, levelIndex: diff.levelIndex,
          levelValue: diff.levelValue, sssPlusRate, water,
        })
      }
    }

    items.sort((a, b) => b.water - a.water)
    return items.slice(0, 20)
  }, [playerLevel, songs, scores, dfBest35, dfBest15])

  const hasB50 = !!effectiveB50

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-base font-semibold text-text m-0">推荐</h2>
      </div>
      <p className="text-xs text-text-secondary mb-4">
        基于你的成绩与能力画像，推荐值得冲分、值得越级挑战的谱面。
      </p>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'push'} onClick={() => setTab('push')} icon={<TrendingUp size={14} />} label="冲分榜" />
        <TabButton active={tab === 'advance'} onClick={() => setTab('advance')} icon={<Rocket size={14} />} label="越级榜" />
      </div>

      {!hasB50 ? (
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
        <AdvanceTab items={advanceList} playerLevel={playerLevel} />
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

// ---- 越级榜 ----

function AdvanceTab({ items, playerLevel }: { items: Array<{
  songId: number; title: string; levelIndex: number; levelValue: number
  sssPlusRate?: number
}>; playerLevel: number | null }) {
  if (playerLevel === null || items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <p className="text-xs text-text-secondary m-0">
          {playerLevel === null
            ? '暂无玩家水平数据，导入成绩后生成越级推荐。'
            : '当前定数区间暂无未游玩的合适谱面，试试其他难度或继续冲分！'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-secondary">
        当前水平约 <strong className="text-text">{playerLevel.toFixed(1)}</strong>，推荐
        <strong className="text-text"> +0.5 ~ +1.0</strong> 越级谱面（未游玩，水分优先）。
      </p>
      {items.map(it => (
        <RecommendCard
          key={`${it.songId}-${it.levelIndex}`}
          songId={it.songId}
          title={it.title}
          levelIndex={it.levelIndex}
          levelValue={it.levelValue}
          reason={`适合越级练习（当前 ${playerLevel.toFixed(1)} → ${it.levelValue.toFixed(1)}），全服达成率尚可，值得一试`}
          sssPlusRate={it.sssPlusRate}
          tag="越级"
          tagColor="#D97706"
        />
      ))}
    </div>
  )
}
