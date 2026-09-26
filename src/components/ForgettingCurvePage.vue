<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'
import TechButton from './TechButton.vue'
import { MIN_DAY, PRESETS, useForgettingCurve } from '../composables/useForgettingCurve'

/* ============================================================
   图表几何
   用 ResizeObserver 量出容器的实际像素宽高，再让 SVG 的 viewBox 等于该像素尺寸。
   这样 1 个 viewBox 单位 = 1 个 CSS 像素，文字、描边、节点圆都等比，不会像
   preserveAspectRatio="none" 那样被横向拉伸（圆点变椭圆、字被抻宽）。
   ============================================================ */
const CHART_HEIGHT = 340
const PAD = { l: 48, r: 18, t: 20, b: 40 }

const chartWrap = useTemplateRef('chartWrap')
const svgEl = useTemplateRef('svgEl')
const width = ref(720)
let ro = null

// 观察容器宽度，驱动 chartGeom 重算
onMounted(() => {
  const el = chartWrap.value
  if (el?.clientWidth) width.value = el.clientWidth
  if (!el || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width
    if (w && Math.abs(w - width.value) > 0.5) width.value = w
  })
  ro.observe(el)
})

// 卸载清理：requestAnimationFrame 必须取消，否则路由切走后仿真仍在跑；
// ResizeObserver 同理需要解绑。
onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  ro = null
})

const chartGeom = computed(() => {
  const w = Math.max(320, width.value)
  return {
    w,
    h: CHART_HEIGHT,
    pw: Math.max(80, w - PAD.l - PAD.r),
    ph: CHART_HEIGHT - PAD.t - PAD.b,
  }
})

const {
  decayK,
  target,
  growth,
  showBaseline,
  playing,
  cursorDay,
  speed,
  curves,
  customized,
  xOf,
  yOf,
  retentionAt,
  applyDrag,
  resetIntervals,
  applyPreset,
  resetAll,
  play,
  stop,
} = useForgettingCurve()

/** 指针位置换算成图表坐标。1 单位 = 1 CSS 像素，按比例还原即可。 */
function eventToViewBoxX(evt) {
  const el = svgEl.value
  if (!el) return PAD.l
  const rect = el.getBoundingClientRect()
  if (!rect.width) return PAD.l
  return ((evt.clientX - rect.left) / rect.width) * chartGeom.value.w
}

function eventToViewBoxY(evt) {
  const el = svgEl.value
  if (!el) return PAD.t
  const rect = el.getBoundingClientRect()
  if (!rect.height) return PAD.t
  return ((evt.clientY - rect.top) / rect.height) * chartGeom.value.h
}

/** 天数 → 图表横坐标 */
function xOfDay(day) {
  return PAD.l + xOf(day, curves.value.horizon, chartGeom.value.pw)
}

/** 保留率 → 图表纵坐标 */
function yOfRetention(r) {
  return PAD.t + yOf(r, chartGeom.value.ph)
}

/* ============================================================
   指针交互
   两种行为共用一套 pointermove：
     · 在节点上按下并移动  → 拖动复习间隔
     · 单纯在图上移动      → 十字准线跟随，读数显示该天数的保留率
    ============================================================ */
let dragIndex = -1
let dragPrevDay = 0

/** 指针当前悬停的天数；离开图表时置空 */
const hoverDay = ref(null)
/** 指针当前纵坐标，用于判断是否真的落在节点圆点上 */
const hoverY = ref(null)

function onMarkerDown(index, evt) {
  dragIndex = index
  dragPrevDay = index === 0 ? 0 : curves.value.reviews[index - 1].day
  evt.target.setPointerCapture?.(evt.pointerId)
  evt.preventDefault()
}

function onChartMove(evt) {
  // 1 单位 = 1 CSS 像素，直接换算即可
  const x = eventToViewBoxX(evt)
  const day = inverseDay(x - PAD.l)

  if (dragIndex >= 0) {
    // 拖动：只改间隔，不对指针天数做任何吸附——
    // 吸附会让读数卡在节点上、准线跳走，用户感知就是"鼠标被吸住了"
    applyDrag(dragIndex, Math.max(day, dragPrevDay + 0.05))
    return
  }

  // 悬停：准线老老实实跟着鼠标，不做任何吸附
  hoverDay.value = day
  hoverY.value = eventToViewBoxY(evt)
}

