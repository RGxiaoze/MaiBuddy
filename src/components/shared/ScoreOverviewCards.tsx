// ============================================================
// ScoreOverviewCards — 成绩总览卡（Rating 进度 / 完成度 / 定数分布）
// 供成绩统计页顶部使用
// ============================================================

import { useMemo } from 'react'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { computeTheoreticalMaxBoth } from '@/utils/b50'
import { computeAchievementMetrics } from '@/utils/achievementMetrics'

export default function ScoreOverviewCards() {
  const { localB50 } = usePlayerStore()
  const { scores } = useScoreStore()
  const { songs } = useSongStore()

  const theoryMaxAll = useMemo(() =>
    songs.length > 0 ? computeTheoreticalMaxBoth(songs) : { sssPlusMax: 0, apMax: 0 },
    [songs])
  const theoryMax = theoryMaxAll.sssPlusMax

  const metrics = useMemo(() => {
    if (!localB50 || songs.length === 0) return null
    return computeAchievementMetrics(scores, localB50.totalRating, theoryMax)
  }, [localB50, scores, songs, theoryMax])

  if (!metrics || !localB50) return null

  const maxCount = Math.max(...metrics.levelDist.map(t => t.count), 1)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      {/* Card 1: Rating 进度 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-text-secondary mb-2 font-medium">Rating</p>
        <p className="text-2xl font-bold text-text tabular-nums">{localB50.totalRating.toFixed(0)}</p>
        <div className="w-full bg-bg-gray rounded-full h-2 mt-2">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(metrics.ratingProgress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-text-secondary mt-1 text-right tabular-nums">
          {metrics.ratingProgress.toFixed(1)}% / 理论 SSS+ {theoryMax}
          {metrics.apRatingBonus > 0 && (
            <span className="text-success ml-1">(AP 加成 +{metrics.apRatingBonus})</span>
          )}
        </p>
      </div>

      {/* Card 2: 完成度 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-text-secondary mb-2 font-medium">完成度</p>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">AP</span>
            <span className="text-sm font-semibold text-success tabular-nums">
              {metrics.apCount} 首
              <span className="text-xs text-text-tertiary ml-1">(+{metrics.apRatingBonus} Rating)</span>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">SSS+</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: '#FFD700' }}>{metrics.sssPlusCount} 首</span>
          </div>
        </div>
      </div>

      {/* Card 3: 定数分布 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-text-secondary mb-2 font-medium">定数分布</p>
        <div className="space-y-1">
          {metrics.levelDist.map(tier => (
            <div key={tier.range} className="flex items-center gap-2 text-sm">
              <span className="w-20 text-text-secondary tabular-nums">{tier.range}</span>
              <div className="flex-1 bg-bg-gray rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-accent transition-all"
                  style={{ width: `${(tier.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-text font-medium w-16 text-right">
                {tier.count > 0 ? `${tier.avgAch.toFixed(1)}%` : '—'}
              </span>
              <span className="tabular-nums text-text-secondary text-xs w-10 text-right">
                {tier.count > 0 ? `${tier.count}首` : '0'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
