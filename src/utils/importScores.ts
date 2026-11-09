// ============================================================
// Score import — validate file (JSON backup / LXNS CSV) and merge into IndexedDB
// ============================================================

import { bulkUpsertScores, type ScoreRecord } from '@/db/database'
import { toDfScores } from '@/services/lxnsApi'
import { parseLxnsScores } from '@/utils/lxnsCsv'
import type { Song } from '@/types'

/** Single line-level validation error */
export interface ImportLineError {
  index: number
  message: string
}

/** Result of a file import operation */
export interface ImportResult {
  total: number
  imported: number
  updated: number
  skipped: number
  errors?: ImportLineError[]
}

/**
 * Validate imported JSON structure.
 * Returns parsed scores array if valid, or errors array.
 */
function validateStructure(data: unknown):
  | { valid: true; scores: Omit<ScoreRecord, 'id' | 'createdAt'>[] }
  | { valid: false; error: string }
{
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '文件内容不是有效的 JSON 对象' }
  }

  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.scores)) {
    return { valid: false, error: '缺少 scores 字段或 scores 不是数组' }
  }

  // Validate each score entry
  const scores: Omit<ScoreRecord, 'id' | 'createdAt'>[] = []

  for (let i = 0; i < obj.scores.length; i++) {
    const s = (obj.scores as unknown[])[i] as Record<string, unknown> | undefined

    if (!s || typeof s !== 'object') {
      return { valid: false, error: `第 ${i + 1} 条记录格式无效` }
    }

    // Required: songId
    if (typeof s.songId !== 'number' || !Number.isFinite(s.songId)) {
      return { valid: false, error: `第 ${i + 1} 条: songId 缺失或不是有效数字` }
    }

    // Required: levelIndex
    if (typeof s.levelIndex !== 'number' || s.levelIndex < 0 || s.levelIndex > 4) {
      return { valid: false, error: `第 ${i + 1} 条 (songId=${s.songId}): levelIndex 缺失或不在 0-4 范围` }
    }

    // Required: achievements
    if (typeof s.achievements !== 'number' || s.achievements < 0 || s.achievements > 101) {
      return { valid: false, error: `第 ${i + 1} 条 (songId=${s.songId}): achievements 缺失或不在 0-101 范围` }
    }

    // Optional fields with defaults
    const scoreRecord: Omit<ScoreRecord, 'id' | 'createdAt'> = {
      songId: s.songId,
      songTitle: typeof s.songTitle === 'string' ? s.songTitle : `曲目 #${s.songId}`,
      levelIndex: s.levelIndex,
      level: typeof s.level === 'string' ? s.level : '',
      levelValue: typeof s.levelValue === 'number' ? s.levelValue : 0,
      songType: typeof s.songType === 'string' ? s.songType : 'standard',
      achievements: s.achievements,
      rate: typeof s.rate === 'string' ? s.rate : '',
      fcType: (typeof s.fcType === 'string' ? s.fcType : null) as string | null,
      fsType: (typeof s.fsType === 'string' ? s.fsType : null) as string | null,
      dxScore: typeof s.dxScore === 'number' ? s.dxScore : 0,
      dxRating: typeof s.dxRating === 'number' ? s.dxRating : 0,
      dxScoreDetail: (s.dxScoreDetail && typeof s.dxScoreDetail === 'object'
        ? s.dxScoreDetail as ScoreRecord['dxScoreDetail']
        : null),
      playDate: typeof s.playDate === 'string' ? s.playDate : new Date().toISOString().slice(0, 10),
    }

    scores.push(scoreRecord)
  }

  return { valid: true, scores }
}

/**
 * Import scores from a file.
 * - `.json`：本应用导出的备份文件
 * - `.csv` ：落雪（LXNS）导出的成绩，需曲库补齐定数
 * - 以第一个非空白字符区分（`{` 为 JSON，其余按 CSV 处理）
 * - 与本地成绩合并，保留更高达成率
 */
export async function importScoresFromFile(
  file: File,
  songMap?: Map<number, Song>
): Promise<ImportResult> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })

  const head = text.replace(/^\uFEFF/, '').trimStart()[0]
  if (head !== '{') return importLxnsCsv(text, songMap)

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: 'JSON 格式无效，文件可能已损坏' }] }
  }

  const validated = validateStructure(data)
  if (!validated.valid) {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: validated.error }] }
  }

  const result = await bulkUpsertScores(validated.scores)
  return result
}

/** 落雪 CSV 的行键：与曲库的 ID 方案对齐，用于回填 play_time */

/**
 * Import scores from a LXNS-exported CSV.
 * 落雪 CSV 不含定数，需用本地曲库补齐；补不上的条目丢弃（与在线导入口径一致）。
 */
async function importLxnsCsv(text: string, songMap?: Map<number, Song>): Promise<ImportResult> {
  if (!songMap) {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: 'CSV 导入需要曲库支持，请刷新页面后重试' }] }
  }

  const rows = parseLxnsScores(text)
  if (rows.length === 0) {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: '未识别到落雪成绩 CSV，请确认表头与导出格式' }] }
  }

  // 落雪 ID → 曲库 ID 的换算复用在线导入同一套逻辑（含 play_time → playDate）
  const dfScores = toDfScores(rows, songMap)

  const records: Omit<ScoreRecord, 'id' | 'createdAt'>[] = dfScores.map((d) => ({
    songId: d.songId,
    songTitle: d.title,
    levelIndex: d.levelIndex,
    level: d.level,
    levelValue: d.levelValue,
    songType: d.songType,
    achievements: d.achievements,
    rate: d.rate,
    fcType: d.fcType,
    fsType: d.fsType,
    dxScore: d.dxScore,
    dxRating: d.dxRating,
    dxScoreDetail: null,
    playDate: d.playDate ?? new Date().toISOString().slice(0, 10),
  }))

  const result = await bulkUpsertScores(records)
  return { ...result, skipped: result.skipped + (rows.length - records.length) }
}
