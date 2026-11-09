<template>
  <div class="screen-shell">
    <div class="screen-stage" :style="stageStyle">
      <div class="screen-wrapper" :style="wrapperStyle">
        <StarField />
        <!-- 顶部标题栏 -->
        <header class="header-bar">
          <div class="header-left">
            <el-cascader
              ref="regionCascaderRef"
              v-model="selectedRegion"
              :options="cascaderOptions"
              :props="regionProps"
              placeholder="请选择区域"
              size="large"
              class="region-cascader"
              @change="handleRegionSelect"
            />
          </div>
          <div class="header-center">
            <h1 class="main-title">{{ pageTitle }}</h1>
            <div class="header-sub">
              <span>{{ currentDate }}</span>
              <span>{{ currentWeekday }}</span>
            </div>
          </div>
          <div class="header-right">
            <button class="refresh-btn" :disabled="refreshing" @click="handleRefresh">
              {{ refreshing ? '刷新中…' : '刷新数据' }}
            </button>
          </div>
        </header>

        <!-- 超宽 8 列布局（对应原型 14楼大屏）：
             用户情况 | 基层治理 | 国家报表 | 数据填报率(地图) | 自治区报表 | 基层精简保留清单 | 系统使用 | 数据使用 -->
        <main class="main-content">
          <div class="col col-user">
            <UserPanel />
          </div>

          <div class="col col-entity">
            <EntityZonePanel />
          </div>

          <div class="col col-report">
            <ReportOverviewPanel />
          </div>

          <div class="col col-fillrate">
            <FillRateZonePanel />
          </div>

          <div class="col col-auto">
            <AutonomousReportPanel />
          </div>

          <div class="col col-simplify">
            <SimplifyListPanel />
          </div>

          <!-- RightPanel 内部两块以 display:contents 摊开成两列 -->
          <RightPanel class="col-right-split" />
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, provide, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { regionOptions as mockRegionOptions } from './mock/data'
import StarField from './components/StarField.vue'
import UserPanel from './components/UserPanel.vue'
import EntityZonePanel from './components/EntityZonePanel.vue'
import ReportOverviewPanel from './components/ReportOverviewPanel.vue'
import FillRateZonePanel from './components/FillRateZonePanel.vue'
import AutonomousReportPanel from './components/AutonomousReportPanel.vue'
import SimplifyListPanel from './components/SimplifyListPanel.vue'
import RightPanel from './components/RightPanel.vue'
import { useDashboardApi } from './composables/useDashboardApi'
import { apiConfig } from './config/api'

const { regionCascaderOptions, getRegionPath, initRegionTree, loadRegionData, loadGlobalData, loadAll, refreshAll } = useDashboardApi()

// 是否走真实接口（可在 config/api.ts 或 localStorage 中切换）
const useApi = apiConfig.useApi

// 区域选择：v-model 值为区划代码路径
const selectedRegion = ref<string[]>([])
const regionCascaderRef = ref<{ togglePopperVisible?: (visible?: boolean) => void; blur?: () => void } | null>(null)
const cascaderOptions = computed(() =>
  useApi ? regionCascaderOptions.value : mockRegionOptions
)
const regionProps = {
  expandTrigger: 'click' as const,
  emitPath: true,
  checkStrictly: true
}

// provide region 给子组件
provide('selectedRegion', selectedRegion)

// resize 通知（子组件监听后触发 chart.resize）
const scaleVersion = ref(0)
provide('scaleVersion', scaleVersion)

// 动态标题
const pageTitle = computed(() => {
  const labels: string[] = []
  const walk = (options: any[], values: string[], depth: number) => {
    const v = values[depth]
    const found = options.find((o: any) => o.value === v)
    if (found) {
      labels.push(found.label)
      if (found.children && depth + 1 < values.length) {
        walk(found.children, values, depth + 1)
      }
    }
  }
  if (selectedRegion.value.length > 0) {
    walk(cascaderOptions.value as any[], selectedRegion.value, 0)
  }
  const visibleLabels = labels.length > 1 ? labels.slice(1) : labels
  const lastTwo = visibleLabels.slice(-2)
  const regionTitle = lastTwo.join(' ')
  return regionTitle ? `${regionTitle}基层"一表通"数据驾驶舱` : '内蒙古自治区基层"一表通"数据驾驶舱'
})

