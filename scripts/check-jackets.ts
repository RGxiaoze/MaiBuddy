// ============================================================
// check-jackets — 检测 LXNS 曲绘有效性，生成有效 jacket-map.json
// 用法: npx tsx scripts/check-jackets.ts
// 检测为占位图（<5KB 或无内容）的 ID 从映射中剔除，
// 前端对缺失曲目回退 songId 或显示本地占位。
// ============================================================

import * as fs from 'node:fs'
import * as path from 'node:path'

const FEATURES_PATH = path.resolve('public/data/simai_features.json')
const OUT_PATH = path.resolve('public/data/jacket-map.json')

interface FeaturesFile {
  songs: Record<string, { title: string; musicId: number | null }>
}

function cleanTitle(t: string): string {
  return t.replace(/\s*\[(SD|DX)\]\s*/g, '').trim().toLowerCase()
}

async function main() {
  const features = JSON.parse(fs.readFileSync(FEATURES_PATH, 'utf-8')) as FeaturesFile

  // Build title → musicId (dedup, first wins)
  const map = new Map<string, number>()
  for (const entry of Object.values(features.songs)) {
    if (entry.musicId && !map.has(cleanTitle(entry.title))) {
      map.set(cleanTitle(entry.title), entry.musicId)
    }
  }

  const ids = [...new Set(map.values())]
  console.log(`检测 ${ids.length} 个唯一 jacket ID...`)

  // Batch-check jacket validity (size < 5000 or non-image = placeholder)
  const MIN_SIZE = 5000
  const invalid = new Set<number>()
  const BATCH = 12
  let done = 0

  async function check(id: number): Promise<boolean> {
    const url = `https://assets.lxns.net/maimai/jacket/${id}.png!webp`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) })
      if (!res.ok) return false
      const buf = await res.arrayBuffer()
      return buf.byteLength >= MIN_SIZE
    } catch {
      return false
    }
  }

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(id => check(id).then(ok => ({ id, ok }))))
    for (const { id, ok } of results) {
      if (!ok) invalid.add(id)
    }
    done += batch.length
    if (done % 300 === 0 || done === ids.length) {
      console.log(`  ${done}/${ids.length} (无效 ${invalid.size})`)
    }
  }

  // Write only valid entries
  const out: Record<string, number> = {}
  for (const [title, id] of map) {
    if (!invalid.has(id)) out[title] = id
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(out), 'utf-8')
  console.log(`\n完成: ${map.size} → ${Object.keys(out).length} 有效（剔除 ${invalid.size} 个无效 ID: ${[...invalid].join(',')}）`)
  console.log(`输出: ${OUT_PATH}`)
}

main().catch(err => { console.error(err); process.exit(1) })
