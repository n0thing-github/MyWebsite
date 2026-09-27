<script setup>
/**
 * 底部标签栏
 *
 * 移动端主导航。刻意不复用站点顶部的 NavBar：
 * 手机屏幕顶部空间宝贵，而且两套导航（汉堡菜单 + 底部标签）会互相打架。
 *
 * 无障碍与触控：
 *   · 每项高度 ≥ 52px，满足 44px 最小触控目标
 *   · 用 <button> 而不是 <a>：切标签不产生历史记录（配合 router 的 replaceState），
 *     否则手机返回键要按好几次才能退出备考页
 *   · aria-current 标出当前项
 */
defineProps({
  current: { type: String, default: 'today' },
  counts: { type: Object, default: () => ({}) },
  hide: { type: Boolean, default: false },
})

const emit = defineEmits(['go'])

const tabs = [
  { key: 'today', label: '今日', badge: 'today' },
  { key: 'quiz', label: '刷题' },
  { key: 'review', label: '复习', badge: 'review' },
  { key: 'mock', label: '模考' },
  { key: 'progress', label: '进度' },
]
</script>

<template>
  <nav v-if="!hide" class="tabbar" aria-label="备考导航">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="tab"
      :class="{ 'is-active': current === t.key }"
      :aria-current="current === t.key ? 'page' : undefined"
      @click="emit('go', t.key)"
    >
      <span class="tab-icon" aria-hidden="true">
        <!-- 今日：日历 -->
        <svg v-if="t.key === 'today'" viewBox="0 0 24 24">
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
          <path d="M8 14h3" class="fill" />
        </svg>
        <!-- 刷题：卡片 -->
        <svg v-else-if="t.key === 'quiz'" viewBox="0 0 24 24">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M7 9h10M7 13h7" />
        </svg>
        <!-- 复习：循环箭头 -->
        <svg v-else-if="t.key === 'review'" viewBox="0 0 24 24">
          <path d="M20 12a8 8 0 1 1-2.6-5.9" />
          <path d="M20 4v4.5h-4.5" />
        </svg>
        <!-- 模考：秒表 -->
        <svg v-else-if="t.key === 'mock'" viewBox="0 0 24 24">
          <circle cx="12" cy="13.5" r="7.5" />
          <path d="M12 13.5V9.5M9.5 3h5" />
        </svg>
        <!-- 进度：柱状 -->
        <svg v-else viewBox="0 0 24 24">
          <path d="M4 20h16" />
          <rect x="6" y="12" width="3" height="6" />
          <rect x="11" y="8" width="3" height="10" />
          <rect x="16" y="4.5" width="3" height="13.5" />
        </svg>
        <span
          v-if="t.badge && counts[t.badge] > 0"
          class="tab-badge"
          :class="{ 'is-hot': t.badge === 'review' }"
        >{{ counts[t.badge] > 99 ? '99+' : counts[t.badge] }}</span>
      </span>
      <span class="tab-label">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 400;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: linear-gradient(180deg, rgba(20, 20, 25, 0.96) 0%, rgba(10, 10, 12, 0.99) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-top: 1px solid var(--border);
  /* 刘海屏 / 手势条安全区 */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
}

.tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 52px;
  padding: 7px 2px 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  font-family: inherit;
  transition: color 0.2s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.tab.is-active {
  color: var(--red-bright);
}

/* 当前项顶部一道短横线，比整块背景色更克制 */
.tab.is-active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 22px;
  height: 2px;
  background: var(--red-bright);
  box-shadow: 0 0 10px 1px rgba(255, 45, 45, 0.8);
}

.tab-icon {
  position: relative;
  display: block;
  width: 22px;
  height: 22px;
}
.tab-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tab-icon svg .fill {
  fill: currentColor;
  stroke: none;
}

.tab-label {
  font-size: 11px;
  letter-spacing: 0.5px;
  font-family: var(--font-mono);
}

.tab-badge {
  position: absolute;
  top: -5px;
  right: -9px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--surface-2);
  border: 1px solid var(--border-light);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}
/* 复习到期数是"该动手了"的信号，用红色强调 */
.tab-badge.is-hot {
  background: var(--red);
  border-color: var(--red-bright);
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.6);
}

/* 支持悬停的设备才给 hover 反馈（触摸端 sticky hover 会残留） */
@media (hover: hover) {
  .tab:hover {
    color: var(--text);
  }
  .tab.is-active:hover {
    color: var(--red-bright);
  }
}
</style>
