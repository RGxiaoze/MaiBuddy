// ============================================================
// 实装年服务
//
// 提供「该谱面在国服哪个版本年实装」的查询，用于按年校正拟合定数。
// 数据由 song_data（2020–2025 定数快照的首次出现年）+ is_new（2026）合成，
// 压缩后仅 12.7 KB。
//
// 加载失败时返回 null，调用方应把校正量按 0 处理，不阻塞主流程。
// ============================================================

const DATA_URL = `${import.meta.env.BASE_URL}data/install-year.json.gz`

let _map: Record<string, number> | null = null
let _loadPromise: Promise<void> | null = null

/** 加载实装年数据（幂等，失败时静默降级为空表） */
export async function loadInstallYear(): Promise<void> {
  if (_map) return
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    try {
      if (typeof DecompressionStream === 'undefined') throw new Error('不支持 DecompressionStream')
      const res = await fetch(DATA_URL)
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
      const text = await new Response(stream).text()
      _map = JSON.parse(text) as Record<string, number>
    } catch {
      _map = {}
    }
  })()
  return _loadPromise
}

/** 查询实装年；数据未加载或不含该谱面时返回 null */
export function getInstallYear(songId: number, levelIndex: number): number | null {
  if (!_map) return null
  return _map[`${songId}|${levelIndex}`] ?? null
}

/** 是否已加载完成 */
export function isInstallYearLoaded(): boolean {
  return _map !== null
}

/** 仅供测试重置 */
export function resetInstallYear(): void {
  _map = null
  _loadPromise = null
}
