<script setup>
import { computed } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { useStudyPlan } from '../../study/useStudyPlan'
import { suggestedOrder } from '../../study/studyOrder'
import { formatDateFullCN, formatMinutes, lastNDaysKey, addDays, formatRelative } from '../../study/dateUtil'
import { masteryLevel } from '../../study/memory'
import { Chip, ProgressBar, StatCard } from './ui'

/**
 * 今日（仪表盘）
 *
 * 碎片时间使用的主入口：一屏内回答三个问题 ——
 *   今天要做什么（任务清单）、来不来得及（预估完成）、哪里最弱（重点补强）
 */
const props = defineProps({
  counts: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['go'])

const store = useStudyStore()
const { plan, forecast, pace, paceLabel, effectiveDailyMinutes, weakDomains } = useStudyPlan()

const examMeta = computed(() => store.examMeta.value)

/** 建议下一域：按学习顺序取第一个掌握度较低的域 */
const nextDomain = computed(() => {
  const order = suggestedOrder(store.currentExam.value, store.domainStats.value, null)
  return order[0] || null
})

const progressPct = computed(() => (store.progress.value.rate || 0) * 100)

/** 今日已完成情况（对照计划） */
const doneToday = computed(() => {
  const logs = store.todayLog.value
  return {
    minutes: logs.min || 0,
    minutesPct: plan.value.budget ? Math.min(100, ((logs.min || 0) / plan.value.budget) * 100) : 0,
    answered: (logs.new || 0) + (logs.review || 0),
    correct: logs.correct || 0,
    wrong: logs.wrong || 0,
  }
})

const accuracy = computed(() => {
  const answered = doneToday.value.correct + doneToday.value.wrong
  return answered ? Math.round((doneToday.value.correct / answered) * 100) : null
})

/** 近 14 天热力图 */
const heat = computed(() => {
  const max = Math.max(
    1,
    ...store.state.log.map((e) => e.min || 0),
  )
  return lastNDaysKey(14).map((key) => {
    const e = store.state.log.find((x) => x.d === key)
    const min = e?.min || 0
    return { key, min, level: min === 0 ? 0 : Math.min(4, Math.ceil((min / max) * 4)) }
  })
})

const trendText = computed(() => {
  const t = forecast.value.trend
  if (!t) return ''
  return t > 0 ? `比上周预计提前 ${t} 天` : `比上周预计推迟 ${-t} 天`
})

const hasNewTask = computed(() => plan.value.items.length > 0)
</script>

<template>
  <div class="dash">
    <!-- 考试与进度总览 -->
    <section class="hero">
      <span class="tag">{{ examMeta.code }}</span>
      <h2 class="hero-title">{{ examMeta.name }}</h2>
      <p class="hero-sub">
        已掌握 {{ store.progress.value.touched }} / {{ store.progress.value.total }} 题
        （{{ Math.round(progressPct) }}%）
      </p>
      <ProgressBar :value="progressPct" :height="6" :show-value="false" />
    </section>

    <!-- 今日任务 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">今日任务</h3>
        <span class="block-meta">
          预算 {{ formatMinutes(plan.budget) }} · 已学 {{ formatMinutes(doneToday.minutes) }}
        </span>
      </header>

      <ProgressBar :value="doneToday.minutesPct" :height="4" :show-value="false" />

      <ul class="tasks">
        <li v-if="plan.counts.review" class="task" @click="emit('go', 'review')">
          <span class="task-dot type-review"></span>
          <span class="task-body">
            <span class="task-name">到期复习</span>
            <span class="task-hint">按保留率从低到高排序，先救最模糊的</span>
          </span>
          <span class="task-count">{{ plan.counts.review }} 题</span>
        </li>
        <li v-if="plan.counts.wrong" class="task" @click="emit('go', 'wrong')">
          <span class="task-dot type-wrong"></span>
          <span class="task-body">
            <span class="task-name">错题重做</span>
            <span class="task-hint">之前答错且已到期</span>
          </span>
          <span class="task-count">{{ plan.counts.wrong }} 题</span>
        </li>
        <li v-if="plan.counts.new" class="task" @click="emit('go', 'quiz')">
          <span class="task-dot type-new"></span>
          <span class="task-body">
            <span class="task-name">新学</span>
            <span class="task-hint">
              按考纲权重与弱项排续{{ plan.newFactor !== 1 ? `（系数 ${plan.newFactor.toFixed(1)}×）` : '' }}
            </span>
          </span>
          <span class="task-count">{{ plan.counts.new }} 题</span>
        </li>
        <li v-if="!hasNewTask" class="task task-empty">
          <span class="task-body">
            <span class="task-name">今天的任务已清空</span>
            <span class="task-hint">可以去「进度」看看总体掌握情况</span>
          </span>
        </li>
      </ul>

      <p v-if="plan.backlog" class="alert">
        到期题目（{{ plan.dueTotal }} 题）已超过一天能复习的量，建议今天只做复习、暂缓新学 ——
        系统已自动压缩新学量。
      </p>

      <div class="cta">
        <Chip v-if="plan.counts.wrong" block tone="warn" @click="emit('go', 'wrong')">
          先清 {{ plan.counts.wrong }} 道错题
        </Chip>
        <Chip v-if="plan.counts.review" block @click="emit('go', 'review')">
          开始复习 {{ plan.counts.review }} 题
        </Chip>
        <Chip v-if="plan.counts.new" block tone="cyan" @click="emit('go', 'quiz')">
          开始今日学习
        </Chip>
      </div>
    </section>

    <!-- 预估完成 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">完成预估</h3>
        <span class="pace" :class="'pace-' + paceLabel.key">{{ paceLabel.label }}</span>
      </header>

      <div class="stats">
        <StatCard
          label="预计完成"
          :value="formatDateFullCN(forecast.finishKey)"
          tone="red"
          :hint="`约 ${forecast.daysLeft} 天后`"
        />
        <StatCard
          label="剩余题量"
          :value="forecast.unseen"
          unit="题未学"
          :hint="`另需约 ${forecast.reviewsLeft} 次复习`"
        />
      </div>

      <p class="note">
        按日均有效学习 <b>{{ forecast.perDay }}</b> 分钟推算（你的计划是
        {{ Math.round(effectiveDailyMinutes) }} 分钟基准，并参考近 7 天实际节奏）。
        <span v-if="trendText">{{ trendText }}。</span>
      </p>
      <p class="note subtle">{{ paceLabel.hint }}</p>

      <div class="heat" :aria-label="'近 14 天学习热力图'">
        <span
          v-for="h in heat"
          :key="h.key"
          class="heat-cell"
          :class="'lv-' + h.level"
          :title="`${h.key}：${h.min} 分钟`"
        ></span>
      </div>
    </section>

    <!-- 重点补强 -->
    <section v-if="weakDomains.length" class="block">
      <header class="block-head">
        <h3 class="block-title">重点补强</h3>
        <span class="block-meta">掌握度偏低</span>
      </header>
      <ul class="weak">
        <li v-for="d in weakDomains.slice(0, 3)" :key="d.id">
          <span class="weak-name">{{ d.name }}</span>
          <span class="weak-bar">
            <ProgressBar :value="d.mastery" :height="5" :show-value="false" />
          </span>
          <span class="weak-score" :class="'lv-' + masteryLevel(d.mastery).key">
            {{ Math.round(d.mastery) }}%
          </span>
        </li>
      </ul>
      <p class="note subtle">
        这些域已自动降低新题投放、提高复习频次，把基础打稳再加速。
      </p>
    </section>

    <!-- 模考建议 -->
    <section v-if="plan.mockSuggested" class="block mock-hint">
      <div class="mock-body">
        <h3 class="block-title">该做一次整卷模考了</h3>
        <p class="note subtle">
          一周内还没模考过。整卷 {{ examMeta.realQuestionCount }} 题 /
          {{ examMeta.durationMinutes }} 分钟，用来检验真实水平。
        </p>
      </div>
      <Chip tone="cyan" @click="emit('go', 'mock')">去模考</Chip>
    </section>

    <!-- 下一域建议 -->
    <section v-if="nextDomain" class="block">
      <header class="block-head">
        <h3 class="block-title">下一域建议</h3>
        <span class="block-meta">按依赖关系排序</span>
      </header>
      <p class="next-domain">
        <b>{{ nextDomain.name }}</b>
        <span class="next-why">{{ nextDomain.reason }}</span>
      </p>
    </section>

    <!-- 摸底入口 -->
    <p v-if="store.state.diagnostic" class="diag-link">
      摸底完成于 {{ formatRelative(store.state.diagnostic.completedAt.slice(0, 10)) }}
      · 可在「进度」页重做
    </p>
  </div>
</template>

<style scoped>
.dash {
  padding: 14px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 16px 15px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: 2px solid var(--red);
}
.tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--red-bright);
}
.hero-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text);
}
.hero-sub {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 3px;
}

