<script setup>
import { computed } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { useStudyPlan } from '../../study/useStudyPlan'
import { priority } from '../../study/memory'
import { formatMinutes } from '../../study/dateUtil'
import { Chip, EmptyState, StatCard } from './ui'

/**
 * 复习
 *
 * 展示今日到期队列 —— **顺序就是复习顺序**：按当前保留率升序，
 * 最模糊的排最前。这是间隔重复的核心，所以把顺序摊开给用户看，
 * 而不是藏在一个"开始复习"按钮后面。
 */
const emit = defineEmits(['go'])

const store = useStudyStore()
const { plan } = useStudyPlan()

const due = computed(() => store.dueQuestions.value)

/** 队列前若干项，附带保留率与到期状态 */
const queue = computed(() => {
  const dk = store.dateKey.value
  const target = store.settings.value.targetRetention
  return due.value.slice(0, 12).map((q) => {
    const st = store.state.items[q.id]
    const r = priority(st, dk, target)
    const overdueDays = st?.due ? Math.max(0, daysBetween(st.due, dk)) : 0
    return { q, retention: r, overdueDays, lapses: st?.lapses || 0 }
  })
})

function daysBetween(a, b) {
  const d1 = new Date(`${a}T00:00:00`)
  const d2 = new Date(`${b}T00:00:00`)
  return Math.round((d2 - d1) / 86400000)
}

const totalMinutes = computed(() => Math.round(due.value.length * plan.value.minutesPerReview))

const weakest = computed(() => queue.value[0] || null)
</script>

<template>
  <div class="review">
    <template v-if="!due.length">
      <EmptyState
        title="今天没有到期的复习"
        desc="间隙重复的关键就是「到点再来」。现在可以去学新内容，或者做一次模考检验水平。"
      >
        <Chip block tone="cyan" @click="emit('go', 'quiz')">去学新内容</Chip>
        <Chip block @click="emit('go', 'today')">回到今日</Chip>
      </EmptyState>
    </template>

    <template v-else>
      <section class="head">
        <span class="tag">REVIEW QUEUE</span>
        <h2 class="title">今日到期 {{ due.length }} 题</h2>
        <p class="desc">
          预计用时 {{ formatMinutes(totalMinutes) }}。顺序按当前保留率从低到高 ——
          最先出现的正是最可能已经忘掉的题。
        </p>
      </section>

      <div class="stats">
        <StatCard
          label="最该先复习"
          :value="weakest ? Math.round(weakest.retention) + '%' : '—'"
          tone="red"
          hint="当前保留率（越低越急）"
        />
        <StatCard
          :label="plan.counts.wrong ? '其中错题' : '含逾期'"
          :value="plan.counts.wrong || queue.filter((x) => x.overdueDays > 0).length"
          unit="题"
          :hint="plan.counts.wrong ? '先清错题更划算' : '超过计划日期未复习'"
        />
      </div>

      <Chip v-if="plan.counts.wrong" block tone="warn" @click="emit('go', 'wrong')">
        先清错题（{{ plan.counts.wrong }} 题）
      </Chip>
      <Chip v-else block @click="emit('go', 'quiz')">开始复习（{{ due.length }} 题）</Chip>

      <section class="list-block">
        <h3 class="list-title">队列预览</h3>
        <ol class="list">
          <li v-for="(item, i) in queue" :key="item.q.id">
            <span class="idx">{{ String(i + 1).padStart(2, '0') }}</span>
            <span class="body">
              <span class="stem">{{ item.q.stem }}</span>
              <span class="meta">
                <span class="domain">{{ store.domainStats.value[item.q.domain]?.name || item.q.domain }}</span>
                <span v-if="item.lapses" class="lapse">错过 {{ item.lapses }} 次</span>
                <span v-if="item.overdueDays" class="overdue">逾期 {{ item.overdueDays }} 天</span>
              </span>
            </span>
            <span class="ret" :class="item.retention < 50 ? 'low' : item.retention < 75 ? 'mid' : 'high'">
              {{ Math.round(item.retention) }}%
            </span>
          </li>
        </ol>
        <p v-if="due.length > queue.length" class="more">
          仅预览前 {{ queue.length }} 题，其余 {{ due.length - queue.length }} 题在答题时按同序出现。
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.review {
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
.desc {
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-dim);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.list-block {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 13px 12px;
}
.list-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 10px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
}
.list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px;
  background: var(--bg-alt);
}
.idx {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  flex-shrink: 0;
  padding-top: 2px;
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.stem {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text);
  /* 只显示两行，避免长题干把列表撑爆 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 10.5px;
  color: var(--text-dim);
}
.domain {
  font-family: var(--font-mono);
}
.lapse {
  color: #e0a800;
}
.overdue {
  color: var(--red-bright);
}
.ret {
  font-family: var(--font-mono);
  font-size: 12px;
  flex-shrink: 0;
  padding-top: 2px;
}
.ret.low {
  color: var(--red-bright);
}
.ret.mid {
  color: #e0a800;
}
.ret.high {
  color: var(--cyan);
}

.more {
  margin-top: 10px;
  font-size: 11px;
  color: var(--text-dim);
}
</style>
