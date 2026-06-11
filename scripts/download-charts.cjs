// ============================================================
// 谱面下载 — 从 LXNS CDN 批量下载 Simai 谱面
// 用法: node scripts/download-charts.cjs [数量]
//   npm run download:charts -- 100
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const CHART_DIR = path.resolve(__dirname, '..', 'charts')
const LXNS_BASE = 'https://assets2.lxns.net/maimai/chart'
const CONCURRENT = 5

async function fetchSongIds() {
  return new Promise((resolve, reject) => {
    https.get('https://www.diving-fish.com/api/maimaidxprober/music_data', (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const songs = JSON.parse(data)
        resolve(songs.map(s => s.id).filter(id => id < 100000))
      })
    }).on('error', reject)
  })
}

function downloadChart(songId) {
  return new Promise((resolve) => {
    const fp = path.join(CHART_DIR, `${songId}.txt`)
    if (fs.existsSync(fp)) { resolve({ id: songId, status: 'skip' }); return }
    const req = https.get(`${LXNS_BASE}/${songId}.txt`, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { resolve({ id: songId, status: res.statusCode === 404 ? '404' : 'err' }); return }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        if (data.trim().startsWith('&') || data.trim().startsWith('{')) {
          fs.writeFileSync(fp, data, 'utf8')
          resolve({ id: songId, status: 'ok' })
        } else { resolve({ id: songId, status: 'invalid' }) }
      })
    })
    req.on('error', () => resolve({ id: songId, status: 'err' }))
  })
}

async function main() {
  const limit = parseInt(process.argv[2]) || 0
  const ids = await fetchSongIds()
  const target = limit > 0 ? ids.slice(0, limit) : ids
  if (!fs.existsSync(CHART_DIR)) fs.mkdirSync(CHART_DIR, { recursive: true })

  console.log(`下载 ${target.length} 首 (并发=${CONCURRENT})...`)
  let ok = 0, skip = 0, nf = 0, err = 0

  for (let i = 0; i < target.length; i += CONCURRENT) {
    const batch = target.slice(i, i + CONCURRENT)
    for (const r of await Promise.all(batch.map(downloadChart))) {
      if (r.status === 'ok') ok++
      else if (r.status === 'skip') skip++
      else if (r.status === '404') nf++
      else err++
    }
    if ((i + CONCURRENT) % 100 === 0 || i + CONCURRENT >= target.length) {
      console.log(`  [${Math.min(i + CONCURRENT, target.length)}/${target.length}] ok:${ok} skip:${skip} 404:${nf} err:${err}`)
    }
  }
  console.log(`完成! 成功:${ok} 跳过:${skip} 404:${nf} 错误:${err}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
