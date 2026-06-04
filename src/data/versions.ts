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
  'maimai FiNALE':            700,
  'maimai でらっくす':         800,
  'maimai でらっくす Splash':   820,
  'maimai でらっくす UNiVERSE': 840,
  'maimai でらっくす FESTiVAL': 860,
  'maimai でらっくす BUDDiES':  880,
  'maimai でらっくす PRiSM':    900,
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
