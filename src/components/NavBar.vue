<script setup>
import { ref, onBeforeUnmount } from 'vue'

// 右上角 doc 风格按钮：控制全屏展开菜单
const menuOpen = ref(false)

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

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  document.body.style.overflow = menuOpen.value ? 'hidden' : ''
}

function closeMenu() {
  menuOpen.value = false
  document.body.style.overflow = ''
}

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
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

          <div v-if="item.children" class="drop-panel">
            <a v-for="child in item.children" :key="child.label" class="drop-item" :href="child.href">
              <span class="drop-icon"></span>
              <span>{{ child.label }}</span>
            </a>
          </div>
        </li>
      </ul>

      <!-- doc 风格右上角按钮（SideBar）：两条线 + 八边形描边，点击变 X -->
      <button
        class="doc-btn"
        :class="{ 'is-active': menuOpen }"
        aria-label="菜单"
        @click="toggleMenu"
      >
        <svg class="doc-btn-ring" viewBox="0 0 30 30" aria-hidden="true">
          <polygon points="8,1 22,1 29,8 29,22 22,29 8,29 1,22 1,8 " />
        </svg>
        <span class="doc-btn-inner"></span>
      </button>
    </div>
  </header>

  <!-- Teleport 到 body：脱离 .navbar 的 backdrop-filter containing block，让 fixed 相对视口定位 -->
  <Teleport to="body">
    <!-- 遮罩（点击关闭侧边栏） -->
    <div class="sidebar-mask" :class="{ 'is-open': menuOpen }" @click="closeMenu"></div>

    <!-- 侧边栏（从右侧滑出） -->
    <aside class="sidebar" :class="{ 'is-open': menuOpen }">
      <div class="sidebar-head">
        <span class="sidebar-title">MENU</span>
        <button class="sidebar-close" aria-label="关闭" @click="closeMenu">×</button>
      </div>

      <nav class="sidebar-nav">
        <a
          v-for="item in navItems"
          :key="item.label"
          :href="item.href"
          @click="closeMenu"
        >
          <span class="sidebar-idx">0{{ navItems.indexOf(item) + 1 }}</span>
          {{ item.label }}
        </a>
      </nav>

      <div class="sidebar-block">
        <h4 class="sidebar-label">联系</h4>
        <a class="sidebar-link" href="https://github.com/n0thing-github" target="_blank" rel="noopener">GitHub</a>
        <a class="sidebar-link" href="mailto:n0thing-github@users.noreply.github.com">Email</a>
      </div>

      <div class="sidebar-block">
        <h4 class="sidebar-label">技能</h4>
        <div class="sidebar-tags">
          <span>Vue</span>
          <span>Vite</span>
          <span>JavaScript</span>
          <span>CSS</span>
          <span>Node.js</span>
        </div>
      </div>

      <p class="sidebar-foot">© 2026 N0THING · Built with Vue 3 + Vite</p>
    </aside>
  </Teleport>
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
  position: relative;
  z-index: 3; /* 高于侧边栏和遮罩，保证按钮始终可点 */
  width: min(1200px, 92%);
  height: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

/* ===== Logo ===== */
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
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
  margin-left: auto;
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

/* ===== doc 风格右上角按钮（复刻 doc 的 SideBar） ===== */
.doc-btn {
  position: relative;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.doc-btn-inner {
  position: absolute;
  left: 8px;
}

/* 两条线：初始间距 8px */
.doc-btn-inner::before,
.doc-btn-inner::after {
  content: '';
  position: absolute;
  height: 2px;
  width: 26px;
  background: var(--text);
  transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
.doc-btn-inner::before {
  margin-top: -3px;
}
.doc-btn-inner::after {
  margin-top: 5px;
}

/* hover：两条线展开 */
.doc-btn:hover .doc-btn-inner::before {
  margin-top: -10px;
}
.doc-btn:hover .doc-btn-inner::after {
  margin-top: 10px;
}

/* active：两条线旋转成 X */
.doc-btn.is-active .doc-btn-inner::before {
  margin-top: -10px;
  transform-origin: 0 50%;
  width: 28px;
  transform: translateX(3px) rotate(45deg);
}
.doc-btn.is-active .doc-btn-inner::after {
  margin-top: 10px;
  transform-origin: 0 50%;
  width: 28px;
  transform: translateX(3px) rotate(-45deg);
}

/* 八边形描边：hover 或 active 时显现，缺口移动一小段（对齐 doc） */
.doc-btn-ring {
  position: absolute;
  width: 60px;
  height: 60px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.doc-btn-ring polygon {
  stroke: var(--red-bright);
  stroke-width: 1;
  stroke-dasharray: 55, 40;
  fill: none;
  transition: stroke-dashoffset 0.3s ease;
}
.doc-btn:hover .doc-btn-ring,
.doc-btn.is-active .doc-btn-ring {
  opacity: 1;
}
.doc-btn:hover .doc-btn-ring polygon,
.doc-btn.is-active .doc-btn-ring polygon {
  stroke-dashoffset: -15;
}

/* ===== 遮罩（点击关闭，从导航栏下方覆盖内容区） ===== */
.sidebar-mask {
  position: fixed;
  top: var(--nav-h);
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 390; /* 高于页面内容，低于 .navbar(500) */
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.35s ease, visibility 0.35s;
}
.sidebar-mask.is-open {
  opacity: 1;
  visibility: visible;
}

/* ===== 侧边栏（从右侧滑出，位于导航栏下方） ===== */
.sidebar {
  position: fixed;
  top: var(--nav-h);
  right: 0;
  width: min(400px, 88vw);
  height: calc(100% - var(--nav-h));
  z-index: 400; /* 高于遮罩，低于 .navbar(500) */
  background: #0e0e12;
  border-left: 1px solid var(--border);
  border-top: 1px solid var(--border);
  padding: 26px 34px 34px;
  display: flex;
  flex-direction: column;
  gap: 26px;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.5);
}
.sidebar.is-open {
  transform: translateX(0);
}

/* 头部 */
.sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sidebar-title {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--text-dim);
}
.sidebar-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}
.sidebar-close:hover {
  border-color: var(--red-bright);
  color: var(--red-bright);
}

/* 导航 */
.sidebar-nav {
  display: flex;
  flex-direction: column;
}
.sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  transition: color 0.2s ease, padding-left 0.3s ease;
}
.sidebar-nav a:hover {
  color: var(--red-bright);
  padding-left: 8px;
}
.sidebar-idx {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--red-bright);
}

/* 区块 */
.sidebar-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sidebar-label {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--text-dim);
  text-transform: uppercase;
}
.sidebar-link {
  font-size: 15px;
  color: var(--text-dim);
  transition: color 0.2s ease;
}
.sidebar-link:hover {
  color: var(--red-bright);
}

.sidebar-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sidebar-tags span {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 5px 10px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}

.sidebar-foot {
  margin-top: auto;
  padding-top: 20px;
  font-size: 12px;
  color: var(--text-dim);
}

/* ===== 响应式 ===== */
@media (max-width: 820px) {
  .nav-list {
    display: none;
  }
}
</style>


