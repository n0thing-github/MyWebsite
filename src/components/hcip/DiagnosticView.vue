<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { restoreSession } from '../../study/session'
import { buildPaper } from '../../study/useStudyPlan'
import { splitByWeight } from '../../data/hcip/examConfig'
import { gradePaper, gradeByDomain } from '../../study/grading'
import { suggestedOrder } from '../../study/studyOrder'
import { masteryLevel } from '../../study/memory'
import QuestionCard from './QuestionCard.vue'
import { Chip, EmptyState, ProgressBar } from './ui'

/**
 * 摸底测试
 *
 * 目的不是打分，而是**校准起点**：
 *   · 给每个域一个初始掌握度，决定"建议学习顺序"
 *   · 给每道摸底题种下初始记忆稳定度（答对 2.0 天 / 答错 0.6 天）
 *   · 让首日计划不是从"全部零基础"盲目开始
 *
 * 题量 40 道按考纲权重分域抽取，覆盖所有域，难度混合。
 *
 * 现场保存：40 题要花一二十分钟，中途接电话、切后台、刷新都很常见，
 * 所以每答一题就把 {ids, index, responses, checkedIds, exam} 落到 store.sessions，
 * 回来时接着上次那一题继续 —— 页面写着"可随时中断"，就得真的做得到。
 */
const emit = defineEmits(['go'])

const store = useStudyStore()

const DIAGNOSTIC_COUNT = 40
const SESSION_KEY = 'diagnostic'

const phase = ref('intro') // intro | running | result
const paper = ref([])
const index = ref(0)
const responses = ref({})
const checkedIds = ref([])
const result = ref(null)
/** 本轮是否来自恢复（用于顶部提示，避免用户以为答错了题号） */
const resumed = ref(false)

const currentQ = computed(() => paper.value[index.value] || null)
const response = computed(() => responses.value[currentQ.value?.id] || [])
const checked = computed(() =>
  currentQ.value ? checkedIds.value.includes(currentQ.value.id) : false,
)
const total = computed(() => paper.value.length)
const hasSelection = computed(() => response.value.length > 0)

const examMeta = computed(() => store.examMeta.value)

/** 每个域抽几道：按考纲权重分配，总数精确等于 DIAGNOSTIC_COUNT */
const perDomain = computed(() => splitByWeight(store.currentExam.value, DIAGNOSTIC_COUNT))

/** 落盘现场（每答一题都调，数据量很小，不必合并） */
function persist() {
  store.saveSession(SESSION_KEY, {
    ids: paper.value.map((q) => q.id),
    index: index.value,
    responses: responses.value,
    checkedIds: checkedIds.value,
    exam: store.currentExam.value,
  })
}

/** 开一份新试卷 */
function newPaper() {
  const all = store.questions.value
  if (!all.length) return
  // 按域抽题后再整体洗牌，避免同域题目连续出现
  paper.value = buildPaper(all, null, DIAGNOSTIC_COUNT, store.weights.value)
  index.value = 0
  responses.value = {}
  checkedIds.value = []
  result.value = null
  resumed.value = false
  phase.value = 'running'
  persist()
}

/**
 * 尝试用已保存的现场续答。
 * 只恢复**同一场考试**的现场 —— 换考试后题目全变了，旧现场没有意义。
 * @returns {boolean} 是否成功续答
 */
function resumeFromSession() {
  const restored = restoreSession(store.readSession(SESSION_KEY), {
    expect: { exam: store.currentExam.value },
    isKnownId: (id) => Boolean(store.getQuestion(id)),
  })
  if (!restored) return false
  paper.value = restored.ids.map((id) => store.getQuestion(id)).filter(Boolean)
  index.value = restored.index
  responses.value = restored.responses
  checkedIds.value = restored.checkedIds
  result.value = null
  resumed.value = true
  phase.value = 'running'
  return true
}

/** 介绍页的「开始摸底」：能续答就续答，否则开一份新的 */
function start() {
  if (resumeFromSession()) return
  newPaper()
}

/** 放弃当前现场重开一轮（现场卡住时的兜底出口） */
function restart() {
  store.clearSession(SESSION_KEY)
  newPaper()
}

/**
 * 挂载时只做"能不能续答"这件事：
 * 有现场就直接回到答题态，没有就**停在介绍页**等用户点开始 ——
 * 不能顺手开一份新试卷，那会把介绍页和"准备开始"的心理预期一起跳过。
 */
onMounted(() => {
  if (!resumeFromSession()) phase.value = 'intro'
})

