<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import steam from '../data/steam-games.json'

/**
 * 每张停留时长（毫秒），同时也是分页进度条的 animation-duration。
 *
 * 这里刻意不让 JS 计时器管切换：进度条动画的 animationend 才是唯一时钟。
 * 好处是「悬停暂停」只要一句 animation-play-state: paused，
 * 进度条与自动切换天然同步，不会各走各的。
 */
const DURATION = 6000

const games = computed(() => steam.games.filter((g) => g.hero || g.header))
const idx = ref(0)
/** 每次切换 +1，用作进度条元素的 key —— 强制重建才能重启动画 */
const tick = ref(0)
const reduce = ref(false)

let fallbackTimer = null

function fmtDuration(minutes) {
  if (!minutes) return '未游玩'
  if (minutes < 60) return `${minutes} 分钟`
  const h = minutes / 60
  return h >= 100 ? `${Math.round(h).toLocaleString('zh-CN')} h` : `${h.toFixed(1)} h`
}

const pad = (n) => String(n).padStart(2, '0')

function go(i) {
  const len = games.value.length
  if (!len) return
  idx.value = ((i % len) + len) % len
  tick.value++
}
const next = () => go(idx.value + 1)
const prev = () => go(idx.value - 1)

/** reduce 模式下进度条动画不跑，改用定时器兜底驱动切换 */
function scheduleFallback() {
  clearTimeout(fallbackTimer)
  fallbackTimer = setTimeout(() => {
    next()
    scheduleFallback()
  }, DURATION)
}

/** 进度条填充完毕 → 该翻下一张 */
function onFillEnd() {
  if (!reduce.value) next()
}

/** library_hero 缺失时退回 header，保证画面不空 */
function onImgError(event, g) {
  const img = event.target
  if (g.header && !img.src.endsWith(g.header)) img.src = g.header
}

onMounted(() => {
  reduce.value = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce.value) scheduleFallback()

  // 首图之外的大图等浏览器空闲再预取，别和首屏抢带宽
  const preload = () => games.value.slice(1).forEach((g) => { new Image().src = g.hero })
  if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 3500 })
  else setTimeout(preload, 2000)
})

onBeforeUnmount(() => clearTimeout(fallbackTimer))
</script>

<template>
  <section id="featured" class="banner" :style="{ '--bn-dur': `${DURATION}ms` }">
    <div class="bn-frame reveal">
      <div class="bn-stage">
        <a
          v-for="(g, i) in games"
          :key="g.appid"
          class="bn-slide"
          :class="{ 'is-on': i === idx }"
          :href="`https://store.steampowered.com/app/${g.appid}/`"
          target="_blank"
          rel="noopener"
          :aria-hidden="i !== idx"
          :tabindex="i === idx ? 0 : -1"
        >
          <img
            :src="g.hero"
            :alt="g.name"
            :loading="i === 0 ? 'eager' : 'lazy'"
            decoding="async"
            @error="onImgError($event, g)"
          />
          <span class="bn-veil"></span>
          <span class="bn-copy">
            <span class="bn-kicker">// FEATURED GAME</span>
            <span class="bn-title">{{ g.name }}</span>
            <span class="bn-meta">
              <span class="bn-hours">{{ fmtDuration(g.minutes) }}</span>
              <span v-if="g.twoWeeksMinutes" class="bn-recent">
                近两周 {{ fmtDuration(g.twoWeeksMinutes) }}
              </span>
            </span>
          </span>
        </a>

        <button class="bn-nav bn-nav--prev" type="button" aria-label="上一张" @click="prev">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <button class="bn-nav bn-nav--next" type="button" aria-label="下一张" @click="next">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>

        <span class="bn-hud">STEAM LIBRARY · {{ pad(games.length) }} TITLES</span>
      </div>

      <!-- 分页：细条 + 红色进度填充（取自 faze 的 header-banners__pagination） -->
      <div class="bn-pager" role="tablist" aria-label="选择宣传图">
        <button
          v-for="(g, i) in games"
          :key="g.appid"
          class="bn-bullet"
          :class="{ 'is-on': i === idx }"
          type="button"
          role="tab"
          :aria-selected="i === idx"
          :aria-label="g.name"
          @click="go(i)"
        >
          <span v-if="i === idx" :key="tick" class="bn-bullet-inner" @animationend="onFillEnd"></span>
        </button>
        <span class="bn-count"><b>{{ pad(idx + 1) }}</b> / {{ pad(games.length) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.banner {
  position: relative;
  padding: 84px 0 92px;
  overflow: hidden;
}

/* 上下两条红色扫描边，给通栏一个收口 */
.banner::before,
.banner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(225, 6, 0, 0.5), transparent);
  pointer-events: none;
}
.banner::before { top: 0; }
.banner::after { bottom: 0; }

.bn-frame {
  position: relative;
  width: min(1440px, 94%);
  margin: 0 auto;
}

/* ===== 舞台 ===== */
.bn-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 3.1 / 1; /* 贴近 library_hero 原图比例，尽量少裁切 */
  overflow: hidden;
  /* 兜底底色：访客若连不上 Steam CDN，画面也不会塌成纯黑 */
  background:
    radial-gradient(ellipse 80% 130% at 16% 100%, rgba(225, 6, 0, 0.2), transparent 60%),
    linear-gradient(135deg, #16161c 0%, #0a0a0c 55%, #151019 100%);
  border: 1px solid var(--border);
}

