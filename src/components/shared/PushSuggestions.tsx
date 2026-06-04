// ============================================================
// Push suggestions panel — B50 floor replacement recommendations
// ============================================================

import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { computePushSuggestions, computeTheoreticalMaxRating, type PushSuggestion } from '@/utils/rating'
import { loadStats, getChartStats, isStatsLoaded } from '@/services/statsService'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { ExternalLink } from 'lucide-react'
import { LEVEL_LABELS } from '@/data/constants'
import type { LevelIndex } from '@/types'

const POOL_LABELS: Record<string, string> = {
  b35: '旧版本 Best 35',
  b15: '新版本 Best 15',
}

const DIFF_LABELS: Record<string, { label: string; color: string }> = {
  easy:   { label: '轻松', color: '#22C55E' },
  medium: { label: '适中', color: '#D97706' },
  hard:   { label: '挑战', color: '#DC2626' },
}

export default function PushSuggestions({ theoreticalMax = 0 }: { theoreticalMax?: number }) {
  const { localB50 } = usePlayerStore()
  const { scores } = useScoreStore()
  const { songs } = useSongStore()

  const [showAll, setShowAll] = useState(false)
  const [statsReady, setStatsReady] = useState(isStatsLoaded())

  // Compute theoretical max from songs if not provided by parent
  const theoryMax = useMemo(() => {
    if (theoreticalMax > 0) return theoreticalMax
    if (songs.length === 0) return 0
    return computeTheoreticalMaxRating(songs)
  }, [theoreticalMax, songs])

  // Load chart stats for difficulty classification
  useEffect(() => {
    if (!statsReady) {
      loadStats().then(() => setStatsReady(true)).catch(() => {})
    }
  }, [statsReady])

  const suggestions = useMemo(() => {
    if (!localB50 || songs.length === 0) return null

    // Build song map
    const songMap = new Map(songs.map(s => [s.id, s]))

    return computePushSuggestions(scores, songMap, localB50, getChartStats)
  }, [localB50, scores, songs, statsReady])

  // Empty state: no B50 data
  if (!localB50) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 mt-4">
        <h3 className="text-sm font-semibold text-text mb-1">📈 推分建议</h3>
        <p className="text-xs text-text-secondary">
          暂无 B50 数据，导入成绩后自动生成推分建议。
        </p>
      </div>
    )
  }

  // Empty state: no suggestions
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 mt-4">
        <h3 className="text-sm font-semibold text-text mb-1">📈 推分建议</h3>
        <p className="text-xs text-text-secondary">
          暂无推分建议。B50 地板分已接近理论最高值
          {theoryMax > 0 ? ` (${theoryMax})` : ''}，继续保持！
        </p>
      </div>
    )
  }

  const displayed = showAll ? suggestions : suggestions.slice(0, 5)

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text m-0">
          📈 推分建议 ({suggestions.length})
        </h3>
        {localB50 && theoryMax > 0 && (
          <span className="text-xs text-text-secondary">
            当前 {localB50.totalRating} / 理论最高 {theoryMax}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-secondary border-b border-border/50">
              <th className="text-left py-1.5 pr-2 font-medium w-8">#</th>
              <th className="text-left py-1.5 pr-2 font-medium">曲目</th>
              <th className="text-center py-1.5 px-1 font-medium w-12">定数</th>
              <th className="text-right py-1.5 px-1 font-medium w-16">当前</th>
              <th className="text-right py-1.5 px-1 font-medium w-16">目标</th>
              <th className="text-right py-1.5 px-1 font-medium w-12">增益</th>
              <th className="text-center py-1.5 px-1 font-medium w-10">难度</th>
              <th className="text-left py-1.5 pl-2 font-medium w-28">成绩池</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, i) => (
              <PushRow key={`${item.songId}-${item.levelIndex}`} item={item} index={i + 1} />
            ))}
          </tbody>
        </table>
      </div>

      {suggestions.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-primary hover:underline cursor-pointer w-full text-center"
        >
          {showAll ? '收起，只显示前 5 条' : `查看全部 ${suggestions.length} 条建议`}
        </button>
      )}

      <p className="text-xs text-text-tertiary mt-3 pt-3 border-t border-border/30">
        * 目标 Rating 基于理论最高达成率 (100.5%) 估算，实际增益取决于你能打出的达成率。
      </p>
    </div>
  )
}

/** Single suggestion row — React.memo for performance */
function PushRow({ item, index }: { item: PushSuggestion; index: number }) {
  const diff = DIFF_LABELS[item.difficulty] || DIFF_LABELS.medium

  return (
    <tr className="border-b border-border/20 hover:bg-bg-gray/50">
      <td className="py-1.5 pr-2 text-text-tertiary tabular-nums">{index}</td>
      <td className="py-1.5 pr-2 font-medium truncate max-w-40">
        <Link to={"/songs/" + item.songId} className="hover:text-primary hover:underline">
          {item.songTitle}
        </Link>
        <span className="text-text-tertiary ml-1">
          {LEVEL_LABELS[item.levelIndex as LevelIndex]}
        </span>
        <a
          href={bilibiliSearchUrl(item.songTitle, item.level)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center ml-1 text-text-tertiary hover:text-primary transition-colors"
          title="在 B站搜索此曲目"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      </td>
      <td className="py-1.5 px-1 text-center tabular-nums font-medium">{item.levelValue.toFixed(1)}</td>
      <td className="py-1.5 px-1 text-right tabular-nums text-text-secondary">
        {item.currentAchievements.toFixed(4)}%
      </td>
      <td className="py-1.5 px-1 text-right tabular-nums font-semibold">
        {item.targetAchievements.toFixed(4)}%
      </td>
      <td className="py-1.5 px-1 text-right tabular-nums text-primary font-medium">
        {item.ratingGain > 0 ? `+${item.ratingGain}` : '—'}
      </td>
      <td className="py-1.5 px-1 text-center">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: diff.color + '20', color: diff.color }}
        >
          {diff.label}
        </span>
      </td>
      <td className="py-1.5 pl-2 text-text-secondary text-[10px]">
        {POOL_LABELS[item.pool]}
      </td>
    </tr>
  )
}
