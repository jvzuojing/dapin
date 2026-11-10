<template>
  <div class="user-panel-root">
    <div
      v-loading="regionDataLoading"
      element-loading-text="用户情况加载中..."
      element-loading-background="rgba(3, 10, 28, 0.38)"
      class="left-top panel"
    >
      <div class="panel-title">
        <span class="panel-title-text">用户情况</span>
      </div>

      <!-- 三个数据卡片 -->
      <div class="stat-cards">
        <div class="stat-card">
          <div class="label">用户总数</div>
          <div class="value">{{ userOverview.totalUsers }}</div>
        </div>
        <div class="stat-card">
          <div class="label">部门用户数</div>
          <div class="value">{{ userOverview.departmentUsers }}</div>
        </div>
        <div class="stat-card">
          <div class="label">基层用户数</div>
          <div class="value">{{ userOverview.grassrootsUsers }}</div>
        </div>
      </div>

      <!-- 圆环图 -->
      <div class="ring-charts">
        <div class="ring-main-row">
          <div class="ring-main-col">
            <div class="ring-item level-item">
              <div ref="countyRingRef" class="chart-ring level-ring"></div>
              <div class="level-legend">
                <div v-for="seg in levelSegments" :key="seg.name" class="level-legend-item">
                  <span class="legend-swatch" :style="{ background: seg.itemStyle.color }"></span>
                  <span class="legend-name">{{ seg.name }}</span>
                  <span class="legend-val">{{ seg.value.toLocaleString() }}</span>
                </div>
              </div>
            </div>
            <div class="ring-label ring-label-main">覆盖业务部门数</div>
          </div>
          <div class="coverage-stack">
            <div class="coverage-col">
              <div class="coverage-ring-wrap">
                <div ref="townshipRingRef" class="chart-ring coverage-ring-sm"></div>
                <div class="coverage-rate-text township">{{ coverageDetails.township.rateText }}</div>
              </div>
              <div class="coverage-info">
                <div class="ring-label">乡镇街道（苏木）覆盖率</div>
                <div class="coverage-detail">{{ coverageDetails.township.summary }}</div>
              </div>
            </div>
            <div class="coverage-col">
              <div class="coverage-ring-wrap">
                <div ref="villageRingRef" class="chart-ring coverage-ring-sm"></div>
                <div class="coverage-rate-text village">{{ coverageDetails.village.rateText }}</div>
              </div>
              <div class="coverage-info">
                <div class="ring-label">村社区（嘎查）覆盖率</div>
                <div class="coverage-detail">{{ coverageDetails.village.summary }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-loading="regionDataLoading"
      element-loading-text="区域趋势加载中..."
      element-loading-background="rgba(3, 10, 28, 0.38)"
      class="left-bottom panel"
    >
      <div class="panel-title">
        <span class="panel-title-text">用户数 & 村社覆盖率（按区域）</span>
      </div>
      <div ref="trendChartRef" class="chart-trend"></div>
    </div>

    <div
      v-loading="regionDataLoading"
      element-loading-text="部门统计加载中..."
      element-loading-background="rgba(3, 10, 28, 0.38)"
      class="left-dept panel"
    >
      <div class="panel-title">
        <span class="panel-title-text">用户部门分布统计</span>
      </div>
      <div ref="tableHost" class="dept-table-wrap">
        <el-table :data="displayDeptList" size="small" :show-header="false" class="dept-table" height="100%">
          <el-table-column type="index" width="50" />
          <el-table-column prop="name" label="部门名称" />
          <el-table-column prop="count" label="账号总数" width="80" align="center">
            <template #default="{ row }">
              <span class="count-num">{{ row.count }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 按验收反馈移除「查看更多」弹窗：列表直接展示全量并自动滚动 -->
  </div>
</template>

<script setup lang="ts">
import { chartFont } from '../config/typography'
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useScaledData, useRegionData, type DeptRow } from '../composables/useRegionData'
import { useDashboardApi } from '../composables/useDashboardApi'
import { useTableAutoScroll } from '../composables/useTableAutoScroll'

const { userOverview, userTrendData, deptTopList, userLevelData, fetchDeptUserPage } = useScaledData()
const { selectedRegion, scaleVersion } = useRegionData()
const { regionDataLoading } = useDashboardApi()

const dpr = window.devicePixelRatio || 1

// refs
const countyRingRef = ref<HTMLElement | null>(null)
const townshipRingRef = ref<HTMLElement | null>(null)
const villageRingRef = ref<HTMLElement | null>(null)
const trendChartRef = ref<HTMLElement | null>(null)

let countyRingChart: echarts.ECharts | null = null
let townshipRingChart: echarts.ECharts | null = null
let villageRingChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null

const formatAxisCount = (value: number) => {
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  if (Math.abs(num) >= 10000) {
    const wan = num / 10000
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`
  }
  return num.toLocaleString()
}

const normalizePercent = (value: number) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(100, num))
}

const formatPercentText = (value: unknown, digits = 2) => {
  const num = normalizePercent(Number(value))
  return `${num.toFixed(digits)}%`
}

const truncateAxisLabel = (label: string, max = 5) => (
  label.length > max ? `${label.slice(0, max)}…` : label
)

const coverageDetails = computed(() => {
  const township = userOverview.value.townshipCoverage
  const village = userOverview.value.villageCoverage
  const townshipRate = township.total ? normalizePercent((township.covered / township.total) * 100) : 0
  const villageRate = village.total ? normalizePercent((village.covered / village.total) * 100) : 0

  return {
    township: {
      /* 紧凑格式（正式环境反馈）：面板文字列仅约 96px，
         「已覆盖 78 / 总数 79」长格式会被右边缘裁断 */
      summary: `已覆盖 ${township.covered.toLocaleString()}/${township.total.toLocaleString()}`,
      rate: `覆盖率 ${townshipRate.toFixed(2)}%`,
      rateText: `${townshipRate.toFixed(2)}%`
    },
    village: {
      summary: `已覆盖 ${village.covered.toLocaleString()}/${village.total.toLocaleString()}`,
      rate: `覆盖率 ${villageRate.toFixed(2)}%`,
      rateText: `${villageRate.toFixed(2)}%`
    }
  }
})

/**
 * 验收反馈：列表即详情，不再需要点击「查看更多」弹出。
 * 一次取回全部部门并自动滚动（原型批注：直接获取所有，然后滚动，鼠标放上去静止）。
 */
const allDeptList = ref<DeptRow[]>([])
const displayDeptList = computed(() =>
  allDeptList.value.length ? allDeptList.value : deptTopList.value
)

const loadAllDept = async () => {
  const res = await fetchDeptUserPage(1, 500)
  allDeptList.value = res?.list ?? []
}

/** 列表自动滚动：鼠标移入暂停、移出继续 */
const tableHost = ref<HTMLElement | null>(null)
useTableAutoScroll(tableHost, () => displayDeptList.value.length)

watch(selectedRegion, () => {
  void loadAllDept()
  nextTick(() => {
    updateAllCharts()
  })
}, { deep: true })

watch(scaleVersion, () => {
  resizeAll()
})

const initCountyRing = () => {
  if (!countyRingRef.value) return
  countyRingChart = echarts.init(countyRingRef.value, undefined, { devicePixelRatio: dpr })
  updateCountyRing()
}

// 层级分段（自治区级=3段，盟市级=2段，旗县区级=1段）
const levelSegments = computed(() => {
  const lvl = userLevelData.value
  const depth = selectedRegion.value.length
  if (depth <= 1) {
    return [
      { value: lvl.autonomous, name: '自治区级', itemStyle: { color: '#409eff' } },
      { value: lvl.city, name: '盟市级', itemStyle: { color: '#40e0ff' } },
      { value: lvl.county, name: '旗县区级', itemStyle: { color: '#5dd39e' } }
    ]
  } else if (depth === 2) {
    return [
      { value: lvl.city, name: '盟市级', itemStyle: { color: '#40e0ff' } },
      { value: lvl.county, name: '旗县区级', itemStyle: { color: '#5dd39e' } }
    ]
  }
  return [
    { value: lvl.county, name: '旗县区级', itemStyle: { color: '#5dd39e' } }
  ]
})

const updateCountyRing = () => {
  if (!countyRingChart) return
  const data = levelSegments.value
  const total = data.reduce((s, d) => s + d.value, 0)
  countyRingChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    series: [
      {
        name: '用户层级',
        type: 'pie',
        radius: ['54%', '82%'],
        center: ['50%', '50%'],
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(64,158,255,0.35)' },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          label: { show: true, fontSize: chartFont(11), fontWeight: 'bold', color: '#fff', formatter: '{b}\n{c}' }
        },
        data
      },
      {
        name: '总数',
        type: 'pie',
        radius: [0, 0],
        center: ['50%', '50%'],
        silent: true,
        label: {
          show: true,
          position: 'center',
          formatter: `{total|${total.toLocaleString()}}\n{label|总数}`,
          rich: {
            total: { fontSize: chartFont(15), fontWeight: 'bold', color: '#40e0ff', align: 'center' },
            label: { fontSize: chartFont(11), color: '#7a93c4', align: 'center', padding: [1, 0, 0, 0] }
          }
        },
        labelLine: { show: false },
        data: [{ value: 1, name: '', itemStyle: { color: 'transparent' } }]
      }
    ]
  }, true)
}

const initCoverageRings = () => {
  if (townshipRingRef.value) {
    townshipRingChart = echarts.init(townshipRingRef.value, undefined, { devicePixelRatio: dpr })
  }
  if (villageRingRef.value) {
    villageRingChart = echarts.init(villageRingRef.value, undefined, { devicePixelRatio: dpr })
  }
  updateCoverageRings()
}

const updateCoverageRings = () => {
  const township = userOverview.value.townshipCoverage
  const village = userOverview.value.villageCoverage
  const townshipRate = township.total ? (township.covered / township.total) * 100 : 0
  const villageRate = village.total ? (village.covered / village.total) * 100 : 0

  if (townshipRingChart) {
    townshipRingChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}：${formatPercentText(params.value, 2)}`
      },
      series: [
        {
          name: '乡镇街道',
          type: 'pie',
          radius: ['54%', '82%'],
          center: ['50%', '50%'],
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(64,158,255,0.35)' },
          label: { show: false },
          labelLine: { show: false },
          data: [
            { value: townshipRate, name: '已覆盖', itemStyle: { color: '#40e0ff' } },
            { value: 100 - townshipRate, name: '未覆盖', itemStyle: { color: 'rgba(64,224,255,0.15)' } }
          ]
        }
      ]
    }, true)
  }

  if (villageRingChart) {
    villageRingChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => `${params.name}：${formatPercentText(params.value, 2)}`
      },
      series: [
        {
          name: '村社区',
          type: 'pie',
          radius: ['54%', '82%'],
          center: ['50%', '50%'],
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(93,211,158,0.35)' },
          label: { show: false },
          labelLine: { show: false },
          data: [
            { value: villageRate, name: '已覆盖', itemStyle: { color: '#5dd39e' } },
            { value: 100 - villageRate, name: '未覆盖', itemStyle: { color: 'rgba(93,211,158,0.15)' } }
          ]
        }
      ]
    }, true)
  }
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  trendChart = echarts.init(trendChartRef.value, undefined, { devicePixelRatio: dpr })
  updateTrendChart()
}

