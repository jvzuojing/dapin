<template>
  <div class="fill-rate-map">
    <div ref="chartRef" class="map-canvas"></div>
    <!-- 全区视图·数据质量四率图例（仅盟市级以上展示，下钻视图隐藏） -->
    <div v-if="showQualityLegend" class="quality-legend">
      <div class="ql-title">指标说明（%）</div>
      <div v-for="m in QUALITY_METRICS" :key="m.key" class="ql-row">
        <span class="ql-chip" :style="{ background: m.color }"></span>
        <span class="ql-name">{{ m.label }}</span>
      </div>
    </div>
    <!-- WebGL 不可用时降级为 2D 地图，避免出现「浏览器不支持 WebGL」的空白块 -->
    <div v-if="fallback2D" class="gl-fallback-tip">当前浏览器未启用 WebGL，已切换 2D 地图</div>
  </div>
</template>

<script setup lang="ts">
import { chartFont } from '../config/typography'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import 'echarts-gl'
import nmgGeo from '../assets/geo/nmg.json'
// 旗县区边界约 640KB，用 ?url 作为静态资源按需加载，避免打进 JS bundle / 拖慢类型检查
import countiesUrl from '../assets/geo/nmg_counties.json?url'

/** 地图视图层级：全区 / 盟市（显示旗县区） / 旗县区（聚焦） */
export type MapLevel = 'region' | 'city' | 'county'

export interface FillRateItem {
  /** 行政区全称，如「呼和浩特市」「新城区」；与 geojson 不一致时可用 regionCode 兜底 */
  name: string
  /** 百分比数值，0~100 */
  value: number
  /** 6 位行政区划代码（国标），可选；匹配优先级：regionCode > name */
  regionCode?: string
  /** 匹配到的 geojson 6 位区划代码（组件内部回填，点击时带出） */
  adcode?: string
  /** 被点击区域的层级：city=盟市，county=旗县区 */
  level?: 'city' | 'county'
  /** 触发点击时地图所处的视图层级 */
  viewLevel?: MapLevel
  /** 旗县区所属盟市 6 位代码 */
  parentCode?: string
}

/** 全区视图·盟市数据质量行（嘎查村社区覆盖 + 三率） */
export interface RegionQualityItem {
  name: string
  villageTotal: number
  villageActive: number
  accountRate: number
  popHouseRate: number
  entRate: number
  linkRate: number
}

const props = withDefaults(
  defineProps<{
    data: FillRateItem[]
    /** 大屏整体缩放版本号，变化时重新 resize */
    scaleVersion?: number
    /** 当前选中的盟市 6 位区划代码（国标），用于下钻到旗县区 */
    selectedCode?: string
    /** 当前选中的旗县区 6 位区划代码；有值时地图聚焦该旗县区 */
    selectedCountyCode?: string
    /** 旗县区级指标数据（可选）；为空时只渲染轮廓与名称，不填指标色 */
    countyData?: FillRateItem[]
    /** 全区视图·盟市数据质量（四率）；仅在全区视图展示，下钻视图忽略 */
    qualityData?: RegionQualityItem[]
  }>(),
  {
    data: () => [],
    scaleVersion: 0,
    selectedCode: '',
    selectedCountyCode: '',
    countyData: () => [],
    qualityData: () => []
  }
)

const emit = defineEmits<{ (e: 'select', item: FillRateItem): void }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

/** 是否改走 2D 降级渲染（WebGL 不可用 / 上下文反复丢失时置 true） */
const fallback2D = ref(false)
/** 当前是否按 3D（WebGL）渲染 */
let webglOK = false
/** 上下文丢失次数：第一次尝试恢复 3D，第二次起永久降级 2D */
let ctxLostCount = 0

/** 探测浏览器能否创建 WebGL 上下文（显卡驱动异常 / 关闭硬件加速 / 远程桌面都会失败） */
const detectWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return false
    // 释放探测用的临时上下文，避免占用浏览器 WebGL 上下文配额
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** 支持 ?map2d=1 强制 2D（现场排查用，也能验证降级效果） */
const force2D = () =>
  new URLSearchParams(window.location.search).get('map2d') === '1'

/* ---------------- 盟市级索引（nmg.json：12 个 feature） ---------------- */
const regionNames: string[] = []
const adcodeToName: Record<string, string> = {}
const nameToAdcode: Record<string, string> = {}
;(nmgGeo as any).features.forEach((f: any) => {
  const p = f.properties ?? {}
  if (p.name) {
    regionNames.push(p.name)
    if (p.adcode != null) {
      adcodeToName[String(p.adcode)] = p.name
      nameToAdcode[p.name] = String(p.adcode)
    }
  }
})

/* ---------------- 旗县区级索引（按需加载，模块级共享） ---------------- */
let countiesGeo: any = null
let countiesPromise: Promise<any> | null = null
const countyNames: string[] = []
const countyCodeToName: Record<string, string> = {}
const countyNameToCode: Record<string, string> = {}
const countyByCode: Record<string, any> = {}
const countiesByCity: Record<string, any[]> = {}

