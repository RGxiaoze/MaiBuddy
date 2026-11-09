// ============================================================
// 落雪（LXNS）CSV 成绩格式
//
// 列：id,song_name,level,level_index,achievements,fc,fs,
//     dx_score,dx_rating,rate,song_type,upload_time,play_time
//
// • id 是基础 ID，标准与 DX 谱面共用一个 ID，靠 song_type 区分
//   （本项目曲库来自水鱼，DX 为独立条目，换算在 toDfScores 里完成）
// • 曲名可能含逗号与双引号（"" 转义），必须按 RFC 4180 解析
// ============================================================

import type { LxnsScore } from '@/types'
import type { ScoreRecord } from '@/db/database'

export const LXNS_CSV_HEADER =
  'id,song_name,level,level_index,achievements,fc,fs,dx_score,dx_rating,rate,song_type,upload_time,play_time'

const COLUMNS = LXNS_CSV_HEADER.split(',')

/**
 * RFC 4180 解析：支持引号包裹、`""` 转义、CRLF 与 BOM。
 * @returns 行 × 列 的二维数组（已丢弃全空行）
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // 丢弃完全空白的行（末尾换行、空行）
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** 数字字段解析；空或非法返回 null */
function toNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * 解析落雪导出的成绩 CSV。
 * 表头不符、或关键字段（id / level_index / achievements）缺失的行会被跳过。
 */
export function parseLxnsScores(text: string): LxnsScore[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []

  const header = rows[0].map((h) => h.trim())
  if (!COLUMNS.every((c) => header.includes(c))) return []

  const at = (name: string) => header.indexOf(name)
  const idx = {
    id: at('id'),
    level: at('level'),
    levelIndex: at('level_index'),
    achievements: at('achievements'),
    fc: at('fc'),
    fs: at('fs'),
    dxScore: at('dx_score'),
    dxRating: at('dx_rating'),
    rate: at('rate'),
    songType: at('song_type'),
    playTime: at('play_time'),
  }

  const out: LxnsScore[] = []
  for (const row of rows.slice(1)) {
    const id = toNumber(row[idx.id])
    const levelIndex = toNumber(row[idx.levelIndex])
    const achievements = toNumber(row[idx.achievements])
    if (id === null || levelIndex === null || achievements === null) continue

    out.push({
      id,
      level_index: levelIndex,
      achievements,
      type: row[idx.songType]?.trim() === 'dx' ? 'dx' : 'standard',
      level: row[idx.level]?.trim() || undefined,
      fc: row[idx.fc]?.trim() || null,
      fs: row[idx.fs]?.trim() || null,
      dx_score: toNumber(row[idx.dxScore]) ?? 0,
      dx_rating: toNumber(row[idx.dxRating]) ?? 0,
      rate: row[idx.rate]?.trim() ?? '',
      play_time: row[idx.playTime]?.trim() || null,
    })
  }

  return out
}

/** 需要加引号的字段：含逗号、引号、换行，或首尾有空白 */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/** `YYYY-MM-DD HH:mm:ss`（落雪使用当地时间，不带时区） */
function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

/**
 * 生成与落雪导出格式一致的 CSV，可直接回流到落雪。
 * 曲目 ID 取余回基础 ID，标准 / DX 由 song_type 区分。
 */
export function buildLxnsCsv(scores: ScoreRecord[], now = new Date()): string {
  const uploadTime = formatDateTime(now)

  const lines = scores.map((s) => {
    const baseId = s.songId >= 10000 && s.songId < 100000 ? s.songId % 10000 : s.songId
    const playTime = s.playDate ? `${s.playDate.slice(0, 10)} 00:00:00` : ''
    const row = [
      String(baseId),
      s.songTitle,
      s.level,
      String(s.levelIndex),
      String(s.achievements),
      s.fcType ?? '',
      s.fsType ?? '',
      String(s.dxScore),
      String(Math.floor(s.dxRating)),
      s.rate ?? '',
      s.songType === 'dx' ? 'dx' : 'standard',
      uploadTime,
      playTime,
    ]
    return row.map(escapeField).join(',')
  })

  return [LXNS_CSV_HEADER, ...lines].join('\n')
}