function onChartLeave() {
  hoverDay.value = null
  hoverY.value = null
  dragIndex = -1
}

function onPointerUp() {
  dragIndex = -1
}

/** 横坐标 → 天数（对数刻度反解） */
function inverseDay(x) {
  const horizon = curves.value.horizon
  const pw = chartGeom.value.pw
  const ratio = Math.min(1, Math.max(0, x / pw))
  return MIN_DAY * Math.pow(horizon / MIN_DAY, ratio)
}

/* ===== 坐标轴 ===== */
function formatDay(d) {
  if (d < 1) return `${Math.round(d * 24)}h`
  if (d < 30) return `${d % 1 === 0 ? d : d.toFixed(0)}d`
  return `${Math.round(d)}d`
}

/** 读数用的天数：小数值保留两位，长跨度取整，避免出现"第 43.7 天"这种噪声精度 */
function formatDayReadout(d) {
  if (d < 1) return d.toFixed(2)
  if (d < 10) return d.toFixed(1)
  return d.toFixed(0)
}

/** 间隔：同一套精度规则，但带"天"单位 */
function formatSpan(d) {
  if (d < 10) return `${d.toFixed(2)} 天`
  return `${Math.round(d)} 天`
}

/** 百分比读数：小于 1% 时保留两位小数，否则四舍五入到整数，
 *  避免"0.0%"这种把信息抹平成一无所有的写法 */
function formatPct(v) {
  if (!Number.isFinite(v)) return '—'
  if (v < 0.01) return '<0.01%'
  if (v < 1) return `${v.toFixed(2)}%`
  if (v < 10) return `${v.toFixed(1)}%`
  return `${Math.round(v)}%`
}

const axis = computed(() => {
  const ticks = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 90, 180, 365].filter(
    (d) => d <= curves.value.horizon * 1.001,
  )
  return {
    x: ticks.map((d) => ({ d, x: xOfDay(d), label: formatDay(d) })),
    y: [100, 75, 50, 25, 0].map((r) => ({ r, y: yOfRetention(r) })),
  }
})

/* ===== 曲线路径 ===== */
const pathD = computed(() => {
  const pts = curves.value.points
  if (!pts.length) return ''
  let d = ''
  let prev = null
  for (const p of pts) {
    const x = xOfDay(p.day).toFixed(2)
    const y = yOfRetention(p.retention).toFixed(2)
    if (prev && p.day !== prev.day) {
      // 复习发生在同一时刻：保留率垂直回弹到 100%，用竖线表达"这一次复习"
      d += ` L ${x} ${prev.y}`
    }
    d += `${d ? ' L' : 'M'} ${x} ${y}`
    prev = { x, y, day: p.day }
  }
  return d
})

const areaD = computed(() => {
  if (!pathD.value) return ''
  const pts = curves.value.points
  const first = pts[0]
  const last = pts[pts.length - 1]
  const base = yOfRetention(0).toFixed(2)
  return `${pathD.value} L ${xOfDay(last.day).toFixed(2)} ${base} L ${xOfDay(first.day).toFixed(2)} ${base} Z`
})

const baselineD = computed(() => {
  if (!showBaseline.value) return ''
  return curves.value.baseline
    .map(
      (p, i) =>
        `${i ? 'L' : 'M'} ${xOfDay(p.day).toFixed(2)} ${yOfRetention(p.retention).toFixed(2)}`,
    )
    .join(' ')
})

const reviewDots = computed(() =>
  curves.value.reviews.map((r) => {
    const prevDay = r.index === 1 ? 0 : curves.value.reviews[r.index - 2].day
    // 该次复习前（刚衰减到 target）与复习后（回弹到 100%）两个端点
    const before = 100 * Math.exp((-decayK.value * (r.day - prevDay)) / r.prevStability)
    return {
      ...r,
      x: xOfDay(r.day),
      yBefore: yOfRetention(before),
      yAfter: yOfRetention(100),
    }
  }),
)

