<template>
  <div class="entity-zone panel">
    <div class="panel-title">
      <span class="panel-title-text">基层治理情况</span>
    </div>
    <div class="entity-grid">
      <EntityBlock
        v-for="block in blocks"
        :key="block.title"
        v-bind="block"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EntityBlock from './EntityBlock.vue'
import { useScaledData, useRegionData } from '../composables/useRegionData'

const { entityData } = useScaledData()
const { regionDepth } = useRegionData()

/** 柱状图下方的说明文字，随下钻层级变化 */
const AXIS_TITLE: Record<number, string> = {
  1: '各盟市基层治理量',
  2: '各旗县区基层治理量',
  3: '各街道基层治理量'
}

/** 词云标签只取最后一个「/」后的文字 */
function lastTagSegment(name: string): string {
  const idx = Math.max(name.lastIndexOf('/'), name.lastIndexOf('／'))
  if (idx === -1) return name
  const tail = name.slice(idx + 1).trim()
  return tail || name
}

interface BlockDef {
  title: string
  total: string
  tagTotal?: string
  axisLabels: string[]
  trend: number[]
  rates: number[]
  cloudWords?: Array<{ name: string; value: number }>
  donuts?: Array<{ title: string; data: Array<{ name: string; value: number }> }>
  axisTitle?: string
  empty?: boolean
}

const defs: Array<{ key: string; title: string }> = [
  { key: 'ren', title: '人口治理情况' },
  { key: 'fang', title: '房屋治理情况' },
  { key: 'qi', title: '企业治理情况' },
  { key: 'changsuo', title: '场所治理情况' }
]

/** 房屋块的「居住状态分布」接口暂无数据，先用演示值 */
const DEMO_DONUT_DATA: Record<string, Array<{ title: string; data: Array<{ name: string; value: number }> }>> = {
  fang: [
    { title: '居住状态分布', data: [
      { name: '自住房', value: 38 },
      { name: '出租房', value: 26 },
      { name: '空置房', value: 14 },
      { name: '其他', value: 8 }
    ] }
  ]
}

const blocks = computed<BlockDef[]>((): BlockDef[] => defs.map((def): BlockDef => {
  const entity = (entityData.value as Record<string, any> | undefined)?.[def.key]
  if (!entity) {
    return {
      title: def.title,
      total: '--',
      axisLabels: [],
      trend: [],
      rates: [],
      empty: true
    }
  }
  const typeStats = Array.isArray(entity.typeStats) ? entity.typeStats : []
  const donutDefs: Array<{ title: string; data: Array<{ name: string; value: number }> }> = []
  // 房屋：居住状态（演示）+ 房屋类型（typeStats）
  if (def.key === 'fang') {
    donutDefs.push(...(DEMO_DONUT_DATA.fang ?? []))
    if (typeStats.length) donutDefs.push({ title: '房屋类型分布', data: typeStats })
  } else if (def.key === 'changsuo' && typeStats.length) {
    donutDefs.push({ title: '场所类型分布情况', data: typeStats })
  } else if (def.key === 'qi' && typeStats.length) {
    donutDefs.push({ title: '企业类型分布情况', data: typeStats })
  }
    return {
      title: def.title,
      total: entity.total ?? '--',
      tagTotal: def.key === 'ren' ? (entity.tagTotal ?? '') : '',
      axisTitle: AXIS_TITLE[regionDepth.value] ?? AXIS_TITLE[1],
      axisLabels: Array.isArray(entity.axisLabels) ? entity.axisLabels : [],
    trend: Array.isArray(entity.governanceTrend) ? entity.governanceTrend : [],
    rates: Array.isArray(entity.completionRates) ? entity.completionRates : [],
    cloudWords: def.key === 'ren' && Array.isArray(entity.cloudWords)
      ? entity.cloudWords.slice(0, 20).map((w: any) => ({ ...w, name: lastTagSegment(w.name) }))
      : undefined,
    donuts: donutDefs
  }
}))
</script>

<style scoped>
.entity-zone {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.entity-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
  padding: 4px 2px 6px;
}
</style>
