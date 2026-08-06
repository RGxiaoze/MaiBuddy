// ============================================================
// NextTargetPanel — B50 页内嵌「吃分推荐」卡片（Top 3）
// 社区用语：吃分、冲分
// ============================================================

import { Link } from 'react-router'
import { TrendingUp } from 'lucide-react'
import { usePushSuggestions } from '@/hooks/usePushSuggestions'
import { LEVEL_LABELS, LEVEL_INDEX_MAP } from '@/data/constants'
import type { LevelIndex } from '@/types'

export default function NextTargetPanel() {
  const { suggestions, effectiveB50 } = usePushSuggestions()

  if (!effectiveB50 || !suggestions || suggestions.length === 0) return null

  // Top 3 by max gain
  const top = [...suggestions]
    .map(s => ({ s, gain: Math.max(...s.gains.map(g => g.ratingGain), s.apGain?.ratingGain ?? 0) }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3)

  if (top.length === 0 || top[0].gain <= 0) return null

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text m-0">
          <TrendingUp size={16} className="inline mr-1" /> 吃分推荐
        </h3>
        <Link to="/recommend" className="text-xs text-primary hover:underline">
          查看全部 →
        </Link>
      </div>
      <ul className="space-y-2">
        {top.map(({ s, gain }) => {
          const levelMeta = LEVEL_INDEX_MAP[s.levelIndex as LevelIndex]
          return (
            <li key={`${s.songId}-${s.levelIndex}`} className="flex items-center gap-2 text-xs">
              <span className="text-text-secondary tabular-nums w-4 shrink-0">{top.indexOf({ s, gain }) + 1}.</span>
              <Link to={`/songs/${s.songId}`} className="font-medium truncate hover:text-primary hover:underline min-w-0 flex-1">
                {s.songTitle}
              </Link>
              {levelMeta && (
                <span className="px-1 py-0.5 rounded text-[9px] font-medium text-white shrink-0" style={{ backgroundColor: levelMeta.color }}>
                  {LEVEL_LABELS[s.levelIndex as LevelIndex]}
                </span>
              )}
              <span className="tabular-nums shrink-0">{s.levelValue.toFixed(1)}</span>
              <span className="text-success font-medium tabular-nums shrink-0">
                {gain > 0 ? `+${gain.toFixed(1)} 分` : '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
