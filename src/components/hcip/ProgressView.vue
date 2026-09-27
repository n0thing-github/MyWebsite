<script setup>
import { ref, computed } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { useStudyPlan } from '../../study/useStudyPlan'
import { suggestedOrder } from '../../study/studyOrder'
import { masteryLevel } from '../../study/memory'
import { EXAM_SEQUENCE, getExam } from '../../data/hcip/examConfig'
import { formatDateFullCN, formatMinutes, lastNDaysKey, toDateKey, today, daysBetween } from '../../study/dateUtil'
import { downloadText, backupFilename, copyText } from '../../study/backupFile'
import { Chip, ProgressBar, Sheet, StatCard } from './ui'
import ImportPanel from './ImportPanel.vue'
import SyncPanel from './SyncPanel.vue'
import { useSync } from '../../study/useSync'

/**
 * 进度与设置
 *
 * 除了看数据，这里也是唯一能改"每日可用时长"的地方 ——
 * 计划引擎据此重排任务并刷新完成预估，所以改完会立刻反映在顶栏与今日页。
 */
const emit = defineEmits(['go'])

const store = useStudyStore()
const { forecast, plannedMinutes, effectiveDailyMinutes, pace } = useStudyPlan()

const importOpen = ref(false)
const syncOpen = ref(false)
const confirmReset = ref(false)

const sync = useSync()
const syncEnabled = computed(() => sync.enabled.value)
const syncStatusText = computed(() => sync.status.message || '未启用')

const examMeta = computed(() => store.examMeta.value)

const order = computed(() =>
  suggestedOrder(store.currentExam.value, store.domainStats.value, store.state.diagnostic?.domainScore),
)

/** 30 天热力图 */
const heat = computed(() => {
  const max = Math.max(1, ...store.state.log.map((e) => e.min || 0))
  return lastNDaysKey(30).map((key) => {
    const e = store.state.log.find((x) => x.d === key)
    const min = e?.min || 0
    return { key, min, level: min === 0 ? 0 : Math.min(4, Math.ceil((min / max) * 4)) }
  })
})

/** 累计统计 */
const totals = computed(() => {
  const logs = store.state.log
  return {
    minutes: logs.reduce((a, e) => a + (e.min || 0), 0),
    days: logs.filter((e) => (e.min || 0) > 0).length,
    correct: logs.reduce((a, e) => a + (e.correct || 0), 0),
    wrong: logs.reduce((a, e) => a + (e.wrong || 0), 0),
    mocks: logs.reduce((a, e) => a + (e.mock || 0), 0),
  }
})

const accuracy = computed(() => {
  const t = totals.value.correct + totals.value.wrong
  return t ? Math.round((totals.value.correct / t) * 100) : 0
})

/* ===== 设置 ===== */

function setDaily(min) {
  store.updateSettings({ dailyMinutes: Math.max(5, Math.min(720, Math.round(min))) })
}

/** 快捷时长档位：手机上点选比拖滑块更好按 */
const minutePresets = [15, 30, 45, 60, 90, 120]

const targetPct = computed(() => Math.round(store.settings.value.targetRetention * 100))

function setTarget(pct) {
  store.updateSettings({ targetRetention: Math.max(0.5, Math.min(0.95, pct / 100)) })
}

const stageStyles = [
  { key: 'reviewFirst', label: '复习优先', hint: '复习欠账多时选这个' },
  { key: 'balanced', label: '均衡', hint: '新学与复习各占一半' },
  { key: 'newFirst', label: '新学优先', hint: '进度紧张、想快速过一遍' },
]

/* ===== 备份 ===== */

function doExport() {
  const text = store.doExport()
  const how = downloadText(text, backupFilename(store.dateKey.value))
  importMsg.value =
    how === 'download'
      ? '备份已导出'
      : how === 'clipboard'
        ? '下载被拦截，备份内容已复制到剪贴板'
        : '导出失败：当前环境既不能下载也不能复制'
}

/** 复制而不是下载：微信内置浏览器里下载常被拦，剪贴板是主要退路 */
function doCopyBackup() {
  importMsg.value = copyText(store.doExport()) ? '备份内容已复制到剪贴板' : '复制失败，请改用「导出进度」'
}

function doRestoreBak() {
  const res = store.restoreFromBak()
  importMsg.value = res.ok ? '已用上一份快照恢复' : res.error
}

