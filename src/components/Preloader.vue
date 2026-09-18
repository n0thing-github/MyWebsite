<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import lottie from 'lottie-web'
import animationData from '../assets/faze-transition.json'

const emit = defineEmits(['done'])

// loading: 黑色遮罩覆盖 + logo 旋转 / reveal: 反向播放揭示主页 / done: 移除
const phase = ref('loading')
const showCore = ref(true)
const container = ref(null)

let anim = null
let revealTimer = null
let revealFallbackTimer = null
let bootFallbackTimer = null

// 时序常量
const REVEAL_DELAY = 2200 // 模拟资源加载耗时后开始反向播放揭示主页
const REVEAL_FALLBACK = 2500 // reveal 开始后若 complete 事件丢失，强制收尾
const BOOT_FALLBACK = 6000 // 连 loading 阶段都卡住时的最终放行时间

function clearTimer(timer) {
  if (timer) clearTimeout(timer)
  return null
}

// 幂等收尾：无论走 Lottie 的 complete 还是兜底定时器，都只执行一次
function finish() {
  revealTimer = clearTimer(revealTimer)
  revealFallbackTimer = clearTimer(revealFallbackTimer)
  bootFallbackTimer = clearTimer(bootFallbackTimer)
  if (phase.value === 'done') return
  phase.value = 'done'
  document.body.style.overflow = ''
  emit('done')
}

// 反向播放：遮罩从上往下收缩揭示主页
function startReveal() {
  if (phase.value !== 'loading') return
  phase.value = 'reveal'
  showCore.value = false

  const duration = anim ? anim.getDuration(true) : 0
  if (!duration) {
    // 动画数据不可用：直接收尾，绝不把页面锁在遮罩后面
    finish()
    return
  }

  anim.setDirection(-1)
  anim.goToAndPlay(duration, true)

  // 兜底：iOS 上 requestAnimationFrame 会在切后台 / 低电量模式被暂停，Lottie 的 complete
  // 事件可能永远不来，此时透明的 .preloader 会一直盖住整页吞掉所有点击（移动端菜单
  // 点不开 / 关不掉的典型残留成因）。这里无论动画是否播完，到点都强制收尾。
  revealFallbackTimer = setTimeout(finish, REVEAL_FALLBACK)
}

onMounted(() => {
  document.body.style.overflow = 'hidden'

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

  anim.addEventListener('DOMLoaded', () => {
    // loading 阶段：跳到最后一帧，黑色遮罩全屏覆盖主页
    anim.goToAndStop(anim.getDuration(true), true)
  })

  anim.addEventListener('complete', () => {
    // 反向播放结束：遮罩已收缩，主页完全露出
    finish()
  })

  // 模拟资源加载完成后：反向播放，遮罩从上往下收缩揭示主页
  revealTimer = setTimeout(startReveal, REVEAL_DELAY)
  // 最终兜底：Lottie 加载/渲染失败时也要放行页面
  bootFallbackTimer = setTimeout(finish, BOOT_FALLBACK)
})

onBeforeUnmount(() => {
  revealTimer = clearTimer(revealTimer)
  revealFallbackTimer = clearTimer(revealFallbackTimer)
  bootFallbackTimer = clearTimer(bootFallbackTimer)
  anim?.destroy()
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="preloader" :class="`is-${phase}`" aria-hidden="true">
    <!-- Lottie 动画（黑色遮罩 + 红色斜切，反向播放揭示主页） -->
    <div ref="container" class="lottie-container"></div>

    <!-- Logo：绕 Y 轴 3D 翻转 -->
    <transition name="core">
      <div v-if="showCore" class="loader-core">
        <div class="logo-wrap">
          <span class="logo-letter">Y</span>
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
  transition: background-color 0.2s ease;
}

/* reveal 阶段：背景过渡透明，由 Lottie 黑色 shape 收缩揭示主页 */
.preloader.is-reveal {
  background: transparent;
  /* 兜底：若 complete 事件丢失导致遮罩收不回去，也绝不让这层透明遮罩吞掉整页点击 */
  pointer-events: none;
}

/* 动画完成后移除 */
.preloader.is-done {
  display: none;
  pointer-events: none;
}

/* ===== Lottie 动画容器（z-index 6，位于 logo 下方） ===== */
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

