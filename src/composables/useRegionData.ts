import { inject, computed, ref, type Ref } from 'vue'
import {
  userOverview as baseOverview,
  userTrendData as baseTrend,
  departmentList as baseDept,
  fillRateData as baseFillRate,
  entityData as baseEntity,
  systemUsageAll as baseSysAll,
  systemUsageCity as baseSysCity,
  systemUsageDept as baseSysDept,
  rootDatabase as baseRootDb,
  backflowData as baseBackflow,
  politicalLegalData as basePolitical,
  reportDetailList,
  taskDetailList,
  autonomousReportDetailList,
  autonomousTaskDetailList,
  sceneData as sceneDataMock,
  userLevelData as baseLevel
} from '../mock/data'
import { apiConfig } from '../config/api'
import { useDashboardApi } from './useDashboardApi'
import type { BasicDataCategoryCount, BasicDataItem } from '../types/api'

/* ------------------------------------------------------------------ *
 * 常量 / 工具
 * ------------------------------------------------------------------ */

/** 接口无数据时的占位符 */
const EMPTY = '--'

const REGION_AXIS_MAP: Record<number, string[]> = {
  1: ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
  2: ['新城区', '回民区', '玉泉区', '赛罕区', '土左旗', '托县', '和林格尔', '清水河', '武川', '开发区'],
  3: ['街道1', '街道2', '街道3', '街道4', '街道5', '街道6', '街道7', '街道8', '街道9', '街道10']
}

const USER_TREND_MAP: Record<number, { userCounts: number[], coverageRates: number[] }> = {
  1: {
    userCounts: [2300, 2100, 980, 1760, 1650, 1880, 1420, 1350, 1540, 1180, 1260, 930],
    coverageRates: [96, 94, 90, 92, 89, 93, 91, 88, 90, 87, 86, 85]
  },
  2: {
    userCounts: [2100, 1850, 1620, 1750, 1480, 1320, 1210, 1160, 1090, 980],
    coverageRates: [98, 96, 95, 97, 94, 93, 92, 90, 89, 88]
  },
  3: {
    userCounts: [100, 140, 230, 100, 130, 143, 144, 167, 194, 223],
    coverageRates: [92, 94, 96, 91, 93, 95, 96, 97, 98, 99]
  }
}

