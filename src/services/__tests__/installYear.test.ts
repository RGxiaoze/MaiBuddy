import { describe, it, expect, beforeEach } from 'vitest'
import {
  getInstallYear,
  isInstallYearLoaded,
  resetInstallYear,
} from '../installYearService'
import {
  FIT_DIFF_YEAR_CORRECTION,
  SSS_FIT_YEAR_CORRECTION,
  EARLY_VERSION_MAX,
} from '@/config/algorithms'

describe('installYearService', () => {
  beforeEach(() => resetInstallYear())

  it('未加载时查询返回 null，不抛错', () => {
    expect(isInstallYearLoaded()).toBe(false)
    expect(getInstallYear(8, 3)).toBeNull()
  })

  it('reset 后回到未加载状态', () => {
    resetInstallYear()
    expect(isInstallYearLoaded()).toBe(false)
  })
})

describe('拟合定数的版本校正常量', () => {
  it('只对偏差显著的年份校正（2024 / 2026）', () => {
    expect(FIT_DIFF_YEAR_CORRECTION[2024]).toBe(0.12)
    expect(FIT_DIFF_YEAR_CORRECTION[2026]).toBe(0.24)
  })

  it('偏差 <0.06 的年份不校正', () => {
    expect(FIT_DIFF_YEAR_CORRECTION[2020]).toBeUndefined()
    expect(FIT_DIFF_YEAR_CORRECTION[2021]).toBeUndefined()
    expect(FIT_DIFF_YEAR_CORRECTION[2022]).toBeUndefined()
    expect(FIT_DIFF_YEAR_CORRECTION[2023]).toBeUndefined()
  })

  it('SSS 口径的校正幅度小于 fit_diff（斜率更平）', () => {
    expect(SSS_FIT_YEAR_CORRECTION[2026]).toBe(0.15)
    expect(SSS_FIT_YEAR_CORRECTION[2026]!).toBeLessThan(FIT_DIFF_YEAR_CORRECTION[2026]!)
    // 老曲端方向相反：SSS 口径偏正，需要减回去
    expect(SSS_FIT_YEAR_CORRECTION[2020]).toBe(-0.04)
  })

  it('早期曲阈值是 GreeN PLUS（210）', () => {
    expect(EARLY_VERSION_MAX).toBe(210)
  })
})
