<template>
  <div class="simplify-list panel">
    <div class="panel-title">
      <span class="panel-title-text">基层精简保留清单</span>
    </div>

    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-value">{{ view.ledgerCount }}<small>张</small></div>
        <div class="kpi-label">基层扩底表</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ view.dataCount }}<small>{{ view.dataUnit }}</small></div>
        <div class="kpi-label">累计填报数据</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">{{ view.issueCount }}</div>
        <div class="kpi-label">涉及下发部门总数</div>
      </div>
    </div>

    <div class="mid-row">
      <div class="mid-left">
        <div class="sec-title">数据报表分布情况</div>
        <div ref="barRef" class="chart-bar"></div>
      </div>
      <div class="mid-right">
        <div class="sec-title">按频率统计</div>
        <div ref="donutRef" class="chart-donut"></div>
      </div>
    </div>

    <el-table :data="view.tableData" size="small" class="list-table" height="322">
      <el-table-column type="index" label="序号" width="42" align="center" show-overflow-tooltip />
      <el-table-column prop="name" label="数据表名称" min-width="140">
        <template #default="{ row }">
          <el-tooltip :content="row.name" effect="dark" placement="top" :show-after="100" popper-class="cell-full-tip">
            <span class="cell-ellipsis">{{ row.name }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="dept" label="发布部门名称" width="112">
        <template #default="{ row }">
          <el-tooltip :content="row.dept" effect="dark" placement="top" :show-after="100" popper-class="cell-full-tip">
            <span class="cell-ellipsis">{{ row.dept }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="cycle" label="填报周期" width="76" align="center" show-overflow-tooltip />
      <el-table-column prop="dataTotal" label="数据量" width="62" align="center" show-overflow-tooltip />
      <el-table-column prop="date" label="发布时间" width="100" align="center" show-overflow-tooltip />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { useDashboardApi } from '../composables/useDashboardApi'
import type { FillCountVO } from '../types/api'

/** 接口数据（getFillCount，isExtended=true）；未取到时降级为演示数据 */
const { simplifyFillCount } = useDashboardApi()

/** 演示数据：接口不可用 / 演示模式时保留原效果 */
const CYCLES = ['每月', '每季度', '每年', '每周']
const MOCK = {
  ledgerCount: '21',
  dataCount: '50',
  dataUnit: '万',
  issueCount: '15',
  deptDist: [
    { name: '自治区可社局', value: 80 },
    { name: '自治区林草局', value: 70 },
    { name: '自治区总工会', value: 60 },
    { name: '自治区妇联', value: 50 },
    { name: '自治区农牧厅', value: 30 },
    { name: '自治区市场监管局', value: 20 },
    { name: '自治区农牧厅', value: 20 },
    { name: '自治区大数据中心', value: 10 }
  ],
  freqDist: [
    { name: '每天', value: 10 },
    { name: '每周', value: 20 },
    { name: '每月', value: 200 },
    { name: '每季度', value: 50 },
    { name: '每年', value: 50 },
    { name: '动态更新', value: 6 }
  ],
  tableData: Array.from({ length: 12 }, (_, i) => ({
    name: '内蒙古自治区医疗保障参保面工作扩底数据表',
    dept: '内蒙古自治区医疗保障局',
    cycle: CYCLES[i % CYCLES.length],
    dataTotal: String(120 + i * 37),
    date: `2025-12-${String(10 + (i % 15)).padStart(2, '0')}`
  }))
}

/** { 名称: 数量 } → 图表数据（按数量降序） */
const toDist = (map: Record<string, number> | undefined) =>
  Object.entries(map ?? {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)

/** 累计数据量按原始条数返回，超过万级换算成「万」展示 */
const formatVolume = (value: number) =>
  value >= 10000
    ? { value: (value / 10000).toFixed(1), unit: '万' }
    : { value: String(value), unit: '条' }

const view = computed(() => {
  const raw = simplifyFillCount.value
  if (!raw) return MOCK

  const volume = formatVolume(Number(raw.ledgerDataCount ?? 0))
  return {
    ledgerCount: String(raw.ledgerCount ?? 0),
    dataCount: volume.value,
    dataUnit: volume.unit,
    issueCount: String(raw.ledgerIssueCount ?? 0),
    deptDist: toDist(raw.deptLedgerCount),
    freqDist: toDist(raw.cycleLedgerCount),
    tableData: (raw.ledgerListInfo ?? []).map((item) => ({
      name: item.ledgerName ?? '',
      dept: item.orgName ?? '',
      cycle: item.reportCycleName ?? '--',
      dataTotal: String(item.dataTotal ?? 0),
      date: item.lastOnlieTime ?? item.lastOnlineTime ?? '--'
    }))
  }
})

const dpr = window.devicePixelRatio || 1
const barRef = ref<HTMLElement | null>(null)
const donutRef = ref<HTMLElement | null>(null)
let barChart: echarts.ECharts | null = null
let donutChart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

const DONUT_COLORS = ['#40e0ff', '#5dd39e', '#f5a623', '#9b8cff', '#ff7a6b', '#4ea1ff']

/** 轴标签统一限制字数，超出用省略号；悬停仍显示完整名称 */
const clipLabel = (text: string, max = 8) => (text.length > max ? `${text.slice(0, max)}…` : text)

/** 单独抽出渲染函数：接口数据异步到达后重新 setOption */
const renderCharts = () => {
  const deptDist = view.value.deptDist
  const freqDist = view.value.freqDist

  if (barChart) {
    barChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = Array.isArray(params) ? params[0] : params
            if (!p) return ''
            return `${p.name}<br/>报表数：${p.value} 张`
          }
        },
        grid: { top: 4, right: 26, bottom: 4, left: 12, containLabel: true },
        dataZoom: [
          {
            type: 'inside',
            yAxisIndex: 0,
            startValue: 0,
            endValue: 4,
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
          data: deptDist.map((d) => d.name),
          axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
          axisTick: { show: false },
          axisLabel: {
            color: '#a9c8f5', fontSize: 11, width: 96, margin: 10,
            overflow: 'truncate', rotate: 20,
            formatter: (v: string) => clipLabel(v)
          }
        },
        series: [
          {
            type: 'bar',
            data: deptDist.map((d) => d.value),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#1a6cff' },
                { offset: 1, color: '#40e0ff' }
              ]),
              borderRadius: [0, 3, 3, 0]
            },
            barMaxWidth: 9,
            label: { show: true, position: 'right', color: '#40e0ff', fontSize: 10, formatter: '{c}' }
          }
        ]
      },
      true
    )
  }

  if (donutChart) {
    donutChart.setOption(
      {
        tooltip: { trigger: 'item', formatter: '{b}: {c}' },
        series: [
          {
            type: 'pie',
            center: ['50%', '50%'],
            radius: ['40%', '66%'],
            label: { color: '#7a93c4', fontSize: 10, formatter: '{b}\n{c}' },
            labelLine: { length: 5, length2: 5, lineStyle: { color: 'rgba(64,158,255,0.3)' } },
            itemStyle: { borderColor: 'rgba(8,16,38,0.95)', borderWidth: 2 },
            data: freqDist.map((d, i) => ({
              ...d,
              itemStyle: { color: DONUT_COLORS[i % DONUT_COLORS.length] }
            }))
          }
        ]
      },
      true
    )
  }
}

