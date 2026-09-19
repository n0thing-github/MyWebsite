<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import steam from '../data/steam-games.json'

/** 首屏只渲染这么多张卡片，其余折叠 */
const INITIAL_COUNT = 12

const showAll = ref(false)
const sortKey = ref('playtime')
const statsEl = ref(null)

const SORTS = [
  { key: 'playtime', label: '游玩时长' },
  { key: 'recent', label: '最近游玩' },
  { key: 'name', label: '名称' },
]

const hasRecent = steam.recentMinutes > 0

/* ---------- 排序（在副本上排，不改原数组） ---------- */
const sorted = computed(() => {
  const list = [...steam.games]
  if (sortKey.value === 'recent') {
    return list.sort((a, b) => b.twoWeeksMinutes - a.twoWeeksMinutes || b.minutes - a.minutes)
  }
  if (sortKey.value === 'name') {
    return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  }
  return list.sort((a, b) => b.minutes - a.minutes)
})

const visible = computed(() =>
  showAll.value ? sorted.value : sorted.value.slice(0, INITIAL_COUNT),
)
const hiddenCount = computed(() => Math.max(0, sorted.value.length - INITIAL_COUNT))

/* ---------- 相对时长条 ---------- */
const peakMinutes = computed(() =>
  steam.games.reduce((max, g) => (g.minutes > max ? g.minutes : max), 1),
)
const barWidth = (g) => `${Math.max(2, Math.round((g.minutes / peakMinutes.value) * 100))}%`

/* ---------- 显示格式 ---------- */
function fmtDuration(minutes) {
  if (!minutes) return '未游玩'
  if (minutes < 60) return `${minutes} 分钟`
  const hours = minutes / 60
  return hours >= 100
    ? `${Math.round(hours).toLocaleString('zh-CN')} h`
    : `${hours.toFixed(1)} h`
}
function fmtHours(hours) {
  if (hours >= 1000) return Math.round(hours).toLocaleString('zh-CN')
  if (hours >= 100) return String(Math.round(hours))
  return hours.toFixed(1)
}

const updatedText = computed(() => {
  if (!steam._meta.updated) return ''
  return new Date(steam._meta.updated).toLocaleDateString('zh-CN')
})

/* ---------- 图标缺失 / 404 时退回头图，保证卡片永远有画面 ---------- */
function onIconError(event) {
  const img = event.target
  if (img.dataset.fallback === '1') {
    img.style.visibility = 'hidden'
    return
  }
  img.dataset.fallback = '1'
  img.src = img.dataset.header
}

/* ---------- 头像域名在部分网络不可达：静默隐藏，避免出现碎图图标（昵称文字保留） ---------- */
function onAvatarError(event) {
  event.target.style.display = 'none'
}

/* ---------- 统计数字滚动 ---------- */
const finalStats = {
  count: steam._meta.count,
  hours: steam.totalMinutes / 60,
  recent: steam.recentMinutes / 60,
}
const shown = ref({ count: 0, hours: 0, recent: 0 })
const ANIM_MS = 1300
let io = null
let raf = null
let settleTimer = null

function countUp() {
  // 尊重「减少动态效果」偏好
  const reduce =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    shown.value = { ...finalStats }
    return
  }

  const settle = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = null
    clearTimeout(settleTimer)
    settleTimer = null
    // 收尾取精确值，避免缓动误差
    shown.value = { ...finalStats }
  }

  // 起点必须取自首个 rAF 时间戳：它与后续回调同基准，
  // 而 performance.now() 在虚拟时钟 / 系统时钟调整下可能不同基准，会算出负值。
  let t0 = null
  const tick = (now) => {
    if (t0 === null) t0 = now
    const p = Math.min(1, Math.max(0, (now - t0) / ANIM_MS))
    if (p >= 1) {
      settle()
      return
    }
    const e = 1 - (1 - p) ** 3
    shown.value = {
      count: Math.round(finalStats.count * e),
      hours: finalStats.hours * e,
      recent: finalStats.recent * e,
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  // 兜底：rAF 在后台标签页 / 省电模式下会被节流甚至暂停，
  // 这里保证动画时长后数字一定落到最终值，不会永远停在 0。
  settleTimer = setTimeout(settle, ANIM_MS + 250)
}

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !statsEl.value) {
    shown.value = { ...finalStats }
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        io?.disconnect()
        io = null
        countUp()
      }
    },
    { threshold: 0.3 },
  )
  io.observe(statsEl.value)
})

onBeforeUnmount(() => {
  io?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  clearTimeout(settleTimer)
})
</script>

