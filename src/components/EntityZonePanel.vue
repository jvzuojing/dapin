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

/**
 * 环图逻辑与 pc 项目 CenterPanel.entityPieConfig 对齐（接口字段一致）：
 * 1) 优先用适配层 pieGroups（接口 2.11 dataTypeCount：房屋=fwjzqkData 居住状态 + fwjzlxData 房屋类型，企业/场所=主分类）
 * 2) 接口未提供时，房屋/场所回退原型演示值
 * 3) 企业类型分布接口暂未提供（pc 同款过滤），企业块不显示环图、柱图横向占满
 */
const DEMO_PIE_GROUPS: Record<string, Array<{ title: string; data: Array<{ name: string; value: number }> }>> = {
  fang: [
    { title: '居住状态分布', data: [
      { name: '自住房', value: 38 },
      { name: '出租房', value: 26 },
      { name: '空置房', value: 14 },
      { name: '其他', value: 8 }
    ] },
    { title: '房屋类型分布', data: [
      { name: '楼房', value: 48 },
      { name: '平房', value: 22 },
      { name: '其他', value: 9 }
    ] }
  ],
  changsuo: [
    { title: '场所类型分布情况', data: [
      { name: '小商店', value: 66 },
      { name: '小医院', value: 18 },
      { name: '小旅馆', value: 20 },
      { name: '小餐饮场所', value: 54 },
      { name: '小歌舞厅娱乐场所', value: 12 },
      { name: '小网吧', value: 9 },
      { name: '小美容洗浴场所', value: 14 },
      { name: '小生产加工企业', value: 11 },
      { name: '小学校或幼儿园', value: 24 },
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
  // 环图取数与 pc 一致：pieGroups 优先；企业环被 pc 逻辑过滤掉
  const pieGroups = Array.isArray(entity.pieGroups)
    ? (entity.pieGroups as Array<{ title: string; data: Array<{ name: string; value: number }> }>)
        .filter(g => !g.title.includes('企业'))
    : []
  const donuts = def.key === 'ren'
    ? undefined
    : (pieGroups.length ? pieGroups : (DEMO_PIE_GROUPS[def.key] ?? []))
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
    donuts
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
