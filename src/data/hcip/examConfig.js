/**
 * HCIP-Datacom 考试与考纲域配置
 *
 * 【重要】这里的域权重（weight）是**待复核的估计值**，不是官方原文。
 * 本次实现时官方大纲 PDF 抓取失败，第三方大纲页只返回了导航模板，
 * 因此权重按公开资料与常见备考结构估算，并统一标注 confidence: 'estimated'。
 *
 * 你拿到官方大纲后，**只需要改这个文件**，无需改任何代码：
 *   · weight  —— 各域占比，同一门考试内总和必须归一到 1
 *   · hours   —— 参考学时，用于估算总工作量
 * 页面会读取 confidence 并在界面上标注「待复核」，改完自动生效。
 *
 * 备考顺序（已确认）：先 H12-821，完成后再切 H12-831。
 */

/** 域之间的学习依赖：前者是后者的基础。用于「建议学习顺序」排序。 */
export const DOMAIN_PREREQUISITES = {
  '821': {
    igp: [],
    bgp: ['igp'],
    'route-policy': ['igp', 'bgp'],
    switching: [],
    multicast: ['igp'],
    vpn: ['bgp', 'route-policy'],
    'network-mgmt': [],
    ipv6: ['igp'],
    mpls: ['igp', 'bgp'],
  },
  '831': {
    'igp-advanced': ['igp'],
    'bgp-advanced': ['bgp'],
    'route-control': ['route-policy', 'bgp'],
    switching: [],
    'vxlan-dc': ['bgp', 'switching'],
    reliability: ['igp', 'bgp'],
    'network-automation': [],
    'network-management': ['network-mgmt'],
    troubleshooting: ['igp', 'bgp', 'switching'],
  },
}

export const EXAMS = {
  'H12-821': {
    code: 'H12-821',
    key: '821',
    name: 'HCIP-Datacom-Core Technology',
    shortName: '核心技术',
    // 顺序：先考这门
    order: 1,
    confidence: 'estimated',
    /**
     * 参考规模。realQuestionCount 仅用于展示"真实考试规模"，
     * 我们的题库以 moduleCount 计（每题 1 分）。
     * 通过线与时长按公开资料填写，同样待复核。
     */
    realQuestionCount: 60,
    durationMinutes: 90,
    passScore: 600,
    totalScore: 1000,
    domains: [
      { id: 'igp', name: 'IGP 高级特性', weight: 0.17, hours: 10, topics: ['OSPF 状态机与 LSA', 'OSPF 特殊区域', 'IS-IS 基础与配置', '路由汇总与缺省'] },
      { id: 'bgp', name: 'BGP 高级特性', weight: 0.18, hours: 12, topics: ['BGP 邻居与报文', '选路规则', '路由反射器与联盟', '属性与过滤'] },
      { id: 'route-policy', name: '路由策略与流量控制', weight: 0.11, hours: 8, topics: ['ACL / IP-Prefix', 'Filter-Policy', 'Route-Policy', 'MQC 与 PBR'] },
      { id: 'switching', name: '交换技术', weight: 0.12, hours: 8, topics: ['VLAN 与 QinQ', 'STP / RSTP / MSTP', '链路聚合', '堆叠与 Eth-Trunk'] },
      { id: 'multicast', name: '组播技术', weight: 0.1, hours: 7, topics: ['IGMP', 'PIM-DM / PIM-SM', 'RP 与 MSDP', '组播路由表'] },
      { id: 'vpn', name: 'VPN 技术', weight: 0.11, hours: 8, topics: ['GRE', 'IPSec VPN', 'L2TP', 'DSVPN'] },
      { id: 'network-mgmt', name: '网络管理与准入', weight: 0.07, hours: 5, topics: ['SNMP', 'NTP / Syslog', 'AAA 与 NAC', 'DHCP 高级'] },
      { id: 'ipv6', name: 'IPv6 基础', weight: 0.08, hours: 6, topics: ['地址与报文', 'NDP', 'IPv6 路由', '过渡技术'] },
      { id: 'mpls', name: 'MPLS 与 MPLS VPN', weight: 0.06, hours: 5, topics: ['MPLS 转发', 'LDP', 'MP-BGP', 'MPLS VPN 数据转发'] },
    ],
  },

  'H12-831': {
    code: 'H12-831',
    key: '831',
    name: 'HCIP-Datacom-Advanced Routing & Switching Technology',
    shortName: '高级路由交换',
    order: 2,
    confidence: 'estimated',
    realQuestionCount: 60,
    durationMinutes: 90,
    passScore: 600,
    totalScore: 1000,
    domains: [
      { id: 'igp-advanced', name: 'IGP 进阶与优化', weight: 0.13, hours: 8, topics: ['OSPF 快速收敛', 'OSPF 与 IS-IS 对比', '路由防环'] },
      { id: 'bgp-advanced', name: 'BGP 进阶与优化', weight: 0.16, hours: 10, topics: ['BGP 收敛优化', 'BGP 安全性', '大规模 BGP 设计'] },
      { id: 'route-control', name: '路由控制与选路', weight: 0.13, hours: 8, topics: ['路由匹配工具', '策略组合', '流量工程'] },
      { id: 'switching', name: '交换高级特性', weight: 0.12, hours: 8, topics: ['MSTP 优化', 'VLAN 聚合', 'DHCP Snooping 与 IPSG'] },
      { id: 'vxlan-dc', name: 'VXLAN 与数据中心', weight: 0.12, hours: 9, topics: ['VXLAN 原理', 'BGP EVPN', '分布式网关'] },
      { id: 'reliability', name: '网络可靠性与高可用', weight: 0.12, hours: 8, topics: ['VRRP', 'BFD', '链路与设备冗余', '双机热备'] },
      { id: 'network-automation', name: '网络自动化', weight: 0.1, hours: 7, topics: ['Python 基础', 'NETCONF / YANG', 'RESTful 与 iMaster NCE', 'Ansible'] },
      { id: 'network-management', name: '网络管理协议', weight: 0.06, hours: 4, topics: ['SNMP 进阶', 'Telemetry', '日志与监控'] },
      { id: 'troubleshooting', name: '故障排查与排错', weight: 0.06, hours: 5, topics: ['分层排查思路', '路由/交换典型故障', '抓包与调试命令'] },
    ],
  },
}

