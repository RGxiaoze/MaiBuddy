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
