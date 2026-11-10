// 统计 chart_stats 里被判「样本不可信」的谱面比例（只统计红/紫/白谱）。
//
// 判定规则与 src/utils/sampleReliability.ts 保持一致：
//   count >= max(同官标档中位数 × RELIABLE_RATIO, MIN_ABSOLUTE_SAMPLE)
//
// 用途：判断阈值是否过严。若比例极高，说明绝对下限压过了相对判定。
//
// 用法：node scripts/audit-sample-reliability.mjs

const API_BASE = 'https://www.diving-fish.com/api/maimaidxprober'
const RELIABLE_RATIO = 0.3
const MIN_ABSOLUTE_SAMPLE = 12000

const res1 = await fetch(`${API_BASE}/music_data`)
const res2 = await fetch(`${API_BASE}/chart_stats`)
const music = await res1.json()
const stats = await res2.json()

// 曲目 id → { isNew, levels[4] }（level 数组按难度索引排列）
const meta = new Map()
for (const m of music) {
  meta.set(Number(m.id), { isNew: !!m.basic_info?.is_new, levels: m.level ?? [] })
}

// 第一遍：每个官标档位的样本量中位数（与运行时同口径：全部谱面参与）
const countsByLevel = new Map()
const rows = []
for (const [idStr, entries] of Object.entries(stats.charts)) {
  const id = Number(idStr)
  const info = meta.get(id)
  for (const e of entries) {
    if (e.diff == null) continue
    const cnt = typeof e.cnt === 'number' ? e.cnt : e.dist.reduce((s, v) => s + v, 0)
    if (!countsByLevel.has(e.diff)) countsByLevel.set(e.diff, [])
    countsByLevel.get(e.diff).push(cnt)
    const levelIndex = info ? info.levels.indexOf(e.diff) : -1
    rows.push({ id, level: e.diff, levelIndex, cnt, isNew: info?.isNew ?? false })
  }
}

const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}
const medians = new Map([...countsByLevel].map(([k, v]) => [k, median(v)]))

const isReliable = (cnt, level) => {
  const threshold = Math.max((medians.get(level) ?? 0) * RELIABLE_RATIO, MIN_ABSOLUTE_SAMPLE)
  return cnt > 0 && cnt >= threshold
}

// 只看红/紫/白（levelIndex 2、3、4）
const target = rows.filter((r) => r.levelIndex >= 2)
const byLevel = new Map()
for (const r of target) {
  const b = byLevel.get(r.level) ?? { total: 0, unreliable: 0 }
  b.total++
  if (!isReliable(r.cnt, r.level)) b.unreliable++
  byLevel.set(r.level, b)
}

const sortLevel = (a, b) => parseFloat(a) + (a.endsWith('+') ? 0.5 : 0) - (parseFloat(b) + (b.endsWith('+') ? 0.5 : 0))

console.log('阈值：max(中位数 × %s, %s)\n', RELIABLE_RATIO, MIN_ABSOLUTE_SAMPLE)
console.log('官标档 | 谱面数 | 中位样本 | 不可信 | 占比')
for (const [level, b] of [...byLevel].sort((x, y) => sortLevel(x[0], y[0]))) {
  const pct = (b.unreliable / b.total * 100).toFixed(1)
  console.log(`${level.padStart(4)} | ${String(b.total).padStart(6)} | ${String(Math.round(medians.get(level))).padStart(8)} | ${String(b.unreliable).padStart(6)} | ${pct}%`)
}

const total = target.length
const unreliable = target.filter((r) => !isReliable(r.cnt, r.level)).length
const newPool = target.filter((r) => r.isNew)
const newUnreliable = newPool.filter((r) => !isReliable(r.cnt, r.level)).length

console.log('\n红紫白整体：%d / %d 不可信（%s%%）', unreliable, total, (unreliable / total * 100).toFixed(1))
console.log('其中新版本曲目（B15 池）：%d / %d 不可信（%s%%）',
  newUnreliable, newPool.length, newPool.length ? (newUnreliable / newPool.length * 100).toFixed(1) : '0.0')
