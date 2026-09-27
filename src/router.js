import { ref } from 'vue'

/**
 * 轻量 hash 路由（零依赖）
 *
 * 为什么不用 vue-router：
 *   站点部署在 GitHub Pages 的子路径（vite.config.js 里 base: '/MyWebsite/'），
 *   而 deploy-pages.yml 直接上传 dist 且没有 404.html 回退。
 *   history 模式下刷新/直达任何子路由都会 404；hash 模式在任意静态托管下都可靠。
 *
 * 命名空间约定（关键，避免与站内锚点冲突）：
 *   '#/hcip/quiz' 以及任何 '#/xx'  → 页面路由（可带子视图）
 *   '#home' '#about' '#skills' ...  → 主页锚点，仍然停留在 home，滚动交给浏览器原生行为
 */

/**
 * 页面路由表。
 * 带 sub 的页面把子视图放在第二段（如 #/hcip/quiz），
 * 用同一个组件 + 子视图切换，而不是给每个标签页建一个路由 ——
 * 底部标签栏切换时不需要重新挂载整个页面，移动端更顺。
 */
const ROUTES = {
  '/ebbinghaus': { route: 'ebbinghaus' },
  '/hcip': { route: 'hcip', sub: 'today' },
}

/** 主页上本来就存在的锚点，明确列出来以便与未来新增的页面路由区分 */
const HOME_ANCHORS = new Set([
  'home',
  'about',
  'portfolio',
  'skills',
  'steam',
  'contact',
])

function parse(hash) {
  const raw = (hash || '').replace(/^#/, '')
  if (raw.startsWith('/')) {
    const segments = raw.split('/').filter(Boolean)
    const hit = ROUTES[`/${segments[0] || ''}`]
    if (hit) {
      // 未指定子视图时用路由默认值（如 #/hcip → today）
      return { route: hit.route, sub: segments[1] || hit.sub || '' }
    }
    return { route: 'home', sub: '' }
  }
  if (raw === '' || HOME_ANCHORS.has(raw)) return { route: 'home', sub: '' }
  // 未知的裸锚点（例如未来新增的 section）按主页锚点处理，滚动由浏览器负责
  return { route: 'home', sub: '' }
}

/** 生成 hash 链接，避免调用方手拼字符串时漏掉 '/' */
export function hcipLink(sub = '') {
  return sub ? `#/hcip/${sub}` : '#/hcip'
}

/**
 * 程序化跳转。
 *
 * hash 没变时（例如在主页反复点左上角 logo 的 #home）浏览器不会派发 hashchange，
 * 路由 watch 也就不会触发，于是"点了没反应"。这里显式补一次滚动定位，
 * 让同一个锚点可以反复点击。
 */
export function go(href) {
  if (typeof window === 'undefined') return
  if (window.location.hash === href) {
    handleHashChange()
    // 同步执行，不走 watch：此时路由值没变，watch 根本不会触发
    syncViewportAfterRoute(href)
    return
  }
  window.location.hash = href
}

/**
 * 立即把页面拉回顶部。
 * html{scroll-behavior:smooth} 会让一次长距离"滚回顶部"变成缓慢动画，
 * 与路由切换的瞬间感冲突，所以这里临时压制平滑滚动再还原。
 */
function resetScroll() {
  const root = document.documentElement
  const prev = root.style.scrollBehavior
  root.style.scrollBehavior = 'auto'
  window.scrollTo(0, 0)
  root.style.scrollBehavior = prev
}

let listenerBound = false

function handleHashChange() {
  const next = parse(window.location.hash)
  route.value = next.route
  subRoute.value = next.sub
}

const initial = typeof window === 'undefined' ? { route: 'home', sub: '' } : parse(window.location.hash)
const route = ref(initial.route)
const subRoute = ref(initial.sub)

export function useRoute() {
  if (typeof window !== 'undefined' && !listenerBound) {
    // 初始值已经在模块加载时同步解析，这里只负责后续变化
    window.addEventListener('hashchange', handleHashChange)
    listenerBound = true
  }

  return { route, subRoute, go }
}

/**
 * 子视图切换。
 * 只在 route === 'hcip' 时生效：直接改 hash 会触发 hashchange，
 * 但底部标签栏切换希望是"原地切"而不是整页重挂，
 * 所以这里同时更新 ref 与 hash（更新 ref 让界面立刻响应，写 hash 保证可分享/可刷新）。
 */
export function setSubRoute(sub) {
  if (typeof window === 'undefined') return
  const next = hcipLink(sub === 'today' ? '' : sub)
  subRoute.value = sub
  if (window.location.hash !== next) {
    // 用 replaceState 而不是赋值 hash：切标签不产生历史记录，
    // 否则手机返回键要按五六次才能退出备考页
    try {
      window.history.replaceState(null, '', next)
    } catch {
      window.location.hash = next
    }
  }
}

/**
 * 切换路由后的收尾：滚动位置重置 + 锚点定位。
 * 必须在 DOM 更新之后调用（调用方负责 nextTick）。
 */
export function syncViewportAfterRoute(anchor) {
  if (typeof window === 'undefined') return
  if (anchor) {
    const el = document.getElementById(anchor.replace(/^#/, ''))
    if (el) {
      // 这里刻意不写 behavior:'auto'——让它沿用 html{scroll-behavior:smooth}，
      // 与站内原生锚点跳转的手感保持一致（Safari 不支持该参数，用特性检测兜底）
      if ('scrollBehavior' in document.documentElement.style) {
        el.scrollIntoView({ block: 'start' })
      } else {
        el.scrollIntoView(true)
      }
      return
    }
  }
  resetScroll()
}
