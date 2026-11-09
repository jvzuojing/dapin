// 区域级联数据
export const regionOptions = [
  {
    value: 'neimenggu',
    label: '内蒙古自治区',
    children: [
      {
        value: 'huhehaote',
        label: '呼和浩特市',
        children: [
          { value: 'xincheng', label: '新城区' },
          { value: '回民', label: '回民区' },
          { value: '玉泉', label: '玉泉区' },
          { value: '赛罕', label: '赛罕区' },
          { value: '土默特左', label: '土默特左旗' },
          { value: '托克托', label: '托克托县' },
          { value: '和林格尔', label: '和林格尔县' },
          { value: '清水河', label: '清水河县' },
          { value: '武川', label: '武川县' }
        ]
      },
      {
        value: 'baotou',
        label: '包头市',
        children: [
          { value: 'kunlun', label: '昆都仑区' },
          { value: 'qingshan', label: '青山区' },
          { value: 'donghe', label: '东河区' },
          { value: 'jiuyuan', label: '九原区' },
          { value: 'baogang', label: '包头市稀土高新区' }
        ]
      },
      {
        value: 'wulanqab',
        label: '乌兰察布市',
        children: [
          { value: '集宁', label: '集宁区' },
          { value: 'zhuozishan', label: '卓资县' },
          { value: 'xinghe', label: '兴和县' }
        ]
      }
    ]
  }
]

// 用户情况 - 概览
export const userOverview = {
  totalUsers: 79725,
  departmentUsers: 21212,
  grassrootsUsers: 21212,
  countyCoverage: {
    total: 5244,
    covered: 4321,
    uncovered: 450
  },
  townshipCoverage: {
    total: 1041,
    covered: 1041
  },
  villageCoverage: {
    total: 13942,
    covered: 13942
  }
}

// 用户层级分布（自治区级/盟市级/旗县区级）
export const userLevelData = {
  autonomous: 678,
  city: 2234,
  county: 4321
}

// 用户数+村社覆盖率（按区域统计）
export const userTrendData = {
  months: ['2025-06', '2025-07', '2025-08'],
  regions: ['呼和浩特', '包头', '呼伦贝尔', '兴安盟', '通辽', '赤峰', '锡林郭勒', '乌兰察布', '鄂尔多斯', '巴彦淖尔', '乌海', '阿拉善'],
  userCounts: [2000, 1500, 900, 700, 1100, 1300, 600, 800, 1200, 750, 450, 350],
  coverageRates: [92, 88, 76, 70, 74, 80, 62, 72, 85, 68, 66, 58]
}

// 用户部门分布
export const departmentList = [
  { id: 1, name: '新城区民政局', count: 60 },
  { id: 2, name: '新城区社会保障局', count: 50 },
  { id: 3, name: '新城区应急管理局', count: 40 },
  { id: 4, name: '新城区医疗保障局', count: 30 },
  { id: 5, name: '新城区邮政公司', count: 20 },
  { id: 6, name: '新城区公安局', count: 55 },
  { id: 7, name: '新城区司法局', count: 25 },
  { id: 8, name: '新城区财政局', count: 35 },
  { id: 9, name: '新城区教育局', count: 45 },
  { id: 10, name: '新城区卫健委', count: 52 },
  { id: 11, name: '新城区住建局', count: 38 },
  { id: 12, name: '新城区交通局', count: 28 },
  { id: 13, name: '新城区生态环境局', count: 22 },
  { id: 14, name: '新城区水务局', count: 18 },
  { id: 15, name: '新城区农牧林业局', count: 32 },
  { id: 16, name: '新城区文旅局', count: 15 },
  { id: 17, name: '新城区市场监管局', count: 42 },
  { id: 18, name: '新城区统计局', count: 12 },
  { id: 19, name: '新城区退役军人事务局', count: 20 },
  { id: 20, name: '新城区信访局', count: 16 }
]

