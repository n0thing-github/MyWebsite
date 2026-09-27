<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { restoreSession } from '../../study/session'
import { buildPaper, shuffle } from '../../study/useStudyPlan'
import { gradePaper, gradeByDomain, isCorrect } from '../../study/grading'
import { formatClock } from '../../study/dateUtil'
import { masteryLevel } from '../../study/memory'
import QuestionCard from './QuestionCard.vue'
import { Chip, EmptyState, ProgressBar, StatCard } from './ui'

/**
 * 模考
 *
 * 关键设计：**计时基于绝对时间戳，而不是累加的 tick 计数**。
 * 手机上切后台、锁屏会让定时器停摆，累加计数会导致"离开 5 分钟回来只走了 3 秒"；
 * 用 endAt（绝对毫秒）比较就能在手机休眠后依然给出正确的剩余时间。
 *
 * 交卷后错题会立刻进入复习队列（按答错处理，稳定度下降），
 * 所以"考试 → 查漏 → 复习"是一条闭环，不需要用户手动收藏错题。
 */
const emit = defineEmits(['go'])

const store = useStudyStore()

const SESSION_KEY = 'mock'
const DOMAIN_COUNT = 20 // 单域小测题量

const phase = ref('intro') // intro | running | result
const paper = ref([])
const responses = ref({})
const index = ref(0)
const remaining = ref(0)
const endAt = ref(0)
const result = ref(null)
const scope = ref('') // 整卷 or 域 id
let timer = null

const examMeta = computed(() => store.examMeta.value)
const total = computed(() => paper.value.length)
const currentQ = computed(() => paper.value[index.value] || null)
const response = computed(() => responses.value[currentQ.value?.id] || [])
const hasSelection = computed(() => response.value.length > 0)

/** 已作答数（用于答题卡） */
const answeredCount = computed(
  () => Object.values(responses.value).filter((r) => (r || []).length > 0).length,
)

const answeredIds = computed(() => new Set(Object.keys(responses.value).filter((k) => (responses.value[k] || []).length)))

const paperMinutes = computed(() =>
  scope.value === 'full' ? examMeta.value.durationMinutes : Math.max(10, Math.round(DOMAIN_COUNT * 1.2)),
)

const timeUp = computed(() => remaining.value <= 0)

function start(kind, domainId) {
  scope.value = kind
  const pool = store.questions.value
  if (!pool.length) return
  paper.value =
    kind === 'full'
      ? buildPaper(pool, null, Math.min(examMeta.value.realQuestionCount, pool.length), store.weights.value)
      : buildPaper(pool, [domainId], Math.min(DOMAIN_COUNT, pool.length), null)
  responses.value = {}
  index.value = 0
  endAt.value = Date.now() + paperMinutes.value * 60 * 1000
  remaining.value = paperMinutes.value * 60
  result.value = null
  phase.value = 'running'
  persist()
  startTimer()
}

function startTimer() {
  stopTimer()
  const tick = () => {
    remaining.value = Math.max(0, Math.round((endAt.value - Date.now()) / 1000))
    if (remaining.value <= 0) {
      stopTimer()
      submit(true)
    }
  }
  tick()
  timer = window.setInterval(tick, 500)
}

function stopTimer() {
  if (timer) window.clearInterval(timer)
  timer = null
}

function persist() {
  store.saveSession(SESSION_KEY, {
    phase: phase.value,
    scope: scope.value,
    ids: paper.value.map((q) => q.id),
    responses: responses.value,
    index: index.value,
    endAt: endAt.value,
  })
}

/** 恢复未交卷的模考现场（校验规则与刷题/摸底共用一套） */
function restore() {
  const saved = restoreSession(store.readSession(SESSION_KEY), {
    expect: { phase: 'running' },
    isKnownId: (id) => Boolean(store.getQuestion(id)),
  })
  if (!saved) return false
  const items = saved.ids.map((id) => store.getQuestion(id)).filter(Boolean)
  if (!items.length) return false
  paper.value = items
  responses.value = saved.responses || {}
  index.value = Math.min(saved.index, items.length - 1)
  endAt.value = saved.endAt || 0
  scope.value = saved.scope || 'full'
  remaining.value = Math.max(0, Math.round((endAt.value - Date.now()) / 1000))
  phase.value = 'running'
  startTimer()
  return true
}

function toggleResponse(key) {
  const q = currentQ.value
  if (!q) return
  const cur = new Set(responses.value[q.id] || [])
  if (q.type === 'multi') {
    cur.has(key) ? cur.delete(key) : cur.add(key)
  } else {
    if (cur.has(key)) cur.clear()
    else {
      cur.clear()
      cur.add(key)
    }
  }
  responses.value = { ...responses.value, [q.id]: [...cur] }
  persist()
}

function goto(i) {
  if (i < 0 || i >= total.value) return
  index.value = i
  persist()
}

/**
 * 交卷。
 * @param {boolean} auto 是否到点自动交卷
 */