const loadCounties = () => {
  if (countiesGeo) return Promise.resolve(countiesGeo)
  if (!countiesPromise) {
    countiesPromise = fetch(countiesUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`geojson ${res.status}`)
        return res.json()
      })
      .then((geo: any) => {
        const features: any[] = geo?.features ?? []
        features.forEach((f) => {
          const p = f.properties ?? {}
          const code = String(p.adcode ?? '')
          const parent = String(p.parent?.adcode ?? '')
          if (!code || !p.name) return
          countyByCode[code] = f
          countyNames.push(p.name)
          countyCodeToName[code] = p.name
          countyNameToCode[p.name] = code
          if (!countiesByCity[parent]) countiesByCity[parent] = []
          countiesByCity[parent].push(f)
        })
        countiesGeo = geo
        return geo
      })
      .catch(() => {
        // 加载失败时允许下次重试，地图自动降级为盟市单轮廓
        countiesPromise = null
        return null
      })
  }
  return countiesPromise
}

/* ---------------- 地图注册 ---------------- */
let mapRegistered = false
const registeredMaps = new Set<string>()

const ensureMap = () => {
  if (mapRegistered) return
  echarts.registerMap('nmg', nmgGeo as any)
  mapRegistered = true
}

const registerFeatureMap = (name: string, features: any[]) => {
  if (registeredMaps.has(name)) return name
  echarts.registerMap(name, { geoJSON: { type: 'FeatureCollection', features } } as any)
  registeredMaps.add(name)
  return name
}

/** 取单个盟市的 geojson feature */
const cityFeature = (code: string) =>
  (nmgGeo as any).features.find((f: any) => String(f.properties?.adcode ?? '') === code)

