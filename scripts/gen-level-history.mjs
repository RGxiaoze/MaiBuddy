// ============================================================
// 定数变迁数据生成脚本
//
// 输入：项目资料/song_data.csv
//   列形如「乐曲id,乐曲名,难度,2020定数,2021定数,…,2025定数」
//   约定：定数为 0 表示该难度没有谱面（沿用 2026-11-11 的记录）
// 输出：public/data/level-history.json.gz
//   只保存「变化点」：{ years: [2020,…], songs: { "1736|3": [[2020,12.8],[2023,12.9]] } }
//
// 用法：
//   node scripts/gen-level-history.mjs --dry-run   # 只打印摘要，不写文件
//   node scripts/gen-level-history.mjs             # 生成数据文件
//
// 注意：仓库里没有 xlsx 解析依赖，所以源文件需先另存为 CSV。
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { gzipSync } from 'zlib'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, '项目资料', 'song_data.csv')
const OUTPUT = resolve(ROOT, 'public', 'data', 'level-history.json.gz')

const DRY_RUN = process.argv.includes('--dry-run')

/** 定数比较容差：数据是一位小数，理论上不会有尾数 */
const EPS = 1e-9

/** 最小 CSV 解析：支持双引号包裹与 "" 转义（曲名里可能有逗号） */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') inQuotes = true
    else if (ch === ',') {
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
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 难度列取值 → 0..4。兼容英文名与数字两种写法 */
function parseDifficulty(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null
  if (/^[0-4]$/.test(s)) return Number(s)
  const key = s.replace(/[\s:_-]/g, '')
  if (key === 'basic') return 0
  if (key === 'advanced') return 1
  if (key === 'expert') return 2
  if (key === 'master') return 3
  if (key === 'remaster' || key === 're') return 4
  return null
}

/** 找到含「定数」的表头行，并取出各年份列的位置 */
function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map((c) => String(c).trim())
    const yearCols = []
    cells.forEach((cell, idx) => {
      const m = cell.match(/^(\d{4})\s*定数$/) || cell.match(/^(\d{4})$/)
      if (m) yearCols.push({ year: Number(m[1]), col: idx })
    })
    if (yearCols.length >= 2) {
      const idCol = cells.findIndex((c) => /乐曲\s*id|song\s*id|^id$/i.test(c))
      const diffCol = cells.findIndex((c) => /难度|difficulty/i.test(c))
      if (idCol >= 0 && diffCol >= 0) {
        return { headerIndex: i, cells, idCol, diffCol, yearCols }
      }
    }
  }
  return null
}

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

if (!existsSync(INPUT)) {
  fail(
    `找不到源文件：${INPUT}\n` +
      '  请把 song_data 在 Excel 里另存为 CSV，放到该路径后重跑。\n' +
      '  列格式：乐曲id,乐曲名,难度,2020定数,2021定数,…,2025定数\n' +
      '  约定：定数为 0 表示该难度没有谱面。',
  )
}

const rows = parseCsv(readFileSync(INPUT, 'utf8'))
const header = findHeader(rows)
if (!header) {
  fail(
    '没能从表头找到「乐曲id / 难度 / 20XX定数」三类列。\n' +
      `  前 3 行实际内容：\n${rows.slice(0, 3).map((r) => '    ' + r.join(' | ')).join('\n')}`,
  )
}

const { headerIndex, idCol, diffCol, yearCols } = header
yearCols.sort((a, b) => a.year - b.year)
const years = yearCols.map((y) => y.year)

const songs = {}
const stats = {
  dataRows: 0,
  validCharts: 0,
  changedCharts: 0,
  skippedRows: 0,
  uniqueSongs: new Set(),
  byYear: Object.fromEntries(years.map((y) => [y, 0])),
}

for (let r = headerIndex + 1; r < rows.length; r++) {
  const cells = rows[r]
  if (!cells || cells.every((c) => String(c).trim() === '')) continue
  stats.dataRows += 1

  const songId = Number(String(cells[idCol] ?? '').trim())
  const levelIndex = parseDifficulty(cells[diffCol])
  if (!Number.isFinite(songId) || songId <= 0 || levelIndex == null) {
    stats.skippedRows += 1
    continue
  }

  // 逐年取定数，0/空视为该年还没有这张谱
  const series = []
  for (const { year, col } of yearCols) {
    const raw = String(cells[col] ?? '').trim()
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) continue
    series.push([year, Math.round(value * 10) / 10])
  }
  if (series.length === 0) {
    stats.skippedRows += 1
    continue
  }
  stats.validCharts += 1
  stats.uniqueSongs.add(songId)

  // 只保留变化点
  const points = []
  for (const [year, value] of series) {
    const prev = points.length > 0 ? points[points.length - 1][1] : null
    if (prev == null || Math.abs(prev - value) > EPS) points.push([year, value])
  }

  // 没有变化的不入库（区不显示徽章，省体积）
  if (points.length < 2) continue
  stats.changedCharts += 1
  for (let i = 1; i < points.length; i++) stats.byYear[points[i][0]] += 1
  songs[`${songId}|${levelIndex}`] = points
}

const payload = { years, songs }
const json = JSON.stringify(payload)
const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 })

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
console.log('\n=== 定数变迁数据摘要 ===')
console.log(`源文件          ${INPUT}`)
console.log(`表头行          ${headerIndex + 1}（年份列 ${years.join(', ')}）`)
console.log(`数据行          ${stats.dataRows}`)
console.log(`有效谱面        ${stats.validCharts}`)
console.log(`有变化的谱面    ${stats.changedCharts}（${((stats.changedCharts / Math.max(stats.validCharts, 1)) * 100).toFixed(1)}%）`)
console.log(`唯一曲目        ${stats.uniqueSongs.size}`)
console.log(`跳过行          ${stats.skippedRows}`)
console.log(`各年发生变更    ${years.map((y) => `${y}:${stats.byYear[y]}`).join('  ')}`)
console.log(`输出体积        ${kb(gz.length)}（压缩前 ${kb(json.length)}）`)

if (stats.changedCharts === 0) {
  fail('没有解析出任何「发生过变化」的谱面，数据或列映射可能不对，已中止。')
}

if (DRY_RUN) {
  console.log('\n--dry-run：未写入文件。去掉该参数即可生成。\n')
} else {
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, gz)
  console.log(`\n✓ 已写入 ${OUTPUT}\n`)
}