// 报表数据
export const reportData = {
  national: {
    reportTotal: 32,
    taskTotal: 40,
    quantityTotal: '120000',
    pendingSign: 2,
    pendingDestroy: 4,
    specialReport: 0,
    rejecting: 1,
    completed: 26,
    distribution: [
      { name: '住房城乡建设部', value: 12, taskCount: 15 },
      { name: '中华全国总工会', value: 7, taskCount: 9 },
      { name: '农业农村部', value: 2, taskCount: 3 },
      { name: '人力资源社会保障部', value: 11, taskCount: 13 },
      { name: '民政部', value: 1, taskCount: 2 },
      { name: '卫健委', value: 2, taskCount: 2 },
      { name: '团中央', value: 7, taskCount: 8 },
      { name: '其他', value: 1, taskCount: 1 }
    ]
  },
  autonomous: {
    reportTotal: 0,
    taskTotal: 0,
    quantityTotal: '0',
    pendingSign: 0,
    pendingDestroy: 0,
    specialReport: 0,
    rejecting: 0,
    completed: 0,
    distribution: [
      { name: '自治区民政厅', value: 0, taskCount: 0 },
      { name: '自治区人社厅', value: 0, taskCount: 0 },
      { name: '自治区卫健委', value: 0, taskCount: 0 },
      { name: '自治区住建厅', value: 0, taskCount: 0 },
      { name: '自治区农牧厅', value: 0, taskCount: 0 },
      { name: '其他', value: 0, taskCount: 0 }
    ]
  }
}

