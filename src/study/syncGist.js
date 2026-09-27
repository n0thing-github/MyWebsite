/**
 * GitHub Gist 同步适配器
 *
 * 为什么用 Gist 而不是自建服务：
 *   站点本身就在 GitHub Pages 上，数据放进同一个账号的 secret gist 里，
 *   零成本、零部署、不涉及域名与备案，也**不需要额外的账号体系**。
 *   代价是 token 存在浏览器本地（必须用只勾 gist 权限的细粒度 token），
 *   以及国内访问 api.github.com 偶尔慢 —— 后者由 local-first 策略兜住。
 *
 * 这个模块只负责"跟 GitHub 说话"，不碰 store：
 * 传入 fetchImpl 就能在单测里用假 fetch 跑完全部错误分支。
 */

const API = 'https://api.github.com'
export const DEFAULT_FILENAME = 'hcip-progress.json'

function mapStatus(status) {
  if (status === 401) return 'Token 无效或已过期'
  if (status === 403 || status === 429) return 'GitHub 限流或权限不足，稍后重试'
  if (status === 404) return 'Gist 不存在（可能已被删除）'
  if (status === 422) return 'GitHub 拒绝了这次写入（内容或参数非法）'
  return `GitHub 返回 ${status}`
}

/**
 * @param {object} opts
 * @param {string} opts.token 细粒度 PAT（仅 gist 权限）
 * @param {string} [opts.gistId] 目标 gist；为空时用 createGist 自动建
 * @param {string} [opts.filename] gist 里的文件名
 * @param {Function} [opts.fetchImpl] 便于单测注入
 */
export function createGistSync({
  token,
  gistId = '',
  filename = DEFAULT_FILENAME,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
  timeoutMs = 15000,
} = {}) {
  if (!fetchImpl) throw new Error('当前环境没有 fetch')

  async function call(path, init = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
    let res
    try {
      res = await fetchImpl(`${API}${path}`, {
        ...init,
        signal: controller ? controller.signal : undefined,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      })
    } catch (err) {
      // AbortError 与 DNS/断网都归一成"连不上"，UI 只需要一句人话
      const aborted = err?.name === 'AbortError'
      throw new Error(aborted ? '连接 GitHub 超时' : '连不上 GitHub（网络或代理问题）')
    } finally {
      if (timer) clearTimeout(timer)
    }

    if (!res.ok) {
      let detail = ''
      try {
        const body = await res.json()
        detail = body?.message ? `：${body.message}` : ''
      } catch {
        /* 没有 JSON body 就只报状态码 */
      }
      throw new Error(mapStatus(res.status) + detail)
    }
    return res.status === 204 ? null : res.json()
  }

  /** token 是否可用（顺带确认网络通不通） */
  async function checkToken() {
    const me = await call('/user')
    return { login: me?.login || '', name: me?.name || '' }
  }

  /** 读取远端进度；没有这个文件时返回 null */
  async function pull() {
    if (!gistId) throw new Error('还没配置 Gist')
    const json = await call(`/gists/${gistId}`)
    const file = json?.files?.[filename]
    if (!file) return null
    let content = file.content
    // 单个文件超过 1 MB 时 GitHub 会把 content 置空并给 truncated 标记
    if (file.truncated || !content) {
      if (!file.raw_url) return null
      const raw = await fetchImpl(file.raw_url)
      if (!raw.ok) throw new Error(mapStatus(raw.status))
      content = await raw.text()
    }
    return content
  }

  /** 覆盖写入（gist 里其它文件保持不动） */
  async function push(payload) {
    if (!gistId) throw new Error('还没配置 Gist')
    const content = JSON.stringify(payload, null, 2)
    return call(`/gists/${gistId}`, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [filename]: { content } } }),
    })
  }

  /** 首次配置时自动建一个 secret gist，返回它的 id */
  async function createGist(payload) {
    const content = JSON.stringify(payload, null, 2)
    const json = await call('/gists', {
      method: 'POST',
      body: JSON.stringify({
        description: 'Pius.Prime HCIP 学习进度（自动同步）',
        public: false,
        files: { [filename]: { content } },
      }),
    })
    return json?.id || ''
  }

  return { checkToken, pull, push, createGist }
}
