<script setup>
import { computed } from 'vue'

/**
 * 题目卡片
 *
 * 移动端要点：
 *   · 题干与选项都允许长文本换行，绝不出现横向滚动
 *   · 每行选项整行可点（不只是小圆点），触控目标高度 ≥ 48px
 *   · 选项 key 固定宽度，长文本自然缩进
 *   · 判分后：正确项标绿、误选项标红、漏选项描绿虚线
 */
const props = defineProps({
  question: { type: Object, required: true },
  /** 已选选项 key 数组 */
  response: { type: Array, default: () => [] },
  /** 是否已提交（提交后展示对错与解析） */
  checked: { type: Boolean, default: false },
  /** 是否禁用交互（如模考已交卷） */
  disabled: { type: Boolean, default: false },
  /** 是否展示解析 */
  showExplain: { type: Boolean, default: true },
  /** 题号，从 1 开始 */
  index: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  /** 来源标记，如 '新学' / '复习' / '错题' */
  kind: { type: String, default: '' },
})

const emit = defineEmits(['toggle'])

const correctSet = computed(() => new Set((props.question?.answer || []).map((a) => String(a).toUpperCase())))
const responseSet = computed(() => new Set((props.response || []).map((a) => String(a).toUpperCase())))

const isRight = computed(
  () =>
    props.checked &&
    correctSet.value.size === responseSet.value.size &&
    [...correctSet.value].every((k) => responseSet.value.has(k)),
)

const isPartial = computed(() => {
  if (!props.checked || isRight.value) return false
  if (props.question?.type !== 'multi') return false
  if (!responseSet.value.size || responseSet.value.size >= correctSet.value.size) return false
  return [...responseSet.value].every((k) => correctSet.value.has(k))
})

const typeLabel = computed(
  () => ({ single: '单选', multi: '多选', judge: '判断' }[props.question?.type] || '单选'),
)

function optionClass(key) {
  const k = String(key).toUpperCase()
  const picked = responseSet.value.has(k)
  const right = correctSet.value.has(k)
  if (!props.checked) return { picked }
  // 提交后：正确项一律标绿；错选标红；漏选（正确但没选）虚线标绿
  if (right && picked) return { right: true }
  if (right && !picked) return { missed: true }
  if (!right && picked) return { wrong: true }
  return {}
}

function toggle(key) {
  if (props.disabled || props.checked) return
  emit('toggle', String(key).toUpperCase())
}
</script>

<template>
  <article class="qcard">
    <header class="qhead">
      <span class="qidx">
        <b>{{ index }}</b><span v-if="total">/{{ total }}</span>
      </span>
      <span class="qtype">{{ typeLabel }}</span>
      <span v-if="kind" class="qkind">{{ kind }}</span>
      <span v-if="checked" class="qresult" :class="isRight ? 'ok' : 'no'">
        {{ isRight ? '答对' : isPartial ? '少选' : '答错' }}
      </span>
    </header>

    <p class="qstem">{{ question.stem }}</p>

    <ul class="qopts">
      <li
        v-for="opt in question.options"
        :key="opt.key"
        class="qopt"
        :class="optionClass(opt.key)"
        :role="question.type === 'multi' ? 'checkbox' : 'radio'"
        :aria-checked="responseSet.has(String(opt.key).toUpperCase())"
        :tabindex="disabled || checked ? -1 : 0"
        @click="toggle(opt.key)"
        @keydown.enter.prevent="toggle(opt.key)"
        @keydown.space.prevent="toggle(opt.key)"
      >
        <span class="qkey">{{ opt.key }}</span>
        <span class="qtext">{{ opt.text }}</span>
      </li>
    </ul>

    <div v-if="checked && showExplain" class="qexplain">
      <p class="qanswer">
        正确答案：<b>{{ (question.answer || []).join('') }}</b>
        <template v-if="question.type === 'multi'">
          <span class="qnote">（少选 / 多选 / 错选均不得分）</span>
        </template>
      </p>
      <p v-if="question.explain" class="qtext-explain">{{ question.explain }}</p>
      <p v-if="question.source === 'import'" class="qsrc">来源：导入题库</p>
    </div>
  </article>
</template>

<style scoped>
.qcard {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 16px 15px 15px;
}

.qhead {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.qidx {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-dim);
}
.qidx b {
  font-size: 16px;
  color: var(--red-bright);
}
.qtype,
.qkind {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.qkind {
  border-color: rgba(0, 229, 255, 0.35);
  color: var(--cyan);
}
.qresult {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 2px 8px;
}
.qresult.ok {
  color: var(--cyan);
  border: 1px solid rgba(0, 229, 255, 0.45);
}
.qresult.no {
  color: var(--red-bright);
  border: 1px solid rgba(255, 45, 45, 0.55);
}

.qstem {
  font-size: 15.5px;
  line-height: 1.75;
  color: var(--text);
  margin-bottom: 14px;
  /* 长英文术语/命令不换行时允许在任意位置断行，避免撑出横向滚动 */
  overflow-wrap: anywhere;
}

.qopts {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.qopt {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-height: 48px;
  padding: 11px 12px;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.qopt:focus-visible {
  outline: 1px solid var(--cyan);
  outline-offset: 1px;
}

.qkey {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 12px;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.qtext {
  flex: 1;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}

/* 未提交时：仅表示"已选" */
.qopt.picked {
  border-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.1);
}
.qopt.picked .qkey {
  border-color: var(--red-bright);
  background: var(--red-bright);
  color: #fff;
}
.qopt.picked .qtext {
  color: var(--text);
}

/* 已提交：正确（选对） */
.qopt.right {
  border-color: rgba(0, 229, 255, 0.6);
  background: rgba(0, 229, 255, 0.08);
}
.qopt.right .qkey {
  border-color: var(--cyan);
  background: var(--cyan);
  color: #04121a;
}
.qopt.right .qtext {
  color: var(--text);
}

/* 已提交：漏选（正确但没选） */
.qopt.missed {
  border-color: var(--cyan);
  border-style: dashed;
}
.qopt.missed .qkey {
  border-color: var(--cyan);
  border-style: dashed;
  color: var(--cyan);
}

/* 已提交：错选 */
.qopt.wrong {
  border-color: rgba(255, 45, 45, 0.75);
  background: rgba(225, 6, 0, 0.14);
}
.qopt.wrong .qkey {
  border-color: var(--red-bright);
  background: var(--red-bright);
  color: #fff;
}
.qopt.wrong .qtext {
  color: var(--text);
  text-decoration: line-through;
  text-decoration-color: rgba(255, 45, 45, 0.7);
}

.qexplain {
  margin-top: 14px;
  padding: 12px 13px;
  background: rgba(0, 0, 0, 0.25);
  border-left: 2px solid var(--red);
}
.qanswer {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 7px;
}
.qanswer b {
  font-family: var(--font-mono);
  color: var(--red-bright);
  font-size: 14px;
}
.qnote {
  font-size: 11px;
  color: var(--text-dim);
}
.qtext-explain {
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}
.qsrc {
  margin-top: 7px;
  font-size: 10.5px;
  color: var(--border-light);
}
</style>
