import { parseMaidataFile } from '../src/utils/chartParser'
import { computeDisplacement } from '../src/utils/displacement'
import { recognizeConfigs } from '../src/utils/configRecognition'
import { scoreDimensions } from '../src/utils/dimensionScorer'
import { readFileSync } from 'fs'

function round(n: number) { return Math.round(n * 10) / 10 }

function testChart(name: string, file: string, inote: number) {
  console.log(`\n=== ${name} (inote_${inote}) ===`)
  const content = readFileSync(file, 'utf-8')
  const chart = parseMaidataFile(content, inote)
  const frames = computeDisplacement(chart)
  const segments = recognizeConfigs(frames, chart.bpm, chart.timingChanges.map(t => t.subdivisions))
  const scores = scoreDimensions(frames, segments, chart.bpm)

  const segTypes: Record<string, number> = {}
  for (const s of segments) {
    segTypes[s.type] = (segTypes[s.type] || 0) + 1
  }

  console.log(`  小节: ${chart.noteCollections.length}, BPM: ${chart.bpm}`)
  console.log(`  帧数: ${frames.length}, 配置段: ${segments.length}`)
  console.log(`  配置:`, Object.entries(segTypes).map(([k,v]) => `${k}×${v}`).join(', '))
  console.log(`  底力: ${round(scores.baseStrength)}  体力: ${round(scores.stamina)}  爆发: ${round(scores.burst)}  技巧: ${round(scores.technique)}  定位: ${round(scores.positioning)}`)
}

testChart('封焔 Master', 'tmp_chart2/maidata.txt', 5)
testChart('Schwarzschild Master', 'tmp_schwarz/maidata.txt', 5)
testChart('Sqlupp Master', 'tmp_sqlupp/maidata.txt', 5)
