<template>
  <div class="auto-report panel">
    <div class="panel-title">
      <span class="panel-title-text">自治区报表</span>
      <span class="data-flag" :class="{ live: isLive }">{{ isLive ? '接口' : '演示' }}</span>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-value">{{ view.ledgerCount }}<small>张</small></div>
        <div class="kpi-label">数据报表总数</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ view.dataCount }}<small>{{ view.dataUnit }}</small></div>
        <div class="kpi-label">累计数据总量</div>
      </div>
    </div>

    <div class="sec-title">数据分布情况</div>
    <div ref="barRef" class="chart-bar"></div>

    <div class="sec-title">报表名称</div>
    <el-table :data="view.tableData" size="small" class="list-table" height="360">
      <el-table-column type="index" label="序号" width="48" align="center" />
      <el-table-column prop="name" label="数据表名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="dept" label="发布部门名称" width="150" show-overflow-tooltip />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useDashboardApi } from '../composables/useDashboardApi'
import type { FillCountVO } from '../types/api'

/** 接口数据（getFillCount，isExtended=false）；未取到时降级为演示数据 */
const { autonomousFillCount } = useDashboardApi()
const isLive = computed(() => autonomousFillCount.value !== null)

/** 演示数据：接口不可用 / 演示模式时保留原效果 */
const MOCK = {
  ledgerCount: '94',
  dataCount: '1000',
  dataUnit: '万',
  deptDist: [
    { name: '自治区住建厅', value: 40 },
    { name: '自治区林业和草原局', value: 33 },
    { name: '自治区总工会', value: 30 },
    { name: '自治区妇联', value: 25 },
    { name: '自治区农牧厅', value: 20 },
    { name: '自治区市场监督管理局', value: 15 },
    { name: '自治区农牧厅', value: 10 },
    { name: '自治区大数据中心', value: 5 }
  ],
  tableData: Array.from({ length: 12 }, () => ({
    name: '内蒙古自治区住房和城乡建设厅公共负责住房调整数据表',
    dept: '内蒙古自治区住房和城乡建设厅'
  }))
}

/** { 部门名: 张数 } → 柱状图数据（按数量降序） */
const toDist = (map: FillCountVO['deptLedgerCount'] | undefined) =>
  Object.entries(map ?? {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)

/** 累计数据量按原始条数返回，超过万级换算成「万」展示 */
const formatVolume = (value: number) =>
  value >= 10000
    ? { value: (value / 10000).toFixed(1), unit: '万' }
    : { value: String(value), unit: '条' }

const view = computed(() => {
  const raw = autonomousFillCount.value
  if (!raw) return MOCK

  const volume = formatVolume(Number(raw.ledgerDataCount ?? 0))
  return {
    ledgerCount: String(raw.ledgerCount ?? 0),
    dataCount: volume.value,
    dataUnit: volume.unit,
    deptDist: toDist(raw.deptLedgerCount),
    tableData: (raw.ledgerListInfo ?? []).map((item) => ({
      name: item.ledgerName ?? '',
      dept: item.orgName ?? ''
    }))
  }
})

const dpr = window.devicePixelRatio || 1
const barRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/** 单独抽出渲染函数：接口数据异步到达后重新 setOption */
const renderBar = () => {
  if (!chart) return
  const dist = view.value.deptDist
  chart.setOption(
    {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { top: 4, right: 30, bottom: 4, left: 6, containLabel: true },
      dataZoom: [
        {
          type: 'inside',
          yAxisIndex: 0,
          startValue: 0,
          endValue: 5,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          filterMode: 'filter'
        }
      ],
      xAxis: {
        type: 'value',
        axisLabel: { color: '#7a93c4', fontSize: 10, formatter: '{value}张' },
        splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: dist.map((d) => d.name),
        axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
        axisTick: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: 10, width: 84, overflow: 'truncate' }
      },
      series: [
        {
          type: 'bar',
          data: dist.map((d) => d.value),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#1a6cff' },
              { offset: 1, color: '#40e0ff' }
            ]),
            borderRadius: [0, 3, 3, 0]
          },
          barMaxWidth: 10,
          label: { show: true, position: 'right', color: '#40e0ff', fontSize: 10, formatter: '{c}' }
        }
      ]
    },
    true
  )
}

onMounted(() => {
  if (!barRef.value) return
  chart = echarts.init(barRef.value, undefined, { devicePixelRatio: dpr })
  renderBar()
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(barRef.value)
})

watch(view, () => renderBar())

onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.auto-report {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.data-flag {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: normal;
  letter-spacing: 0;
  line-height: 1.4;
  padding: 1px 6px;
  border: 1px solid rgba(122, 147, 196, 0.35);
  border-radius: 8px;
  color: #7a93c4;
  white-space: nowrap;
}

.data-flag.live {
  color: #5dd39e;
  border-color: rgba(93, 211, 158, 0.45);
}

.kpi-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 8px 0;
}

.kpi-card {
  text-align: center;
  background: rgba(30, 50, 100, 0.35);
  border: 1px solid rgba(64, 158, 255, 0.3);
  border-radius: 4px;
  padding: 8px 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: bold;
  color: #40e0ff;
  font-family: 'DIN', 'Consolas', monospace;
}

.kpi-value small { font-size: 12px; margin-left: 2px; }

.kpi-label { margin-top: 2px; font-size: 12px; color: #c8d6f5; }

.sec-title {
  flex: 0 0 auto;
  text-align: center;
  font-size: 13px;
  color: #40e0ff;
  letter-spacing: 2px;
  margin: 2px 0;
}

.chart-bar { flex: 1 1 0; min-height: 0; }

.list-table { flex: 0 0 auto; }
</style>
