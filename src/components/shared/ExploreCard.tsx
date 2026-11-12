// ============================================================
// ExploreCard — 探索卡片
//
// 展示「能认出是哪首歌」的基本信息（版本 / 分类 / 定数 / BPM），
// 外加推荐难度的色块 —— 探索推荐的是某个具体难度，
// 不标出来玩家会误以为整首都推荐。
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { getCoverUrl, LEVEL_INDEX_MAP, LEVEL_LABELS } from '@/data/constants'
import type { ExploreItem } from '@/utils/explore'
import type { LevelIndex } from '@/types'

interface ExploreCardProps {
  item: ExploreItem
  /** 不感兴趣 */
  onBlock?: () => void
}

export default function ExploreCard({ item, onBlock }: ExploreCardProps) {
  const [imgError, setImgError] = useState(false)
  // 本地 96px 缩略图优先，缺图时回退落雪原图
  const [imgSrc, setImgSrc] = useState(() => getCoverUrl(item.songId, 'thumb'))
  const { songId, title, levelIndex, level, levelValue, genre, from, bpm } = item
  const levelMeta = LEVEL_INDEX_MAP[levelIndex as LevelIndex]

  const version = (from || '').replace('maimai でらっくす ', '')
  const meta = [version, genre, levelValue > 0 ? levelValue.toFixed(1) : '', bpm ? `BPM ${bpm}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-lg p-3 border border-border bg-bg-surface hover:bg-surface-light transition-colors">
      <div className="flex gap-3 items-center">
        <Link to={`/songs/${songId}`} className="shrink-0">
          <div className="w-12 h-12 rounded-md overflow-hidden bg-bg-gray flex items-center justify-center">
            {imgError ? (
              <span className="text-base font-bold text-text-tertiary">{title.charAt(0)}</span>
            ) : (
              <img
                src={imgSrc}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                onError={() => {
                  const full = getCoverUrl(songId, 'full')
                  if (imgSrc !== full) setImgSrc(full)
                  else setImgError(true)
                }}
              />
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to={`/songs/${songId}`}
              className="font-medium text-sm truncate hover:text-primary hover:underline min-w-0"
            >
              {title}
            </Link>
            {levelMeta && (
              // 探索推荐的是某个具体难度，不标出来玩家会误以为整首都推荐
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 tracking-wide"
                style={{ backgroundColor: levelMeta.badgeBg, color: levelMeta.badgeFg }}
                title={`推荐难度：${LEVEL_LABELS[levelIndex as LevelIndex]}`}
              >
                {levelMeta.label}
              </span>
            )}
            {levelValue > 0 && (
              <span className="text-[10px] font-medium text-text-tertiary shrink-0">{level}</span>
            )}
            {item.fitDiff !== undefined && (
              // 挑战路线按拟合定数排序，把实际难度也标出来，否则玩家只看到官标会困惑
              <span
                className="text-[10px] text-text-tertiary shrink-0 tabular-nums"
                title="拟合定数：由全服达成率拟合出的实际难度"
              >
                实 {item.fitDiff.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5 truncate" title={meta}>{meta}</p>
        </div>

        {onBlock && (
          <button
            onClick={onBlock}
            title="不感兴趣"
            aria-label="不感兴趣"
            className="shrink-0 text-text-tertiary hover:text-error cursor-pointer border-none bg-transparent p-1 leading-none transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
