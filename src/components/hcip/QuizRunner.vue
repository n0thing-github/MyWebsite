<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { restoreSession, createSession } from '../../study/session'
import { useStudyPlan, shuffle } from '../../study/useStudyPlan'
import { isCorrect, isPartial } from '../../study/grading'
import QuestionCard from './QuestionCard.vue'
import { Chip, EmptyState, ProgressBar } from './ui'

/**
 * 刷题器（今日新学 + 复习、错题重做共用）
 *
 * 现场保存：每答一题就把 {queueIds, index, responses} 落到 store.sessions，
 * 手机切后台、来电话、刷新页面后可以原样继续 —— 碎片时间使用这是刚需。
 */
const props = defineProps({
  /** 'today' 走今日计划；'wrong' 只刷错题 */
  mode: { type: String, default: 'today' },
})

const emit = defineEmits(['go'])

const store = useStudyStore()
const { plan } = useStudyPlan()

const SESSION_KEY = 'quiz'
const session = ref(createSession({ mode: '' }))
/** 本轮是否来自现场恢复（给用户一句提示，免得以为题号跳了） */
const resumed = ref(false)

const queue = computed(() => session.value.ids.map((id) => store.getQuestion(id)).filter(Boolean))
const currentQ = computed(() => queue.value[session.value.index] || null)
const total = computed(() => queue.value.length)
const response = computed(() => session.value.responses[currentQ.value?.id] || [])
const checked = computed(() =>
  currentQ.value ? session.value.checkedIds.includes(currentQ.value.id) : false,
)

/** 及时落盘现场 */
function persist() {
  store.saveSession(SESSION_KEY, JSON.parse(JSON.stringify(session.value)))
}

function buildQueue() {
  const items =
    props.mode === 'wrong'
      ? store.wrongQuestions.value.map((q) => q.id)
      : plan.value.items.map((x) => x.q.id)
  return shuffle(items)
}

function start() {
  // 只恢复同一模式的现场，避免"今日"现场串到"错题"模式里；
  // 已不在题库里的 id 会被丢弃（例如导入题库被清空）
  const restored = restoreSession(store.readSession(SESSION_KEY), {
    expect: { mode: props.mode },
    isKnownId: (id) => Boolean(store.getQuestion(id)),
  })
  if (restored) {
    session.value = { ...restored, mode: props.mode }
    resumed.value = restored.index > 0
    return
  }
  session.value = createSession({ ids: buildQueue(), mode: props.mode })
  resumed.value = false
  persist()
}

/** 切换标签回来时重建队列（题库可能已变） */
onMounted(start)

watch(
  () => [props.mode, store.dateKey.value],
  () => start(),
)

function toggleResponse(key) {
  const q = currentQ.value
  if (!q || checked.value) return
  const cur = new Set(session.value.responses[q.id] || [])
  if (q.type === 'multi') {
    cur.has(key) ? cur.delete(key) : cur.add(key)
  } else {
    // 单选 / 判断：点第二次取消选择，方便误触后改正
    if (cur.has(key)) cur.clear()
    else {
      cur.clear()
      cur.add(key)
    }
  }
  session.value.responses = { ...session.value.responses, [q.id]: [...cur] }
  persist()
}

function submit() {
  const q = currentQ.value
  if (!q || checked.value) return
  if (!(session.value.responses[q.id] || []).length) return
  const ok = isCorrect(q, session.value.responses[q.id])
  store.answerQuestion(q, ok ? 'correct' : 'wrong', {
    mode: currentKind.value === 'new' ? 'new' : 'review',
    minutes: currentKind.value === 'new' ? plan.value.minutesPerNew : plan.value.minutesPerReview,
  })
  session.value.checkedIds = [...session.value.checkedIds, q.id]
  persist()
}

function skip() {
  const q = currentQ.value
  if (!q) return
  store.answerQuestion(q, 'skip', { mode: 'review', minutes: 0 })
  next()
}

function next() {
  if (session.value.index + 1 < total.value) {
    session.value.index += 1
    persist()
    scrollToTop()
  } else {
    finish()
  }
}

/**
 * 切到下一题时把滚动位置拉回题目顶部。
 *
 * 移动端是刚需：提交后解析会把操作按钮推到屏幕外（实测 844px 视口里按钮跑到 y≈1060），
 * 用户看完解析要继续就必须先手动往上滑，很容易以为"卡住了"。
 * 滚动发生在 window 上（.hcip 用 min-height，内部容器不滚动）。
 */
function scrollToTop() {
  if (typeof window === 'undefined') return
  // 等 DOM 更新后再滚，否则量到的还是上一题的布局。
  // 用瞬时滚动而不是 smooth：切题是"换一屏内容"，平滑滚动会让按钮在动画期间
  // 仍在屏幕外，连点容易点空（实测 smooth 下按钮从 y≈1212 滚回来要 400ms 以上）。
  requestAnimationFrame(() => {
    const root = document.documentElement
    const prev = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    root.style.scrollBehavior = prev
  })
}