/* ===== 悬停读数与准线 ===== */

/** 读数：优先显示鼠标悬停处，没有悬停时退回播放光标位置 */
const readout = computed(() => {
  const hovering = hoverDay.value != null
  const day = hovering ? hoverDay.value : cursorDay.value
  return {
    hovering,
    day,
    r: retentionAt(day),
    x: xOfDay(day),
    y: yOfRetention(retentionAt(day)),
  }
})

/**
 * 指针命中的复习节点。
 *
 * 判据必须是**屏幕像素距离**，不能用"天数容差"换算：
 * 横轴是对数刻度，早期复习点之间只隔几个像素，用固定天数容差会得到
 * 一个横向覆盖一大片的判定区，鼠标离得老远就被吸到某个节点上。
 *
 * 而且必须做二维判定（横向 + 纵向）：节点都贴在图表顶部，
 * 如果只看横向，鼠标在节点正下方的空白处也会被判成"命中"，
 * 提示卡就会替掉十字准线——用户想要的"看某一天的保留率"就没了。
 */
const HIT_RADIUS_X = 7
const HIT_RADIUS_Y = 10

const dot = computed(() => {
  const day = hoverDay.value
  if (day == null) return null
  const py = hoverY.value
  const x = xOfDay(day)
  let best = null
  let bestDist = Infinity
  for (const dd of reviewDots.value) {
    const dx = Math.abs(x - dd.x)
    if (dx > HIT_RADIUS_X) continue
    // 指针还没进入过绘图区（py 为空）时退化成只看横向，避免触摸端永远命中不了
    if (py != null && Math.abs(py - dd.yAfter) > HIT_RADIUS_Y) continue
    if (dx < bestDist) {
      bestDist = dx
      best = dd
    }
  }
  return best
})

/** 命中节点的序号（-1 = 未命中），供模板高亮使用 */
const hoverIndex = computed(() => (dot.value ? dot.value.index - 1 : -1))

/**
 * 悬停到某个复习点附近时显示提示卡。
 */
const tooltip = computed(() => {
  const d = dot.value
  if (!d) return null

  const W = 132
  const H = 68
  // 注意：脚本里 chartGeom 是 computed ref，必须写 .value
  // （模板会自动解包，脚本里不会——漏掉 .value 会得到 undefined → NaN）
  const geom = chartGeom.value
  const x = Math.min(Math.max(d.x, PAD.l + W / 2), geom.w - PAD.r - W / 2)
  // 节点都贴在图表顶部，提示卡一律放在节点下方，就不会盖住节点与它的编号
  const y = Math.min(d.yAfter + 22, PAD.t + geom.ph - H - 4)

  return {
    x,
    y,
    w: W,
    h: H,
    title: `第 ${d.index} 次复习`,
    lines: [
      `第 ${formatDay(d.day)}`,
      `间隔 ${formatSpan(d.interval)}`,
      `目标保持率 ${d.retention.toFixed(0)}%`,
    ],
  }
})

// 播放过程中刚跨过复习点时的脉冲提示
const pulseDay = computed(() => {
  if (!playing.value) return null
  const passed = curves.value.reviews.filter((r) => r.day <= cursorDay.value)
  const last = passed[passed.length - 1]
  if (!last) return null
  return cursorDay.value - last.day < curves.value.horizon * 0.02 ? last.day : null
})

/* ===== 滑动条：range 给字符串，状态要数字 ===== */
const decayPct = computed({
  get: () => Math.round(decayK.value * 100),
  set: (v) => (decayK.value = Number(v) / 100),
})
const targetPct = computed({
  get: () => Math.round(target.value * 100),
  set: (v) => (target.value = Number(v) / 100),
})
const growthPct = computed({
  get: () => Math.round(growth.value * 10),
  set: (v) => (growth.value = Number(v) / 10),
})

const summary = computed(() => curves.value.summary)
const reviews = computed(() => curves.value.reviews)

// 参数或复习点变化后光标读数会失真，直接复位（播放中除外，否则动画会被打断）
watch([decayK, target, growth, () => curves.value.horizon], () => {
  if (!playing.value) cursorDay.value = 0
})
</script>