<template>
  <section id="steam" class="section steam">
    <div class="container">
      <span class="section-tag">Steam</span>
      <h2 class="section-title">游戏<span class="accent">时光</span></h2>
      <p class="section-desc">代码之外的另一片战场，以下数据同步自我的 Steam 游戏库。</p>

      <!-- 统计条 -->
      <div ref="statsEl" class="stats reveal">
        <div class="stat">
          <span class="stat-num">{{ shown.count }}</span>
          <span class="stat-label">游戏总数</span>
        </div>
        <div class="stat">
          <span class="stat-num">{{ fmtHours(shown.hours) }}<i>h</i></span>
          <span class="stat-label">总游玩时长</span>
        </div>
        <div v-if="hasRecent" class="stat">
          <span class="stat-num">{{ fmtHours(shown.recent) }}<i>h</i></span>
          <span class="stat-label">最近两周</span>
        </div>
        <a class="stat stat-link" :href="steam._meta.profile" target="_blank" rel="noopener">
          <span class="stat-num stat-num-text">
            <img
              v-if="steam._meta.avatar"
              class="stat-avatar"
              :src="steam._meta.avatar"
              alt=""
              @error="onAvatarError"
            />
            {{ steam._meta.personaName || 'Steam 主页' }}
          </span>
          <span class="stat-label">查看主页 ↗</span>
        </a>
      </div>

      <!-- 排序 -->
      <div v-if="steam.games.length > 1" class="toolbar">
        <span class="toolbar-label">// 排序</span>
        <button
          v-for="s in SORTS"
          :key="s.key"
          class="sort-btn"
          :class="{ 'is-on': sortKey === s.key }"
          @click="sortKey = s.key"
        >
          {{ s.label }}
        </button>
        <span class="toolbar-count">{{ steam.games.length }} 款游戏</span>
      </div>

      <!-- 游戏网格 -->
      <div class="grid">
        <a
          v-for="(g, i) in visible"
          :key="g.appid"
          class="game"
          :style="{ '--bar': barWidth(g) }"
          :href="`https://store.steampowered.com/app/${g.appid}/`"
          target="_blank"
          rel="noopener"
          :aria-label="`${g.name}，总时长 ${fmtDuration(g.minutes)}，在 Steam 商店查看`"
        >
          <span class="game-rank">{{ String(i + 1).padStart(2, '0') }}</span>

          <span class="game-thumb">
            <img
              :src="g.icon || g.header"
              :data-header="g.header"
              :alt="`${g.name} 图标`"
              loading="lazy"
              decoding="async"
              @error="onIconError"
            />
          </span>

          <span class="game-body">
            <span class="game-name" :title="g.name">{{ g.name }}</span>
            <span class="game-meta">
              <span class="game-hours">{{ fmtDuration(g.minutes) }}</span>
              <span v-if="g.twoWeeksMinutes" class="game-recent">
                近两周 {{ fmtDuration(g.twoWeeksMinutes) }}
              </span>
            </span>
          </span>

          <span class="game-bar"></span>
        </a>
      </div>

      <!-- 展开 / 收起 -->
      <div v-if="hiddenCount > 0" class="more">
        <button class="more-btn" @click="showAll = !showAll">
          {{ showAll ? '收起' : `展开全部 ${steam.games.length} 款` }}
          <span class="more-arrow" :class="{ 'is-up': showAll }">↓</span>
        </button>
      </div>

      <!-- 数据来源 -->
      <p class="source">
        <template v-if="steam._meta.sample">
          ⚠ 当前为<b>示例数据</b>：配置 <code>STEAM_API_KEY</code> 后运行
          <code>npm run steam</code> 即可替换为真实游戏库。
        </template>
        <template v-else>
          数据来自 Steam Web API<template v-if="updatedText"> · 更新于 {{ updatedText }}</template>
          · 运行 <code>npm run steam</code> 可手动刷新
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped>
/* ===== 统计条 ===== */
.stats {
  margin-top: 46px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));
  /* 用 1px 间隙露出底色，列数变化时分隔线始终正确 */
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  overflow: hidden;
}

.stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 26px 24px;
  background: linear-gradient(180deg, rgba(26, 26, 32, 0.92), rgba(13, 13, 17, 0.96));
  transition: background 0.35s ease;
}
.stat::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, var(--red), transparent 70%);
  opacity: 0.45;
  transition: opacity 0.35s ease;
}
.stat:hover::before {
  opacity: 1;
}

.stat-num {
  font-family: var(--font-mono);
  font-size: clamp(26px, 3.2vw, 38px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.5px;
  color: var(--text);
  text-shadow: 0 0 26px rgba(255, 45, 45, 0.32);
}
.stat-num i {
  font-style: normal;
  font-size: 0.5em;
  color: var(--red-bright);
  margin-left: 3px;
}
.stat-label {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text-dim);
}

/* 第四格：Steam 主页入口 */
.stat-link:hover {
  background: rgba(225, 6, 0, 0.08);
}
.stat-num-text {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(17px, 1.7vw, 21px);
  letter-spacing: 0;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
.stat-link:hover .stat-num-text {
  color: #fff;
  text-shadow: 0 0 18px rgba(255, 45, 45, 0.6);
}
.stat-avatar {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-light);
}