const REPORT_CONFIG: Record<number, {
  national: {
    reportTotal: number
    taskTotal: number
    quantityTotal: string
    statusCards: Array<{ key: string, label: string, value: number, accent?: 'success' | 'warning' | 'primary' }>
    distribution: {
      categories: string[]
      legend: string[]
      series: Array<{ name: string, data: number[], color: [string, string] }>
    }
  }
  autonomous: {
    reportTotal: number
    taskTotal: number
    quantityTotal: string
    statusCards: Array<{ key: string, label: string, value: number, accent?: 'success' | 'warning' | 'primary' }>
    distribution: {
      categories: string[]
      legend: string[]
      series: Array<{ name: string, data: number[], color: [string, string] }>
    }
  }
}> = {
  1: {
    national: {
      reportTotal: 32,
      taskTotal: 40,
      quantityTotal: '120000',
      statusCards: [
        { key: 'pendingSign', label: '待签收', value: 2, accent: 'warning' },
        { key: 'pendingReport', label: '待上报', value: 0 },
        { key: 'pendingFill', label: '待填报', value: 4 },
        { key: 'filling', label: '填报中', value: 1, accent: 'primary' },
        { key: 'completed', label: '已完成', value: 26, accent: 'success' }
      ],
      distribution: {
        categories: ['团中央', '民政部', '应急部', '妇联', '人力资源社会保障部', '农业农村部', '水利部', '中华全国总工会', '住房城乡建设部'],
        legend: ['报表数', '任务数'],
        series: [
          { name: '报表数', data: [6, 1, 8, 7, 1, 1, 1, 1, 1], color: ['rgba(64,158,255,0.2)', '#409eff'] },
          { name: '任务数', data: [7, 1, 11, 7, 1, 2, 1, 1, 1], color: ['rgba(93,211,158,0.2)', '#5dd39e'] }
        ]
      }
    },
    autonomous: {
      reportTotal: 0,
      taskTotal: 0,
      quantityTotal: '0',
      statusCards: [
        { key: 'forward', label: '待转发', value: 0, accent: 'warning' },
        { key: 'filling', label: '填报中', value: 0, accent: 'primary' },
        { key: 'audit', label: '待审核', value: 0 },
        { key: 'completed', label: '已完结', value: 0, accent: 'success' }
      ],
      distribution: {
        categories: ['自治区农牧厅', '自治区市场监督管理局', '自治区政法委', '自治区妇女联合会', '自治区总工会', '自治区林业和草原局', '自治区司法厅'],
        legend: ['报表数', '任务数'],
        series: [
          { name: '报表数', data: [0, 0, 0, 0, 0, 0, 0], color: ['rgba(64,158,255,0.2)', '#409eff'] },
          { name: '任务数', data: [0, 0, 0, 0, 0, 0, 0], color: ['rgba(93,211,158,0.2)', '#5dd39e'] }
        ]
      }
    }
  },
  2: {
    national: {
      reportTotal: 32,
      taskTotal: 40,
      quantityTotal: '120000',
      statusCards: [
        { key: 'pendingFill', label: '待填报', value: 4 },
        { key: 'filling', label: '填报中', value: 1, accent: 'primary' },
        { key: 'completed', label: '已完成', value: 26, accent: 'success' }
      ],
      distribution: {
        categories: ['团中央', '民政部', '应急部', '妇联', '人力资源社会保障部', '农业农村部', '水利部', '中华全国总工会', '住房城乡建设部'],
        legend: ['任务数'],
        series: [
          { name: '任务数', data: [7, 1, 11, 7, 1, 2, 1, 1, 1], color: ['rgba(64,158,255,0.2)', '#409eff'] }
        ]
      }
    },
    autonomous: {
      reportTotal: 0,
      taskTotal: 0,
      quantityTotal: '0',
      statusCards: [
        { key: 'forward', label: '待转发', value: 0, accent: 'warning' },
        { key: 'filling', label: '填报中', value: 0, accent: 'primary' },
        { key: 'audit', label: '待审核', value: 0 },
        { key: 'completed', label: '已完结', value: 0, accent: 'success' }
      ],
      distribution: {
        categories: ['自治区农牧厅', '自治区市场监督管理局', '自治区政法委', '自治区妇女联合会', '自治区总工会', '自治区林业和草原局', '自治区司法厅'],
        legend: ['任务数'],
        series: [
          { name: '任务数', data: [0, 0, 0, 0, 0, 0, 0], color: ['rgba(64,158,255,0.2)', '#409eff'] }
        ]
      }
    }
  },
  3: {
    national: {
      reportTotal: 32,
      taskTotal: 40,
      quantityTotal: '120000',
      statusCards: [
        { key: 'pendingFill', label: '待填报', value: 4 },
        { key: 'filling', label: '填报中', value: 1, accent: 'primary' },
        { key: 'completed', label: '已完成', value: 26, accent: 'success' }
      ],
      distribution: {
        categories: ['团中央', '民政部', '应急部', '妇联', '人力资源社会保障部', '农业农村部', '水利部', '中华全国总工会', '住房城乡建设部'],
        legend: ['任务数'],
        series: [
          { name: '任务数', data: [7, 1, 11, 7, 1, 2, 1, 1, 1], color: ['rgba(64,158,255,0.2)', '#409eff'] }
        ]
      }
    },
    autonomous: {
      reportTotal: 0,
      taskTotal: 0,
      quantityTotal: '0',
      statusCards: [
        { key: 'forward', label: '待转发', value: 0, accent: 'warning' },
        { key: 'filling', label: '填报中', value: 0, accent: 'primary' },
        { key: 'audit', label: '待审核', value: 0 },
        { key: 'completed', label: '已完结', value: 0, accent: 'success' }
      ],
      distribution: {
        categories: ['自治区农牧厅', '自治区市场监督管理局', '自治区政法委', '自治区妇女联合会', '自治区总工会', '自治区林业和草原局', '自治区司法厅'],
        legend: ['任务数'],
        series: [
          { name: '任务数', data: [0, 0, 0, 0, 0, 0, 0], color: ['rgba(64,158,255,0.2)', '#409eff'] }
        ]
      }
    }
  }
}

