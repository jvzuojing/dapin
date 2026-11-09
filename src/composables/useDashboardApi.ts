/**
 * 大屏接口数据源（单例）
 *
 * 只负责「怎么调接口、拿到什么原始数据」，不关心 mock，也不做页面结构适配。
 * 适配（把接口结构转成组件结构、无接口模块走 mock）统一在 useRegionData.ts 的 useScaledData() 里做。
 */
import { computed, ref } from 'vue'
import * as dashboardApi from '../api/dashboard'
import { NoPermissionError } from '../api/request'
import { apiConfig } from '../config/api'
import type {
  AccessListVO,
  AccessLoginNumVO,
  AccessTrendVO,
  BasicDataOverviewVO,
  DataFillRateVO,
  DeptUserEntity,
  FillCountVO,
  NationalReportVO,
  PageResult,
  RegionNode,
  RegionalBarStats,
  ReportStatsVO,
  TaskMonitorDTO,
  UserSituationVO
} from '../types/api'

/** 级联选择器选项 */
export interface RegionCascaderOption {
  value: string
  label: string
  children?: RegionCascaderOption[]
}

/* ------------------------------------------------------------------ *
 * 模块级单例状态（三个面板共享同一份数据）
 * ------------------------------------------------------------------ */

const regionCode = ref('')
const regionRoot = ref<RegionNode | null>(null)
const regionCascaderOptions = ref<RegionCascaderOption[]>([])

const userSituation = ref<UserSituationVO | null>(null)
/**
 * 地图用的「按区域覆盖率」（2.1 regionalBarStatsVOList：盟市名 + 村社覆盖率）
 * 只在根区划（自治区）加载时刷新并缓存，切到下级区划时保留，保证地图始终有 12 盟市数据
 */
const regionCoverage = ref<RegionalBarStats[]>([])
/**
 * 地图下钻用的「旗县区级覆盖率」
 * 切到盟市 / 旗县区时，接口若返回该层级的 regionalBarStatsVOList 就存这里；
 * 名称与 geojson 对不上时地图组件会自动过滤，只显示轮廓，不会串色
 */
const regionCountyCoverage = ref<RegionalBarStats[]>([])
const reportStats = ref<ReportStatsVO | null>(null)
/**
 * 新增 getFillCount：同一个接口用 isExtended 区分两类清单
 * false=自治区报表（AutonomousReportPanel），true=基层精简保留清单（SimplifyListPanel）
 * 请求失败保持 null，由面板回退演示数据
 */
const autonomousFillCount = ref<FillCountVO | null>(null)
const simplifyFillCount = ref<FillCountVO | null>(null)
const fillRate = ref<DataFillRateVO | null>(null)
const accessTrend = ref<AccessTrendVO | null>(null)
/** 地区使用情况（getAccessList queryType=region），点击「市级」tab 时才加载 */
const accessRegionList = ref<AccessListVO | null>(null)
/** 部门使用情况（getAccessList queryType=dept），点击「部门」tab 或打开部门访问弹窗时才加载 */
const accessDeptList = ref<AccessListVO | null>(null)
const accessList = computed<AccessListVO | null>(() => {
  if (!accessRegionList.value && !accessDeptList.value) return null
  return mergeAccessList(accessRegionList.value, accessDeptList.value)
})
const accessLoginNum = ref<AccessLoginNumVO | null>(null)
const basicData = ref<BasicDataOverviewVO | null>(null)
const deptTopPage = ref<PageResult<DeptUserEntity> | null>(null)
const regionDataLoading = ref(false)
const globalDataLoading = ref(false)
const accessTimeLoading = ref(false)

/** 系统使用情况「地区/部门」查询周期：'' 昨日 / week / month / quarter / year */
const accessTimeType = ref('week')

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null
}

function hasPermissionError(results: PromiseSettledResult<unknown>[]): boolean {
  return results.some(
    (r) => r.status === 'rejected' && r.reason instanceof NoPermissionError
  )
}

function getNodeGrade(node: RegionNode): number {
  const raw = node.grade ?? node.gdrade ?? ''
  const grade = Number(raw)
  return Number.isNaN(grade) ? 4 : grade
}

function trimRegionTree(node: RegionNode, maxDepth: number, depth = 1): RegionNode {
  const children =
    depth >= maxDepth ? [] : (node.childrens || []).map((child) => trimRegionTree(child, maxDepth, depth + 1))

  return {
    ...node,
    grade: String(getNodeGrade(node)),
    childrens: children
  }
}

function findRegionPath(node: RegionNode | null, code: string): string[] {
  if (!node || !code) return []
  if (node.regionCode === code) return [node.regionCode]

  for (const child of node.childrens || []) {
    const childPath = findRegionPath(child, code)
    if (childPath.length) return [node.regionCode, ...childPath]
  }

  return []
}

