/**
 * 拉取 Steam 游戏库 → src/data/steam-games.json
 *
 * 数据来源：官方 Steam Web API，通过 NPM 包 steamapi 调用
 *   · IPlayerService/GetOwnedGames    → 游戏列表 / 总时长 / 近两周时长 / 最后游玩时间
 *   · ISteamUser/GetPlayerSummaries   → 昵称 / 头像
 *
 * 用法（任选其一）：
 *   推荐       :  在项目根目录建 .env.local 写入 STEAM_API_KEY=你的KEY，之后 npm run steam 即可
 *   PowerShell :  $env:STEAM_API_KEY = '你的KEY'; npm run steam
 *   cmd        :  set STEAM_API_KEY=你的KEY && npm run steam
 *   bash       :  STEAM_API_KEY=你的KEY npm run steam
 *   直接传参    :  npm run steam -- 你的KEY
 *
 * API Key 申请：https://steamcommunity.com/dev/apikey
 *   （登录后在「域名」里随便填 localhost 即可，Key 仅用于读取游戏库）
 *
 * 前置条件：Steam → 个人资料 → 隐私设置 → 「游戏详情」需设为公开，
 *   否则接口拿不到游戏列表（脚本会给出提示）。
 *
 * 为什么不直接在浏览器里调 Steam API？
 *   1. Steam Web API 不返回 CORS 响应头，浏览器 fetch 会被拦截；
 *   2. API Key 写进前端产物就等于公开泄露，任何人都能盗用并耗光配额；
 *   3. 构建时抓一次存成静态 JSON，访客零等待，站点也不受 Steam 波动影响。
 *
 * 关于代理：Node 内置 fetch 不会读取系统代理设置，而国内直连
 *   api.steampowered.com 通常不通。脚本会自动读取 HTTPS_PROXY 或
 *   Windows 系统代理，并用 --use-env-proxy 在内部重启自身，
 *   所以正常情况下不需要手动配置任何环境变量。
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'

const SELF = fileURLToPath(import.meta.url)
const OUT = resolve(dirname(SELF), '../src/data/steam-games.json')

/** 极简 .env.local 读取：Key 留在本地即可，.gitignore 已忽略 *.local */
function loadEnvLocal() {
  const file = resolve(dirname(SELF), '../.env.local')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    // 兼容带 BOM 的 UTF-8（记事本、PowerShell 5.1 保存时会加）
    const m = line.replace(/^\uFEFF/, '').match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    // 已存在的环境变量优先，.env.local 只作补充
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}
loadEnvLocal()

const STEAM_ID = process.env.STEAM_ID || '76561198991168446'
const API_KEY = process.env.STEAM_API_KEY || process.argv[2]

/* 图片地址自己拼：steamapi 的 iconURL getter 指向已停用的
   steamcdn-a.akamaihd.net，而 icon 为空时它会拼出 "undefined.jpg"。
   这里统一用官方现用域名，与站点已有数据保持一致的风格。 */
const ICON_BASE = 'https://media.steampowered.com/steamcommunity/public/images/apps'
/* 小图标之外的官方图都走这个域名。注意别用 cdn.cloudflare.steamstatic.com
   —— 国内加速器的分流规则常把它和 api.steampowered.com 一起漏掉
   （ECONNRESET），实测 cdn.akamai.steamstatic.com 同路径完全可达。 */
const APP_CDN = 'https://cdn.akamai.steamstatic.com/steam/apps'
const AVATAR_BASE = 'https://avatars.akamai.steamstatic.com'

/* Steam Web API 端点：国内直连 api.steampowered.com 不通，而加速器的分流
   规则有时会漏掉它；官方另有 api.steamchina.com 端点（数据同源，已验证
   能读国际账号），所以这里按顺序探测并自动回退。
   想固定某个端点可设环境变量 STEAM_API_BASE。 */
const API_BASES = [
  process.env.STEAM_API_BASE,
  'https://api.steampowered.com',
  'https://api.steamchina.com',
].filter(Boolean)

const toHours = (minutes) => Math.round((minutes / 60) * 10) / 10