/** 报表统计状态卡定义：接口只返回该用户层级可见的状态，渲染时按此顺序 + 非空过滤 */
const STATUS_CARD_DEFS: Array<{
  key: string
  field: string
  label: string
  accent?: 'success' | 'warning' | 'primary'
}> = [
  { key: 'pendingForward', field: 'pendingForwardCount', label: '待转发', accent: 'warning' },
  { key: 'pendingSign', field: 'pendingSignCount', label: '待签收', accent: 'warning' },
  { key: 'pendingReport', field: 'pendingReportCount', label: '待上报' },
  { key: 'pendingReview', field: 'pendingReviewCount', label: '待审核' },
  { key: 'pendingFill', field: 'pendingFillCount', label: '待填报' },
  { key: 'filling', field: 'fillingCount', label: '填报中', accent: 'primary' },
  { key: 'completed', field: 'completedCount', label: '已完结', accent: 'success' },
  { key: 'finished', field: 'finishedCount', label: '已完成', accent: 'success' }
]

/** 报表明细字典（文档已给出） */
const REPORT_STATUS_MAP: Record<number, string> = { 1: '待签收', 2: '已签收', 3: '拒绝', 4: '完成建表' }
const REPORT_METHOD_MAP: Record<number, string> = { 1: '常态报表', 2: '临时报表' }
/** 国家任务状态码 → 文案（接口返回 code，按下发字典映射） */
const TASK_STATUS_MAP: Record<number, string> = {
  0: '待提交',
  1: '待审核', 2: '待审核', 3: '待审核', 4: '待审核', 5: '待审核',
  6: '审核驳回', 7: '审核驳回', 8: '审核驳回', 9: '审核驳回', 10: '审核驳回',
  11: '待转发',
  12: '已转发', 13: '已转发',
  14: '填报中',
  15: '已终止',
  16: '已过期',
  17: '本周期已完结',
  18: '已完结',
  19: '任务提交撤回',
  20: '填报数据提交撤回',
  21: '待提交',
  22: '待下发',
  23: '审核驳回',
  24: '任务变更',
  25: '退回待审核',
  26: '待转发',
  27: '审核驳回',
  28: '已撤回',
  29: '已退回',
  30: '已转发',
  31: '待审核',
  32: '审核驳回',
  33: '已完结',
  100: '待签收',
  101: '待上报',
  102: '已上报',
  103: '审核驳回',
  1001: '数据上报中',
  1002: '数据上报失败',
  1003: '数据审核中',
  1004: '审核失败'
}

/**
 * 任务状态展示值
 * 后端已返回翻译好的 statusName 时直接使用，否则回退到 status code 映射
 */
function taskStatusText(item: Record<string, unknown>): string {
  const name = item.statusName
  if (name !== null && name !== undefined && String(name).trim() !== '') return String(name)
  return TASK_STATUS_MAP[Number(item.status)] ?? text(item.status)
}

/** 各实体分类分布的候选字段名（文档未逐一列出，做容错取值） */
const CATEGORY_KEYS: Record<string, string[]> = {
  ren: ['bqData'],
  fang: ['fwjzqkData', 'fwjzlxData'],
  qi: ['qylxData', 'qyData', 'fwlxData'],
  changsuo: ['cslxData']
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function scaleFromRegion(region: string[]): number {
  const key = region.join('-')
  const h = hashString(key)
  return 0.6 + (h % 80) / 100 // 0.6 ~ 1.4
}

/** 空值 → '--' */
function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY
  return value.toLocaleString()
}

/** 计数取值：缺失按 0 处理（用于参与计算的数值） */
function toCount(value: number | null | undefined): number {
  return typeof value === 'number' && !Number.isNaN(value) ? value : 0
}

/** 万级格式化：≥10000 → 'x.x万' */
function wan(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()
}

/** 标签总数封顶 65：超过 65 显示 '65类'，<=65 正常；无效值返回 null（走回退逻辑） */
function clampTagTotal(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return `${Math.min(n, 65)}类`
}

/** 访问量格式化 */
function visits(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿次`
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万次`
  return `${value.toLocaleString()}次`
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY
  return String(value)
}

/** 字典值原样展示：接口返回什么就显示什么，缺失显示 -- */
function raw(value: unknown): string | number {
  if (value === null || value === undefined || value === '') return EMPTY
  return typeof value === 'number' ? value : String(value)
}

/** 时间戳/日期字符串 → yyyy-MM-dd HH:mm */
function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === '') return EMPTY
  const ms = toTimeMs(value)
  if (!Number.isNaN(ms)) {
    const d = new Date(ms)
    const p = (x: number) => String(x).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  const str = String(value).trim()
  return str || EMPTY
}

/** 取日期部分（兼容时间戳） */
function dateOnly(value: unknown): string {
  const full = formatDateTime(value)
  return full === EMPTY ? EMPTY : full.split(' ')[0]
}

