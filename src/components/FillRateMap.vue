<template>
  <div class="fill-rate-map">
    <div ref="chartRef" class="map-canvas"></div>
    <div class="map-legend">
      <span class="legend-text">{{ metricLabel }}</span>
      <i class="legend-bar"></i>
      <span class="legend-scale">{{ minText }} ~ {{ maxText }}</span>
    </div>
    <div v-if="tip" class="map-tip">{{ tip }}</div>
  </div>
</template>

<script setup lang="ts">
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

const props = withDefaults(
  defineProps<{
    data: FillRateItem[]
    /** 大屏整体缩放版本号，变化时重新 resize */
    scaleVersion?: number
    /** 图例指标名 */
    metricLabel?: string
    /** 右下角提示文案，空串则不显示 */
    tip?: string
    /** 当前选中的盟市 6 位区划代码（国标），用于下钻到旗县区 */
    selectedCode?: string
    /** 当前选中的旗县区 6 位区划代码；有值时地图聚焦该旗县区 */
    selectedCountyCode?: string
    /** 旗县区级指标数据（可选）；为空时只渲染轮廓与名称，不填指标色 */
    countyData?: FillRateItem[]
  }>(),
  {
    data: () => [],
    scaleVersion: 0,
    metricLabel: '覆盖率',
    tip: '',
    selectedCode: '',
    selectedCountyCode: '',
    countyData: () => []
  }
)

const emit = defineEmits<{ (e: 'select', item: FillRateItem): void }>()

const chartRef = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

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
const legendItems = computed(() =>
  viewLevel.value === 'region' ? validData.value : validCountyData.value
)
const minVal = computed(() =>
  legendItems.value.length ? Math.min(...legendItems.value.map((d) => Number(d.value))) : 0
)
const maxVal = computed(() =>
  legendItems.value.length ? Math.max(...legendItems.value.map((d) => Number(d.value))) : 100
)
const minText = computed(() => `${minVal.value.toFixed(0)}%`)
const maxText = computed(() => `${maxVal.value.toFixed(0)}%`)

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

/** 低 → 高：深蓝 → 中蓝 → 亮青 */
const colorOf = (t: number) => (
  t < 0.5
    ? lerpColor('#0a2a52', '#1176a8', t / 0.5)
    : lerpColor('#1176a8', '#22c8ff', (t - 0.5) / 0.5)
)

const shortName = (name: string) => name.replace(/(市|盟)$/, '')

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
  const span = Math.max(1, max - min)
  const norm = (v: number) => Math.min(1, Math.max(0, (v - min) / span))

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

  const regions = items.map((item) => ({
    name: item.name,
    height: level === 'region'
      ? 1.2 + norm(Number(item.value)) * 3.4
      : level === 'city'
        ? 1.0 + norm(Number(item.value)) * 2.0
        : 2.4,
    itemStyle: {
      color: colorOf(norm(Number(item.value))),
      opacity: 0.96
    }
  }))

  // 两层必须共用同一份 viewControl，否则拖拽/缩放后事件层会和视觉层错位
  const viewControl = {
    alpha: 50,
    beta: 0,
    distance,
    center: [0, 0, 0],
    autoRotate: false,
    damping: 0.88,
    minDistance: 26,
    maxDistance: 300,
    panMouseButton: 'left',
    rotateMouseButton: 'right'
  }

  return {
    backgroundColor: 'transparent',
    geo3D: {
      map: resolved.name,
      roam: true,
      boxWidth: 100,
      boxDepth,
      regionHeight: 1.8,
      shading: 'lambert',
      environment: 'none',
      itemStyle: {
        color: '#0c3c6d',
        opacity: 0.95,
        borderWidth: level === 'region' ? 1.6 : 2,
        borderColor: 'rgba(140,235,255,.9)'
      },
      emphasis: {
        itemStyle: { color: '#3fd6ff' },
        label: { show: true, color: '#ffffff', fontSize: 14, fontWeight: 600 }
      },
      label: {
        show: true,
        color: '#eaf6ff',
        fontSize: level === 'county' ? 16 : 11,
        fontWeight: 600,
        distance: 1.2,
        textBorderColor: '#05203c',
        textBorderWidth: 2,
        formatter: (p: any) => {
          const hit = items.find((d) => d.name === p.name)
          const label = level === 'region' ? shortName(p.name) : p.name
          return hit ? `${label} ${Number(hit.value).toFixed(0)}%` : label
        }
      },
      regions,
      light: {
        main: { color: '#ffffff', intensity: 1.35, shadow: true, shadowQuality: 'medium', alpha: 42, beta: 25 },
        ambient: { color: '#2f6ea8', intensity: 0.45 }
      },
      viewControl,
      postEffect: {
        enable: true,
        bloom: { enable: true, bloomIntensity: 0.1 },
        SSAO: { enable: false }
      },
      temporalSuperSampling: { enable: false }
    },
    series: [
      {
        // 事件层：geo3D 组件不派发区域点击事件（echarts-gl 已知限制），
        // 叠一层完全透明的 map3D series 专职接收点击
        type: 'map3D',
        map: resolved.name,
        boxWidth: 100,
        boxDepth,
        regionHeight: 1.85,
        zlevel: -10,
        itemStyle: { opacity: 0 },
        emphasis: { itemStyle: { opacity: 0 }, label: { show: false } },
        label: { show: false },
        viewControl: { ...viewControl }
      }
    ]
  }
}

let renderSeq = 0
const render = async () => {
  if (!chart) return
  const seq = ++renderSeq
  if (viewLevel.value !== 'region' && !countiesGeo) await loadCounties()
  // 快速连续切换时，只让最后一次渲染生效
  if (seq !== renderSeq || !chart) return
  chart.setOption(buildOption() as any, true)
}

const resize = () => chart?.resize()

const init = () => {
  if (!chartRef.value) return
  ensureMap()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  chart = echarts.init(chartRef.value, undefined, { devicePixelRatio: dpr })
  render()
  chart.on('click', (params: any) => {
    const name = String(params?.name ?? '')
    if (!name) return
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
  })
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

.map-canvas {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.map-legend {
  position: absolute;
  left: 10px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--c-text-dim, #7a93c4);
  pointer-events: none;
}

.legend-bar {
  display: block;
  width: 84px;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, #0a2a52 0%, #1176a8 50%, #22c8ff 100%);
  border: 1px solid rgba(64, 158, 255, 0.35);
}

.legend-scale {
  color: #8fb3dd;
  font-family: 'DIN', 'Consolas', monospace;
}

.map-tip {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11px;
  color: rgba(122, 147, 196, 0.65);
  pointer-events: none;
}
</style>