<template>
  <main class="curve-page">
    <div class="container">
      <!-- ===== 页头 ===== -->
      <header class="curve-head">
        <span class="section-tag">Memory Model</span>
        <h1 class="section-title">
          艾宾浩斯<span class="accent">遗忘曲线</span>
        </h1>
        <p class="section-desc">
          19 世纪心理学家赫尔曼·艾宾浩斯用无意义音节做实验，画出了人类记忆衰减的第一条曲线：
          新学的内容若不复习，一天后就只剩不到一半。
          下图把它写成可调参数的模型 —— 拖动滑块与曲线上的红色节点，观察复习如何把记忆一次次拉回高位。
        </p>

        <div class="head-meta">
          <span class="meta-chip">R(t) = 100 · e<sup>−t/S</sup></span>
          <span class="meta-chip">Δt<sub>n</sub> = S<sub>n−1</sub> · ln(1/R)</span>
          <TechButton href="#home" ghost>返回主页</TechButton>
        </div>
      </header>

      <!-- ===== 状态卡片 ===== -->
      <div class="stat-row">
        <div class="stat-cell">
          <span class="stat-num">{{ summary.reviewCount }}</span>
          <span class="stat-label">复习次数</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ summary.finalInterval.toFixed(1) }}</span>
          <span class="stat-label">末次间隔（天）</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ summary.day1.toFixed(0) }}%</span>
          <span class="stat-label">1 天后·不复习</span>
        </div>
        <div class="stat-cell">
          <span class="stat-num">{{ summary.day6.toFixed(0) }}%</span>
          <span class="stat-label">6 天后·不复习</span>
        </div>
      </div>

      <!-- ===== 图表 ===== -->
      <section class="chart-card">
        <div class="chart-toolbar">
          <span class="toolbar-title">// 保留率 · 学习后时间</span>
          <div class="toolbar-actions">
            <button
              v-for="s in [1, 2, 4]"
              :key="s"
              class="chip"
              :class="{ 'is-on': speed === s }"
              @click="speed = s"
            >
              {{ s }}×
            </button>
            <button class="chip" :class="{ 'is-on': playing }" @click="playing ? stop() : play()">
              {{ playing ? '暂停' : '播放' }}
            </button>
            <button class="chip" @click="resetAll">重置</button>
          </div>
        </div>

        <div ref="chartWrap" class="chart-wrap">
          <svg
            ref="svgEl"
            class="chart"
            :viewBox="`0 0 ${chartGeom.w} ${chartGeom.h}`"
            :width="chartGeom.w"
            :height="chartGeom.h"
            aria-hidden="true"
            @pointermove="onChartMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onChartLeave"
          >
            <defs>
              <linearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.26" />
                <stop offset="100%" stop-color="#00e5ff" stop-opacity="0" />
              </linearGradient>
            </defs>

            <!-- 网格 -->
            <g class="grid">
              <line
                v-for="t in axis.y"
                :key="`y${t.r}`"
                :x1="PAD.l"
                :x2="chartGeom.w - PAD.r"
                :y1="t.y"
                :y2="t.y"
              />
              <line
                v-for="t in axis.x"
                :key="`x${t.d}`"
                :x1="t.x"
                :x2="t.x"
                :y1="PAD.t"
                :y2="PAD.t + chartGeom.ph"
              />
            </g>

            <!-- 坐标文字 -->
            <g class="axis-label">
              <text
                v-for="t in axis.y"
                :key="`yl${t.r}`"
                :x="PAD.l - 8"
                :y="t.y + 3"
                text-anchor="end"
              >
                {{ t.r }}%
              </text>
              <text
                v-for="t in axis.x"
                :key="`xl${t.d}`"
                :x="t.x"
                :y="PAD.t + chartGeom.ph + 18"
                text-anchor="middle"
              >
                {{ t.label }}
              </text>
              <text
                class="axis-unit"
                :x="chartGeom.w - PAD.r"
                :y="PAD.t + chartGeom.ph + 34"
                text-anchor="end"
              >
                学习后时间（天，对数刻度）
              </text>
            </g>

            <!-- 目标保持率参考线 -->
            <line
              class="target-line"
              :x1="PAD.l"
              :x2="chartGeom.w - PAD.r"
              :y1="yOfRetention(target * 100)"
              :y2="yOfRetention(target * 100)"
            />
            <text class="target-text" :x="PAD.l + 6" :y="yOfRetention(target * 100) - 6">
              目标保持率 {{ Math.round(target * 100) }}%
            </text>

            <!-- 不复习基线 -->
            <path v-if="showBaseline" class="baseline" :d="baselineD" />

            <!-- 主曲线 -->
            <path v-if="areaD" class="area" :d="areaD" />
            <path v-if="pathD" class="curve" :d="pathD" />

            <!-- 悬停命中区：铺满绘图区，保证空白处也能收到指针事件
                 （SVG 只有描边/填充参与命中，没有这块面的话大部分区域收不到 pointermove） -->
            <rect
              class="hit-area"
              :x="PAD.l"
              :y="PAD.t"
              :width="chartGeom.pw"
              :height="chartGeom.ph"
            />

            <!-- 复习节点（可拖动） -->
            <g
              v-for="d in reviewDots"
              :key="d.index"
              class="marker"
              :class="{ 'is-active': hoverIndex === d.index - 1 }"
            >
              <line class="marker-stem" :x1="d.x" :x2="d.x" :y1="d.yAfter" :y2="d.yBefore" />
              <circle
                class="marker-hit"
                :cx="d.x"
                :cy="d.yAfter"
                r="9"
                @pointerdown="onMarkerDown(d.index - 1, $event)"
              />
              <circle class="marker-dot" :cx="d.x" :cy="d.yAfter" r="3.6" />
              <text
                v-if="hoverIndex === d.index - 1 && !tooltip"
                class="marker-text"
                :x="d.x"
                :y="d.yAfter - 11"
                text-anchor="middle"
              >
                #{{ d.index }}
              </text>
            </g>

            <!-- 十字准线：跟随鼠标，读出该天数的保留率 -->
            <g v-if="readout.hovering && !tooltip" class="crosshair">
              <line :x1="readout.x" :x2="readout.x" :y1="PAD.t" :y2="PAD.t + chartGeom.ph" />
              <circle :cx="readout.x" :cy="readout.y" r="4" />
            </g>

            <!-- 播放光标 -->
            <g v-if="(playing || cursorDay > 0) && !readout.hovering" class="cursor">
              <line :x1="readout.x" :x2="readout.x" :y1="PAD.t" :y2="PAD.t + chartGeom.ph" />
              <circle :cx="readout.x" :cy="readout.y" r="5" />
              <circle
                v-if="pulseDay !== null"
                class="cursor-pulse"
                :cx="xOfDay(pulseDay)"
                :cy="yOfRetention(100)"
                r="13"
              />
            </g>

            <!-- 复习点提示卡：放在节点下方，避开节点本身与它的编号 -->
            <g v-if="tooltip" class="tip">
              <rect
                :x="tooltip.x - tooltip.w / 2"
                :y="tooltip.y"
                :width="tooltip.w"
                :height="tooltip.h"
                rx="2"
              />
              <text :x="tooltip.x" :y="tooltip.y + 17" text-anchor="middle" class="tip-title">
                {{ tooltip.title }}
              </text>
              <text
                v-for="(line, i) in tooltip.lines"
                :key="i"
                :x="tooltip.x"
                :y="tooltip.y + 33 + i * 13"
                text-anchor="middle"
              >
                {{ line }}
              </text>
            </g>
          </svg>

          <div class="chart-readout">
            <span>
              第
              <b>{{ formatDayReadout(readout.day) }}</b>
              天
            </span>
            <span>
              剩余 <b>{{ formatPct(readout.r) }}</b>
            </span>
            <span class="readout-state">{{ readout.hovering ? '鼠标位置' : '播放位置' }}</span>
            <span class="hint">在图表上移动鼠标可查看任意天数的保留率</span>
          </div>
        </div>
      </section>

      <!-- ===== 控制区 + 数据表 ===== -->
      <div class="panel-grid">
        <section class="panel">
          <h2 class="panel-title">参数</h2>

          <label class="slider">
            <span class="slider-head">
              <span>衰减敏感度 <i>k</i></span>
              <b>{{ decayK.toFixed(2) }}</b>
            </span>
            <input v-model="decayPct" type="range" min="15" max="60" step="1" />
            <span class="slider-note">越大代表忘得越快，整条曲线向下压</span>
          </label>

          <label class="slider">
            <span class="slider-head">
              <span>目标保持率 <i>R</i></span>
              <b>{{ Math.round(target * 100) }}%</b>
            </span>
            <input v-model="targetPct" type="range" min="50" max="95" step="1" />
            <span class="slider-note">每次复习都安排在降到这条水位线的瞬间</span>
          </label>

          <label class="slider">
            <span class="slider-head">
              <span>稳定度增长 <i>g</i></span>
              <b>{{ growth.toFixed(1) }}</b>
            </span>
            <input v-model="growthPct" type="range" min="4" max="30" step="1" />
            <span class="slider-note">决定复习间隔拉长的速度，也决定最终能撑多久</span>
          </label>

          <div class="presets">
            <button
              v-for="p in PRESETS"
              :key="p.key"
              class="preset"
              :class="{ 'is-on': Math.abs(growth - p.growth) < 0.001 }"
              :title="p.desc"
              @click="applyPreset(p.growth)"
            >
              <b>{{ p.label }}</b>
              <small>{{ p.desc }}</small>
            </button>
          </div>

          <div class="toggles">
            <label class="toggle">
              <input v-model="showBaseline" type="checkbox" />
              <span>显示「不复习」基线</span>
            </label>
            <button v-if="customized" class="chip chip-quiet" @click="resetIntervals">
              清除手动间隔
            </button>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">
            复习计划
            <span class="panel-sub">等保留率间隔推算</span>
          </h2>

          <div class="table-scroll">
            <table class="plan">
              <caption class="sr-only">
                按等保留率间隔推算的复习计划表
              </caption>
              <thead>
                <tr>
                  <th scope="col">次</th>
                  <th scope="col">第几天</th>
                  <th scope="col">间隔</th>
                  <th scope="col">稳定度</th>
                  <th scope="col">复习时</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in reviews" :key="d.index" :class="{ 'is-active': hoverIndex === d.index - 1 }">
                  <td class="c-idx">{{ d.index }}</td>
                  <td>{{ d.day < 1 ? d.day.toFixed(2) : d.day.toFixed(1) }}</td>
                  <td>{{ d.interval.toFixed(2) }} 天</td>
                  <td>{{ d.stability.toFixed(1) }} 天</td>
                  <td class="c-red">{{ d.retention.toFixed(0) }}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="panel-foot">
            按当前参数，约在第 <b>{{ summary.plateauDay.toFixed(0) }}</b> 天进入稳定期
            （稳定度成长到终值的 90%，此后边际收益已经很小）。
            到观察窗口末端第 <b>{{ summary.tailDay.toFixed(0) }}</b> 天，
            按这套计划复习过的记忆还剩约 <b>{{ formatPct(summary.tailRetention) }}</b>；
            同样这些天完全没复习则只剩约 <b>{{ formatPct(summary.tailBaselineRetention) }}</b>。
          </p>
        </section>
      </div>

      <p class="disclaimer">
        模型说明：真实遗忘速度受材料难度、编码深度、睡眠与情绪影响，个体差异很大。
        这里呈现的是可解释的近似模型，用于理解「间隔重复」为何有效，而非精确预测个人记忆。
      </p>
    </div>
  </main>