const updateTrendChart = () => {
  if (!trendChart) return
  const coverageRates = userTrendData.value.coverageRates.map(normalizePercent)
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const rows = Array.isArray(params) ? params : [params]
        const title = rows[0]?.axisValueLabel ?? rows[0]?.name ?? ''
        const lines = rows.map((item: any) => {
          const isPercent = String(item.seriesName ?? '').includes('率')
          const valueText = isPercent ? formatPercentText(item.value, 2) : formatAxisCount(Number(item.value))
          return `${item.marker}${item.seriesName}　${valueText}`
        })
        return [title, ...lines].join('<br/>')
      }
    },
    legend: {
      data: ['用户数', '村社覆盖率'],
      textStyle: { color: '#7a93c4', fontSize: chartFont(15) },
      top: 0,
      left: 'center',
      itemGap: 22,
      itemWidth: 14,
      itemHeight: 10
    },
    grid: { top: 26, right: 6, bottom: 12, left: 6, containLabel: true },
    xAxis: {
      type: 'category',
      data: userTrendData.value.regions,
      axisLine: { lineStyle: { color: 'rgba(64,158,255,0.3)' } },
      axisLabel: {
        color: '#a9c8f5',
        fontSize: chartFont(11, true),
        interval: 0,
        rotate: 52,
        margin: 4,
        formatter: (value: string) => truncateAxisLabel(value, 3)
      }
    },
    yAxis: [
      {
        type: 'value',
        splitNumber: 5,
        axisLine: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: chartFont(14), formatter: (value: number) => formatAxisCount(value) },
        splitLine: { lineStyle: { color: 'rgba(64,158,255,0.1)' } }
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLine: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: chartFont(14), formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '用户数',
        type: 'bar',
        data: userTrendData.value.userCounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: 'rgba(64,158,255,0.2)' }
          ]),
          borderRadius: [2, 2, 0, 0]
        },
        barWidth: 20
      },
      {
        name: '村社覆盖率',
        type: 'line',
        yAxisIndex: 1,
        data: coverageRates,
        smooth: false,
        clip: true,
        symbol: 'circle',
        symbolSize: 7,
        itemStyle: { color: '#67c23a' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103,194,58,0.3)' },
            { offset: 1, color: 'rgba(103,194,58,0.05)' }
          ])
        }
      }
    ]
  }, true)
}