/** 填报率字符串 → 数字，缺失返回 null */
function toRate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).replace(/%/g, '').trim()
  const n = Number(normalized)
  return Number.isNaN(n) ? null : n
}

function parseCategorySource(source: unknown): unknown[] {
  if (Array.isArray(source)) return source
  if (typeof source !== 'string' || !source.trim()) return []
  try {
    const parsed = JSON.parse(source)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 数组长度对齐 */
function fitLength(source: number[], length: number): number[] {
  if (length <= 0) return []
  if (source.length >= length) return source.slice(0, length)
  const out: number[] = []
  for (let i = 0; i < length; i++) out.push(source[i % source.length])
  return out
}

/** 从对象里按候选 key 取数字 */
function pickNum(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const v = source[key]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v)
  }
  return 0
}

/** 从对象里按候选 key 取字符串 */
function pickStr(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = source[key]
    if (typeof v === 'string' && v !== '') return v
    if (typeof v === 'number') return String(v)
  }
  return ''
}

/** 分类分布数组 → 图表数据 */
function toCategoryList(source: unknown): Array<{ name: string; value: number }> {
  const list = parseCategorySource(source)
  if (!list.length) return []
  return list
    .map((item) => {
      const row = item as Record<string, unknown>
      const name = pickStr(row, ['bqtype', 'name', 'type', 'label', 'jzlx', 'cslx', 'qylx', 'bqmc'])
      const value = pickNum(row, ['bqdatacount', 'jzlxnum', 'value', 'count', 'num', 'dataCount'])
      return { name, value }
    })
    .filter((item) => item.name)
}

/** 取实体分类分布：优先用文档给出的字段名，取不到则用 dataTypeCount 里第一个数组字段 */
function pickCategoryArray(
  dataTypeCount: BasicDataCategoryCount,
  preferredKeys: string[]
): Array<{ name: string; value: number }> {
  for (const key of preferredKeys) {
    const list = toCategoryList((dataTypeCount as Record<string, unknown>)[key])
    if (list.length) return list
  }
  for (const value of Object.values(dataTypeCount)) {
    const list = toCategoryList(value)
    if (list.length) return list
  }
  return []
}

/** 任务是否临近截止（24 小时内） */
/** 时间戳/日期字符串 → 毫秒（解析失败返回 NaN） */
function toTimeMs(value: unknown): number {
  if (value === null || value === undefined || value === '') return Number.NaN
  const n = Number(value)
  if (n > 0 && Number.isFinite(n) && /^\d+$/.test(String(value).trim())) {
    return n >= 1e12 ? n : n * 1000
  }
  return new Date(String(value).trim().replace(/-/g, '/')).getTime()
}

function isUrgent(endTime: string): boolean {
  if (!endTime) return false
  const end = toTimeMs(endTime)
  if (Number.isNaN(end)) return false
  const diff = end - Date.now()
  return diff > 0 && diff <= 24 * 60 * 60 * 1000
}

function slicePage<T>(all: T[], pageNum: number, pageSize: number) {
  const start = (pageNum - 1) * pageSize
  return { list: all.slice(start, start + pageSize), total: all.length }
}

/* ------------------------------------------------------------------ *
 * 行结构（接口与 mock 统一成同一份结构，组件无需区分来源）
 * ------------------------------------------------------------------ */

export interface DeptRow {
  id: string | number
  name: string
  count: number
}

export interface ReportRow {
  name: string
  code: string
  dept: string
  version: string
  freq: string | number
  level: string | number
  receiveDept: string
  method: string
  time: string
  status: string
}

export interface TaskRow {
  name: string
  dept: string
  receiveTime: string
  receiveDept: string
  progress: string
  dataVolume: number | string
  deadline: string
  status: string
  urgent: boolean
}

/* ------------------------------------------------------------------ *
 * 区划
 * ------------------------------------------------------------------ */

export function useRegionData() {
  const selectedRegion = inject<Ref<string[]>>('selectedRegion', ref([]))
  const scaleVersion = inject<Ref<number>>('scaleVersion', ref(0))

  const scale = computed(() => scaleFromRegion(selectedRegion.value))
  const regionKey = computed(() => selectedRegion.value.join('-'))
  const regionDepth = computed(() => Math.min(3, Math.max(1, selectedRegion.value.length)))
  /** 当前选中区划代码（区划树节点的 regionCode） */
  const regionCode = computed(() => selectedRegion.value[selectedRegion.value.length - 1] ?? '')

  return { selectedRegion, scaleVersion, scale, regionKey, regionDepth, regionCode }
}

