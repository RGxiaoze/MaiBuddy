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

const SIZE = 96
const QUALITY = 75
const CONCURRENCY = 8
const RETRIES = 2

/** 落雪按基础 ID 存曲绘；DX 谱在曲库是独立条目（+10000） */
function baseIdOf(id) {
  return id >= 10000 && id < 100000 ? id % 10000 : id
}

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function convertOne(id, force) {
  const out = resolve(OUT_DIR, `${id}.webp`)
  if (!force && existsSync(out)) return 'skip'

  const png = resolve(TMP_DIR, `${id}.png`)
  let lastErr
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      writeFileSync(png, await download(`${SRC}/${id}.png`))
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
async function runPool(items, limit, fn) {
  let cursor = 0
  const stats = { ok: 0, skip: 0, fail: [] }

  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const id = items[cursor++]
      try {
        const r = await fn(id)
        if (r === 'skip') stats.skip++
        else stats.ok++
      } catch {
        stats.fail.push(id)
      }
      const done = stats.ok + stats.skip + stats.fail.length
      if (done % 100 === 0) console.log(`  进度 ${done}/${items.length}`)
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
const ids = [...new Set(music.map((s) => baseIdOf(Number(s.id))))].slice(0, limit)

console.log(`曲目 ${ids.length} 首 → ${SIZE}px WebP，输出到 ${OUT_DIR}`)
const stats = await runPool(ids, CONCURRENCY, (id) => convertOne(id, force))

console.log(`\n完成：生成 ${stats.ok}，跳过 ${stats.skip}，失败 ${stats.fail.length}`)
if (stats.fail.length > 0) {
  console.log(`失败 ID（前 20）：${stats.fail.slice(0, 20).join(', ')}`)
  process.exitCode = 1
}
