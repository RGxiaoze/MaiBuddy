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
      const res = await fetch(DATA_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()
      const u8 = new Uint8Array(buf)
      // 生产环境是原样复制的 .gz；但 Vite dev server 会带 Content-Encoding: gzip
      // 让浏览器透明解压，此时拿到的是明文 JSON —— 再喂给 DecompressionStream 会抛错。
      const isGzip = u8[0] === 0x1f && u8[1] === 0x8b
      const text = isGzip
        ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(u8)
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
