#!/usr/bin/env node
/**
 * 用真实玩家成绩校准推分建议
 *
 * 直接复用 src 下的算法（经 jiti 加载，含 @/ 别名），不做第二套实现，
 * 所以脚本结论与线上行为一致。
 *
 * Usage:
 *   node scripts/calibrate-recommend.mjs <成绩文件...>
 *
 * 支持两种格式：
 *   - 水鱼导出的 CSV（只有等级标签，定数按档位中位近似）
 *   - 本站导出的 JSON（自带 levelValue，直接用）
 *
 * 曲库来自水鱼 music_data，缓存 1 小时到 .narrafork/tmp/
 */
import { createJiti } from 'jiti'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = fileURLToPath(new URL('../src/', import.meta.url))
const API = 'https://www.diving-fish.com/api/maimaidxprober/music_data'
const CACHE = resolve(ROOT, '.narrafork/tmp/music_data.cache.json')
const CACHE_TTL = 60 * 60 * 1000

const jiti = createJiti(import.meta.url, { alias: { '@': SRC } })
const { computePushSuggestions, computeRecommendCaps } = await jiti.import('../src/utils/pushSuggestions.ts')
const { computeB50 } = await jiti.import('../src/utils/b50.ts')

// ---- 曲库 ----

async function loadMusicData() {
  if (existsSync(CACHE) && Date.now() - statSync(CACHE).mtimeMs < CACHE_TTL) {
    return JSON.parse(readFileSync(CACHE, 'utf8'))
  }
  const res = await fetch(API)
  if (!res.ok) throw new Error(`曲库请求失败 HTTP ${res.status}`)
  const data = await res.json()
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, JSON.stringify(data))
  return data
}

function diffsOf(s) {
  const type = s.type === 'DX' ? 'dx' : 'standard'
  return s.ds
    .map((lv, li) => ({
      type,
      levelIndex: li,
      level: s.level[li],
      levelValue: lv,
      noteDesigner: '',
      notes: null,
    }))
    .filter((d) => d.levelValue > 0)
}

function toSong(s) {
  const diffs = diffsOf(s)
  const isDx = s.type === 'DX'
  return {
    id: Number(s.id),
    title: s.title,
    artist: s.basic_info?.artist ?? '',
    bpm: s.basic_info?.bpm ?? 0,
    from: s.basic_info?.from ?? '',
    genre: s.basic_info?.genre ?? '',
    imageUrl: '',
    isNew: !!s.basic_info?.is_new,
    difficulties: {
      standard: isDx ? [] : diffs,
      dx: isDx ? diffs : [],
    },
  }
}

/** `${songId}|${levelIndex}` → 精确定数，用于给 CSV 补定数 */
function buildLevelIndex(music) {
  const map = new Map()
  for (const s of music) {
    const diffs = diffsOf(s)
    for (const d of diffs) map.set(`${s.id}|${d.levelIndex}`, d)
  }
  return map
}

// ---- 成绩解析 ----

/** 带引号的 CSV：曲名里含逗号 */
function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote; continue }
    if (ch === ',' && !inQuote) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(path, levelIndex) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim())
  const out = []
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i])
    if (f.length < 12) continue
    const n = f.length
    const songId = Number(f[0])
    if (!Number.isFinite(songId)) continue
    const level = f[n - 11]
    const levelIndexNo = Number(f[n - 10])
    const achievements = Number(f[n - 9])
    if (!Number.isFinite(achievements) || achievements <= 0) continue

    const hit = levelIndex.get(`${songId}|${levelIndexNo}`)
    // CSV 不带定数，取曲库的精确值；查不到才退回档位中位
    const levelValue = hit ? hit.levelValue
      : (level.endsWith('+') ? parseFloat(level) + 0.7 : parseFloat(level) + 0.2)

    out.push({
      songId, songTitle: f[1], levelIndex: levelIndexNo, level,
      levelValue, songType: 'dx', achievements,
      rate: '', fcType: null, fsType: null, dxScore: 0, dxRating: 0, dxScoreDetail: null,
    })
  }
  return out
}

function parseJson(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  return (raw.scores ?? []).filter((s) => s.levelValue > 0)
}

// ---- 分析 ----

function analyze(name, scores, songMap) {
  const b50 = computeB50(scores, songMap)
  if (b50.best35.length === 0 && b50.best15.length === 0) {
    console.log(`\n===== ${name} =====\n无有效成绩`)
    return
  }
  const caps = computeRecommendCaps(b50)
  const { suggestions } = computePushSuggestions(b50, songMap, { allScores: scores })

  const dist = new Map()
  for (const s of suggestions) {
    const k = Math.round(s.levelValue * 10) / 10
    dist.set(k, (dist.get(k) ?? 0) + 1)
  }
  const overCap = suggestions.filter((s) => caps.capBase !== null && s.levelValue > caps.capBase)
  // 目标达成率不高于当前成绩却仍带正收益 —— 木叶狐反馈的那类 bug
  const backwards = suggestions.filter((s) =>
    s.gains.some((g) => g.ratingGain > 0 && g.targetAch <= s.currentAchievements + 1e-9))

  const levels = b50.best35.map((e) => e.levelValue)
  const ranks = new Map()
  for (const s of suggestions) ranks.set(s.expectedRank, (ranks.get(s.expectedRank) ?? 0) + 1)

  const top = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`\n===== ${name} =====`)
  console.log(`成绩 ${scores.length} 条 · B35 ${b50.best35.length} · B15 ${b50.best15.length}`)
  if (levels.length) {
    console.log(`B35 定数 ${Math.min(...levels).toFixed(1)} ~ ${Math.max(...levels).toFixed(1)}`)
  }
  console.log(`上限 capBase ${caps.capBase ?? '—'} · capSimple ${caps.capSimple ?? '—'}`)
  console.log(`推荐 ${suggestions.length} 条`)
  console.log(`  定数分布 ${top.map(([k, v]) => `${k}:${v}`).join('  ') || '—'}`)
  console.log(`  预期评级 ${[...ranks.entries()].map(([k, v]) => `${k}:${v}`).join('  ') || '—'}`)
  console.log(`  越过上限 ${overCap.length} 条 · 目标倒退 ${backwards.length} 条`)

  if (overCap.length || backwards.length) process.exitCode = 1
}

// ---- main ----

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('用法: node scripts/calibrate-recommend.mjs <成绩文件...>')
  process.exit(1)
}

const music = await loadMusicData()
const levelIndex = buildLevelIndex(music)
const songMap = new Map()
for (const s of music) songMap.set(Number(s.id), toSong(s))

for (const file of files) {
  const name = basename(file)
  const scores = file.endsWith('.csv') ? parseCsv(file, levelIndex) : parseJson(file)
  analyze(name, scores, songMap)
}
