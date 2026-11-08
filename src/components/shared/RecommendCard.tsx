// ============================================================
// RecommendCard — 推荐卡片（左曲绘 + 右信息，移动端优先）
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, X } from 'lucide-react'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { LEVEL_LABELS, LEVEL_INDEX_MAP, getCoverUrl } from '@/data/constants'
import type { LevelIndex } from '@/types'

export interface RecommendCardProps {
  songId: number
  title: string
  levelIndex: number
  levelValue: number
  /** 推荐理由（社区语） */
  reason: string
  /** 副标签（如「B15 池」「探索」） */
  tag?: string
  tagColor?: string
  /** 主数值（如 +7.0 分） */
  gainText?: string
  /** 是否显示 B 站搜索外链（探索卡片不需要） */
  showExternalLink?: boolean
  /** 加入「不感兴趣」，不传则不显示该按钮 */
  onBlock?: () => void
}

export default function RecommendCard({
  songId, title, levelIndex, levelValue, reason, tag, tagColor = '#5BA4CF', gainText, showExternalLink = true, onBlock,
}: RecommendCardProps) {
  const [imgError, setImgError] = useState(false)
  const levelMeta = LEVEL_INDEX_MAP[levelIndex as LevelIndex]

  return (
    <div className="rounded-lg p-3 border border-border bg-bg-surface hover:bg-surface-light transition-colors">
      <div className="flex gap-3">
        {/* 曲绘：与曲目列表同源，失败降级为难度色 + 首字 */}
        <Link to={`/songs/${songId}`} className="shrink-0">
          <div
            className="w-14 h-14 rounded-md overflow-hidden flex items-center justify-center bg-bg-gray"
            style={{ backgroundColor: imgError ? `${levelMeta.color}22` : undefined }}
          >
            {imgError ? (
              <span className="text-lg font-bold" style={{ color: levelMeta.color }}>{title.charAt(0)}</span>
            ) : (
              <img
                src={getCoverUrl(songId)}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </Link>

        {/* 信息区 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link to={`/songs/${songId}`} className="font-medium text-sm truncate hover:text-primary hover:underline min-w-0">
                {title}
              </Link>
              {levelMeta && (
                <span className="px-1 py-0.5 rounded text-[9px] font-medium shrink-0" style={{ backgroundColor: levelMeta.badgeBg, color: levelMeta.badgeFg }}>
                  {LEVEL_LABELS[levelIndex as LevelIndex]}
                </span>
              )}
              {showExternalLink && (
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
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm font-semibold tabular-nums">{levelValue.toFixed(1)}</span>
              {onBlock && (
                <button
                  onClick={onBlock}
                  title="不感兴趣"
                  aria-label="不感兴趣"
                  className="text-text-tertiary hover:text-error cursor-pointer border-none bg-transparent p-0.5 leading-none transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2 text-xs min-w-0">
            {tag && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0" style={{ backgroundColor: tagColor + '20', color: tagColor }}>
                {tag}
              </span>
            )}
            {gainText && <span className="text-sm font-semibold text-success tabular-nums truncate">{gainText}</span>}
          </div>

          <p className="mt-1 text-xs text-text-secondary leading-snug line-clamp-2">{reason}</p>
        </div>
      </div>
    </div>
  )
}
