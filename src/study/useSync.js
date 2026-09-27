import { reactive, computed } from 'vue'
import { useStudyStore, setAfterFlushHook } from './useStudyStore'
import { readEnvelope } from './storage'
import { buildPayload, validatePayload, decideSync, mergeData, makeDeviceId, SYNC_APP } from './sync'
import { createGistSync, DEFAULT_FILENAME } from './syncGist'

/**
 * 云同步控制器（模块级单例，与 store 同风格）
 *
 * 三条不可动摇的规则：
 *   1. **本地优先**：没配置、没网、token 过期、GitHub 挂了 —— 刷题一律照常，
 *      同步失败只改状态文字，绝不阻塞或回滚本地数据。
 *   2. **不整份覆盖**：远端更新时先逐题合并再写本地（见 sync.js 的 mergeData）。
 *   3. **token 只在本机**：存在独立的 localStorage 键里，不进 state、
 *      不进导出备份、更不会被同步出去。
 *
 * 脏标记用的是存档信封里的校验和（每次写盘都会变），
 * 而不是在响应式 state 里加计数器 —— 后者会在 flush 内改动 state，
 * 触发深 watch 造成微任务死循环（store 里有过这个坑的记录）。
 */

const CONFIG_KEY = 'piusprime.hcip.sync'
const PUSH_DEBOUNCE_MS = 30000
/** 切后台时如果距上次推送不到这个间隔，就不急着推 */
const MIN_PUSH_GAP_MS = 10000

const cfg = reactive({
  enabled: false,
  token: '',
  gistId: '',
  filename: DEFAULT_FILENAME,
  deviceId: '',
  lastPushedChecksum: '',
  lastPushAt: '',
  lastPullAt: '',
})

/** UI 可见的同步状态 */
const status = reactive({
  state: 'off', // off | idle | syncing | ok | error
  message: '未启用',
  error: '',
  lastSyncAt: '',
})

let inited = false
let pushTimer = null

/* ============================================================
   配置读写
   ============================================================ */

function loadConfig() {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    Object.assign(cfg, {
      enabled: parsed.enabled === true,
      token: typeof parsed.token === 'string' ? parsed.token : '',
      gistId: typeof parsed.gistId === 'string' ? parsed.gistId : '',
      filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : '',
      lastPushedChecksum: typeof parsed.lastPushedChecksum === 'string' ? parsed.lastPushedChecksum : '',
      lastPushAt: typeof parsed.lastPushAt === 'string' ? parsed.lastPushAt : '',
      lastPullAt: typeof parsed.lastPullAt === 'string' ? parsed.lastPullAt : '',
    })
  } catch {
    /* 配置坏了就当没配置过，不影响本地进度 */
  }
}

function persistConfig() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg }))
  } catch {
    setError('同步配置写不进本机存储')
  }
}

function setError(message) {
  status.state = 'error'
  status.error = message
  status.message = message
}

function adapter() {
  if (!cfg.token) throw new Error('还没填 Token')
  return createGistSync({ token: cfg.token, gistId: cfg.gistId, filename: cfg.filename })
}

/* ============================================================
   同步动作
   ============================================================ */

/** 本地是否还有没推上去的变更 */
function isDirty() {
  const { checksum } = readEnvelope()
  return Boolean(checksum) && checksum !== cfg.lastPushedChecksum
}

/** 当前本地载荷（每次现取信封，保证时间与校验和是最新的） */
function currentPayload(store) {
  const env = readEnvelope()
  return buildPayload(store.state, {
    deviceId: cfg.deviceId,
    savedAt: env.savedAt,
    checksum: env.checksum,
  })
}

async function pushNow(store) {
  const api = adapter()
  const payload = currentPayload(store)
  await api.push(payload)
  cfg.lastPushedChecksum = payload.checksum
  cfg.lastPushAt = new Date().toISOString()
  persistConfig()
}

/**
 * 拉取并按需合并。
 * @returns {Promise<'noop'|'merged'>}
 */
async function pullOnce(store) {
  const api = adapter()
  const raw = await api.pull()
  cfg.lastPullAt = new Date().toISOString()
  persistConfig()
  if (!raw) return 'noop'

  const checked = validatePayload(raw)
  if (!checked.ok) throw new Error(checked.error)

  const remote = checked.payload
  const env = readEnvelope()
  const action = decideSync({ localSavedAt: env.savedAt, localChecksum: env.checksum, remote })
  if (action === 'noop') return 'noop'
  if (action === 'push') return 'noop' // 本地更新，交给 push 分支

  const { data, stats } = mergeData(store.state, remote.data)
  // 用 doImport 落地：它自带校验 + 规范化 + 立即写盘，
  // 且传入的是"完整本地状态 + 合并字段"，sessions/imported 不会被抹掉
  const res = store.doImport(JSON.stringify({ ...store.state, ...data }))
  if (!res.ok) throw new Error(res.error || '远端数据无法写入本地')

  cfg.lastPushedChecksum = '' // 合并后本地又不等于远端，标记为待推送
  persistConfig()
  return `merged:${stats.items}`
}

