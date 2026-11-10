// ============================================================
// B50 地板诊断：用落雪格式 CSV 算出某个账号的 B35 / B15 地板
//
// 用途：推荐列表天然只含「定数 × 22.4 > 地板」的谱面，
// 这个脚本把地板和临界定数量化出来。
//
// 用法: node scripts/b50-floor.cjs cike.csv
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const B35_SIZE = 35
const B15_SIZE = 15

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume()
        return resolve(get(new URL(res.headers.location, url).toString()))
      }
      let d = ''
      res.on('data', (c) => { d += c })
      res.on('end', () => resolve(JSON.parse(d)))
    }).on('error', reject)
  })
}

/** 最小 CSV 解析：支持双引号包裹与转义 */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row) }
  return rows
}

async function main() {
  const csvPath = process.argv[2] || 'cike.csv'
  const text = fs.readFileSync(path.resolve(csvPath), 'utf8')
  const rows = parseCsv(text)
  const header = rows[0].map((h) => h.trim())
  const col = (name) => header.indexOf(name)
  const iId = col('id')
  const iLevelIndex = col('level_index')
  const iAch = col('achievements')
  const iDxRating = col('dx_rating')
  const iType = col('song_type')
  const iLevel = col('level')
  if (iId < 0 || iDxRating < 0) throw new Error(`CSV 缺少必要列，表头: ${header.join(',')}`)

  // 同一谱面取最高成绩
  const best = new Map()
  for (const r of rows.slice(1)) {
    const id = Number(r[iId])
    const li = Number(r[iLevelIndex])
    if (!Number.isFinite(id) || !Number.isFinite(li)) continue
    const isDx = String(r[iType]).toLowerCase() === 'dx'
    const songId = isDx ? id + 10000 : id
    const key = `${songId}-${li}`
    const rating = Number(r[iDxRating]) || 0
    const ach = Number(r[iAch]) || 0
    const prev = best.get(key)
    if (!prev || ach > prev.ach) {
      best.set(key, { songId, levelIndex: li, rating, ach, level: r[iLevel], isDx })
    }
  }
  console.log(`成绩条数（去重后）：${best.size}`)

  console.log('拉取水鱼曲库判定新旧版本...')
  const music = await get('https://www.diving-fish.com/api/maimaidxprober/music_data')
  const isNewById = new Map(music.map((s) => [Number(s.id), !!s.basic_info?.is_new]))

  const entries = [...best.values()].map((e) => ({ ...e, isNew: isNewById.get(e.songId) === true }))
  const unknown = entries.filter((e) => !isNewById.has(e.songId))
  if (unknown.length) console.log(`  注意：${unknown.length} 条成绩的曲目在曲库中查不到，按旧曲处理`)

  const oldPool = entries.filter((e) => !e.isNew).sort((a, b) => b.rating - a.rating)
  const newPool = entries.filter((e) => e.isNew).sort((a, b) => b.rating - a.rating)

  const b35 = oldPool.slice(0, B35_SIZE)
  const b15 = newPool.slice(0, B15_SIZE)
  const sum = (arr) => arr.reduce((a, e) => a + e.rating, 0)

  const report = (name, pool, picked, size) => {
    if (picked.length === 0) { console.log(`\n${name}：无成绩`); return 0 }
    const floor = picked[picked.length - 1].rating
    console.log(`\n${name}  ${picked.length}/${size} 首  总分 ${Math.round(sum(picked))}`)
    console.log(`  地板 ${floor.toFixed(2)}（${picked[picked.length - 1].level} ${picked[picked.length - 1].levelIndex}）`)
    console.log(`  临界定数 = 地板 / 22.4 = ${(floor / 22.4).toFixed(2)}`)
    console.log(`  → 定数低于 ${(floor / 22.4).toFixed(2)} 的谱面推满 100% 也进不了这个池`)
    if (pool.length > picked.length) {
      const next = pool[picked.length]
      console.log(`  池外最高：${next.level}（Rating ${next.rating.toFixed(2)}），差地板 ${(floor - next.rating).toFixed(2)}`)
    }
    return floor
  }

  const f35 = report('B35（旧曲池）', oldPool, b35, B35_SIZE)
  const f15 = report('B15（新曲池）', newPool, b15, B15_SIZE)
  console.log(`\n总 Rating ≈ ${Math.round(sum(b35) + sum(b15))}`)

  console.log('\n各定数推满 100% 的 Rating，与地板对比：')
  const floors = [
    ['B35', f35],
    ['B15', f15],
  ].filter(([, f]) => f > 0)
  for (const lv of [13.9, 14.0, 14.3, 14.5, 14.7, 14.8, 14.9]) {
    const r = lv * 22.4
    const marks = floors.map(([n, f]) => `${n} ${r > f ? '✓' : `✗差${(f - r).toFixed(1)}`}`).join('  ')
    console.log(`  ${lv.toFixed(1)} → ${r.toFixed(1)}   ${marks}`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
