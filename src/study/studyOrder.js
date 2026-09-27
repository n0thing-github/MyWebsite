import { DOMAIN_PREREQUISITES, getDomains, getExam, normalizedWeights } from '../data/hcip/examConfig'

/**
 * 建议学习顺序
 *
 * 单纯"弱项优先"会把 BGP 排在 IGP 前面，而 BGP 的大半概念建立在 IGP 之上，
 * 学起来事倍功半。所以采用两层排序：
 *   1. 先按**依赖关系**做拓扑排序（前置域必须先学）
 *   2. 同一层内按**加权弱项**降序（权重高且掌握度低的先学）
 *
 * 这是一个**稳定**排序：依赖不冲突时不会因为掌握度抖动而频繁换序，
 * 避免用户看到"建议顺序"每次刷新都变。
 */

/** 拓扑排序：返回满足前置关系的域 id 数组 */
export function topoOrder(examCode) {
  const exam = getExam(examCode)
  const ids = getDomains(examCode).map((d) => d.id)
  const prereq = DOMAIN_PREREQUISITES[exam.key] || {}
  const visited = new Set()
  const out = []

  function visit(id, stack) {
    if (visited.has(id)) return
    // 依赖表若有环（手工编辑配置时可能误写），直接跳过，绝不无限递归
    if (stack.has(id)) return
    stack.add(id)
    for (const p of prereq[id] || []) {
      if (ids.includes(p)) visit(p, stack)
    }
    stack.delete(id)
    visited.add(id)
    out.push(id)
  }

  for (const id of ids) visit(id, new Set())
  return out
}

/**
 * 给出有序的域列表（含建议理由）。
 * @param {object} domainStats useStudyStore 的 domainStats
 * @param {Record<string, number>} diagnosticScore 摸底分域得分 0–100（可空）
 */
export function suggestedOrder(examCode, domainStats, diagnosticScore) {
  const exam = getExam(examCode)
  const domains = getDomains(examCode)
  const weights = normalizedWeights(examCode)
  const base = topoOrder(examCode)

  // 每个域一个"优先级分数"：权重越高、掌握度越低 → 分数越高
  const score = (id) => {
    const cell = domainStats?.[id]
    const mastery = cell?.touched ? cell.mastery : diagnosticScore?.[id] ?? 50
    const w = weights[id] ?? 0
    return w * (1 + (100 - mastery) / 100)
  }

  // 在拓扑序允许的范围内做稳定排序：
  // 从头扫描，把"没有未处理前置"的域里分数最高的挑出来。
  const remaining = new Set(base)
  const done = new Set()
  const out = []
  const prereq = DOMAIN_PREREQUISITES[exam.key] || {}

  while (remaining.size) {
    const ready = [...remaining].filter((id) =>
      (prereq[id] || []).every((p) => !remaining.has(p) || done.has(p)),
    )
    const pool = ready.length ? ready : [...remaining]
    pool.sort((a, b) => score(b) - score(a))
    const pick = pool[0]
    remaining.delete(pick)
    done.add(pick)
    const cell = domainStats?.[pick]
    const mastery = cell?.touched ? cell.mastery : diagnosticScore?.[pick] ?? 50
    out.push({
      id: pick,
      name: domains.find((d) => d.id === pick)?.name || pick,
      weight: weights[pick] ?? 0,
      mastery,
      reason:
        mastery < 50
          ? '基础薄弱，建议优先补'
          : mastery < 70
            ? '掌握一般，稳扎稳打'
            : '掌握较好，可快速过一遍',
    })
  }
  return out
}