// 日期
const now = new Date()
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const currentDate = computed(() => {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})
const currentWeekday = computed(() => weekdays[now.getDay()])

const handleRegionSelect = () => {
  regionCascaderRef.value?.togglePopperVisible?.(false)
  regionCascaderRef.value?.blur?.()
}

// 设计画布按 6654×1152 超宽大屏出图（对应原型 14楼大屏）
const DESIGN_WIDTH = 6654
const DESIGN_HEIGHT = 1152
const screenScale = ref(1)
const stageLeft = ref(0)
const stageTop = ref(0)

const stageStyle = computed(() => ({
  width: `${DESIGN_WIDTH * screenScale.value}px`,
  height: `${DESIGN_HEIGHT * screenScale.value}px`,
  left: `${stageLeft.value}px`,
  top: `${stageTop.value}px`
}))

const wrapperStyle = computed(() => ({
  width: `${DESIGN_WIDTH}px`,
  height: `${DESIGN_HEIGHT}px`,
  transform: `scale(${screenScale.value})`,
  transformOrigin: 'top left'
}))

// -------- 数据加载 --------

/** 当前生效的区划代码，用于判断是否真的发生了切换 */
let activeCode = ''
let activePath: string[] = []
const pageLoading = ref(false)

const lastCode = (value: string[]) => value[value.length - 1] ?? ''

/** 区划切换 → 重新加载与区划相关的数据；无权限则回退 */
watch(selectedRegion, async (value) => {
  if (!useApi) return
  const code = lastCode(value)
  if (!code || code === activeCode) return
  const prev = activeCode
  const prevPath = [...activePath]
  pageLoading.value = true
  try {
    const ok = await loadRegionData(code)
    if (ok) {
      await loadGlobalData()
      activeCode = code
      activePath = [...value]
      return
    }
    ElMessage.error('当前区划无数据权限，已回退到上一级')
    activeCode = prev
    activePath = prevPath
    selectedRegion.value = prevPath.length ? prevPath : (prev ? getRegionPath(prev) : [])
    if (prev) {
      await loadRegionData(prev)
      await loadGlobalData()
    }
  } finally {
    pageLoading.value = false
  }
})

/** 首次进入：拉取区划树并加载数据 */
async function bootstrap() {
  if (!useApi) {
    selectedRegion.value = ['neimenggu', 'huhehaote', 'xincheng']
    activeCode = lastCode(selectedRegion.value)
    activePath = [...selectedRegion.value]
    return
  }
  pageLoading.value = true
  try {
    const path = await initRegionTree()
    if (!path.length) {
      ElMessage.warning('未获取到区划数据')
      return
    }
    activeCode = path[path.length - 1]
    activePath = [...path]
    selectedRegion.value = path
    await loadAll(activeCode)
  } catch {
    // initRegionTree 内部已统一弹错
  } finally {
    pageLoading.value = false
  }
}

// 手动刷新
const refreshing = ref(false)
const handleRefresh = async () => {
  if (refreshing.value) return
  if (!useApi) {
    scaleVersion.value++
    return
  }
  refreshing.value = true
  pageLoading.value = true
  try {
    await refreshAll()
  } catch {
    // 请求层已统一弹错
  } finally {
    refreshing.value = false
    pageLoading.value = false
  }
}

// resize 通知子组件
let resizeTimer: ReturnType<typeof setTimeout> | null = null
const notifyResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    scaleVersion.value++
  }, 100)
}

const updateScreenScale = () => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const nextScale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT)

  screenScale.value = nextScale
  stageLeft.value = Math.max(0, (viewportWidth - DESIGN_WIDTH * nextScale) / 2)
  stageTop.value = Math.max(0, (viewportHeight - DESIGN_HEIGHT * nextScale) / 2)
  notifyResize()
}

let resizeHandler: (() => void) | null = null