function toCascaderOption(node: RegionNode): RegionCascaderOption {
  const children = (node.childrens || []).map(toCascaderOption)
  return {
    value: node.regionCode,
    label: node.regionName,
    ...(children.length ? { children } : {})
  }
}

function mergeAccessList(
  regionRes: AccessListVO | null,
  deptRes: AccessListVO | null
): AccessListVO | null {
  if (!regionRes && !deptRes) return null

  return {
    organInfo: deptRes?.organInfo ?? regionRes?.organInfo ?? [],
    regionInfo: regionRes?.regionInfo ?? deptRes?.regionInfo ?? [],
    startDate: regionRes?.startDate ?? deptRes?.startDate ?? '',
    endDate: regionRes?.endDate ?? deptRes?.endDate ?? ''
  }
}

/* ------------------------------------------------------------------ *
 * 区划树
 * ------------------------------------------------------------------ */

/**
 * 初始化区划树（一次拉全树，默认到旗县区级）
 * @returns 默认选中的区划路径（根节点）
 */
export async function initRegionTree(): Promise<string[]> {
  const rawRoot = await dashboardApi.getRegionTree()
  const root = rawRoot ? trimRegionTree(rawRoot, Math.max(1, 5 - getNodeGrade(rawRoot))) : null
  regionRoot.value = root
  regionCascaderOptions.value = root ? [toCascaderOption(root)] : []
  return root ? findRegionPath(root, root.regionCode) : []
}

/* ------------------------------------------------------------------ *
 * 区划相关数据（带 regionCode 参数）
 * ------------------------------------------------------------------ */

/**
 * 加载与区划相关的数据
 * @returns 是否具备该区划权限（false 时调用方应回退区划选择）
 */
export async function loadRegionData(code: string): Promise<boolean> {
  regionCode.value = code
  // 区划变了，地区/部门使用情况需按新区划重新点击加载
  accessRegionList.value = null
  accessDeptList.value = null
  regionDataLoading.value = true
  try {
    const results = await Promise.allSettled([
      dashboardApi.getUserSituation(code),
      dashboardApi.getDataFillRate(code),
      dashboardApi.getDaPingBasicDataOverview(code),
      dashboardApi.getDeptUserCount(1, 6, code),
      // 自治区报表 / 基层精简保留清单：同一接口按 isExtended 取两份
      dashboardApi.getFillCount(code, false),
      dashboardApi.getFillCount(code, true)
    ])

    userSituation.value = settledValue(results[0] as PromiseSettledResult<UserSituationVO>)
    fillRate.value = settledValue(results[1] as PromiseSettledResult<DataFillRateVO>)
    basicData.value = settledValue(results[2] as PromiseSettledResult<BasicDataOverviewVO>)
    deptTopPage.value = settledValue(
      results[3] as PromiseSettledResult<PageResult<DeptUserEntity>>
    )
    autonomousFillCount.value = settledValue(results[4] as PromiseSettledResult<FillCountVO>)
    simplifyFillCount.value = settledValue(results[5] as PromiseSettledResult<FillCountVO>)

    // 自治区层只刷新并缓存全区 12 盟市覆盖率；下钻层另存一份供旗县区着色
    const situation = userSituation.value
    const isRoot = code === regionRoot.value?.regionCode
    if (isRoot) {
      if (situation?.regionalBarStatsVOList?.length) {
        regionCoverage.value = situation.regionalBarStatsVOList
      }
      regionCountyCoverage.value = []
    } else {
      regionCountyCoverage.value = situation?.regionalBarStatsVOList ?? []
    }

    // 区划权限判定只看原有 4 个接口，避免新增清单接口异常导致整个区划切换被回退
    return !hasPermissionError(results.slice(0, 4))
  } finally {
    regionDataLoading.value = false
  }
}

/* ------------------------------------------------------------------ *
 * 全局数据（按当前选中区划 regionCode 过滤）
 * ------------------------------------------------------------------ */

/** 加载报表统计、系统使用趋势等数据（带当前区划 regionCode） */
export async function loadGlobalData(): Promise<void> {
  const code = regionCode.value
  globalDataLoading.value = true
  try {
    const results = await Promise.allSettled([
      dashboardApi.getReportStats('country', code),
      dashboardApi.getAccessTrend(code),
      dashboardApi.getAccessLoginNum(code)
    ])

    reportStats.value = settledValue(results[0] as PromiseSettledResult<ReportStatsVO>)
    accessTrend.value = settledValue(results[1] as PromiseSettledResult<AccessTrendVO>)
    accessLoginNum.value = settledValue(results[2] as PromiseSettledResult<AccessLoginNumVO>)
  } finally {
    globalDataLoading.value = false
  }
}

