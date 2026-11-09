/**
 * Build script: Git log → 静态 TS 模块
 * 生成 src/data/changelog.generated.ts
 *
 * 早先是写 public/changelog.json 再由前端 fetch，但 CI 走的是
 * `npx vite build`（不触发 prebuild），产物里根本没有这个文件 → 线上 404。
 * 现在改为编译期静态导入：数据直接打进 bundle，不依赖任何运行时请求。
 *
 * 只收录 feat / fix：docs 是开发日志类的内部提交，对用户没有信息量。
 *
 * Usage: node scripts/gen-changelog.js
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUTPUT = resolve(ROOT, 'src/data/changelog.generated.ts')

// ---- Run git log ----

const raw = execSync(
  'git log --no-merges --format="%h%x00%ad%x00%s" --date=short',
  { cwd: ROOT, encoding: 'utf-8' }
)

// ---- Parse & filter ----

const typeLabels = {
  feat: { label: '新功能', color: 'green' },
  fix:  { label: '修复',   color: 'amber' },
}

const entries = []
const dateMap = new Map()

for (const line of raw.trim().split('\n')) {
  if (!line) continue
  const [hash, date, ...subjectParts] = line.split('\x00')
  const subject = subjectParts.join('\x00')

  // Only include feat:/fix: commits
  const match = subject.match(/^(feat|fix):\s*(.+)/)
  if (!match) continue

  const [, type, message] = match

  if (!dateMap.has(date)) {
    dateMap.set(date, { date, commits: [] })
  }
  dateMap.get(date).commits.push({
    hash,
    type,
    message,
    label: typeLabels[type].label,
    color: typeLabels[type].color,
  })
}

// Convert map to sorted array (newest first)
const sortedEntries = [...dateMap.values()]
  .sort((a, b) => b.date.localeCompare(a.date))

// ---- Output ----

const banner = `// 自动生成，请勿手改。
// 重新生成：npm run gen:changelog

export interface ChangelogCommit {
  hash: string
  type: string
  message: string
  label: string
  color: string
}

export interface ChangelogEntry {
  date: string
  commits: ChangelogCommit[]
}

`

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(
  OUTPUT,
  `${banner}export const CHANGELOG: ChangelogEntry[] = ${JSON.stringify(sortedEntries, null, 2)}\n`,
  'utf-8'
)

const totalCommits = sortedEntries.reduce((sum, e) => sum + e.commits.length, 0)
console.log(`✓ Changelog built: ${OUTPUT}`)
console.log(`  Days: ${sortedEntries.length}, Commits: ${totalCommits}`)
