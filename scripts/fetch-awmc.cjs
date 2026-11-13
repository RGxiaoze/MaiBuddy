// ============================================================
// AWMC 校准数据抓取（两阶段）
//
// 阶段 1：从 AWMC 12.0–14.5 的谱面中按定数值分层轮询选 300 个
// 阶段 2：并发抓 /tags，带 429 退避与断点续跑
// 阶段 3：每层按 |deviation| 升序（最"中等"的优先），截到 150 个
//
// 输出 awmc-tags.local.json / awmc-calibration.local.csv（均命中 *.local）
// 用法: node scripts/fetch-awmc.cjs
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
const ROOT = path.resolve(__dirname, '..')
/** 本地分析产物统一存放；该目录被 .gitignore 忽略，克隆后不存在，写入前需自建 */
const DATA_DIR = path.join(ROOT, '项目资料')
fs.mkdirSync(DATA_DIR, { recursive: true })
const LIST_PATH = path.join(DATA_DIR, 'awmc-charts.local.json')
const TAGS_PATH = path.join(DATA_DIR, 'awmc-tags.local.json')
const CSV_PATH = path.join(DATA_DIR, 'awmc-calibration.local.csv')

const LEVEL_MIN = 12.0
const LEVEL_MAX = 14.5
/** --all：抓取区间内全部谱面，不做两阶段截取 */
const FETCH_ALL = process.argv.includes('--all')
const STAGE1_TARGET = FETCH_ALL ? Number.MAX_SAFE_INTEGER : 300
const STAGE3_TARGET = FETCH_ALL ? Number.MAX_SAFE_INTEGER : 150
const CONCURRENT = 4

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: 30000 }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    req.on('timeout', () => req.destroy(new Error('超时')))
  })
}

async function fetchTags(chartKey, retries = 3) {
  const res = await get(`https://v.wmc.pub/api/v1/charts/${chartKey}/tags`, {
    Authorization: `Bearer ${KEY}`,
  })
  if (res.status === 429) {
    if (retries <= 0) throw new Error('429 配额耗尽')
    const wait = (Number(res.headers['retry-after']) || 30) * 1000
    process.stdout.write(`\n  429，等待 ${wait / 1000}s\n`)
    await new Promise((r) => setTimeout(r, wait))
    return fetchTags(chartKey, retries - 1)
  }
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  return JSON.parse(res.body)
}

