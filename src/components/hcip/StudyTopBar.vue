<script setup>
import { computed } from 'vue'
import { go } from '../../router'
import { useStudyStore } from '../../study/useStudyStore'
import { useSync } from '../../study/useSync'
import { formatDateCN } from '../../study/dateUtil'

/**
 * 备考模块顶栏
 *
 * 取代站点的 NavBar：手机上顶部只留一行关键信息 —— 考试代号、
 * 预估完成日期、进度节奏。点击左箭头回主页。
 *
 * 云同步入口放在这里而不是只在「进度」页：新设备进来时会被强制停在摸底页，
 * 那时底部标签栏是隐藏的，而"换设备"恰恰是最需要云同步的场景。
 */
const props = defineProps({
  pace: { type: Object, default: () => ({ key: 'onTrack', label: '' }) },
  forecast: { type: Object, default: () => ({}) },
  weakCount: { type: Number, default: 0 },
})

const emit = defineEmits(['sync'])

const store = useStudyStore()
const sync = useSync()

const exam = computed(() => store.examMeta.value)
const progressPct = computed(() => Math.round((store.progress.value.rate || 0) * 100))

const paceClass = computed(() => `pace-${props.pace?.key || 'onTrack'}`)

/** 按钮同时承担状态指示：文案短到能塞进这一行 */
const syncLabel = computed(() => {
  if (!sync.enabled.value) return '云同步'
  if (sync.status.state === 'syncing') return '同步中'
  if (sync.status.state === 'error') return '同步失败'
  if (sync.status.state === 'ok') return '已同步'
  return '云同步'
})
const syncClass = computed(() => (sync.enabled.value ? sync.status.state : 'off'))
const syncHint = computed(() =>
  sync.status.error ? `${sync.status.message}（${sync.status.error}）` : sync.status.message,
)
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

    <button class="sync-btn" :class="'is-' + syncClass" :title="syncHint" @click="emit('sync')">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 18h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 9.4 4.2 4.2 0 0 0 7 18z" />
      </svg>
      <span>{{ syncLabel }}</span>
    </button>

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

/* 云同步入口：既是按钮也是状态灯（未启用=灰，同步中=白，成功=青，失败=红） */
.sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-height: 26px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.5px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.sync-btn svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linejoin: round;
}
.sync-btn.is-syncing {
  color: var(--text);
  border-color: var(--text-dim);
}
.sync-btn.is-ok {
  color: var(--cyan);
  border-color: rgba(0, 229, 255, 0.5);
}
.sync-btn.is-error {
  color: var(--red-bright);
  border-color: rgba(255, 45, 45, 0.6);
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