onMounted(async () => {
  updateScreenScale()
  resizeHandler = () => updateScreenScale()
  window.addEventListener('resize', resizeHandler)
  await bootstrap()
  scaleVersion.value++
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler!)
  if (resizeTimer) clearTimeout(resizeTimer)
})
</script>

<style scoped>
.screen-shell {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background:
    linear-gradient(rgba(64, 158, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(64, 158, 255, 0.045) 1px, transparent 1px),
    url('./assets/bg.png');
  background-size:
    44px 44px,
    44px 44px,
    cover;
  background-position: 0 0, 0 0, center;
  background-repeat: repeat, repeat, no-repeat;
}

.screen-stage {
  position: absolute;
}

.screen-wrapper {
  --dashboard-gap: 18px;
  --dashboard-pad-y: 14px;
  --dashboard-pad-x: 24px;
  --header-height: 72px;
  /* 8 列宽度（设计稿 6654px 基准） */
  --w-user: 600px;
  --w-entity: 1400px;
  --w-report: 600px;
  --w-fillrate: 1500px;
  --w-auto: 480px;
  --w-simplify: 570px;
  --w-sys: 570px;
  --w-data: 560px;
  position: relative;
  top: 0;
  left: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--dashboard-pad-y) var(--dashboard-pad-x);
}

/* 顶部标题栏 */
.header-bar {
  position: relative;
  z-index: 1;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(180deg, rgba(64, 158, 255, 0.08) 0%, transparent 100%);
  border-bottom: 1px solid rgba(64, 158, 255, 0.15);
  margin-bottom: var(--dashboard-gap);
  flex-shrink: 0;
}

.header-center {
  flex: 1;
  text-align: center;
}

.main-title {
  font-size: 32px;
  font-weight: bold;
  letter-spacing: 4px;
  background: linear-gradient(180deg, #ffffff 0%, #ffe9a8 45%, #ffd75e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 10px rgba(255, 215, 94, 0.35));
  line-height: 1.25;
}

.header-sub {
  margin-top: 2px;
  font-size: 13px;
  color: var(--c-text-dim, #7a93c4);
}

.header-sub span {
  margin: 0 10px;
}

.header-left {
  width: 340px;
  flex-shrink: 0;
}

.header-right {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.refresh-btn {
  padding: 8px 20px;
  font-size: 14px;
  color: #cfe4ff;
  letter-spacing: 1px;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(64, 158, 255, 0.28) 0%, rgba(30, 60, 120, 0.5) 100%);
  border: 1px solid rgba(64, 158, 255, 0.5);
  border-radius: 4px;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  color: #fff;
  background: linear-gradient(180deg, rgba(64, 158, 255, 0.5) 0%, rgba(30, 60, 120, 0.7) 100%);
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.45);
}

.refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.region-cascader {
  width: 300px;
}

.region-cascader :deep(.el-input__wrapper) {
  background: rgba(30, 50, 100, 0.7) !important;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.5) inset !important;
}

.region-cascader :deep(.el-input__inner) {
  color: #fff !important;
  font-size: 13px !important;
}

.region-cascader :deep(.el-input__prefix-inner) {
  color: rgba(64, 158, 255, 0.8) !important;
}

/* 8 列主布局 */
.main-content {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: var(--dashboard-gap);
  flex-wrap: nowrap;
}

.col {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.col-user      { flex: 0 0 var(--w-user); }
.col-entity    { flex: 1 1 var(--w-entity); }
.col-report    { flex: 0 0 var(--w-report); }
.col-fillrate  { flex: 1 1 var(--w-fillrate); }
.col-auto      { flex: 0 0 var(--w-auto); }
.col-simplify  { flex: 0 0 var(--w-simplify); }
</style>

<style>
/* RightPanel 以 display:contents 摊开：内部两块直接成为 main-content 的列 */
.col-right-split {
  display: contents !important;
}

.col-right-split .right-top {
  flex: 0 0 570px !important;
  height: 100%;
  min-height: 0 !important;
}

.col-right-split .right-bottom {
  flex: 0 0 560px !important;
  height: 100%;
  min-height: 0 !important;
}
</style>
