<script setup>
import { onMounted, onBeforeUnmount, watch, nextTick, computed, defineAsyncComponent } from 'vue'
import BackdropFX from './components/BackdropFX.vue'
import Preloader from './components/Preloader.vue'
import NavBar from './components/NavBar.vue'
import HomePage from './components/HomePage.vue'
import ForgettingCurvePage from './components/ForgettingCurvePage.vue'
import SiteFooter from './components/SiteFooter.vue'
import { useRoute, syncViewportAfterRoute } from './router'

/**
 * 备考模块按需加载。
 * 它带着约 350KB 的题库与 15 个组件，而绝大多数访客只看主页 ——
 * 静态引入会让首页 chunk 从约 520KB 涨到 627KB（实测），这是不必要的首屏成本。
 * 拆出去之后首页体积不变，只有真正进入 #/hcip 才下载。
 */
const HcipPage = defineAsyncComponent(() => import('./components/hcip/HcipPage.vue'))

const { route } = useRoute()

const HOME_TITLE = 'Pius.Prime — PIUSPRIME 的个人主页'
const CURVE_TITLE = '艾宾浩斯遗忘曲线 — Pius.Prime'
const HCIP_TITLE = 'HCIP-Datacom 备考 — Pius.Prime'

const TITLES = {
  home: HOME_TITLE,
  ebbinghaus: CURVE_TITLE,
  hcip: HCIP_TITLE,
}

/**
 * 备考模块自带底部标签栏与紧凑顶栏，需要独占手机屏幕：
 * 站点导航栏（汉堡菜单）会和底部标签栏形成两套导航，页脚也会挤占答题空间。
 */
const immersive = computed(() => route.value === 'hcip')

let observer = null

/**
 * 观察所有 .reveal 元素，进入视口后加 .in-view 触发浮现。
 * 必须可重入：路由切换会挂载全新的 DOM 节点，只在根组件 mount 时跑一次的话，
 * 新页面里的 .reveal 会永远停在 opacity:0。
 */
function initObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12 },
  )
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
}

watch(route, async () => {
  await nextTick()
  initObserver()
  // 从二级页面点回"关于/技能"这类锚点时，DOM 要到 nextTick 之后才存在，
  // 浏览器原生的锚点定位早已错过这个时机，所以在这里补一次。
  syncViewportAfterRoute(window.location.hash)
  document.title = TITLES[route.value] || HOME_TITLE
})

onMounted(() => {
  // 遮罩揭示前就让首屏内容就绪
  initObserver()
  document.title = TITLES[route.value] || HOME_TITLE
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- 全局背景装饰：矢量平铺层 → 网格层 → 光晕层，由深到浅叠加 -->
  <BackdropFX />
  <div class="grid-bg"></div>

  <!-- 光晕只属于主页：二级页顶部出现一块无来由的红色光雾会很突兀 -->
  <template v-if="route === 'home'">
    <div class="glow-red" style="top: -100px; right: -140px"></div>
    <div class="glow-red" style="bottom: -180px; left: -160px; opacity: 0.55"></div>
  </template>

  <Preloader />

  <NavBar v-if="!immersive" />

  <HomePage v-if="route === 'home'" />
  <ForgettingCurvePage v-else-if="route === 'ebbinghaus'" />
  <HcipPage v-else-if="route === 'hcip'" />

  <SiteFooter v-if="!immersive" />
</template>
