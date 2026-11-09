<template>
  <div class="entity-block">
    <div class="block-header">
      <span class="block-total">治理总数 {{ total }}</span>
      <span class="block-title">{{ title }}</span>
      <span v-if="tagTotal" class="block-total">标签总数 {{ tagTotal }}</span>
      <span v-else class="block-total placeholder"></span>
    </div>
    <div class="block-body">
      <div class="block-main">
        <div ref="trendRef" class="block-chart"></div>
        <div class="chart-caption">{{ axisTitle }}</div>
      </div>
      <div v-if="rightMode !== 'none'" class="block-side">
        <div v-if="rightMode === 'wordcloud'" class="side-cloud-item">
          <div class="donut-title">{{ cloudTitle }}</div>
          <div ref="cloudRef" class="side-cloud"></div>
        </div>
        <template v-else>
          <div
            v-for="(g, i) in donuts"
            :key="g.title"
            class="side-donut-item"
          >
            <div class="donut-title">{{ g.title }}</div>
            <div :ref="el => setDonutRef(el, i)" class="side-donut"></div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import 'echarts-wordcloud'

interface DonutGroup {
  title: string
  data: Array<{ name: string; value: number }>
}

const props = withDefaults(defineProps<{
  title: string
  total: string
  tagTotal?: string
  axisLabels: string[]
  trend: number[]
  rates: number[]
  cloudWords?: Array<{ name: string; value: number }>
  donuts?: DonutGroup[]
  /** 柱状图下方的说明文字：表明这组柱子代表什么数据 */
  axisTitle?: string
  /** 词云上方的小标题 */
  cloudTitle?: string
  /** 数据是否为空（空则显示占位） */
  empty?: boolean
}>(), {
  tagTotal: '',
  cloudWords: () => [],
  donuts: () => [],
  axisTitle: '按地区分布 · 基层治理量',
  cloudTitle: '主要标签分布情况',
  empty: false
})

const rightMode = props.cloudWords.length ? 'wordcloud' : (props.donuts.length ? 'donut' : 'none')

const dpr = window.devicePixelRatio || 1
const trendRef = ref<HTMLElement | null>(null)
const cloudRef = ref<HTMLElement | null>(null)
const donutRefs: Record<number, HTMLElement | null> = {}
const setDonutRef = (el: any, i: number) => { if (el) donutRefs[i] = el as HTMLElement }

let trendChart: echarts.ECharts | null = null
let cloudChart: echarts.ECharts | null = null
const donutCharts: echarts.ECharts[] = []
let ro: ResizeObserver | null = null

const PIE_COLORS = ['#40e0ff', '#5dd39e', '#409eff', '#6ab7ff', '#f5a623', '#9b8cff', '#1ed1a8', '#5b8ff9', '#30bf78', '#ffd166']

/** 地区名缩写：去掉行政后缀，最多 3 个字符，超出用省略号；悬停仍显示全称 */
const shortAxisLabel = (label: string) => {
  const name = label.replace(/(自治旗|自治县|自治盟|市|盟|旗|县|区)$/u, '')
  const base = name || label
  return base.length > 3 ? `${base.slice(0, 2)}…` : base
}

const renderTrend = () => {
  if (!trendChart) return
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p) return ''
        return `${p.axisValue}<br/>基层治理量：${p.data}`
      }
    },
    legend: {
      data: ['基层治理量'],
      textStyle: { color: '#a9c8f5', fontSize: 11 },
      top: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 8
    },
    grid: { top: 26, right: 10, bottom: 38, left: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.axisLabels,
      axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
      axisTick: { alignWithLabel: true, lineStyle: { color: 'rgba(64,158,255,0.25)' } },
      axisLabel: {
        color: '#a9c8f5', fontSize: 10, interval: 1, rotate: 50, margin: 8,
        formatter: (v: string) => shortAxisLabel(v)
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: '#9ab9e6', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
    },
    series: [{
      name: '基层治理量',
      type: 'bar',
      data: props.trend,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#67c23a' },
          { offset: 1, color: 'rgba(103,194,58,0.2)' }
        ]),
        borderRadius: [2, 2, 0, 0]
      },
      barWidth: 9
    }]
  }, true)
}

