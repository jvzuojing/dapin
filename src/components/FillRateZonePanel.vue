<template>
  <div class="fillrate-zone panel">
    <div class="rate-chips">
      <div
        v-for="item in chips"
        :key="item.key"
        class="rate-chip"
      >
        <span class="chip-badge" :style="{ background: item.color }">{{ item.shortName }}</span>
        <span class="chip-name">{{ item.label }}</span>
        <span class="chip-value" :style="{ color: item.color }">{{ item.text }}</span>
      </div>
    </div>
    <div class="map-area">
      <div v-if="crumb" class="map-crumb">{{ crumb }}</div>
      <FillRateMap
        :data="coverageCityData"
        :county-data="coverageCountyData"
        :scale-version="scaleVersion"
        :selected-code="cityCode"
        :selected-county-code="countyCode"
        @select="handleMapSelect"
      />
      <div v-if="cityCode || countyCode" class="map-nav">
        <button v-if="countyCode" class="back-btn" @click="backToCity">返回盟市</button>
        <button class="back-btn" @click="backToAll">返回全区</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import FillRateMap, { type FillRateItem } from './FillRateMap.vue'
import { useScaledData, useRegionData } from '../composables/useRegionData'
import { useDashboardApi } from '../composables/useDashboardApi'

const { fillRateData } = useScaledData()
const { scaleVersion } = useRegionData()
const { regionCoverage, regionCountyCoverage, regionCascaderOptions } = useDashboardApi()

/** 全局区划选择（App.vue provide），点击地图即改写它 → 所有面板按新区划重载 */
const selectedRegion = inject<Ref<string[]>>('selectedRegion', ref<string[]>([]))

const CHIP_DEFS = [
  { key: 'autonomous', shortName: '自治区', label: '自治区级部门填报率', color: '#40e0ff' },
  { key: 'city', shortName: '盟市', label: '盟市级部门填报率', color: '#5dd39e' },
  { key: 'county', shortName: '旗县区', label: '旗县区部门填报率', color: '#8a7dff' },
  { key: 'township', shortName: '镇街', label: '镇街（苏木）填报率', color: '#f5a623' },
  { key: 'village', shortName: '村社', label: '村社（嘎查）填报率', color: '#4ea1ff' }
] as const

const clampPercent = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0)

const chips = computed(() => {
  const raw = fillRateData.value as Record<string, unknown>
  return CHIP_DEFS.map((def) => {
    const percent = clampPercent(Number(raw[def.key]))
    return { ...def, percent, text: `${percent.toFixed(2)}%` }
  })
})

/** 覆盖率字符串 → 0~100 数值（兼容 "88.5" / "88.5%" / null） */
const parseRate = (value: unknown) => {
  const numeric = Number(String(value ?? '').replace('%', '').trim())
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : NaN
}

/** 接口未就绪时的兜底演示值（村社覆盖率口径） */
const DEMO_CITY_DATA: FillRateItem[] = [
  { name: '呼和浩特市', value: 93 },
  { name: '包头市', value: 90 },
  { name: '乌海市', value: 88 },
  { name: '鄂尔多斯市', value: 86 },
  { name: '阿拉善盟', value: 83 },
  { name: '巴彦淖尔市', value: 80 },
  { name: '赤峰市', value: 78 },
  { name: '通辽市', value: 75 },
  { name: '乌兰察布市', value: 72 },
  { name: '锡林郭勒盟', value: 68 },
  { name: '兴安盟', value: 65 },
  { name: '呼伦贝尔市', value: 62 }
]

/** 全区视图数据：2.1 getRegionSituation 的 regionalBarStatsVOList（盟市 + 村社覆盖率） */
const coverageCityData = computed<FillRateItem[]>(() => {
  const list = regionCoverage.value
    .map((item) => ({ name: item.regionName, value: parseRate(item.rate) }))
    .filter((item) => Number.isFinite(item.value))
  return list.length ? list : DEMO_CITY_DATA
})

/** 盟市 / 旗县区视图数据：接口若返回下级明细则着色，否则只显示轮廓 */
const coverageCountyData = computed<FillRateItem[]>(() =>
  regionCountyCoverage.value
    .map((item) => ({ name: item.regionName, value: parseRate(item.rate) }))
    .filter((item) => Number.isFinite(item.value))
)

/** 区划路径第 2 / 3 级的 6 位国标代码，直接驱动地图下钻层级 */
const codeAt = (index: number) => {
  const raw = selectedRegion.value[index] ?? ''
  return /^\d{6}/.test(raw) ? raw.slice(0, 6) : ''
}
const cityCode = computed(() => codeAt(1))
const countyCode = computed(() => codeAt(2))