/* ===== 排序工具栏 ===== */
.toolbar {
  margin-top: 34px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar-label {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--text-dim);
  margin-right: 4px;
}
.sort-btn {
  font-family: inherit;
  font-size: 13px;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border);
  padding: 7px 17px;
  cursor: pointer;
  transition: color 0.25s, border-color 0.25s, background 0.25s, box-shadow 0.25s;
}
.sort-btn:hover {
  color: var(--text);
  border-color: var(--border-light);
}
.sort-btn.is-on {
  color: #fff;
  border-color: rgba(225, 6, 0, 0.75);
  background: rgba(225, 6, 0, 0.16);
  box-shadow: inset 0 0 16px rgba(225, 6, 0, 0.2);
}
.toolbar-count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-dim);
}

/* ===== 游戏网格 ===== */
.grid {
  margin-top: 26px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
  gap: 14px;
}

/* 整张卡片是一个链接：可键盘聚焦、无需 JS */
.game {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.35s ease, box-shadow 0.35s ease, background 0.35s ease;
}

/* 左上角红色能量场：hover 时点亮 */
.game::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 0% 0%, rgba(225, 6, 0, 0.22), transparent 62%);
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.game:hover {
  transform: translateY(-4px);
  background: var(--surface-2);
  border-color: rgba(225, 6, 0, 0.6);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(225, 6, 0, 0.12),
    0 20px 46px -30px rgba(255, 45, 45, 0.85);
}
.game:hover::before {
  opacity: 1;
}

.game-rank {
  position: relative;
  flex-shrink: 0;
  min-width: 19px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--border-light);
  transition: color 0.35s ease;
}
.game:hover .game-rank {
  color: var(--red-bright);
}

.game-thumb {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  background: #0c0c10;
  border: 1px solid var(--border);
  transition: border-color 0.35s ease, box-shadow 0.35s ease;
}
.game-thumb img {
  width: 44px;
  height: 44px;
  /* Steam 图标是 32×32 方图，contain 保证不裁切 */
  object-fit: contain;
  filter: grayscale(0.35) brightness(0.92);
  transition: filter 0.35s ease, transform 0.35s ease;
}
/* 回退到横版头图时铺满方形容器，与方形图标视觉统一 */
.game-thumb img[data-fallback='1'] {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.game:hover .game-thumb {
  border-color: rgba(225, 6, 0, 0.65);
  box-shadow: 0 0 18px rgba(225, 6, 0, 0.35), inset 0 0 14px rgba(225, 6, 0, 0.18);
}
.game:hover .game-thumb img {
  filter: none;
  transform: scale(1.08);
}

.game-body {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.game-name {
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text);
  /* 长名字最多两行，超出省略 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}
.game:hover .game-name {
  color: #fff;
  text-shadow: 0 0 14px rgba(255, 45, 45, 0.45);
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.game-hours {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--red-bright);
  transition: text-shadow 0.3s ease;
}
.game:hover .game-hours {
  text-shadow: 0 0 12px rgba(255, 45, 45, 0.7);
}
.game-recent {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  color: var(--cyan);
  padding: 1px 6px;
  border: 1px solid rgba(0, 229, 255, 0.28);
  background: rgba(0, 229, 255, 0.06);
}

/* 卡片底部：该游戏时长占榜首的比例 */
.game-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: var(--bar, 0%);
  background: linear-gradient(90deg, var(--red-dim), var(--red-bright));
  opacity: 0.35;
  transition: opacity 0.35s ease, box-shadow 0.35s ease;
}
.game:hover .game-bar {
  opacity: 1;
  box-shadow: 0 0 12px rgba(255, 45, 45, 0.85);
}

/* ===== 展开 / 收起 ===== */
.more {
  margin-top: 30px;
  display: flex;
  justify-content: center;
}
.more-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--border-light);
  padding: 13px 34px;
  cursor: pointer;
  transition: color 0.3s, border-color 0.3s, background 0.3s, box-shadow 0.3s;
}
.more-btn:hover {
  color: #fff;
  border-color: rgba(225, 6, 0, 0.7);
  background: rgba(225, 6, 0, 0.12);
  box-shadow: inset 0 0 22px rgba(225, 6, 0, 0.18), 0 0 26px -10px rgba(255, 45, 45, 0.8);
}
.more-arrow {
  color: var(--red-bright);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.more-arrow.is-up {
  transform: rotate(180deg);
}

/* ===== 数据来源 ===== */
.source {
  margin-top: 26px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.9;
  color: var(--text-dim);
}
.source b {
  color: var(--red-bright);
}
.source code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--cyan);
  background: rgba(0, 229, 255, 0.07);
  border: 1px solid rgba(0, 229, 255, 0.2);
  padding: 1px 6px;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .stat {
    padding: 22px 20px;
  }
  .toolbar-count {
    margin-left: 0;
    width: 100%;
  }
}
</style>
