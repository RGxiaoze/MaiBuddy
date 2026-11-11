// ============================================================
// Core types — neutral internal format (source-agnostic)
// Based on Diving-Fish API (primary) & LXNS API (supplementary)
// ============================================================

// ---- Enums ----

/** Difficulty level index (matches both Diving-Fish & LXNS) */
export type LevelIndex = 0 | 1 | 2 | 3 | 4

/** Chart/song type */
export type SongType = 'standard' | 'dx'

/** Grade / rate type */
export type RateType =
  | 'sssp' | 'sss' | 'ssp' | 'ss'
  | 'sp' | 's'
  | 'aaa' | 'aa' | 'a'
  | 'bbb' | 'bb' | 'b'
  | 'c' | 'd'

/** Full combo type */
export type FCType = 'app' | 'ap' | 'fcp' | 'fc'

/** Full sync type */
export type FSType = 'fsdp' | 'fsd' | 'fsp' | 'fs'

// ---- Note counts ----

/** Note counts for a single chart */
export interface Notes {
  total: number
  tap: number
  hold: number
  slide: number
  touch: number
  break: number
}

// ---- Chart & Song ----

/**
 * 拟合定数的口径。
 * - `sssPlus`：水鱼 fit_diff（详情页标 SSS+）
 * - `sss`：项目自算的 SSS 口径拟合
 */
export type FitDiffSource = 'sssPlus' | 'sss'

/** A single chart difficulty within a song */
export interface ChartDifficulty {
  type: SongType
  levelIndex: LevelIndex
  level: string           // display label e.g. "14+"
  levelValue: number      // chart constant (定数)
  noteDesigner: string    // charter name
  notes: Notes | null     // null = unavailable from API
}

/** Song metadata (internal format) */
export interface Song {
  id: number
  title: string
  artist: string
  genre: string
  bpm: number
  version: number         // version ID e.g. 25000
  from: string            // version name e.g. "舞萌2025"
  isNew: boolean          // is current-version song
  /** 实装日期（YYYY-MM-DD），来自水鱼 basic_info.release_date；缺失时为空串 */
  releaseDate?: string
  imageUrl: string        // computed cover URL
  difficulties: {
    standard: ChartDifficulty[]
    dx: ChartDifficulty[]
  }
}

// ---- Score ----

/** DX score detail (optional sub-record) */
export interface DxScoreDetail {
  maxDx: number
  achievedDx: number
  missedDx: number
}

/** A single player score record */
export interface Score {
  id?: number             // auto-incremented PK (IndexedDB)
  songId: number
  songTitle: string       // denormalized for display
  levelIndex: LevelIndex
  level: string           // e.g. "14+"
  levelValue: number      // chart constant (定数)
  songType: SongType
  achievements: number    // percentage, 0.00 ~ 101.00
  rate: RateType
  fcType: FCType | null
  fsType: FSType | null
  dxScore: number         // DX score points
  dxRating: number        // pre-computed (floor)
  dxScoreDetail?: DxScoreDetail
  playDate: string        // ISO date string
  createdAt?: Date
}

// ---- Player ----

/** Player profile (LXNS format) */
export interface Player {
  name: string
  rating: number
  friendCode: number
  courseRank: number
  classRank: number
  star: number
  trophy: { id: number; name: string; genre: string; color: string }
  icon: { id: number; name: string; genre: string }
  namePlate: { id: number; name: string }
  frame: { id: number; name: string }
  uploadTime: string
}

// ---- Diving-Fish API raw types ----

export interface DfMusic {
  id: string
  title: string
  type: 'SD' | 'DX'
  ds: number[]
  level: string[]
  cids: number[]
  charts: DfChart[]
  basic_info: DfBasicInfo
}

export interface DfBasicInfo {
  title: string
  artist: string
  genre: string
  bpm: number
  release_date: string
  from: string
  is_new: boolean
}

export interface DfChart {
  notes: number[]
  charter: string
}

export interface DfUserInfo {
  nickname: string
  rating: number
  additional_rating: number
  plate: string
  charts: {
    sd: DfChartInfo[]
    dx: DfChartInfo[]
  }
}

export interface DfChartInfo {
  achievements: number
  ds: number
  dxScore: number
  fc: string
  fs: string
  level: string
  level_index: number
  level_label: string
  ra: number
  rate: string
  song_id: number
  title: string
  type: string
}

// ---- LXNS API raw types ----

export interface LxnsSong {
  id: number
  title: string
  artist: string
  genre: string
  bpm: number
  version: number
  map?: string | null
  rights?: string | null
  locked?: boolean
  disabled?: boolean
  difficulties: {
    standard: LxnsDifficulty[]
    dx: LxnsDifficulty[]
    utage?: unknown[]
  }
}

export interface LxnsDifficulty {
  type: 'standard' | 'dx'
  difficulty: LevelIndex
  level: string
  level_value: number
  note_designer: string
  version: number
  notes?: LxnsNotes | null
}

export interface LxnsNotes {
  total: number
  tap: number
  hold: number
  slide: number
  touch: number
  break: number
}

/** 落雪 LXNS 成绩条目（B50 / 全部成绩 / Recent 共用） */
export interface LxnsScore {
  /** 曲目 ID（官方 Score 结构体字段名） */
  id?: number
  /** 曲目 ID（早期字段名，两者取其一，同时存在时以本字段为准） */
  song_id?: number
  song_name?: string
  /** 难度索引 0-4（部分接口会给出，缺失时以 level_index 为准） */
  level_index: number
  /** 谱面类型 */
  type?: 'standard' | 'dx'
  /** 官标等级字符串，如 "14+" */
  level?: string
  achievements: number
  dx_score?: number
  dx_rating?: number
  fc?: string | null
  fs?: string | null
  rate?: string
  play_time?: string | null
  upload_time?: string | null
}

/** 落雪 B50 响应（未指定曲目时） */
export interface LxnsBests {
  standard_total: number
  dx_total: number
  standard: LxnsScore[]
  dx: LxnsScore[]
}