const esc = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const all = JSON.parse(fs.readFileSync(LIST_PATH, 'utf8'))

  // 列表文件里没有定数，重新映射一次
  console.log('拉取水鱼曲库做定数映射...')
  const dfRes = await get('https://www.diving-fish.com/api/maimaidxprober/music_data')
  const df = JSON.parse(dfRes.body)
  const byId = new Map(df.map((s) => [Number(s.id), s]))
  for (const c of all) {
    const dfId = c.kind === 'dx' ? c.songId + 10000 : c.songId
    const song = byId.get(dfId) || byId.get(c.songId)
    const lv = song && song.ds ? song.ds[c.difficulty - 2] : undefined
    if (typeof lv === 'number') c.levelValue = lv
  }

  // 阶段 1：分层轮询选样
  const inRange = all.filter(
    (c) => typeof c.levelValue === 'number' && c.levelValue >= LEVEL_MIN && c.levelValue <= LEVEL_MAX,
  )
  const byValue = new Map()
  for (const c of inRange) {
    const k = c.levelValue.toFixed(1)
    if (!byValue.has(k)) byValue.set(k, [])
    byValue.get(k).push(c)
  }
  const layers = [...byValue.keys()]
    .sort((a, b) => parseFloat(a) - parseFloat(b))
    .map((v) => ({ value: v, list: byValue.get(v), taken: 0 }))

  const picked = []
  let remaining = STAGE1_TARGET
  while (remaining > 0) {
    let progressed = false
    for (const l of layers) {
      if (remaining <= 0) break
      const next = l.list[l.taken]
      if (!next) continue
      picked.push(next)
      l.taken++
      remaining--
      progressed = true
    }
    if (!progressed) break
  }
  console.log(`阶段 1：选中 ${picked.length} 个（${layers.filter((l) => l.taken > 0).length} 个定数值层）`)

  // 阶段 2：抓 tags，断点续跑
  let store = {}
  if (fs.existsSync(TAGS_PATH)) {
    try { store = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8')) } catch { store = {} }
  }
  const todo = picked.filter((c) => !store[c.chartKey])
  console.log(`阶段 2：待抓 ${todo.length}（已缓存 ${picked.length - todo.length}）`)

  let ok = 0
  const failures = []
  for (let i = 0; i < todo.length; i += CONCURRENT) {
    const batch = todo.slice(i, i + CONCURRENT)
    await Promise.all(batch.map(async (c) => {
      try {
        store[c.chartKey] = await fetchTags(c.chartKey)
        ok++
      } catch (e) {
        failures.push(`${c.chartKey}: ${e.message}`)
      }
    }))
    fs.writeFileSync(TAGS_PATH, JSON.stringify(store), 'utf8')
    process.stdout.write(`\r  ${Math.min(i + CONCURRENT, todo.length)}/${todo.length} ok:${ok} fail:${failures.length} `)
  }
  process.stdout.write('\n')
  if (failures.length) {
    console.log(`失败 ${failures.length}：`)
    failures.slice(0, 10).forEach((f) => console.log(`  - ${f}`))
  }

  // 阶段 3：每层按 |deviation| 升序截到 STAGE3_TARGET
  const byLayer = new Map()
  for (const c of picked) {
    const t = store[c.chartKey]
    const cls = t && t.tags && t.tags.difficultyClassification
    if (!cls || typeof cls.deviation !== 'number') continue
    const k = c.levelValue.toFixed(1)
    if (!byLayer.has(k)) byLayer.set(k, [])
    byLayer.get(k).push({ chart: c, tags: t, deviation: cls.deviation, estimatedLevel: cls.estimatedLevel })
  }
  for (const list of byLayer.values()) {
    list.sort((a, b) => Math.abs(a.deviation) - Math.abs(b.deviation))
  }

  const order = [...byLayer.keys()].sort((a, b) => parseFloat(a) - parseFloat(b))
  const counters = new Map(order.map((k) => [k, 0]))
  const final = []
  let left = STAGE3_TARGET
  while (left > 0) {
    let progressed = false
    for (const k of order) {
      if (left <= 0) break
      const list = byLayer.get(k)
      const idx = counters.get(k)
      if (!list || idx >= list.length) continue
      final.push(list[idx])
      counters.set(k, idx + 1)
      left--
      progressed = true
    }
    if (!progressed) break
  }
  final.sort((a, b) => a.chart.levelValue - b.chart.levelValue || Math.abs(a.deviation) - Math.abs(b.deviation))

  const header = ['chartKey', '曲名', '类型', '难度', '定数', '官标档', 'AWMC预估', '偏差', '分类', '雷达项', '评估项', '模式']
  const lines = [header.join(',')]
  for (const f of final) {
    const t = f.tags.tags
    lines.push([
      f.chart.chartKey,
      esc(f.chart.title),
      f.chart.kind,
      f.chart.difficulty,
      f.chart.levelValue.toFixed(1),
      f.chart.levelLabel,
      f.estimatedLevel.toFixed(2),
      f.deviation.toFixed(2),
      t.difficultyClassification?.label ?? '',
      esc((t.radarTags || []).map((r) => `${r.label}:${r.score}`).join(' ')),
      esc((t.evaluationTags || []).map((r) => `${r.label}:${r.score}`).join(' ')),
      esc((t.patterns || []).map((r) => `${r.label}×${r.count}`).join(' ')),
    ].join(','))
  }
  fs.writeFileSync(CSV_PATH, '\uFEFF' + lines.join('\r\n'), 'utf8')

  console.log(`阶段 3：最终 ${final.length} 个样本 → ${CSV_PATH}`)
  const ranges = {}
  for (const f of final) {
    const k = f.chart.levelValue.toFixed(1)
    ranges[k] = (ranges[k] || 0) + 1
  }
  console.log('  定数分布:', Object.keys(ranges).sort((a, b) => parseFloat(a) - parseFloat(b)).map((k) => `${k}:${ranges[k]}`).join(' '))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
