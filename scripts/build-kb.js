/**
 * Build script: Markdown knowledge base → JSON
 * Parses docs/knowledge-base.md and outputs public/data/kb.json
 *
 * Usage: node scripts/build-kb.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const INPUT = resolve(ROOT, 'docs/knowledge-base.md')
const OUTPUT = resolve(ROOT, 'public/data/kb.json')

// ---- Parse logic ----

function parse(md) {
  const lines = md.split('\n')
  const result = {
    ladderStrategies: {},
    achievements: {},
  }

  let section = null    // 'ladder' | 'achievements' | null
  let subsection = null // rating range string or achievement name
  let contentLines = []

  function flush() {
    if (!section || !subsection) return
    const content = contentLines.join('\n').trim()
    if (!content) return

    if (section === 'ladder') {
      // Handle "15400+" format (no upper bound)
      const isOpenEnded = subsection.endsWith('+')
      const clean = isOpenEnded ? subsection.slice(0, -1) : subsection
      const [minStr, maxStr] = clean.split('-').map(s => parseInt(s, 10))
      result.ladderStrategies[subsection] = {
        min: minStr,
        max: isOpenEnded ? 999999 : maxStr,
        content,
      }
    } else if (section === 'achievements') {
      result.achievements[subsection] = {
        name: subsection,
        content,
      }
    }

    contentLines = []
  }

  for (const line of lines) {
    // H2: ## section
    if (line.startsWith('## ')) {
      flush()
      const title = line.slice(3).trim()
      if (title.includes('定数') || title.includes('策略') || title.includes('阶梯')) {
        section = 'ladder'
      } else if (title.includes('成就') || title.includes('牌子')) {
        section = 'achievements'
      } else {
        section = null
      }
      subsection = null
      continue
    }

    // H3: ### subsection
    if (line.startsWith('### ')) {
      flush()
      subsection = line.slice(4).trim()
      continue
    }

    // Skip H1
    if (line.startsWith('# ')) continue

    // Content
    if (subsection !== null) {
      contentLines.push(line)
    }
  }

  flush()
  return result
}

// ---- Main ----

const md = readFileSync(INPUT, 'utf-8')
const json = parse(md)

// Ensure output directory exists
mkdirSync(dirname(OUTPUT), { recursive: true })

writeFileSync(OUTPUT, JSON.stringify(json, null, 2), 'utf-8')
console.log(`✓ Knowledge base built: ${OUTPUT}`)
console.log(`  Strategies: ${Object.keys(json.ladderStrategies).length} tiers`)
console.log(`  Achievements: ${Object.keys(json.achievements).length} entries`)