/** 一组 feature 的外包络盒（经纬度），用于按形状调整 3D 视距 */
const bboxOfFeatures = (features: any[]) => {
  let minLon = 180
  let maxLon = -180
  let minLat = 90
  let maxLat = -90
  for (const feature of features) {
    const coordinates = feature?.geometry?.coordinates ?? []
    const polys = feature?.geometry?.type === 'MultiPolygon' ? coordinates : [coordinates]
    for (const poly of polys) {
      for (const ring of poly) {
        for (const pt of ring) {
          const lon = pt[0]
          const lat = pt[1]
          if (lon < minLon) minLon = lon
          if (lon > maxLon) maxLon = lon
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
    }
  }
  return minLon <= maxLon ? { minLon, maxLon, minLat, maxLat } : null
}

/** 当前视图层级：由区划路径决定，不依赖边界文件是否已加载完 */
const viewLevel = computed<MapLevel>(() => {
  if (/^\d{6}$/.test(props.selectedCountyCode)) return 'county'
  if (props.selectedCode && cityFeature(props.selectedCode)) return 'city'
  return 'region'
})

/** 决定本次渲染用哪张地图；边界数据缺失时逐级降级，保证始终有画面 */
const resolveMap = (): { name: string; features: any[]; level: MapLevel } => {
  const level = viewLevel.value
  if (level === 'region') return { name: 'nmg', features: [], level }

  const cityCode = props.selectedCode
  const cityCounties = countiesGeo ? countiesByCity[cityCode] ?? [] : []

  if (level === 'county') {
    const feature = countyByCode[props.selectedCountyCode]
    if (feature) {
      return {
        name: registerFeatureMap(`county-${props.selectedCountyCode}`, [feature]),
        features: [feature],
        level
      }
    }
  }

  if (cityCounties.length) {
    return {
      name: registerFeatureMap(`counties-${cityCode}`, cityCounties),
      features: cityCounties,
      level: 'city'
    }
  }

  // 兼容旧行为：边界文件未就绪时，只放大该盟市轮廓
  const city = cityFeature(cityCode)
  if (city) {
    return { name: registerFeatureMap(`city-${cityCode}`, [city]), features: [city], level: 'city' }
  }
  return { name: 'nmg', features: [], level: 'region' }
}

/* ---------------- 数据匹配 ---------------- */
const normCode = (value?: string) => String(value ?? '').slice(0, 6).padStart(6, '0')

const matchItems = (
  list: FillRateItem[],
  names: string[],
  codeToName: Record<string, string>,
  nameToCode: Record<string, string>
): FillRateItem[] =>
  list
    .filter((d) => Number.isFinite(Number(d.value)))
    .map((d): FillRateItem | null => {
      let name = names.find((n) => n === d.name)
      if (!name && d.regionCode) name = codeToName[normCode(d.regionCode)]
      return name ? { ...d, name, adcode: nameToCode[name] } : null
    })
    .filter((d): d is FillRateItem => !!d)

const validData = computed(() => matchItems(props.data, regionNames, adcodeToName, nameToAdcode))
const validCountyData = computed(() =>
  matchItems(props.countyData, countyNames, countyCodeToName, countyNameToCode)
)

const hex2rgb = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]

const lerpColor = (a: string, b: string, t: number) => {
  const A = hex2rgb(a)
  const B = hex2rgb(b)
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`
}

/** 多段线性插值，避免两段渐变在低值区发闷、高值区过曝 */
const stopsColor = (stops: string[], t: number) => {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return lerpColor(stops[i], stops[i + 1], x - i)
}

/** 全图唯一色阶（低 → 高）：藏蓝 → 湖蓝 → 青 → 亮青。
 *  全区与下钻共用这一套，切层级时配色风格不再跳变 */
const RATE_STOPS = ['#13375f', '#155f96', '#1689bd', '#1bb5d8', '#57e6ff']
const colorOf = (t: number) => stopsColor(RATE_STOPS, t)

/** 四率模式下地图面的统一底色：恢复参考稿的中蓝色（加四率条之前的老地图色）。
 *  悬停高亮仍走 emphasis 的亮青色，不变 */
const QUALITY_REGION_COLOR = '#2b7ecf'

/** 无指标数据时所有面统一用色阶中段的基准色：不再散列着色，也不伪装数值高低；
 *  相邻块靠细边框、3D 侧面明暗和悬停高亮区分 */
const BASE_COLOR = colorOf(0.5)

const shortName = (name: string) => name.replace(/(市|盟)$/, '')

/* ================= 全区视图·盟市数据质量（四率） =================
 * 展示形式：盟市上方一组 4 根彩色竖条（高度=指标值），异常值（<99.5%）
 * 才显示数字标签；悬停盟市弹出该市完整 6 列数据。下钻视图不展示。 */

interface QualityMetricDef {
  key: 'accountRate' | 'popHouseRate' | 'entRate' | 'linkRate'
  label: string
  color: string
}

const QUALITY_METRICS: QualityMetricDef[] = [
  { key: 'accountRate', label: '嘎查村社区账号开通推广率', color: '#40e0ff' },
  { key: 'popHouseRate', label: '人口、房屋基础数据完善率', color: '#3ddc97' },
  { key: 'entRate', label: '企业（九小场所）基础数据完善率', color: '#f7c948' },
  { key: 'linkRate', label: '人房关联率', color: '#b48cff' }
]

/** 达标阈值：≥99.5% 视为达标（标签用青白色，异常值才用红/黄强调） */
const QUALITY_LABEL_MIN = 99.5

/** geojson feature 质心：取面积最大的外环按鞋带公式求质心，比 bbox 中心稳 */
const centroidOfFeature = (feature: any): [number, number] | null => {
  const coordinates = feature?.geometry?.coordinates ?? []
  const polys = feature?.geometry?.type === 'MultiPolygon' ? coordinates : [coordinates]
  let best: { area: number; x: number; y: number } | null = null
  for (const poly of polys) {
    const ring = poly?.[0]
    if (!Array.isArray(ring) || ring.length < 3) continue
    let area2 = 0
    let cx = 0
    let cy = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = ring[i][0]
      const y0 = ring[i][1]
      const x1 = ring[i + 1][0]
      const y1 = ring[i + 1][1]
      const cross = x0 * y1 - x1 * y0
      area2 += cross
      cx += (x0 + x1) * cross
      cy += (y0 + y1) * cross
    }
    if (Math.abs(area2) < 1e-9) continue
    // 鞋带公式：area2 = Σcross = 2A，质心 = Σ(x_i+x_i+1)*cross / (6A) = ... / (3*area2)
    const cand = { area: area2 / 2, x: cx / (3 * area2), y: cy / (3 * area2) }
    if (!best || Math.abs(cand.area) > Math.abs(best.area)) best = cand
  }
  return best ? [best.x, best.y] : null
}

const qualityByName = computed(() => {
  const map = new Map<string, RegionQualityItem>()
  for (const item of props.qualityData) {
    if (regionNames.includes(item.name)) map.set(item.name, item)
  }
  return map
})

/** 全区视图且质量数据可用时才进入四率展示模式 */
const qualityMode = computed(
  () => viewLevel.value === 'region' && qualityByName.value.size > 0
)

const showQualityLegend = computed(() => qualityMode.value)

/** 百分比标签配色：<90% 红、90~99.5% 黄、≥99.5% 青白（达标不抢眼） */
const qualityLabelColor = (v: number) =>
  v < 90 ? '#ff7a7a' : v < QUALITY_LABEL_MIN ? '#ffd257' : '#8beaff'

/** 单个盟市的四率数据 → geo3D 坐标系数据点（4 根条 + 每条顶百分比 + 盟市名） */
const qualitySeriesData = () => {
  const bars: any[] = []
  const labels: any[] = []
  const names: any[] = []
  const DX = 0.32 // 相邻条经度间距（度）：留出百分比标签宽度，同排标签才不互相压叠
  for (const feature of (nmgGeo as any).features) {
    const name = String(feature?.properties?.name ?? '')
    const item = qualityByName.value.get(name)
    if (!item) continue
    const c = centroidOfFeature(feature)
    if (!c) continue
    // 盟市名贴地显示（z 略高于块顶 3.2）：原生 geo3D 标签悬浮 1.5 个单位，
    // 在 50° 透视下会整体向上漂，看起来和地图块错位；自己画可精确贴住色块
    names.push({
      name: `${name}#name`,
      value: [c[0], c[1], 3.45],
      label: {
        formatter: shortName(name),
        color: '#eafcff',
        fontSize: 16,
        fontWeight: 600
      }
    })
    QUALITY_METRICS.forEach((m, i) => {
      const v = Math.max(0, Math.min(100, Number(item[m.key]) || 0))
      // 条从块体里长出来（块顶 = regionHeight 1.8 + height 1.4 ≈ 3.2），
      // 高度上限压到 9.0：条越高，透视视差让顶部偏离盟市越明显
      const h = 4.0 + (v / 100) * 5.0
      const x = c[0] + (i - 1.5) * DX
      const y = c[1] + 0.45 // 条组整体北移，名字留在质心，形成「名下条上」的版式
      bars.push({
        name: `${name}#${m.key}`,
        value: [x, y, h],
        itemStyle: { color: m.color, opacity: 0.92 }
      })
      // 每根条顶都标百分比；奇偶交错抬升，避免相邻百分比文字互相压叠
      labels.push({
        name: `${name}#${m.key}`,
        value: [x, y, h + (i % 2 ? 1.6 : 0.45)],
        itemStyle: { color: qualityLabelColor(v) },
        label: {
          formatter: `${v.toFixed(0)}%`,
          color: qualityLabelColor(v),
          fontSize: 12
        }
      })
    })
  }
  return { bars, labels, names }
}

