<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['done'])

// loading: 旋转加载 / reveal: 红色斜切从上往下揭示 / done: 移除
const phase = ref('loading')
const showCore = ref(true)

onMounted(() => {
  document.body.style.overflow = 'hidden'

  // 模拟资源加载完成后，红色斜切从上往下扫，揭示主页
  setTimeout(() => {
    phase.value = 'reveal'
    showCore.value = false
    setTimeout(() => {
      phase.value = 'done'
      document.body.style.overflow = ''
      emit('done')
    }, 700) // 670ms 揭示动画 + 余量
  }, 2200)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="preloader" :class="`is-${phase}`" aria-hidden="true">
    <!-- 黑色遮罩（含 logo）：clip-path 从上往下收缩，揭示主页 -->
    <div class="cover">
      <transition name="core">
        <div v-if="showCore" class="loader-core">
          <div class="logo-wrap">
            <span class="logo-letter">M</span>
          </div>
          <span class="loader-label">INITIALIZING</span>
        </div>
      </transition>
    </div>

    <!-- 红色斜切块：跟随边界从上往下扫 -->
    <div class="red-sweep"></div>
  </div>
</template>

<style scoped>
.preloader {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: transparent;
  overflow: hidden;
  pointer-events: none;
}

/* 动画完成后移除 */
.preloader.is-done {
  display: none;
}

/* ===== 黑色遮罩：clip-path 从顶部往下收缩（上往下揭示主页） ===== */
.cover {
  position: absolute;
  inset: 0;
  z-index: 8;
  background: #050506;
  clip-path: polygon(0 0, 100% -12%, 100% 100%, 0 100%);
  transition: clip-path 0.67s cubic-bezier(0.85, 0, 0.15, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preloader.is-reveal .cover {
  clip-path: polygon(0 100%, 100% 88%, 100% 100%, 0 100%);
}

/* ===== 核心：logo（淡出后从 DOM 移除） ===== */
.loader-core {
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

.loader-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 4px;
  color: var(--text-dim);
}

/* ===== 红色斜切块：跟随边界从上往下扫 ===== */
.red-sweep {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 22vh;
  z-index: 9;
  background: linear-gradient(180deg, #ed0000, #7a0a0a);
  transform: translateY(-130%) skewY(-8deg);
  transform-origin: 0 0;
  transition: transform 0.67s cubic-bezier(0.85, 0, 0.15, 1);
}

.preloader.is-reveal .red-sweep {
  transform: translateY(110vh) skewY(-8deg);
}
</style>

