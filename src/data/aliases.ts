// ============================================================
// 别名数据 — 社区别名 API 加载 + 反向索引 + 子串匹配查询
// ============================================================

import { getCachedAliases, getCachedAliasForward, setCachedAliases } from '@/db/database'

interface AliasEntry {
  SongID: number
  Name: string
  Alias: string[]
}

let aliasIndex: Map<string, number[]> | null = null
let aliasForwardMap: Map<number, string[]> | null = null
let aliasLoadError: string | null = null
let loadPromise: Promise<Map<string, number[]> | null> | null = null

/** 构建反向索引：lowercase alias → matching songId[] */
function buildAliasIndex(entries: AliasEntry[]): Map<string, number[]> {
  const index = new Map<string, number[]>()
  for (const entry of entries) {
    const songId = entry.SongID
    // 索引所有别名 + 正式曲名
    const allNames = [entry.Name, ...entry.Alias]
    for (const name of allNames) {
      if (!name) continue
      const key = name.toLowerCase()
      const ids = index.get(key)
      if (ids) {
        ids.push(songId)
      } else {
        index.set(key, [songId])
      }
    }
  }
  return index
}

/**
 * 从社区别名 API 加载数据。
 * 策略：先查 IndexedDB 缓存（24h TTL），再尝试 API 获取，失败则报告。
 * 内置 loadPromise 去重：多次调用共享同一请求。
 */
export async function loadAliasData(): Promise<Map<string, number[]> | null> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    // 1. 尝试 IndexedDB 缓存
    try {
      const cached = await getCachedAliases()
      if (cached) {
        aliasIndex = cached
        // 从 IndexedDB 的 aliasForwardCache 恢复正向索引
        try {
          const fwd = await getCachedAliasForward()
          if (fwd) aliasForwardMap = fwd
        } catch { /* forward cache miss is non-fatal */ }
        aliasLoadError = null
        return cached
      }
    } catch {
      /* cache miss — 继续尝试 API */
    }

    // 2. 尝试 API 获取
    try {
      const res = await fetch('/alias-api/maimaidx/maimaidxalias')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const raw = await res.json()
      // API 返回 {code: 0, content: [...]} 对象，需提取 content 数组
      const data: AliasEntry[] = Array.isArray(raw) ? raw : raw.content
      if (!Array.isArray(data)) {
        throw new Error('API 返回格式异常')
      }

      // 构建反向索引（alias → songIds）
      const index = buildAliasIndex(data)

      // 构建正向索引（songId → aliases，仅社区别名）
      const fwd = new Map<number, string[]>()
      for (const entry of data) {
        if (entry.Alias.length > 0) {
          fwd.set(entry.SongID, entry.Alias)
        }
      }

      aliasIndex = index
      aliasForwardMap = fwd
      aliasLoadError = null

      // 缓存到 IndexedDB
      try {
        await setCachedAliases(index, fwd)
      } catch {
        /* 缓存失败不影响使用 */
      }

      return index
    } catch (err) {
      // 3. 失败 → 报告用户
      aliasLoadError = err instanceof Error ? err.message : '别名数据获取失败'
      return null
    }
  })()

  return loadPromise
}

/**
 * 同步查询：在别名索引中检查 query 是否为任一别名的子串。
 * 返回匹配到的 songId Set（用于 getFilteredSongs 中 O(1) 查找）。
 */
export function searchAliases(
  query: string,
  index: Map<string, number[]> | null
): Set<number> {
  if (!index || !query) return new Set()

  const result = new Set<number>()
  const q = query.toLowerCase()

  for (const [alias, songIds] of index) {
    if (alias.includes(q)) {
      for (const id of songIds) {
        result.add(id)
      }
    }
  }

  return result
}

/** 获取别名加载错误（用于 UI 展示报告） */
export function getAliasLoadError(): string | null {
  return aliasLoadError
}

/** 获取当前已加载的别名索引（songStore 可直接读取） */
export function getAliasIndex(): Map<string, number[]> | null {
  return aliasIndex
}

/** 获取指定曲目的社区别名列表（仅社区别名，不含官方曲名） */
export function getAliasesForSong(songId: number): string[] {
  return aliasForwardMap?.get(songId) ?? []
}
