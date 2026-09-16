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

    <!-- doc 风格全屏展开菜单（斜切滑入） -->
    <transition name="unfold">
      <div v-if="menuOpen" class="unfold">
        <div class="unfold-options">
          <ul>
            <li v-for="item in navItems" :key="item.label">
              <a :href="item.href" @click="closeMenu"><span>{{ item.label }}</span></a>
            </li>
          </ul>
        </div>
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
  position: relative;
  z-index: 2; /* 高于展开菜单，保证按钮始终可点 */
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

/* 八边形描边：hover 或 active 时显现，缺口绕八边形转圈 */
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
  stroke-width: 1.5;
  stroke-dasharray: 55, 40;
  fill: none;
}
.doc-btn:hover .doc-btn-ring,
.doc-btn.is-active .doc-btn-ring {
  opacity: 1;
}
.doc-btn:hover .doc-btn-ring polygon,
.doc-btn.is-active .doc-btn-ring polygon {
  animation: ring-spin 1.4s linear infinite;
}

/* 缺口沿八边形周长（约 95）循环滚动，形成转圈效果 */
@keyframes ring-spin {
  to { stroke-dashoffset: -95; }
}

/* ===== doc 风格全屏展开菜单（斜切滑入/滑出） ===== */
.unfold {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 150%;
  background: var(--red);
  transform-origin: 0 0;
  z-index: 1; /* 低于 .nav-inner(2)，导航栏和按钮保持可点 */
  overflow: hidden;
}

.unfold-options {
  height: 100vh;
  display: grid;
  position: relative;
  padding: 100px 50px;
  grid-template-rows: repeat(5, 1fr);
  grid-template-columns: repeat(12, 1fr);
  align-items: start;
  z-index: 2;
}

.unfold-options ul {
  grid-row-start: 4;
  grid-column-start: 2;
  grid-column-end: span 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.unfold-options ul a {
  display: inline-block;
}

.unfold-options ul span {
  font-size: clamp(26px, 4.5vw, 50px);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.78);
  transition: color 0.3s ease;
}

/* 整体 hover 时其他项变暗，单项 hover 高亮（对齐 doc） */
.unfold-options ul:hover a span {
  color: rgba(255, 255, 255, 0.45);
}
.unfold-options ul a:hover span {
  color: #fff;
}

/* 过渡：skewY(-12deg) 斜切，从上滑入 / 向下滑出 */
.unfold-enter-active {
  transition-delay: 0.25s;
  transition: transform 0.4s ease-out;
}
.unfold-leave-active {
  transition: transform 0.4s cubic-bezier(0.21, 0.58, 0.74, 0.99);
}
.unfold-enter-from {
  transform: skewY(-12deg) translateY(-100%);
}
.unfold-enter-to,
.unfold-leave-from {
  transform: skewY(-12deg) translateY(0);
}
.unfold-leave-to {
  transform: skewY(-12deg) translateY(100%);
}

/* ===== 响应式 ===== */
@media (max-width: 820px) {
  .nav-list {
    display: none;
  }
  .unfold-options {
    grid-template-columns: repeat(6, 1fr);
    padding: 80px 8%;
  }
  .unfold-options ul {
    grid-column-start: 1;
    grid-column-end: span 6;
  }
}
</style>


