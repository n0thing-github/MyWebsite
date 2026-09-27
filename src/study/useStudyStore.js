import { reactive, ref, computed, shallowRef, watch } from 'vue'
import {
  EXAM_SEQUENCE,
  getDomains,
  getExam,
  normalizedWeights,
} from '../data/hcip/examConfig'
import {
  loadStateWithRecovery,
  saveState,
  probeStorage,
  loadBackupState,
  defaultState,
  defaultSettings,
  exportState,
  importState,
  compactLog,
  estimateSize,
} from './storage'
import { applyAnswer, isDue, masteryOf, priority, seedFromDiagnostic, INIT_STABILITY } from './memory'
import { toDateKey, today } from './dateUtil'

/**
 * 学习模块的**单一状态源**（模块级单例）
 *
 * 为什么用单例而不是 provide/inject：
 *   底部标签栏的 5 个视图是互斥切换的（同一时刻只挂载一个），
 *   用路由驱动、组件频繁卸载重建。状态必须活在组件之外，
 *   否则每次切标签进度都要重新从 localStorage 读一遍。
 *
 * 写盘策略：深度 watch + 合并写入（微任务里只写最后一次），
 * 避免答题时高频 setItem 卡住主线程。
 */

/* ============================================================
   题库的按需加载
   ============================================================ */

const bankCache = new Map()

/**
 * 动态加载种子题库。
 * 用 import() 而不是静态 import：题库是有体积的 JSON，
 * 静态引入会让所有访客（包括只看主页的人）都下载它。
 */
async function loadSeedQuestions(examCode) {
  if (bankCache.has(examCode)) return bankCache.get(examCode)
  let mod
  if (examCode === 'H12-821') {
    mod = await import('../data/hcip/bank-h12-821.json')
  } else if (examCode === 'H12-831') {
    mod = await import('../data/hcip/bank-h12-831.json')
  } else {
    mod = { default: [] }
  }
  const list = Array.isArray(mod.default) ? mod.default : []
  bankCache.set(examCode, list)
  return list
}

/* ============================================================
   状态
   ============================================================ */

/**
 * 启动即做一次带恢复的读取：主键被写坏时能自己回到上一份快照，
 * 而不是给用户一个空进度（那才是最伤人的失败模式）。
 */
const boot = loadStateWithRecovery()
const state = reactive(boot.state)

/** 本机存储是否真的能写（隐私模式、配额满、被清理过的环境当场为 false） */
const storageOk = ref(probeStorage())
/** null | 'bak' | 'failed'：本次启动是否发生过恢复 */
const recoveredFrom = ref(boot.recoveredFrom || null)
/** 是否存在可用的上一份快照（进度页据此显示「用快照恢复」） */
const hasBackup = ref(Boolean(boot.hasBackup))

/** 已加载的题目（种子 + 用户导入），按 exam 分桶 */
const questionsByExam = shallowRef({})
const bankStatus = ref('idle') // idle | loading | ready | error
const bankError = ref('')

/** 用户导入的题库（存内存 + state.imported 只记来源，题本身随 items 一起不持久化） */
const importedByExam = shallowRef({})
let importedLoaded = false

const currentExam = computed(() => state.activeExam || EXAM_SEQUENCE[0])

const settings = computed(() => state.settings)

function examQuestions(examCode = currentExam.value) {
  return questionsByExam.value[examCode] || []
}

const questions = computed(() => examQuestions())

const questionIndex = computed(() => {
  const map = new Map()
  for (const q of questions.value) map.set(q.id, q)
  return map
})

function getQuestion(qid) {
  return questionIndex.value.get(qid) || null
}

/* ============================================================
   写盘
   ============================================================ */

let flushQueued = false
let lastSaveOk = ref(true)

/**
 * flush 之后的回调（同步模块用它感知"本地又写了一次盘"）。
 * 用注册回调而不是让同步模块反向 import 本模块 —— 那样会形成循环依赖。
 */
let afterFlush = null
export function setAfterFlushHook(fn) {
  afterFlush = typeof fn === 'function' ? fn : null
}

/**
 * 日志压缩的落盘时机。
 *
 * deep watch 只要看到**引用变化**就会重新入队，所以如果 flush() 每次都把
 * state.log 换成"内容相同但引用不同"的新数组，就会形成
 * 写成 → watch 触发 → 再写成 的**无限微任务循环**，直接把页面卡死
 * （实测表现为 import 这个模块就永久挂起）。因此只在条数确实减少时才替换引用。
 */
function flush() {
  flushQueued = false

  const compacted = compactLog(state.log)
  if (compacted.length !== state.log.length) {
    state.log = compacted
  }

  lastSaveOk.value = saveState(state)
  if (afterFlush) afterFlush(lastSaveOk.value)
}

