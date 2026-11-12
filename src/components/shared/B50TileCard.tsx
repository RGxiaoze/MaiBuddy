// ============================================================
// B50TileCard — 曲绘横向小卡片（移动端 3 列 / 桌面 5 列）
// 曲绘：与曲目列表/详情一致的 Diving-Fish covers CDN（getCoverUrl），
//       加载失败本地占位（难度色 + 曲名首字）
// 排版：曲名固定两行，底部信息行 mt-auto 对齐
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import GradeBadge from '@/components/shared/GradeBadge'
import DxStars from '@/components/shared/DxStars'
import { LEVEL_INDEX_MAP, LEVEL_BADGE_CLASS } from '@/data/constants'
import { FC_LABELS, FS_LABELS } from '@/data/constants'
import { getCoverUrl } from '@/data/constants'
import { computeDxStar } from '@/utils/dxStar'
import type { LevelIndex } from '@/types'

interface B50TileCardProps {
  songId: number
  levelIndex: number
  /** 官标等级（如 "14+"），保留以便其他地方复用 */
  level: string
  /** 具体定数（如 14.8）——B50 里直接显示它比等级更有信息量 */
  levelValue: number
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
  songId, levelIndex, levelValue, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes,
}: B50TileCardProps) {
  const [imgError, setImgError] = useState(false)
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null
  // 本地 96px 缩略图优先，缺图时回退落雪原图
  const [imgSrc, setImgSrc] = useState(() => getCoverUrl(songId, 'thumb'))

  return (
    <Link
      to={`/songs/${songId}`}
      className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-gray hover:bg-surface-light transition-colors no-underline min-w-0 h-full"
    >
      {/* 曲绘（顶部） */}
      <div className="w-full aspect-square rounded-md overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: imgError ? (levelColors.color + '22') : undefined }}>
        {imgError ? (
          <span className="text-lg font-bold" style={{ color: levelColors.color }}>{title.charAt(0)}</span>
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

      {/* 信息区（底部行 mt-auto 对齐） */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* 评级 + 达成率：移动端 3 列卡片窄，降到 2 位小数避免截断；桌面保留 4 位 */}
        <div className="flex items-center justify-between gap-1">
          <GradeBadge rate={rate as import('@/types').RateType} />
          <span className="tabular-nums text-[10px] md:text-xs font-semibold text-text truncate">
            <span className="md:hidden">{achievements.toFixed(2)}%</span>
            <span className="hidden md:inline">{achievements.toFixed(4)}%</span>
          </span>
        </div>

        {/* 曲名：固定两行高度 */}
        <span className="text-xs font-medium text-text leading-snug line-clamp-2 min-h-[2em]" title={title}>{title}</span>

        {/* 定数 + FC/FS */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className={`${LEVEL_BADGE_CLASS} py-px rounded text-[9px] font-medium`} style={{ backgroundColor: levelColors.badgeBg, color: levelColors.badgeFg }}>{levelValue.toFixed(1)}</span>
          {(fcType || fsType) && (
            <span className="text-success font-medium truncate">
              {fcType && FC_LABELS[fcType]}{fsType && ` ${FS_LABELS[fsType]}`}
            </span>
          )}
        </div>

        {/* DX 星 + Rating（贴底） */}
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          {dxStar ? <DxStars stars={dxStar.stars} size={9} /> : <span />}
          <span className="tabular-nums font-semibold text-text-secondary text-[11px]">{dxRating}</span>
        </div>
      </div>
    </Link>
  )
}
