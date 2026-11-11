<template>
  <div
    class="screen-shell"
    :class="{ 'is-unscaled': !scaleEnabled && stretchToViewport }"
  >
    <div class="screen-stage" :style="stageStyle">
      <div class="screen-wrapper" :style="wrapperStyle">
        <StarField />
        <!-- 顶部标题栏 -->
        <header class="header-bar">
          <!-- 按验收反馈去掉左上角全局区划选择框。
               selectedRegion 仍保留并 provide 给子组件：地图点击下钻、面包屑、
               动态标题、数据重载都继续由它驱动，只是不再提供下拉入口。 -->
          <div class="header-left"></div>
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

        <!-- 超宽 8 列布局，列顺序（从左到右）：
             用户情况 | 系统使用情况 | 基层精简保留清单 | 国家报表 |
             各盟市嘎查村覆盖率(地图) | 数据表情况 | 基层治理情况 | 数据使用情况
             注：系统使用/数据使用由 RightPanel 以 display:contents 摊开，
                 它们在第 2 / 第 8 位，靠下方 style 里的 order 定位。 -->
        <main class="main-content">
          <div class="col col-user">
            <UserPanel />
          </div>

          <div class="col col-simplify">
            <SimplifyListPanel />
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

          <div class="col col-entity">
            <EntityZonePanel />
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

const { regionCascaderOptions, initRegionTree, loadRegionData, loadGlobalData, loadAll, refreshAll, defaultRegionCode } = useDashboardApi()

// 是否走真实接口（可在 config/api.ts 或 localStorage 中切换）
const useApi = apiConfig.useApi

// 区域选择：v-model 值为区划代码路径
const selectedRegion = ref<string[]>([])
/** 仍用于动态标题解析（按 selectedRegion 反查区划名称），下拉控件已移除 */
const cascaderOptions = computed(() =>
  useApi ? regionCascaderOptions.value : mockRegionOptions
)

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

// 设计画布按 6654×1152 超宽大屏出图（对应原型 14楼大屏）
const DESIGN_WIDTH = 6654
const DESIGN_HEIGHT = 1152
const screenScale = ref(1)
const stageLeft = ref(0)
const stageTop = ref(0)

/** 画面等比缩放开关。false = 按设计稿 6654×1152 原尺寸 1:1 渲染（验收排查样式用）；
 *  临时关闭，需要恢复时把常量改回 true，或在地址后加 ?scale=1 / ?scale=0 运行时切换 */
const ENABLE_SCREEN_SCALE = false

const isScreenScaleEnabled = () => {
  const q = new URLSearchParams(window.location.search).get('scale')
  if (q === '1') return true
  if (q === '0') return false
  return ENABLE_SCREEN_SCALE
}

const scaleEnabled = ref(ENABLE_SCREEN_SCALE)
/** 画布是否按可视区高度拉伸：只有视口两个方向都不小于设计稿时才拉伸，
 *  否则按比例缩小后高度由 design * scale 决定 */
const stretchToViewport = ref(true)

const stageStyle = computed(() => ({
  width: `${DESIGN_WIDTH * screenScale.value}px`,
  // 拉伸态用百分比高度跟随可视区（不会因滚动条占位溢出）；
  // 缩小态高度即渲染后的设计稿高度，垂直方向居中留白
  height: stretchToViewport.value
    ? '100%'
    : `${DESIGN_HEIGHT * screenScale.value}px`,
  left: `${stageLeft.value}px`,
  top: `${stageTop.value}px`
}))

const wrapperStyle = computed(() => ({
  width: `${DESIGN_WIDTH}px`,
  height: stretchToViewport.value ? '100%' : `${DESIGN_HEIGHT}px`,
  transform: `scale(${screenScale.value})`,
  transformOrigin: 'top left'
}))

// -------- 数据加载 --------

/** 当前生效的区划代码，用于判断是否真的发生了切换 */
let activeCode = ''
let activePath: string[] = []
/** 首屏初始化期间屏蔽 watch，避免与 bootstrap 的 loadAll 并发发请求 */
let bootstrapping = true
const pageLoading = ref(false)

const lastCode = (value: string[]) => value[value.length - 1] ?? ''

/** 区划切换 → 重新加载与区划相关的数据；无权限则回退 */
watch(selectedRegion, async (value) => {
  if (!useApi || bootstrapping) return
  const code = lastCode(value)
  if (!code || code === activeCode) return
  pageLoading.value = true
  try {
    const ok = await loadRegionData(code)
    await loadGlobalData(code)
    // 点地图 / 选下拉后必须停留在用户选中的区划：
    // 旧逻辑在接口返回 302 时把 selectedRegion 弹回上一级，地图刚下钻就被拉回全区，
    // 左上角也跟着跳回去，表现为「点哪里都没反应」。
    activeCode = code
    activePath = [...value]
    if (!ok) ElMessage.warning('当前区划暂无数据权限，部分数据可能为空')
  } finally {
    pageLoading.value = false
  }
})