function queueFlush() {
  if (flushQueued) return
  flushQueued = true
  // 微任务合并：一次答题可能改动多个字段，只落一次盘
  Promise.resolve().then(flush)
}

watch(state, queueFlush, { deep: true })

// 页面隐藏/关闭前补一次写盘，降低移动端切后台丢数据的概率
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/* ============================================================
   题库加载
   ============================================================ */

export async function ensureBankLoaded(examCode = currentExam.value) {
  if (!examCode) return
  if (questionsByExam.value[examCode]?.length) return
  bankStatus.value = 'loading'
  bankError.value = ''
  try {
    const seed = await loadSeedQuestions(examCode)
    await loadImported(examCode)
    const merged = [...seed, ...(importedByExam.value[examCode] || [])]
    questionsByExam.value = { ...questionsByExam.value, [examCode]: merged }
    bankStatus.value = 'ready'
  } catch (err) {
    bankStatus.value = 'error'
    bankError.value = err?.message || String(err)
  }
}

/** 读取用户导入的题库（存独立的 localStorage 键，避免和进度数据相互拖累） */
const IMPORT_KEY_PREFIX = 'piusprime.hcip.import.'

async function loadImported(examCode) {
  if (importedLoaded && importedByExam.value[examCode]) return
  const out = {}
  if (typeof window !== 'undefined') {
    for (const code of EXAM_SEQUENCE) {
      try {
        const raw = window.localStorage.getItem(IMPORT_KEY_PREFIX + code)
        out[code] = raw ? JSON.parse(raw) : []
      } catch {
        out[code] = []
      }
    }
  }
  importedByExam.value = out
  importedLoaded = true
}

/** 覆盖式保存导入题库，并刷新合并列表；返回 false 表示没能写进本机存储 */
export function saveImported(examCode, list, meta) {
  importedByExam.value = { ...importedByExam.value, [examCode]: list }
  let ok = true
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(IMPORT_KEY_PREFIX + examCode, JSON.stringify(list))
    } catch {
      ok = false
      // 写不进去必须让上层看见：否则用户以为导入成功，刷新后题库却没了
      lastSaveOk.value = false
    }
  }
  if (meta) {
    state.imported = [
      ...state.imported.filter((i) => i.exam !== examCode || i.name !== meta.name),
      { ...meta, exam: examCode, at: new Date().toISOString() },
    ]
  }
  const seed = bankCache.get(examCode) || []
  questionsByExam.value = {
    ...questionsByExam.value,
    [examCode]: [...seed, ...list],
  }
  return ok
}

export function getImported(examCode = currentExam.value) {
  return importedByExam.value[examCode] || []
}

/* ============================================================
   派生：掌握度 / 进度
   ============================================================ */

const dateKey = ref(today())

/** 跨天时刷新（碎片时间使用常在第二天打开，日期不能停在昨天） */
export function refreshDay() {
  const t = today()
  if (t !== dateKey.value) dateKey.value = t
}

const domains = computed(() => getDomains(currentExam.value))
const weights = computed(() => normalizedWeights(currentExam.value))

/** 每道题的记忆状态（未接触的返回 null） */
function stateOf(qid) {
  return state.items[qid] || null
}

/** 该题是否已"接触过"（答过、或摸底种过） */
function touched(qid) {
  return Boolean(state.items[qid])
}

const masteredQuizIds = computed(() => Object.keys(state.items))

/** 每个域的掌握度与题量统计 */
const domainStats = computed(() => {
  const dk = dateKey.value
  const target = state.settings.targetRetention
  const out = {}
  for (const d of domains.value) {
    out[d.id] = {
      ...d,
      weight: weights.value[d.id] || 0,
      total: 0,
      touched: 0,
      unseen: 0,
      due: 0,
      mastery: 0,
      correct: 0,
      wrong: 0,
    }
  }
  for (const q of questions.value) {
    const cell = out[q.domain]
    if (!cell) continue
    cell.total += 1
    const st = state.items[q.id]
    if (st) {
      cell.touched += 1
      if (isDue(st, dk)) cell.due += 1
      if (st.lastResult === 'correct') cell.correct += 1
      if (st.lastResult === 'wrong') cell.wrong += 1
    } else {
      cell.unseen += 1
    }
  }
  // 掌握度：按该域已接触题目的保留率中位数
  for (const d of domains.value) {
    const cell = out[d.id]
    const states = questions.value
      .filter((q) => q.domain === d.id)
      .map((q) => state.items[q.id])
      .filter(Boolean)
    cell.mastery = states.length ? masteryOf(states, dk, target) : 0
  }
  return out
})

