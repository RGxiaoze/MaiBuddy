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
/** 核心推荐少于这个条数时依次放宽拉伸补足（与 usePushSuggestions 一致）。
 *  可用 MIN_CORE=20 之类的环境变量覆盖，便于验证分档补足本身。 */
const MIN_CORE = Number(process.env.MIN_CORE ?? 8)

const jiti = createJiti(import.meta.url, { alias: { '@': SRC } })
const { computePushSuggestions, computeRecommendCaps } = await jiti.import('../src/utils/pushSuggestions.ts')
const { computeB50 } = await jiti.import('../src/utils/b50.ts')
const { achievableTargetFor, averageAtLevel } = await jiti.import('../src/utils/difficultyTier.ts')
const { computeRating } = await jiti.import('../src/utils/rating.ts')

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

  // 模拟 hook 的分档补足：核心档不够 8 条时依次放宽
  const suggestions = []
  const seen = new Set()
  const tierCounts = [0, 0, 0]
  for (const [i, scale] of [1, 1.6, 2].entries()) {
    const r = computePushSuggestions(b50, songMap, { allScores: scores, stretchScale: scale })
    for (const s of r.suggestions) {
      const k = `${s.songId}-${s.levelIndex}`
      if (seen.has(k)) continue
      seen.add(k)
      suggestions.push({ ...s, tier: i + 1 })
      tierCounts[i]++
    }
    if (i === 0 && suggestions.length >= MIN_CORE) break
  }

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
  const waters = suggestions.map((s) => s.waterLevel).filter((v) => v != null)

  const top = [...dist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`\n===== ${name} =====`)
  console.log(`成绩 ${scores.length} 条 · B35 ${b50.best35.length} · B15 ${b50.best15.length}`)
  if (levels.length) {
    console.log(`B35 定数 ${Math.min(...levels).toFixed(1)} ~ ${Math.max(...levels).toFixed(1)}`)
  }
  const lastB35 = b50.best35[b50.best35.length - 1]
  const lastB15 = b50.best15[b50.best15.length - 1]
  console.log(`B35 地板 ${lastB35 ? `${lastB35.levelValue}@${lastB35.achievements}% → ${lastB35.dxRating}` : '—'}` +
    ` · B15 地板 ${lastB15 ? `${lastB15.levelValue}@${lastB15.achievements}% → ${lastB15.dxRating}` : '空池'}`)

  // 地板附近逐档诊断：为什么这些档推不动
  if (lastB35) {
    const floorRating = lastB35.dxRating
    const b35Levels = b50.best35.map(e => e.levelValue)
    const mode = b35Levels.sort((a, b) => a - b)[Math.floor(b35Levels.length / 2)]
    const allSamples = scores.filter(s => s.achievements >= 80)
      .map(s => ({ levelValue: s.levelValue, achievements: s.achievements, key: `${s.songId}-${s.levelIndex}` }))
    const b50Samples = [
      ...b50.best35.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
      ...b50.best15.map(e => ({ levelValue: e.levelValue, achievements: e.achievements })),
    ]
    console.log(`  逐档诊断（中位众数≈${mode.toFixed(1)}，地板 ${floorRating}）：`)
    for (const lv of [13.6, 13.7, 13.8, 13.9, 14.0, 14.1]) {
      const ach = achievableTargetFor(lv, mode, allSamples, b50Samples)
      const r99 = computeRating(lv, 99.0)
      const r1005 = computeRating(lv, 100.5)
      const gainAtAch = computeRating(lv, ach) - floorRating
      console.log(`    ${lv}: 目标 ${ach.toFixed(1)}% → rating ${computeRating(lv, ach)}` +
        `（99%=${r99}, 100.5%=${r1005}）· 相对地板 ${gainAtAch >= 0 ? '+' : ''}${gainAtAch}`)
    }
  }
  console.log(`上限 capBase ${caps.capBase ?? '—'} · capSimple ${caps.capSimple ?? '—'}`)
  console.log(`推荐 ${suggestions.length} 条（核心 ${tierCounts[0]} / 二档 ${tierCounts[1]} / 三档 ${tierCounts[2]}）`)
  const pools = new Map()
  for (const s of suggestions) pools.set(s.pool, (pools.get(s.pool) ?? 0) + 1)
  console.log(`  池分布 ${[...pools.entries()].map(([k, v]) => `${k}:${v}`).join('  ') || '—'}` +
    `（B35 ${b50.best35.length} 条 / B15 ${b50.best15.length} 条）`)
  console.log(`  定数分布 ${top.map(([k, v]) => `${k}:${v}`).join('  ') || '—'}`)
  console.log(`  水分覆盖 ${waters.length}/${suggestions.length} 条` +
    (waters.length ? `，最大 ${Math.max(...waters).toFixed(1)}` : ''))
  console.log(`  越过上限 ${overCap.length} 条 · 目标倒退 ${backwards.length} 条`)

  // 「该档平均」覆盖率与取值范围：判断这个窄口径指标在真实数据上是否够用
  const bands = suggestions.map((s) => s.yourBandAvg).filter((v) => v != null)
  if (bands.length > 0) {
    const lo = Math.min(...bands).toFixed(1)
    const hi = Math.max(...bands).toFixed(1)
    console.log(`  该档平均覆盖 ${bands.length}/${suggestions.length} 条，取值范围 ${lo}%~${hi}%`)
  } else {
    console.log(`  该档平均：无可用样本（需要全量成绩）`)
  }

  // 推荐目标落在哪一档：直接判断「目标是否超出玩家能力」
  if (suggestions.length > 0) {
    const best = suggestions.map((s) => {
      const g = s.gains.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
      return g.targetAch
    })
    const buckets = new Map()
    for (const t of best) buckets.set(t, (buckets.get(t) ?? 0) + 1)
    console.log(`  收益最大档的目标 ${[...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, n]) => `${t}%:${n}`).join('  ')}`)

    // 目标 vs 该档平均的落差
    const gaps = suggestions
      .filter((s) => s.yourBandAvg != null)
      .map((s) => {
        const g = s.gains.reduce((a, b) => (b.ratingGain > a.ratingGain ? b : a))
        return g.targetAch - s.yourBandAvg
      })
    if (gaps.length > 0) {
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
      console.log(`  目标 − 该档平均：中位 ${gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)].toFixed(2)}` +
        `，均值 ${avg.toFixed(2)}（正 = 目标高于现有水平）`)
    }

    // 抽查首条：目标档位与各档收益，确认 ceiling 是否真的压下来了
    const s0 = suggestions[0]
    console.log(`  示例 ${s0.songTitle?.slice(0, 14)} 定数 ${s0.levelValue}` +
      ` 该档均 ${s0.yourBandAvg?.toFixed(1) ?? '—（已有成绩，不显示）'}` +
      ` 目标 ${s0.gains.map((g) => `${g.targetAch}`).join('/')}` +
      ` 收益 ${s0.gains.map((g) => g.ratingGain).join('/')}`)
  }

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
