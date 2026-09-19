<script setup>
import TechButton from './TechButton.vue'
</script>

<template>
  <section id="home" class="hero">
    <!-- 背景装饰 -->
    <div class="hero-deco" aria-hidden="true">
      <span class="h-line l1"></span>
      <span class="h-line l2"></span>
      <span class="h-ring"></span>
      <span class="h-cross c1">+</span>
      <span class="h-cross c2">+</span>
    </div>

    <div class="container hero-content">
      <div class="hero-head reveal">
        <span class="hero-tag">// WELCOME TO MY PORTFOLIO</span>
        <span class="hero-role">// Creator of PiusPrime // Full-Stack Developer</span>
      </div>

      <h1 class="hero-title reveal">
        你好，我是 <span class="accent">PIUSPRIME</span>
      </h1>

      <p class="hero-sub reveal">
        全栈开发者 · 创意工程师<br />
        专注构建沉浸式、未来感的 Web 体验
      </p>

      <div class="hero-actions reveal">
        <TechButton href="#portfolio">查看作品</TechButton>
        <TechButton href="#contact" ghost>联系我</TechButton>
      </div>
    </div>

    <a class="scroll-hint" href="#about" aria-label="向下滚动">
      <span class="mouse">
        <span class="wheel"></span>
      </span>
      <span class="hint-text">SCROLL</span>
    </a>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}

/* ===== 背景装饰 ===== */
.hero-deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.h-line {
  position: absolute;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(225, 6, 0, 0.5), transparent);
}
.h-line.l1 {
  top: 32%;
  left: 0;
  width: 100%;
}
.h-line.l2 {
  bottom: 24%;
  left: 0;
  width: 100%;
  transform: scaleX(0.6);
}

.h-ring {
  position: absolute;
  top: 14%;
  right: 6%;
  width: 380px;
  height: 380px;
  border: 1px solid rgba(225, 6, 0, 0.22);
  border-radius: 50%;
  animation: spin 24s linear infinite;
}
.h-ring::after {
  content: '';
  position: absolute;
  inset: 46px;
  border: 1px dashed rgba(225, 6, 0, 0.18);
  border-radius: 50%;
}

.h-cross {
  position: absolute;
  font-family: var(--font-mono);
  color: rgba(225, 6, 0, 0.5);
  font-size: 22px;
}
.h-cross.c1 {
  top: 26%;
  left: 12%;
  animation: pulse 2.6s ease-in-out infinite;
}
.h-cross.c2 {
  bottom: 30%;
  right: 18%;
  animation: pulse 3.2s ease-in-out infinite;
}

/* ===== 内容 ===== */
.hero-content {
  position: relative;
  z-index: 2;
}

/* 首屏标签组：主标签 + 一行小字副标 */
.hero-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 26px;
}

.hero-tag {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--cyan);
}

.hero-role {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: 1.6px;
  color: var(--text-dim);
}

@media (max-width: 640px) {
  .hero-role {
    font-size: 11px;
    letter-spacing: 1px;
  }
}

.hero-title {
  font-size: clamp(38px, 7.5vw, 82px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 26px;
}

.hero-title .accent {
  color: var(--red-bright);
  text-shadow: 0 0 30px rgba(255, 45, 45, 0.6);
}

.hero-sub {
  color: var(--text-dim);
  font-size: 18px;
  line-height: 1.9;
  margin-bottom: 40px;
}

.hero-actions {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
}

/* ===== 滚动提示 ===== */
.scroll-hint {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-dim);
  z-index: 2;
}
.mouse {
  width: 24px;
  height: 38px;
  border: 2px solid var(--text-dim);
  border-radius: 12px;
  display: flex;
  justify-content: center;
  padding-top: 6px;
}
.wheel {
  width: 3px;
  height: 8px;
  background: var(--red-bright);
  border-radius: 2px;
  animation: wheel 1.8s ease-in-out infinite;
}
@keyframes wheel {
  0% { transform: translateY(0); opacity: 1; }
  70% { transform: translateY(14px); opacity: 0; }
  100% { transform: translateY(0); opacity: 0; }
}
.hint-text {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 3px;
}
</style>
