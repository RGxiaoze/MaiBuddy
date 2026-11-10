// ============================================================
// 谱面下载 — 从 download.wmc.pub 补齐曲库缺的 Simai 谱面
//
// 旧版本指向 assets2.lxns.net/maimai/chart/{id}.txt，但那个源
// 没有 &title= 字段、文件名又是数字，解析器只会得到 type=UNKNOWN。
// 改用 download.wmc.pub：带 &title=、免鉴权、CORS 开放。
//
// 用法:
//   npm run download:charts -- --dry-run   仅统计缺口，不下载
//   npm run download:charts                下载缺口
// ============================================================

const fs = require('fs')
const path = require('path')
const https = require('https')

const CHART_DIR = path.resolve(__dirname, '..', '参考谱面')
const DF_MUSIC_URL = 'https://www.diving-fish.com/api/maimaidxprober/music_data'
const WMC_INDEX_URL = 'https://download.wmc.pub/api/v1/charts'
const wmcFileUrl = (shortid) => `https://download.wmc.pub/s/${shortid}/maidata.txt`
const CONCURRENT = 5
const DRY_RUN = process.argv.includes('--dry-run')

/** 与 src/services/featureService.ts 的 findFeatureEntry 保持一致 */
function normTitle(s) {
  return String(s || '').replace(/[・！？\s\[\]SDXdx]/g, '').toLowerCase()
}

const normKey = (title, type) => `${normTitle(title)}|${type}`

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'))
    const req = https.get(url, { timeout: 20000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume()
        const next = res.headers.location
        if (!next) return reject(new Error(`重定向缺少 Location: ${url}`))
        const target = next.startsWith('http') ? next : new URL(next, url).toString()
        return resolve(get(target, redirects + 1))
      }
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(new Error('请求超时')) })
  })
}

async function fetchJson(url) {
  const res = await get(url)
  if (res.status !== 200) throw new Error(`${url} -> HTTP ${res.status}`)
  return JSON.parse(res.body)
}

async function fetchIndex() {
  const first = await fetchJson(`${WMC_INDEX_URL}?page=1`)
  const pages = first.pages || 1
  const all = [...(first.charts || [])]
  for (let p = 2; p <= pages; p++) {
    const page = await fetchJson(`${WMC_INDEX_URL}?page=${p}`)
    all.push(...(page.charts || []))
    process.stdout.write(`\r  索引 ${p}/${pages} 页`)
  }
  process.stdout.write('\n')
  return all
}

function scanLocal() {
  const keys = new Set()
  if (!fs.existsSync(CHART_DIR)) return keys
  for (const name of fs.readdirSync(CHART_DIR)) {
    if (!name.endsWith('.txt')) continue
    const m = name.match(/\[(SD|DX)\]\.txt$/)
    if (m) {
      keys.add(normKey(name.slice(0, -m[0].length), m[1]))
    } else {
      keys.add(normKey(name.slice(0, -4), 'UNKNOWN'))
    }
  }
  return keys
}

function safeFileName(title, type) {
  const base = title.replace(/[\\/:*?"<>|]/g, '_').trim()
  return `${base}[${type}].txt`
}

/** 下载源格式 → 现有解析器期望的格式 */
function transform(raw, title, type) {
  const out = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('&')) { out.push(line); continue }
    if (t.startsWith('&title=')) { out.push(`&title=${title} [${type}]`); continue }
    if (t.startsWith('&wholebpm=')) { out.push(`&bpm=${t.slice('&wholebpm='.length)}`); continue }
    if (/^&(shortid|versionid|genreid|demo_seek|demo_len|clock_count)=/.test(t)) continue
    out.push(line)
  }
  return out.join('\n')
}

async function main() {
  console.log('拉取水鱼曲库...')
  const music = await fetchJson(DF_MUSIC_URL)
  const library = music.map((s) => ({ title: s.title, type: s.type === 'DX' ? 'DX' : 'SD' }))
  console.log(`  曲库 ${library.length} 首`)

  console.log('拉取 download.wmc.pub 索引...')
  const index = await fetchIndex()
  console.log(`  索引 ${index.length} 条`)

  const indexMap = new Map()
  for (const c of index) {
    const type = c.type === 'DX' ? 'DX' : 'SD'
    indexMap.set(normKey(c.title, type), { shortid: c.shortid, title: c.title, type })
  }

  const local = scanLocal()
  const unmatched = []
  const missing = []
  for (const song of library) {
    const key = normKey(song.title, song.type)
    const hit = indexMap.get(key)
    if (!hit) { unmatched.push(`${song.title}[${song.type}]`); continue }
    if (local.has(key)) continue
    missing.push(hit)
  }

  console.log(`\n本地已有 ${local.size} 条`)
  console.log(`曲库可匹配 ${library.length - unmatched.length} 首`)
  console.log(`索引中找不到 ${unmatched.length} 首`)
  console.log(`需要补下载 ${missing.length} 首`)

  if (unmatched.length) {
    console.log('\n索引中找不到的曲目（前 20）:')
    for (const t of unmatched.slice(0, 20)) console.log(`  - ${t}`)
  }

  if (DRY_RUN) {
    console.log('\n待下载清单（前 20）:')
    for (const m of missing.slice(0, 20)) console.log(`  - ${m.title}[${m.type}] (${m.shortid})`)
    console.log('\n--dry-run 结束，未写入任何文件')
    return
  }

  if (missing.length === 0) { console.log('\n没有缺失，无需下载'); return }
  if (!fs.existsSync(CHART_DIR)) fs.mkdirSync(CHART_DIR, { recursive: true })

  let ok = 0, skip = 0, fail = 0
  const failures = []

  for (let i = 0; i < missing.length; i += CONCURRENT) {
    const batch = missing.slice(i, i + CONCURRENT)
    await Promise.all(batch.map(async (item) => {
      const fp = path.join(CHART_DIR, safeFileName(item.title, item.type))
      if (fs.existsSync(fp)) { skip++; return }
      try {
        const res = await get(wmcFileUrl(item.shortid))
        if (res.status !== 200 || !res.body.trim().startsWith('&')) {
          fail++
          failures.push(`${item.title}[${item.type}] HTTP ${res.status}`)
          return
        }
        fs.writeFileSync(fp, transform(res.body, item.title, item.type), 'utf8')
        ok++
      } catch (err) {
        fail++
        failures.push(`${item.title}[${item.type}] ${err.message}`)
      }
    }))
    process.stdout.write(`\r  [${Math.min(i + CONCURRENT, missing.length)}/${missing.length}] ok:${ok} skip:${skip} fail:${fail}`)
  }
  process.stdout.write('\n')
  console.log(`\n完成: 成功 ${ok} / 跳过 ${skip} / 失败 ${fail}`)
  if (failures.length) {
    console.log('失败清单（前 20）:')
    for (const f of failures.slice(0, 20)) console.log(`  - ${f}`)
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
