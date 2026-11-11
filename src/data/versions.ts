// ============================================================
// 版本分组常量 — 将 API 返回的 from 字段映射到区域
// ============================================================

export const VERSION_REGIONS: Record<string, string[]> = {
  '国服': [
    '舞萌2025',
    '舞萌2024',
    '舞萌DX 2023',
    '舞萌DX 2022',
    '舞萌DX 2021',
    '舞萌DX 2020',
    '舞萌DX',
  ],
  // 框架预留，LXNS 集成后补充
  '日服': [],
}

// ============================================================
// 版本排序映射 — 按发行时间递增赋值（间隔10预留扩展）
// ============================================================

/** 日文/国际版 版本名 → 排序值（键对齐 Diving-Fish API 实际返回的 from 值） */
const JP_VERSION_ORDER: Record<string, number> = {
  'maimai':                   100,
  'maimai PLUS':              110,
  'maimai GreeN':             200,
  'maimai GreeN PLUS':        210,
  'maimai ORANGE':            300,
  'maimai ORANGE PLUS':       310,
  'maimai PiNK':              400,
  'maimai PiNK PLUS':         410,
  'maimai MURASAKi':          500,
  'maimai MURASAKi PLUS':     510,
  'maimai MiLK':              600,
  'MiLK PLUS':                610,
  'maimai MiLK PLUS':         610,   // 展示名带前缀，排序时也要能查到
  'maimai FiNALE':            700,
  'maimai でらっくす':         800,
  'maimai でらっくす Splash':   820,
  'maimai でらっくす UNiVERSE': 840,
  'maimai でらっくす FESTiVAL': 860,
  'maimai でらっくす BUDDiES':  880,
  'maimai でらっくす PRiSM':    900,
  // DX 时代的「+」版本：每个大版本间隔 20，PLUS 取 +10
  'maimai でらっくす PLUS':         810,
  'maimai でらっくす Splash PLUS':   830,
  'maimai でらっくす UNiVERSE PLUS': 850,
  'maimai でらっくす FESTiVAL PLUS': 870,
  'maimai でらっくす BUDDiES PLUS':  890,
  'maimai でらっくす PRiSM PLUS':    910,
}

/** 国服 版本名 → 排序值（与日文值隔开避免碰撞） */
const CN_VERSION_ORDER: Record<string, number> = {
  '舞萌DX':        8000,
  '舞萌DX 2020':   8010,
  '舞萌DX 2021':   8020,
  '舞萌DX 2022':   8030,
  '舞萌DX 2023':   8040,
  '舞萌2024':      8050,
  '舞萌2025':      8060,
  '舞萌2026':      8070,
}

/** 统一映射（日文 + 国服合并），用于 adapter 的 parseVersion */
export const VERSION_ORDER: Map<string, number> = new Map([
  ...Object.entries(JP_VERSION_ORDER),
  ...Object.entries(CN_VERSION_ORDER),
])

// ============================================================
// 版本显示名映射 — API 原始值 → UI 友好名称
// ============================================================

/** 部分 API from 值在 UI 中显示时需要补全前缀，避免用户困惑 */
const VERSION_DISPLAY: Record<string, string> = {
  'MiLK PLUS': 'maimai MiLK PLUS',
}

/** 获取版本的 UI 显示名称 */
export function getVersionDisplay(from: string): string {
  return VERSION_DISPLAY[from] ?? from
}

/** 国服年份 → 国服版本显示名（统一「舞萌DX 20XX」格式） */
const CN_YEAR_LABEL: Record<number, string> = {
  2020: '舞萌DX',
  2021: '舞萌DX 2021',
  2022: '舞萌DX 2022',
  2023: '舞萌DX 2023',
  2024: '舞萌DX 2024',
  2025: '舞萌DX 2025',
  2026: '舞萌DX 2026',
}

/**
 * 日服版本 → 国服实装年的兜底映射。
 *
 * 仅在 install-year 查不到时使用（2025 年实装的曲缺少数据）。
 * 国服版本与日服版本的对应关系来自实际运营节奏，不保证逐首精确 ——
 * 它的作用只是让筛选列表归入国服版本桶，而不是残留日服版本名。
 */
const JP_TO_CN_YEAR: Record<number, number> = {
  800: 2020, 810: 2020, 820: 2020, 830: 2020,   // でらっくす ~ Splash PLUS
  840: 2021, 850: 2021,                          // UNiVERSE
  860: 2022, 870: 2022,                          // FESTiVAL
  880: 2023, 890: 2023,                          // BUDDiES
  900: 2025, 910: 2026,                          // PRiSM（国服滞后一年）
}

/**
 * 版本的展示口径。
 *
 * 水鱼的 `from` 是**日服**版本名（如 `maimai でらっくす PRiSM PLUS`），但国服
 * 的实装顺序与之不同（存在超前实装 CIRCLE / MAGiCAL 曲目的情况），玩家关心的是
 * 国服版本。
 *
 * 因此 DX 时代（version > 700，即 FiNALE 之后）改用国服实装年对应的版本名；
 * FiNALE 及以前的旧框曲没有国服口径，沿用日服名。
 *
 * @param from        水鱼返回的日服版本名
 * @param version     VERSION_ORDER 映射值（0 表示未知）
 * @param installYear 国服实装年（来自 install-year 数据，可能为 null）
 */
export function formatVersionLabel(from: string, version: number, installYear?: number | null): string {
  // 旧框时期（maimai ~ FiNALE，索引 100~700）：沿用日服分类
  if (version > 0 && version <= 700) return getVersionDisplay(from)
  // DX 时代：优先用精确的实装年，缺失时按版本兜底
  const year = installYear ?? (version > 0 ? JP_TO_CN_YEAR[version] : undefined)
  if (year && CN_YEAR_LABEL[year]) return CN_YEAR_LABEL[year]
  return getVersionDisplay(from)
}
