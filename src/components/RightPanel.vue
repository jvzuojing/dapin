<template>
  <div class="right-panel-root">
    <!-- 系统使用情况 -->
    <div
      v-loading="rightTopLoading"
      element-loading-text="系统使用情况加载中..."
      element-loading-background="rgba(3, 10, 28, 0.38)"
      class="right-top panel"
    >
      <div class="panel-title">
        <span class="panel-title-text">系统使用情况</span>
        <button v-if="sysTab === 'dept'" class="panel-action-btn" @click="showDeptDialog = true">查看全部</button>
      </div>

      <div class="sys-summary">
        <div class="sys-stat">
          <div class="sys-label">总访问量</div>
          <div class="sys-value">{{ systemUsageAll.total }}</div>
        </div>
        <div class="sys-stat">
          <div class="sys-label">日活跃次数</div>
          <div class="sys-value">{{ systemUsageAll.dailyActive }}</div>
        </div>
      </div>

      <div class="sys-toolbar">
        <div class="dashboard-tabs">
          <span
            class="dashboard-tab"
            :class="{ active: sysTab === 'all' }"
            @click="switchSysTab('all')"
          >全部</span>
          <span
            class="dashboard-tab"
            :class="{ active: sysTab === 'city' }"
            @click="switchSysTab('city')"
          >按地市</span>
          <span
            class="dashboard-tab"
            :class="{ active: sysTab === 'dept' }"
            @click="switchSysTab('dept')"
          >按部门</span>
        </div>
        <el-select v-model="queryPeriod" class="period-select" size="small" placeholder="查询周期">
          <el-option label="查询周期" value="" disabled />
          <el-option label="近一周" value="week" />
          <el-option label="近一个月" value="month" />
          <el-option label="近一季度" value="quarter" />
          <el-option label="近一年" value="year" />
        </el-select>
      </div>

      <div ref="sysChartRef" class="chart-sys"></div>
    </div>

    <!-- 数据使用情况 -->
    <div class="right-bottom panel">
      <div class="panel-title">
        <span class="panel-title-text">数据使用情况</span>
      </div>

      <!-- 场景详情弹窗入口暂时屏蔽，恢复时加回：class="usage-block clickable-scene" title="点击查看场景详情" @click="showSceneDialog = true" -->
      <div class="usage-block">
        <div class="usage-header">
          <span class="usage-label">基层特色场景：</span>
          <span class="usage-num">23个</span>
        </div>
      </div>

      <div class="usage-block">
        <div class="usage-header">
          <span class="usage-subtitle">"一表通根数据库"情况</span>
        </div>
        <div class="db-nodes">
          <div class="db-node">
            <div class="db-node-value">{{ rootDatabase.departments }}个</div>
            <div class="db-node-label">部门</div>
          </div>
          <div class="db-node">
            <div class="db-node-value">{{ rootDatabase.categories }}个</div>
            <div class="db-node-label">类别</div>
          </div>
          <div class="db-node">
            <div class="db-node-value">{{ rootDatabase.dataVolume }}</div>
            <div class="db-node-label">数据</div>
          </div>
        </div>
      </div>

      <div class="usage-block">
        <div class="usage-header">
          <span class="usage-subtitle">回流情况</span>
        </div>
        <div class="backflow-list">
          <div v-for="(item, idx) in backflowData" :key="idx" class="backflow-item">
            <div class="bf-label">{{ item.label }}</div>
            <div class="bf-value">{{ item.value }}</div>
          </div>
        </div>
      </div>

      <div class="usage-block usage-block-last">
        <div class="usage-header">
          <span class="usage-subtitle">政法委系统对接情况</span>
        </div>
        <div class="zf-cards">
          <div class="zf-card">
            <div class="zf-node">
              <div class="zf-value">{{ politicalLegalData.tags.value }}</div>
              <div class="zf-title">标签</div>
            </div>
          </div>
          <div class="zf-card">
            <div class="zf-node">
              <div class="zf-value">{{ politicalLegalData.population.value }}</div>
              <div class="zf-title">人口基础</div>
            </div>
          </div>
          <div class="zf-card">
            <div class="zf-node">
              <div class="zf-value">{{ politicalLegalData.house.value }}</div>
              <div class="zf-title">房屋</div>
            </div>
          </div>
          <div class="zf-card">
            <div class="zf-node">
              <div class="zf-value">{{ politicalLegalData.relation.value }}</div>
              <div class="zf-title">人房关联</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showDeptDialog"
      width="820px"
      :close-on-click-modal="false"
      align-center
      class="dark-dialog dept-access-dialog"
    >
      <template #header>
        <div class="dept-dialog-header">
          <div>
            <div class="dept-dialog-title">部门访问列表</div>
            <div class="dept-dialog-subtitle">当前查询周期内各部门访问次数排名</div>
          </div>
          <div class="dept-dialog-header-tag">按访问量排序</div>
        </div>
      </template>

      <div class="dept-dialog-overview">
        <div class="dept-overview-card">
          <div class="dept-overview-label">部门数</div>
          <div class="dept-overview-value">{{ deptAccessList.length }}</div>
        </div>
        <div class="dept-overview-card">
          <div class="dept-overview-label">总访问量</div>
          <div class="dept-overview-value">{{ totalDeptVisits }}</div>
        </div>
        <div class="dept-overview-card dept-overview-card-wide">
          <div class="dept-overview-label">最高访问部门</div>
          <div class="dept-overview-value dept-overview-text">{{ topDeptAccess.department }}</div>
          <div class="dept-overview-extra">访问次数 {{ topDeptAccess.visits }}</div>
        </div>
      </div>

      <div class="dept-dialog-table-wrap">
        <el-table :data="deptAccessList" size="small" class="dept-dialog-table" height="460">
          <el-table-column label="排名" width="80" align="center">
            <template #default="{ $index }">
              <span class="dept-rank" :class="`dept-rank-${Math.min($index + 1, 4)}`">{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="department" label="部门名称" show-overflow-tooltip />
          <el-table-column prop="visits" label="访问次数" width="140" align="center">
            <template #default="{ row }">
              <span class="cell-cyan">{{ row.visits }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 基础特色场景弹窗 -->
    <el-dialog
      v-model="showSceneDialog"
      width="960px"
      :close-on-click-modal="false"
      class="dark-dialog scene-dialog"
    >
      <div class="scene-dialog-header">
        <span>累计数据总量：<b>{{ sceneData.totalData }}</b></span>
        <span>数据时间：<b>{{ sceneData.dataTime }}</b></span>
      </div>
      <div class="scene-dialog-body">
        <div class="scene-section">
          <div class="scene-section-title">基础场景</div>
          <div class="scene-grid base">
            <div v-for="s in sceneData.baseScenes" :key="s.name" class="scene-card base-card">
              <div class="sc-name">{{ s.name }}</div>
              <div class="sc-value">数据量：{{ s.value }}</div>
            </div>
          </div>
        </div>
        <div class="scene-section">
          <div class="scene-section-title">扩展表应用场景</div>
          <div class="scene-grid extend">
            <div v-for="(s, i) in sceneData.extendScenes" :key="i" class="scene-card extend-card">
              <div class="sc-name">{{ s.name }}</div>
              <div class="sc-value">数据量：{{ s.value }}</div>
            </div>
          </div>
        </div>
        <div class="scene-section">
          <div class="scene-section-title">其他场景</div>
          <div class="scene-grid other">
            <div v-for="s in sceneData.otherScenes" :key="s" class="scene-card other-card">{{ s }}</div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useScaledData, useRegionData } from '../composables/useRegionData'
import { useDashboardApi } from '../composables/useDashboardApi'

const { systemUsageAll, systemUsageCity, systemUsageDept, rootDatabase, backflowData, politicalLegalData, sceneData } = useScaledData()
const { selectedRegion, scaleVersion } = useRegionData()
const { setAccessTimeType, loadAccessList, accessDeptList, globalDataLoading, accessTimeLoading, reportStats } = useDashboardApi()

const showSceneDialog = ref(false)
const showDeptDialog = ref(false)

const dpr = window.devicePixelRatio || 1

// Sys tab
const sysTab = ref<'all' | 'city' | 'dept'>('all')
const queryPeriod = ref('week')

/** 切 tab：市级/部门 tab 点击时才拉取对应的使用情况数据（避免初始化时重复请求） */
const switchSysTab = (tab: 'all' | 'city' | 'dept') => {
  if (sysTab.value === tab) return
  sysTab.value = tab
  if (tab === 'city') loadAccessList('region')
  else if (tab === 'dept') loadAccessList('dept')
}

// 部门访问列表弹窗：数据未加载过时按需拉取
watch(showDeptDialog, (visible) => {
  if (visible && !accessDeptList.value) loadAccessList('dept')
})

const visibleDeptChart = computed(() => {
  const maxItems = 10
  return {
    departments: systemUsageDept.value.departments.slice(0, maxItems),
    visits: systemUsageDept.value.visits.slice(0, maxItems)
  }
})

const rightTopLoading = computed(() => globalDataLoading.value || accessTimeLoading.value)

const shortenAxisLabel = (label: string, max = 6) => (
  label.length > max ? `${label.slice(0, max)}...` : label
)

// Sys chart
const sysChartRef = ref<HTMLElement | null>(null)
let sysChart: echarts.ECharts | null = null

const initSysChart = () => {
  if (!sysChartRef.value) return
  sysChart = echarts.init(sysChartRef.value, undefined, { devicePixelRatio: dpr })
  updateSysChart()
}

const updateSysChart = () => {
  if (!sysChart) return

  if (sysTab.value === 'all') {
    // 折线图 - 趋势
    sysChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top: 24, right: 18, bottom: 24, left: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: systemUsageAll.value.dates,
        axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
        axisLabel: { color: '#7a93c4', fontSize: 12, margin: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: 12, margin: 8 },
        splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
      },
      series: [
        {
          name: '访问量',
          type: 'line',
          data: systemUsageAll.value.visits,
          smooth: true,
          itemStyle: { color: '#40e0ff' },
          lineStyle: { width: 2 },
          symbol: 'circle',
          symbolSize: 7,
          label: { show: false },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64,224,255,0.4)' },
              { offset: 1, color: 'rgba(64,224,255,0.02)' }
            ])
          }
        }
      ]
    }, true)
  } else if (sysTab.value === 'city') {
    // 按地市柱状图
    sysChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top: 22, right: 18, bottom: 34, left: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: systemUsageCity.value.cities,
        axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
        axisLabel: {
          color: '#7a93c4',
          fontSize: 11,
          interval: 0,
          rotate: 28,
          margin: 6,
          formatter: (value: string) => shortenAxisLabel(value, 4)
        }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: 12, margin: 8 },
        splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
      },
      series: [
        {
          name: '访问量',
          type: 'bar',
          data: systemUsageCity.value.visits,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#409eff' },
              { offset: 1, color: 'rgba(64,158,255,0.1)' }
            ]),
            borderRadius: [2, 2, 0, 0]
          },
          barWidth: 14,
          label: { show: false }
        }
      ]
    }, true)
  } else {
    // 按部门柱状图
    sysChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top: 22, right: 18, bottom: 38, left: 48, containLabel: true },
      xAxis: {
        type: 'category',
        data: visibleDeptChart.value.departments,
        axisLine: { lineStyle: { color: 'rgba(64,158,255,0.2)' } },
        axisLabel: {
          color: '#7a93c4',
          fontSize: 11,
          interval: 0,
          rotate: 28,
          margin: 6,
          formatter: (value: string) => shortenAxisLabel(value, 4)
        }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#7a93c4', fontSize: 12, margin: 8 },
        splitLine: { lineStyle: { color: 'rgba(64,158,255,0.08)' } }
      },
      series: [
        {
          name: '访问量',
          type: 'bar',
          data: visibleDeptChart.value.visits,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#409eff' },
              { offset: 1, color: 'rgba(64,158,255,0.1)' }
            ]),
            borderRadius: [2, 2, 0, 0]
          },
          barWidth: 12,
          label: { show: false }
        }
      ]
    }, true)
  }
}

