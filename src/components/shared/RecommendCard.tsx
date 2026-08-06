// ============================================================
// RecommendCard — 推荐卡片（社区用语文案）
// ============================================================

import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { LEVEL_LABELS, LEVEL_INDEX_MAP } from '@/data/constants'
import type { LevelIndex } from '@/types'

/** 水分度：由定数 × (1 - 全服SSS+率) 映射为 1-5 星 */
export function waterScore(levelValue: number, sssPlusRate?: number): number {
  if (sssPlusRate === undefined || sssPlusRate === null) {
    // 无全服数据时按定数估算：低定数更"水"
    return Math.max(1, Math.min(5, Math.round((15 - levelValue) / 2)))
  }
  // SSS+ 率越高 → 水分越低（难吃分）
  const w = (1 - sssPlusRate) * 5
  return Math.max(1, Math.min(5, Math.round(w)))
}

export interface RecommendCardProps {
  songId: number
  title: string
  levelIndex: number
  levelValue: number
  /** 推荐理由（社区语） */
  reason: string
  /** 全服 SSS+ 率（0-1），缺省为 undefined */
  sssPlusRate?: number
  /** 副标签（如「水分曲」「越级」「练短板」） */
  tag?: string
  tagColor?: string
  /** 主数值（如 +0.8 分） */
  gainText?: string
}

export default function RecommendCard({
  songId, title, levelIndex, levelValue, reason, sssPlusRate, tag, tagColor = '#5BA4CF', gainText,
}: RecommendCardProps) {
  const stars = waterScore(levelValue, sssPlusRate)
  const levelMeta = LEVEL_INDEX_MAP[levelIndex as LevelIndex]

  return (
    <div className="rounded-lg p-3 border border-border bg-bg-surface hover:bg-surface-light transition-colors">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link to={`/songs/${songId}`} className="font-medium text-sm truncate hover:text-primary hover:underline min-w-0">
            {title}
          </Link>
          {levelMeta && (
            <span className="px-1 py-0.5 rounded text-[9px] font-medium text-white shrink-0" style={{ backgroundColor: levelMeta.color }}>
              {LEVEL_LABELS[levelIndex as LevelIndex]}
            </span>
          )}
          <a
            href={bilibiliSearchUrl(title, LEVEL_LABELS[levelIndex as LevelIndex])}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-text-secondary hover:text-primary shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="在 B 站搜索手元"
          >
            <ExternalLink size={11} />
          </a>
        </div>
        <span className="text-sm font-semibold tabular-nums shrink-0">{levelValue.toFixed(1)}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {tag && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: tagColor + '20', color: tagColor }}>
            {tag}
          </span>
        )}
        {gainText && <span className="text-success font-medium tabular-nums">{gainText}</span>}
      </div>

      <p className="mt-1.5 text-xs text-text-secondary">{reason}</p>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[10px] text-text-secondary">
          水分度{' '}
          <span className="text-amber-500">
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </span>
        </span>
        {sssPlusRate !== undefined && (
          <span className="text-[10px] text-text-secondary tabular-nums">
            全服SSS+ {(sssPlusRate * 100).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}