/** 悬停盟市时的四率明细卡 */
const qualityTipFormatter = (params: any) => {
  const rawName = String(params?.name ?? '')
  const name = rawName.split('#')[0]
  const item = qualityByName.value.get(name)
  if (!item) return ''
  const row = (label: string, v: number, color?: string) =>
    `<div style="display:flex;align-items:center;gap:6px;margin-top:3px;">${
      color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};"></span>` : ''
    }<span>${label}</span><span style="margin-left:auto;font-family:'DIN','Consolas',monospace;font-weight:bold;${color ? `color:${color};` : 'color:#7fe3ff;'}">${Number(v).toFixed(2)}%</span></div>`
  return `<div style="min-width:190px;">
    <div style="font-weight:bold;color:#9fe8ff;margin-bottom:2px;">${shortName(name)}·数据质量</div>
    ${QUALITY_METRICS.map((m) => {
      const v = Number(item[m.key]) || 0
      return row(m.label, v, v < 90 ? '#ff7a7a' : v < QUALITY_LABEL_MIN ? '#ffd257' : m.color)
    }).join('')}
  </div>`
}


/** 最近一次实际渲染的层级；边界数据缺失发生降级时，点击行为以画面为准 */
let currentLevel: MapLevel = 'region'

const buildOption = () => {
  ensureMap()
  const resolved = resolveMap()
  const level = resolved.level
  currentLevel = level
  const items = level === 'region'
    ? validData.value
    : level === 'county'
      ? validCountyData.value.filter((d) => d.adcode === props.selectedCountyCode)
      : validCountyData.value
  const min = items.length ? Math.min(...items.map((d) => Number(d.value))) : 0
  const max = items.length ? Math.max(...items.map((d) => Number(d.value))) : 100
  // 数据挤在窄区间时给一个最小跨度，避免整张图几乎同色；
  // 两端各留 6 个百分点余量，让最低/最高值不贴死色阶端点
  const lo = Math.max(0, min - 6)
  const hi = Math.min(100, max + 6)
  const span = Math.max(24, hi - lo)
  const norm = (v: number) => Math.min(1, Math.max(0, (v - lo) / span))
  // 盟市 / 旗县区视图按外包络盒纵横比调整 boxDepth / 视距，让区域尽量铺满画布
  let boxDepth = 66
  let distance = 74
  if (level !== 'region') {
    const bb = bboxOfFeatures(resolved.features)
    if (bb) {
      const wDeg = Math.max(0.01, bb.maxLon - bb.minLon)
      const dDeg = Math.max(0.01, bb.maxLat - bb.minLat)
      boxDepth = Math.min(140, Math.max(22, 100 * (dDeg / wDeg)))
      distance = 74 * Math.max(1, boxDepth / 66)
    }
  }

  const rateByName = new Map(items.map((d) => [d.name, d]))
  const quality = qualityMode.value
  // regions 必须覆盖当前地图上的「每一个面」：否则没匹配到指标的块会回落到
  // geo3D.itemStyle.color 这一个默认色，且高度是默认值，出现整片死蓝、没有立体厚度
  const allNames: string[] = level === 'region'
    ? regionNames
    : resolved.features
        .map((f: any) => String(f?.properties?.name ?? ''))
        .filter(Boolean)
  const regions = allNames.map((name) => {
    // 四率模式下地图回归参考稿的「统一青色底」，不与四率条抢视觉。
    // height 要压低：条柱从 z=0 起算，块太高会把条埋进块体里
    if (quality) {
      return {
        name,
        height: 1.4,
        itemStyle: { color: QUALITY_REGION_COLOR, opacity: 0.98 }
      }
    }
    const hit = rateByName.get(name)
    // 有指标才用色阶/高度分级；无指标统一基准色 + 统一高度，避免与真实分级混淆
    const t = hit ? norm(Number(hit.value)) : 0.5
    const height = hit
      ? level === 'region'
        ? 2.0 + t * 4.4
        : level === 'city'
          ? 1.8 + t * 2.8
          : 2.9
      : 2.6
    return {
      name,
      height,
      itemStyle: {
        color: hit ? colorOf(t) : BASE_COLOR,
        opacity: 0.98
      }
    }
  })

  // 两层必须共用同一份 viewControl，否则拖拽/缩放后事件层会和视觉层错位
  // 居中校准：透视相机（alpha=50）下地图投影的视觉中心实测比画布几何中心
  // 偏左约 75px、偏下约 90px（6654×1152 设计坐标）。把视线目标反向微移，
  // 让地图回到画布正中。单位是地图盒坐标（boxWidth=100 ≈ 画布 1624px，
  // 即 1 单位 ≈ 16px；y 轴受 50° 俯角透视压缩再除以 cos50° ≈ 0.64）
  const viewControl = {
    alpha: 50,
    beta: 0,
    distance,
    center: [-4.7, -11.9, 0],
    autoRotate: false,
    damping: 0.88,
    minDistance: 26,
    maxDistance: 300,
    panMouseButton: 'left',
    rotateMouseButton: 'right'
  }

  const qData = quality ? qualitySeriesData() : { bars: [], labels: [], names: [] }

  return {
    backgroundColor: 'transparent',
    // 四率模式：悬停盟市弹完整数据卡
    ...(quality
      ? {
          tooltip: {
            show: true,
            confine: true,
            backgroundColor: 'rgba(8,26,54,.94)',
            borderColor: 'rgba(90,150,230,.5)',
            borderWidth: 1,
            padding: [10, 12],
            textStyle: { color: '#dceaff', fontSize: chartFont(12) },
            extraCssText: 'box-shadow:0 6px 20px rgba(0,20,60,.45);border-radius:4px;',
            formatter: qualityTipFormatter
          }
        }
      : {}),
    geo3D: {
      map: resolved.name,
      roam: true,
      boxWidth: 100,
      boxDepth,
      regionHeight: 1.8,
      shading: 'lambert',
      environment: 'none',
      itemStyle: {
        // 兜底底色也提亮；正常渲染时每个面都由 regions 单独着色，不会再落到这个色
        color: '#124a82',
        opacity: 0.98,
        borderWidth: level === 'region' ? 1.1 : 1.4,
        borderColor: 'rgba(168,238,255,.78)'
      },
      emphasis: {
        itemStyle: {
          color: '#5ce8ff',
          borderWidth: 2,
          borderColor: 'rgba(230,252,255,.95)'
        },
        label: { show: !quality, color: '#ffffff', fontSize: chartFont(21), fontWeight: 700 }
      },
      label: {
        show: !quality,
        color: '#eafcff',
        fontSize: level === 'county' ? 22 : level === 'city' ? 17 : 16,
        fontWeight: 600,
        distance: 1.5,
        textBorderColor: 'rgba(3,22,48,.9)',
        textBorderWidth: 3,
        formatter: (p: any) => {
          // 四率模式下地图上不再标填报率，只留地名（数值由四率条+悬停卡承担）
          if (quality) return shortName(p.name)
          const hit = items.find((d) => d.name === p.name)
          const label = level === 'region' ? shortName(p.name) : p.name
          return hit ? `${label} ${Number(hit.value).toFixed(0)}%` : label
        }
      },
      regions,
      light: {
        // 中性偏亮的环境光，避免 lambert 把顶面压成灰蓝；主光稍降减少过曝
        main: { color: '#eaf7ff', intensity: 1.15, shadow: true, shadowQuality: 'high', alpha: 45, beta: 22 },
        ambient: { color: '#7ab4dd', intensity: 0.7 }
      },
      viewControl,
      postEffect: {
        enable: true,
        bloom: { enable: true, bloomIntensity: 0.22 },
        SSAO: { enable: false }
      },
      temporalSuperSampling: { enable: false }
    },
    series: [
      // 全区视图·四率展示：每个盟市上方一组 4 根彩色竖条（高度=指标值）。
      // silent：悬停/点击都落到下面的透明拾取层，保证下钻行为不被条柱挡住
      ...(qData.bars.length
        ? [
            {
              type: 'bar3D',
              coordinateSystem: 'geo3D',
              barSize: [0.55, 0.55],
              silent: true,
              shading: 'lambert',
              data: qData.bars,
              label: { show: false }
            },
            {
              // 条顶百分比（每根都有，奇偶交错高度防压叠）
              type: 'scatter3D',
              coordinateSystem: 'geo3D',
              silent: true,
              symbolSize: 0.01,
              data: qData.labels,
              label: {
                show: true,
                position: 'top',
                fontSize: chartFont(13),
                fontWeight: 700,
                textBorderColor: 'rgba(3,22,48,.95)',
                textBorderWidth: 3
              }
            },
            {
              // 盟市名贴地显示：原生 geo3D 标签悬浮 1.5 单位，透视下与色块错位，
              // 由 qualitySeriesData 在质心处自绘，与条柱组严格对齐
              type: 'scatter3D',
              coordinateSystem: 'geo3D',
              silent: true,
              symbolSize: 0.01,
              data: qData.names,
              label: {
                show: true,
                position: 'top',
                textBorderColor: 'rgba(3,22,48,.95)',
                textBorderWidth: 3
              }
            }
          ]
        : []),
      {
        // 事件层：geo3D 组件不派发区域点击事件（echarts-gl 已知限制），
        // 叠一层近乎透明的 map3D series 专职接收点击。
        // opacity 必须 > 0：完全透明的 mesh 会被 WebGL 跳过，射线拾取不到区域，
        // 表现为「点地图没反应、无法下钻」；同时把它放到视觉层之上避免被 geo3D 遮挡。
        type: 'map3D',
        map: resolved.name,
        boxWidth: 100,
        boxDepth,
        regionHeight: 1.85,
        zlevel: 1,
        silent: false,
        itemStyle: { opacity: 0.008 },
        emphasis: { itemStyle: { opacity: 0.008 }, label: { show: false } },
        label: { show: false },
        viewControl: { ...viewControl }
      }
    ]
  }
}

let renderSeq = 0

/** WebGL 不可用时的降级渲染：2D 地图（canvas），色块 + 名称 + 四率条/百分比 + 悬停卡，
 *  数据、下钻行为与 3D 版一致，不会出现「不支持 WebGL」的空白区域 */
const buildOption2D = () => {
  ensureMap()
  const resolved = resolveMap()
  const level = resolved.level
  currentLevel = level
  const items = level === 'region'
    ? validData.value
    : level === 'county'
      ? validCountyData.value.filter((d) => d.adcode === props.selectedCountyCode)
      : validCountyData.value
  const min = items.length ? Math.min(...items.map((d) => Number(d.value))) : 0
  const max = items.length ? Math.max(...items.map((d) => Number(d.value))) : 100
  const lo = Math.max(0, min - 6)
  const hi = Math.min(100, max + 6)
  const span = Math.max(24, hi - lo)
  const norm = (v: number) => Math.min(1, Math.max(0, (v - lo) / span))
  const quality = qualityMode.value
  const rateByName = new Map(items.map((d) => [d.name, d]))
  const allNames: string[] = level === 'region'
    ? regionNames
    : resolved.features
        .map((f: any) => String(f?.properties?.name ?? ''))
        .filter(Boolean)

  /** 每个面的配色：四率模式统一青色底，其余按填报率色阶 */
  const colorOfName = (name: string) => {
    if (quality) return QUALITY_REGION_COLOR
    const hit = rateByName.get(name)
    return hit ? colorOf(norm(Number(hit.value))) : BASE_COLOR
  }

  const mapData = allNames.map((name) => {
    const hit = rateByName.get(name)
    const label = level === 'region' ? shortName(name) : name
    return {
      name,
      value: hit ? Number(hit.value) : 0,
      label: {
        show: true,
        formatter: quality || !hit ? label : `${label} ${Number(hit.value).toFixed(0)}%`
      }
    }
  })

  // 四率条组：custom series 逐组绘制「4 根条 + 交错百分比 + 盟市名」，
  // 标签位置完全可控（scatter 符号的标签会两两压叠，geoIndex 绑定后 map series 也不渲染标签）
  const barSeries = quality && level === 'region'
    ? (() => {
        const cities: Array<{ name: string; lon: number; lat: number }> = []
        for (const [name] of qualityByName.value.entries()) {
          const feature = (nmgGeo as any).features.find(
            (f: any) => String(f?.properties?.name ?? '') === name
          )
          const c = feature ? centroidOfFeature(feature) : null
          if (c) cities.push({ name, lon: c[0], lat: c[1] })
        }
        const GAP = 13
        const BW = 7
        return [{
          type: 'custom',
          coordinateSystem: 'geo',
          geoIndex: 0,
          silent: true,
          z: 6,
          data: cities.map((c) => ({ name: c.name, value: [c.lon, c.lat] })),
          renderItem: (params: any, api: any) => {
            const city = cities[params.dataIndex]
            if (!city) return null
            const pt = api.coord([city.lon, city.lat])
            const children: any[] = []
            QUALITY_METRICS.forEach((m, i) => {
              const v = Math.max(0, Math.min(100, Number((qualityByName.value.get(city.name) as any)?.[m.key]) || 0))
              const h = 12 + (v / 100) * 36
              const bx = pt[0] + (i - 1.5) * GAP - BW / 2
              const by = pt[1] - h - 12
              children.push({
                type: 'rect',
                shape: { x: bx, y: by, width: BW, height: h, r: 1.5 },
                style: { fill: m.color, opacity: 0.95 }
              })
              // 奇偶交错两排，避免「100%100%」压叠
              children.push({
                type: 'text',
                style: {
                  text: `${v.toFixed(0)}%`,
                  x: pt[0] + (i - 1.5) * GAP,
                  y: by - (i % 2 ? 15 : 3),
                  align: 'center',
                  fill: qualityLabelColor(v),
                  font: 'bold 10px sans-serif',
                  stroke: 'rgba(3,22,48,.95)',
                  lineWidth: 2
                }
              })
            })
            children.push({
              type: 'text',
              style: {
                text: shortName(city.name),
                x: pt[0],
                y: pt[1] + 6,
                align: 'center',
                fill: '#eafcff',
                font: 'bold 12px sans-serif',
                stroke: 'rgba(3,22,48,.95)',
                lineWidth: 3
              }
            })
            return { type: 'group', children }
          }
        }]
      })()
    : []

  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: true,
      confine: true,
      backgroundColor: 'rgba(8,26,54,.94)',
      borderColor: 'rgba(90,150,230,.5)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: '#dceaff', fontSize: chartFont(12) },
      extraCssText: 'box-shadow:0 6px 20px rgba(0,20,60,.45);border-radius:4px;',
      formatter: quality
        ? qualityTipFormatter
        : (p: any) => `${p.name}<br/>填报率 <b>${Number(p.value || 0).toFixed(2)}%</b>`
    },
    geo: {
      map: resolved.name,
      roam: true,
      zoom: level === 'region' ? 1.02 : 1.06,
      top: '4%',
      bottom: '6%',
      left: '1%',
      right: '1%',
      itemStyle: { areaColor: BASE_COLOR, borderColor: 'rgba(168,238,255,.8)', borderWidth: 1 },
      // 填报率模式的名称+数值放这里（geoIndex 绑定后 map series 的 label 不渲染）
      label: {
        show: !quality,
        color: '#eafcff',
        fontSize: level === 'county' ? 18 : level === 'city' ? 14 : 13,
        fontWeight: 600,
        textBorderColor: 'rgba(3,22,48,.9)',
        textBorderWidth: 3,
        formatter: (p: any) => {
          const label = level === 'region' ? shortName(String(p.name)) : String(p.name)
          const hit = rateByName.get(String(p.name))
          return hit ? `${label} ${Number(hit.value).toFixed(0)}%` : label
        }
      },
      emphasis: {
        itemStyle: { areaColor: '#5ce8ff' },
        label: { show: true, color: '#ffffff' }
      },
      regions: allNames.map((name) => ({ name, itemStyle: { areaColor: colorOfName(name) } }))
    },
    series: [
      {
        // 透明面 + 数据项：只负责悬停卡片和点击下钻，填色由 geo.regions 完成
        type: 'map',
        geoIndex: 0,
        data: mapData,
        itemStyle: { areaColor: 'transparent', borderColor: 'transparent' },
        label: { show: false },
        emphasis: {
          itemStyle: { areaColor: 'rgba(92,232,255,.35)' },
          label: { show: false }
        }
      },
      ...barSeries
    ]
  }
}

const render = async () => {
  if (!chart) return
  const seq = ++renderSeq
  if (viewLevel.value !== 'region' && !countiesGeo) await loadCounties()
  // 快速连续切换时，只让最后一次渲染生效
  if (seq !== renderSeq || !chart) return
  chart.setOption((webglOK ? buildOption() : buildOption2D()) as any, true)
  // echarts-gl 创建 WebGL 上下文失败时会把错误文案塞进容器：识别到就降级 2D
  if (webglOK && chartRef.value?.querySelector('.ecgl-nowebgl')) switchTo2D()
}

const resize = () => chart?.resize()

const init = () => {
  if (!chartRef.value) return
  ensureMap()
  webglOK = !force2D() && detectWebGL()
  fallback2D.value = !webglOK
  initChart()
  render()
}

/** 创建 echarts 实例并绑定交互（3D 降级到 2D 时会重建，故独立成函数） */
const initChart = () => {
  if (!chartRef.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  chart = echarts.init(chartRef.value, undefined, { devicePixelRatio: dpr })
  bindPick()
  if (webglOK) bindContextGuard()
}

/** 永久降级到 2D：重建实例，之后所有渲染走 buildOption2D */
const switchTo2D = () => {
  if (!webglOK && fallback2D.value) return
  webglOK = false
  fallback2D.value = true
  chart?.dispose()
  chart = null
  initChart()
  render()
}

/** GPU 进程崩溃 / 显卡驱动重置会让 WebGL 上下文丢失（大屏 7×24 运行很常见）：
 *  第一次自动重建恢复，第二次起永久降级 2D，避免整块地图变成空白 */
const bindContextGuard = () => {
  const canvas = chart?.getDom()?.querySelector('canvas')
  canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    ctxLostCount += 1
    chart?.dispose()
    chart = null
    window.setTimeout(() => {
      if (ctxLostCount <= 1) {
        initChart()
        render()
      } else {
        switchTo2D()
      }
    }, 800)
  })
}

/** 点击/悬停区域拾取：3D 与 2D 共用（2D 走 map series，params.name 一致）*/
const bindPick = () => {
  if (!chart) return
  // 3D 拾取在不同 echarts-gl 版本里可能只派发 click 或只派发 mouseup，
  // 两个通道都接，并用「同名 + 短时间」去重，保证一次点击只下钻一次。
  let lastPickName = ''
  let lastPickAt = 0
  const pickRegion = (params: any) => {
    const name = String(params?.name ?? params?.data?.name ?? params?.region?.name ?? '')
    if (!name) return
    const now = Date.now()
    if (name === lastPickName && now - lastPickAt < 400) return
    lastPickName = name
    lastPickAt = now

    const level = currentLevel
    const items = level === 'region' ? validData.value : validCountyData.value
    const hit = items.find((d) => d.name === name)
    const adcode = level === 'region'
      ? hit?.adcode ?? nameToAdcode[name]
      : hit?.adcode ?? countyNameToCode[name] ?? props.selectedCountyCode
    emit('select', {
      ...(hit ?? { name, value: Number.NaN }),
      name,
      adcode,
      level: level === 'region' ? 'city' : 'county',
      viewLevel: level,
      parentCode: level === 'county' ? props.selectedCode : undefined
    })
  }
  chart.on('click', pickRegion)
  chart.on('mouseup', pickRegion)
}

onMounted(() => {
  init()
  window.addEventListener('resize', resize)
  if (chartRef.value) {
    ro = new ResizeObserver(() => resize())
    ro.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  ro?.disconnect()
  chart?.dispose()
  chart = null
})

watch(() => props.data, () => render(), { deep: true })
watch(() => props.countyData, () => render(), { deep: true })
watch(() => props.qualityData, () => render(), { deep: true })
watch(() => props.selectedCode, () => render())
watch(() => props.selectedCountyCode, () => render())

watch(() => props.scaleVersion, () => {
  // 大屏等比缩放后容器尺寸变了，等一帧再 resize
  requestAnimationFrame(() => resize())
})

defineExpose({ resize })
</script>

<style scoped>
.fill-rate-map {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

/* 地图底部一层柔和光晕，让立体块从深空背景里浮起来；不响应鼠标事件 */
.fill-rate-map::before {
  content: '';
  position: absolute;
  inset: 6% 4% 0;
  background: radial-gradient(
    ellipse at 50% 60%,
    rgba(28, 152, 220, 0.22) 0%,
    rgba(10, 46, 94, 0.1) 48%,
    transparent 74%
  );
  pointer-events: none;
}

.map-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

/* 全区视图·四率图例：左上角玻璃面板 */
.quality-legend {
  position: absolute;
  top: 6px;
  left: 10px;
  z-index: 2;
  padding: 8px 12px 9px;
  background: linear-gradient(180deg, rgba(14, 34, 68, 0.82) 0%, rgba(8, 24, 58, 0.72) 100%);
  border: 1px solid rgba(64, 158, 255, 0.35);
  border-radius: 4px;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

.ql-title {
  font-size: calc(13px * var(--font-boost-sm));
  font-weight: bold;
  color: #9fe8ff;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.ql-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 4px;
}

.ql-chip {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(64, 224, 255, 0.45);
}

.ql-name {
  font-size: calc(12px * var(--font-boost-sm));
  color: #c8d6f5;
  white-space: nowrap;
}

/* WebGL 不可用时的降级提示（右下角小字，不遮挡地图主体） */
.gl-fallback-tip {
  position: absolute;
  right: 10px;
  bottom: 8px;
  z-index: 3;
  padding: 3px 8px;
  border-radius: 3px;
  background: rgba(10, 26, 58, 0.72);
  border: 1px solid rgba(90, 150, 230, 0.35);
  font-size: calc(11px * var(--font-boost-sm));
  color: #8fb6e8;
  pointer-events: none;
}
</style>
