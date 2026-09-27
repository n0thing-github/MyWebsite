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
/** 上一份"校验通过"的存档，主键被写坏时用来回滚 */
const BAK_KEY = 'piusprime.hcip.v1.bak'
/** 主键损坏时把原文挪到这里留档 —— 否则下一次写盘会把它当成快照轮转掉 */
const CORRUPT_KEY = 'piusprime.hcip.v1.corrupt'
/** 存储可用性探针（写完即删，不碰业务数据） */
const PROBE_KEY = 'piusprime.hcip.probe'
export const SCHEMA_VERSION = 1

/** 事件日志上限：超过后把老数据按月聚合，只留汇总 */
export const MAX_LOG_ENTRIES = 400

/**
 * djb2 校验和：用来识别"这份存档是不是被截断/改坏了"。
 * 自己写而不是引依赖 —— 需求只有"同样的输入给同样的短字符串"这一点，
 * 它不承担安全职责，只承担"完整性对不上就拒绝加载"。
 */
export function checksum(text) {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

/** 序列化成信封格式：在状态末尾追加 _savedAt 与 _checksum */
function pack(state) {
  const body = JSON.stringify({ ...state, _savedAt: new Date().toISOString() })
  // 直接把校验和拼进 JSON 文本尾部，省掉一次完整 stringify（数据量大时是实打实的开销）
  return `${body.slice(0, -1)},"_checksum":"${checksum(body)}"}`
}

/** 存档是否完整（旧版本没有 _checksum，按可信处理） */
function isIntact(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return false
    if (typeof parsed._checksum !== 'string') return true
    const { _checksum, ...rest } = parsed
    return checksum(JSON.stringify(rest)) === _checksum
  } catch {
    return false
  }
}

/**
 * 探测本机存储是否真的可写。
 * 隐私模式、配额满、微信清理过的环境会在这里当场暴露，
 * 而不是等用户答了半小时才发现什么都没存下。
 */
export function probeStorage() {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(PROBE_KEY, '1')
    const ok = window.localStorage.getItem(PROBE_KEY) === '1'
    window.localStorage.removeItem(PROBE_KEY)
    return ok
  } catch {
    return false
  }
}

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
    meta: defaultMeta(),
  }
}

/** 与备份/同步相关的小元数据；全部可选，旧存档没有就补默认值 */
export function defaultMeta() {
  return {
    /** 上一次导出备份的时间（ISO）；空串表示从没备份过 */
    lastBackupAt: '',
  }
}

function normalizeMeta(raw) {
  const base = defaultMeta()
  if (!raw || typeof raw !== 'object') return base
  return {
    lastBackupAt: typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt : base.lastBackupAt,
  }
}

/** 读任意键的原始字符串（损坏检测需要看原文，不能只拿解析结果） */
function safeGetRaw(key) {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
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
      // 这道题属于哪门考试。旧数据没有 —— 宁可留空（不参与孤儿统计），
      // 也不要靠 id 前缀去猜，导入题库的 id 是用户自己定的
      exam: typeof st.exam === 'string' ? st.exam : '',
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

/** 规范化整份状态（本地读取与导入备份共用同一条路径） */
function normalizeState(raw) {
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
    meta: normalizeMeta(migrated.meta),
  }
}

/** 读取并规范化整份状态 */
export function loadState() {
  return loadStateWithRecovery().state
}

/** 主键在、校验也过，但做题记录被整段抹掉了 —— 同样按损坏处理 */
function itemsWiped(raw, normalized) {
  const before = raw && raw.items && typeof raw.items === 'object' ? Object.keys(raw.items).length : 0
  return before > 0 && Object.keys(normalized.items).length === 0
}

/**
 * 读取状态，并在存档损坏时回滚到上一份快照。
 *
 * @returns {{ state: object, recoveredFrom: null|'bak'|'failed', hasBackup: boolean }}
 *   recoveredFrom: 'bak' = 已用快照恢复；'failed' = 主键与快照都不可用，只能给默认状态
 */
export function loadStateWithRecovery() {
  const raw = safeGetRaw(KEY)
  const bakRaw = safeGetRaw(BAK_KEY)
  const hasBackup = Boolean(bakRaw) && isIntact(bakRaw)

  // 主键不存在：可能是新用户，也可能是用户自己清空了。
  // 刻意**不**自动用快照 —— 「清空全部进度」必须一次就干净；
  // 想要快照的人可以在进度页手动「用快照恢复」。
  if (!raw) return { state: defaultState(), recoveredFrom: null, hasBackup }

  let parsed = null
  if (isIntact(raw)) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }

  if (parsed) {
    const state = normalizeState(parsed)
    if (!itemsWiped(parsed, state)) return { state, recoveredFrom: null, hasBackup }
  }

  // 主键坏了（或记录被洗空）：先把原文留档，否则下一次写盘会把它当成快照轮转掉
  try {
    window.localStorage.setItem(CORRUPT_KEY, raw)
  } catch {
    /* 留档失败不影响回滚 */
  }
  if (hasBackup) {
    try {
      return { state: normalizeState(JSON.parse(bakRaw)), recoveredFrom: 'bak', hasBackup: true }
    } catch {
      /* 快照也坏了，走下面的兜底 */
    }
  }
  return { state: defaultState(), recoveredFrom: 'failed', hasBackup }
}

/**
 * 读取存档信封（写入时间 + 校验和）。
 * 校验和就是这份数据的"版本号"：同步模块据此判断本地有没有新变化，
 * 不需要在响应式 state 里额外维护计数器（那样会在 flush 内触发深 watch 死循环）。
 */
export function readEnvelope() {
  const raw = safeGetRaw(KEY)
  if (!raw) return { savedAt: '', checksum: '' }
  try {
    const parsed = JSON.parse(raw)
    return {
      savedAt: typeof parsed._savedAt === 'string' ? parsed._savedAt : '',
      checksum: typeof parsed._checksum === 'string' ? parsed._checksum : '',
    }
  } catch {
    return { savedAt: '', checksum: '' }
  }
}

/** 手动读取上一份快照（进度页的「用快照恢复」） */
export function loadBackupState() {
  const bakRaw = safeGetRaw(BAK_KEY)
  if (!bakRaw || !isIntact(bakRaw)) return null
  try {
    const parsed = JSON.parse(bakRaw)
    return {
      state: normalizeState(parsed),
      savedAt: typeof parsed._savedAt === 'string' ? parsed._savedAt : '',
    }
  } catch {
    return null
  }
}

/**
 * 保存；返回 false 表示写失败（仅内存态可用）。
 *
 * 写入前会把"当前这份**校验通过**的主键"留作快照 —— 校验是刻意的：
 * 只有确认上一份是好数据，才值得覆盖现有快照。
 */
export function saveState(state) {
  if (typeof window === 'undefined') return false
  const previous = safeGetRaw(KEY)
  if (previous && isIntact(previous)) {
    try {
      window.localStorage.setItem(BAK_KEY, previous)
    } catch {
      /* 快照写不进去（配额满）不该挡住主写入 */
    }
  }
  try {
    window.localStorage.setItem(KEY, pack(state))
    return true
  } catch {
    return false
  }
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
    meta: normalizeMeta(parsed.meta),
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
