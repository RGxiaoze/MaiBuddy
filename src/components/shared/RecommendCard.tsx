// ============================================================
// RecommendCard — 推分/推荐卡片（左曲绘 + 右信息，移动端优先）
//
// 统一四行结构：
//   1. 标题行：曲名 + 难度徽章 +（配置标签位）
//   2. 主指标：+13 分
//   3. 依据行：当前 99.9% → 100.5%
//   4. 操作行：B 站手元 / 不感兴趣
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, X } from 'lucide-react'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { LEVEL_LABELS, LEVEL_INDEX_MAP, getCoverUrl } from '@/data/constants'
import { getConfigTag, type ConfigType } from '@/data/chartConfig'
import { formatGain, truncatePercent } from '@/utils/format'
import type { LevelIndex } from '@/types'

/** 拟合差值达到这个幅度才显示标签（差 0.2 就标，不等到 0.3） */
const FIT_DELTA_MIN = 0.2

/**
 * 拟合差值配色：负值 = 实际比标称容易（水分）→ 绿，正值 = 更难 → 红。
 * 差 0.2 就上色，不等到 0.3。
 */
function fitDeltaColor(delta: number): string {
  if (delta <= -0.5) return '#16A34A'
  if (delta <= -0.2) return '#65A30D'
  if (delta >= 0.5) return '#DC2626'
  if (delta >= 0.2) return '#EA580C'
  return '#64748B'
}

export interface RecommendCardProps {
  songId: number
  title: string
  levelIndex: number
  levelValue: number
  /** 收益（Rating 增量），渲染为「+13 分」 */
  gain?: number
  /** 依据行：当前达成率 → 目标达成率 */
  progress?: { current: number; target: number }
  /** 补充说明（可选，探索等场景使用） */
  reason?: string
  /** 副标签（如「B15 池」） */
  tag?: string
  tagColor?: string
  /** 谱面配置分类；未接入数据源时不传，标签位不渲染 */
  configType?: ConfigType
  /** 是否显示 B 站搜索外链 */
  showExternalLink?: boolean
  /** 加入「不感兴趣」，不传则不显示该按钮 */
  onBlock?: () => void
  /** 推分难度评估 */
  /** 拟合定数 − 官标定数：负 = 水分，正 = 更难 */
  fitDelta?: number
  /** 该谱的全服 SSS+ 率，用于说明「推到顶」的普遍难度 */
  sssPlusRate?: number
  /** 你在该谱实际定数同档（0.1 精度）的平均成绩 */
  yourBandAvg?: number
}

export default function RecommendCard({
  songId, title, levelIndex, levelValue, gain, progress, reason, tag, tagColor = '#5BA4CF',
  configType, showExternalLink = true, onBlock, fitDelta, sssPlusRate, yourBandAvg,
}: RecommendCardProps) {
  const [imgError, setImgError] = useState(false)
  // 优先用本地 96px 缩略图（约 3 KB）；缺图（如宴会场）时回退落雪原图
  const [imgSrc, setImgSrc] = useState(() => getCoverUrl(songId, 'thumb'))
  const levelMeta = LEVEL_INDEX_MAP[levelIndex as LevelIndex]
  const configTag = getConfigTag(configType)

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
          {/* 1. 标题行 */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link to={`/songs/${songId}`} className="font-medium text-sm truncate hover:text-primary hover:underline min-w-0">
                {title}
              </Link>
              {levelMeta && (
                // 全大写 + 加粗：玩家看到高难曲名容易误以为要打 Master，
                // 实际推荐的可能只是 Expert，需要一眼看清是哪一档
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 tracking-wide"
                  style={{ backgroundColor: levelMeta.badgeBg, color: levelMeta.badgeFg }}
                  title={`推荐难度：${LEVEL_LABELS[levelIndex as LevelIndex]}`}
                >
                  {levelMeta.label}
                </span>
              )}
              {configTag && (
                <span
                  className="px-1 py-0.5 rounded text-[9px] font-medium shrink-0"
                  style={{ backgroundColor: configTag.color + '20', color: configTag.color }}
                  title={configTag.desc}
                >
                  {configTag.label}
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

          {/* 2. 主指标 + 标签 */}
          <div className="mt-1 flex items-center gap-2 text-xs min-w-0">
            {gain != null && gain > 0 && (
              <span className="text-base font-semibold text-success tabular-nums shrink-0">+{formatGain(gain)} 分</span>
            )}
            {tag && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0" style={{ backgroundColor: tagColor + '20', color: tagColor }}>
                {tag}
              </span>
            )}
            {fitDelta !== undefined && Math.abs(fitDelta) >= FIT_DELTA_MIN && (
              // 带符号：-0.4 = 实际比标称容易（水分），+0.3 = 实际更难
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 tabular-nums"
                style={{
                  backgroundColor: fitDeltaColor(fitDelta) + '1F',
                  color: fitDeltaColor(fitDelta),
                }}
                title={
                  `拟合定数比官标${fitDelta < 0 ? '低' : '高'} ${Math.abs(fitDelta).toFixed(1)}`
                  + (sssPlusRate ? `；全服 ${(sssPlusRate * 100).toFixed(0)}% 已 SSS+` : '')
                }
              >
                {fitDelta > 0 ? '+' : ''}{fitDelta.toFixed(1)}
              </span>
            )}
          </div>

          {/* 3. 依据行：当前 → 目标（不写「推到 SSS」这类档位名） */}
          {progress && (
            <p className="mt-1 text-xs text-text-secondary tabular-nums leading-snug">
              {truncatePercent(progress.current, 1)}% <span className="text-text-tertiary">→</span> {truncatePercent(progress.target, 1)}%
              {yourBandAvg !== undefined && (
                <span className="ml-1.5 text-[10px] text-text-tertiary" title="你在该谱实际定数同档（0.1 精度）的平均成绩">
                  该档均 {yourBandAvg.toFixed(1)}%
                </span>
              )}
            </p>
          )}

          {/* 4. 补充说明（可选） */}
          {reason && <p className="mt-1 text-xs text-text-secondary leading-snug line-clamp-2">{reason}</p>}
        </div>
      </div>
    </div>
  )
}
