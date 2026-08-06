// ============================================================
// jacket — 曲绘 URL 工具（DF songId → LXNS musicId 映射）
// LXNS 曲绘使用 LXNS 自己的 ID，与 Diving-Fish songId 不一致，
// 需通过 title 匹配 jacket-map.json 获取正确 ID。
// ============================================================

let _map: Record<string, number> | null = null
let _promise: Promise<Record<string, number>> | null = null

export function loadJacketMap(): Promise<Record<string, number>> {
  if (_map) return Promise.resolve(_map)
  if (_promise) return _promise
  _promise = fetch(`${import.meta.env.BASE_URL}data/jacket-map.json`)
    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
    .then(data => { _map = data as Record<string, number>; return _map! })
    .catch(err => { console.warn('jacket-map 加载失败:', err); _map = {}; return _map! })
  return _promise
}

function cleanTitle(title: string): string {
  return title.replace(/\s*\[(SD|DX)\]\s*/g, '').trim().toLowerCase()
}

/** 通过曲名获取 LXNS jacket ID（映射缺失时回退 songId） */
export function getJacketId(songTitle: string, songId: number): number {
  const key = cleanTitle(songTitle)
  return _map?.[key] ?? songId
}

/** 生成曲绘 URL（webp 已压缩） */
export function getJacketUrl(songTitle: string, songId: number): string {
  return `https://assets.lxns.net/maimai/jacket/${getJacketId(songTitle, songId)}.png!webp`
}