/* ------------------------------------------------------------------ *
 * 数据适配层：接口优先，无接口的模块保留本地 mock
 * ------------------------------------------------------------------ */

export function useScaledData() {
  const { scale, regionDepth } = useRegionData()
  const api = useDashboardApi()
  const useApi = apiConfig.useApi

  /* ---------------- 用户情况（2.1） ---------------- */

  const userOverview = computed(() => {
    const situation = api.userSituation.value
    const countyCoverage = {
      total: Math.round(baseOverview.countyCoverage.total * scale.value),
      covered: Math.round(baseOverview.countyCoverage.covered * scale.value),
      uncovered: Math.round(baseOverview.countyCoverage.uncovered * (1 + (1 - scale.value)))
    }
    // 街道/村社区覆盖率：接口提供 townshipCoverageRateVO / villageCoverageRateVO；
    // mock 模式下按区划缩放，保证切区划仍有演示效果
    const township = situation?.townshipCoverageRateVO
    const village = situation?.villageCoverageRateVO
    const coverage = {
      countyCoverage,
      townshipCoverage: useApi
        ? { total: toCount(township?.count), covered: toCount(township?.covered) }
        : {
            total: Math.round(baseOverview.townshipCoverage.total * scale.value),
            covered: Math.round(baseOverview.townshipCoverage.covered * scale.value)
          },
      villageCoverage: useApi
        ? { total: toCount(village?.count), covered: toCount(village?.covered) }
        : {
            total: Math.round(baseOverview.villageCoverage.total * scale.value),
            covered: Math.round(baseOverview.villageCoverage.covered * scale.value)
          }
    }

    if (!useApi) {
      return {
        totalUsers: Math.round(baseOverview.totalUsers * scale.value) as number | string,
        departmentUsers: Math.round(baseOverview.departmentUsers * scale.value) as number | string,
        grassrootsUsers: Math.round(baseOverview.grassrootsUsers * scale.value) as number | string,
        ...coverage
      }
    }

    return {
      totalUsers: num(situation?.totalUserCount),
      departmentUsers: num(situation?.departmentUserCount),
      grassrootsUsers: num(situation?.grassrootsUserCount),
      ...coverage
    }
  })

  /* ---------------- 用户层级分布（2.1 的三级计数） ---------------- */

  const userLevelData = computed(() => {
    if (useApi) {
      const situation = api.userSituation.value
      return {
        autonomous: situation?.autonomousRegionLevelCount ?? 0,
        city: situation?.leagueCityLevelCount ?? 0,
        county: situation?.bannerCountyLevelCount ?? 0
      }
    }
    return {
      autonomous: Math.round(baseLevel.autonomous * scale.value),
      city: Math.round(baseLevel.city * scale.value),
      county: Math.round(baseLevel.county * scale.value)
    }
  })

  /* ---------------- 按区域用户数 / 村社覆盖率（2.1 regionalBarStatsVOList） ---------------- */

  const userTrendData = computed(() => {
    const mockTrend = USER_TREND_MAP[regionDepth.value] ?? USER_TREND_MAP[1]

    if (useApi) {
      const list = api.userSituation.value?.regionalBarStatsVOList ?? []
      return {
        regions: list.map((item) => item.regionName),
        months: baseTrend.months,
        userCounts: list.map((item) => item.userCount ?? 0),
        coverageRates: list.some((item) => toRate(item.rate) !== null)
          ? list.map((item) => toRate(item.rate) ?? 0)
          : fitLength(mockTrend.coverageRates, list.length)
      }
    }

    return {
      regions: REGION_AXIS_MAP[regionDepth.value],
      months: baseTrend.months,
      userCounts: mockTrend.userCounts,
      coverageRates: mockTrend.coverageRates
    }
  })

  /* ---------------- 用户部门分布（2.2，接口分页） ---------------- */

  const toDeptRow = (item: { id: string; deptName: string; accountCount: number }): DeptRow => ({
    id: item.id,
    name: text(item.deptName),
    count: item.accountCount ?? 0
  })

  const mockDeptRows = (): DeptRow[] =>
    baseDept.map((item) => ({
      id: item.id,
      name: item.name,
      count: Math.max(5, Math.round(item.count * scale.value))
    }))

  /** 面板内的 Top 部门列表 */
  const deptTopList = computed<DeptRow[]>(() => {
    if (useApi) return (api.deptTopPage.value?.data ?? []).map(toDeptRow)
    return mockDeptRows().slice(0, 6)
  })

  /** 部门分布分页查询（弹窗用） */
  const fetchDeptUserPage = async (
    pageNum: number,
    pageSize: number
  ): Promise<{ list: DeptRow[]; total: number }> => {
    if (!useApi) return slicePage(mockDeptRows(), pageNum, pageSize)
    const result = await api.fetchDeptUserPage(pageNum, pageSize)
    // 后端 total 返回的是字符串，需转成数字，否则 el-pagination 会判定为未传值而不渲染
    return { list: (result?.data ?? []).map(toDeptRow), total: Number(result?.total ?? 0) }
  }

  /* ---------------- 报表统计（2.3） ---------------- */

  const buildStatusCards = () => {
    const stats = api.reportStats.value as unknown as Record<string, unknown> | null
    if (!stats) return []
    // 区划下钻到盟市/旗县（非自治区）时，不展示「待签收」「待上报」
    const HIDDEN_BELOW_AUTONOMOUS = new Set(['pendingSign', 'pendingReport'])
    return STATUS_CARD_DEFS.filter((def) => {
      if (regionDepth.value > 1 && HIDDEN_BELOW_AUTONOMOUS.has(def.key)) return false
      const value = stats[def.field]
      return value !== null && value !== undefined
    }).map((def) => ({
      key: def.key,
      label: def.label,
      value: stats[def.field] as number,
      accent: def.accent
    }))
  }

  const buildDistribution = () => {
    const list = api.reportStats.value?.departmentDistributionList ?? []
    const hasReport = list.some((item) => item.reportCount !== null && item.reportCount !== undefined)
    const hasTask = list.some((item) => item.taskCount !== null && item.taskCount !== undefined)

    const series: Array<{ name: string, data: number[], color: [string, string] }> = []
    if (hasReport) {
      series.push({
        name: '报表数',
        data: list.map((item) => item.reportCount ?? 0),
        color: ['rgba(64,158,255,0.2)', '#409eff']
      })
    }
    if (hasTask) {
      series.push({
        name: '任务数',
        data: list.map((item) => item.taskCount ?? 0),
        color: ['rgba(93,211,158,0.2)', '#5dd39e']
      })
    }

    return {
      categories: list.map((item) => item.deptName),
      legend: series.map((item) => item.name),
      series
    }
  }

  const reportData = computed(() => {
    const mock = REPORT_CONFIG[regionDepth.value] ?? REPORT_CONFIG[1]
    if (!useApi) return mock

    const stats = api.reportStats.value
    return {
      national: {
        reportTotal: num(stats?.reportTotalCount),
        taskTotal: num(stats?.taskTotalCount),
        // 数据总量按原始数字展示，不做「万」级换算
        quantityTotal: num(stats?.dataTotalCount),
        // 服务端已按登录用户层级过滤（null 字段剔除），前端按返回动态渲染
        statusCards: buildStatusCards(),
        distribution: buildDistribution()
      },
      // 自治区报表 tab 无对应接口，保留本地 mock
      autonomous: mock.autonomous
    }
  })

  /* ---------------- 报表明细 / 任务明细（2.4、2.5） ---------------- */

  const toReportRow = (item: Record<string, unknown>): ReportRow => ({
    name: text(item.reportName),
    code: text(item.reportCode),
    dept: text(item.dispatchDeptName),
    version: text(item.reportVersion),
    freq: text(item.updateFrequencyName || item.updateFrequency),
    level: text(item.fillLevelName || item.fillLevel),
    receiveDept: text(item.recvDeptName),
    // 下发方式：distributionMethod 1-常态报表 2-临时报表
    method: REPORT_METHOD_MAP[Number(item.distributionMethod)] ?? text(item.distributionMethod),
    time: dateOnly(item.createTime || item.receiveTime),
    status: REPORT_STATUS_MAP[item.status as number] ?? EMPTY
  })

  const toTaskRow = (item: Record<string, unknown>): TaskRow => ({
    name: text(item.taskName),
    dept: text(item.issueDeptName),
    // 接口无「接收时间」字段，暂用 startTime
    receiveTime: formatDateTime(item.startTime),
    receiveDept: text(item.recvDeptName),
    progress: text(item.completeCondition),
    dataVolume: (item.dataCount as number) ?? 0,
    deadline: dateOnly(item.endTime),
    status: taskStatusText(item),
    urgent: isUrgent(String(item.endTime ?? ''))
  })

  /**
   * 明细列表查询
   * - 自治区报表/任务：无接口，本地 mock 前端分页
   * - 国家报表：接口返回全量，前端分页
   * - 国家任务：接口分页
   */
  const fetchDetailList = async (options: {
    tab: 'national' | 'autonomous'
    type: 'report' | 'task'
    pageNum: number
    pageSize: number
  }): Promise<{ list: unknown[]; total: number }> => {
    const { tab, type, pageNum, pageSize } = options

    if (tab === 'autonomous') {
      const all = type === 'report' ? autonomousReportDetailList : autonomousTaskDetailList
      return slicePage(all as unknown[], pageNum, pageSize)
    }

    if (type === 'report') {
      if (!useApi) return slicePage(reportDetailList as unknown[], pageNum, pageSize)
      const list = await api.fetchReportList()
      return slicePage(list.map((item) => toReportRow(item as unknown as Record<string, unknown>)), pageNum, pageSize)
    }

    if (!useApi) return slicePage(taskDetailList as unknown[], pageNum, pageSize)
    const result = await api.fetchTaskPage(pageNum, pageSize)
    return {
      list: (result?.data ?? []).map((item) => toTaskRow(item as unknown as Record<string, unknown>)),
      total: Number(result?.total ?? 0)
    }
  }

  /* ---------------- 数据填报率（2.6） ---------------- */

  const fillRateData = computed(() => {
    if (!useApi) return { ...baseFillRate }
    const rate = api.fillRate.value
    return {
      autonomous: toRate(rate?.autonomousRegionFillRate),
      city: toRate(rate?.leagueCityFillRate),
      county: toRate(rate?.bannerCountyFillRate),
      township: toRate(rate?.townshipFillRate),
      village: toRate(rate?.villageFillRate)
    }
  })

  /* ---------------- 人房企场所（2.11） ---------------- */

  const buildEntity = (key: string, item: BasicDataItem | undefined, fallback: Record<string, unknown>) => {
    if (!item) {
      return {
        ...fallback,
        axisLabels: fallback.axisLabels as string[],
        typeStats: fallback.typeStats as Array<{ name: string; value: number }>,
        pieGroups: [] as Array<{ title: string; data: Array<{ name: string; value: number }> }>
      }
    }

    const regionList = item.regionList ?? []
    const dataTypeCount = item.dataTypeCount ?? {}
    const primary = pickCategoryArray(dataTypeCount, CATEGORY_KEYS[key] ?? [])

    // 房屋有两个分布环
    const pieGroups: Array<{ title: string; data: Array<{ name: string; value: number }> }> = []
    if (key === 'fang') {
      const statusList = toCategoryList((dataTypeCount as Record<string, unknown>).fwjzqkData)
      const typeList = toCategoryList((dataTypeCount as Record<string, unknown>).fwjzlxData)
      if (statusList.length) pieGroups.push({ title: '居住状态分布', data: statusList })
      if (typeList.length) pieGroups.push({ title: '房屋类型分布', data: typeList })
    } else if (primary.length) {
      const title = key === 'ren' ? '主要标签分布情况' : key === 'qi' ? '企业类型分布情况' : '场所类型分布情况'
      pieGroups.push({ title, data: primary })
    }

    return {
      total: wan(item.dataCount),
      // 标签总数封顶 65：超过 65 显示 65，<=65 正常显示
      tagTotal: clampTagTotal(dataTypeCount.bqCount) ?? (primary.length ? `${Math.min(primary.length, 65)}类` : EMPTY),
      governanceTrend: regionList.map((row) => row.dataCount ?? 0),
      completionRates: regionList.map((row) => Math.round(Number.parseFloat(row.dataRegionCommunityRatio) || 0)),
      axisLabels: regionList.map((row) => row.regionName),
      cloudWords: primary,
      typeStats: primary,
      pieGroups
    }
  }

  const entityData = computed(() => {
    const mock = baseEntity as unknown as Record<string, Record<string, unknown>>

    if (!useApi) {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(mock)) {
        result[key] = {
          ...value,
          axisLabels: REGION_AXIS_MAP[regionDepth.value],
          governanceTrend: (value.governanceTrend as number[])
            .slice(0, REGION_AXIS_MAP[regionDepth.value].length)
            .map((v) => Math.round(v * scale.value)),
          completionRates: (value.completionRates as number[]).map((v) =>
            Math.min(98, Math.max(50, Math.round(v * (0.8 + scale.value * 0.2))))
          ),
          pieGroups: []
        }
      }
      return result
    }

    const overview = api.basicData.value
    return {
      ren: buildEntity('ren', overview?.population, mock.ren),
      fang: buildEntity('fang', overview?.house, mock.fang),
      qi: buildEntity('qi', overview?.company, mock.qi),
      changsuo: buildEntity('changsuo', overview?.venue, mock.changsuo)
    }
  })

  /* ---------------- 系统使用情况（2.7、2.8、2.9） ---------------- */

  /** 查询周期 → 趋势数组 */
  const pickTrend = () => {
    const trend = api.accessTrend.value
    if (!trend) return { dates: [] as string[], visits: [] as number[] }
    const type = api.accessTimeType.value
    if (type === 'month') {
      const day = trend.day ?? []
      return { dates: day.map((item) => item.date), visits: day.map((item) => item.num) }
    }
    if (type === 'quarter') {
      const quarter = trend.quarter ?? []
      return { dates: quarter.map((item) => item.month), visits: quarter.map((item) => item.num) }
    }
    if (type === 'year') {
      const year = trend.year ?? []
      return { dates: year.map((item) => item.month), visits: year.map((item) => item.num) }
    }
    const week = trend.week ?? []
    return { dates: week.map((item) => item.date), visits: week.map((item) => item.num) }
  }

  const systemUsageAll = computed(() => {
    if (!useApi) {
      return {
        total: baseSysAll.total as string,
        dailyActive: baseSysAll.dailyActive as string,
        dates: baseSysAll.dates,
        visits: baseSysAll.visits.map((v) => Math.round(v * scale.value))
      }
    }
    const trend = pickTrend()
    // 总访问量取 getReportStats 的 totalAccessNum，未返回时回退 accessLoginNum.totalVisits
    const totalAccess = api.reportStats.value?.totalAccessNum
    return {
      total: totalAccess !== null && totalAccess !== undefined
        ? visits(totalAccess)
        : visits(api.accessLoginNum.value?.totalVisits),
      dailyActive: num(api.accessLoginNum.value?.dailyActiveCount),
      dates: trend.dates,
      visits: trend.visits
    }
  })

  const systemUsageCity = computed(() => {
    if (!useApi) {
      return {
        cities: baseSysCity.cities,
        visits: baseSysCity.visits.map((v) => Math.round(v * scale.value))
      }
    }
    const list = api.accessList.value?.regionInfo ?? []
    return {
      cities: list.map((item) => pickStr(item as Record<string, unknown>, ['regionName']) || EMPTY),
      visits: list.map((item) => pickNum(item as Record<string, unknown>, [
        'visitNum', 'visitCount', 'visits', 'accessCount', 'accessNum', 'useNum', 'useCount', 'num', 'count', 'totalVisits'
      ]))
    }
  })

  const systemUsageDept = computed(() => {
    if (!useApi) {
      return {
        departments: baseSysDept.departments,
        visits: baseSysDept.visits.map((v) => Math.round(v * scale.value))
      }
    }
    const list = api.accessList.value?.organInfo ?? []
    return {
      departments: list.map((item) => pickStr(item as Record<string, unknown>, ['organName', 'deptName', 'name', 'orgName']) || EMPTY),
      visits: list.map((item) => pickNum(item as Record<string, unknown>, [
        'visitNum', 'visitCount', 'visits', 'accessCount', 'totalAccessNum', 'useNum', 'useCount', 'num', 'count', 'loginNum', 'totalVisits'
      ]))
    }
  })

  /* ---------------- 无接口模块：始终本地 mock ---------------- */

  const rootDatabase = computed(() => ({ ...baseRootDb }))

  const backflowData = computed(() => baseBackflow.map((item) => ({ ...item })))

  const politicalLegalData = computed(() => ({ ...basePolitical }))

  /* 场景弹窗数据（无接口，保留本地 mock） */
  const sceneData = computed(() => sceneDataMock)

  return {
    // 用户情况
    userOverview,
    userTrendData,
    userLevelData,
    deptTopList,
    fetchDeptUserPage,
    // 报表
    reportData,
    fetchDetailList,
    // 填报率
    fillRateData,
    // 人房企场所
    entityData,
    // 系统使用情况
    systemUsageAll,
    systemUsageCity,
    systemUsageDept,
    // 无接口模块
    rootDatabase,
    backflowData,
    politicalLegalData,
    sceneData
  }
}