function doPrune() {
  const n = store.pruneOrphans()
  importMsg.value = n ? `已清理 ${n} 条失效记录` : '没有可清理的记录'
}

/** 上次备份距今多少天（没备份过返回 null） */
const backupDays = computed(() => {
  const at = store.state.meta?.lastBackupAt
  if (!at) return null
  const key = toDateKey(new Date(at))
  return key ? daysBetween(key, today()) : null
})
const backupText = computed(() => {
  if (backupDays.value === null) return '还没备份过'
  if (backupDays.value <= 0) return '上次备份：今天'
  return `上次备份：${backupDays.value} 天前`
})
/** 超过一周没备份就提醒 —— 手机浏览器随时可能被清 */
const backupStale = computed(() => backupDays.value === null || backupDays.value > 7)

const importMsg = ref('')
function onImportBackup(evt) {
  const file = evt.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const res = store.doImport(String(reader.result || ''))
    importMsg.value = res.ok ? '导入成功，进度已恢复' : `导入失败：${res.error}`
  }
  reader.readAsText(file, 'utf-8')
}

function doReset() {
  store.resetAll()
  confirmReset.value = false
  importMsg.value = ''
}

function switchTo(code) {
  store.switchExam(code)
}

const examProgress = computed(() =>
  EXAM_SEQUENCE.map((code) => {
    const meta = getExam(code)
    return { code, meta, active: code === store.currentExam.value }
  }),
)

const storageKB = computed(() => Math.round(store.storageBytes.value / 1024))
</script>

