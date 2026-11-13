// ============================================================
// AWMC 曲库摸底：拉全量谱面列表，映射到水鱼定数，统计可抓范围
//
// 目的：AWMC 只有 1336 个谱面（我们曲库有 5436 个），
// 需要先知道它到底覆盖了哪些、定数落在哪。
//
// 输出 awmc-charts.local.json（命中 .gitignore 的 *.local）
// 用法: node scripts/probe-awmc.cjs
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

function readKey() {
  const p = path.resolve(__dirname, '..', '.env.local')
  const m = fs.readFileSync(p, 'utf8').match(/^WMC_API_KEY=(.+)$/m)
  if (!m) throw new Error('.env.local 缺少 WMC_API_KEY')
  return m[1].trim()
}

const KEY = readKey()

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 30000 }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        res.resume()
        return resolve(get(new URL(res.headers.location, url).toString(), headers))
      }
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('超时')))
  })
}

async function main() {
  console.log('拉取 AWMC 谱面列表...')
  const all = []
  let page = 1
  let total = Infinity
  while (all.length < total) {
    const res = await get(`https://v.wmc.pub/api/v1/charts?page=${page}&limit=50`, {
      Authorization: `Bearer ${KEY}`,
    })
    if (res.status !== 200) throw new Error(`列表 HTTP ${res.status}`)
    const data = JSON.parse(res.body)
    total = data.total
    if (!data.items || data.items.length === 0) break
    all.push(...data.items)
    page++
    process.stdout.write(`\r  ${all.length}/${total} `)
  }
  process.stdout.write('\n')
  const dataDir = path.resolve(__dirname, '..', '项目资料')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'awmc-charts.local.json'), JSON.stringify(all), 'utf8')
  console.log(`共 ${all.length} 个谱面，已存 项目资料/awmc-charts.local.json`)

  console.log('拉取水鱼曲库做 ID 映射...')
  const dfRes = await get('https://www.diving-fish.com/api/maimaidxprober/music_data')
  const df = JSON.parse(dfRes.body)
  const byId = new Map(df.map((s) => [Number(s.id), s]))

  let mapped = 0
  for (const c of all) {
    const dfId = c.kind === 'dx' ? c.songId + 10000 : c.songId
    const song = byId.get(dfId) || byId.get(c.songId)
    const lv = song && song.ds ? song.ds[c.difficulty - 2] : undefined
    if (typeof lv === 'number') {
      c.levelValue = lv
      mapped++
    }
  }
  console.log(`定数映射成功 ${mapped}/${all.length}`)

  const inRange = all.filter((c) => typeof c.levelValue === 'number' && c.levelValue >= 12.0 && c.levelValue <= 14.5)
  const byKind = {}
  const byDiff = {}
  const byValue = {}
  for (const c of inRange) {
    byKind[c.kind] = (byKind[c.kind] || 0) + 1
    byDiff[c.difficulty] = (byDiff[c.difficulty] || 0) + 1
    const k = c.levelValue.toFixed(1)
    byValue[k] = (byValue[k] || 0) + 1
  }
  console.log(`\n定数 12.0–14.5 范围内: ${inRange.length} 个谱面`)
  console.log(`  kind: ${JSON.stringify(byKind)}`)
  console.log(`  difficulty: ${JSON.stringify(byDiff)}`)
  console.log('  定数值分布:')
  for (const k of Object.keys(byValue).sort((a, b) => parseFloat(a) - parseFloat(b))) {
    console.log(`    ${k}: ${byValue[k]}`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