function submit(auto = false) {
  if (phase.value !== 'running') return
  stopTimer()
  const graded = gradePaper(paper.value, responses.value)
  const byDomain = gradeByDomain(graded.details)

  // 错题与未作答的题都按"答错"落库，直接进入复习队列。
  // 注意：这里用 mode 'review' 且 minutes 0 —— 单题时长在模考里没有意义，
  // 整卷耗时由下面的 recordMock 一次性记入，避免重复累加。
  let fed = 0
  for (const d of graded.details) {
    if (d.ok) continue
    const q = store.getQuestion(d.id)
    if (q) {
      store.answerQuestion(q, 'wrong', { mode: 'review', minutes: 0 })
      fed += 1
    }
  }

  const domainScore = {}
  for (const [id, cell] of Object.entries(byDomain)) domainScore[id] = cell.rate * 100

  const weighted = (() => {
    let sum = 0
    let wSum = 0
    for (const [id, cell] of Object.entries(byDomain)) {
      const w = store.weights.value[id] || 0
      sum += cell.rate * 100 * w
      wSum += w
    }
    return wSum ? sum / wSum : 0
  })()

  // 整卷耗时 = 限时 − 剩余，一次性记入
  store.recordMock({
    minutes: Math.max(0, paperMinutes.value - Math.round(remaining.value / 60)),
    correct: graded.correct,
    wrong: graded.wrong,
  })

  result.value = { graded, byDomain, domainScore, weighted, auto, fed }
  phase.value = 'result'
  store.clearSession(SESSION_KEY)
}

function exit() {
  stopTimer()
  store.clearSession(SESSION_KEY)
  phase.value = 'intro'
  result.value = null
}

onMounted(() => {
  if (!restore()) phase.value = 'intro'
})
onBeforeUnmount(stopTimer)

// 返回考试页签时刷新剩余时间（后台期间 interval 会被节流）
watch(phase, (p) => {
  if (p === 'running') remaining.value = Math.max(0, Math.round((endAt.value - Date.now()) / 1000))
})
</script>

<template>
  <div class="mock">
    <!-- ========== 选择 ========== -->
    <template v-if="phase === 'intro'">
      <header class="head">
        <span class="tag">MOCK EXAM</span>
        <h2 class="title">模考与小测</h2>
        <p class="desc">
          整卷按考纲权重抽题并计时，交卷后立刻判分；答错的题会自动进入复习队列，
          不需要你手动整理错题本。
        </p>
      </header>

      <section class="panel">
        <h3 class="panel-title">整卷模考</h3>
        <p class="panel-note">
          {{ Math.min(examMeta.realQuestionCount, store.progress.value.total) }} 题 ·
          {{ examMeta.durationMinutes }} 分钟 · 按考纲权重分域抽题
        </p>
        <Chip block tone="cyan" @click="start('full')">开始整卷模考</Chip>
      </section>

      <section class="panel">
        <h3 class="panel-title">单域小测</h3>
        <p class="panel-note">每域 20 题、约 24 分钟，适合碎片时间针对性练习</p>
        <div class="domain-grid">
          <button
            v-for="d in store.domains.value"
            :key="d.id"
            class="domain-btn"
            @click="start('domain', d.id)"
          >
            <span class="d-name">{{ d.name }}</span>
            <span class="d-meta">
              掌握 {{ Math.round(store.domainStats.value[d.id]?.mastery || 0) }}%
              · {{ store.domainStats.value[d.id]?.total || 0 }} 题
            </span>
          </button>
        </div>
      </section>

      <p class="note">
        提示：模考会消耗较多时间，建议在能连续专注的时段做；碎片时间更适合「复习」与「刷题」。
      </p>
    </template>

    <!-- ========== 答题 ========== -->
    <template v-else-if="phase === 'running'">
      <div class="exam-bar" :class="{ urgent: remaining <= 300 }">
        <span class="timer">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="13" r="7.5" />
            <path d="M12 13V9.5M9.5 3h5" />
          </svg>
          {{ formatClock(remaining) }}
        </span>
        <span class="exam-meta">
          {{ scope === 'full' ? '整卷' : '单域小测' }} · 已答 {{ answeredCount }}/{{ total }}
        </span>
        <Chip @click="submit(false)">交卷</Chip>
      </div>

      <div class="bar-wrap">
        <ProgressBar :value="total ? (answeredCount / total) * 100 : 0" :height="3" :show-value="false" />
      </div>

      <QuestionCard
        v-if="currentQ"
        :question="currentQ"
        :response="response"
        :checked="false"
        :index="index + 1"
        :total="total"
        @toggle="toggleResponse"
      />

      <div class="nav-row">
        <Chip :disabled="index === 0" @click="goto(index - 1)">上一题</Chip>
        <Chip :disabled="index >= total - 1" @click="goto(index + 1)">下一题</Chip>
      </div>

      <!-- 答题卡：模考必须能跳着做，不能只靠顺序 -->
      <section class="sheet-card">
        <h3 class="panel-title">答题卡</h3>
        <div class="card-grid">
          <button
            v-for="(q, i) in paper"
            :key="q.id"
            class="card-cell"
            :class="{ 'is-done': answeredIds.has(q.id), 'is-current': i === index }"
            @click="goto(i)"
          >
            {{ i + 1 }}
          </button>
        </div>
      </section>

      <p v-if="timeUp" class="alert">时间到，正在自动交卷…</p>
    </template>

    <!-- ========== 结果 ========== -->
    <template v-else>
      <header class="head">
        <span class="tag">RESULT</span>
        <h2 class="title">
          得分 {{ Math.round(result.weighted) }} <small>/ 100</small>
        </h2>
        <p class="desc">
          <template v-if="result.auto">时间到已自动交卷。 </template>
          答对 {{ result.graded.correct }} / {{ result.graded.total - result.graded.blank }} 题
          <template v-if="result.graded.blank">，未作答 {{ result.graded.blank }} 题</template>。
          <template v-if="result.fed">
            {{ result.fed }} 道错题已加入复习队列。
          </template>
        </p>
      </header>

      <div class="stats">
        <StatCard
          label="加权得分"
          :value="Math.round(result.weighted)"
          unit="/100"
          :tone="result.weighted >= 60 ? 'cyan' : 'red'"
          :hint="result.weighted >= 60 ? '达到常见通过水位附近' : '离通过水位还有距离'"
        />
        <StatCard
          label="正确率"
          :value="Math.round(result.graded.rate * 100)"
          unit="%"
          :hint="`已作答 ${result.graded.total - result.graded.blank} 题`"
        />
      </div>

      <section class="panel">
        <h3 class="panel-title">分域表现</h3>
        <div class="domains">
          <div v-for="d in store.domains.value" :key="d.id" class="domain">
            <ProgressBar :value="result.domainScore[d.id] ?? 0" :label="d.name" :height="7" />
            <span class="level" :class="'lv-' + masteryLevel(result.domainScore[d.id] ?? 0).key">
              {{ masteryLevel(result.domainScore[d.id] ?? 0).label }}
            </span>
          </div>
        </div>
      </section>

      <section class="panel">
        <h3 class="panel-title">错题解析（{{ result.graded.details.filter((x) => !x.ok).length }} 题）</h3>
        <div class="wrong-list">
          <QuestionCard
            v-for="(d, i) in result.graded.details.filter((x) => !x.ok)"
            :key="d.id"
            :question="store.getQuestion(d.id)"
            :response="d.response"
            :checked="true"
            :disabled="true"
            :index="i + 1"
            :total="result.graded.details.filter((x) => !x.ok).length"
          />
        </div>
      </section>

      <div class="actions">
        <Chip block tone="warn" @click="emit('go', 'wrong')">去重做错题</Chip>
        <Chip block @click="exit">返回模考首页</Chip>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mock {
  padding: 14px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--red-bright);
}
.title {
  font-size: 21px;
  font-weight: 800;
  color: var(--text);
}
.title small {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-dim);
}
.desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-dim);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.panel-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
}
.panel-note {
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--text-dim);
  margin-top: -4px;
}