</template>

<style scoped>
.curve-page {
  position: relative;
  padding: calc(var(--nav-h) + 64px) 0 96px;
}

/* ===== 页头 ===== */
.curve-head {
  max-width: 880px;
}
.head-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 30px;
}
.meta-chip {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--cyan);
  border: 1px solid rgba(0, 229, 255, 0.28);
  background: rgba(0, 229, 255, 0.05);
  padding: 7px 14px;
}
.head-meta :deep(.tech-btn) {
  padding: 12px 26px;
}

/* ===== 状态卡片 ===== */
.stat-row {
  margin: 46px 0 30px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
}
.stat-cell {
  background: var(--bg-alt);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.stat-num {
  font-family: var(--font-mono);
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
  color: var(--red-bright);
  text-shadow: 0 0 18px rgba(255, 45, 45, 0.45);
}
.stat-label {
  font-size: 12px;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}

/* ===== 图表卡片 ===== */
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 20px 22px 16px;
}
.chart-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.toolbar-title {
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 1.5px;
  color: var(--text-dim);
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.chip {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border-light);
  padding: 6px 12px;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  touch-action: manipulation;
}
.chip.is-on {
  color: #fff;
  border-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.18);
  box-shadow: 0 0 12px -2px rgba(255, 45, 45, 0.7);
}
.chip-quiet {
  align-self: flex-start;
}
@media (hover: hover) {
  .chip:hover {
    color: #fff;
    border-color: var(--red-bright);
  }
}