/**
 * 孤儿记录：items 里有、当前题库里却找不到的条目。
 *
 * 三个刻意的限制：
 *   · 只统计**打了当前考试标记**的记录 —— 另一门考试的题、以及旧数据里
 *     没有 exam 字段的记录都不算，否则会把有效进度整片误判成垃圾。
 *   · 题库没加载完（bankStatus !== 'ready'）时一律为空，那时所有题都"不存在"。
 *   · 只报告不自动删，删不删由用户在进度页决定。
 */
const orphanItems = computed(() => {
  if (bankStatus.value !== 'ready') return []
  const exam = currentExam.value
  const known = questionIndex.value
  return Object.keys(state.items).filter((id) => state.items[id]?.exam === exam && !known.has(id))
})

const progress = computed(() => {
  const total = questions.value.length
  const touchedCount = questions.value.filter((q) => touched(q.id)).length
  return {
    total,
    touched: touchedCount,
    unseen: total - touchedCount,
    rate: total ? touchedCount / total : 0,
    orphan: orphanItems.value.length,
  }
})

/** 清掉孤儿记录，返回删除条数（题库未就绪时不动手） */
export function pruneOrphans() {
  const ids = orphanItems.value
  if (!ids.length) return 0
  const next = { ...state.items }
  for (const id of ids) delete next[id]
  state.items = next
  return ids.length
}

/** 今日到期复习题（含逾期），按保留率升序 */
const dueQuestions = computed(() => {
  const dk = dateKey.value
  const target = state.settings.targetRetention
  return questions.value
    .filter((q) => {
      const st = state.items[q.id]
      return st && isDue(st, dk)
    })
    .map((q) => ({ q, p: priority(state.items[q.id], dk, target) }))
    .sort((a, b) => a.p - b.p)
    .map((x) => x.q)
})

/** 错题池：错过且已到期的题 */
const wrongQuestions = computed(() => {
  const dk = dateKey.value
  return questions.value.filter((q) => {
    const st = state.items[q.id]
    return st && st.lapses > 0 && isDue(st, dk)
  })
})

/** 未接触过的题，按考纲权重与摸底弱项排序 */
const unseenQueue = computed(() => {
  const stats = domainStats.value
  const score = (id) => {
    const cell = stats[id]
    if (!cell) return 0
    // 权重越大越先学；摸底掌握度越低越先学（diagnostic 缺失时按 50 中性处理）
    const mastery = cell.mastery || (state.diagnostic ? 0 : 50)
    return (cell.weight || 0) * (1 + (100 - mastery) / 100)
  }
  return questions.value
    .filter((q) => !touched(q.id))
    .slice()
    .sort((a, b) => score(b.domain) - score(a.domain))
})

/* ============================================================
   今日统计
   ============================================================ */

const todayLog = computed(() => {
  const dk = dateKey.value
  return state.log.find((e) => e.d === dk) || { d: dk, min: 0, new: 0, review: 0, correct: 0, wrong: 0, mock: 0 }
})

function bumpLog(patch) {
  const dk = dateKey.value
  let entry = state.log.find((e) => e.d === dk)
  if (!entry) {
    entry = { d: dk, min: 0, new: 0, review: 0, correct: 0, wrong: 0, mock: 0 }
    state.log.push(entry)
  }
  for (const [k, v] of Object.entries(patch)) {
    entry[k] = (entry[k] || 0) + v
  }
}

/* ============================================================
   动作
   ============================================================ */

/**
 * 记录一次作答。
 * @param {object} q 题目
 * @param {'correct'|'wrong'|'skip'} result
 * @param {{mode?:'new'|'review'|'mock'|'diagnostic', minutes?:number}} opts
 */
export function answerQuestion(q, result, opts = {}) {
  if (!q) return
  const dk = dateKey.value
  const target = state.settings.targetRetention
  const prev = state.items[q.id] || null
  const next = applyAnswer(prev, result, { dateKey: dk, target })
  // 打上考试标记：孤儿检测必须知道这条记录属于哪门考试
  state.items[q.id] = { ...next, exam: q.exam || currentExam.value }

  const mode = opts.mode || 'new'
  bumpLog({
    correct: result === 'correct' ? 1 : 0,
    wrong: result === 'wrong' ? 1 : 0,
    new: mode === 'new' ? 1 : 0,
    review: mode === 'review' ? 1 : 0,
    min: opts.minutes != null ? opts.minutes : 0,
  })
}

/** 只记时长（例如把"今天学了 20 分钟"补录进去） */
export function addStudyMinutes(minutes) {
  bumpLog({ min: Math.max(0, Math.round(minutes)) })
}

