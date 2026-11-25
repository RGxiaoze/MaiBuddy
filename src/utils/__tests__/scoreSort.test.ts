import { describe, it, expect } from 'vitest'
import { sortScoresByLevel } from '../scoreSort'

describe('sortScoresByLevel', () => {
  it('按难度升序排列：BASIC → Re:MASTER', () => {
    const input = [
      { id: 1, levelIndex: 4 },
      { id: 2, levelIndex: 3 },
      { id: 3, levelIndex: 0 },
      { id: 4, levelIndex: 2 },
      { id: 5, levelIndex: 1 },
    ]
    expect(sortScoresByLevel(input).map((s) => s.levelIndex)).toEqual([0, 1, 2, 3, 4])
  })

  it('修掉「Re:MASTER 排在 MASTER 前面」的实际错乱', () => {
    const input = [{ id: 1, levelIndex: 4 }, { id: 2, levelIndex: 3 }]
    expect(sortScoresByLevel(input).map((s) => s.levelIndex)).toEqual([3, 4])
  })

  it('同难度按 id 升序，保证渲染顺序稳定', () => {
    const input = [
      { id: 9, levelIndex: 3 },
      { id: 2, levelIndex: 3 },
    ]
    expect(sortScoresByLevel(input).map((s) => s.id)).toEqual([2, 9])
  })

  it('不修改入参数组', () => {
    const input = [
      { id: 1, levelIndex: 4 },
      { id: 2, levelIndex: 3 },
    ]
    sortScoresByLevel(input)
    expect(input.map((s) => s.levelIndex)).toEqual([4, 3])
  })

  it('空数组安全', () => {
    expect(sortScoresByLevel([])).toEqual([])
  })
})
