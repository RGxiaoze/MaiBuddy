// ============================================================
// ECharts radar chart — reusable five-dimension visualization
// ============================================================

import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { RadarChart as ERadar } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// Register required ECharts modules (tree-shaking)
echarts.use([ERadar, TooltipComponent, LegendComponent, CanvasRenderer])

export interface RadarDataPoint {
  name: string
  value: number[]
  color?: string
}

interface RadarChartProps {
  /** Dimension labels (5 items) */
  dimensions: string[]
  /** Max value for each axis */
  max: number
  /** Data series to plot */
  data: RadarDataPoint[]
  /** Optional: highlight current hover tooltip */
  className?: string
}

export default function RadarChart({ dimensions, max, data, className }: RadarChartProps) {
  const option = useMemo(() => ({
    radar: {
      indicator: dimensions.map(name => ({ name, max })),
      center: ['50%', '55%'],
      radius: '65%',
      axisName: {
        color: '#888',
        fontSize: 12,
        padding: [0, 0],
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(91, 164, 207, 0.05)', 'rgba(91, 164, 207, 0.1)'],
        },
      },
      splitLine: {
        lineStyle: { color: 'rgba(91, 164, 207, 0.2)' },
      },
      axisLine: {
        lineStyle: { color: 'rgba(91, 164, 207, 0.3)' },
      },
    },
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: '#fff',
      borderColor: '#e0e0e0',
      textStyle: { color: '#333', fontSize: 12 },
    },
    series: data.map((d, i) => ({
      type: 'radar' as const,
      name: d.name,
      data: [{ value: d.value, name: d.name }],
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: {
        color: d.color || ['#5BA4CF', '#B8A0E8'][i % 2],
        width: 2,
      },
      areaStyle: {
        color: d.color || ['#5BA4CF', '#B8A0E8'][i % 2],
        opacity: 0.15,
      },
      itemStyle: {
        color: d.color || ['#5BA4CF', '#B8A0E8'][i % 2],
      },
    })),
  }), [dimensions, max, data])

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      className={className}
      style={{ height: '360px', width: '100%' }}
      notMerge
      lazyUpdate
    />
  )
}
