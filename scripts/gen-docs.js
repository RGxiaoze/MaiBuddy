/**
 * Build script: docs/*.md → docs-index.json
 * Reads all markdown files from docs/ and outputs public/docs-index.json
 *
 * Usage: node scripts/gen-docs.js
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS_DIR = resolve(ROOT, 'docs')
const OUTPUT = resolve(ROOT, 'public/docs-index.json')

// ---- Read & parse docs ----

// 暂时下架：含五维分析内容的文档。
// 五维板块尚未验证（见 src/config/features.ts 的 ENABLE_DIMENSION_ANALYSIS），
// 板块开放前这些文档不得出现在线上 /docs 页。恢复时清空本集合即可。
const HIDDEN_DOCS = new Set([
  '01-需求规格.md',
  '04-执行步骤.md',
  '05-算法详解.md',
  'algorithms.md',
  'knowledge-base.md',
  'progress-report.md',
  'project-brief.md',
  '谱面分析-构建流程.md',
  '谱面分析-集成方案.md',
  '谱面分析-数据格式约定.md',
  '谱面分析-特征定义.md',
  '谱面分析-验证方法.md',
])

const allFiles = readdirSync(DOCS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()

const files = allFiles.filter((f) => !HIDDEN_DOCS.has(f))

// 防漏：未下架的文档里若仍出现「五维」，说明新增了一篇五维相关文档却没登记
const leaked = files.filter((f) => readFileSync(resolve(DOCS_DIR, f), 'utf-8').includes('五维'))
if (leaked.length > 0) {
  console.warn('⚠ 以下文档含「五维」但未列入 HIDDEN_DOCS：')
  leaked.forEach((f) => console.warn(`    ${f}`))
}

const docs = files.map((filename) => {
  const filePath = resolve(DOCS_DIR, filename)
  const raw = readFileSync(filePath, 'utf-8')

  // Extract title from first `# Title` line
  const titleMatch = raw.match(/^#\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '')

  return {
    path: filename,
    title,
    content: raw,
  }
})

// ---- Output ----

mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, JSON.stringify(docs, null, 2), 'utf-8')

console.log(`✓ Docs index built: ${OUTPUT}`)
console.log(`  Files: ${docs.length}（已下架 ${allFiles.length - files.length} 份含五维内容的文档）`)
docs.forEach((d) => console.log(`    ${d.path} → ${d.title}`))
