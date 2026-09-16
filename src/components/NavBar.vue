<script setup>
import { ref } from 'vue'

const open = ref(false)

const navItems = [
  { label: '首页', href: '#home' },
  { label: '关于', href: '#about' },
  {
    label: '作品集',
    href: '#portfolio',
    children: [
      { label: 'Web 项目', href: '#portfolio' },
      { label: '游戏开发', href: '#portfolio' },
      { label: '实验作品', href: '#portfolio' },
    ],
  },
  { label: '技能', href: '#skills' },
  { label: '联系', href: '#contact' },
]
</script>

<template>
  <header class="navbar">
    <div class="nav-inner">
      <!-- Logo -->
      <a class="logo" href="#home">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <polygon points="20,2 35,11 35,29 20,38 5,29 5,11" />
        </svg>
        <span class="logo-text">MyWebsite</span>
      </a>

      <!-- 桌面导航 -->
      <ul class="nav-list">
        <li v-for="item in navItems" :key="item.label" class="nav-item" :class="{ 'has-drop': item.children }">
          <a class="nav-link" :href="item.href">
            <span>{{ item.label }}</span>
            <svg v-if="item.children" class="arrow" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </a>

          <!-- 下拉面板 -->
          <div v-if="item.children" class="drop-panel">
            <a v-for="child in item.children" :key="child.label" class="drop-item" :href="child.href">
              <span class="drop-icon"></span>
              <span>{{ child.label }}</span>
            </a>
          </div>
        </li>
      </ul>

      <!-- 汉堡菜单 -->
      <button class="burger" :class="{ 'is-open': open }" aria-label="菜单" @click="open = !open">
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- 移动端抽屉 -->
    <transition name="drawer">
      <div v-if="open" class="mobile-menu">
        <a
          v-for="item in navItems"
          :key="item.label"
          :href="item.href"
          class="mobile-link"
          @click="open = false"
        >
          {{ item.label }}
        </a>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 500;
  height: var(--nav-h);
  background: rgba(10, 10, 12, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}

.nav-inner {
  width: min(1200px, 92%);
  height: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ===== Logo ===== */
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo svg {
  width: 34px;
  height: 34px;
}
.logo svg polygon {
  fill: none;
  stroke: var(--red-bright);
  stroke-width: 2;
  filter: drop-shadow(0 0 6px rgba(255, 45, 45, 0.6));
}
.logo-text {
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 17px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

/* ===== 导航项（RSI 斜切角标签） ===== */
.nav-list {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--text-dim);
  padding: 9px 20px;
  margin: 0 3px;
  clip-path: polygon(0 38%, 12% 0, 100% 0, 100% 100%, 0 100%);
  background: transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover,
.nav-item.has-drop:hover .nav-link {
  background: rgba(225, 6, 0, 0.14);
  color: #fff;
  border-radius: 6px 2px 0 0;
}

.arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.3s ease;
}
.nav-item.has-drop:hover .arrow {
  transform: rotate(180deg);
}

/* ===== 下拉面板 ===== */
.drop-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  min-width: 210px;
  background: #121216;
  border: 1px solid var(--border);
  border-top: 2px solid var(--red);
  padding: 8px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
  z-index: 600;
}

.nav-item.has-drop:hover .drop-panel {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.drop-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  font-size: 14px;
  color: var(--text-dim);
  transition: color 0.2s ease, background 0.2s ease;
}

.drop-item:hover {
  color: #fff;
  background: rgba(225, 6, 0, 0.1);
}

.drop-icon {
  width: 8px;
  height: 8px;
  border: 1px solid var(--red-bright);
  transform: rotate(45deg);
  flex-shrink: 0;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.drop-item:hover .drop-icon {
  background: var(--red-bright);
  box-shadow: 0 0 8px rgba(255, 45, 45, 0.8);
}

/* ===== 汉堡菜单 ===== */
.burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  background: transparent;
  border: 1px solid var(--border-light);
  cursor: pointer;
  padding: 8px;
}
.burger span {
  display: block;
  height: 2px;
  width: 100%;
  background: var(--text);
  transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), opacity 0.2s;
}
.burger.is-open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.burger.is-open span:nth-child(2) {
  opacity: 0;
}
.burger.is-open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* ===== 移动端抽屉 ===== */
.mobile-menu {
  position: fixed;
  top: var(--nav-h);
  left: 0;
  right: 0;
  background: rgba(14, 14, 18, 0.98);
  border-bottom: 1px solid var(--border);
  padding: 12px 0;
  display: flex;
  flex-direction: column;
}
.mobile-link {
  padding: 15px 8%;
  font-size: 16px;
  letter-spacing: 1px;
  color: var(--text-dim);
  border-left: 2px solid transparent;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.mobile-link:hover {
  color: #fff;
  border-left-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.08);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 820px) {
  .nav-list {
    display: none;
  }
  .burger {
    display: flex;
  }
}
</style>

