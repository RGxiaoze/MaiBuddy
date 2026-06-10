// ============================================================
// Push suggestions panel — three-target side-by-side display
// ============================================================

import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { computePushSuggestions, type PushSuggestion } from '@/utils/pushSuggestions'
import { computeTheoreticalMaxBoth, type B50Result } from '@/utils/b50'
import { loadStats, getChartStats, isStatsLoaded } from '@/services/statsService'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { ExternalLink, TrendingUp } from 'lucide-react'
import { LEVEL_LABELS } from '@/data/constants'
import type { LevelIndex } from '@/types'

const DIFF_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  easy:   { label: '轻松', color: '#22C55E', desc: '全服达成率远高于同级平均水平' },
  medium: { label: '适中', color: '#D97706', desc: '全服达成率与同级平均水平相近' },
  hard:   { label: '挑战', color: '#DC2626', desc: '全服达成率显著低于同级平均水平；15级固定为挑战' },
}

const CONFIG_TAGS: Record<string, { label: string; color: string; desc: string }> = {
  stamina:  { label: '底力', color: '#22C55E', desc: '持续高密度交互为主的耐力型谱面' },
  burst:    { label: '爆发', color: '#DC2626', desc: '含极高瞬时密度的爆发型谱面' },
  tech:     { label: '技巧', color: '#A855F7', desc: 'Slide多样或Touch密集的技巧型谱面' },
  balanced: { label: '综合', color: '#6B7280', desc: '多项配置均衡的综合型谱面' },
}

/** Heuristic config type based on song metadata */
function guessConfigType(levelValue: number, bpm?: number): keyof typeof CONFIG_TAGS {
  if (bpm && bpm >= 195 && levelValue >= 14.5) return 'burst'
  if (bpm && bpm >= 180 && levelValue >= 14) return 'stamina'
  if (bpm && bpm <= 170) return 'tech'
  return 'balanced'
}

