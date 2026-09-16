<script setup>
import { ref, onBeforeUnmount } from 'vue'
import Preloader from './components/Preloader.vue'
import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import AboutSection from './components/AboutSection.vue'
import PortfolioSection from './components/PortfolioSection.vue'
import SkillsSection from './components/SkillsSection.vue'
import ContactSection from './components/ContactSection.vue'
import SiteFooter from './components/SiteFooter.vue'

const loaded = ref(false)
let observer = null

function onPreloaderDone() {
  loaded.value = true
  document.body.style.overflow = ''
  // 下一帧初始化滚动浮现
  requestAnimationFrame(() => initObserver())
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

onBeforeUnmount(() => {
  observer?.disconnect()
  document.body.style.overflow = ''
})
</script>

<template>
  <!-- 全局背景装饰 -->
  <div class="grid-bg"></div>
  <div class="glow-red" style="top: -100px; right: -140px"></div>
  <div class="glow-red" style="bottom: -180px; left: -160px; opacity: 0.55"></div>

  <Preloader @done="onPreloaderDone" />

  <NavBar />

  <main :class="{ 'is-ready': loaded }">
    <HeroSection />
    <AboutSection />
    <PortfolioSection />
    <SkillsSection />
    <ContactSection />
  </main>

  <SiteFooter />
</template>

<style scoped>
main {
  opacity: 0;
  transition: opacity 0.6s ease;
}
main.is-ready {
  opacity: 1;
}
</style>
