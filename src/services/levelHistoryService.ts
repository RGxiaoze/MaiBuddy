// ============================================================
// 定数变迁数据加载
//
// 数据由 scripts/gen-level-history.mjs 生成，按需从 public/data 读取。
// 文件很小（只存变化点），进入详情页即加载；图表何时渲染由页面决定。
// ============================================================

import type { LevelPoint } from '@/utils/levelHistory'

const DATA_URL = `${import.meta.env.BASE_URL}data/level-history.json.gz`

interface LevelHistoryFile {
  years: number[]
  songs: Record<string, LevelPoint[]>
}

let _data: LevelHistoryFile | null = null
let _loadPromise: Promise<LevelHistoryFile | null> | null = null

/** 数据文件里覆盖的年份列表（升序）；未加载时为空数组 */
export function getLevelHistoryYears(): number[] {
  return _data?.years ?? []
}

/** 取某谱面的变化点；没有记录时返回 null（表示「从未变更」或「无数据」） */
export function getLevelPoints(songId: number, levelIndex: number): LevelPoint[] | null {
  if (!_data) return null
  return _data.songs[`${songId}|${levelIndex}`] ?? null
}

export function isLevelHistoryLoaded(): boolean {
  return _data !== null
}

/** 仅供测试重置 */
export function resetLevelHistory(): void {
  _data = null
  _loadPromise = null
}

/**
 * 加载并缓存定数变迁数据。
 *
 * 失败时返回 null 并**不缓存**结果，下次调用会重试 ——
 * 一次网络抖动不该让功能永久降级。
 */
export function loadLevelHistory(): Promise<LevelHistoryFile | null> {
  if (_data) return Promise.resolve(_data)
  if (_loadPromise) return _loadPromise

  _loadPromise = fetchCompressed()
    .then((data) => {
      _data = data
      return data
    })
    .catch((err) => {
      if (import.meta.env.DEV) {
        console.warn('[levelHistory] 定数变迁数据加载失败：', err)
      }
      _loadPromise = null
      return null
    })

  return _loadPromise
}

/**
 * 读取 .gz。生产环境是原样复制的压缩包；dev 下 Vite 会带
 * Content-Encoding: gzip 让浏览器透明解压，此时拿到的是明文 —— 与
 * installYearService 的处理方式一致。
 */
async function fetchCompressed(): Promise<LevelHistoryFile> {
  const res = await fetch(DATA_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const buf = await res.arrayBuffer()
  const u8 = new Uint8Array(buf)
  const isGzip = u8[0] === 0x1f && u8[1] === 0x8b

  const text = isGzip
    ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(u8)

  return JSON.parse(text) as LevelHistoryFile
}