/* 图表：宽高由 chartGeom 按容器实测像素写入，1 单位 = 1 CSS 像素 */
.chart-wrap {
  width: 100%;
}
.chart {
  display: block;
  max-width: 100%;
  touch-action: none;
}

.grid line {
  stroke: rgba(255, 255, 255, 0.055);
  stroke-width: 1;
}
.axis-label text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--text-dim);
}
.axis-label .axis-unit {
  font-size: 10px;
  fill: rgba(154, 160, 166, 0.7);
}

.target-line {
  stroke: rgba(225, 6, 0, 0.5);
  stroke-width: 1;
  stroke-dasharray: 5 5;
}
.target-text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: rgba(255, 45, 45, 0.85);
}

.baseline {
  fill: none;
  stroke: rgba(225, 6, 0, 0.65);
  stroke-width: 1.4;
  stroke-dasharray: 6 5;
}
.area {
  fill: url(#fcArea);
  stroke: none;
}
.curve {
  fill: none;
  stroke: var(--cyan);
  stroke-width: 1.8;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 5px rgba(0, 229, 255, 0.55));
}

/* 复习节点 */
/* 复习节点：整组不参与命中，只有 .marker-hit 是拖拽热区。
   否则虚线的竖杆也会改变光标形状，鼠标划过时同样会闪。 */