watch(sysTab, () => nextTick(() => updateSysChart()))

// 查询周期联动接口：切换后重新拉取地区/部门访问数据
watch(queryPeriod, (period) => {
  if (period) setAccessTimeType(period)
})

watch(selectedRegion, () => {
  nextTick(() => updateAllCharts())
}, { deep: true })

watch(scaleVersion, () => {
  resizeAll()
})

const deptAccessList = computed(() => systemUsageDept.value.departments.map((department, index) => ({
  department,
  visits: systemUsageDept.value.visits[index] ?? 0
})))

// 部门累计访问量：取 getReportStats 的 totalAccessDeptNum；接口未返回时回退为各部门求和
const totalDeptVisits = computed(() => {
  const fromStats = reportStats.value?.totalAccessDeptNum
  if (fromStats !== null && fromStats !== undefined) {
    return Number(fromStats).toLocaleString()
  }
  return deptAccessList.value.reduce((sum, item) => sum + Number(item.visits || 0), 0).toLocaleString()
})

const topDeptAccess = computed(() => {
  if (!deptAccessList.value.length) {
    return { department: '--', visits: '--' }
  }
  const top = deptAccessList.value.reduce((best, item) => (
    Number(item.visits || 0) > Number(best.visits || 0) ? item : best
  ), deptAccessList.value[0])

  return {
    department: top.department,
    visits: Number(top.visits || 0).toLocaleString()
  }
})

