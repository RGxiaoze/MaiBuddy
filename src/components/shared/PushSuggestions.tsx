// ============================================================
// Push suggestions panel — three-target side-by-side display
// ============================================================

import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import { computePushSuggestions, type PushSuggestion } from '@/utils/pushSuggestions'
import { computeTheoreticalMaxRating, type B50Result } from '@/utils/b50'
import { loadStats, getChartStats, isStatsLoaded } from '@/services/statsService'
import { bilibiliSearchUrl } from '@/utils/bilibiliSearch'
import { ExternalLink } from 'lucide-react'
import { LEVEL_LABELS } from '@/data/constants'
import type { LevelIndex } from '@/types'

const POOL_LABELS: Record<string, string> = {
  b35: '旧版本 Best 35',
  b15: '新版本 Best 15',
}

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

  const [showAll, setShowAll] = useState(false)
  const [statsReady, setStatsReady] = useState(isStatsLoaded())

  // Compute theoretical max from songs if not provided by parent
  const theoryMax = useMemo(() => {
    if (theoreticalMax > 0) return theoreticalMax
    if (songs.length === 0) return 0
    return computeTheoreticalMaxRating(songs)
  }, [theoreticalMax, songs])

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
    // Only pass allScores when effective data source is local (not DF query)
    const isDfSource = dfPlayerName && (dfBest35.length > 0 || dfBest15.length > 0)
    return computePushSuggestions(effectiveB50, songMap, {
      allScores: isDfSource ? undefined : scores,
      getStats: getChartStats,
    })
  }, [effectiveB50, localB50, scores, songs, statsReady, dfPlayerName, dfBest35, dfBest15])

  const suggestions = result?.suggestions ?? null
  const precisionNote = result?.precisionNote

  // Empty state: no B50 data at all
  if (!effectiveB50) {
    return (
      <div className="bg-surface border border-border rounded-lg p-5 mt-4">
        <h3 className="text-sm font-semibold text-text m-0">📈 推分建议</h3>
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
        <h3 className="text-sm font-semibold text-text m-0">📈 推分建议</h3>
        <p className="text-xs text-text-secondary mt-1">
          暂无推分建议。B50 地板分已接近理论最高值
          {theoryMax > 0 ? ` (${theoryMax})` : ''}，继续保持！
        </p>
      </div>
    )
  }

  const displayed = showAll ? suggestions : suggestions.slice(0, 5)

  return (
    <div className="bg-surface border border-border rounded-lg p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text m-0">
          📈 推分建议 ({suggestions.length})
        </h3>
        <div className="flex items-center gap-3">
          {theoryMax > 0 && (
            <span className="text-xs text-text-secondary">
              当前 {b50Rating} / 理论最高 {theoryMax}
            </span>
          )}
        </div>
      </div>

      {/* Notice when using DF-only data (no local all-scores) */}
      {!localB50 && (
        <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-300">
          当前仅检测到 Diving-Fish B50 数据（{dfBest35.length + dfBest15.length} 条），未导入完整成绩。
          表格中标记 <code className="px-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">?</code> 的曲目达成率为 B50 回归估算值，非实际数据。
          建议前往<Link to="/songs" className="font-medium underline">曲目检索页</Link>导入完整成绩以获得精准推荐。
        </div>
      )}

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
              <th className="text-center py-1.5 px-1 font-medium w-10">难度</th>
              <th className="text-left py-1.5 pl-2 font-medium w-24">成绩池</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((item, i) => (
              <PushRow key={`${item.songId}-${item.levelIndex}`} item={item} index={i + 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-2">
        {displayed.length === 0 && (
          <p className="text-xs text-text-secondary text-center py-4">暂无可推分曲目</p>
        )}
        {displayed.map((item, i) => {
          const diff = DIFF_LABELS[item.difficulty] || DIFF_LABELS.medium
          const configType = guessConfigType(item.levelValue)
          const configTag = CONFIG_TAGS[configType]
          return (
            <div key={`${item.songId}-${item.levelIndex}`} className="bg-bg-gray rounded-lg p-3 space-y-1.5">
              {/* Row 1: rank + title + level + external link */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-text-tertiary text-xs tabular-nums shrink-0">{i + 1}.</span>
                <Link to={`/songs/${item.songId}`} className="font-medium text-xs truncate hover:text-primary hover:underline min-w-0">
                  {item.songTitle}
                </Link>
                <span className="text-text-tertiary text-[10px] shrink-0">{LEVEL_LABELS[item.levelIndex as LevelIndex]}</span>
                <a href={bilibiliSearchUrl(item.songTitle, item.level)}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center text-text-tertiary hover:text-primary shrink-0"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink size={11} />
                </a>
                {item.precision === 'estimated' && (
                  <span className="text-[10px] text-text-tertiary shrink-0 cursor-help" title="达成率为基于 B50 定数回归的估算值">?</span>
                )}
              </div>

              {/* Row 2: level value + current + diff tag + pool */}
              <div className="flex items-center gap-2 text-xs">
                <span className="tabular-nums font-medium">{item.levelValue.toFixed(1)}</span>
                <span className="tabular-nums text-text-secondary">
                  {item.precision === 'estimated' ? `估 ${item.currentAchievements.toFixed(1)}%` : `${item.currentAchievements.toFixed(1)}%`}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: diff.color + '20', color: diff.color }}>{diff.label}</span>
                <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: configTag.color + '20', color: configTag.color }} title={configTag.desc}>{configTag.label}</span>
                <span className="text-text-secondary text-[10px]">{POOL_LABELS[item.pool]}</span>
              </div>

              {/* Row 3: three target gains */}
              <div className="flex gap-3 text-xs">
                {item.gains.map((gain, gi) => (
                  <span key={gi} className="text-text-secondary" title={`目标 ${gain.targetAch}% → 增益 +${gain.ratingGain}`}>
                    <span className="font-medium text-text">{gain.ratingGain > 0 ? `+${gain.ratingGain}` : '—'}</span>
                    <span className="text-[10px] ml-0.5">{['SS+ 99%', 'SSS 100%', 'SSS+ 100.5%'][gi]}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {suggestions.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs text-primary hover:underline cursor-pointer w-full text-center"
        >
          {showAll ? '收起，只显示前 5 条' : `查看全部 ${suggestions.length} 条建议`}
        </button>
      )}

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
          🔗 跳转 B 站搜索该曲目手元，看看大佬们是怎么打的，享受音乐和进步的过程吧！
        </p>
      </div>
    </div>
  )
}

/** Single suggestion row — React.memo for performance */
function PushRow({ item, index }: { item: PushSuggestion; index: number }) {
  const diff = DIFF_LABELS[item.difficulty] || DIFF_LABELS.medium
  const configType = guessConfigType(item.levelValue, 200) // BPM not available in PushSuggestion, use heuristic
  const configTag = CONFIG_TAGS[configType]

  return (
    <tr className="border-b border-border/20 hover:bg-bg-gray/50">
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
      <td className="py-1.5 pl-2 text-text-secondary text-[10px]">
        {POOL_LABELS[item.pool]}
      </td>
    </tr>
  )
}