/** 手动/定时同步：先拉（必要时合并），再按需推 */
export async function syncNow() {
  if (!cfg.enabled || !cfg.token) {
    setError('还没启用云同步')
    return { ok: false }
  }
  if (status.state === 'syncing') return { ok: false }
  const store = useStudyStore()
  status.state = 'syncing'
  status.message = '同步中…'
  status.error = ''
  try {
    const pulled = await pullOnce(store)
    if (isDirty()) await pushNow(store)
    status.state = 'ok'
    status.lastSyncAt = new Date().toISOString()
    status.message =
      pulled === 'noop' ? `已同步 · ${formatClockTime()}` : `已合并远端更新 · ${formatClockTime()}`
    return { ok: true }
  } catch (err) {
    setError(err?.message || String(err))
    return { ok: false, error: status.error }
  }
}

function formatClockTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 本地写盘后延迟推送，避免答题时高频打 GitHub */
function schedulePush() {
  if (!cfg.enabled || !cfg.token || !isDirty()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    syncNow()
  }, PUSH_DEBOUNCE_MS)
}

/* ============================================================
   对外
   ============================================================ */

/** 启用同步：校验 token → 必要时自动建 gist → 首次推送 */
export async function enableSync(token, gistId = '') {
  const clean = String(token || '').trim()
  if (!clean) return { ok: false, error: '请先填 Token' }
  if (!cfg.deviceId) cfg.deviceId = makeDeviceId()

  const api = createGistSync({ token: clean, gistId: String(gistId || '').trim(), filename: cfg.filename })
  const store = useStudyStore()
  status.state = 'syncing'
  status.message = '正在校验 Token…'
  status.error = ''
  try {
    await api.checkToken()
    cfg.token = clean
    cfg.gistId = String(gistId || '').trim()

    if (!cfg.gistId) {
      // 先找已有的：换设备时用户只粘 token，直接新建会凭空多出一份空白进度
      status.message = '正在查找已有的 Gist…'
      cfg.gistId = await api.findExistingGist()
    }

    if (!cfg.gistId) {
      status.message = '正在创建 Gist…'
      const payload = currentPayload(store)
      cfg.gistId = await api.createGist(payload)
      if (!cfg.gistId) throw new Error('创建 Gist 失败（Token 是否勾了 gist 权限？）')
      cfg.lastPushedChecksum = payload.checksum
      cfg.lastPushAt = new Date().toISOString()
    }

    cfg.enabled = true
    persistConfig()
    status.state = 'ok'
    status.message = '已启用'
    const res = await syncNow()
    return res.ok ? { ok: true, gistId: cfg.gistId } : res
  } catch (err) {
    cfg.enabled = false
    persistConfig()
    setError(err?.message || String(err))
    return { ok: false, error: status.error }
  }
}

/** 停用：保留 gistId 与 deviceId，只清 token 与开关 */
export function disableSync() {
  cfg.enabled = false
  cfg.token = ''
  cfg.lastPushedChecksum = ''
  persistConfig()
  status.state = 'off'
  status.error = ''
  status.message = '未启用'
}

/**
 * 初始化（HcipPage 挂载时调用一次）：
 * 读过配置、把"写盘后推送"挂到 store 的 flush 钩子上、补一次启动拉取。
 */
export function initSync() {
  if (inited) return
  inited = true
  loadConfig()
  if (!cfg.deviceId) {
    cfg.deviceId = makeDeviceId()
    persistConfig()
  }
  setAfterFlushHook((ok) => {
    if (ok) schedulePush()
  })
  if (typeof window !== 'undefined') {
    // 切后台是手机上最后一次可靠的机会：这时不推，回来可能已经是几天后
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return
      if (!cfg.enabled || !cfg.token || !isDirty()) return
      const since = Date.now() - Date.parse(cfg.lastPushAt || 0)
      if (!Number.isFinite(since) || since > MIN_PUSH_GAP_MS) syncNow()
    })
  }

  if (!cfg.enabled || !cfg.token) {
    status.state = 'off'
    status.message = '未启用'
    return
  }
  status.state = 'idle'
  status.message = '正在从云端取回进度…'
  syncNow()
}

export function useSync() {
  return {
    config: cfg,
    status,
    /** 是否已启用（UI 决定显示"启用"还是"同步中"） */
    enabled: computed(() => cfg.enabled && Boolean(cfg.token)),
    gistId: computed(() => cfg.gistId),
    api: SYNC_APP,
    enableSync,
    disableSync,
    syncNow,
  }
}