const updateAllCharts = () => {
  updateCountyRing()
  updateCoverageRings()
  updateTrendChart()
}

const resizeAll = () => {
  countyRingChart?.resize()
  townshipRingChart?.resize()
  villageRingChart?.resize()
  trendChart?.resize()
}

// 接口数据回填后刷新图表
watch(userOverview, () => nextTick(() => updateAllCharts()), { deep: true })
watch(userTrendData, () => nextTick(() => updateTrendChart()), { deep: true })
watch(userLevelData, () => nextTick(() => updateCountyRing()), { deep: true })

let resizeHandler: (() => void) | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  void loadAllDept()
  nextTick(() => {
    initCountyRing()
    initCoverageRings()
    initTrendChart()
  })
  resizeHandler = () => resizeAll()
  window.addEventListener('resize', resizeHandler)
  ro = new ResizeObserver(() => resizeAll())
  ;[countyRingRef.value, townshipRingRef.value, villageRingRef.value, trendChartRef.value].forEach(el => el && ro!.observe(el))
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler!)
  ro?.disconnect()
  countyRingChart?.dispose()
  townshipRingChart?.dispose()
  villageRingChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.user-panel-root {
  display: flex;
  flex-direction: column;
  /* 验收反馈：整体布局紧凑一点 */
  gap: 6px;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
}

