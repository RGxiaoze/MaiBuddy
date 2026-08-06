// ============================================================
// B50TileCard — 曲绘横向小卡片（移动端 3 列 / 桌面 5 列）
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import GradeBadge from '@/components/shared/GradeBadge'
import DxStars from '@/components/shared/DxStars'
import { LEVEL_INDEX_MAP } from '@/data/constants'
import { FC_LABELS, FS_LABELS } from '@/data/constants'
import { computeDxStar } from '@/utils/dxStar'
import { getJacketUrl, loadJacketMap } from '@/utils/jacket'
import type { LevelIndex } from '@/types'

interface B50TileCardProps {
  songId: number
  songTitle: string
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
  songId, songTitle, levelIndex, level, title, achievements, rate, dxRating, fcType, fsType, dxScore, totalNotes,
}: B50TileCardProps) {
  const [imgError, setImgError] = useState(false)
  const [jacketId, setJacketId] = useState<number | null>(null)
  const levelColors = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const dxStar = dxScore != null && totalNotes && totalNotes > 0 ? computeDxStar(dxScore, totalNotes) : null

  // Load jacket map once, then resolve correct LXNS id via song title
  useEffect(() => {
    let cancelled = false
    loadJacketMap().then(map => {
      if (!cancelled) {
        const key = songTitle.replace(/\s*\[(SD|DX)\]\s*/g, '').trim().toLowerCase()
        setJacketId(map[key] ?? songId)
      }
    })
    return () => { cancelled = true }
  }, [songTitle, songId])

  const jacketSrc = jacketId != null ? getJacketUrl(songTitle, jacketId) : null

  return (
    <Link
      to={`/songs/${songId}`}
      className="flex flex-col gap-1.5 p-2 rounded-lg bg-bg-gray hover:bg-surface-light transition-colors no-underline min-w-0"
    >
      {/* 曲绘（顶部） */}
      <div className="w-full aspect-square rounded-md overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: imgError || !jacketSrc ? (levelColors.color + '22') : undefined }}>
        {imgError || !jacketSrc ? (
          <span className="text-lg font-bold" style={{ color: levelColors.color }}>{title.charAt(0)}</span>
        ) : (
          <img
            src={jacketSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        {/* 评级 + 达成率 */}
        <div className="flex items-center justify-between gap-1">
          <GradeBadge rate={rate as import('@/types').RateType} />
          <span className="tabular-nums text-xs font-semibold text-text truncate">{achievements.toFixed(4)}%</span>
        </div>

        {/* 曲名（最多两行） */}
        <span className="text-xs font-medium text-text leading-snug line-clamp-2 min-h-[2em]" title={title}>{title}</span>

        {/* 定数 + FC/FS */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-1 py-px rounded text-[9px] font-medium text-white tabular-nums" style={{ backgroundColor: levelColors.color }}>{level}</span>
          {(fcType || fsType) && (
            <span className="text-success font-medium truncate">
              {fcType && FC_LABELS[fcType]}{fsType && ` ${FS_LABELS[fsType]}`}
            </span>
          )}
        </div>

        {/* DX 星 + Rating */}
        <div className="flex items-center justify-between gap-1">
          {dxStar ? <DxStars stars={dxStar.stars} size={9} /> : <span />}
          <span className="tabular-nums font-semibold text-text-secondary text-[11px]">{dxRating}</span>
        </div>
      </div>
    </Link>
  )
}