onMounted(() => {
  if (barRef.value) {
    barChart = echarts.init(barRef.value, undefined, { devicePixelRatio: dpr })
  }
  if (donutRef.value) {
    donutChart = echarts.init(donutRef.value, undefined, { devicePixelRatio: dpr })
  }
  renderCharts()
  ro = new ResizeObserver(() => {
    barChart?.resize()
    donutChart?.resize()
  })
  if (barRef.value) ro.observe(barRef.value)
  if (donutRef.value) ro.observe(donutRef.value)
})

watch(view, () => renderCharts())

onBeforeUnmount(() => {
  ro?.disconnect()
  barChart?.dispose()
  donutChart?.dispose()
  barChart = null
  donutChart = null
})
</script>

<style scoped>
.simplify-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kpi-row {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  font-size: 19px;
  font-weight: bold;
  color: #40e0ff;
  font-family: 'DIN', 'Consolas', monospace;
}

.kpi-value small { font-size: 12px; margin-left: 2px; }

.kpi-label { margin-top: 2px; font-size: 11px; color: #c8d6f5; }

.mid-row {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  gap: 8px;
}

.mid-left {
  flex: 1.2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mid-right {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sec-title {
  flex: 0 0 auto;
  text-align: center;
  font-size: 13px;
  color: #40e0ff;
  letter-spacing: 2px;
  margin: 2px 0;
}

.chart-bar { flex: 1 1 0; min-height: 0; }
.chart-donut { flex: 1 1 0; min-height: 0; }

.list-table { flex: 0 0 auto; }
</style>