/* 「用户情况」内容最高（卡片+双环），分到最多；趋势图保住底线；
   部门列表本身自动滚动，让出少量高度不影响使用 */
.left-top {
  flex: 0.56 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.left-bottom {
  flex: 0.47 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.left-bottom .chart-trend {
  flex: 1 1 0;
  min-height: 0;
}

.left-dept {
  flex: 0.97 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 紧凑标题：左侧三块面板共用，每块省 4px 给图表内容 */
.left-top .panel-title,
.left-bottom .panel-title,
.left-dept .panel-title {
  padding-bottom: 6px;
  margin-bottom: 8px;
}

.left-dept .dept-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dept-table { height: 100%; }

/* 数据卡片 */
.stat-cards {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
  flex-shrink: 0;
}

.stat-cards .stat-card {
  flex: 1;
  padding: 2px 5px;
}

.stat-cards .stat-card .value {
  font-size: calc(16px * var(--font-boost-md));
}

/* 圆环图 */
.ring-charts {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
}

.ring-main-row {
  display: flex;
  align-items: stretch;
  gap: 5px;
  flex: 1;
  min-height: 0;
}

.ring-main-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
}

.ring-item {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  min-height: 0;
}

.ring-item.level-item {
  flex: 0 0 auto;
  min-height: var(--left-level-ring-min-height, 108px);
}

.chart-ring {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  align-self: center;
}

.level-ring {
  width: 106px;
  height: 106px;
}

.level-item {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.level-legend {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 84px;
}

.level-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: calc(13px * var(--font-boost-sm));
  color: var(--c-text, #c8d6f5);
  white-space: nowrap;
}

.legend-val {
  color: var(--c-gold, #ffc75a);
  font-weight: bold;
  font-family: 'Consolas', monospace;
  text-shadow: 0 0 6px rgba(255, 199, 90, 0.28);
}

.legend-swatch {
  width: 12px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.ring-label {
  font-size: calc(12px * var(--font-boost-sm));
  color: var(--c-cyan, #40e0ff);
  text-align: center;
  flex-shrink: 0;
  line-height: 1.15;
  font-weight: 500;
}

.ring-label-main {
  margin-top: 2px;
}

/* 覆盖率双环并排 */
.coverage-stack {
  flex: 0 0 170px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2px;
  min-width: 0;
  margin-left: -4px;
}

.coverage-col {
  flex: 1 1 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  min-height: var(--left-coverage-col-min-height, 84px);
}

.coverage-ring-sm {
  width: 70px;
  height: 70px;
  flex: 0 0 70px;
  min-height: 0;
}

.coverage-col .ring-label,
.coverage-detail {
  text-align: left;
}

.coverage-col .ring-label {
  font-size: calc(11px * var(--font-boost-sm));
}

.coverage-info {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.coverage-detail {
  margin-top: 1px;
  font-size: calc(11px * var(--font-boost-sm));
  line-height: 1.15;
  color: var(--c-text-dim, #7a93c4);
  text-align: left;
  white-space: nowrap;
}

/* 环 + 环外覆盖率数字（竖排居中） */
.coverage-ring-wrap {
  flex: 0 0 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.coverage-rate-text {
  font-size: calc(12px * var(--font-boost-sm));
  line-height: 1.1;
  font-weight: bold;
  font-family: 'DIN', 'Consolas', monospace;
  text-align: center;
  white-space: nowrap;
  color: #40e0ff;
}

.coverage-rate-text.village {
  color: #5dd39e;
}

/* 趋势图 */
.chart-trend {
  width: 100%;
  height: 100%;
  min-height: var(--left-trend-min-height, 170px);
}

/* 部门表格 */
.dept-table {
  background: transparent !important;
}

.dept-table :deep(td) {
  color: var(--c-text, #c8d6f5) !important;
  font-size: calc(13px * var(--font-boost-sm)) !important;
  padding: 2px 0 !important;
}

.dept-table :deep(.el-table__row:hover > td) {
  background: rgba(64, 158, 255, 0.08) !important;
}

.count-num {
  color: var(--c-cyan, #40e0ff);
  font-weight: bold;
  font-family: 'DIN', 'Consolas', monospace;
  font-size: calc(15px * var(--font-boost-md));
}

/* 弹窗 */
.dark-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
</style>