const renderCloud = () => {
  if (!cloudChart) return
  if (!props.cloudWords.length) { cloudChart.clear(); return }
  cloudChart.setOption({
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '95%',
      height: '95%',
      sizeRange: [10, 24],
      rotationRange: [-30, 30],
      rotationStep: 15,
      gridSize: 6,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'Microsoft YaHei',
        fontWeight: 'bold',
        color: () => PIE_COLORS[Math.floor(Math.random() * 6)]
      },
      data: props.cloudWords
    }]
  }, true)
}

const renderDonuts = () => {
  props.donuts.forEach((g, i) => {
    const el = donutRefs[i]
    if (!el) return
    let chart = donutCharts[i]
    if (!chart) {
      chart = echarts.init(el, undefined, { devicePixelRatio: dpr })
      donutCharts[i] = chart
    }
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}' },
      series: [{
        type: 'pie',
        center: ['50%', '50%'],
        radius: ['42%', '68%'],
        label: {
          color: '#7a93c4',
          fontSize: 10,
          formatter: '{b}\n{c}'
        },
        labelLine: { length: 6, length2: 6, lineStyle: { color: 'rgba(64,158,255,0.3)' } },
        itemStyle: { borderColor: 'rgba(8,16,38,0.95)', borderWidth: 2 },
        data: g.data.map((d, di) => ({ ...d, itemStyle: { color: PIE_COLORS[di % PIE_COLORS.length] } }))
      }]
    }, true)
  })
}

const renderAll = () => {
  renderTrend()
  if (rightMode === 'wordcloud') renderCloud()
  if (rightMode === 'donut') renderDonuts()
}

onMounted(() => {
  nextTick(() => {
    if (trendRef.value) {
      trendChart = echarts.init(trendRef.value, undefined, { devicePixelRatio: dpr })
    }
    if (rightMode === 'wordcloud' && cloudRef.value) {
      cloudChart = echarts.init(cloudRef.value, undefined, { devicePixelRatio: dpr })
    }
    renderAll()
    ro = new ResizeObserver(() => {
      trendChart?.resize()
      cloudChart?.resize()
      donutCharts.forEach((c) => c?.resize())
    })
    if (trendRef.value) ro.observe(trendRef.value)
  })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  trendChart?.dispose()
  cloudChart?.dispose()
  donutCharts.forEach((c) => c?.dispose())
})

defineExpose({ resize: () => {
  trendChart?.resize()
  cloudChart?.resize()
  donutCharts.forEach((c) => c?.resize())
} })
</script>

<style scoped>
.entity-block {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border: 1px solid rgba(64, 158, 255, 0.14);
  border-radius: 4px;
  background: rgba(10, 26, 58, 0.28);
  padding: 4px 6px 2px;
}

.block-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.block-title {
  font-size: 14px;
  font-weight: bold;
  color: #40e0ff;
  letter-spacing: 1px;
}

.block-total {
  flex: 0 0 auto;
  font-size: 11px;
  color: #cfe4ff;
  background: rgba(30, 50, 100, 0.5);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 3px;
  padding: 2px 8px;
}

.block-total.placeholder { visibility: hidden; }

.block-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 6px;
}

.block-main {
  flex: 1.5 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.block-chart {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.chart-caption {
  flex: 0 0 auto;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  line-height: 15px;
  color: #cfe4ff;
  letter-spacing: 0.5px;
  padding-bottom: 1px;
}

.block-side {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  gap: 4px;
}

.side-cloud-item {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-cloud { flex: 1 1 auto; min-width: 0; min-height: 0; }

.side-donut-item {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.donut-title {
  flex: 0 0 auto;
  text-align: center;
  font-size: 12px;
  color: #bcd9ff;
  padding-top: 2px;
}

.side-donut { flex: 1; min-height: 0; }
</style>