<template>
  <div class="prog">
    <!-- 总览 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">总览</h3>
        <span class="block-meta">{{ formatMinutes(totals.minutes) }} 累计</span>
      </header>
      <div class="stats">
        <StatCard
          label="预计完成"
          :value="formatDateFullCN(forecast.finishKey)"
          tone="red"
          :hint="`约 ${forecast.daysLeft} 天后`"
        />
        <StatCard
          label="已学习天数"
          :value="totals.days"
          unit="天"
          :hint="`日均 ${forecast.perDay} 分钟`"
        />
        <StatCard
          label="累计正确率"
          :value="accuracy"
          unit="%"
          :hint="`${totals.correct} 对 / ${totals.wrong} 错`"
        />
        <StatCard label="模考次数" :value="totals.mocks" unit="次" hint="含单域小测不计入" />
      </div>
      <p class="note">
        计划基准 {{ formatMinutes(plannedMinutes) }}/天，实际按
        {{ Math.round(effectiveDailyMinutes) }} 分钟/天 估算（近 7 天实际权重更高，报数更实在）。
      </p>
    </section>

    <!-- 热力图 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">近 30 天</h3>
      </header>
      <div class="heat">
        <span
          v-for="h in heat"
          :key="h.key"
          class="heat-cell"
          :class="'lv-' + h.level"
          :title="`${h.key}：${h.min} 分钟`"
        ></span>
      </div>
    </section>

    <!-- 分域掌握度 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">分域掌握度</h3>
        <span class="block-meta">按权重排序</span>
      </header>
      <div class="domains">
        <div v-for="o in order" :key="o.id" class="domain">
          <ProgressBar :value="store.domainStats.value[o.id]?.mastery || 0" :height="7" />
          <div class="domain-row">
            <span class="d-name">{{ o.name }}</span>
            <span class="d-meta">
              权重 {{ Math.round(o.weight * 100) }}% ·
              {{ store.domainStats.value[o.id]?.touched || 0 }}/{{ store.domainStats.value[o.id]?.total || 0 }} 题
              <template v-if="store.domainStats.value[o.id]?.due">
                · <b class="due">到期 {{ store.domainStats.value[o.id].due }}</b>
              </template>
            </span>
            <span class="d-level" :class="'lv-' + masteryLevel(store.domainStats.value[o.id]?.mastery || 0).key">
              {{ masteryLevel(store.domainStats.value[o.id]?.mastery || 0).label }}
            </span>
          </div>
        </div>
      </div>
      <p class="note">
        掌握度取该域已学题目"当前保留率"的<b>中位数</b> —— 比平均值更抗个别长尾题的拖累。
      </p>
    </section>

    <!-- 每日时长 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">每日可用时长</h3>
        <span class="block-meta">改完立即重排计划</span>
      </header>
      <div class="preset-row">
        <Chip
          v-for="m in minutePresets"
          :key="m"
          :active="store.settings.value.dailyMinutes === m"
          @click="setDaily(m)"
        >{{ m }}分钟</Chip>
      </div>
      <div class="slider-row">
        <input
          type="range"
          min="5"
          max="240"
          step="5"
          :value="store.settings.value.dailyMinutes"
          @input="setDaily($event.target.value)"
        />
        <span class="slider-val">{{ store.settings.value.dailyMinutes }} 分钟</span>
      </div>
      <p class="note">碎片时间的典型值是 15–30 分钟；时长越少，预估完成日期会相应推后。</p>
    </section>

    <!-- 复习节奏 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">复习节奏</h3>
      </header>
      <p class="note no-border">
        目标保留率 <b>{{ targetPct }}%</b> —— 每题在预计还记得这么多时重新出现。
        调高会更频繁复习、记得更牢但进度更慢。
      </p>
      <div class="preset-row">
        <Chip
          v-for="p in [70, 80, 90]"
          :key="p"
          :active="targetPct === p"
          @click="setTarget(p)"
        >{{ p }}%</Chip>
      </div>

      <p class="note no-border">新学与复习的配比：</p>
      <div class="preset-row">
        <Chip
          v-for="s in stageStyles"
          :key="s.key"
          :active="store.settings.value.stageStyle === s.key"
          @click="store.updateSettings({ stageStyle: s.key })"
        >{{ s.label }}</Chip>
      </div>
      <p class="note">
        {{ stageStyles.find((s) => s.key === store.settings.value.stageStyle)?.hint }}
      </p>
    </section>

    <!-- 考试切换 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">考试</h3>
        <span class="block-meta">按备考顺序</span>
      </header>
      <div class="exams">
        <button
          v-for="e in examProgress"
          :key="e.code"
          class="exam-btn"
          :class="{ 'is-active': e.active }"
          @click="switchTo(e.code)"
        >
          <span class="e-code">{{ e.code }}</span>
          <span class="e-name">{{ e.meta.name }}</span>
          <span class="e-hint">
            <template v-if="e.active">当前目标 · </template>
            {{ e.meta.domains.length }} 域 · 参考 {{ e.meta.domains.reduce((a, d) => a + (d.hours || 0), 0) }} 学时
          </span>
        </button>
      </div>
      <p class="note">
        建议先通过 {{ EXAM_SEQUENCE[0] }} 再切到 {{ EXAM_SEQUENCE[1] }}。
        切换后进度与题库互不干扰，随时可以切回。
      </p>
    </section>

    <!-- 备份 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">数据与备份</h3>
        <span class="block-meta">{{ storageKB }} KB · 存于本机</span>
      </header>
      <div class="btn-row">
        <Chip @click="importOpen = true">导入题库</Chip>
        <Chip @click="doExport">导出进度</Chip>
        <Chip @click="doCopyBackup">复制备份</Chip>
      </div>
      <label class="file-btn">
        <input type="file" accept=".json" @change="onImportBackup" />
        <span>从备份恢复</span>
      </label>
      <Chip v-if="store.hasBackup.value" @click="doRestoreBak">用上一份快照恢复</Chip>
      <p v-if="importMsg" class="ok-msg">{{ importMsg }}</p>

      <p class="note no-border" :class="{ 'is-stale': backupStale }">
        {{ backupText }}。数据只在这台设备的浏览器里，换设备、清缓存前先导出一份 ——
        手机浏览器（尤其微信内置）随时可能被清空。
      </p>

      <p v-if="store.progress.value.orphan" class="note no-border">
        有 {{ store.progress.value.orphan }} 条记录在当前题库里已经找不到（多为导入题库被清空后的残留），
        它们会让统计对不上。<button class="link-btn" @click="doPrune">清理这些记录</button>
      </p>

      <p v-if="!store.saveOk.value" class="warn-msg">
        无法写入本机存储（可能是隐私模式或空间已满）。当前进度只保存在内存，
        请立刻导出备份，关闭页面后会丢失。
      </p>

      <Chip v-if="!confirmReset" @click="confirmReset = true">清空全部进度</Chip>
      <div v-else class="confirm">
        <p class="warn-msg">
          将清空所有做题记录、摸底结果与复习状态（导入的题库不受影响）。此操作不可撤销，
          建议先导出备份。
        </p>
        <div class="btn-row">
          <Chip @click="confirmReset = false">取消</Chip>
          <Chip tone="warn" active @click="doReset">确认清空</Chip>
        </div>
      </div>

      <p class="note">
        数据只存在这台设备的浏览器里，不会上传。换设备或清理浏览器数据会丢失，
        请定期导出备份。
      </p>
    </section>

    <!-- 云同步 -->
    <section class="block">
      <header class="block-head">
        <h3 class="block-title">云同步</h3>
        <span class="block-meta">{{ syncStatusText }}</span>
      </header>
      <p class="note no-border">
        把进度同步到你自己的一个 GitHub secret Gist：手机和电脑共用一份进度，
        清缓存、换设备也不用怕。断网时照常刷题，只是暂时不往云端推。
      </p>
      <div class="btn-row">
        <Chip @click="syncOpen = true">{{ syncEnabled ? '管理云同步' : '启用云同步' }}</Chip>
      </div>
      <p v-if="sync.status.error" class="warn-msg">{{ sync.status.error }}</p>
    </section>

    <!-- 题库说明与免责 -->
    <section class="block">
      <h3 class="block-title">关于题库</h3>
      <p class="note no-border">
        当前题库为<b>按考纲编写的原创练习题</b>，用于建立知识框架与跑通复习机制，
        <b>不是官方真题</b>，也不保证覆盖全部考点。请以你手上的教材与官方大纲为准校对。
      </p>
      <p class="note">
        考纲各域权重为估计值（官方 PDF 未取得），可在
        <code>src/data/hcip/examConfig.js</code> 中修正，页面会自动生效。
      </p>
      <p class="note">
        通过线、时长等考试参数同样以官方为准，本页展示的预估完成时间只是学习节奏推算，
        不代表备考充分程度。
      </p>
    </section>

    <Sheet :open="importOpen" title="导入题库" @close="importOpen = false">
      <ImportPanel />
    </Sheet>

    <Sheet :open="syncOpen" title="云同步（GitHub Gist）" @close="syncOpen = false">
      <SyncPanel />
    </Sheet>
  </div>
