<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import lottie from 'lottie-web'
import animationData from '../assets/faze-transition.json'

const emit = defineEmits(['done'])

// loading: 旋转加载 / reveal: 播放扫屏 / exit: 遮罩退出
const phase = ref('loading')
const showCore = ref(true)
const container = ref(null)

let anim = null
let revealed = false

onMounted(() => {
  document.body.style.overflow = 'hidden'

  // 用 lottie-web 播放 faze 原版扫屏动画（loop: false, 不自动播放）
  anim = lottie.loadAnimation({
    container: container.value,
    renderer: 'svg',
    loop: false,
    autoplay: false,
    animationData,
    rendererSettings: {
      preserveAspectRatio: 'none',
      className: 'lottie-anim',
    },
  })

  anim.addEventListener('complete', () => {
    phase.value = 'exit'
    setTimeout(() => emit('done'), 750)
  })

  // 模拟资源加载完成后，logo 淡出 + 播放扫屏
  setTimeout(() => {
    if (revealed) return
    revealed = true
    phase.value = 'reveal'
    showCore.value = false
    anim.play()
  }, 2200)
})

onBeforeUnmount(() => {
  anim?.destroy()
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="preloader" :class="`is-${phase}`" aria-hidden="true">
    <!-- Lottie 扫屏动画（faze 原版） -->
    <div ref="container" class="lottie-container"></div>

    <!-- Logo：绕 Y 轴 3D 翻转 -->
    <transition name="core">
      <div v-if="showCore" class="loader-core">
        <div class="logo-wrap">
          <span class="logo-letter">M</span>
        </div>
        <span class="loader-label">INITIALIZING</span>
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
  overflow: hidden;
  transition: transform 0.75s cubic-bezier(0.76, 0, 0.24, 1);
}

/* 退出阶段：整体向上滑出 */
.preloader.is-exit {
  transform: translateY(-100%);
}

/* ===== Lottie 扫屏动画容器（z-index 6，位于 logo 下方） ===== */
.lottie-container {
  position: absolute;
  inset: 0;
  z-index: 6;
}
.lottie-container :deep(svg) {
  width: 100%;
  height: 100%;
}

/* ===== 核心：logo（z-index 8，位于动画上方） ===== */
.loader-core {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

.loader-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--text-dim);
}
</style>

