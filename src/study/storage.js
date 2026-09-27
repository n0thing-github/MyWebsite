/**
 * 学习数据的本机持久化
 *
 * 为什么用 localStorage 而不是 IndexedDB：
 *   数据量小（预计 <300 KB），结构简单，同步读写让状态管理简单得多；
 *   站点是纯静态托管，没有后端，localStorage 的 5 MB 配额足够。
 *   代价：换设备/清缓存会丢 —— 因此提供导出/导入 JSON 备份。
 *
 * 健壮性要点：
 *   · 读写全部 try/catch：隐私模式或配额满时 localStorage 会抛异常，
 *     绝不能因此让整页崩掉，降级为"仅内存"继续用。
 *   · schemaVersion + migrate：以后结构变了能平滑升级，不丢用户进度。
 *   · 事件日志有上限并按月聚合，避免无界增长撑爆配额。
 */

const KEY = 'piusprime.hcip.v1'
export const SCHEMA_VERSION = 1

/** 事件日志上限：超过后把老数据按月聚合，只留汇总 */
export const MAX_LOG_ENTRIES = 400

export function defaultSettings() {
  return {
    dailyMinutes: 60,
    // 按星期微调：1=周一 … 7=周日；0 或缺失表示沿用 dailyMinutes
    weekdayMinutes: {},
    // 新学/复习配比策略
    stageStyle: 'balanced',
    // 每周自动安排一次整卷模考
    weeklyMock: true,
    // 到期目标保留率
    targetRetention: 0.8,
    // 用户明确跳过摸底测试（跳过就不每次再拦他，但可在进度页随时重做）
    diagnosticSkipped: false,
  }
}

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    activeExam: '',
    settings: defaultSettings(),
    items: {},
    diagnostic: null,
    log: [],
    sessions: {},
    imported: [],
  }
}

/** 安全读：任何异常都降级为 null */
function safeGet() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** 安全写：返回是否成功（配额满/隐私模式返回 false） */
function safeSet(state) {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}

/** 数值范围钳制，用于修复被手工编辑过的数据 */
const num = (v, lo, hi, fallback) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, n))
}

function normalizeSettings(raw) {
  const base = defaultSettings()
  if (!raw || typeof raw !== 'object') return base
  const weekday = {}
  if (raw.weekdayMinutes && typeof raw.weekdayMinutes === 'object') {
    for (const [k, v] of Object.entries(raw.weekdayMinutes)) {
      const day = Number(k)
      if (day >= 1 && day <= 7) weekday[day] = num(v, 5, 720, base.dailyMinutes)
    }
  }
  return {
    dailyMinutes: num(raw.dailyMinutes, 5, 720, base.dailyMinutes),
    weekdayMinutes: weekday,
    stageStyle: ['balanced', 'reviewFirst', 'newFirst'].includes(raw.stageStyle)
      ? raw.stageStyle
      : base.stageStyle,
    weeklyMock: raw.weeklyMock !== false,
    targetRetention: num(raw.targetRetention, 0.5, 0.95, base.targetRetention),
    diagnosticSkipped: raw.diagnosticSkipped === true,
  }
}

function normalizeItems(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [qid, st] of Object.entries(raw)) {
    if (!st || typeof st !== 'object') continue
    out[qid] = {
      stability: num(st.stability, 0.3, 365, 1.2),
      // 记忆强度的主状态：间隔阶梯级数。旧数据没有这个字段时置 null，
      // 由 memory.js 从 stability 反推（见 applyAnswer）
      step: st.step == null ? null : num(st.step, 0, 7, 0),
      reps: num(st.reps, 0, 9999, 0),
      lapses: num(st.lapses, 0, 9999, 0),
      lastResult: ['correct', 'wrong', 'skip'].includes(st.lastResult) ? st.lastResult : null,
      lastSeen: typeof st.lastSeen === 'string' ? st.lastSeen : '',
      due: typeof st.due === 'string' ? st.due : '',
      streak: num(st.streak, 0, 9999, 0),
    }
  }
  return out
}

