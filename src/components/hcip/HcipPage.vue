<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, setSubRoute } from '../../router'
import { useStudyStore } from '../../study/useStudyStore'
import { useStudyPlan } from '../../study/useStudyPlan'
import TabBar from './TabBar.vue'
import StudyTopBar from './StudyTopBar.vue'
import StorageBar from './StorageBar.vue'
import DiagnosticView from './DiagnosticView.vue'
import DashboardView from './DashboardView.vue'
import QuizRunner from './QuizRunner.vue'
import ReviewView from './ReviewView.vue'
import MockExamView from './MockExamView.vue'
import ProgressView from './ProgressView.vue'
import { EmptyState } from './ui'

/**
 * HCIP 备考模块的壳
 *
 * 移动端布局：滚动区 + 固定底部标签栏，用 flex 而不是把所有东西都 fixed —— 
 * 这样滚动区高度自动等于"视口 − 顶栏 − 标签栏"，不需要手算 calc。
 */
const { subRoute } = useRoute()
const store = useStudyStore()
const { plan, forecast, paceLabel, weakDomains } = useStudyPlan()

const current = computed(() => subRoute.value || 'today')

/** 是否已完成摸底（或明确跳过）。未完成时优先引导做摸底 */
const needsDiagnostic = computed(() => {
  if (store.settings.value.diagnosticSkipped) return false
  const d = store.state.diagnostic
  return !d || d.exam !== store.currentExam.value
})

const views = {
  today: DashboardView,
  quiz: QuizRunner,
  wrong: QuizRunner,
  review: ReviewView,
  mock: MockExamView,
  progress: ProgressView,
  diagnostic: DiagnosticView,
}

const activeView = computed(() => views[current.value] || DashboardView)

/** 只有「刷题」与「错题」复用 QuizRunner，用 mode 区分数据来源 */
const runnerMode = computed(() => (current.value === 'wrong' ? 'wrong' : 'today'))

const counts = computed(() => ({
  review: plan.value.dueTotal,
  today: plan.value.items.length,
  wrong: plan.value.counts.wrong,
}))

function goTab(sub) {
  setSubRoute(sub)
}

// 进入模块即确保题库已就绪（按需加载，不拖累首页）
onMounted(() => {
  store.setActiveExamIfEmpty()
  store.refreshDay()
  store.ensureBankLoaded()
})

// 跨天刷新：碎片时间使用常常第二天才打开，日期不能停在昨天
let dayTimer = null
onMounted(() => {
  dayTimer = window.setInterval(() => store.refreshDay(), 60 * 1000)
})
onBeforeUnmount(() => {
  if (dayTimer) window.clearInterval(dayTimer)
})

// 摸底未完成时，无论落到哪个标签都先看摸底（避免用户迷路）
watch(
  [needsDiagnostic, current],
  () => {
    if (needsDiagnostic.value && current.value !== 'diagnostic') {
      setSubRoute('diagnostic')
    }
  },
  { immediate: true },
)

// 换考试后题库要重新加载
watch(
  () => store.currentExam.value,
  (code) => {
    if (code) store.ensureBankLoaded(code)
  },
)
</script>

<template>
  <div class="hcip">
    <StudyTopBar
      :pace="paceLabel"
      :forecast="forecast"
      :weak-count="weakDomains.length"
    />

    <!-- 写盘失败/刚做过恢复时，在**所有标签页**顶部常驻提示：
         这类问题不能藏在「进度」页最底部，用户看不到就等于没有 -->
    <StorageBar />

    <div class="hcip-body">
      <!-- 注意：store 是普通对象，其内部 ref 在模板里**不会**自动解包，
           所以这里必须写 .value（script 里同理） -->
      <p v-if="store.bankStatus.value === 'loading'" class="bank-state">正在加载题库…</p>
      <EmptyState
        v-else-if="store.bankStatus.value === 'error'"
        title="题库加载失败"
        :desc="store.bankError.value || '请检查网络后刷新页面'"
      />
      <EmptyState
        v-else-if="!store.progress.value.total"
        title="题库为空"
        desc="当前考试的题库还没有内容，请到「进度」页导入题库。"
      />
      <component
        :is="activeView"
        v-else
        :counts="counts"
        :mode="activeView === QuizRunner ? runnerMode : undefined"
        @go="goTab"
      />
    </div>

    <TabBar :current="current" :counts="counts" :hide="needsDiagnostic" @go="goTab" />
  </div>
</template>

<style scoped>
.hcip {
  /* 用 dvh 而不是 vh：iOS 地址栏收起/展开时 vh 不跟着变，
     会导致底部标签栏被顶出可视区或留出空白 */
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.hcip-body {
  flex: 1;
  min-height: 0;
  /* 注意：这里**不能**写 overflow-y:auto。
     .hcip 用的是 min-height:100dvh，高度不被约束，
     子元素加 overflow 只会让它自己撑开（实测 scrollHeight == clientHeight，
     等于滚动条根本没生效），实际滚动发生在 window 上。
     让 window 滚动最简单可靠：StudyTopBar 的 position:sticky 也正好生效。 */
  /* 底部留出标签栏高度 + 刘海安全区，避免最后一张卡片被遮住 */
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.bank-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-dim);
  font-size: 14px;
}
</style>