/**
 * 首次进入，顺序固定：
 * 1) 先调 getRegionTree（不传 regionCode），返回体里的 regionCode 就是已选择区划；
 * 2) 用这个 code 设置下拉选中项与 activeCode；
 * 3) 最后才发其余所有数据接口，且每个都带这个 code。
 */
async function bootstrap() {
  if (!useApi) {
    selectedRegion.value = ['neimenggu', 'huhehaote', 'xincheng']
    activeCode = lastCode(selectedRegion.value)
    activePath = [...selectedRegion.value]
    bootstrapping = false
    return
  }
  pageLoading.value = true
  try {
    const path = await initRegionTree()
    // 以接口返回的已选择区划为准，不再用区划树根节点自己推导
    const code = defaultRegionCode.value || path[path.length - 1] || ''
    if (!code) {
      ElMessage.warning('未获取到区划数据')
      return
    }
    activeCode = code
    activePath = path.length ? [...path.slice(0, -1), code] : [code]
    selectedRegion.value = activePath
    await loadAll(code)
  } catch {
    // initRegionTree 内部已统一弹错
  } finally {
    bootstrapping = false
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
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight
  scaleEnabled.value = isScreenScaleEnabled()

  // 视口两个方向都够大写 → 保持 1:1（高度方向拉伸填充，像素级不缩放）；
  // 任一方不足 → 整屏统一缩到刚好放下，绝不出现滚动条、也不裁内容。
  const fitsNatively = viewportWidth >= DESIGN_WIDTH && viewportHeight >= DESIGN_HEIGHT
  stretchToViewport.value = !scaleEnabled.value && fitsNatively
  const nextScale = scaleEnabled.value
    ? Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT)
    : fitsNatively
      ? 1
      : Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT)

  screenScale.value = nextScale
  // body 级浮层（下拉 / tooltip / 弹窗 / 全局消息）不参与画布缩放，
  // 把当前缩放比例写进 CSS 变量，让 global.css 里的浮层规则按同一比例归一。
  document.documentElement.style.setProperty('--screen-scale', String(nextScale))
  // 居中：剩余空间一分为二（缩小态两侧/上下留白，拉伸态横向居中）
  stageLeft.value = Math.max(0, (viewportWidth - DESIGN_WIDTH * nextScale) / 2)
  stageTop.value = stretchToViewport.value
    ? 0
    : Math.max(0, (viewportHeight - DESIGN_HEIGHT * nextScale) / 2)
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
  /* 设计规范：深蓝底 + 顶部/右下蓝色弧光；网格压到几乎不可见，原底图整体压暗 */
  background:
    radial-gradient(ellipse 62% 46% at 50% -12%, rgba(73, 166, 255, 0.18), transparent 70%),
    radial-gradient(ellipse 48% 58% at 102% 104%, rgba(30, 104, 182, 0.16), transparent 72%),
    linear-gradient(180deg, rgba(7, 15, 30, 0.74), rgba(7, 15, 30, 0.5)),
    linear-gradient(rgba(189, 212, 255, 0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(189, 212, 255, 0.022) 1px, transparent 1px),
    url('./assets/bg.png');
  background-size:
    100% 100%,
    100% 100%,
    100% 100%,
    44px 44px,
    44px 44px,
    cover;
  background-position: 0 0, 0 0, 0 0, 0 0, 0 0, center;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat, repeat, no-repeat;
}

.screen-stage {
  position: absolute;
}

/* 1:1 不缩放模式下，画布可能大于视口：允许滚动平移查看（缩放模式仍严格撑满不滚动） */
.screen-shell.is-unscaled {
  overflow: auto;
}

.screen-wrapper {
  --dashboard-gap: 18px;
  --dashboard-pad-y: 14px;
  --dashboard-pad-x: 24px;
  --header-height: 72px;
  /* 8 列宽度（设计稿 6654px 基准）。
     地图列精确居中：左 3 列 2424 + 3 间隙 54 + 地图 1650/2 + 左内边距 24 = 3327 = 画布中轴。
     列宽合计 6480 + 7 间隙 126 = 6606 = 内容区宽，无弹性余量，地图不会被挤偏。 */
  --w-user: 560px;
  --w-entity: 1304px;
  --w-report: 560px;
  --w-fillrate: 1650px;
  --w-auto: 560px;
  --w-simplify: 590px;
  --w-sys: 560px;
  --w-data: 696px;
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
  background: linear-gradient(180deg, rgba(73, 166, 255, 0.06) 0%, transparent 100%);
  border-bottom: 1px solid rgba(189, 212, 255, 0.16);
  margin-bottom: var(--dashboard-gap);
  flex-shrink: 0;
}