.domain-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
}
.domain-btn {
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
  min-height: 52px;
  padding: 11px 12px;
  background: var(--bg-alt);
  border: none;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.d-name {
  font-size: 14px;
  color: var(--text);
}
.d-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.exam-bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  background: rgba(20, 20, 25, 0.97);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}
.timer {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 700;
  color: var(--cyan);
  flex-shrink: 0;
}
.timer svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.exam-bar.urgent .timer {
  color: var(--red-bright);
  animation: blink 1.1s ease-in-out infinite;
}
@keyframes blink {
  50% {
    opacity: 0.45;
  }
}
.exam-meta {
  flex: 1;
  font-size: 11px;
  color: var(--text-dim);
  min-width: 0;
}

.bar-wrap {
  margin-top: -6px;
}

.nav-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.sheet-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 13px 12px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(38px, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.card-cell {
  aspect-ratio: 1;
  min-height: 38px;
  background: var(--bg-alt);
  border: 1px solid var(--border-light);
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  touch-action: manipulation;
}
.card-cell.is-done {
  background: rgba(0, 229, 255, 0.14);
  border-color: rgba(0, 229, 255, 0.5);
  color: var(--cyan);
}
.card-cell.is-current {
  border-color: var(--red-bright);
  color: #fff;
  box-shadow: 0 0 10px -2px rgba(255, 45, 45, 0.8);
}

.alert {
  font-size: 12.5px;
  color: var(--red-bright);
  border-left: 2px solid var(--red-bright);
  padding-left: 11px;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.domains {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.domain {
  position: relative;
  padding-right: 62px;
}
.level {
  position: absolute;
  right: 0;
  top: 0;
  font-family: var(--font-mono);
  font-size: 10.5px;
  padding: 2px 7px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.lv-strong {
  color: var(--cyan);
  border-color: rgba(0, 229, 255, 0.45);
}
.lv-ok {
  color: var(--red-bright);
  border-color: rgba(255, 45, 45, 0.45);
}
.lv-weak {
  color: #e0a800;
  border-color: rgba(224, 168, 0, 0.45);
}
.lv-danger {
  color: #ff4d4d;
  border-color: rgba(255, 77, 77, 0.6);
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.note {
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--text-dim);
  border-left: 2px solid var(--border-light);
  padding-left: 11px;
}
</style>
