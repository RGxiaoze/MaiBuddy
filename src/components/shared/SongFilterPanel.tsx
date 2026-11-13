// ============================================================
// SongFilterPanel — 高级筛选面板
//
// 检索页与统计页共用。状态直接读写 songStore，
// 所以两个页面天然共享同一份筛选条件。
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { useSongStore, songVersionLabel } from '@/store/songStore'
import MultiSelect from './MultiSelect'
import { LEVEL_INDEX_MAP } from '@/data/constants'
import { VERSION_ORDER } from '@/data/versions'
import { isInstallYearLoaded, loadInstallYear } from '@/services/installYearService'
import { isStatsLoaded, loadStats, getMaxFitDiffValue } from '@/services/statsService'
import { buildLevelValueGroups, isLevelValueRangeValid } from '@/utils/levelRange'
import type { FitDiffSource } from '@/types'

/** 拟合定数的两个口径，标注与详情页一致 */
const FIT_SOURCES: { value: FitDiffSource; label: string; hint: string }[] = [
  { value: 'sssPlus', label: 'SSS+', hint: '水鱼 fit_diff：全服达成率拟合出的理论定数' },
  { value: 'sss', label: 'SSS', hint: '项目自算：以 SSS 达成率为锚点拟合' },
]

/** 等级标签排序权重："13" → 13，"13+" → 13.5 */
const levelWeight = (level: string) => parseFloat(level) + (level.endsWith('+') ? 0.5 : 0)