/* 标题栏底边中轴高光：与居中地图呼应 */
.header-bar::after {
  content: '';
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: -1px;
  width: 420px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(73, 166, 255, 0.55), transparent);
  pointer-events: none;
}

.header-center {
  flex: 1;
  text-align: center;
}

.main-title {
  /* 规范一级标题：42px，#A4C4FF → #FFFFFF → #D6DDE7 渐变，无暖色 */
  font-family: var(--font-title);
  font-size: calc(42px * var(--font-boost-lg));
  font-weight: normal;
  letter-spacing: 5px;
  background: linear-gradient(180deg, #a4c4ff 0%, #ffffff 55%, #d6dde7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 12px rgba(164, 196, 255, 0.32));
  line-height: 1.15;
}

.header-sub {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: calc(13px * var(--font-boost-sm));
  color: var(--c-text-dim);
}

/* 日期两侧的装饰渐变线，呼应大屏中轴 */
.header-sub::before,
.header-sub::after {
  content: '';
  display: inline-block;
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(189, 212, 255, 0.45));
}

.header-sub::after {
  background: linear-gradient(90deg, rgba(189, 212, 255, 0.45), transparent);
}

.header-sub span {
  margin: 0 6px;
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
  font-size: calc(14px * var(--font-boost-md));
  color: var(--c-aux-blue);
  letter-spacing: 1px;
  cursor: pointer;
  background: rgba(20, 36, 66, 0.55);
  border: 1px solid var(--c-border-bright);
  border-radius: 2px;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  color: #fff;
  background: rgba(73, 166, 255, 0.18);
  border-color: rgba(189, 212, 255, 0.7);
  box-shadow: 0 0 12px rgba(73, 166, 255, 0.25);
}

.refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.region-cascader {
  width: 300px;
}

.region-cascader :deep(.el-input__wrapper) {
  background: rgba(20, 36, 66, 0.85) !important;
  box-shadow: 0 0 0 1px var(--c-border-bright) inset !important;
}

.region-cascader :deep(.el-input__inner) {
  color: #fff !important;
  font-size: calc(13px * var(--font-boost-sm)) !important;
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

/* 列顺序（order）与宽度分开控制：宽度跟着面板走，顺序按业务给定的 8 列排 */
.col-user      { flex: 0 0 var(--w-user);     order: 1; }
.col-entity    { flex: 0 0 var(--w-entity);   order: 7; }
.col-report    { flex: 0 0 var(--w-report);   order: 4; }
/* 地图列：固定宽度，保证地图比例稳定 */
.col-fillrate  { flex: 0 0 var(--w-fillrate); order: 5; }
.col-auto      { flex: 0 0 var(--w-auto);     order: 6; }
.col-simplify  { flex: 0 0 var(--w-simplify); order: 3; }
</style>

<style>
/* RightPanel 以 display:contents 摊开：内部两块直接成为 main-content 的列 */
.col-right-split {
  display: contents !important;
}

.col-right-split .right-top {
  flex: 0 0 var(--w-sys) !important;
  order: 2;
  height: 100%;
  min-height: 0 !important;
}

.col-right-split .right-bottom {
  flex: 0 0 var(--w-data) !important;
  order: 8;
  height: 100%;
  min-height: 0 !important;
}

/* ===== 紧凑档：可视区高度低于设计稿 1152 时启用 =====
 * 不缩放模式已把画布高度交给视口，若原样保留设计稿的垂直留白，
 * 用户情况（覆盖率块）与右下面板会被裁 5~10px。这里按比例收紧
 * 标题栏、上下内边距、列间距和两个内容最小高度，保证内容完整且无滚动条。 */
.screen-shell.is-compact .screen-wrapper {
  --header-height: 64px;
  --dashboard-pad-y: 10px;
  --dashboard-gap: 14px;
  --left-level-ring-min-height: 100px;
  --left-coverage-col-min-height: 76px;
}

.screen-shell.is-compact .right-bottom {
  gap: 6px !important;
  padding-bottom: 4px !important;
}

/* 兜底：屏幕更矮（<1040）时内容实在放不下，让这两块自身滚动，
   而不是把文字裁掉。内容放得下时不会出现滚动条。 */
.screen-shell.is-compact .left-top,
.screen-shell.is-compact .right-bottom {
  overflow-y: auto !important;
}
</style>
