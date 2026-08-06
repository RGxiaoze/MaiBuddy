// ============================================================
// B50TileCard — 曲绘横向小卡片（移动端 3 列 / 桌面 5 列）
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import GradeBadge from '@/components/shared/GradeBadge'
import DxStars from '@/components/shared/DxStars'
import { LEVEL_INDEX_MAP } from '@/data/constants'
import { FC_LABELS, FS_LABELS } from '@/data/constants'
import { computeDxStar } from '@/utils/dxStar'
import type { LevelIndex } from '@/types'

/** 曲绘地址（LXNS CDN） */
function jacketUrl(songId: number): string {
  return `https://assets.lxns.net/maimai/jacket/${songId}.png!webp`
}

interface B50TileCardProps {
  songId: number
  levelIndex: number
  level: string
  title: string
  achievements: number
  rate: string
  dxRating: number
  fcType?: string | null
  fsType?: string | null
  dxScore?: number
  totalNotes?: number
}

export default function B50TileCard({
  songId, levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes,
}: B50TileCardProps) {
  const [imgError, setImgError] = useState(false)
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null

  return (
    <Link
      to={`/songs/${songId}`}
      className="flex gap-2 p-2 rounded-lg bg-bg-gray hover:bg-surface-light transition-colors no-underline min-w-0"
    >
      {/* 曲绘 */}
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden shrink-0 bg-surface-light flex items-center justify-center">
        {imgError ? (
          <span className="text-[8px] text-text-tertiary">无曲绘</span>
        ) : (
          <img
            src={jacketUrl(songId)}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-1">
          <GradeBadge rate={rate as import('@/types').RateType} />
          <span className="tabular-nums text-xs font-semibold text-text truncate">{achievements.toFixed(4)}%</span>
        </div>

        <span className="text-xs font-medium text-text truncate leading-tight" title={title}>{title}</span>

        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-1 py-px rounded text-[9px] font-medium text-white tabular-nums" style={{ backgroundColor: levelColors.color }}>{level}</span>
          {dxStar && <DxStars stars={dxStar.stars} size={9} />}
          {(fcType || fsType) && (
            <span className="text-success font-medium truncate">
              {fcType && FC_LABELS[fcType]}{fsType && ` ${FS_LABELS[fsType]}`}
            </span>
          )}
          <span className="tabular-nums font-semibold text-text-secondary ml-auto">{dxRating}</span>
        </div>
      </div>
    </Link>
  )
}
