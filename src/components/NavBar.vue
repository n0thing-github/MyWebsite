<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

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
  { label: '游戏', href: '#steam' },
  { label: '联系', href: '#contact' },
]

// 滚动锁：不再写 body 的 inline style（iOS Safari 对 body{overflow:hidden} 不生效，
// 而且会和 Preloader 的 inline overflow 互相覆盖），改为在 <html> 上挂 class，由 CSS 同时锁 html/body。
function syncScrollLock(open) {
  document.documentElement.classList.toggle('menu-open', open)
}

watch(menuOpen, syncScrollLock)
syncScrollLock(menuOpen.value) // 首次对齐，避免残留的锁定状态

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

onBeforeUnmount(() => {
  syncScrollLock(false)
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
  /* 比 body(--bg #0a0a0c) 更亮的玻璃面板：自上而下由 #1c1c23 渐隐，避免与背景糊在一起 */
  background: linear-gradient(180deg, rgba(30, 30, 38, 0.95) 0%, rgba(14, 14, 18, 0.9) 100%);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border-bottom: 1px solid rgba(225, 6, 0, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    0 16px 48px rgba(0, 0, 0, 0.75),
    0 34px 70px -36px rgba(225, 6, 0, 0.55);
}

/* 底部流动的红色能量线（导航栏与内容区的分界标识） */
.navbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(225, 6, 0, 0.75) 16%,
    var(--red-bright) 50%,
    rgba(225, 6, 0, 0.75) 84%,
    transparent 100%
  );
  background-size: 200% 100%;
  box-shadow: 0 0 16px rgba(255, 45, 45, 0.6);
  animation: navFlow 6s linear infinite;
  pointer-events: none;
}

@keyframes navFlow {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
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
  transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s ease;
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
  transition: color 0.3s ease, text-shadow 0.3s ease, letter-spacing 0.4s ease;
}

/* Logo hover：六边形旋转半圈 + 整体红光增亮 */
.logo:hover svg {
  transform: rotate(180deg);
  filter: drop-shadow(0 0 14px rgba(255, 45, 45, 0.95));
}
.logo:hover .logo-text {
  color: #fff;
  letter-spacing: 2.5px;
  text-shadow: 0 0 16px rgba(255, 45, 45, 0.75);
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
  position: relative;
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
  transition: color 0.25s ease, transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.32s ease;
}

/* 文字与箭头抬到充能层之上（否则绝对定位伪元素会盖住文字） */
.nav-link > * {
  position: relative;
  z-index: 1;
}

/* ① 淡红能量自下而上充能，沿 clip-path 斜切形状生长 */
.nav-link::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(225, 6, 0, 0.16) 0%, rgba(225, 6, 0, 0.46) 100%);
  transform: translateY(101%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ② 底部亮红能量线，从左向右拉伸 */
.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: var(--red-bright);
  box-shadow: 0 0 14px 4px rgba(255, 45, 45, 0.75);
  transform: scaleX(0);
  transform-origin: 0 50%;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.nav-link:hover,
.nav-item.has-drop:hover .nav-link {
  color: #fff;
  /* ③ 白热文字 + 红色外溢光 */
  text-shadow: 0 0 14px rgba(255, 45, 45, 0.9), 0 0 4px rgba(255, 255, 255, 0.5);
  /* ④ 斜切形状内部的红色光晕（inset 不会被 clip-path 裁掉） */
  box-shadow: inset 0 0 22px rgba(225, 6, 0, 0.55);
  /* ⑤ 轻微上浮 */
  transform: translateY(-1px);
}

.nav-link:hover::before,
.nav-item.has-drop:hover .nav-link::before {
  transform: translateY(0);
}

.nav-link:hover::after,
.nav-item.has-drop:hover .nav-link::after {
  transform: scaleX(1);
}

.arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.3s ease, color 0.25s ease, filter 0.3s ease;
}
.nav-item.has-drop:hover .arrow {
  transform: rotate(180deg);
  color: var(--red-bright);
  filter: drop-shadow(0 0 7px rgba(255, 45, 45, 0.95));
}

