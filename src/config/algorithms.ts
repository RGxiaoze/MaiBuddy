// ============================================================
// 舞萌DX 算法配置常量 — 所有业务语义的魔法数字集中管理
// ============================================================

// ---- B50 结构 ----

/** B50 旧版本曲目池大小（Best 35，标准谱面 + DX 谱面中旧版本曲目） */
export const B35_SIZE = 35

/** B50 新版本曲目池大小（Best 15，当前版本 DX 曲目） */
export const B15_SIZE = 15

/** 宴会场（Utage）曲目 ID 起始值，≥此值的曲目不参与 B50 计算 */
export const UTAGE_ID_THRESHOLD = 100000

// ---- Rating 计算 ----

/** 达成率理论上限（100.5%），超过部分不计入 DX Rating */
export const MAX_ACHIEVEMENTS = 100.5

// ---- 推分段位（玩家社区共识分级） ----

/** Rating 段位分界线，用于推分策略分层 */
export const RATING_TIERS = {
  /** 入门 → 铜框：8000 分以下 */
  BEGINNER: 8000,
  /** 铜框 → 金框：10000 分 */
  INTERMEDIATE: 10000,
  /** 金框 → 白金框：13000 分 */
  ADVANCED: 13000,
  /** 白金框 → 万六：15000 分 */
  EXPERT: 15000,
  /** 万六：16000 分 */
  MANSAI: 16000,
  /** 14+攻克：16200 分 */
  GRANDMASTER_INTERMEDIATE: 16200,
  /** 冲击理论：16400 分 */
  GRANDMASTER: 16400,
} as const

/** 玩家总 Rating 低于此值时，推分路线排除 15 级谱面（避免越级建议） */
export const EXCLUDE_LV15_RATING = 14500

// ---- 定数分段（推分路线四阶段） ----

/** 低定数区上限：10.0~12.5 */
export const LEVEL_TIER_LOW = 12.5

/** 中定数区上限：12.5~13.5 */
export const LEVEL_TIER_MID = 13.5

/** 高定数区上限：13.5~14.0 */
export const LEVEL_TIER_HIGH = 14.0

/** 超高定数区起始：14.0+ */
export const LEVEL_TIER_ULTRA = 14.0

/** 每阶段最多推荐的曲目数 */
export const MAX_PER_PHASE = 5

/** 练习推荐每级最多曲目数 */
export const MAX_PRACTICE_PER_LEVEL = 2

/** 练习推荐最大总数 */
export const MAX_PRACTICE_TOTAL = 15

// ---- 推分建议参数 ----

/** 推分建议难度分类：diffFromLevelAvg > 此值 → easy（水分曲） */
export const EASY_DIFF_THRESHOLD = 2.0

/** 推分建议难度分类：diffFromLevelAvg < 此值 → hard（硬谱） */
export const HARD_DIFF_THRESHOLD = -1.0

/** SSS+ 率超过此值可提升难度分类一档（如 hard → medium） */
export const SSSP_RATE_BOOST = 0.15

/** 推分路线中 diffFromLevelAvg > 此值 → +2 boost（大水分优先） */
export const ROUTE_BOOST_HIGH = 1.5

/** 推分路线中 diffFromLevelAvg > 此值 → +1 boost（小水分优先） */
export const ROUTE_BOOST_LOW = 0.5

/** 无 chart_stats 时的 achievement 回退阈值：≥此值 → easy */
export const FALLBACK_EASY_ACH = 99.5

/** 无 chart_stats 时的 achievement 回退阈值：≥此值 → medium */
export const FALLBACK_MEDIUM_ACH = 98.0

/** 15 级谱面永远归类为 hard（个人差极大） */
export const ALWAYS_HARD_LEVEL = 15

/** 推分建议中排除"随便打打"的低定数低达成率曲目：定数 < 此值且达成率 < 97% */
export const SKIP_LOW_LEVEL = 14

/** 推分建议中排除低达成率曲目的最低达成率阈值 */
export const SKIP_LOW_ACH = 97

// ---- classifyDifficulty 加权参数（综合全服数据 + 当前→目标 gap） ----

/** 社区统计权重（diffFromLevelAvg 归一化后） */
export const DIFF_WEIGHT_COMMUNITY = 0.6

/** gap 维度权重（(目标−当前) 归一化后） */
export const DIFF_WEIGHT_GAP = 0.4

/** 复合分 ≥ 此值 → easy */
export const DIFF_COMPOSITE_EASY = 0.65

/** 复合分 ≥ 此值 → medium（低于此值 → hard） */
export const DIFF_COMPOSITE_MEDIUM = 0.35

/** gap 归一化分母（超出此值 gap 分归零） */
export const DIFF_GAP_NORM_MAX = 15

/** diffFromLevelAvg 归一化偏移（diff + offset）/ (offset*2) 映射到 [0,1] */
export const DIFF_COMMUNITY_NORM_OFFSET = 5

/** 无 chart_stats 回退：gap > 此值降一级难度 */
export const DIFF_FALLBACK_GAP_THRESHOLD = 5

/** 推分建议排序时 ratingGain 平局判定容差 */
export const SUGGESTION_SORT_TOLERANCE = 0.1

/** SSS+ 率在排序中的加权系数（ratingGain × (1 + sssPlusRate × 此值)） */
export const SSSP_SORT_WEIGHT = 2