</template>

<style scoped>
.prog {
  padding: 14px 14px 24px;
  display: flex;
  flex-direction: column;
  gap: 13px;
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
}
.block-meta {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.heat {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 3px;
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

.domains {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.domain {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.domain-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.d-name {
  font-size: 13.5px;
  color: var(--text);
}
.d-meta {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-dim);
}
.d-meta .due {
  color: var(--red-bright);
}
.d-level {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
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

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 11px;
}
.slider-row input[type='range'] {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 3px;
  background: var(--border-light);
  outline: none;
}
.slider-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: var(--red-bright);
  border: 2px solid var(--bg);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.75);
}
.slider-row input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--red-bright);
  border: 2px solid var(--bg);
}
.slider-val {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text);
  width: 66px;
  text-align: right;
  flex-shrink: 0;
}

.exams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exam-btn {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  padding: 12px;
  background: var(--bg-alt);
  border: 1px solid var(--border-light);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.exam-btn.is-active {
  border-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.1);
}
.e-code {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--red-bright);
}
.e-name {
  font-size: 12.5px;
  color: var(--text);
}
.e-hint {
  font-size: 11px;
  color: var(--text-dim);
}

.btn-row {
  display: flex;
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
  align-self: flex-start;
}
.file-btn input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.ok-msg {
  font-size: 12px;
  color: var(--cyan);
}
.warn-msg {
  font-size: 12px;
  line-height: 1.7;
  color: var(--red-bright);
  border-left: 2px solid var(--red-bright);
  padding-left: 11px;
}

.confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.note {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--text-dim);
  border-left: 2px solid var(--border-light);
  padding-left: 11px;
}
.note.no-border {
  border: none;
  padding: 0;
}
.note b {
  color: var(--text);
}
.note code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--cyan);
}

/* 超过一周没备份：用强调色把它从"说明文字"里提出来 */
.note.is-stale {
  color: var(--red-bright);
}
.link-btn {
  background: none;
  border: none;
  padding: 0 2px;
  font-family: inherit;
  font-size: inherit;
  color: var(--cyan);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  touch-action: manipulation;
}
</style>
