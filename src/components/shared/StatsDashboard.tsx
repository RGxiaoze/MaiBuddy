// ============================================================
// StatsDashboard — 成绩统计面板（我的记录式）
// 结构：常驻 Rating 进度卡（AP 加成已禁用）
//      + 维度 Tab（难度/歌曲等级/达成等级/曲包）
//      + 值标签行（横向滚动，达成等级含评级/FC/FS 分组）
//      + 难度二级筛选行（仅达成等级/曲包维度）
//      + 统计卡（曲目总数/平均达成率/AP/最高定数，可点击钻取）
//      + 评级分布（SSS+/SSS/SS/S 条状图，颜色取游戏评级色系相近色）
//      + 匹配曲目列表（筛选 + 排序与检索页共用）
// ============================================================

import { Fragment, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { usePlayerStore } from '@/store/playerStore'
import { useScoreStore } from '@/store/scoreStore'
import { useSongStore } from '@/store/songStore'
import SongFilterPanel from './SongFilterPanel'
import SongSortBar from './SongSortBar'
import SongResultList from './SongResultList'
import { buildScoreStats } from '@/utils/songSort'
import { matchRateValue } from '@/utils/stats'
import { computeTheoreticalMaxBoth } from '@/utils/b50'
import {
  computeStats, getLevelTabs, getGenreTabs,
  DIFFICULTY_TABS, RATE_TABS, FC_TABS, FS_TABS,
  type StatsDimension, type GroupedStats,
} from '@/utils/stats'
import type { LevelIndex } from '@/types'

const DIMENSION_TABS: { value: StatsDimension; label: string }[] = [
  { value: 'difficulty', label: '难度' },
  { value: 'level', label: '歌曲等级' },
  { value: 'rate', label: '达成等级' },
  { value: 'genre', label: '曲包' },
]

/** 达成等级标签分组（组间分隔线） */
const RATE_GROUPS: { title: string; tabs: { value: string; label: string }[] }[] = [
  { title: '评级', tabs: RATE_TABS },
  { title: 'FC', tabs: FC_TABS },
  { title: 'FS', tabs: FS_TABS },
]

/** 评级分布条颜色 — 游戏评级色系的相近色（SSS+ 三色渐变 / SSS 金 / SS 橙金 / S 淡金） */
const RATE_BAR_COLORS: Record<string, string> = {
  sssp: 'linear-gradient(90deg, #FFD700, #3B82F6, #EF4444)',
  sss: '#FFD700',
  ss: '#F0A500',
  s: '#FFC53D',
}

/** 钻取条件（页内筛选，替代原来的跳转 URL 参数） */
interface DrillState {
  /** 难度索引 */
  lv?: LevelIndex
  /** 官标等级标签（如 "14+"） */
  level?: string
  genre?: string
  /** 成绩维度条件（rate/fc/fs 的取值） */
  played?: string
}

interface TabButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border-none whitespace-nowrap transition-colors shrink-0 ${
        active ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'
      }`}
    >
      {label}
    </button>
  )
}

export default function StatsDashboard() {
  const { localB50 } = usePlayerStore()
  const { scores } = useScoreStore()
  const { songs } = useSongStore()
  const getFilteredSongs = useSongStore((s) => s.getFilteredSongs)
  const advancedFilters = useSongStore((s) => s.advancedFilters)
  const sortBy = useSongStore((s) => s.sortBy)
  const sortOrder = useSongStore((s) => s.sortOrder)

  // ---- 常驻 Rating 进度（AP 加成已禁用，扣除历史数据中的加成） ----
  const theoryMax = useMemo(
    () => songs.length > 0 ? computeTheoreticalMaxBoth(songs).sssPlusMax : 0,
    [songs],
  )
  const rating = localB50?.totalRating ?? 0
  const b50ApCount = useMemo(() => {
    if (!localB50) return 0
    return [...localB50.best35, ...localB50.best15].filter(e => e.fcType === 'ap' || e.fcType === 'app').length
  }, [localB50])
  const ratingNoAp = Math.max(0, rating - b50ApCount)
  const ratingProgress = theoryMax > 0 ? Math.round(ratingNoAp / theoryMax * 10000) / 100 : 0

  // ---- 筛选状态 ----
  const [dimension, setDimension] = useState<StatsDimension>('difficulty')
  const [value, setValue] = useState('all')
  const [difficulty, setDifficulty] = useState<'all' | LevelIndex>('all')

  const handleDimensionChange = (d: StatsDimension) => {
    if (d === dimension) return
    setDimension(d)
    setValue('all')
    setDifficulty('all')
  }

  const valueTabs = useMemo(() => {
    switch (dimension) {
      case 'difficulty': return DIFFICULTY_TABS
      case 'level': return getLevelTabs(songs)
      case 'genre': return getGenreTabs(songs)
      case 'rate': return RATE_GROUPS
    }
  }, [dimension, songs])

  const stats: GroupedStats | null = useMemo(
    () => songs.length > 0 ? computeStats(scores, songs, { dimension, value, difficulty }) : null,
    [scores, songs, dimension, value, difficulty],
  )

  const showDifficultyRow = dimension === 'rate' || dimension === 'genre'
  const difficultyActive = (t: { value: string }) => t.value === 'all'
    ? difficulty === 'all'
    : String(difficulty) === t.value

  // ---- 钻取：本页内筛选，不再跳转到检索页 ----
  const [drill, setDrill] = useState<DrillState>({})
  const [showFilters, setShowFilters] = useState(false)

  const baseDrill = (): DrillState => {
    const next: DrillState = {}
    if (dimension === 'difficulty' && value !== 'all') next.lv = Number(value) as LevelIndex
    if (dimension === 'level' && value !== 'all') next.level = value
    if (dimension === 'genre' && value !== 'all') next.genre = value
    if (dimension === 'rate' && value !== 'all') next.played = value
    if (difficulty !== 'all') next.lv = difficulty
    return next
  }
  const applyDrill = (next: DrillState) => setDrill(next)

  // 匹配曲目：全局筛选（检索页同一份）+ 本次钻取 + 成绩排序
  const scoreStats = useMemo(() => buildScoreStats(songs, scores), [songs, scores])
  const drilledSongs = useMemo(() => {
    let list = getFilteredSongs(undefined, scoreStats)
    const diffsOf = (s: typeof list[number]) => [...s.difficulties.standard, ...s.difficulties.dx]

    if (drill.level) list = list.filter((s) => diffsOf(s).some((d) => d.level === drill.level))
    if (drill.lv != null) list = list.filter((s) => diffsOf(s).some((d) => d.levelIndex === drill.lv))
    if (drill.genre) list = list.filter((s) => s.genre === drill.genre)
    if (drill.played) {
      const played = drill.played
      list = list.filter((s) => scores.some((sc) => sc.songId === s.id && matchRateValue(sc, played)))
    }
    return list
    // advancedFilters / sortBy / sortOrder 变化时重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, scores, scoreStats, drill, getFilteredSongs, advancedFilters, sortBy, sortOrder])

  if (!stats) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 text-center text-sm text-text-secondary mb-4">
        曲库加载中…
      </div>
    )
  }

  const maxRateCount = Math.max(...stats.rateDist.map(r => r.count), 1)

  return (
    <div className="space-y-3 mb-4">
      {/* 常驻 Rating 进度卡 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-text-secondary font-medium">Rating</p>
          <span className="text-xs text-text-tertiary tabular-nums">理论 SSS+ {theoryMax}</span>
        </div>
        <p className="text-2xl font-bold text-text tabular-nums mt-1">{ratingNoAp.toFixed(0)}</p>
        <div className="w-full bg-bg-gray rounded-full h-2 mt-2">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(ratingProgress, 100)}%` }}
          />
        </div>
        <p className="text-xs text-text-secondary mt-1 text-right tabular-nums">{ratingProgress.toFixed(1)}%</p>
      </div>

      {/* 维度 Tab */}
      <div className="flex gap-1.5 flex-wrap">
        {DIMENSION_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => handleDimensionChange(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer border-none transition-colors ${
              dimension === t.value ? 'bg-primary text-white' : 'bg-bg-gray text-text-secondary hover:bg-primary/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 值标签行（横向滚动） */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
        {dimension === 'rate'
          ? (valueTabs as typeof RATE_GROUPS).map((group, gi) => (
              <Fragment key={group.title}>
                {gi > 0 && <span className="w-px h-5 bg-border shrink-0 mx-1" />}
                {group.tabs.map(t => (
                  <TabButton key={t.value} label={t.label} active={value === t.value} onClick={() => setValue(t.value)} />
                ))}
              </Fragment>
            ))
          : (valueTabs as { value: string; label: string }[]).map(t => (
              <TabButton key={t.value} label={t.label} active={value === t.value} onClick={() => setValue(t.value)} />
            ))}
      </div>

      {/* 难度二级筛选行（仅达成等级/曲包维度） */}
      {showDifficultyRow && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
          <span className="text-xs text-text-tertiary shrink-0 mr-0.5">难度</span>
          {DIFFICULTY_TABS.map(t => (
            <TabButton
              key={t.value}
              label={t.label}
              active={difficultyActive(t)}
              onClick={() => setDifficulty(t.value === 'all' ? 'all' : Number(t.value) as LevelIndex)}
            />
          ))}
        </div>
      )}

      {/* 统计卡（点击钻取曲目列表） */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 曲目总数 */}
        <button
          onClick={() => applyDrill(baseDrill())}
          className="bg-surface border border-border rounded-lg p-4 text-left cursor-pointer hover:border-primary hover:shadow-sm transition-all"
        >
          <p className="text-xs text-text-secondary mb-1.5 font-medium">曲目总数</p>
          <p className="text-2xl font-bold text-text tabular-nums">{stats.totalSongs}</p>
          <div className="w-full bg-bg-gray rounded-full h-1.5 mt-2">
            <div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${stats.playRate}%` }} />
          </div>
          <p className="text-xs text-text-secondary mt-1 tabular-nums">已游玩 {stats.playedSongs} 首（{stats.playRate}%）</p>
        </button>

        {/* 平均达成率 */}
        <button
          onClick={() => applyDrill(baseDrill())}
          className="bg-surface border border-border rounded-lg p-4 text-left cursor-pointer hover:border-primary hover:shadow-sm transition-all"
        >
          <p className="text-xs text-text-secondary mb-1.5 font-medium">平均达成率</p>
          <p className="text-2xl font-bold text-text tabular-nums">{stats.avgAchievement.toFixed(2)}<span className="text-sm text-text-secondary font-medium">%</span></p>
          <p className="text-xs text-text-tertiary mt-2">SSS+ {stats.rateDist[0].count} 首</p>
        </button>

        {/* AP 数量 */}
        <button
          onClick={() => applyDrill({ played: 'ap' })}
          className="bg-surface border border-border rounded-lg p-4 text-left cursor-pointer hover:border-primary hover:shadow-sm transition-all"
        >
          <p className="text-xs text-text-secondary mb-1.5 font-medium">AP</p>
          <p className="text-2xl font-bold text-success tabular-nums">{stats.apCount}</p>
          <p className="text-xs text-text-tertiary mt-2">AP+ {stats.apPlusCount} 首</p>
        </button>

        {/* 最高定数 */}
        <button
          onClick={() => applyDrill(baseDrill())}
          className="bg-surface border border-border rounded-lg p-4 text-left cursor-pointer hover:border-primary hover:shadow-sm transition-all"
        >
          <p className="text-xs text-text-secondary mb-1.5 font-medium">最高定数</p>
          <p className="text-2xl font-bold text-text tabular-nums">{stats.maxLevelValue > 0 ? stats.maxLevelValue.toFixed(1) : '—'}</p>
          <p className="text-xs text-text-tertiary mt-2 truncate">{stats.maxLevelTitle || '暂无成绩'}</p>
        </button>
      </div>

      {/* 评级分布（全宽） */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-xs text-text-secondary mb-3 font-medium">评级分布</p>
        <div className="space-y-2">
          {stats.rateDist.map(r => (
            <button
              key={r.key}
              onClick={() => applyDrill({ played: r.key })}
              className="w-full flex items-center gap-2 cursor-pointer border-none bg-transparent p-0 text-left group"
            >
              <span className="w-10 text-xs font-medium text-text-secondary shrink-0">{r.label}</span>
              <div className="flex-1 bg-bg-gray rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${(r.count / maxRateCount) * 100}%`, background: RATE_BAR_COLORS[r.key] }}
                />
              </div>
              <span className="text-xs tabular-nums text-text font-medium w-6 text-right shrink-0">{r.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 匹配曲目：筛选 + 排序与检索页共用，点击统计卡在此就地筛选 */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">匹配曲目</p>
            {Object.keys(drill).length > 0 && (
              <button
                onClick={() => setDrill({})}
                className="text-[11px] text-primary hover:underline cursor-pointer border-none bg-transparent p-0"
              >
                清除钻取条件
              </button>
            )}
          </div>
          <div className="flex gap-1.5">
            <SongSortBar compact />
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border transition-colors cursor-pointer
                ${showFilters ? 'bg-primary text-white border-primary' : 'bg-surface text-text-secondary border-border hover:border-primary'}`}
              title="筛选"
            >
              <SlidersHorizontal size={13} />筛选
            </button>
          </div>
        </div>

        {showFilters && <SongFilterPanel />}

        <SongResultList songs={drilledSongs} pageSize={20} />
      </div>
    </div>
  )
}
