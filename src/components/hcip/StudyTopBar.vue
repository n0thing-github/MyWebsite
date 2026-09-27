<script setup>
import { computed } from 'vue'
import { go } from '../../router'
import { useStudyStore } from '../../study/useStudyStore'
import { formatDateCN } from '../../study/dateUtil'

/**
 * 备考模块顶栏
 *
 * 取代站点的 NavBar：手机上顶部只留一行关键信息 —— 考试代号、
 * 预估完成日期、进度节奏。点击左箭头回主页。
 */
const props = defineProps({
  pace: { type: Object, default: () => ({ key: 'onTrack', label: '' }) },
  forecast: { type: Object, default: () => ({}) },
  weakCount: { type: Number, default: 0 },
})

const store = useStudyStore()
const exam = computed(() => store.examMeta.value)
const progressPct = computed(() => Math.round((store.progress.value.rate || 0) * 100))

const paceClass = computed(() => `pace-${props.pace?.key || 'onTrack'}`)
</script>

<template>
  <header class="topbar">
    <button class="back" aria-label="返回主页" @click="go('#home')">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>

    <div class="meta">
      <span class="exam-code">{{ exam.code }}</span>
      <span class="exam-sub">{{ exam.shortName }}</span>
    </div>

    <div class="right">
      <span class="chip" :class="paceClass" :title="pace.label">{{ pace.label }}</span>
      <span class="forecast">
        预计 <b>{{ formatDateCN(forecast.finishKey) }}</b> 完成
      </span>
    </div>

    <!-- 细进度条贴在顶栏底部 -->
    <div class="bar" aria-hidden="true">
      <span :style="{ width: progressPct + '%' }"></span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: calc(env(safe-area-inset-top, 0px) + 9px) 12px 9px;
  background: linear-gradient(180deg, rgba(24, 24, 30, 0.97) 0%, rgba(12, 12, 16, 0.95) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(225, 6, 0, 0.22);
}

.back {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.back svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 7px;
  min-width: 0;
}
.exam-code {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--red-bright);
  white-space: nowrap;
}
.exam-sub {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.right {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
}

.chip {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
  white-space: nowrap;
}
.pace-behind {
  border-color: rgba(255, 45, 45, 0.7);
  color: var(--red-bright);
}
.pace-ahead {
  border-color: rgba(0, 229, 255, 0.5);
  color: var(--cyan);
}

.forecast {
  font-size: 10.5px;
  color: var(--text-dim);
  white-space: nowrap;
}
.forecast b {
  font-family: var(--font-mono);
  color: var(--text);
  font-weight: 400;
}

.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: transparent;
}
.bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--red-dim), var(--red-bright));
  box-shadow: 0 0 8px rgba(255, 45, 45, 0.7);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 窄屏下副标题让位给预估日期 */
@media (max-width: 360px) {
  .exam-sub {
    display: none;
  }
}
</style>