.marker {
  pointer-events: none;
}
.marker-stem {
  stroke: rgba(255, 45, 45, 0.55);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.marker-hit {
  fill: transparent;
  cursor: grab;
  /* 热区必须收回命中能力（被 .marker 的 none 覆盖掉了） */
  pointer-events: all;
}
.marker-hit:active {
  cursor: grabbing;
}
.marker-dot {
  fill: var(--bg);
  stroke: var(--red-bright);
  stroke-width: 1.6;
  pointer-events: none;
  transition: r 0.2s ease;
}
/* 编号只在指针落在节点上时出现：复习点多的时候常显会挤成一团。
   提示卡展开时也不显示，避免和卡片内容打架。 */
.marker-text {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--red-bright);
  pointer-events: none;
}
.marker.is-active .marker-dot {
  r: 5.5;
  fill: var(--red-bright);
}

/* 悬停命中区：透明但可命中，铺满绘图区 */
.hit-area {
  fill: transparent;
  cursor: crosshair;
}

/* 十字准线：跟随鼠标 */
.crosshair {
  /* 关键：准线正好画在鼠标所在位置，如果参与命中判定，
     光标就会在 crosshair（准线）和 crosshair（命中区）之间来回跳，
     视觉上表现为"移动时指针不停闪烁"。所有纯装饰图层都必须让出命中。 */
  pointer-events: none;
}
.crosshair line {
  stroke: rgba(236, 236, 240, 0.35);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}
.crosshair circle {
  fill: var(--cyan);
  stroke: var(--bg);
  stroke-width: 1.5;
  filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.8));
}

/* 播放光标 */
.cursor {
  pointer-events: none;
}
.cursor line {
  stroke: rgba(0, 229, 255, 0.4);
  stroke-width: 1;
}
.cursor circle {
  fill: var(--cyan);
  filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.9));
}
.cursor-pulse {
  fill: none;
  stroke: var(--red-bright);
  stroke-width: 2;
  animation: fcPulse 0.7s ease-out infinite;
}
@keyframes fcPulse {
  from {
    opacity: 0.9;
    r: 8;
  }
  to {
    opacity: 0;
    r: 20;
  }
}

