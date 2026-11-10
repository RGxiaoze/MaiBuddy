import { describe, it, expect } from 'vitest'
import { VERSION_ORDER } from '../versions'

describe('VERSION_ORDER', () => {
  it('早期版本映射到 100–210（GreeN PLUS 及以前）', () => {
    expect(VERSION_ORDER.get('maimai')).toBe(100)
    expect(VERSION_ORDER.get('maimai PLUS')).toBe(110)
    expect(VERSION_ORDER.get('maimai GreeN PLUS')).toBe(210)
  })

  it('DX 时代每个大版本间隔 20', () => {
    expect(VERSION_ORDER.get('maimai でらっくす')).toBe(800)
    expect(VERSION_ORDER.get('maimai でらっくす Splash')).toBe(820)
    expect(VERSION_ORDER.get('maimai でらっくす UNiVERSE')).toBe(840)
    expect(VERSION_ORDER.get('maimai でらっくす FESTiVAL')).toBe(860)
    expect(VERSION_ORDER.get('maimai でらっくす BUDDiES')).toBe(880)
    expect(VERSION_ORDER.get('maimai でらっくす PRiSM')).toBe(900)
  })

  it('DX 时代的 PLUS 版本取基础值 +10', () => {
    expect(VERSION_ORDER.get('maimai でらっくす Splash PLUS')).toBe(830)
    expect(VERSION_ORDER.get('maimai でらっくす UNiVERSE PLUS')).toBe(850)
    expect(VERSION_ORDER.get('maimai でらっくす FESTiVAL PLUS')).toBe(870)
    expect(VERSION_ORDER.get('maimai でらっくす BUDDiES PLUS')).toBe(890)
    expect(VERSION_ORDER.get('maimai でらっくす PRiSM PLUS')).toBe(910)
  })

  it('国服版本覆盖到 2026', () => {
    expect(VERSION_ORDER.get('舞萌DX')).toBe(8000)
    expect(VERSION_ORDER.get('舞萌DX 2021')).toBe(8020)
    expect(VERSION_ORDER.get('舞萌2025')).toBe(8060)
    expect(VERSION_ORDER.get('舞萌2026')).toBe(8070)
  })
})