/** 6 位国标码 → 与区划树一致的 12 位码，保证兜底路径也能被左上角级联选中 */
const toRegionCode = (code: string, fallback = '') =>
  /^\d{6}$/.test(code) ? `${code}000000` : code || fallback

/** 区划树根节点（自治区）与它的盟市、旗县区子节点 */
const rootOption = computed(() => regionCascaderOptions.value[0])
const cityOption = computed(() => {
  const children = rootOption.value?.children ?? []
  return children.find((c) => c.value.slice(0, 6) === cityCode.value)
})

/** 左上角当前位置面包屑（去掉自治区一级） */
const crumb = computed(() => {
  const labels: string[] = []
  let options = regionCascaderOptions.value
  for (const value of selectedRegion.value) {
    const hit = options.find((o) => o.value === value)
    if (!hit) break
    labels.push(hit.label)
    options = hit.children ?? []
  }
  return labels.slice(1).join(' / ')
})

const findLeagueOption = (item: FillRateItem) => {
  const children = rootOption.value?.children ?? []
  const byCode = item.adcode ? children.find((c) => c.value.slice(0, 6) === item.adcode) : undefined
  return byCode ?? children.find((c) => c.label === item.name)
}

/** 点击盟市 = 进盟市视图；点击旗县区 = 进旗县区视图并联动全屏数据 */
const handleMapSelect = (item: FillRateItem) => {
  const root = rootOption.value
  const code = item.adcode ?? ''
  const view = item.viewLevel ?? 'region'

  // 旗县区聚焦视图里再点当前旗县区 → 退回盟市
  if (view === 'county' && code && code === countyCode.value) {
    backToCity()
    return
  }

  if (view === 'region') {
    // 再点一次已选中的盟市 = 回到全区
    if (code && code === cityCode.value) {
      backToAll()
      return
    }
    const league = findLeagueOption(item)
    if (root && league) {
      selectedRegion.value = [root.value, league.value]
    } else {
      // 无区划树（接口未就绪 / 演示模式）时用 12 位码兜底，
      // 保证左上角级联选择器与标题仍能对上，地图视图也能正常下钻
      selectedRegion.value = [
        selectedRegion.value[0] || '150000000000',
        toRegionCode(code, item.name)
      ]
    }
    return
  }

  // 点旗县区：写三级区划路径
  const city = cityOption.value
  const county = city?.children?.find(
    (c) => c.value.slice(0, 6) === code || c.label === item.name
  )
  if (root && city && county) {
    selectedRegion.value = [root.value, city.value, county.value]
  } else {
    selectedRegion.value = [
      selectedRegion.value[0] || '150000000000',
      selectedRegion.value[1] || toRegionCode(cityCode.value),
      toRegionCode(code, item.name)
    ]
  }
}

const backToCity = () => {
  const root = rootOption.value
  const city = cityOption.value
  if (root && city) selectedRegion.value = [root.value, city.value]
  else selectedRegion.value = selectedRegion.value.slice(0, 2)
}

const backToAll = () => {
  const root = rootOption.value
  if (root) selectedRegion.value = [root.value]
  else selectedRegion.value = selectedRegion.value.slice(0, 1)
}
</script>

<style scoped>
.fillrate-zone {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px 12px;
}

.rate-chips {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 14px;
  padding: 6px 0 2px;
}

.rate-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(8, 24, 58, 0.55);
  border: 1px solid rgba(64, 158, 255, 0.28);
  border-radius: 6px;
}

.chip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 52px;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.chip-name {
  font-size: 12px;
  color: #c8d6f5;
}

.chip-value {
  font-size: 18px;
  font-weight: bold;
  font-family: 'DIN', 'Consolas', monospace;
}

.map-area {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  position: relative;
  margin-top: 4px;
}

.map-crumb {
  position: absolute;
  top: 6px;
  left: 8px;
  z-index: 2;
  padding: 3px 9px;
  font-size: 12px;
  color: #bfe6ff;
  background: rgba(8, 34, 66, 0.78);
  border: 1px solid rgba(64, 158, 255, 0.28);
  border-radius: 4px;
  pointer-events: none;
}

.map-nav {
  position: absolute;
  top: 4px;
  right: 6px;
  z-index: 2;
  display: flex;
  gap: 6px;
}

.back-btn {
  padding: 4px 12px;
  font-size: 12px;
  color: #bfe6ff;
  background: rgba(8, 34, 66, 0.85);
  border: 1px solid rgba(64, 200, 255, 0.55);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  color: #fff;
  background: rgba(15, 68, 122, 0.95);
  border-color: #4ad0ff;
}
</style>
