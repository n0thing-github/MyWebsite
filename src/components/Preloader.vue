<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['done'])

const progress = ref(0)
// loading: 旋转加载 / reveal: 左右条纹扫过 / exit: 遮罩退出
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
      // 100% 停顿 450ms 后，才开始进场动画
      setTimeout(() => {
        phase.value = 'reveal'
        showCore.value = false // 核心通过 transition 淡出并从 DOM 移除
        // 条纹扫完后再退出遮罩
        setTimeout(() => {
          phase.value = 'exit'
          setTimeout(() => emit('done'), 750)
        }, 1200)
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
    <!-- 左右交替的红色斜切条纹 -->
    <div class="sweep">
      <span v-for="i in stripes" :key="i" :style="{ '--i': i }"></span>
    </div>

    <transition name="core">
      <div v-if="showCore" class="loader-core">
        <div class="logo-wrap">
          <svg class="logo-ring" viewBox="0 0 120 120">
            <polygon points="60,7 106,34 106,86 60,113 14,86 14,34" />
          </svg>
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

/* ===== 核心：logo + 进度（淡出后从 DOM 移除，避免回退） ===== */
.loader-core {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}

.core-leave-active {
  transition: opacity 0.35s ease, transform 0.45s ease;
}
.core-leave-to {
  opacity: 0;
  transform: scale(1.45);
}

.logo-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  animation: spin 3.2s linear infinite;
}

.logo-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.logo-ring polygon {
  fill: none;
  stroke: var(--red-bright);
  stroke-width: 2.5;
  stroke-dasharray: 320 320;
  stroke-dashoffset: 0;
  filter: drop-shadow(0 0 8px rgba(255, 45, 45, 0.7));
  animation: ring-draw 2.4s ease-in-out infinite alternate;
}

@keyframes ring-draw {
  0% { stroke-dashoffset: 320; }
  100% { stroke-dashoffset: 0; }
}

.logo-letter {
  font-family: var(--font-mono);
  font-size: 44px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 18px rgba(255, 45, 45, 0.8);
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

/* ===== 黑红斜切条纹（左右交替扫过） ===== */
.sweep {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.sweep span {
  position: absolute;
  left: 0;
  top: -10%;
  height: 120%;
  width: 36vw;
  background: linear-gradient(90deg, #8a0f0f, #e10600 50%, #8a0f0f);
  clip-path: polygon(28% 0, 100% 0, 72% 100%, 0 100%);
  opacity: 0;
}

/* 奇数：从左扫到右；偶数：从右扫到左 —— 形成「左右左右」交替 */
.sweep span:nth-child(odd) {
  transform: translateX(-50vw);
}
.sweep span:nth-child(even) {
  transform: translateX(120vw);
}

.preloader.is-reveal .sweep span {
  opacity: 1;
  animation-duration: 0.6s;
  animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1);
  animation-fill-mode: forwards;
  animation-delay: calc(var(--i) * 0.08s);
}
.preloader.is-reveal .sweep span:nth-child(odd) {
  animation-name: sweep-ltr;
}
.preloader.is-reveal .sweep span:nth-child(even) {
  animation-name: sweep-rtl;
}

@keyframes sweep-ltr {
  from { transform: translateX(-50vw); }
  to { transform: translateX(120vw); }
}

@keyframes sweep-rtl {
  from { transform: translateX(120vw); }
  to { transform: translateX(-50vw); }
}
</style>

