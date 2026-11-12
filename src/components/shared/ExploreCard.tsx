// ============================================================
// ExploreCard — 探索卡片
//
// 极简：只展示「能认出是哪首歌」的基本信息
// （版本 / 分类 / 定数 / BPM），不显示难度徽章与社区投票数据。
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { getCoverUrl } from '@/data/constants'
import type { ExploreItem } from '@/utils/explore'

interface ExploreCardProps {
  item: ExploreItem
  /** 不感兴趣 */
  onBlock?: () => void
}

export default function ExploreCard({ item, onBlock }: ExploreCardProps) {
  const [imgError, setImgError] = useState(false)
  // 本地 96px 缩略图优先，缺图时回退落雪原图
  const [imgSrc, setImgSrc] = useState(() => getCoverUrl(item.songId, 'thumb'))
  const { songId, title, levelValue, genre, from, bpm } = item

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
          <Link
            to={`/songs/${songId}`}
            className="font-medium text-sm truncate block hover:text-primary hover:underline"
          >
            {title}
          </Link>
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