// 报表明细列表（点击报表总数查看详情）
const reportBase = [
  { name: '【总工会】工会阵地运行状况摸底表', code: '019fb001', dept: '中华全国总工会机关', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区总工会', method: '临时报表', time: '2026-07-31', status: '已建表' },
  { name: '【总工会】工会阵地治理帮扶表', code: '019fb002', dept: '中华全国总工会机关', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区总工会', method: '临时报表', time: '2026-07-31', status: '已建表' },
  { name: '【团中央】新兴领域团的建设表', code: '019fb003', dept: '中国共产主义青年团中央', version: 'V1', freq: '不定期', level: '县（区）级', receiveDept: '中国共产主义青年团', method: '临时报表', time: '2026-08-03', status: '待签收' },
  { name: '【团中央】新兴领域团的建设表（二）', code: '019fb004', dept: '中国共产主义青年团中央', version: 'V1', freq: '不定期', level: '县（区）级', receiveDept: '中国共产主义青年团', method: '临时报表', time: '2026-08-03', status: '待签收' },
  { name: '人社部《被征地农民社会保障情况表》', code: '019f5001', dept: '人力资源社会保障部', version: 'V1', freq: '每半年', level: '街镇', receiveDept: '内蒙古自治区人社厅', method: '常态报表', time: '2026-07-15', status: '已签收' },
  { name: '【应急管理部】应急救援力量摸底表', code: '019f5002', dept: '应急部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区应急厅', method: '常态报表', time: '2026-07-15', status: '已签收' },
  { name: '【应急管理部】应急救援力量摸底表（二）', code: '019f5003', dept: '应急部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区应急厅', method: '常态报表', time: '2026-07-15', status: '已签收' },
  { name: '【应急管理部】应急救援力量摸底表（三）', code: '019f5004', dept: '应急部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区应急厅', method: '常态报表', time: '2026-07-15', status: '已签收' },
  { name: '【应急管理部】应急救援力量摸底表（四）', code: '019f5005', dept: '应急部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区应急厅', method: '常态报表', time: '2026-07-15', status: '已签收' },
  { name: '【住建部】城市更新行动摸底表', code: '019f5006', dept: '住房城乡建设部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区住建厅', method: '常态报表', time: '2026-07-20', status: '已签收' },
  { name: '【住建部】保障性住房建设情况表', code: '019f5007', dept: '住房城乡建设部', version: 'V1', freq: '每半年', level: '县（区）级', receiveDept: '内蒙古自治区住建厅', method: '常态报表', time: '2026-07-20', status: '已签收' },
  { name: '【农业农村部】乡村振兴帮扶表', code: '019f5008', dept: '农业农村部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区农牧厅', method: '常态报表', time: '2026-07-22', status: '已签收' },
  { name: '【民政部】养老服务设施摸底表', code: '019f5009', dept: '民政部', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区民政厅', method: '常态报表', time: '2026-07-25', status: '已签收' },
  { name: '【卫健委】基层卫生服务能力表', code: '019f5010', dept: '卫健委', version: 'V1', freq: '每年', level: '县（区）级', receiveDept: '内蒙古自治区卫健委', method: '常态报表', time: '2026-07-28', status: '已签收' }
]

export const reportDetailList = Array.from({ length: 32 }, (_, i) => ({
  ...reportBase[i % reportBase.length]
}))

// 任务明细列表（点击任务总数查看详情）
const taskBase = [
  { name: '【全国妇联】各省区市妇女儿童情况摸底表', dept: '中国妇联', receiveTime: '2026-07-08 16:26:18', receiveDept: '内蒙古自治区妇女联合会', progress: '0/0', dataVolume: 0, deadline: '2026-07-31', status: '待签收', urgent: false },
  { name: '【全国妇联】各省区市妇女儿童情况摸底表（二）', dept: '中国妇联', receiveTime: '2026-07-08 16:26:18', receiveDept: '内蒙古自治区妇女联合会', progress: '0/0', dataVolume: 0, deadline: '2026-07-31', status: '待签收', urgent: false },
  { name: '【团中央】“共青团伙伴计划”情况摸底表', dept: '中国共产主义青年团中央', receiveTime: '2026-07-06 16:26:24', receiveDept: '中国共产主义青年团内蒙古委员会', progress: '0/0', dataVolume: 0, deadline: '2099-12-31', status: '待签收', urgent: false },
  { name: '深化农村集体“三资”管理案例摸底表', dept: '农业农村部', receiveTime: '2026-07-03 17:01:12', receiveDept: '内蒙古自治区农牧厅', progress: '0/1', dataVolume: 0, deadline: '2026-07-15', status: '待填报', urgent: false },
  { name: '综治中心数据表', dept: '内蒙古自治区人力资源社会保障厅', receiveTime: '2026-07-01 11:48:03', receiveDept: '内蒙古自治区劳动人事争议调解中心', progress: '0/0', dataVolume: 0, deadline: '2026-07-07', status: '待审核', urgent: false },
  { name: '综治中心数据表', dept: '人力资源社会保障部', receiveTime: '2026-07-01 11:14:20', receiveDept: '内蒙古自治区人力资源信息中心', progress: '0/15', dataVolume: 3, deadline: '2026-07-10', status: '待填报', urgent: true },
  { name: '乡镇（街道）消防监督执法情况摸底表', dept: '应急部', receiveTime: '2026-07-01 01:47:32', receiveDept: '内蒙古自治区消防救援总队', progress: '0/12', dataVolume: 0, deadline: '2026-07-16', status: '待填报', urgent: false },
  { name: '【共青团中央】《全国青年志愿服务情况》摸底表', dept: '中国共产主义青年团中央', receiveTime: '2026-06-18 14:37:17', receiveDept: '中国共产主义青年团内蒙古委员会', progress: '1/1', dataVolume: 1, deadline: '2026-07-03', status: '已上报', urgent: false },
  { name: '【住建部】-完整社区建设信息摸底表', dept: '住房城乡建设部', receiveTime: '2026-06-15 16:02:53', receiveDept: '内蒙古自治区住房和城乡建设厅', progress: '0/17', dataVolume: 0, deadline: '2026-07-15', status: '待填报', urgent: false },
  { name: '中央专项彩票公益金支持低收入群体摸底表', dept: '中国妇联', receiveTime: '2026-06-15 14:54:08', receiveDept: '内蒙古自治区妇女联合会', progress: '0/13', dataVolume: 0, deadline: '2026-08-30', status: '待填报', urgent: false }
]

export const taskDetailList = Array.from({ length: 40 }, (_, i) => ({
  ...taskBase[i % taskBase.length]
}))

// 自治区报表明细列表（无接口，按 0 口径展示）
export const autonomousReportDetailList: Array<{
  ownerDept: string
  tableName: string
  period: string
  dataVolume: number
  level: string
  provinceCount: number
  provinceUpdate: string
  cityCount: number
  cityUpdate: string
  countyCount: number
  countyUpdate: string
}> = []

// 自治区任务明细列表（无接口，按 0 口径展示）
export const autonomousTaskDetailList: Array<{
  name: string
  relatedTable: string
  scope: string
  period: string
  periodStart: string
  periodEnd: string
  progress: string
  status: string
}> = []

// 基础特色场景弹窗数据
export const sceneData = {
  totalData: '234万',
  dataTime: '2026年8月4日',
  baseScenes: [
    { name: '人口', value: 21345 },
    { name: '房屋', value: 21345 },
    { name: '企业', value: 21345 },
    { name: '场所', value: 21345 }
  ],
  extendScenes: Array.from({ length: 14 }, () => ({ name: '场景名称1', value: 21345 })),
  otherScenes: ['信息总览', '人口变动监测', '安全生产', '经济困难老年人补贴', '畜牧养殖场巡检']
}

// 数据填报率（三角形雷达）
export const fillRateData = {
  autonomous: 60,
  city: 70,
  county: 60,
  township: 50,
  village: 65
}

// 人房企场所 数据
export const entityData = {
  ren: {
    total: '884.8万',
    tagTotal: '50类',
    governanceTrend: [200, 220, 260, 280, 250, 310, 280, 320, 350, 330, 340, 360],
    completionRates: [70, 72, 75, 78, 80, 82, 79, 85, 88, 86, 90, 92],
    cloudWords: [
      { name: '残疾人', value: 200 },
      { name: '养老', value: 180 },
      { name: '实名认证', value: 160 },
      { name: '低保', value: 140 },
      { name: '就业', value: 120 },
      { name: '医生', value: 100 },
      { name: '学历', value: 90 },
      { name: '残疾等级', value: 85 },
      { name: '养老保险', value: 80 },
      { name: '医疗保险', value: 75 },
      { name: '儿童', value: 70 },
      { name: '老人', value: 65 },
      { name: '妇女', value: 60 },
      { name: '流动人口', value: 55 },
      { name: '常住人口', value: 50 }
    ],
    typeStats: [
      { name: '常住人口', value: 320 },
      { name: '流动人口', value: 186 },
      { name: '低保人员', value: 96 },
      { name: '残疾人', value: 74 },
      { name: '老年人', value: 152 },
      { name: '儿童', value: 88 },
      { name: '党员', value: 65 },
      { name: '退役军人', value: 42 }
    ]
  },
  fang: {
    total: '320.5万',
    tagTotal: '45类',
    governanceTrend: [150, 170, 190, 210, 200, 230, 220, 250, 270, 260, 280, 300],
    completionRates: [65, 68, 72, 74, 76, 78, 75, 82, 84, 83, 88, 90],
    cloudWords: [
      { name: '房屋类型', value: 180 },
      { name: '建筑面积', value: 150 },
      { name: '产权人', value: 130 },
      { name: '居住状态', value: 120 },
      { name: '租赁', value: 100 },
      { name: '抵押', value: 85 },
      { name: '危房', value: 70 },
      { name: '商住两用', value: 60 },
      { name: '宅基地', value: 55 },
      { name: '安置房', value: 50 }
    ],
    typeStats: [
      { name: '住宅', value: 210 },
      { name: '商住两用', value: 64 },
      { name: '商业用房', value: 52 },
      { name: '宅基地', value: 45 },
      { name: '安置房', value: 30 },
      { name: '危房', value: 12 }
    ]
  },
  qi: {
    total: '15.8万',
    tagTotal: '38类',
    governanceTrend: [50, 60, 75, 85, 90, 100, 95, 110, 120, 130, 140, 150],
    completionRates: [60, 65, 70, 72, 75, 78, 76, 82, 85, 84, 88, 91],
    cloudWords: [
      { name: '企业类型', value: 160 },
      { name: '统一社会信用代码', value: 140 },
      { name: '法人代表', value: 120 },
      { name: '经营范围', value: 100 },
      { name: '注册资本', value: 90 },
      { name: '成立日期', value: 80 },
      { name: '经营状态', value: 75 },
      { name: '行业分类', value: 65 },
      { name: '纳税信用', value: 55 }
    ],
    typeStats: [
      { name: '个体工商户', value: 86 },
      { name: '有限责任公司', value: 42 },
      { name: '国有企业', value: 12 },
      { name: '私营企业', value: 58 },
      { name: '外资企业', value: 8 },
      { name: '合作社', value: 22 }
    ]
  },
  changsuo: {
    total: '12.3万',
    tagTotal: '32类',
    governanceTrend: [40, 55, 65, 75, 80, 88, 92, 100, 110, 115, 120, 125],
    completionRates: [58, 62, 68, 70, 73, 76, 75, 80, 83, 82, 86, 89],
    cloudWords: [
      { name: '场所类型', value: 150 },
      { name: '场所名称', value: 130 },
      { name: '地址', value: 110 },
      { name: '负责人', value: 100 },
      { name: '联系电话', value: 85 },
      { name: '经营面积', value: 70 },
      { name: '员工人数', value: 60 },
      { name: '是否特种设备', value: 50 }
    ],
    typeStats: [
      { name: '商超门店', value: 66 },
      { name: '餐饮场所', value: 54 },
      { name: '学校幼儿园', value: 24 },
      { name: '医疗机构', value: 18 },
      { name: '养老机构', value: 10 },
      { name: '娱乐场所', value: 16 }
    ]
  }
}

// 系统使用情况 - 全部（趋势折线图）
export const systemUsageAll = {
  total: '207万次',
  dailyActive: '79725',
  dates: ['7月3日', '7月4日', '7月5日', '7月6日', '7月7日', '7月8日'],
  visits: [140, 100, 130, 143, 144, 142]
}

// 系统使用情况 - 按地市
export const systemUsageCity = {
  cities: ['呼市', '包头', '鄂市', '赤峰', '通辽', '呼伦贝尔', '巴彦淖尔', '乌兰察布', '兴安盟', '锡林郭勒', '阿拉善'],
  visits: [280, 240, 210, 200, 180, 178, 173, 160, 150, 145, 140]
}

// 系统使用情况 - 按部门
export const systemUsageDept = {
  departments: ['部门1', '部门2', '部门3', '部门4', '部门5', '部门6', '部门7', '部门8', '部门9', '部门10'],
  visits: [260, 230, 200, 190, 175, 165, 160, 155, 145, 130]
}

// 数据使用情况 - 一表通根数据库
export const rootDatabase = {
  departments: 16,
  categories: 65,
  dataVolume: '15.42亿条'
}

// 回流情况
export const backflowData = [
  { label: '人口数据', value: '3147万条' },
  { label: '企业数据', value: '311万条' },
  { label: '房屋地址数据', value: '1273万条' },
  { label: '高频标签数据', value: '1.8亿条' }
]

// 政法委系统对接
export const politicalLegalData = {
  tags: { value: '1.6亿条', label: '标签' },
  population: { value: '3147万条', label: '人口基础' },
  house: { value: '1273万条', label: '房屋' },
  relation: { value: '1679万条', label: '人房关联' }
}