/* ---------- 代理：让 Node 内置 fetch 走系统代理 ---------- */

/** 读取 Windows 系统代理（注册表）。没有设置或非 Windows 时返回 null。 */
function systemProxy() {
  if (process.platform !== 'win32') return null
  const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
  try {
    const query = (name) =>
      execFileSync('reg', ['query', regKey, '/v', name], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    if (!/REG_DWORD\s+0x1\b/i.test(query('ProxyEnable'))) return null
    const raw = query('ProxyServer').match(/ProxyServer\s+REG_SZ\s+(.+)/i)?.[1]?.trim()
    if (!raw) return null
    // 取值形如 "http=127.0.0.1:7890;https=127.0.0.1:7890"，也可能是裸的 "127.0.0.1:7890"
    const picked = raw.match(/(?:^|;)\s*https?=([^;]+)/i)?.[1] || raw.replace(/^[a-z]+=/i, '')
    const hostPort = picked.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
    return /^[\w.-]+:\d+$/.test(hostPort) ? `http://${hostPort}` : null
  } catch {
    return null
  }
}

/*
 * 内置 fetch 只有在「设了 HTTPS_PROXY 且带 --use-env-proxy」时才会走代理，
 * 而这两者都必须在进程启动前就位，所以这里带代理环境重启一次自身。
 * STEAM_PROXY_READY 用来防止无限重启。
 */
if (!process.env.STEAM_PROXY_READY) {
  const proxy =
    process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY || systemProxy()
  if (proxy) {
    console.log(`→ 检测到代理 ${proxy}，经它访问 Steam API`)
    const child = spawnSync(process.execPath, ['--use-env-proxy', SELF, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        HTTPS_PROXY: proxy,
        HTTP_PROXY: proxy,
        STEAM_PROXY_READY: '1',
      },
    })
    process.exit(child.status ?? 1)
  }
}

/* ---------- 主流程 ---------- */

if (!API_KEY) {
  console.error(`
✖ 缺少 Steam Web API Key

  申请：https://steamcommunity.com/dev/apikey

  最省事：在项目根目录建 .env.local，写入一行
    STEAM_API_KEY=你的KEY
  之后 npm run steam 即可（该文件已被 .gitignore 忽略，不会提交）。

  也可以临时的：
    PowerShell :  $env:STEAM_API_KEY = '你的KEY'; npm run steam
    cmd        :  set STEAM_API_KEY=你的KEY && npm run steam
    bash       :  STEAM_API_KEY=你的KEY npm run steam
    直接传参    :  npm run steam -- 你的KEY
`)
  process.exit(1)
}