function normalizeLog(raw) {
  if (!Array.isArray(raw)) return []
  const out = raw
    .filter((e) => e && typeof e === 'object' && typeof e.d === 'string')
    .map((e) => ({
      d: e.d,
      min: num(e.min, 0, 1440, 0),
      new: num(e.new, 0, 9999, 0),
      review: num(e.review, 0, 9999, 0),
      correct: num(e.correct, 0, 99999, 0),
      wrong: num(e.wrong, 0, 99999, 0),
      mock: num(e.mock, 0, 999, 0),
    }))
  return compactLog(out)
}

/**
 * 日志压缩：按日期合并同一天的多条记录，再裁到上限。
 * 保留最近 MAX_LOG_ENTRIES 天，避免长期使用后配额膨胀。
 */
export function compactLog(log) {
  const byDay = new Map()
  for (const e of log) {
    const cur = byDay.get(e.d)
    if (cur) {
      cur.min += e.min
      cur.new += e.new
      cur.review += e.review
      cur.correct += e.correct
      cur.wrong += e.wrong
      cur.mock += e.mock
    } else {
      byDay.set(e.d, { ...e })
    }
  }
  const merged = [...byDay.values()].sort((a, b) => (a.d < b.d ? -1 : 1))
  return merged.length > MAX_LOG_ENTRIES ? merged.slice(-MAX_LOG_ENTRIES) : merged
}

function normalizeDiagnostic(raw) {
  if (!raw || typeof raw !== 'object') return null
  const domainScore = {}
  if (raw.domainScore && typeof raw.domainScore === 'object') {
    for (const [k, v] of Object.entries(raw.domainScore)) {
      domainScore[k] = num(v, 0, 100, 0)
    }
  }
  return {
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : '',
    exam: typeof raw.exam === 'string' ? raw.exam : '',
    domainScore,
    correct: num(raw.correct, 0, 9999, 0),
    total: num(raw.total, 0, 9999, 0),
    answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
  }
}

/** 迁移：按 schemaVersion 逐级升级。目前只有 v1，保留框架 */
function migrate(raw) {
  let state = raw
  const v = Number(state.schemaVersion) || 0
  if (v < 1) {
    state = { ...defaultState(), ...state, schemaVersion: 1 }
  }
  return state
}

/** 读取并规范化整份状态 */
export function loadState() {
  const raw = safeGet()
  if (!raw) return defaultState()
  const migrated = migrate(raw)
  return {
    schemaVersion: SCHEMA_VERSION,
    activeExam: typeof migrated.activeExam === 'string' ? migrated.activeExam : '',
    settings: normalizeSettings(migrated.settings),
    items: normalizeItems(migrated.items),
    diagnostic: normalizeDiagnostic(migrated.diagnostic),
    log: normalizeLog(migrated.log),
    sessions: migrated.sessions && typeof migrated.sessions === 'object' ? migrated.sessions : {},
    imported: Array.isArray(migrated.imported) ? migrated.imported : [],
  }
}

/** 保存；返回 false 表示写失败（仅内存态可用） */
export function saveState(state) {
  return safeSet(state)
}

/** 导出为可读 JSON 字符串 */
export function exportState(state) {
  return JSON.stringify(
    {
      ...state,
      _exportedAt: new Date().toISOString(),
      _app: 'piusprime-hcip',
    },
    null,
    2,
  )
}

/**
 * 导入备份。返回 { ok, state, error }
 * 故意不复用 loadState 的宽松兜底：导入是显式动作，
 * 文件损坏要明确报错，而不是悄悄给一份空数据把进度覆盖掉。
 */
export function importState(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是合法的 JSON 文件' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: '文件内容不是对象' }
  }
  if (!parsed.items || typeof parsed.items !== 'object') {
    return { ok: false, error: '缺少 items 字段，可能不是本应用的备份' }
  }
  const merged = {
    ...defaultState(),
    ...parsed,
    schemaVersion: SCHEMA_VERSION,
    settings: normalizeSettings(parsed.settings),
    items: normalizeItems(parsed.items),
    log: normalizeLog(parsed.log),
    diagnostic: normalizeDiagnostic(parsed.diagnostic),
  }
  return { ok: true, state: merged }
}

/** 估算当前占用字节数，用于设置页展示 */
export function estimateSize(state) {
  try {
    return JSON.stringify(state).length
  } catch {
    return 0
  }
}