.bn-slide {
  position: absolute;
  inset: 0;
  display: block;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.9s ease, visibility 0.9s;
}
.bn-slide.is-on {
  opacity: 1;
  visibility: visible;
  z-index: 2;
}

.bn-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.92) contrast(1.06) brightness(0.76);
  transform: scale(1);
  transition: transform 9s linear;
}
/* 激活后缓慢推近（Ken Burns）：停留多久就推多久 */
.bn-slide.is-on img {
  transform: scale(1.09);
}

/* 文字可读性遮罩：左侧压暗 + 底部渐隐 + 左下角红色氛围 */
.bn-veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(6, 6, 8, 0.94) 0%, rgba(6, 6, 8, 0.55) 40%, transparent 70%),
    linear-gradient(0deg, rgba(6, 6, 8, 0.9) 0%, transparent 48%),
    radial-gradient(ellipse 60% 110% at 0% 100%, rgba(225, 6, 0, 0.22), transparent 70%);
}

.bn-copy {
  position: absolute;
  left: 5.5%;
  bottom: 17%;
  z-index: 3;
  max-width: 58%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bn-kicker {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--cyan);
}
.bn-title {
  font-size: clamp(24px, 3.6vw, 50px);
  font-weight: 800;
  line-height: 1.06;
  letter-spacing: 1px;
  color: #fff;
  text-shadow: 0 2px 26px rgba(0, 0, 0, 0.9);
}
.bn-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.bn-hours {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--red-bright);
  text-shadow: 0 0 16px rgba(255, 45, 45, 0.6);
}
.bn-recent {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--cyan);
  padding: 3px 8px;
  border: 1px solid rgba(0, 229, 255, 0.3);
  background: rgba(0, 229, 255, 0.07);
}

/* 右上角 HUD 标 */
.bn-hud {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 4;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 2px;
  color: rgba(236, 236, 240, 0.66);
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(8, 8, 10, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ===== 左右箭头 ===== */
.bn-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  color: var(--text);
  background: rgba(10, 10, 12, 0.5);
  border: 1px solid var(--border-light);
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: color 0.25s, border-color 0.25s, background 0.25s, box-shadow 0.25s;
}
.bn-nav svg {
  width: 22px;
  height: 22px;
}
.bn-nav:hover {
  color: #fff;
  border-color: rgba(225, 6, 0, 0.75);
  background: rgba(225, 6, 0, 0.2);
  box-shadow: 0 0 26px -6px rgba(255, 45, 45, 0.9);
}
.bn-nav--prev { left: 18px; }
.bn-nav--next { right: 18px; }

/* ===== 分页器 ===== */
.bn-pager {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  z-index: 5;
  width: min(860px, 82%);
  display: flex;
  align-items: center;
  gap: 8px;
}
.bn-bullet {
  position: relative;
  flex: 1 1 0;
  height: 4px;
  padding: 0;
  border: 0;
  background: rgba(255, 255, 255, 0.22);
  cursor: pointer;
  transition: background 0.25s;
}
/* 细条也要好点：把可点区域上下各撑 14px */
.bn-bullet::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -14px;
  bottom: -14px;
}
.bn-bullet:hover,
.bn-bullet.is-on {
  background: rgba(255, 255, 255, 0.3);
}
.bn-bullet-inner {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: var(--red-bright);
  box-shadow: 0 0 12px rgba(255, 45, 45, 0.85);
  animation: bnFill var(--bn-dur, 6000ms) linear forwards;
}
@keyframes bnFill {
  from { width: 0; }
  to { width: 100%; }
}
/* 悬停整个 banner：进度条与自动切换一起暂停（同一个时钟） */
.banner:hover .bn-bullet-inner {
  animation-play-state: paused;
}

.bn-count {
  flex: 0 0 auto;
  margin-left: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-dim);
  white-space: nowrap;
}
.bn-count b {
  color: var(--red-bright);
}

/* ===== 响应式 ===== */
@media (max-width: 1100px) {
  .bn-stage { aspect-ratio: 2.4 / 1; }
  .bn-copy { bottom: 20%; max-width: 70%; }
}
@media (max-width: 768px) {
  .banner { padding: 62px 0 70px; }
  .bn-stage { aspect-ratio: 1.5 / 1; }
  .bn-nav { width: 34px; height: 34px; }
  .bn-nav svg { width: 17px; height: 17px; }
  .bn-nav--prev { left: 7px; }
  .bn-nav--next { right: 7px; }
  /* 窄屏上箭头与中部文字块会撞在一起，给文字左右各让出 55px */
  .bn-copy { left: 55px; right: 55px; bottom: 22%; max-width: none; gap: 8px; }
  .bn-pager { bottom: 14px; width: 86%; }
  .bn-hud { top: 10px; right: 12px; font-size: 9.5px; }
}

/* ===== 减少动态效果 ===== */
@media (prefers-reduced-motion: reduce) {
  .bn-slide,
  .bn-slide img,
  .bn-slide.is-on img {
    transition: none;
  }
  .bn-slide.is-on img { transform: none; }
  .bn-bullet-inner { animation: none; }
}
</style>
