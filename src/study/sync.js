/**
 * 云同步的纯逻辑层（无网络、无 DOM）
 *
 * 同步的是**进度**，不是整个应用状态：sessions（设备内的做题现场）与
 * imported（导入的题库正文，体积大）刻意排除在外。
 *
 * 冲突策略一句话：**逐题取新，不整份覆盖**。
 * 两台设备都答过同一道题时，按 lastSeen 取较新的那条；日志按天逐字段取
 * 最大值而不是相加（相加会把同一天的学习时长算两遍）。
 */

export const SYNC_APP = 'piusprime-hcip'
export const PAYLOAD_VERSION = 1

/** 参与同步的字段（白名单，避免哪天 state 多了字段被悄悄同步出去） */
const SYNCED_KEYS = ['activeExam', 'settings', 'items', 'diagnostic', 'log', 'meta']

/** 时钟偏差容忍：远端只比本地新 2 秒以内，不认为"远端更新" */
const CLOCK_TOLERANCE_MS = 2000

const LOG_FIELDS = ['min', 'new', 'review', 'correct', 'wrong', 'mock']

/** 组装要写进远端的载荷 */
export function buildPayload(fullState, { deviceId = '', savedAt = '', checksum = '' } = {}) {
  const data = {}
  for (const key of SYNCED_KEYS) {
    if (fullState && fullState[key] !== undefined) data[key] = fullState[key]
  }
  return {
    app: SYNC_APP,
    payloadVersion: PAYLOAD_VERSION,
    deviceId,
    savedAt,
    checksum,
    data,
  }
}

/**
 * 校验远端内容。**宁可拒绝，也不把不认识的数据写进本地。**
 * @returns {{ok:true, payload:object} | {ok:false, error:string}}
 */
export function validatePayload(raw) {
  let parsed = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, error: '远端内容不是合法 JSON' }
    }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: '远端内容不是对象' }
  if (parsed.app !== SYNC_APP) return { ok: false, error: '远端内容不是本应用的同步数据' }
  if (Number(parsed.payloadVersion) !== PAYLOAD_VERSION) {
    return { ok: false, error: `同步数据版本不匹配（${parsed.payloadVersion}）` }
  }
  if (!parsed.data || typeof parsed.data !== 'object') return { ok: false, error: '同步数据缺少 data' }
  if (parsed.data.items && typeof parsed.data.items !== 'object') {
    return { ok: false, error: '同步数据里的 items 结构异常' }
  }
  return { ok: true, payload: parsed }
}

/** 远端是否比本地新（留 2 秒时钟偏差余量） */
export function isRemoteNewer(remoteSavedAt, localSavedAt) {
  const r = Date.parse(remoteSavedAt || '')
  const l = Date.parse(localSavedAt || '')
  if (Number.isNaN(r)) return false
  if (Number.isNaN(l)) return true
  return r - l > CLOCK_TOLERANCE_MS
}

/**
 * 决定这次同步该做什么。
 * @returns {'noop'|'merge'|'push'} noop=两边一样；merge=远端更新，先合并再推；push=本地更新，直接推
 */
export function decideSync({ localSavedAt = '', localChecksum = '', remote = null } = {}) {
  if (!remote) return 'push'
  if (remote.checksum && localChecksum && remote.checksum === localChecksum) return 'noop'
  return isRemoteNewer(remote.savedAt, localSavedAt) ? 'merge' : 'push'
}

/** 单题：远端是否比本地新（同日则看 reps，相同则保留本地） */
function isNewerItem(remote, local) {
  const rs = String(remote?.lastSeen || '')
  const ls = String(local?.lastSeen || '')
  if (rs !== ls) return rs > ls
  return (Number(remote?.reps) || 0) > (Number(local?.reps) || 0)
}

/**
 * 把远端数据合并进本地数据（不修改入参）。
 * @returns {{data:object, stats:{items:number, logDays:number, diagnostic:boolean}}}
 */
export function mergeData(localData = {}, remoteData = {}) {
  const stats = { items: 0, logDays: 0, diagnostic: false }
  const out = { ...localData }

  const items = { ...(localData.items || {}) }
  for (const [qid, remote] of Object.entries(remoteData.items || {})) {
    if (!remote || typeof remote !== 'object') continue
    const local = items[qid]
    if (!local) {
      items[qid] = remote
      stats.items += 1
    } else if (isNewerItem(remote, local)) {
      // 只覆盖远端真正更新的字段，local 里独有的（例如 exam 标记）保留
      items[qid] = { ...local, ...remote }
      stats.items += 1
    }
  }
  out.items = items

  // 日志按天逐字段取最大值：两台设备同一天都学过时，相加会把时长算两遍
  const byDay = new Map()
  for (const entry of [...(localData.log || []), ...(remoteData.log || [])]) {
    if (!entry || typeof entry.d !== 'string') continue
    const cur = byDay.get(entry.d)
    if (!cur) {
      byDay.set(entry.d, { ...entry })
      continue
    }
    for (const f of LOG_FIELDS) cur[f] = Math.max(Number(cur[f]) || 0, Number(entry[f]) || 0)
  }
  out.log = [...byDay.values()].sort((a, b) => (a.d < b.d ? -1 : 1))
  stats.logDays = out.log.length

  const ld = localData.diagnostic
  const rd = remoteData.diagnostic
  if (!ld && rd) {
    out.diagnostic = rd
    stats.diagnostic = true
  } else if (rd && String(rd.completedAt || '') > String(ld?.completedAt || '')) {
    out.diagnostic = rd
    stats.diagnostic = true
  }

  // 设置与考试是"这台设备的偏好"：本地优先，只有本地为空时才采纳远端
  if (!out.activeExam) out.activeExam = remoteData.activeExam || ''
  if (!out.settings && remoteData.settings) out.settings = remoteData.settings

  // 备份时间取较新的一条，便于两端都看到"最近备份过"
  const lb = localData.meta?.lastBackupAt || ''
  const rb = remoteData.meta?.lastBackupAt || ''
  out.meta = { ...(localData.meta || {}), lastBackupAt: rb > lb ? rb : lb }

  return { data: out, stats }
}

/** 生成设备标识（只用于在远端区分来源，不含任何个人信息） */
export function makeDeviceId() {
  return `dev-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}
