import { describe, it, expect } from 'vitest'
import {
  BUTTON_ANGLES,
  SENSOR_OFFSET,
  getPosition,
  TAP_HALF,
  A_HALF,
  D_HALF,
  DEFAULT_RIGHT_HAND,
  DEFAULT_LEFT_HAND,
} from '../../../research/maimai-layout'

describe('maimai layout — geometry', () => {
  it('8 buttons have 45° spacing (including wrap)', () => {
    expect(Object.keys(BUTTON_ANGLES).length).toBe(8)
    const angles = Object.values(BUTTON_ANGLES).sort((a, b) => a - b)
    for (let i = 0; i < 7; i++) {
      expect(angles[i + 1] - angles[i]).toBeCloseTo(45, 0)
    }
    // 337.5° → 22.5° wrap gap = 45°
    const wrapGap = angles[0] + 360 - angles[7]
    expect(wrapGap).toBeCloseTo(45, 0)
  })

  it('buttons 4 and 5 are at bottom (south half)', () => {
    for (const b of [4, 5]) {
      const a = BUTTON_ANGLES[b]
      expect(a).toBeGreaterThan(90)
      expect(a).toBeLessThan(270)
    }
  })

  it('buttons 1 and 8 are at top (north half)', () => {
    const a1 = BUTTON_ANGLES[1]
    const a8 = BUTTON_ANGLES[8]
    // 1=22.5° (N/NE), 8=337.5° (N/NW)
    expect(a1).toBeLessThan(90)
    expect(a8).toBeGreaterThan(270)
  })

  it('default hands at buttons 3 (right) and 6 (left)', () => {
    expect(DEFAULT_RIGHT_HAND).toBe(3)
    expect(DEFAULT_LEFT_HAND).toBe(6)
  })

  it('A and D fan rings fill 360° without overlap', () => {
    // 8 × (A_HALF*2) + 8 × (D_HALF*2) = 360°
    const total = 8 * ((A_HALF + D_HALF) * 2)
    expect(Math.round(total * 100) / 100).toBe(360)
  })

  it('D and E sensors are offset 22.5°', () => {
    expect(SENSOR_OFFSET['D']).toBe(22.5)
    expect(SENSOR_OFFSET['E']).toBe(22.5)
    expect(SENSOR_OFFSET['A']).toBe(0)
    expect(SENSOR_OFFSET['Tap']).toBe(0)
  })

  it('D1 position differs from Tap1 position', () => {
    const tap1 = getPosition('Tap', 0)
    const d1 = getPosition('D', 0)
    expect(tap1.x).not.toBe(d1.x)
  })

  it('button angular width is about half of A zone', () => {
    expect(TAP_HALF).toBeCloseTo(8.4, 1)
    expect(A_HALF).toBeCloseTo(16, 0)
  })
})
