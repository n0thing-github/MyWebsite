<script setup>
import { ref, computed } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { parseImport, commitImport, guessFormat } from '../../study/useImport'
import { Chip, ProgressBar } from './ui'

/**
 * 题库导入面板
 *
 * 支持 JSON / CSV，自动按扩展名或内容猜格式。
 * 校验失败的条目**全部列出原因**而不是静默丢弃 ——
 * 用户导入的是自己的学习资料，悄悄少几条会让人无法信任这个工具。
 */
const store = useStudyStore()

const text = ref('')
const filename = ref('')
const format = ref('auto')
const report = ref(null)
const busy = ref(false)

const examCode = computed(() => store.currentExam.value)

function pickFile(evt) {
  const file = evt.target.files?.[0]
  if (!file) return
  filename.value = file.name
  format.value = guessFormat(file.name)
  const reader = new FileReader()
  reader.onload = () => {
    text.value = String(reader.result || '')
    runParse()
  }
  reader.readAsText(file, 'utf-8')
}

function runParse() {
  if (!text.value.trim()) {
    report.value = null
    return
  }
  const getExisting = (id) => store.getQuestion(id)
  report.value = parseImport(text.value, format.value, examCode.value, getExisting)
}

function confirmImport() {
  if (!report.value?.accepted?.length) return
  busy.value = true
  commitImport(report.value.accepted, examCode.value, {
    name: filename.value || '粘贴导入',
    count: report.value.accepted.length,
  })
  busy.value = false
  report.value = null
  text.value = ''
  filename.value = ''
}

function reset() {
  text.value = ''
  report.value = null
  filename.value = ''
}
</script>

<template>
  <div class="import">
    <p class="hint">
      支持 <b>JSON 数组</b> 或 <b>CSV</b>。字段：
      <code>id, domain, type, stem, options, answer, explain, tags</code>。
      题型 <code>type</code> 取 <code>single</code> / <code>multi</code> / <code>judge</code>；
      多选答案用 <code>|</code> 分隔（如 <code>A|C</code>）。
      <code>domain</code> 必须是本考试已有的域 id。
    </p>

    <div class="row">
      <label class="file-btn">
        <input type="file" accept=".json,.csv,.txt" @change="pickFile" />
        <span>选择文件</span>
      </label>
      <Chip :active="format === 'json'" @click="format = 'json'; runParse()">JSON</Chip>
      <Chip :active="format === 'csv'" @click="format = 'csv'; runParse()">CSV</Chip>
      <Chip :active="format === 'auto'" @click="format = 'auto'; runParse()">自动</Chip>
    </div>

    <textarea
      v-model="text"
      class="paste"
      rows="5"
      placeholder="也可以直接粘贴内容，然后点「校验」"
      @input="report = null"
    ></textarea>

    <div class="row">
      <Chip :disabled="!text.trim()" @click="runParse">校验</Chip>
      <Chip v-if="text" @click="reset">清空</Chip>
    </div>

    <!-- 校验报告 -->
    <div v-if="report" class="report">
      <p class="ok">可导入 <b>{{ report.accepted.length }}</b> 题（共 {{ report.total }} 条）</p>

      <div v-if="report.errors.length" class="issues">
        <p class="issues-title">被拒绝 {{ report.errors.length }} 条，需修正后才能导入：</p>
        <ul>
          <li v-for="(e, i) in report.errors.slice(0, 40)" :key="i">{{ e }}</li>
        </ul>
        <p v-if="report.errors.length > 40" class="more">…另有 {{ report.errors.length - 40 }} 条</p>
      </div>

      <div v-if="report.duplicates.length" class="issues warn">
        <p class="issues-title">跳过重复 {{ report.duplicates.length }} 条：</p>
        <ul>
          <li v-for="(e, i) in report.duplicates.slice(0, 20)" :key="i">{{ e }}</li>
        </ul>
      </div>

      <p v-if="report.errors.length" class="note">
        存在被拒绝的条目时不会导入任何内容，请修正后重新校验 —— 避免半套题库进入系统后难以排查。
      </p>

      <Chip
        v-else
        block
        tone="cyan"
        :disabled="!report.accepted.length || busy"
        @click="confirmImport"
      >
        确认导入 {{ report.accepted.length }} 题
      </Chip>
    </div>

    <!-- 已导入记录 -->
    <div v-if="store.state.imported?.length" class="history">
      <p class="issues-title">导入记录</p>
      <ul>
        <li v-for="(it, i) in store.state.imported.filter((x) => x.exam === examCode)" :key="i">
          {{ it.name }} · {{ it.count }} 题 · {{ it.at.slice(0, 10) }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.hint {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--text-dim);
}
.hint code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 0 4px;
  color: var(--cyan);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-btn {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--border-light);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  touch-action: manipulation;
}
.file-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.paste {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border-light);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.7;
  padding: 10px;
  resize: vertical;
}
.paste:focus {
  outline: 1px solid var(--cyan);
  outline-offset: 1px;
}

.report {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
}
.ok {
  font-size: 13px;
  color: var(--text);
}
.ok b {
  font-family: var(--font-mono);
  color: var(--cyan);
}

.issues {
  border-left: 2px solid var(--red-bright);
  padding-left: 10px;
}
.issues.warn {
  border-color: #e0a800;
}
.issues-title {
  font-size: 12px;
  color: var(--text);
  margin-bottom: 5px;
}
.issues ul {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 190px;
  overflow-y: auto;
}
.issues li {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}
.more {
  margin-top: 5px;
  font-size: 11px;
  color: var(--text-dim);
}

.note {
  font-size: 11px;
  line-height: 1.7;
  color: #e0a800;
}

.history {
  border-top: 1px solid var(--border);
  padding-top: 10px;
}
.history ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.history li {
  font-size: 11px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}
</style>