/** 拉取单路使用情况并写入对应缓存 */
async function fetchAccessInto(type: 'region' | 'dept'): Promise<void> {
  try {
    const res = await dashboardApi.getAccessList(accessTimeType.value, type, regionCode.value)
    if (type === 'region') accessRegionList.value = res
    else accessDeptList.value = res
  } catch {
    if (type === 'region') accessRegionList.value = null
    else accessDeptList.value = null
  }
}

/** 点击「市级 / 部门」tab 时按需拉取对应的使用情况数据 */
export async function loadAccessList(type: 'region' | 'dept'): Promise<void> {
  if (!apiConfig.useApi) return
  accessTimeLoading.value = true
  try {
    await fetchAccessInto(type)
  } finally {
    accessTimeLoading.value = false
  }
}

/** 切换「地区/部门使用情况」的查询周期：只重拉已加载过的路，没点过 tab 的仍等点击 */
export async function setAccessTimeType(timeType: string): Promise<void> {
  accessTimeType.value = timeType
  const types: Array<'region' | 'dept'> = []
  if (accessRegionList.value) types.push('region')
  if (accessDeptList.value) types.push('dept')
  if (!types.length || !apiConfig.useApi) return
  accessTimeLoading.value = true
  try {
    await Promise.all(types.map((type) => fetchAccessInto(type)))
  } finally {
    accessTimeLoading.value = false
  }
}

/** 首次加载 */
export async function loadAll(code: string): Promise<void> {
  await Promise.allSettled([loadRegionData(code), loadGlobalData()])
}

/** 手动刷新：重拉当前区划的全部数据 */
export async function refreshAll(): Promise<void> {
  await loadAll(regionCode.value)
  // 当前不在自治区层时，地图覆盖率数据不会被 loadRegionData 刷新，单独补一次
  if (regionCode.value && regionCode.value !== regionRoot.value?.regionCode) {
    await loadRegionCoverage()
  }
}

/** 单独刷新地图覆盖率数据（按根区划取全区 12 盟市） */
export async function loadRegionCoverage(): Promise<void> {
  const rootCode = regionRoot.value?.regionCode
  if (!rootCode) return
  try {
    const res = await dashboardApi.getUserSituation(rootCode)
    if (res?.regionalBarStatsVOList?.length) {
      regionCoverage.value = res.regionalBarStatsVOList
    }
  } catch {
    /* 失败时保留上一次数据 */
  }
}

/* ------------------------------------------------------------------ *
 * 弹窗分页查询（纯接口调用，mock 回退由适配层决定）
 * ------------------------------------------------------------------ */

/** 用户部门分布统计（分页） */
export function fetchDeptUserPage(
  pageNum: number,
  pageSize: number
): Promise<PageResult<DeptUserEntity> | null> {
  return dashboardApi
    .getDeptUserCount(pageNum, pageSize, regionCode.value)
    .then((res) => res ?? null)
    .catch(() => null)
}

/** 国家报表列表（接口无分页，返回全量） */
export function fetchReportList(): Promise<NationalReportVO[]> {
  return dashboardApi
    .getReportListStats(regionCode.value)
    .then((res) => res ?? [])
    .catch(() => [] as NationalReportVO[])
}

/** 国家任务列表（分页） */
export function fetchTaskPage(
  pageNum: number,
  pageSize: number
): Promise<PageResult<TaskMonitorDTO> | null> {
  return dashboardApi
    .getNationalTaskList(pageNum, pageSize, 'country', regionCode.value)
    .then((res) => res ?? null)
    .catch(() => null)
}

/* ------------------------------------------------------------------ *
 * 对外
 * ------------------------------------------------------------------ */

export function useDashboardApi() {
  return {
    // 区划
    regionCode,
    regionRoot,
    regionCascaderOptions,
    getRegionPath: (code: string) => findRegionPath(regionRoot.value, code),
    initRegionTree,
    loadRegionData,
    // 主数据
    userSituation,
    regionCoverage,
    regionCountyCoverage,
    reportStats,
    autonomousFillCount,
    simplifyFillCount,
    fillRate,
    accessTrend,
    accessList,
    accessLoginNum,
    basicData,
    deptTopPage,
    accessTimeType,
    regionDataLoading,
    globalDataLoading,
    accessTimeLoading,
    // 加载 / 刷新
    loadGlobalData,
    loadAccessList,
    setAccessTimeType,
    loadAll,
    refreshAll,
    // 使用情况按需缓存（用于判断是否已加载）
    accessRegionList,
    accessDeptList,
    // 分页
    fetchDeptUserPage,
    fetchReportList,
    fetchTaskPage
  }
}