/** 备考顺序：按 order 升序 */
export const EXAM_SEQUENCE = Object.values(EXAMS)
  .sort((a, b) => a.order - b.order)
  .map((e) => e.code)

export function getExam(code) {
  return EXAMS[code] || EXAMS[EXAM_SEQUENCE[0]]
}

/** 返回该考试的域列表（浅拷贝，避免调用方误改配置） */
export function getDomains(code) {
  return getExam(code).domains.map((d) => ({ ...d }))
}

export function getDomain(code, domainId) {
  return getExam(code).domains.find((d) => d.id === domainId) || null
}

/** 权重归一化：容忍手工编辑时的舍入误差，也容忍填了百分数（如 17） */
export function normalizedWeights(code) {
  const domains = getDomains(code)
  const raw = domains.map((d) => (d.weight > 1 ? d.weight / 100 : d.weight))
  const sum = raw.reduce((a, b) => a + b, 0)
  const out = {}
  domains.forEach((d, i) => {
    out[d.id] = sum > 0 ? raw[i] / sum : 1 / domains.length
  })
  return out
}

/** 参考总学时 */
export function totalHours(code) {
  return getDomains(code).reduce((a, d) => a + (d.hours || 0), 0)
}

/** 按域权重切分题量：最大余数法，保证总和精确等于 count */
export function splitByWeight(code, count) {
  const w = normalizedWeights(code)
  const ids = Object.keys(w)
  const exact = ids.map((id) => w[id] * count)
  const floors = exact.map((v) => Math.floor(v))
  let remaining = count - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const result = floors.slice()
  for (let k = 0; k < order.length && remaining > 0; k += 1, remaining -= 1) {
    result[order[k].i] += 1
  }
  const out = {}
  ids.forEach((id, i) => {
    out[id] = result[i]
  })
  return out
}