export default function SongFilterPanel() {
  const songs = useSongStore((s) => s.songs)
  const advancedFilters = useSongStore((s) => s.advancedFilters)
  const setAdvancedFilters = useSongStore((s) => s.setAdvancedFilters)
  const resetFilters = useSongStore((s) => s.resetFilters)
  const bumpStatsEpoch = useSongStore((s) => s.bumpStatsEpoch)

  // 版本筛选依赖实装年数据（DX 时代用国服版本名）。
  // 曲库页不会调用 loadStats，必须在这里主动加载，否则会回退到日服版本名。
  const [yearReady, setYearReady] = useState(isInstallYearLoaded())
  useEffect(() => {
    if (yearReady) return
    loadInstallYear().then(() => setYearReady(isInstallYearLoaded()))
  }, [yearReady])

  const versions = useMemo(() => {
    const set = new Set<string>()
    for (const s of songs) {
      if (s.from) set.add(songVersionLabel(s))
    }
    // 旧框（日服名）按 VERSION_ORDER 排在前面，国服版本按年份排在后面。
    // 注意必须**先**解析国服年份：VERSION_ORDER 里残留 '舞萌DX 2021/2022/2023'
    // 这类旧键（值为 8020/8030/8040），与年份编号不连续，混用会导致排序错乱。
    const rank = (label: string): number => {
      const m = label.match(/^舞萌DX(?: (\d{4}))?$/)
      if (m) return 8000 + (m[1] ? Number(m[1]) - 2020 : 0)
      return VERSION_ORDER.get(label) ?? 9999
    }
    return [...set].sort((a, b) => rank(a) - rank(b))
    // yearReady 变化时重新计算：实装年加载完成后标签会从日服名切到国服名
  }, [songs, yearReady])

  // 按拟合定数筛选要读全服统计（chart_stats）。曲库页平时不加载它 ——
  // 只在勾选了拟合口径时才拉，拉完递增 statsEpoch 让列表重算。
  const fitSource = advancedFilters.fitDiffSource
  const [statsReady, setStatsReady] = useState(isStatsLoaded())
  useEffect(() => {
    if (!fitSource || statsReady || songs.length === 0) return
    const officialLevelMap = new Map<string, number>()
    for (const s of songs) {
      for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (d.levelValue > 0) officialLevelMap.set(`${s.id}-${d.levelIndex}`, d.levelValue)
      }
    }
    loadStats(officialLevelMap)
      .then(() => {
        setStatsReady(isStatsLoaded())
        if (isStatsLoaded()) bumpStatsEpoch()
      })
      .catch(() => setStatsReady(isStatsLoaded()))
  }, [fitSource, statsReady, songs, bumpStatsEpoch])

  const genres = useMemo(() => {
    const set = new Set(songs.map((s) => s.genre).filter(Boolean))
    return [...set].sort()
  }, [songs])

  // 官标等级档位（1…15+），从曲库动态生成。
  // 排除「?」（宴会场占位）与「12+?」这类定数未确认的标签 —— 它们不是一个可用档位，
  // 需要精确查找时用「最低/最高定数」或搜索。
  const levels = useMemo(() => {
    const set = new Set<string>()
    for (const s of songs) {
      for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (d.level && !d.level.includes('?')) set.add(d.level)
      }
    }
    return [...set].sort((a, b) => levelWeight(a) - levelWeight(b))
  }, [songs])

  // 定数下拉的上限由数据决定，不写死：
  // 官方口径取曲库实际最大定数；拟合口径取 chart_stats 里的最大拟合值
  // （getMaxFitDiffValue 读的就是 _fitDiffAvgs 的最大键），未就绪时退回官方上限。
  const maxOfficialLevelValue = useMemo(() => {
    let max = 0
    for (const s of songs) {
      for (const d of [...s.difficulties.standard, ...s.difficulties.dx]) {
        if (d.levelValue > max) max = d.levelValue
      }
    }
    return max
  }, [songs])

  const levelValueMax = useMemo(
    () => (fitSource ? (getMaxFitDiffValue() ?? maxOfficialLevelValue) : maxOfficialLevelValue),
    [fitSource, maxOfficialLevelValue, statsReady],
  )

  const levelValueGroups = useMemo(() => buildLevelValueGroups(levelValueMax), [levelValueMax])

  // 只判断、不纠正：填反了由用户自己改，界面负责标红与说明
  const rangeValid = isLevelValueRangeValid(
    advancedFilters.levelValueMin,
    advancedFilters.levelValueMax,
  )

  return (
    <div className="bg-bg-gray border border-border rounded-lg p-4 mb-6 space-y-3">
      {/* 拟合定数口径：勾选后下面的等级与定数条件改比对拟合值 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={!!fitSource}
            onChange={(e) => setAdvancedFilters({ fitDiffSource: e.target.checked ? 'sssPlus' : undefined })}
            className="accent-primary"
          />
          按拟合定数筛选
        </label>
        {fitSource && (
          <>
            <div className="flex items-center gap-3">
              {FIT_SOURCES.map(({ value, label, hint }) => (
                <label key={value} className="flex items-center gap-1 text-text-secondary cursor-pointer" title={hint}>
                  <input
                    type="radio"
                    name="fit-diff-source"
                    checked={fitSource === value}
                    onChange={() => setAdvancedFilters({ fitDiffSource: value })}
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
            <span className="text-text-tertiary">
              {statsReady ? '等级与定数改为按拟合值匹配' : '全服统计加载中…'}
            </span>
          </>
        )}
      </div>

      {/* 等级（官标档位） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          {fitSource ? '拟合等级' : '等级'}
          <select
            value={advancedFilters.level ?? ''}
            onChange={(e) => setAdvancedFilters({ level: e.target.value || undefined })}
            className="px-2 py-1.5 rounded border border-border text-sm bg-surface focus:outline-none focus:border-primary"
          >
            <option value="">全部等级</option>
            {levels.map((lv) => (
              <option key={lv} value={lv}>{lv}</option>
            ))}
          </select>
        </label>
      </div>

      {/* 定数范围 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          {fitSource ? '拟合最低定数' : '最低定数'}
          <select
            value={advancedFilters.levelValueMin ?? ''}
            onChange={(e) => setAdvancedFilters({ levelValueMin: e.target.value ? parseFloat(e.target.value) : undefined })}
            className={`px-2 py-1.5 rounded border text-sm bg-surface focus:outline-none ${rangeValid ? 'border-border focus:border-primary' : 'border-error'}`}
          >
            <option value="">不限</option>
            {levelValueGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.values.map((v) => (
                  <option key={v} value={v}>{v.toFixed(1)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          {fitSource ? '拟合最高定数' : '最高定数'}
          <select
            value={advancedFilters.levelValueMax ?? ''}
            onChange={(e) => setAdvancedFilters({ levelValueMax: e.target.value ? parseFloat(e.target.value) : undefined })}
            className={`px-2 py-1.5 rounded border text-sm bg-surface focus:outline-none ${rangeValid ? 'border-border focus:border-primary' : 'border-error'}`}
          >
            <option value="">不限</option>
            {levelValueGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.values.map((v) => (
                  <option key={v} value={v}>{v.toFixed(1)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {!rangeValid && (
            <span className="text-[11px] text-error">最低定数高于最高定数，区间未生效，请修正</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          版本
          <MultiSelect
            placeholder="全部版本"
            options={versions.map((v) => ({ value: v, label: v }))}
            selected={advancedFilters.versions ?? []}
            onChange={(next) => setAdvancedFilters({ versions: next.length > 0 ? next : undefined })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          分类
          <select
            value={advancedFilters.genre ?? ''}
            onChange={(e) => setAdvancedFilters({ genre: e.target.value || undefined })}
            className="px-2 py-1.5 rounded border border-border text-sm bg-surface focus:outline-none focus:border-primary"
          >
            <option value="">全部分类</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          难度
          <MultiSelect
            placeholder="全部难度"
            options={Object.entries(LEVEL_INDEX_MAP).map(([idx, { label }]) => ({ value: idx, label }))}
            selected={(advancedFilters.difficultyLevels ?? []).map(String)}
            onChange={(next) => setAdvancedFilters({
              difficultyLevels: next.length > 0 ? next.map(Number) : undefined,
            })}
          />
        </label>

        {/* 宴会场：没有定数与难度数据，默认不混入列表 */}
        <label className="flex items-center gap-2 text-xs text-text-secondary self-end pb-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!advancedFilters.includeUtage}
            onChange={(e) => setAdvancedFilters({ includeUtage: e.target.checked || undefined })}
            className="w-3.5 h-3.5 rounded border-border cursor-pointer accent-primary"
          />
          显示宴会场
        </label>
      </div>

      <div className="flex justify-end">
        <button
          onClick={resetFilters}
          className="px-3 py-1.5 rounded-md border border-border text-sm text-text-secondary
                     hover:bg-primary/10 transition-colors cursor-pointer"
        >
          重置筛选条件
        </button>
      </div>
    </div>
  )
}
