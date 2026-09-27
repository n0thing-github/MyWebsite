/**
 * 做题现场的校验与恢复（摸底 / 刷题 / 模考共用）
 *
 * 为什么单独抽一层：
 *   三个视图各自写过一遍"从 sessions 里恢复现场"，校验规则却不一样 ——
 *   刷题只比对 mode，摸底当初压根没保存，模考把 phase 判断写在组件里。
 *   恢复现场属于"要么完全正确、要么别恢复"的事：一个错位的 index 会让用户
 *   以为自己的答案被吞了。规则收在一处，既能单测，也保证三个视图行为一致。
 *
 * 约定：现场里 expect 之外的字段**原样保留**（模考的 endAt / scope 依赖这点）。
 */

/** 恢复时会被规范化处理的字段，其余字段透传 */
const CANONICAL = ['ids', 'index', 'responses', 'checkedIds']

/** 把 index 钳进合法范围；非法值（缺失、NaN、负数、越界）一律落到边界上 */
function clampIndex(raw, len) {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.min(len - 1, Math.max(0, n))
}

/** 只保留 key 仍存在于 ids 里的条目（题目被删掉后，作答不该继续占位） */
function pickKeys(source, allowed) {
  const out = {}
  if (!source || typeof source !== 'object') return out
  for (const [k, v] of Object.entries(source)) {
    if (allowed.has(k)) out[k] = v
  }
  return out
}

/**
 * 构造一份全新的现场（字段顺序固定，便于比对与调试）
 * @param {{ids?:string[], index?:number, responses?:object, checkedIds?:string[]}} fields
 */
export function createSession({ ids = [], index = 0, responses = {}, checkedIds = [], ...rest } = {}) {
  return {
    ...rest,
    ids: [...ids],
    index,
    responses: { ...responses },
    checkedIds: [...checkedIds],
  }
}

/**
 * 校验并规范化一份已保存的现场。
 *
 * @param {object|null} saved 来自 store.readSession 的原始数据
 * @param {object} [opts]
 * @param {object} [opts.expect] 必须严格相等的字段，例如 { mode:'today' } / { exam:'H12-821' }
 * @param {(id:string)=>boolean} [opts.isKnownId] 判断题目是否还在题库里，返回 false 的 id 会被丢弃
 * @returns {object|null} 归一化后的现场；**任何一处不满足都返回 null**
 *   （宁可不恢复、当成新的一轮，也不要恢复出一个错位的现场）
 */
export function restoreSession(saved, { expect = {}, isKnownId } = {}) {
  if (!saved || typeof saved !== 'object') return null
  if (!Array.isArray(saved.ids)) return null

  for (const [key, value] of Object.entries(expect)) {
    if (saved[key] !== value) return null
  }

  const ids = isKnownId
    ? saved.ids.filter((id) => typeof id === 'string' && isKnownId(id))
    : saved.ids.filter((id) => typeof id === 'string')
  if (!ids.length) return null

  const allowed = new Set(ids)
  const out = { ...saved }
  for (const key of CANONICAL) delete out[key]

  return {
    ...out,
    ids,
    index: clampIndex(saved.index, ids.length),
    responses: pickKeys(saved.responses, allowed),
    checkedIds: Array.isArray(saved.checkedIds) ? saved.checkedIds.filter((id) => allowed.has(id)) : [],
  }
}