/* 提示卡 */
.tip rect {
  fill: rgba(10, 10, 12, 0.94);
  stroke: var(--border-light);
  stroke-width: 1;
}
.tip text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--text-dim);
}
.tip .tip-title {
  fill: #fff;
  font-size: 10.5px;
}

.chart-readout {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  padding-top: 12px;
  margin-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-dim);
}
.chart-readout b {
  font-family: var(--font-mono);
  color: var(--cyan);
  font-size: 15px;
}
/* 标明当前读数来自鼠标还是播放光标 */
.chart-readout .readout-state {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-dim);
  border: 1px solid var(--border);
  padding: 2px 8px;
}
.chart-readout .hint {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.75;
}

/* ===== 控制区 + 表格 ===== */
.panel-grid {
  display: grid;
  grid-template-columns: 1fr 1.05fr;
  gap: 24px;
  margin-top: 24px;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 24px 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.panel-title {
  font-size: 15px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text);
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.panel-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: none;
  color: var(--text-dim);
}

.slider {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.slider-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 14px;
  color: var(--text);
}
.slider-head i {
  font-family: var(--font-mono);
  font-style: normal;
  color: var(--red-bright);
}
.slider-head b {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--cyan);
}
.slider-note {
  font-size: 12px;
  color: var(--text-dim);
}
.slider input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 3px;
  background: var(--border-light);
  outline: none;
  cursor: pointer;
}
.slider input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--red-bright);
  border: 2px solid var(--bg);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.75);
  cursor: grab;
}
.slider input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--red-bright);
  border: 2px solid var(--bg);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.75);
  cursor: grab;
}
.slider input[type='range']:focus-visible {
  outline: 1px solid var(--cyan);
  outline-offset: 4px;
}

.presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.preset {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: left;
  background: var(--bg-alt);
  border: 1px solid var(--border-light);
  padding: 11px 13px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s ease, background 0.2s ease;
  touch-action: manipulation;
}
.preset b {
  font-size: 13.5px;
  color: var(--text);
  letter-spacing: 0.5px;
}
.preset small {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 1.45;
}
.preset.is-on {
  border-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.12);
}
.preset.is-on b {
  color: var(--red-bright);
}
@media (hover: hover) {
  .preset:hover {
    border-color: rgba(225, 6, 0, 0.6);
  }
}

.toggles {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-dim);
  cursor: pointer;
}
.toggle input {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid var(--border-light);
  background: transparent;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}
.toggle input:checked {
  border-color: var(--red-bright);
  background: var(--red-bright);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.7);
}

.table-scroll {
  overflow-x: auto;
}
.plan {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.plan th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  font-weight: 400;
  color: var(--text-dim);
  padding: 0 10px 9px 0;
  border-bottom: 1px solid var(--border-light);
  white-space: nowrap;
}
.plan td {
  padding: 9px 10px 9px 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
  font-family: var(--font-mono);
  white-space: nowrap;
}
.plan tbody tr {
  transition: background 0.2s ease;
}
.plan tbody tr.is-active {
  background: rgba(0, 229, 255, 0.06);
}
.c-idx {
  color: var(--red-bright);
}
.c-red {
  color: var(--cyan);
}
.panel-foot {
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--text-dim);
}
.panel-foot b {
  font-family: var(--font-mono);
  color: var(--red-bright);
}

.disclaimer {
  margin-top: 30px;
  font-size: 12.5px;
  line-height: 1.8;
  color: rgba(154, 160, 166, 0.8);
  border-left: 2px solid var(--red-dim);
  padding-left: 14px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ===== 响应式 ===== */
@media (max-width: 900px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .curve-page {
    padding-top: calc(var(--nav-h) + 40px);
  }
  .chart-readout .hint {
    margin-left: 0;
    width: 100%;
  }
  .presets {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor-pulse {
    animation: none;
  }
  .curve {
    filter: none;
  }
}
</style>
