<template>
  <div class="report-panel panel">
    <div class="panel-title">
      <span class="panel-title-text">国家报表</span>
      <div class="dashboard-tabs">
        <span class="dashboard-tab active">国家报表</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">报表总数</div>
        <div class="kpi-value">{{ currentReport.reportTotal }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">任务总数</div>
        <div class="kpi-value">{{ currentReport.taskTotal }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">数据总量</div>
        <div class="kpi-value">{{ currentReport.quantityTotal }}</div>
      </div>
      <div
        v-for="card in statusCards"
        :key="card.key"
        class="kpi-card"
      >
        <div class="kpi-label">{{ card.label }}</div>
        <div class="kpi-value" :class="card.accent">{{ card.value }}</div>
      </div>
    </div>

    <div class="dist-title">分布情况</div>
    <div ref="distributionRef" class="chart-dist"></div>

    <div class="dashboard-tabs detail-tabs">
      <span
        v-for="tab in detailTabs"
        :key="tab.key"
        class="dashboard-tab"
        :class="{ active: detailTab === tab.key }"
        @click="switchTab(tab.key)"
      >{{ tab.label }}</span>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      size="small"
      class="detail-table"
      height="240"
    >
      <el-table-column prop="name" label="报表名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="dept" label="派发部委" width="110" show-overflow-tooltip />
      <el-table-column prop="freq" label="频次" width="60" align="center" />
      <el-table-column prop="time" label="下发时间" width="90" align="center" />
      <el-table-column prop="status" label="状态" width="74" align="center">
        <template #default="{ row }">
          <span class="status-tag" :class="statusClass(row.status)">{{ row.status }}</span>
        </template>
      </el-table-column>
    </el-table>
    <div class="table-foot">
      <span class="page-total">共 {{ pageTotal }} 条</span>
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pageTotal"
        layout="prev, pager, next"
        small
        background
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useScaledData } from '../composables/useRegionData'
import { useRegionData } from '../composables/useRegionData'

const { reportData, fetchDetailList } = useScaledData()
const { scaleVersion } = useRegionData()

const currentReport = computed(() => reportData.value.national)

const statusCards = computed(() => {
  const cards = (currentReport.value as any).statusCards
  return Array.isArray(cards) ? cards : []
})

/* ---------------- 明细表格（报表情况 / 任务情况） ---------------- */
const detailTabs = [
  { key: 'report', label: '报表情况' },
  { key: 'task', label: '任务情况' }
] as const
const detailTab = ref<'report' | 'task'>('report')

const currentPage = ref(1)
const pageSize = ref(10)
const list = ref<any[]>([])
const pageTotal = ref(0)
const loading = ref(false)

const loadDetail = async () => {
  loading.value = true
  try {
    const res = await fetchDetailList({
      tab: 'national',
      type: detailTab.value,
      pageNum: currentPage.value,
      pageSize: pageSize.value
    })
    list.value = res.list
    pageTotal.value = res.total
  } finally {
    loading.value = false
  }
}

const switchTab = (key: 'report' | 'task') => {
  if (detailTab.value === key) return
  detailTab.value = key
  if (currentPage.value !== 1) currentPage.value = 1
  else loadDetail()
}

watch(currentPage, () => loadDetail())
watch(pageSize, () => {
  if (currentPage.value !== 1) currentPage.value = 1
  else loadDetail()
})

const statusClass = (status: string) => {
  if (status === '已建表') return 'status-green'
  if (status === '待签收') return 'status-orange'
  if (status === '待审核' || status === '待填报') return 'status-blue'
  if (status === '已签收') return 'status-teal'
  return 'status-blue'
}

/* ---------------- 分布情况图 ---------------- */
const dpr = window.devicePixelRatio || 1
const distributionRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

const formatAxisCount = (value: number) => {
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return num.toLocaleString()
}

const updateChart = () => {
  if (!chart) return
  const distribution = currentReport.value.distribution
  if (!distribution.series.length) {
    chart.clear()
    return
  }
  const multiSeries = distribution.series.length > 1
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      show: multiSeries,
      data: distribution.series.map((item) => item.name),
      textStyle: { color: '#7a93c4', fontSize: 12 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 9
    },
    dataZoom: [{
      type: 'inside',
      yAxisIndex: 0,
      startValue: 0,
      endValue: 5,
      zoomOnMouseWheel: false,
      moveOnMouseWheel: true,
      moveOnMouseMove: true,
      filterMode: 'filter'
    }],
    grid: { top: multiSeries ? 22 : 8, right: 24, bottom: 12, left: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
      axisLabel: { color: '#7a93c4', fontSize: 11, formatter: (v: number) => formatAxisCount(v) },
      minInterval: 1,
      splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: distribution.categories,
      axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#7a93c4',
        fontSize: 11,
        width: 76,
        overflow: 'truncate'
      },
      splitLine: { show: false }
    },
    series: distribution.series.map((series) => ({
      name: series.name,
      type: 'bar',
      data: series.data,
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: series.color[0] },
          { offset: 1, color: series.color[1] }
        ]),
        borderRadius: [0, 4, 4, 0]
      },
      barMaxWidth: multiSeries ? 10 : 14,
      barGap: '40%',
      label: { show: !multiSeries, position: 'right', color: series.color[1], fontSize: 11, distance: 4 }
    }))
  }, true)
}

onMounted(() => {
  if (detailTab.value) loadDetail()
  nextTick(() => {
    if (distributionRef.value) {
      chart = echarts.init(distributionRef.value, undefined, { devicePixelRatio: dpr })
      updateChart()
      ro = new ResizeObserver(() => chart?.resize())
      ro.observe(distributionRef.value)
    }
  })
})

onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})

watch(reportData, () => updateChart(), { deep: true })
watch(scaleVersion, () => chart?.resize())
</script>

<style scoped>
.report-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.kpi-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin: 8px 0;
}

.kpi-card {
  background: var(--c-card-bg, rgba(30, 50, 100, 0.35));
  border: 1px solid var(--c-border, rgba(64, 158, 255, 0.25));
  border-radius: 4px;
  padding: 8px 6px;
  text-align: center;
}

.kpi-label {
  font-size: 12px;
  color: var(--c-text, #c8d6f5);
}

.kpi-value {
  margin-top: 2px;
  font-size: 18px;
  font-weight: bold;
  color: var(--c-cyan, #40e0ff);
  font-family: 'DIN', 'Consolas', monospace;
}

.kpi-value.warning { color: #f5a623; }
.kpi-value.success { color: #5dd39e; }

.dist-title {
  flex: 0 0 auto;
  text-align: center;
  font-size: 13px;
  color: #40e0ff;
  letter-spacing: 2px;
  margin-bottom: 2px;
}

.chart-dist {
  flex: 1 1 0;
  min-height: 0;
}

.detail-tabs {
  flex: 0 0 auto;
  justify-content: center;
  margin: 6px 0 4px;
}

.detail-table {
  flex: 0 0 auto;
}

.table-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 0;
}

.page-total {
  font-size: 12px;
  color: #7a93c4;
}
</style>