/** 把 steamapi / fetch 抛出的简短错误翻译成人话 */
function explain(err) {
  const msg = String(err?.message || err)
  const code = err?.cause?.code || ''
  const hints = {
    Unauthorized: 'API Key 无效或已失效 —— 到 https://steamcommunity.com/dev/apikey 重新生成。',
    Forbidden: '请求被拒绝：Key 无效，或该账号的资料不对外公开。',
    'Too Many Requests': '触发了 Steam 速率限制，过几分钟再试。',
    'No players found': `找不到账号 ${STEAM_ID}，请检查 STEAM_ID 是否正确。`,
    'Invalid user ID provided': `STEAM_ID 格式不正确（当前：${STEAM_ID}）。`,
  }
  let hint = hints[msg]
  if (!hint && (code.startsWith('UND_ERR') || /fetch failed/i.test(msg))) {
    hint = '网络不通：请开启代理/加速器后重试（脚本会自动识别系统代理）。'
  }
  console.error(`\n✖ 拉取失败：${msg}`)
  if (code) console.error(`  底层错误：${code}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

/** 依次探测 API 端点，返回第一个可用的；全部不可用则诊断后退出 */
async function pickApiBase() {
  const probe = async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      return res.status
    } catch (err) {
      return err?.cause?.code || err?.name || 'unknown'
    }
  }

  const tried = []
  for (const base of API_BASES) {
    const result = await probe(`${base}/ISteamWebAPIUtil/GetServerInfo/v1/`)
    if (typeof result === 'number') {
      if (base !== API_BASES[0]) console.log(`  使用 API 端点：${base}`)
      return base
    }
    tried.push(`${base} → ${result}`)
  }

  console.error('\n✖ 所有 Steam API 端点都连不上：')
  for (const line of tried) console.error(`    · ${line}`)

  const store = await probe('https://store.steampowered.com/api/appdetails?appids=730')
  if (typeof store === 'number') {
    console.error(`
  对照检测：store.steampowered.com 正常（HTTP ${store}）→ 网络能出去，
  只是代理/加速器的分流规则拦掉了 Steam API 域名，常见解法：
    · 把加速器切到「全局模式」（代理全部流量）
    · 或换一个节点后重试
    · 或用 STEAM_API_BASE 指定一个可用端点
`)
  } else {
    console.error(`
  对照检测：store.steampowered.com 也不通（${store}）→ 代理本身没有生效。
  常见解法：
    · 确认加速器/代理已启动并处于「加速中」状态
    · 确认它开启了系统代理，或把 HTTPS_PROXY 指到正确端口
    · 当前运行方式：${process.env.STEAM_PROXY_READY ? '已启用代理' : '未检测到代理，正在直连'}
`)
  }
  process.exit(1)
}

async function main() {
  // 动态导入：确保代理环境在模块加载前就已就位
  const { default: SteamAPI } = await import('steamapi')

  const apiBase = await pickApiBase()
  const steam = new SteamAPI(API_KEY, { baseAPI: apiBase })

  const id = await steam.resolve(STEAM_ID)
  console.log(`→ 正在拉取 SteamID ${id} 的游戏库…`)

  let plays
  let summary
  try {
    plays = await steam.getUserOwnedGames(id, { includeAppInfo: true, includeFreeGames: true })
    summary = await steam.getUserSummary(id)
  } catch (err) {
    explain(err)
  }

  const list = plays
    .filter((p) => p?.game?.id && p?.game?.name)
    .map((p) => ({
      appid: p.game.id,
      name: p.game.name,
      minutes: p.minutes || 0,
      twoWeeksMinutes: p.recentMinutes || 0,
      lastPlayed: p.lastPlayedTimestamp || 0,
      icon: p.game.icon ? `${ICON_BASE}/${p.game.id}/${p.game.icon}.jpg` : '',
      header: `${APP_CDN}/${p.game.id}/header.jpg`,
      // 库横幅大图（3840×1240），首页 banner 轮播用；个别游戏没有则前端回退到 header
      hero: `${APP_CDN}/${p.game.id}/library_hero.jpg`,
    }))
    .sort((a, b) => b.minutes - a.minutes)

  if (list.length === 0) {
    console.error(`
✖ 没有拿到任何游戏，常见原因：
   1. 「游戏详情」不是公开的 —— Steam → 个人资料 → 隐私设置 → 游戏详情 = 公开
   2. SteamID 写错了（当前：${STEAM_ID}）
   3. 该账号游戏库确实为空
`)
    process.exit(1)
  }

  const out = {
    _meta: {
      steamId: id,
      personaName: summary?.nickname || '',
      avatar: summary?.avatar?.hash ? `${AVATAR_BASE}/${summary.avatar.hash}_full.jpg` : '',
      profile: `https://steamcommunity.com/profiles/${id}`,
      updated: new Date().toISOString(),
      count: list.length,
      sample: false,
    },
    totalMinutes: list.reduce((sum, g) => sum + g.minutes, 0),
    recentMinutes: list.reduce((sum, g) => sum + g.twoWeeksMinutes, 0),
    games: list,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8')

  console.log(`✔ 已写入 src/data/steam-games.json`)
  console.log(`  玩家昵称：${out._meta.personaName || '(未知)'}`)
  console.log(`  游戏总数：${list.length}`)
  console.log(`  总时长  ：${toHours(out.totalMinutes).toLocaleString('zh-CN')} 小时`)
  console.log(`  近两周  ：${toHours(out.recentMinutes).toLocaleString('zh-CN')} 小时`)
  console.log(`  最常玩  ：${list.slice(0, 5).map((g) => g.name).join(' / ')}`)
}

main()

