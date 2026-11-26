// ============================================================
// 定数变迁折线图
//
// 与 RadarChart 共用 echarts/core；这里只额外注册折线图所需模块。
// ============================================================

import { useMemo } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ChartSeries } from '@/utils/levelHistory'

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

interface LevelHistoryChartProps {
  series: ChartSeries
  className?: string
}

export default function LevelHistoryChart({ series, className }: LevelHistoryChartProps) {
  const option = useMemo(() => {
    const lastIndex = series.values.length - 1
    const data = series.values.map((value, i) => {
      // 「当前」点是实测值，用空心圆与前边的年度快照区分
      if (i === lastIndex && series.labels[i] === '当前') {
        return {
          value,
          symbol: 'emptyCircle',
          symbolSize: 9,
          itemStyle: { color: '#6C4DBF', borderColor: '#6C4DBF', borderWidth: 2 },
        }
      }
      return value
    })

    return {
      grid: { left: 4, right: 12, top: 18, bottom: 4, containLabel: true },
      tooltip: {
        trigger: 'axis' as const,
        backgroundColor: '#fff',
        borderColor: '#e0e0e0',
        textStyle: { color: '#333', fontSize: 12 },
        valueFormatter: (v: unknown) => (typeof v === 'number' ? v.toFixed(1) : '—'),
      },
      xAxis: {
        type: 'category' as const,
        data: series.labels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLabel: { color: '#888', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(91,164,207,0.3)' } },
      },
      yAxis: {
        type: 'value' as const,
        scale: true,
        axisLabel: { color: '#888', fontSize: 11, formatter: (v: number) => v.toFixed(1) },
        splitLine: { lineStyle: { color: 'rgba(91,164,207,0.12)' } },
      },
      series: [
        {
          type: 'line' as const,
          name: '定数',
          data,
          // 定数在下次调整前一直不变，画成阶梯更贴近事实
          step: 'end' as const,
          // 首个快照之前留空，不跨越连线
          connectNulls: false,
          symbolSize: 6,
          lineStyle: { color: '#5BA4CF', width: 2 },
          itemStyle: { color: '#5BA4CF' },
          areaStyle: { color: 'rgba(91,164,207,0.08)' },
        },
      ],
    }
  }, [series])

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={option}
      className={className}
      style={{ height: '200px', width: '100%' }}
      notMerge
      lazyUpdate
    />
  )
}