export default function PushSuggestions({ theoreticalMax = 0 }: { theoreticalMax?: number }) {
  const { localB50, dfBest35, dfBest15, dfRating, dfPlayerName } = usePlayerStore()
  const { scores } = useScoreStore()
  const { songs } = useSongStore()

  const [statsReady, setStatsReady] = useState(isStatsLoaded())

  // Compute theoretical max from songs if not provided by parent
  const theoryMaxAll = useMemo(() => {
    if (songs.length === 0) return { sssPlusMax: 0, apMax: 0 }
    return computeTheoreticalMaxBoth(songs)
  }, [songs])
  const theoryMax = theoreticalMax > 0 ? theoreticalMax : theoryMaxAll.sssPlusMax
  const theoryMaxAP = theoreticalMax > 0 ? theoreticalMax + 50 : theoryMaxAll.apMax

  // Load chart stats for difficulty classification
  useEffect(() => {
    if (!statsReady) {
      loadStats().then(() => setStatsReady(true)).catch(() => {})
    }
  }, [statsReady])

  // Build effective B50: DF data takes priority when user explicitly queried a player
  const effectiveB50 = useMemo<B50Result | null>(() => {
    // When user explicitly queried a DF player → prefer DF data over local
    const useDF = dfPlayerName && (dfBest35.length > 0 || dfBest15.length > 0)

    if (!useDF && localB50) return localB50
    if (dfBest35.length === 0 && dfBest15.length === 0) return null

    // Convert Diving-Fish scores to B50Result format
    const toB50Entry = (s: typeof dfBest35[number], isNew: boolean) => ({
      songId: s.songId,
      songTitle: s.title,
      levelIndex: s.levelIndex,
      level: s.level,
      levelValue: s.levelValue,
      songType: s.songType,
      achievements: s.achievements,
      rate: s.rate,
      dxRating: s.dxRating,
      dxScore: s.dxScore,
      fcType: s.fcType,
      fsType: s.fsType,
      isNew,
    })

    const best35 = dfBest35.map(s => toB50Entry(s, false))
    const best15 = dfBest15.map(s => toB50Entry(s, true))
    const best35Total = best35.reduce((sum, e) => sum + e.dxRating, 0)
    const best15Total = best15.reduce((sum, e) => sum + e.dxRating, 0)

    return { best35, best15, best35Total, best15Total, totalRating: best35Total + best15Total }
  }, [localB50, dfBest35, dfBest15, dfPlayerName])

  const b50Rating = effectiveB50?.totalRating ?? dfRating

  const result = useMemo(() => {
    if (!effectiveB50 || songs.length === 0) return null
    const songMap = new Map(songs.map(s => [s.id, s]))
    return computePushSuggestions(effectiveB50, songMap, {
      allScores: scores.length > 0 ? scores : undefined,
      getStats: getChartStats,
    })
  }, [effectiveB50, localB50, scores, songs, statsReady, dfPlayerName, dfBest35, dfBest15])

  const suggestions = result?.suggestions ?? null
  const precisionNote = result?.precisionNote

  // Empty state: no B50 data at all
  if (!effectiveB50) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 mt-4">
        <h3 className="text-sm font-semibold text-text m-0"><TrendingUp size={16} className="inline mr-1" /> 推分建议</h3>
        <p className="text-xs text-text-secondary mt-1">
          暂无 B50 数据，导入成绩或查询 Diving-Fish 后自动生成推分建议。
        </p>
      </div>
    )
  }

  // Empty state: no suggestions
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 mt-4">
        <h3 className="text-sm font-semibold text-text m-0"><TrendingUp size={16} className="inline mr-1" /> 推分建议</h3>
        <p className="text-xs text-text-secondary mt-1">
          暂无推分建议。          B50 地板分已接近理论 SSS+ 天花板
          {theoryMaxAll.sssPlusMax > 0 ? ` (${theoryMaxAll.sssPlusMax})` : ''}，继续保持！
        </p>
      </div>
    )
  }

  const hasAnyAP = suggestions.some(s => s.apGain && s.apGain.ratingGain > 0)

  const b35Suggestions = suggestions.filter(s => s.pool === 'b35')
  const b15Suggestions = suggestions.filter(s => s.pool === 'b15')

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text m-0">
          <TrendingUp size={16} className="inline mr-1" /> 推分建议 ({suggestions.length})
        </h3>
        <div className="flex items-center gap-3">
          {theoryMax > 0 && (
            <span className="text-xs text-text-secondary hidden md:inline">
              当前 {b50Rating} / 理论 SSS+ {theoryMax} / 理论 AP {theoryMaxAP}
            </span>
          )}
        </div>
      </div>

      {/* Mobile-only rating summary */}
      {theoryMax > 0 && (
        <div className="md:hidden mb-3 text-xs text-text-secondary space-y-0.5">
          <div>当前 {b50Rating}</div>
          <div>理论 SSS+ {theoryMax} / 理论 AP {theoryMaxAP}</div>
        </div>
      )}

      {/* Notice when using DF-only data */}
      {!localB50 && (
        <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-300">
          当前仅检测到 Diving-Fish B50 数据（{dfBest35.length + dfBest15.length} 条），未导入完整成绩。
          表格中标记 <code className="px-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">?</code> 的曲目达成率为 B50 回归估算值，非实际数据。
          建议前往<Link to="/songs" className="font-medium underline">曲目检索页</Link>导入完整成绩以获得精准推荐。
        </div>
      )}

      {/* ---- B35 table ---- */}
      <SuggestionSection
        title={`旧版本 Best 35 推分建议 (${b35Suggestions.length})`}
        items={b35Suggestions}
        hasAnyAP={hasAnyAP}
      />

      {/* ---- B15 table ---- */}
      <SuggestionSection
        title={`新版本 Best 15 推分建议 (${b15Suggestions.length})`}
        items={b15Suggestions}
        hasAnyAP={hasAnyAP}
      />

      {/* Algorithm footnotes */}
      <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
        {precisionNote && (
          <p className="text-xs text-primary/80">
            ℹ️ {precisionNote}
          </p>
        )}
        <p className="text-xs text-text-tertiary">
          <span className="cursor-help" title="达成率基于 B50 定数回归估算，非实际成绩">?</span>
          ：达成率基于 B50 回归估算，导入完整成绩后可获得更精准的推荐，加油！
        </p>
        <p className="text-xs text-text-tertiary">
          难度标签：轻松=水分曲，适合冲分；适中=同级平均水平；挑战=硬核谱面，攻克后成就感满满。定数越高越严格哦。
        </p>
        <p className="text-xs text-text-tertiary">
          <ExternalLink size={12} className="inline mr-1" />跳转 B 站搜索该曲目手元，看看大佬们是怎么打的，享受音乐和进步的过程吧！
        </p>
      </div>
    </div>
  )
}

