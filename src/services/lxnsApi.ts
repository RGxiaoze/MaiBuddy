// ============================================================
// LXNS API service (supplementary data source)
// ============================================================

// ---- Phase 2 stubs ----

/** Fetch song list from LXNS (Phase 2). */
export async function fetchSongList(): Promise<never> {
  throw new Error('fetchSongList: 阶段二实现 — 需 LXNS API 密钥')
}

/** Fetch player profile by friend code (Phase 2). */
export async function fetchPlayer(_friendCode: number): Promise<never> {
  throw new Error('fetchPlayer: 阶段二实现 — 需 LXNS API 密钥')
}

/** Fetch B50 scores from LXNS (Phase 2). */
export async function fetchB50(_friendCode: number): Promise<never> {
  throw new Error('fetchB50: 阶段二实现 — 需 LXNS API 密钥')
}
