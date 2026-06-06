// ============================================================
// Score entry/edit form — modal overlay
// ============================================================

import { useState, useEffect } from 'react'
import type { Song, LevelIndex, RateType, FCType, FSType, Score } from '@/types'
import { LEVEL_LABELS, FC_LABELS, FS_LABELS, achievementsToRate } from '@/data/constants'
import GradeBadge from '@/components/shared/GradeBadge'
import { useScoreStore } from '@/store/scoreStore'
import { computeRating } from '@/utils/rating'

interface ScoreFormProps {
  song: Song
  defaultLevelIndex?: LevelIndex
  onClose: () => void
  /** Existing score for editing (omit for new entry) */
  existingScore?: Score
}

export default function ScoreForm({ song, defaultLevelIndex = 3, onClose, existingScore }: ScoreFormProps) {
  const addScore = useScoreStore((s) => s.addScore)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDxDetail, setShowDxDetail] = useState(false)

  // Form state
  const [levelIndex, setLevelIndex] = useState<LevelIndex>(
    existingScore?.levelIndex ?? defaultLevelIndex
  )
  const [achievements, setAchievements] = useState<string>(
    existingScore ? String(existingScore.achievements) : ''
  )
  const [fcType, setFcType] = useState<FCType | ''>(existingScore?.fcType ?? '')
  const [fsType, setFsType] = useState<FSType | ''>(existingScore?.fsType ?? '')
  const [playDate, setPlayDate] = useState(
    existingScore?.playDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [dxMax, setDxMax] = useState(
    existingScore?.dxScoreDetail?.maxDx?.toString() ?? ''
  )
  const [dxAchieved, setDxAchieved] = useState(
    existingScore?.dxScoreDetail?.achievedDx?.toString() ?? ''
  )
  const [dxMissed, setDxMissed] = useState(
    existingScore?.dxScoreDetail?.missedDx?.toString() ?? ''
  )

  // Get current chart for display
  const allDiffs = [...song.difficulties.standard, ...song.difficulties.dx]
  const currentDiff = allDiffs.find((d) => d.levelIndex === levelIndex)

  // Auto-fill max DX score when difficulty changes (chart property, not score property)
  useEffect(() => {
    const total = currentDiff?.notes?.total
    if (total && total > 0) {
      setDxMax(String(total * 3))
      setShowDxDetail(true)
    }
  }, [levelIndex, currentDiff?.notes?.total])

  const handleAchievementsBlur = () => {
    const v = parseFloat(achievements)
    if (!isNaN(v) && v >= 0 && v <= 101) {
      setAchievements(v.toFixed(4))
    }
  }

  // Derive rate from achievements
  const derivedRate: RateType | null = (() => {
    const v = parseFloat(achievements)
    return isNaN(v) ? null : achievementsToRate(v)
  })()

  const handleSubmit = async () => {
    setError(null)

    // Validation
    const achievementNum = parseFloat(achievements)
    if (isNaN(achievementNum) || achievementNum < 0 || achievementNum > 101) {
      setError('达成率必须在 0.00 ~ 101.00 之间')
      return
    }
    if (!currentDiff) {
      setError('请选择有效难度')
      return
    }
    if (!playDate) {
      setError('请选择游玩日期')
      return
    }
    // Rating 动态计算（使用当前难度定数 × 达成率）

    const score: Score = {
      songId: song.id,
      songTitle: song.title,
      levelIndex,
      level: currentDiff.level,
      levelValue: currentDiff.levelValue,
      songType: currentDiff.type,
      achievements: achievementNum,
      rate: achievementsToRate(achievementNum),
      fcType: fcType || null,
      fsType: fsType || null,
      dxScore: dxAchieved ? parseInt(dxAchieved, 10) : 0,
      dxRating: computeRating(currentDiff.levelValue, achievementNum, fcType),
      playDate: new Date(playDate).toISOString(),
      dxScoreDetail: dxMax || dxAchieved || dxMissed ? {
        maxDx: parseInt(dxMax, 10) || 0,
        achievedDx: parseInt(dxAchieved, 10) || 0,
        missedDx: parseInt(dxMissed, 10) || 0,
      } : undefined,
    }

    setSubmitting(true)
    try {
      await addScore(score)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-xl shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-text mb-4">
          {existingScore ? '编辑成绩' : '录入成绩'} — {song.title}
        </h3>

        {/* Difficulty */}
        <label className="flex flex-col gap-1 mb-3 text-sm">
          <span className="text-text-secondary">难度</span>
          <select
            value={levelIndex}
            onChange={(e) => setLevelIndex(Number(e.target.value) as LevelIndex)}
            className="px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-primary"
          >
            {([0, 1, 2, 3, 4] as LevelIndex[]).map((idx) => {
              const diff = allDiffs.find((d) => d.levelIndex === idx)
              if (!diff) return null
              return (
                <option key={idx} value={idx}>
                  {LEVEL_LABELS[idx]} — {diff.level} (定数 {diff.levelValue})
                </option>
              )
            })}
          </select>
        </label>

        {/* Achievements */}
        <label className="flex flex-col gap-1 mb-3 text-sm">
          <span className="text-text-secondary">达成率</span>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={0} max={101} step={0.1}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              onBlur={handleAchievementsBlur}
              placeholder="0.00 ~ 101.00"
              className="flex-1 px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
            />
            <span className="text-text-secondary text-xs">%</span>
            {derivedRate && <GradeBadge rate={derivedRate} className="text-xs px-2 py-1" />}
          </div>
        </label>

        {/* FC / FS */}
        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">FC 标记</span>
            <select
              value={fcType}
              onChange={(e) => setFcType(e.target.value as FCType | '')}
              className="px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-primary"
            >
              <option value="">无</option>
              {Object.entries(FC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-secondary">FS 标记</span>
            <select
              value={fsType}
              onChange={(e) => setFsType(e.target.value as FSType | '')}
              className="px-3 py-2 rounded-md border border-border bg-surface text-sm focus:outline-none focus:border-primary"
            >
              <option value="">无</option>
              {Object.entries(FS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Play date */}
        <label className="flex flex-col gap-1 mb-3 text-sm">
          <span className="text-text-secondary">游玩日期</span>
          <input
            type="date"
            value={playDate}
            onChange={(e) => setPlayDate(e.target.value)}
            className="px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
          />
        </label>

        {/* DX Score detail (collapsible) */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowDxDetail(!showDxDetail)}
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            {showDxDetail ? '▾' : '▸'} DX Score 明细（可选）
          </button>
          {showDxDetail && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-secondary text-xs">最大 DX 数</span>
                <input
                  type="number"
                  min={0}
                  value={dxMax}
                  onChange={(e) => setDxMax(e.target.value)}
                  className="px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-secondary text-xs">达成 DX 数</span>
                <input
                  type="number"
                  min={0}
                  value={dxAchieved}
                  onChange={(e) => setDxAchieved(e.target.value)}
                  className="px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-secondary text-xs">丢失 DX 数</span>
                <input
                  type="number"
                  min={0}
                  value={dxMissed}
                  onChange={(e) => setDxMissed(e.target.value)}
                  className="px-3 py-2 rounded-md border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="0"
                />
              </label>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-error mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm text-text-secondary hover:bg-bg-gray transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-primary text-white text-sm hover:bg-primary-dark transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting ? '保存中...' : existingScore ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
