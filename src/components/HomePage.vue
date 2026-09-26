<script setup>
/**
 * 主页内容（从 App.vue 原样抽出）。
 * 抽出的原因：App.vue 现在要按路由在"主页"和二级页面之间切换，
 * 各 section 的 class / id / 锚点必须原样保留，保证既有滚动定位与视觉零回归。
 */
import HeroSection from './HeroSection.vue'
import GameBanner from './GameBanner.vue'
import AboutSection from './AboutSection.vue'
import PortfolioSection from './PortfolioSection.vue'
import SkillsSection from './SkillsSection.vue'
import SteamSection from './SteamSection.vue'
import ContactSection from './ContactSection.vue'
</script>

<template>
  <main>
    <HeroSection />
    <GameBanner />
    <AboutSection />
    <PortfolioSection />
    <SkillsSection />
    <SteamSection />
    <ContactSection />
  </main>
</template>
