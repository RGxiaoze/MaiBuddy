// ============================================================
// maimai DX 区域布局 — 几何模型（知识库定稿）
// ============================================================
// 坐标系：0°=12点（正上），顺时针为正，原点=屏幕圆心
//   角度来源：AstroDX SlideGenerator.GetRotation()
//   区域描述来源：用户经验（初代 maimai + DX 追加）
//
// 布局由外向内共 6 层：
//   按键(Tap) → A → D → E → B → C
//
// 默认手位：右手=3号键，左手=6号键
// ============================================================

// ---- 按钮角度（8 按钮，45° 等间距正八边形） ----

export const BUTTON_ANGLES: Record<number, number> = {
  1: 22.5, 2: 67.5, 3: 112.5, 4: 157.5,
  5: 202.5, 6: 247.5, 7: 292.5, 8: 337.5,
}

// ---- 默认手位 ----

export const DEFAULT_RIGHT_HAND = 3
export const DEFAULT_LEFT_HAND = 6

// ---- 角度偏移（D/E 夹在 A/B 之间，+22.5°） ----

export const SENSOR_OFFSET: Record<string, number> = {
  Tap: 0, A: 0, B: 0, C: 0, D: 22.5, E: 22.5,
}

// ---- 按键区（外环扇环，A 区外侧） ----

export const TAP_INNER = 1.04       // 内径 = 屏幕外缘 + 间隙
export const TAP_OUTER = 1.30       // 外径 ≈ B 圆直径
export const TAP_HALF = 8.4         // 半张角（度）

// ---- A / D 区（外环扇环，交替排列，外径=屏幕边缘，内径≈2/3） ----

export const OUTER_R = 1.0
export const INNER_R = 2 / 3

export const A_HALF = 16            // A区半张角 16° → 总 32°
export const D_HALF = (45 - A_HALF * 2) / 2  // D区半张角 6.5°（填满 A 间隙，无重叠）

// ---- B 区（8 个圆，相邻相切，与按钮同角度） ----

export const B_RADIUS = 0.14
export const B_CENTER = 0.42

// ---- E 区（正方形，旋转 45°，D 区下方，侵入 D 和 B） ----

export const E_CENTER = 0.60
export const E_SIDE = 0.113         // 边长（比例值）
export const E_ROTATION = 45        // 正方形旋转角度

// ---- C 区（圆心正八边形，C1 右半 / C2 左半共享判定） ----

export const C_RADIUS = 0.143       // 外接圆半径（33px/230px）

// ---- 辅助函数 ----

export function polarXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.sin(rad) * r, y: -Math.cos(rad) * r }
}

/** 获取传感器组的中心半径 */
export function sensorRadius(group: string): number {
  switch (group) {
    case 'Tap': return (TAP_INNER + TAP_OUTER) / 2
    case 'A': case 'D': return (OUTER_R + INNER_R) / 2
    case 'B': return B_CENTER
    case 'E': return E_CENTER
    case 'C': return 0
    default: return 0
  }
}

/** 获取位置的笛卡尔坐标 */
export function getPosition(group: string, index: number) {
  if (group === 'C') return { x: 0, y: 0 }
  const baseAngle = BUTTON_ANGLES[index + 1] ?? 0
  const angle = (baseAngle + (SENSOR_OFFSET[group] ?? 0)) % 360
  return polarXY(angle, sensorRadius(group))
}
