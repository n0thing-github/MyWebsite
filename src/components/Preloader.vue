<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['done'])

const progress = ref(0)
// loading: 旋转加载 / reveal: 左右扫屏 / exit: 遮罩退出
const phase = ref('loading')
const showCore = ref(true)

const stripes = 8

onMounted(() => {
  document.body.style.overflow = 'hidden'

  const tick = () => {
    if (progress.value >= 100) return
    const remaining = 100 - progress.value
    // 最后阶段放慢，让 100% 清晰可见
    const inc = remaining < 16 ? Math.random() * 4 + 2 : Math.random() * 12 + 7
    progress.value = Math.min(100, progress.value + inc)

    if (progress.value >= 100) {
      progress.value = 100
      // 100% 停顿 450ms 后，播放 670ms 扫屏动画（对齐 faze 的 Lottie 时长）
      setTimeout(() => {
        phase.value = 'reveal'
        showCore.value = false // 核心淡出并从 DOM 移除
        setTimeout(() => {
          phase.value = 'exit'
          setTimeout(() => emit('done'), 750)
        }, 670)
      }, 450)
    } else {
      setTimeout(tick, 110)
    }
  }
  setTimeout(tick, 350)
})
</script>

<template>
  <div class="preloader" :class="`is-${phase}`" aria-hidden="true">
    <!-- 左右交替的红色斜切块（扫屏） -->
    <div class="sweep">
      <span v-for="i in stripes" :key="i" :style="{ '--i': i }"></span>
    </div>

    <transition name="core">
      <div v-if="showCore" class="loader-core">
        <!-- Logo：绕 Y 轴 3D 翻转（对齐 faze 的 rotateY） -->
        <div class="logo-wrap">
          <span class="logo-letter">M</span>
        </div>

        <div class="loader-meta">
          <span class="loader-label">INITIALIZING</span>
          <span class="loader-percent">{{ Math.floor(progress) }}%</span>
        </div>

        <div class="progress-track">
          <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.preloader {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #050506;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.75s cubic-bezier(0.76, 0, 0.24, 1);
}

/* 退出阶段：整体向上滑出 */
.preloader.is-exit {
  transform: translateY(-100%);
}

/* ===== 核心：logo + 进度（淡出后从 DOM 移除） ===== */
.loader-core {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.core-leave-active {
  transition: opacity 0.3s ease, transform 0.4s ease;
}
.core-leave-to {
  opacity: 0;
  transform: scale(1.35);
}

/* ===== Logo：绕 Y 轴 3D 翻转（对齐 faze 的 rotateY） ===== */
.logo-wrap {
  perspective: 900px;
}

.logo-letter {
  display: block;
  font-family: var(--font-mono);
  font-size: 96px;
  font-weight: 900;
  line-height: 1;
  color: #fff;
  text-shadow: 0 0 26px rgba(237, 0, 0, 0.85);
  transform-style: preserve-3d;
  will-change: transform;
  animation: loadingLogoAnim 1.5s linear 0.2s infinite;
}

@keyframes loadingLogoAnim {
  0% { transform: rotateY(0); }
  100% { transform: rotateY(1turn); }
}

.loader-meta {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.loader-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--text-dim);
}

.loader-percent {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 700;
  color: var(--red-bright);
  min-width: 62px;
  text-align: right;
}

.progress-track {
  width: 240px;
  height: 2px;
  background: #1c1c22;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--red-dim), var(--red-bright));
  box-shadow: 0 0 12px rgba(255, 45, 45, 0.8);
  transition: width 0.15s linear;
}

/* ===== 红色斜切块：左右交替快速扫屏（约 670ms，对齐 faze Lottie） ===== */
.sweep {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.sweep span {
  position: absolute;
  left: 0;
  top: -12%;
  height: 124%;
  width: 40vw;
  background: linear-gradient(90deg, #8a0f0f, #ed0000 50%, #8a0f0f);
  clip-path: polygon(30% 0, 100% 0, 70% 100%, 0 100%);
  opacity: 0;
}

/* 奇数从左到右，偶数从右到左 —— 「左右左右」交替 */
.sweep span:nth-child(odd) {
  transform: translateX(-55vw);
}
.sweep span:nth-child(even) {
  transform: translateX(115vw);
}

.preloader.is-reveal .sweep span {
  opacity: 1;
  animation-duration: 0.3s;
  animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1);
  animation-fill-mode: forwards;
  animation-delay: calc(var(--i) * 0.05s);
}
.preloader.is-reveal .sweep span:nth-child(odd) {
  animation-name: sweep-ltr;
}
.preloader.is-reveal .sweep span:nth-child(even) {
  animation-name: sweep-rtl;
}

@keyframes sweep-ltr {
  from { transform: translateX(-55vw); }
  to { transform: translateX(115vw); }
}

@keyframes sweep-rtl {
  from { transform: translateX(115vw); }
  to { transform: translateX(-55vw); }
}
</style>