/** Section: a single pool's suggestion table + mobile cards */
function SuggestionSection({
  title, items, hasAnyAP,
}: {
  title: string
  items: PushSuggestion[]
  hasAnyAP: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isEmpty = items.length === 0
  const displayed = expanded ? items : items.slice(0, 5)
  const hasMore = !expanded && items.length > 5

  const totalGain = isEmpty ? 0 : items.reduce((s, it) => s + (it.gains[2]?.ratingGain ?? 0), 0)
  const apCount = isEmpty ? 0 : items.filter(it => it.apGain && it.apGain.ratingGain > 0).length

  return (
    <div className="mb-3 last:mb-0">
      {/* Collapsible header with stats */}
      {isEmpty ? (
        <div className="py-2 px-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-xs font-semibold text-text-secondary truncate">{title}</h4>
            <span className="text-[10px] text-text-tertiary">暂无建议</span>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between gap-2 py-2 cursor-pointer border-none bg-transparent hover:bg-surface-light rounded-lg px-2 -mx-2 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-xs font-semibold text-text-secondary truncate">{title}</h4>
              <span className="text-[10px] text-text-tertiary tabular-nums shrink-0">
                +{totalGain} 分
                {apCount > 0 && <span className="text-success ml-1">AP ×{apCount}</span>}
              </span>
            </div>
            <span className="text-xs text-text-tertiary shrink-0">
              {expanded ? `收起 ▲` : `${items.length} 条 ▶`}
            </span>
          </button>

          {/* Table + cards wrapper with optional fade */}
          <div className="relative">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-secondary border-b border-border/50">
                    <th className="text-left py-1.5 pr-2 font-medium w-8">#</th>
                    <th className="text-left py-1.5 pr-2 font-medium">曲目</th>
                    <th className="text-center py-1.5 px-1 font-medium w-12">定数</th>
                    <th className="text-right py-1.5 px-1 font-medium w-16">当前</th>
                    <th className="text-right py-1.5 px-1 font-medium w-12">SS+<span className="text-[10px] opacity-75"> 99%</span></th>
                    <th className="text-right py-1.5 px-1 font-medium w-12">SSS<span className="text-[10px] opacity-75"> 100%</span></th>
                    <th className="text-right py-1.5 px-1 font-medium w-12">SSS+<span className="text-[10px] opacity-75"> 100.5%</span></th>
                    {hasAnyAP && (
                      <th className="text-right py-1.5 px-1 font-medium w-12 text-success">AP<span className="text-[10px] opacity-75"> +1</span></th>
                    )}
                    <th className="text-center py-1.5 px-1 font-medium w-10">难度</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item, i) => (
                    <PushRow key={`${item.songId}-${item.levelIndex}`} item={item} index={i + 1} hasAnyAP={hasAnyAP}
                      faded={hasMore && i === 4}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-2">
              {displayed.map((item, i) => {
                const diff = DIFF_LABELS[item.difficulty] || DIFF_LABELS.medium
                const configType = guessConfigType(item.levelValue)
                const configTag = CONFIG_TAGS[configType]
                const isLastVisible = hasMore && i === 4
                return (
                  <div
                    key={`${item.songId}-${item.levelIndex}`}
                    className={`rounded-lg p-3 space-y-1.5 border-l-3 transition-opacity ${isLastVisible ? 'opacity-50' : ''}`}
                    style={{
                      backgroundColor: item.pool === 'b35' ? 'rgba(91,164,207,0.06)' : 'rgba(184,160,232,0.06)',
                      borderLeftColor: item.levelValue >= 14.5 ? '#DC2626' : item.levelValue >= 13.5 ? '#D97706' : item.levelValue >= 12 ? '#5BA4CF' : '#22C55E',
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-text-tertiary text-xs tabular-nums shrink-0">{i + 1}.</span>
                      <Link to={`/songs/${item.songId}`} className="font-medium text-xs truncate hover:text-primary hover:underline min-w-0">
                        {item.songTitle}
                      </Link>
                      <span className="text-text-tertiary text-[10px] shrink-0">{LEVEL_LABELS[item.levelIndex as LevelIndex]}</span>
                      <a href={bilibiliSearchUrl(item.songTitle, item.level)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-text-tertiary hover:text-primary shrink-0" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink size={11} />
                      </a>
                      {item.precision === 'estimated' && (
                        <span className="text-[10px] text-text-tertiary shrink-0 cursor-help" title="达成率为基于 B50 定数回归的估算值">?</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="tabular-nums font-medium">{item.levelValue.toFixed(1)}</span>
                      <span className="tabular-nums text-text-secondary">
                        {item.precision === 'estimated' ? `估 ${item.currentAchievements.toFixed(1)}%` : `${item.currentAchievements.toFixed(1)}%`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: diff.color + '20', color: diff.color }}>{diff.label}</span>
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: configTag.color + '20', color: configTag.color }} title={configTag.desc}>{configTag.label}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      {item.gains.map((gain, gi) => (
                        <span key={gi} className="text-text-secondary" title={`目标 ${gain.targetAch}% → 增益 +${gain.ratingGain}`}>
                          <span className="font-medium text-text">{gain.ratingGain > 0 ? `+${gain.ratingGain}` : '—'}</span>
                          <span className="text-[10px] ml-0.5">{['SS+ 99%', 'SSS 100%', 'SSS+ 100.5%'][gi]}</span>
                        </span>
                      ))}
                      {item.apGain && item.apGain.ratingGain > 0 && (
                        <span className="text-success font-medium" title={`AP 判定额外 +${item.apGain.ratingGain} Rating`}>
                          +{item.apGain.ratingGain}
                          <span className="text-[10px] ml-0.5">AP +1</span>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Fade overlay for collapsed sections with more items */}
            {hasMore && (
              <button
                onClick={() => setExpanded(true)}
                className="absolute bottom-0 left-0 right-0 flex items-end justify-center pb-2 pt-12 cursor-pointer border-none bg-transparent w-full"
                style={{ background: 'linear-gradient(to top, var(--color-bg-surface, #fff) 20%, transparent 100%)' }}
              >
                <span className="text-xs text-primary font-medium hover:underline">
                  展开全部 {items.length} 条 ▾
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Single suggestion row — React.memo for performance */
function PushRow({ item, index, hasAnyAP, faded }: { item: PushSuggestion; index: number; hasAnyAP: boolean; faded?: boolean }) {
  const diff = DIFF_LABELS[item.difficulty] || DIFF_LABELS.medium
  const configType = guessConfigType(item.levelValue, 200) // BPM not available in PushSuggestion, use heuristic
  const configTag = CONFIG_TAGS[configType]

  return (
    <tr className={`border-b border-border/20 hover:bg-bg-gray/50 transition-opacity ${faded ? 'opacity-40' : ''}`}>
      <td className="py-1.5 pr-2 text-text-tertiary tabular-nums">{index}</td>
      <td className="py-1.5 pr-2 font-medium truncate max-w-40">
        <Link to={"/songs/" + item.songId} className="hover:text-primary hover:underline">
          {item.songTitle}
        </Link>
        <span className="text-text-tertiary ml-1">
          {LEVEL_LABELS[item.levelIndex as LevelIndex]}
        </span>
        <a
          href={bilibiliSearchUrl(item.songTitle, item.level)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center ml-1 text-text-tertiary hover:text-primary transition-colors"
          title="在 B站搜索此曲目手元"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
        {item.precision === 'estimated' && (
          <span
            className="text-[10px] text-text-tertiary ml-1 cursor-help"
            title="达成率为基于 B50 定数回归的估算值，非玩家实际成绩。导入完整成绩后可获得精准数据。"
          >
            ?
          </span>
        )}
      </td>
      <td className="py-1.5 px-1 text-center tabular-nums font-medium">{item.levelValue.toFixed(1)}</td>
      <td className="py-1.5 px-1 text-right tabular-nums text-text-secondary whitespace-nowrap">
        {item.precision === 'estimated'
          ? `估 ${item.currentAchievements.toFixed(1)}%`
          : `${item.currentAchievements.toFixed(1)}%`
        }
      </td>
      {item.gains.map((gain, idx) => (
        <td
          key={idx}
          className="py-1.5 px-1 text-right tabular-nums text-text-secondary"
          title={`目标达成率 ${gain.targetAch}% → Rating ${gain.targetRating}（增益 +${gain.ratingGain}）`}
        >
          {gain.ratingGain > 0 ? `+${gain.ratingGain}` : '—'}
        </td>
      ))}
      {item.apGain && item.apGain.ratingGain > 0 ? (
        <td
          className="py-1.5 px-1 text-right tabular-nums text-success font-medium"
          title={`AP 判定额外 +1 Rating（达成率 ${item.apGain.targetAch}% + AP → Rating ${item.apGain.targetRating}）`}
        >
          +{item.apGain.ratingGain}
        </td>
      ) : hasAnyAP ? (
        <td className="py-1.5 px-1" />
      ) : null}
      <td className="py-1.5 px-1 text-center">
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help"
          style={{ backgroundColor: diff.color + '20', color: diff.color }}
          title={diff.desc}
        >
          {diff.label}
        </span>
        <span
          className="px-1 py-0.5 rounded text-[9px] font-medium cursor-help ml-0.5"
          style={{ backgroundColor: configTag.color + '20', color: configTag.color }}
          title={configTag.desc}
        >
          {configTag.label}
        </span>
      </td>
    </tr>
  )
}
