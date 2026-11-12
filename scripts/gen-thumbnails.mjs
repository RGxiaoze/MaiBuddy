#!/usr/bin/env node
/**
 * 生成曲绘缩略图
 *
 * 落雪只提供 400×400 PNG（约 367 KB），列表每页 50 张 → 首屏峰值 18 MB。
 * 这里批量转成 96×96 WebP（约 3 KB），供列表/推荐/卡片使用；
 * 详情页仍取原图。
 *
 * 流程：fetch 到 .narrafork/tmp/thumbs/ → ffmpeg 转本地 → 清理临时文件。
 * ffmpeg 不直接读 URL —— 超时、重试与并发都由本脚本控制。
 *
 * Usage: node scripts/gen-thumbnails.mjs [--force] [--limit N]
 */
import { mkdirSync, existsSync, writeFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = resolve(ROOT, 'public/covers')
const TMP_DIR = resolve(ROOT, '.narrafork/tmp/thumbs')
const MUSIC_API = 'https://www.diving-fish.com/api/maimaidxprober/music_data'
const SRC = 'https://assets2.lxns.net/maimai/jacket'

// 96px 在移动端 2x 屏和 B50 的大卡片上偏糊，提到 192px 覆盖到 96 CSS px 的 2 倍屏
const SIZE = 192
const QUALITY = 85
const CONCURRENCY = 8
const RETRIES = 2

/** 落雪按基础 ID 存曲绘；DX 谱在曲库是独立条目（+10000） */
function baseIdOf(id) {
  return id >= 10000 && id < 100000 ? id % 10000 : id
}

/**
 * 宴会场曲目（ID ≥ 100000）没有独立曲绘，回落到原曲的图。
 *
 * 标题形如 `[協]Love You`：剥掉方括号前缀就是原曲名。
 * 少数带后缀（`Oshama Scramble! (Cranky Remix)`），再剥一层末尾括号。
 * 返回 null 表示确实找不到原曲，跳过。
 */
function makeUtageResolver(music) {
  const byTitle = new Map()
  for (const s of music) {
    const id = Number(s.id)
    if (id >= 100000) continue
    if (!byTitle.has(s.title)) byTitle.set(s.title, baseIdOf(id))
  }

  return (song) => {
    const base = song.title.replace(/^\[[^\]]+\]/, '').trim()
    const direct = byTitle.get(base)
    if (direct !== undefined) return direct

    const noSuffix = base.replace(/\s*\([^)]*\)\s*$/, '').trim()
    return byTitle.get(noSuffix) ?? null
  }
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function convertOne(id, sourceId, force) {
  const out = resolve(OUT_DIR, `${id}.webp`)
  if (!force && existsSync(out)) return 'skip'

  const png = resolve(TMP_DIR, `${id}.png`)
  let lastErr
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      writeFileSync(png, await download(`${SRC}/${sourceId}.png`))
      await execFileAsync('ffmpeg', [
        '-loglevel', 'error', '-y',
        '-i', png,
        '-vf', `scale=${SIZE}:${SIZE}`,
        '-quality', String(QUALITY),
        out,
      ])
      rmSync(png, { force: true })
      return 'ok'
    } catch (e) {
      lastErr = e
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  rmSync(png, { force: true })
  throw lastErr
}

/** 固定并发的任务池 */
async function runPool(jobs, limit, fn) {
  let cursor = 0
  const stats = { ok: 0, skip: 0, fail: [] }

  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try {
        const r = await fn(job)
        if (r === 'skip') stats.skip++
        else stats.ok++
      } catch {
        stats.fail.push(job.id)
      }
      const done = stats.ok + stats.skip + stats.fail.length
      if (done % 100 === 0) console.log(`  进度 ${done}/${jobs.length}`)
    }
  }))
  return stats
}

const force = process.argv.includes('--force')
const limitIdx = process.argv.indexOf('--limit')
const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(TMP_DIR, { recursive: true })

const res = await fetch(MUSIC_API)
if (!res.ok) throw new Error(`曲库请求失败 HTTP ${res.status}`)
const music = await res.json()

// 普通曲目：输出名与图源都是自身基础 ID。
// 宴会场：输出名用自身 ID（前端就按它取图），图源回落到原曲。
const resolveUtage = makeUtageResolver(music)
const seen = new Set()
const allJobs = []
const unmatched = []
for (const s of music) {
  const id = Number(s.id)
  if (id >= 100000) {
    const sourceId = resolveUtage(s)
    if (sourceId === null) {
      unmatched.push(`${id} ${s.title}`)
      continue
    }
    allJobs.push({ id, sourceId })
    continue
  }
  const base = baseIdOf(id)
  if (seen.has(base)) continue
  seen.add(base)
  allJobs.push({ id: base, sourceId: base })
}

const jobs = allJobs.slice(0, limit)
console.log(`曲目 ${jobs.length} 首（含宴会场 ${jobs.filter(j => j.id >= 100000).length} 首）→ ${SIZE}px WebP，输出到 ${OUT_DIR}`)
if (unmatched.length > 0) {
  console.log(`跳过 ${unmatched.length} 首找不到原曲的宴会场曲目：`)
  unmatched.forEach((u) => console.log('  ' + u))
}

const stats = await runPool(jobs, CONCURRENCY, (job) => convertOne(job.id, job.sourceId, force))

console.log(`\n完成：生成 ${stats.ok}，跳过 ${stats.skip}，失败 ${stats.fail.length}`)
if (stats.fail.length > 0) {
  console.log(`失败 ID（前 20）：${stats.fail.slice(0, 20).join(', ')}`)
  process.exitCode = 1
}
