<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['done'])

const progress = ref(0)
// loading: 旋转加载中 / reveal: 黑红条纹扫过 / exit: 遮罩退出
const phase = ref('loading')

onMounted(() => {
  document.body.style.overflow = 'hidden'
  const tick = () => {
    const inc = Math.random() * 12 + 7
    progress.value = Math.min(100, progress.value + inc)
    if (progress.value >= 100) {
      progress.value = 100
      phase.value = 'reveal'
      setTimeout(() => {
        phase.value = 'exit'
        setTimeout(() => emit('done'), 750)
      }, 1000)
    } else {
      setTimeout(tick, 120)
    }
  }
  setTimeout(tick, 350)
})
</script>

<template>
  <div class="preloader" :class="`is-${phase}`" aria-hidden="true">
    <!-- 黑红斜切条纹（reveal 阶段扫过） -->
    <div class="sweep">
      <span v-for="i in 6" :key="i" :style="{ '--i': i }"></span>
    </div>

    <div class="loader-core">
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

/* ===== 核心：logo + 进度 ===== */
.loader-core {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  transition: opacity 0.4s ease, transform 0.5s ease;
}

.preloader.is-reveal .loader-core {
  opacity: 0;
  transform: scale(1.5);
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

/* ===== 黑红斜切条纹 ===== */
.sweep {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.sweep span {
  position: absolute;
  top: -10%;
  height: 120%;
  width: 22vw;
  background: linear-gradient(
    to right,
    transparent,
    rgba(225, 6, 0, 0.9),
    transparent
  );
  clip-path: polygon(30% 0, 100% 0, 70% 100%, 0 100%);
  transform: translateX(120vw);
  opacity: 0;
}

.preloader.is-reveal .sweep span {
  animation: sweep-across 1s cubic-bezier(0.85, 0, 0.15, 1) forwards;
  animation-delay: calc(var(--i) * 0.07s);
  opacity: 1;
}

@keyframes sweep-across {
  from { transform: translateX(120vw); }
  to { transform: translateX(-40vw); }
}
</style>