/* ===== 下拉面板 ===== */
.drop-panel {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  min-width: 210px;
  background: linear-gradient(180deg, #17171d 0%, #101015 100%);
  border: 1px solid var(--border-light);
  border-top: 2px solid var(--red);
  padding: 8px;
  opacity: 0;
  visibility: hidden;
  box-shadow:
    0 22px 50px rgba(0, 0, 0, 0.8),
    0 0 34px -12px rgba(225, 6, 0, 0.6);
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
  z-index: 600;
}

.nav-item.has-drop:hover .drop-panel {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.drop-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  font-size: 14px;
  color: var(--text-dim);
  overflow: hidden;
  transition: color 0.2s ease, background 0.2s ease, padding-left 0.28s ease;
}

/* 左侧红色能量条：hover 时上下张开 */
.drop-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--red-bright);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.9);
  transform: scaleY(0);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.drop-item:hover {
  color: #fff;
  background: rgba(225, 6, 0, 0.12);
  padding-left: 18px;
  text-shadow: 0 0 12px rgba(255, 45, 45, 0.8);
}
.drop-item:hover::before {
  transform: scaleY(1);
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
  /* iOS Safari 加固：touch-action:manipulation 关掉「双击缩放」。
     真机上快速第二次点按会被 Safari 的双击缩放判定吞掉（桌面 CDP 触摸模拟不会触发这个判定），
     一旦误触发缩放，视觉视口被放大+偏移，同一屏幕坐标映射到不同布局坐标，会点到按钮以外的地方。 */
  touch-action: manipulation;
  /* 去掉 iOS 点击时的灰色高亮块，保持既有视觉风格 */
  -webkit-tap-highlight-color: transparent;
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

/* hover：两条线展开
   iOS 触摸后 :hover 会一直「粘」在元素上（sticky hover），松手后按钮会停在 hover 展开态，
   视觉上像菜单没恢复。用 @media (hover: hover) 只在真正支持指针悬停的设备上生效，
   触摸设备的状态一律由 .is-active 表达。 */
@media (hover: hover) {
  .doc-btn:hover .doc-btn-inner::before {
    margin-top: -10px;
  }
  .doc-btn:hover .doc-btn-inner::after {
    margin-top: 10px;
  }
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
.doc-btn.is-active .doc-btn-ring {
  opacity: 1;
}
.doc-btn.is-active .doc-btn-ring polygon {
  stroke-dashoffset: -15;
}
/* hover 版同上：不放进 @media (hover: hover) 的话，iOS 上关闭后八边形描边会残留，
   看起来仍然像「展开中」 */
@media (hover: hover) {
  .doc-btn:hover .doc-btn-ring {
    opacity: 1;
  }
  .doc-btn:hover .doc-btn-ring polygon {
    stroke-dashoffset: -15;
  }
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
  /* 点遮罩关闭同样是高频连点操作，去掉双击缩放判定 */
  touch-action: manipulation;
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
  /* iOS：禁止滚动链（滚到侧边栏底部时不要带动后面的页面橡皮筋） */
  overscroll-behavior: contain;
  touch-action: manipulation;
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
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
@media (hover: hover) {
  .sidebar-close:hover {
    border-color: var(--red-bright);
    color: var(--red-bright);
  }
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
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
/* iOS sticky hover：不包起来的话，点过的菜单项会一直保持高亮/缩进 */
@media (hover: hover) {
  .sidebar-nav a:hover {
    color: var(--red-bright);
    padding-left: 8px;
  }
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
@media (hover: hover) {
  .sidebar-link:hover {
    color: var(--red-bright);
  }
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

/* ===== 滚动锁（iOS 友好：同时锁 html 与 body） =====
   iOS Safari 对 body{overflow:hidden} 基本无效，必须锁 html；
   用 <html class="menu-open"> 集中控制，避免 NavBar / Preloader / App 多处写 inline style 互相覆盖。 */
:global(html.menu-open) {
  overflow: hidden;
}
:global(html.menu-open body) {
  overflow: hidden;
  overscroll-behavior: none;
}

/* ===== 响应式 ===== */
@media (max-width: 820px) {
  .nav-list {
    display: none;
  }
}
</style>