// ---- realisticTargetAch 分段（谱面定数与舒适区的差距 → 合理目标达成率） ----

/** gap ≤ -0.5（远低于舒适区）→ 理论天花板 */
export const TARGET_GAP_WELL_BELOW = -0.5

/** gap ≤ 0（在舒适区内）→ 理论天花板 */
export const TARGET_GAP_AT_COMFORT = 0

/** gap ≤ 0.5（紧凑伸展，覆盖 pełny 推分区间 mode+0.1→mode+0.5）→ 理论天花板 */
export const TARGET_GAP_CLOSE = 0.5

/** gap ≤ 1.0（中度伸展）→ SSS (100.0%) */
export const TARGET_GAP_MODERATE = 1.0

/** gap ≤ 1.5（远伸展）→ SS+ (99.0%)，用于 B50 地板曲目推分 */
export const TARGET_GAP_FAR = 1.5

/** 超出伸展区外的回退达成率 → SS+ (98.5%) */
export const TARGET_FALLBACK_ACH = 98.5

/** B35 众数计算最小曲目数（不足时回退为均值） */
export const B35_MODE_MIN_COUNT = 5

/** B35 均值的回退定数（B35 为空时） */
export const B35_FALLBACK_LEVEL = 14.0

// ---- 谱面分类阈值（chartTags.ts） ----

/** 技巧型：TOUCH 占比 > 3% */
export const TECH_TOUCH_MIN = 0.03

/** 技巧型：SLIDE 占比 > 25% */
export const TECH_SLIDE_MIN = 0.25

/** 星星型：SLIDE 占比 > 20% */
export const STAR_SLIDE_MIN = 0.20

/** 体力型：总物量 > 900 */
export const STAMINA_NOTES_MIN = 900

/** 体力型：BPM > 170 */
export const STAMINA_BPM_MIN = 170

/** 纵连型：TAP 占比 > 65% */
export const JACK_TAP_MIN = 0.65

/** 纵连型：BREAK 占比 > 2% */
export const JACK_BREAK_MIN = 0.02

/** 跳拍型：SLIDE 占比 < 10% */
export const JUMP_SLIDE_MAX = 0.10

/** 跳拍型：TOUCH 占比 < 1% */
export const JUMP_TOUCH_MAX = 0.01

/** 跳拍型：BREAK 占比 > 5% */
export const JUMP_BREAK_MIN = 0.05

/** 跳拍型：BPM > 150 */
export const JUMP_BPM_MIN = 150

/** 交互型：TAP 占比 > 60% */
export const STREAM_TAP_MIN = 0.60

/** 交互型：BPM > 160 */
export const STREAM_BPM_MIN = 160

// ---- 五维分析参数（dimensions.ts） ----

/** 底力归一化最大值：BPM × 总物量 */
export const DIM_NORM_PROCESSING = 20000

/** 体力归一化最大值：总物量 × 估算时长 */
export const DIM_NORM_STAMINA = 50000

/** 爆发归一化最大值：BPM × 峰值密度 */
export const DIM_NORM_BURST = 30000

/** 定位归一化最大值：位置比值 */
export const DIM_NORM_POSITIONING = 0.8

/** 技巧归一化最大值：技巧比值 */
export const DIM_NORM_TECHNIQUE = 0.7

/** 估算谱面时长时的 BPM→秒 换算系数（total/BPM × 60） */
export const DIM_BPM_TO_SECONDS = 60

/** 无法计算时长时的回退值（秒，约 2 分钟） */
export const DIM_FALLBACK_LENGTH = 120

/** 峰值密度放大系数（peak ≈ average × 1.5） */
export const DIM_PEAK_MULTIPLIER = 1.5

/** 定位维度：SLIDE 权重 */
export const DIM_POS_SLIDE_WEIGHT = 1.5

/** 定位维度：HOLD 权重 */
export const DIM_POS_HOLD_WEIGHT = 0.8

/** 技巧维度：SLIDE 权重 */
export const DIM_TECH_SLIDE_WEIGHT = 1.2

/** 技巧维度：TOUCH 权重 */
export const DIM_TECH_TOUCH_WEIGHT = 1.1

/** 五维能力计算最低达成率门槛（≥ 97% 的成绩才参与） */
export const DIM_MIN_ACHIEVEMENTS = 97

/** 练习推荐：已达标曲目的包含阈值（步进系数） */
export const PRACTICE_INCLUDE_THRESHOLD = 0.8

/** 练习推荐：渐进式递增步长 */
export const PRACTICE_LEVEL_STEP = 0.3

/** 练习推荐：同级判定容差 */
export const PRACTICE_LEVEL_TOLERANCE = 0.2

// ---- 短板分析参数（weaknessAnalysis.ts） ----

/** 短板分析最低样本量（至少 N 首该标签的谱面成绩才纳入短板判定） */
export const WEAKNESS_MIN_SAMPLES = 3

/** 强弱判定分界线：达成率 ≥ 97% 为强（strong），否则为弱（weak） */
export const WEAKNESS_STRONG_THRESHOLD = 97

// ---- 成就/理论值参数（strategy.ts） ----

/** AP 追踪的定数下限（14.0~14.9 区间追 AP） */
export const AP_TRACK_LEVEL_MIN = 14.0

/** AP 追踪的定数上限 */
export const AP_TRACK_LEVEL_MAX = 15.0

/** AP 预览最多显示曲目数 */
export const AP_PREVIEW_MAX = 5
