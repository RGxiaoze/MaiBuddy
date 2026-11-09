import { describe, it, expect } from 'vitest'
import { parseLxnsScores, buildLxnsCsv } from '../lxnsCsv'
import type { ScoreRecord } from '@/db/database'

const HEADER = 'id,song_name,level,level_index,achievements,fc,fs,dx_score,dx_rating,rate,song_type,upload_time,play_time'

describe('parseLxnsScores', () => {
  it('解析基本行并映射为落雪成绩结构', () => {
    const csv = [
      HEADER,
      '2025,魔法仕掛けのファンタジア,14+,3,99.5454,,sync,2748,310.86037512,ssp,dx,2026-11-09 01:03:38,2026-11-08 03:15:00',
    ].join('\n')

    const rows = parseLxnsScores(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 2025,
      type: 'dx',
      level_index: 3,
      level: '14+',
      achievements: 99.5454,
      fs: 'sync',
      dx_score: 2748,
      rate: 'ssp',
      play_time: '2026-11-08 03:15:00',
    })
  })

  it('处理引号包裹、逗号与 "" 转义', () => {
    const csv = [
      HEADER,
      '303,"Endless, Sleepless Night",10+,2,100.9583,ap,,1316,243.1296,sssp,standard,2026-11-09 01:03:41,',
      '1064,"Little ""Sister"" Bitch",11,2,100.7481,,,1574,249.8832,sssp,dx,2026-11-09 01:03:43,',
    ].join('\n')

    const rows = parseLxnsScores(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].achievements).toBe(100.9583)
    expect(rows[0].fc).toBe('ap')
    expect(rows[0].play_time).toBeNull()
    expect(rows[1].achievements).toBe(100.7481)
  })

  it('兼容 BOM 与 CRLF 行尾', () => {
    const csv = '\uFEFF' + [HEADER, '384,VERTeX,14+,3,99.7824,,sync,2357,309.5,ssp,standard,2026-11-09 01:03:38,2026-11-08 03:12:00'].join('\r\n')
    const rows = parseLxnsScores(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(384)
  })

  it('容忍行尾空行与缺失的可选列', () => {
    const csv = [HEADER, '384,VERTeX,14+,3,99.7824,,sync,2357,309.5,ssp,standard,2026-11-09 01:03:38,', ''].join('\n')
    expect(parseLxnsScores(csv)).toHaveLength(1)
  })

  it('表头不是落雪格式时返回空数组', () => {
    expect(parseLxnsScores('a,b,c\n1,2,3')).toHaveLength(0)
  })

  it('缺少 id 或 achievements 的行被跳过', () => {
    const csv = [HEADER, ',X,14,3,99.5,,,100,300,sss,dx,,', '1,Y,14,3,,,,100,300,sss,dx,,'].join('\n')
    expect(parseLxnsScores(csv)).toHaveLength(0)
  })
})

describe('buildLxnsCsv', () => {
  const record = (over: Partial<ScoreRecord>): ScoreRecord => ({
    id: 1,
    songId: 2025,
    songTitle: 'テスト',
    levelIndex: 3,
    level: '14+',
    levelValue: 14.9,
    songType: 'dx',
    achievements: 99.5454,
    rate: 'ssp',
    fcType: null,
    fsType: 'sync',
    dxScore: 2748,
    dxRating: 310,
    dxScoreDetail: null,
    playDate: '2026-11-08',
    createdAt: new Date('2026-11-09T01:03:38Z'),
    ...over,
  } as ScoreRecord)

  it('输出与落雪一致的表头', () => {
    const csv = buildLxnsCsv([record({})], new Date('2026-11-09T09:00:00'))
    expect(csv.split('\n')[0]).toBe(HEADER)
  })

  it('DX 条目的曲目 ID 取余回基础 ID', () => {
    const csv = buildLxnsCsv([record({ songId: 12025 })], new Date('2026-11-09T09:00:00'))
    expect(csv.split('\n')[1].startsWith('2025,')).toBe(true)
  })

  it('曲名含逗号或引号时加引号并转义', () => {
    const csv = buildLxnsCsv([
      record({ songTitle: 'Endless, Sleepless Night' }),
      record({ songTitle: 'Little "Sister" Bitch', songId: 1064 }),
    ], new Date('2026-11-09T09:00:00'))
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"Endless, Sleepless Night"')
    expect(lines[2]).toContain('"Little ""Sister"" Bitch"')
  })

  it('空值输出为空字段而非 "null"', () => {
    const csv = buildLxnsCsv([record({ fcType: null, fsType: null, rate: '' })], new Date('2026-11-09T09:00:00'))
    const line = csv.split('\n')[1]
    expect(line).not.toContain('null')
    expect(line).not.toContain('undefined')
  })

  it('导出的内容能被自己解析回来', () => {
    const csv = buildLxnsCsv([record({})], new Date('2026-11-09T09:00:00'))
    const rows = parseLxnsScores(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 2025, type: 'dx', achievements: 99.5454 })
  })
})