function skip() {
  store.updateSettings({ diagnosticSkipped: true })
  emit('go', 'today')
}

function toggleResponse(key) {
  const q = currentQ.value
  if (!q || checked.value) return
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

function submit() {
  const q = currentQ.value
  if (!q || !hasSelection.value) return
  checkedIds.value = [...checkedIds.value, q.id]
  persist()
}

function next() {
  if (index.value + 1 < total.value) {
    index.value += 1
    persist()
    scrollToTop()
  } else {
    finish()
  }
}

/**
 * 切题时把滚动位置拉回顶部。
 * 提交后解析会把按钮推到屏幕外（844px 视口里按钮会跑到 y≈1060），
 * 不拉回来的话用户会以为"下一题点不动"。
 * 滚动发生在 window 上（.hcip 用 min-height，内部容器不滚动）。
 */
function scrollToTop() {
  if (typeof window === 'undefined') return
  // 与 QuizRunner 同理：用瞬时滚动，避免平滑动画期间按钮还在屏幕外被点空
  requestAnimationFrame(() => {
    const root = document.documentElement
    const prev = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    root.style.scrollBehavior = prev
  })
}

function finish() {
  const graded = gradePaper(paper.value, responses.value)
  const byDomain = gradeByDomain(graded.details)
  // 存成 0–100，与 domainStats.mastery 同一量纲
  const domainScore = {}
  for (const [id, cell] of Object.entries(byDomain)) {
    domainScore[id] = cell.rate * 100
  }
  store.saveDiagnostic({
    exam: store.currentExam.value,
    domainScore,
    details: graded.details,
    answers: responses.value,
  })
  // 结果已落库，现场不再需要（留着下次进来会重新恢复到答题态）
  store.clearSession(SESSION_KEY)
  result.value = { graded, byDomain, domainScore }
  phase.value = 'result'
}

const order = computed(() => {
  if (!result.value) return []
  return suggestedOrder(store.currentExam.value, store.domainStats.value, result.value.domainScore)
})

const overall = computed(() => (result.value ? result.value.graded.rate * 100 : 0))

/** 摸底总分按域权重加权，比简单平均更能反映"离通过还有多远" */
const weightedScore = computed(() => {
  if (!result.value) return 0
  let sum = 0
  let wSum = 0
  for (const [id, cell] of Object.entries(result.value.byDomain)) {
    const w = store.weights.value[id] || 0
    sum += cell.rate * 100 * w
    wSum += w
  }
  return wSum ? sum / wSum : 0
})
</script>

<template>
  <div class="diag">
    <!-- ========== 介绍 ========== -->
    <template v-if="phase === 'intro'">
      <header class="head">
        <span class="tag">DIAGNOSTIC</span>
        <h2 class="title">先摸底，再定计划</h2>
        <p class="desc">
          这套 <b>{{ DIAGNOSTIC_COUNT }}</b> 道题按 {{ examMeta.code }} 的考纲权重分配到各个知识域。
          它不是考试，目的是找出你的薄弱域，据此排出学习顺序，
          并给每道题一个初始记忆强度 —— 之后的复习计划就从这里长出来。
        </p>
      </header>

      <ul class="facts">
        <li><span>题量</span><b>{{ DIAGNOSTIC_COUNT }} 题</b></li>
        <li><span>覆盖</span><b>{{ store.domains.value.length }} 个知识域</b></li>
        <li><span>预计用时</span><b>约 {{ Math.round((DIAGNOSTIC_COUNT * 1.2) / 5) * 5 }} 分钟</b></li>
        <li><span>是否计时</span><b>不计时，中断可续答</b></li>
      </ul>

      <p class="note">
        每答完一题才会显示该题对错与解析。全部答完后给出分域掌握度与建议学习顺序。
        没把握的题可以凭直觉选，猜错的信息同样有用。
      </p>
      <p class="note">
        中途退出、切后台、刷新都不会丢作答，下次进来接着上次那一题继续；
        <b>答完 {{ DIAGNOSTIC_COUNT }} 题才会计入掌握度</b>，半途而废不会污染起点。
      </p>

      <div class="actions">
        <Chip block :disabled="!store.progress.value.total" @click="start">开始摸底</Chip>
        <Chip block @click="skip">先跳过，直接开始学习</Chip>
      </div>
      <p v-if="!store.progress.value.total" class="warn">题库尚未加载完成，请稍候重试。</p>
    </template>

    <!-- ========== 答题 ========== -->
    <template v-else-if="phase === 'running'">
      <div class="bar-wrap">
        <ProgressBar
          :value="total ? (index / total) * 100 : 0"
          :height="3"
          :show-value="false"
          :label="`摸底进度 ${index + 1} / ${total}`"
        />
      </div>

      <p v-if="resumed" class="resume-hint">
        已接着上次的进度继续（第 {{ index + 1 }} / {{ total }} 题），之前答过的都还在。
      </p>

      <QuestionCard
        v-if="currentQ"
        :question="currentQ"
        :response="response"
        :checked="checked"
        :index="index + 1"
        :total="total"
        kind="摸底"
        @toggle="toggleResponse"
      />

      <div class="actions">
        <Chip v-if="!checked" block :disabled="!hasSelection" @click="submit">提交</Chip>
        <Chip v-else block @click="next">
          {{ index + 1 < total ? '下一题' : '查看摸底结果' }}
        </Chip>
      </div>

      <div class="foot">
        <button class="link" @click="restart">重新开始本次摸底</button>
        <!-- 不能用 emit('go','today')：摸底没完成时 HcipPage 会把人拽回摸底页，
             要离开只能显式跳过（skip 会置 diagnosticSkipped） -->
        <button class="link" @click="skip">跳过摸底，直接开始学习</button>
      </div>
    </template>

    <!-- ========== 结果 ========== -->
    <template v-else>
      <header class="head">
        <span class="tag">RESULT</span>
        <h2 class="title">摸底完成</h2>
        <p class="desc">
          加权得分 <b class="big">{{ weightedScore.toFixed(0) }}</b> / 100
          （按考纲权重加权，比简单平均更接近真实水平）；
          已作答 {{ result.graded.correct }} / {{ result.graded.total - result.graded.blank }} 题正确。
        </p>
      </header>

      <section class="panel">
        <h3 class="panel-title">分域掌握度</h3>
        <div class="domains">
          <div v-for="d in store.domains.value" :key="d.id" class="domain">
            <ProgressBar
              :value="result.domainScore[d.id] ?? 0"
              :label="d.name"
              :height="7"
            />
            <span class="level" :class="'lv-' + masteryLevel(result.domainScore[d.id] ?? 0).key">
              {{ masteryLevel(result.domainScore[d.id] ?? 0).label }}
            </span>
          </div>
        </div>
      </section>

      <section class="panel">
        <h3 class="panel-title">建议学习顺序</h3>
        <p class="panel-note">
          已考虑域之间的依赖（例如 BGP 需要 IGP 作基础），弱项优先但不越级。
        </p>
        <ol class="order">
          <li v-for="(o, i) in order" :key="o.id">
            <span class="ord-idx">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="ord-body">
              <span class="ord-name">{{ o.name }}</span>
              <span class="ord-why">{{ o.reason }} · 权重 {{ Math.round(o.weight * 100) }}%</span>
            </span>
            <span class="ord-score">{{ Math.round(o.mastery) }}%</span>
          </li>
        </ol>
      </section>

      <div class="actions">
        <Chip block @click="emit('go', 'today')">按计划开始今天的学习</Chip>
        <Chip block @click="phase = 'intro'">重做摸底</Chip>
      </div>
      <p class="note">
        摸底只种下初始状态，不会覆盖你之后的学习记录。重做摸底会重新校准掌握度估计。
      </p>
    </template>
  </div>
</template>

<style scoped>
.diag {
  padding: 18px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.head {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--red-bright);
}
.title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--text);
}
.desc {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--text-dim);
}
.desc b {
  color: var(--red-bright);
  font-family: var(--font-mono);
}
.desc .big {
  font-size: 22px;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
}
.facts li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 13px;
  background: var(--surface);
  font-size: 13px;
}
.facts span {
  color: var(--text-dim);
}
.facts b {
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--text);
}

.note,
.warn {
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-dim);
  border-left: 2px solid var(--border-light);
  padding-left: 11px;
}
.warn {
  border-color: var(--red-bright);
  color: var(--red-bright);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 15px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.5px;
}
.panel-note {
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--text-dim);
  margin-top: -4px;
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

.order {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
}
.order li {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  background: var(--bg-alt);
}
.ord-idx {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--red-bright);
  flex-shrink: 0;
}
.ord-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.ord-name {
  font-size: 14px;
  color: var(--text);
}
.ord-why {
  font-size: 11px;
  color: var(--text-dim);
}
.ord-score {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--cyan);
  flex-shrink: 0;
}

.bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resume-hint {
  font-size: 12px;
  line-height: 1.7;
  color: var(--cyan);
  border-left: 2px solid var(--cyan);
  padding-left: 11px;
}

.foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
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