.block {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.block-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.block-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.5px;
}
.block-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.tasks {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
}
.task {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 54px;
  padding: 11px 12px;
  background: var(--bg-alt);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.task-empty {
  cursor: default;
}
.task-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  transform: rotate(45deg);
}
.type-review {
  background: var(--red-bright);
  box-shadow: 0 0 8px rgba(255, 45, 45, 0.7);
}
.type-wrong {
  background: #e0a800;
  box-shadow: 0 0 8px rgba(224, 168, 0, 0.6);
}
.type-new {
  background: var(--cyan);
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.6);
}
.task-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.task-name {
  font-size: 14.5px;
  color: var(--text);
}
.task-hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-dim);
}
.task-count {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--red-bright);
  flex-shrink: 0;
}

.alert {
  font-size: 12px;
  line-height: 1.7;
  color: #e0a800;
  border-left: 2px solid #e0a800;
  padding-left: 11px;
}

.cta {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.pace {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.pace-behind {
  color: var(--red-bright);
  border-color: rgba(255, 45, 45, 0.6);
}
.pace-ahead {
  color: var(--cyan);
  border-color: rgba(0, 229, 255, 0.5);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.note {
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-dim);
}
.note b {
  font-family: var(--font-mono);
  color: var(--text);
  font-weight: 400;
}
.note.subtle {
  font-size: 11.5px;
  color: var(--border-light);
}

.heat {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  gap: 3px;
  margin-top: 2px;
}
.heat-cell {
  aspect-ratio: 1;
  background: var(--surface-2);
  border: 1px solid var(--border);
}
.heat-cell.lv-1 {
  background: rgba(225, 6, 0, 0.25);
  border-color: rgba(225, 6, 0, 0.3);
}
.heat-cell.lv-2 {
  background: rgba(225, 6, 0, 0.45);
  border-color: rgba(225, 6, 0, 0.5);
}
.heat-cell.lv-3 {
  background: rgba(225, 6, 0, 0.7);
  border-color: rgba(255, 45, 45, 0.6);
}
.heat-cell.lv-4 {
  background: var(--red-bright);
  border-color: var(--red-bright);
  box-shadow: 0 0 8px rgba(255, 45, 45, 0.6);
}

.weak {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.weak li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.weak-name {
  font-size: 13px;
  color: var(--text);
  width: 86px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weak-bar {
  flex: 1;
  min-width: 0;
}
.weak-score {
  font-family: var(--font-mono);
  font-size: 12px;
  width: 42px;
  text-align: right;
  flex-shrink: 0;
}
.lv-strong {
  color: var(--cyan);
}
.lv-ok {
  color: var(--red-bright);
}
.lv-weak {
  color: #e0a800;
}
.lv-danger {
  color: #ff4d4d;
}

.mock-hint {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}
.mock-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.next-domain {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 14px;
  color: var(--text);
}
.next-domain b {
  color: var(--red-bright);
}
.next-why {
  font-size: 11.5px;
  color: var(--text-dim);
}

.diag-link {
  font-size: 11px;
  color: var(--border-light);
  text-align: center;
  padding: 4px 0 0;
}
</style>
