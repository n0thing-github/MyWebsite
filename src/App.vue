<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import BackdropFX from './components/BackdropFX.vue'
import Preloader from './components/Preloader.vue'
import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import GameBanner from './components/GameBanner.vue'
import AboutSection from './components/AboutSection.vue'
import PortfolioSection from './components/PortfolioSection.vue'
import SkillsSection from './components/SkillsSection.vue'
import SteamSection from './components/SteamSection.vue'
import ContactSection from './components/ContactSection.vue'
import SiteFooter from './components/SiteFooter.vue'

let observer = null

function onPreloaderDone() {
  document.body.style.overflow = ''
}

function initObserver() {
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

onMounted(() => {
  // 遮罩揭示前就让首屏内容就绪
  initObserver()
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
  <div class="glow-red" style="top: -100px; right: -140px"></div>
  <div class="glow-red" style="bottom: -180px; left: -160px; opacity: 0.55"></div>

  <Preloader @done="onPreloaderDone" />

  <NavBar />

  <main>
    <HeroSection />
    <GameBanner />
    <AboutSection />
    <PortfolioSection />
    <SkillsSection />
    <SteamSection />
    <ContactSection />
  </main>

  <SiteFooter />
</template>