/**
 * 记录一次模考完成。
 * 单独开一个动作而不是复用 answerQuestion：模考需要累计 mock 次数
 * （用于"一周内是否已模考"的判断）并一次性记入耗时，
 * 而逐题 answerQuestion 会把时长按单题口径重复累加。
 */
export function recordMock({ minutes = 0, correct = 0, wrong = 0 } = {}) {
  bumpLog({
    mock: 1,
    min: Math.max(0, Math.round(minutes)),
    correct: Math.max(0, correct),
    wrong: Math.max(0, wrong),
  })
}

/** 保存摸底结果并给每道摸底题种下初始记忆状态 */
export function saveDiagnostic({ exam, domainScore, details, answers }) {
  const dk = dateKey.value
  const target = state.settings.targetRetention
  const correct = details.filter((d) => d.ok).length
  for (const d of details) {
    const q = getQuestion(d.id)
    if (!q) continue
    // 已有记忆状态的题不被摸底覆盖（用户可能已经学过一段时间）
    if (state.items[d.id]) continue
    state.items[d.id] = { ...seedFromDiagnostic(d.ok, dk, target), exam: q.exam || currentExam.value }
  }
  state.diagnostic = {
    completedAt: new Date().toISOString(),
    exam,
    domainScore,
    correct,
    total: details.length,
    answers: answers || {},
  }
}

export function clearDiagnostic() {
  state.diagnostic = null
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch }
}

export function switchExam(examCode) {
  if (examCode === state.activeExam) return
  state.activeExam = examCode
  // 切考试时清掉做题现场：题目变了，旧现场没有意义
  state.sessions = {}
  ensureBankLoaded(examCode)
}

export function setActiveExamIfEmpty() {
  if (!state.activeExam) state.activeExam = EXAM_SEQUENCE[0]
}

/** 保存/读取做题现场（刷新、切后台后恢复） */
export function saveSession(key, payload) {
  state.sessions = { ...state.sessions, [key]: payload }
}

export function readSession(key) {
  return state.sessions[key] || null
}

export function clearSession(key) {
  const next = { ...state.sessions }
  delete next[key]
  state.sessions = next
}

/* ============================================================
   备份与恢复
   ============================================================ */

/** 记下"刚刚把备份交到用户手里了"，进度页据此提醒多久没备份 */
export function markBackupDone() {
  state.meta = { ...state.meta, lastBackupAt: new Date().toISOString() }
}

export function doExport() {
  const text = exportState(state)
  // 导出即视为一次备份（下载/复制的成功与否由调用方处理，这里不做二次猜测）
  markBackupDone()
  return text
}

/** 用上一份快照覆盖当前进度（用户显式动作） */
export function restoreFromBak() {
  const bak = loadBackupState()
  if (!bak) return { ok: false, error: '没有可用的上一份快照' }
  Object.assign(state, bak.state)
  lastSaveOk.value = saveState(state)
  recoveredFrom.value = 'bak'
  return { ok: true, savedAt: bak.savedAt }
}

export function doImport(text) {
  const res = importState(text)
  if (!res.ok) return res
  Object.assign(state, res.state)
  // 导入后立刻落盘
  lastSaveOk.value = saveState(state)
  return res
}

export function resetAll() {
  const fresh = defaultState()
  fresh.activeExam = currentExam.value
  Object.assign(state, fresh)
  lastSaveOk.value = saveState(state)
  recoveredFrom.value = null
}

/* ============================================================
   对外
   ============================================================ */

export function useStudyStore() {
  return {
    // 原始状态
    state,
    settings,
    dateKey,
    // 题库
    questions,
    examQuestions,
    getQuestion,
    bankStatus,
    bankError,
    currentExam,
    domains,
    weights,
    // 派生
    domainStats,
    progress,
    dueQuestions,
    wrongQuestions,
    unseenQueue,
    todayLog,
    // 动作
    answerQuestion,
    addStudyMinutes,
    recordMock,
    saveDiagnostic,
    clearDiagnostic,
    updateSettings,
    switchExam,
    setActiveExamIfEmpty,
    saveSession,
    readSession,
    clearSession,
    doExport,
    doImport,
    restoreFromBak,
    pruneOrphans,
    markBackupDone,
    resetAll,
    refreshDay,
    ensureBankLoaded,
    saveImported,
    getImported,
    // 元信息
    saveOk: lastSaveOk,
    storageOk,
    recoveredFrom,
    hasBackup,
    storageBytes: computed(() => estimateSize(state)),
    examMeta: computed(() => getExam(currentExam.value)),
  }
}

export { EXAM_SEQUENCE, defaultSettings, INIT_STABILITY }
