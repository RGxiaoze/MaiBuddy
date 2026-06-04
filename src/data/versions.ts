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

/** 日文/国际版 版本名 → 排序值 */
const JP_VERSION_ORDER: Record<string, number> = {
  'maimai':            100,
  'maimai PLUS':       110,
  'maimai GreeN':      200,
  'maimai GreeN PLUS': 210,
  'maimai ORANGE':     300,
  'maimai ORANGE PLUS': 310,
  'maimai PiNK':       400,
  'maimai PiNK PLUS':  410,
  'maimai MURASAKi':      500,
  'maimai MURASAKi PLUS': 510,
  'maimai MiLK':       600,
  'MiLK PLUS':         610,
  'FiNALE':            700,
  'DX':                800,
  'DX PLUS':           810,
  'Splash':            820,
  'Splash PLUS':       830,
  'UNiVERSE':          840,
  'UNiVERSE PLUS':     850,
  'FESTiVAL':          860,
  'FESTiVAL PLUS':     870,
  'BUDDiES':          880,
  'BUDDiES PLUS':     890,
  'PRiSM':            900,
  'PRiSM PLUS':       910,
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
