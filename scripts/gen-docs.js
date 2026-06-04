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

const files = readdirSync(DOCS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort()

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
console.log(`  Files: ${docs.length}`)
docs.forEach((d) => console.log(`    ${d.path} → ${d.title}`))