function finish() {
  store.clearSession(SESSION_KEY)
  emit('go', 'today')
}

function restart() {
  store.clearSession(SESSION_KEY)
  session.value = createSession({ ids: buildQueue(), mode: props.mode })
  resumed.value = false
  persist()
}

/** 本题属于新学还是复习（用于记时长与统计口径） */
const currentKind = computed(() => {
  const q = currentQ.value
  if (!q) return 'new'
  const wasTouched = Boolean(store.state.items[q.id])
  return wasTouched ? 'review' : 'new'
})

const kindLabel = computed(() => (currentKind.value === 'new' ? '新学' : '复习'))

const answeredCount = computed(() => session.value.checkedIds.length)
const correctCount = computed(() =>
  session.value.checkedIds.filter((id) => {
    const q = store.getQuestion(id)
    return q && isCorrect(q, session.value.responses[id] || [])
  }).length,
)

/** 一题做完后的对错反馈摘要 */
const feedback = computed(() => {
  const q = currentQ.value
  if (!q || !checked.value) return null
  const ok = isCorrect(q, response.value)
  if (ok) return { tone: 'ok', text: '答对了，继续保持' }
  if (isPartial(q, response.value)) return { tone: 'no', text: '少选了 —— 多选题少选也不得分' }
  return { tone: 'no', text: '答错了，看下解析再继续' }
})

const progressPct = computed(() => (total.value ? (session.value.index / total.value) * 100 : 0))
const hasSelection = computed(() => response.value.length > 0)
</script>

<template>
  <div class="quiz">
    <template v-if="!total">
      <EmptyState
        :title="mode === 'wrong' ? '暂时没有待重做的错题' : '今天没有待做的新题'"
        :desc="
          mode === 'wrong'
            ? '错题在到期后会重新出现在这里。先去「今日」按计划推进吧。'
            : '今日任务已清空，或者题库还未导入。可以去「复习」清理到期题目。'
        "
      >
        <Chip block @click="emit('go', 'today')">回到今日</Chip>
      </EmptyState>
    </template>

    <template v-else>
      <!-- 进度条：碎片时间最想知道"还剩多少" -->
      <div class="bar-wrap">
        <ProgressBar
          :value="progressPct"
          :height="3"
          :show-value="false"
          :label="`第 ${session.index + 1} / ${total} 题`"
        />
        <span class="bar-stat">
          已答 {{ answeredCount }} · 正确 {{ correctCount }}
        </span>
      </div>

      <p v-if="resumed && answeredCount" class="resume-hint">
        已接着上次的进度继续（第 {{ session.index + 1 }} 题），之前答过的都还在。
      </p>

      <QuestionCard
        v-if="currentQ"
        :question="currentQ"
        :response="response"
        :checked="checked"
        :index="session.index + 1"
        :total="total"
        :kind="kindLabel"
        @toggle="toggleResponse"
      />

      <p v-if="feedback" class="feedback" :class="feedback.tone">{{ feedback.text }}</p>

      <!-- 操作区固定底部：长题干时不用滚到底找按钮 -->
      <div class="actions">
        <template v-if="!checked">
          <button
            class="btn primary"
            :disabled="!hasSelection"
            @click="submit"
          >
            提交答案
          </button>
          <button class="btn ghost" @click="skip">暂不复习，跳过</button>
        </template>
        <button v-else class="btn primary" @click="next">
          {{ session.index + 1 < total ? '下一题' : '完成本组' }}
        </button>
      </div>

      <div class="foot">
        <button class="link" @click="restart">重新开始本组</button>
        <button class="link" @click="emit('go', 'today')">退出</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.quiz {
  padding: 14px 14px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bar-stat {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  text-align: right;
}

.resume-hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--cyan);
  border-left: 2px solid var(--cyan);
  padding-left: 11px;
}

.feedback {
  font-size: 13px;
  padding: 10px 12px;
  border-left: 2px solid var(--border-light);
  color: var(--text-dim);
}
.feedback.ok {
  border-color: var(--cyan);
  color: var(--cyan);
}
.feedback.no {
  border-color: var(--red-bright);
  color: var(--red-bright);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 2px;
}

.btn {
  width: 100%;
  min-height: 50px;
  font-family: inherit;
  font-size: 15px;
  letter-spacing: 1px;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}
.btn.primary {
  background: linear-gradient(180deg, var(--red-bright), var(--red));
  border: none;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 6px 18px -6px rgba(255, 45, 45, 0.8);
}
.btn.primary:disabled {
  opacity: 0.4;
  box-shadow: none;
  cursor: not-allowed;
}
.btn.ghost {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
  font-size: 13px;
  min-height: 44px;
}

.foot {
  display: flex;
  justify-content: space-between;
  padding-top: 2px;
}
.link {
  background: none;
  border: none;
  padding: 8px 2px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  touch-action: manipulation;
}
</style>