const updateAllCharts = () => {
  updateSysChart()
}

const resizeAll = () => {
  sysChart?.resize()
}

// 接口数据回填后刷新图表
watch(systemUsageAll, () => nextTick(() => updateSysChart()), { deep: true })
watch(systemUsageCity, () => nextTick(() => updateSysChart()), { deep: true })
watch(systemUsageDept, () => nextTick(() => updateSysChart()), { deep: true })

let resizeHandler: (() => void) | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    initSysChart()
  })
  resizeHandler = () => resizeAll()
  window.addEventListener('resize', resizeHandler)
  ro = new ResizeObserver(() => resizeAll())
  ;[sysChartRef.value].forEach(el => el && ro!.observe(el))
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler!)
  ro?.disconnect()
  sysChart?.dispose()
})
</script>

<style scoped>
.right-panel-root {
  display: flex;
  flex-direction: column;
  gap: var(--dashboard-gap, 10px);
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
}

.right-top {
  flex: 0.92 1 0;
  min-height: var(--right-top-min-height, 252px);
  display: flex;
  flex-direction: column;
}

.right-bottom {
  flex: 1.08 1 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: var(--right-bottom-min-height, 286px);
  overflow: hidden;
}

/* 系统使用概览 */
.sys-summary {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.sys-stat {
  flex: 1;
  background: var(--c-card-bg, rgba(30, 50, 100, 0.35));
  border: 1px solid var(--c-border, rgba(64, 158, 255, 0.25));
  border-radius: 3px;
  padding: 8px 8px;
  text-align: center;
}

.sys-label {
  font-size: 11px;
  color: var(--c-text-dim, #7a93c4);
}

.sys-value {
  font-size: 17px;
  font-weight: bold;
  color: var(--c-cyan, #40e0ff);
  font-family: 'DIN', 'Consolas', monospace;
  line-height: 1.3;
}

.sys-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.panel-action-btn {
  border: none;
  background: transparent;
  color: #40e0ff;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.panel-action-btn:hover {
  color: #7cecff;
}

.period-select {
  width: 96px;
  flex: 0 0 auto;
}

.period-select :deep(.el-input__wrapper) {
  background: rgba(30, 50, 100, 0.7) !important;
  box-shadow: 0 0 0 1px var(--c-border, rgba(64, 158, 255, 0.25)) inset !important;
}

.period-select :deep(.el-input__inner) {
  color: #fff !important;
  font-size: 12px !important;
}

.chart-sys {
  width: 100%;
  flex: 1;
  min-height: var(--sys-chart-min-height, 142px);
}

/* 数据使用 */
.usage-block {
  padding: 2px 0;
  border-bottom: 1px solid rgba(64, 158, 255, 0.12);
  flex-shrink: 0;
}

.usage-block:last-child {
  border-bottom: none;
}

.usage-block-last {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 0;
}

.usage-header {
  margin-bottom: 3px;
  flex-shrink: 0;
}

.usage-label {
  font-size: 12px;
  color: var(--c-text-dim, #7a93c4);
}

.clickable-scene {
  cursor: pointer;
  transition: background 0.2s;
}

.clickable-scene:hover {
  background: rgba(64, 224, 255, 0.08);
}

/* 场景弹窗 */
.scene-dialog :deep(.el-dialog__header) {
  display: none;
}

.scene-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

.scene-dialog-header {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 12px;
}

.scene-dialog-header b {
  color: #40e0ff;
}

.scene-dialog-body {
  border: 1px solid rgba(64, 224, 255, 0.35);
  padding: 14px 16px;
  height: 60vh;
  overflow-y: auto;
}

.scene-section {
  margin-bottom: 14px;
}

.scene-section:last-child {
  margin-bottom: 0;
}

.scene-section-title {
  display: inline-block;
  border: 1px solid #40e0ff;
  color: #40e0ff;
  font-size: 13px;
  font-weight: bold;
  padding: 3px 12px;
  margin-bottom: 10px;
}

.scene-grid {
  display: grid;
  gap: 10px;
}

.scene-grid.base {
  grid-template-columns: repeat(4, 1fr);
}

.scene-grid.extend {
  grid-template-columns: repeat(6, 1fr);
}

.scene-grid.other {
  grid-template-columns: repeat(5, 1fr);
}

.scene-card {
  background: linear-gradient(180deg, #4a6fd8, #dfe6f5);
  border-radius: 2px;
  padding: 8px 10px;
  color: #fff;
}

.sc-name {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 4px;
}

.sc-value {
  font-size: 12px;
  color: #fff;
}

.scene-card.other-card {
  background: linear-gradient(180deg, #17b3a6, #0d8a80);
  text-align: center;
  font-size: 13px;
  font-weight: bold;
  padding: 10px 6px;
  line-height: 1.4;
}

.usage-num {
  font-size: 14px;
  font-weight: bold;
  color: var(--c-gold, #ffd75e);
  text-shadow: 0 0 6px rgba(255, 215, 94, 0.4);
  font-family: 'DIN', 'Consolas', monospace;
}

.usage-subtitle {
  font-size: 13px;
  color: #fff;
  font-weight: bold;
  border-left: 3px solid var(--c-primary, #409eff);
  padding-left: 8px;
}

/* 根数据库数据节点 */
.db-nodes {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.db-node {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(var(--usage-node-min-height, 60px) - 10px);
  border-radius: 6px;
  border: 1px solid rgba(64, 158, 255, 0.28);
  background: linear-gradient(180deg, rgba(64, 224, 255, 0.14), rgba(10, 20, 50, 0.22));
  box-shadow: inset 0 0 14px rgba(64, 224, 255, 0.08);
  text-align: center;
  padding: 4px 4px;
}

.db-node-value {
  font-size: 18px;
  font-weight: bold;
  font-family: 'DIN', 'Consolas', monospace;
  line-height: 1.2;
  color: #40e0ff;
  text-shadow: 0 0 8px rgba(64, 224, 255, 0.45);
  white-space: nowrap;
}

.db-node-label {
  font-size: 12px;
  color: var(--c-text-dim, #7a93c4);
  margin-top: 2px;
}

/* 回流情况 */
.backflow-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.backflow-item {
  background: var(--c-card-bg, rgba(30, 50, 100, 0.35));
  border: 1px solid var(--c-border, rgba(64, 158, 255, 0.25));
  border-radius: 3px;
  padding: 2px 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bf-label {
  font-size: 13px;
  color: var(--c-text-dim, #7a93c4);
}

.bf-value {
  font-size: 15px;
  font-weight: bold;
  color: var(--c-gold, #ffd75e);
  text-shadow: 0 0 6px rgba(255, 215, 94, 0.4);
  font-family: 'DIN', 'Consolas', monospace;
}

/* 政法委 */
.zf-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin-top: 2px;
  min-height: 0;
  min-width: 0;
}

.zf-card {
  min-width: 0;
  text-align: center;
}

.zf-node {
  min-height: 62px;
  border-radius: 8px;
  border: 1px solid rgba(64, 158, 255, 0.28);
  background: linear-gradient(180deg, rgba(64, 224, 255, 0.14), rgba(10, 20, 50, 0.22));
  box-shadow: inset 0 0 14px rgba(64, 224, 255, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px 4px;
}

.zf-title {
  font-size: 13px;
  color: var(--c-text-dim, #7a93c4);
  white-space: nowrap;
}

.zf-value {
  font-size: 20px;
  font-weight: bold;
  color: #40e0ff;
  font-family: 'DIN', 'Consolas', monospace;
  margin-bottom: 4px;
  white-space: nowrap;
  text-shadow: 0 0 8px rgba(64, 224, 255, 0.45);
}

.cell-cyan {
  color: #40e0ff;
  font-weight: bold;
}

.dept-dialog-table {
  width: 100%;
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgba(30, 50, 100, 0.5);
  --el-table-row-hover-bg-color: rgba(64, 158, 255, 0.12);
  --el-table-text-color: #cfe3ff;
  --el-table-header-text-color: #40e0ff;
  --el-table-border-color: rgba(64, 158, 255, 0.2);
}

.dept-access-dialog :deep(.el-dialog) {
  background: linear-gradient(180deg, rgba(8, 20, 52, 0.96), rgba(6, 16, 44, 0.96));
  border: 1px solid rgba(64, 158, 255, 0.35);
  box-shadow: 0 0 18px rgba(64, 224, 255, 0.18), inset 0 0 26px rgba(64, 158, 255, 0.08);
}

.dept-access-dialog :deep(.el-dialog__header) {
  margin-right: 0;
  padding: 18px 20px 10px;
  border-bottom: 1px solid rgba(64, 158, 255, 0.18);
}

.dept-access-dialog :deep(.el-dialog__body) {
  padding: 14px 20px 20px;
}

.dept-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.dept-dialog-title {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  letter-spacing: 1px;
}

.dept-dialog-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #7a93c4;
}

.dept-dialog-header-tag {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(64, 224, 255, 0.35);
  color: #40e0ff;
  font-size: 12px;
  white-space: nowrap;
  background: rgba(64, 224, 255, 0.08);
}

.dept-dialog-overview {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 10px;
  margin-bottom: 14px;
}

.dept-overview-card {
  min-width: 0;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(64, 158, 255, 0.22);
  background: linear-gradient(180deg, rgba(20, 44, 92, 0.5), rgba(10, 24, 58, 0.45));
}

.dept-overview-label {
  font-size: 12px;
  color: #7a93c4;
}

.dept-overview-value {
  margin-top: 6px;
  color: #40e0ff;
  font-size: 24px;
  font-weight: bold;
  font-family: 'DIN', 'Consolas', monospace;
  line-height: 1.1;
}

.dept-overview-card-wide .dept-overview-value {
  font-size: 16px;
  line-height: 1.3;
}

.dept-overview-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dept-overview-extra {
  margin-top: 6px;
  color: #ffd75e;
  font-size: 12px;
}

.dept-dialog-table-wrap {
  border: 1px solid rgba(64, 158, 255, 0.18);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(8, 22, 56, 0.42);
}

.dept-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  color: #cfe3ff;
  background: rgba(64, 158, 255, 0.14);
  border: 1px solid rgba(64, 158, 255, 0.22);
}

.dept-rank-1 {
  color: #0f1a36;
  background: linear-gradient(180deg, #fff3c4, #ffd75e);
  border-color: rgba(255, 215, 94, 0.5);
}

.dept-rank-2 {
  color: #0f1a36;
  background: linear-gradient(180deg, #e7f0ff, #98b4e8);
  border-color: rgba(152, 180, 232, 0.45);
}

.dept-rank-3 {
  color: #0f1a36;
  background: linear-gradient(180deg, #f5d0af, #c9854e);
  border-color: rgba(201, 133, 78, 0.45);
}
</style>
