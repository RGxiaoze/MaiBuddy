// ============================================================
// AWMC vs 水鱼 拟合定数分歧分析
//
// 用已抓取的 300 个样本，按定数档 / 谱面类型 / 难度拆解两个独立来源的差异。
// 用法: node scripts/analyze-awmc.cjs
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.resolve(__dirname, '..')
const TAGS_PATH = path.join(ROOT, '项目资料', 'awmc-tags.local.json')

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

const tierOf = (lv) => {
  const base = Math.floor(lv)
  return base + (lv - base >= 0.6 ? '+' : '')
}

function summarize(rows) {
  const d = rows.map((r) => r.delta)
  const mean = d.reduce((a, b) => a + b, 0) / d.length
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / d.length)
  return { n: d.length, mean, sd }
}

function groupBy(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
}

async function main() {
  const tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'))
  const df = await get('https://www.diving-fish.com/api/maimaidxprober/music_data')
  const stats = (await get('https://www.diving-fish.com/api/maimaidxprober/chart_stats')).charts

  const byId = new Map(df.map((s) => [Number(s.id), s]))
  const rows = []

  for (const [key, v] of Object.entries(tags)) {
    const p = key.split(':')
    const songId = Number(p[0])
    const kind = p[1]
    const difficulty = Number(p[2])
    const dfId = kind === 'dx' ? songId + 10000 : songId
    const song = byId.get(dfId) || byId.get(songId)
    const lv = song && song.ds ? song.ds[difficulty - 2] : undefined
    if (typeof lv !== 'number') continue

    const arr = stats[String(dfId)] || stats[String(songId)] || []
    const st = arr[difficulty - 2]
    const cls = v.tags && v.tags.difficultyClassification
    if (!st || !cls) continue

    rows.push({
      key,
      kind,
      difficulty,
      levelValue: lv,
      tier: tierOf(lv),
      awmc: cls.estimatedLevel,
      fish: Number(st.fit_diff),
      cnt: Number(st.cnt) || 0,
      cat: cls.tag,
      delta: cls.estimatedLevel - Number(st.fit_diff),
    })
  }

  console.log(`配对样本 ${rows.length}\n`)

  const total = summarize(rows)
  console.log(`总体  n=${total.n}  均值=${total.mean.toFixed(3)}  标准差=${total.sd.toFixed(3)}`)
  console.log(`  分歧 |Δ|≥0.3: ${rows.filter((r) => Math.abs(r.delta) >= 0.3).length}`)
  console.log(`  分类: ${JSON.stringify(count(rows.map((r) => r.cat)))}\n`)

  console.log('按定数档（Δ = AWMC − 水鱼，正=AWMC 更高估）')
  for (const [tier, list] of groupBy(rows, (r) => r.tier)) {
    const s = summarize(list)
    console.log(`  ${String(tier).padEnd(4)} n=${String(s.n).padStart(3)}  Δ均值=${s.mean.toFixed(3).padStart(7)}  σ=${s.sd.toFixed(3)}`)
  }

  console.log('\n按谱面类型')
  for (const [kind, list] of groupBy(rows, (r) => r.kind)) {
    const s = summarize(list)
    console.log(`  ${kind.padEnd(9)} n=${String(s.n).padStart(3)}  Δ均值=${s.mean.toFixed(3).padStart(7)}  σ=${s.sd.toFixed(3)}`)
  }

  console.log('\n按难度')
  const diffName = { 2: 'Basic', 3: 'Adv', 4: 'Expert', 5: 'Master', 6: 'Re:Master' }
  for (const [d, list] of groupBy(rows, (r) => r.difficulty)) {
    const s = summarize(list)
    console.log(`  ${String(diffName[d] || d).padEnd(9)} n=${String(s.n).padStart(3)}  Δ均值=${s.mean.toFixed(3).padStart(7)}  σ=${s.sd.toFixed(3)}`)
  }

  console.log('\n按水鱼样本量四分位（看是否低样本导致分歧）')
  const sorted = [...rows].sort((a, b) => a.cnt - b.cnt)
  const q = Math.floor(sorted.length / 4)
  const quartiles = [sorted.slice(0, q), sorted.slice(q, q * 2), sorted.slice(q * 2, q * 3), sorted.slice(q * 3)]
  quartiles.forEach((list, i) => {
    const s = summarize(list)
    const lo = list[0].cnt
    const hi = list[list.length - 1].cnt
    console.log(`  Q${i + 1} n=${String(s.n).padStart(3)}  样本 ${Math.round(lo)}–${Math.round(hi)}  Δ均值=${s.mean.toFixed(3).padStart(7)}  σ=${s.sd.toFixed(3)}`)
  })

  console.log('\n分歧最大的 8 个')
  for (const r of [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8)) {
    console.log(`  ${r.key.padEnd(16)} 官标 ${r.levelValue.toFixed(1)}  AWMC ${r.awmc.toFixed(2)}  水鱼 ${r.fish.toFixed(2)}  Δ ${r.delta.toFixed(2).padStart(6)}  [${r.cat}]`)
  }
}

function count(arr) {
  const m = {}
  for (const x of arr) m[x] = (m[x] || 0) + 1
  return m
}

main().catch((e) => { console.error(e.message); process.exit(1) })
