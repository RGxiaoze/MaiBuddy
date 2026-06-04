// ============================================================
// Score import — validate JSON file and merge into IndexedDB
// ============================================================

import { bulkUpsertScores, type ScoreRecord } from '@/db/database'

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
 * Import scores from a JSON file.
 * - Reads file as text
 * - Parses and validates JSON structure
 * - Merges with existing scores (keeps higher achievements)
 * - Returns import statistics
 */
export async function importScoresFromFile(file: File): Promise<ImportResult> {
  // Read file
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })

  // Parse JSON
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: 'JSON 格式无效，文件可能已损坏' }] }
  }

  // Validate structure
  const validated = validateStructure(data)
  if (!validated.valid) {
    return { total: 0, imported: 0, updated: 0, skipped: 0, errors: [{ index: -1, message: validated.error }] }
  }

  // Merge into IndexedDB (bulkUpsertScores already keeps max achievements)
  const result = await bulkUpsertScores(validated.scores)
  return result
}
