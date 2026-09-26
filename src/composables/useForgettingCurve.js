import { ref, computed } from 'vue'

/**
 * 艾宾浩斯遗忘曲线 —— 数据模型与交互状态
 *
 * 模型（把教科书上的定性曲线写成可调参数的定量形式）：
 *   保留率          R(t) = 100 * exp(-t / S)          t: 距上次复习的天数
 *   记忆稳定度      S₀ = 1.2 天，第 n 次复习后 S(n) = S₀ * (1 + g*n)
 *
 * 为什么写成 exp(-t/S) 而不是照搬"1 天后 33%"的固定点：
 *   固定点只是某个 S 下的特例，不能随参数变化。指数形式下
 *   S = 1.2 天时 R(1) ≈ 43%，调低衰减敏感度即可逼近经典位置，
 *   既有可解释性又能驱动交互。
 *
 * 复习时刻采用「等保留率间隔」：让每次复习都落在保留率降到 target 的瞬间，
 *   Δt_n = S(n-1) * ln(1/target)
 * 这正是间隔重复（Spaced Repetition）的核心结论：间隔应随稳定度平方级放大。
 */

/** 天数上下限：横轴用对数刻度，下限必须 > 0 */
export const MIN_DAY = 0.05
export const MAX_DAY = 365

/** 单次复习间隔的下限，防止复习点全部挤在 t≈0 处导致刻度退化 */
const MIN_INTERVAL = 0.05
/** 复习次数上限，防止 growth 极小时循环出几十次复习把图表塞满；
 *  实际次数主要由 365 天观察窗口决定，这里只是兜底 */
const MAX_REVIEWS = 12
/** 观察窗口下限：太短的话"遗忘"还没展开，曲线看起来像一条水平线 */
const MIN_HORIZON = 30

const S0 = 1.2

/** 预置方案：把"经典复习间隔表"换算成等价的增长系数 g */
export const PRESETS = [
  { key: 'day1', label: '1天速记', growth: 0.7, desc: '当天连刷，适合考前突击' },
  { key: 'day3', label: '3天', growth: 1.0, desc: '短周期，适合新课当天巩固' },
  { key: 'day7', label: '7天', growth: 1.6, desc: '均衡方案，日常学习推荐' },
  { key: 'day30', label: '30天', growth: 2.2, desc: '长周期，适合长期记忆' },
]

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol

function buildCurves({ decayK, target, growth, intervals, capDay }) {
  // —— 1. 复习时刻：优先用等保留率间隔公式，用户拖动过的位置由 intervals 覆盖 ——
  const k = Math.max(decayK, 0.05)
  const t = clamp(target, 0.5, 0.95)
  const reviews = []

  for (let i = 0; i < MAX_REVIEWS; i += 1) {
    // 第 i 次复习前的稳定度：S(0)=S0（首次复习前），S(i)=S0*(1+g*i)
    const sPrev = i === 0 ? S0 : S0 * (1 + growth * i)
    const formula = (sPrev * Math.log(1 / t)) / k
    const raw = intervals[i] == null ? formula : intervals[i]

    let interval
    if (i === 0) {
      interval = raw
    } else {
      // 稳定度只增不减，所以后续间隔在物理上不应小于前一次。
      // 用户往前拖时用这个下限兜住，保证表格与图表始终单调递增。
      interval = Math.max(raw, reviews[i - 1].interval)
    }
    interval = clamp(interval, MIN_INTERVAL, MAX_DAY)

    const prevDay = i === 0 ? 0 : reviews[i - 1].day
    const day = prevDay + interval
    // 超出观察窗口就不再排下一次复习（否则表格会列出图表里看不到的点）
    if (capDay && day > capDay) break

    const stability = S0 * (1 + growth * (i + 1))
    reviews.push({
      index: i + 1,
      day,
      interval,
      stability,
      prevStability: sPrev,
      retention: t * 100,
    })
  }

  // —— 2. 观察窗口：至少 30 天，末尾多留一段尾巴展示"不再复习后如何衰减" ——
  const last = reviews[reviews.length - 1]
  const lastInterval = last ? last.interval : S0 * Math.log(1 / t) / k
  const horizon = clamp(
    Math.max(MIN_HORIZON, (last ? last.day : 0) + lastInterval * 1.6),
    1,
    MAX_DAY,
  )

  // —— 3. 轨迹点：每段从复习点满保留率指数衰减到下一次复习 ——
  const segments = []
  let cursor = 0
  let stability = S0
  for (const r of reviews) {
    segments.push({ from: cursor, to: r.day, stability })
    cursor = r.day
    stability = r.stability
  }
  segments.push({ from: cursor, to: horizon, stability })

  const points = []
  for (const seg of segments) {
    const span = seg.to - seg.from
    if (span <= 0) continue
    const steps = clamp(Math.round(28 * Math.log10(1 + span) + 6), 6, 72)
    for (let i = 0; i <= steps; i += 1) {
      const day = seg.from + (span * i) / steps
      points.push({ day, retention: 100 * Math.exp((-k * (day - seg.from)) / seg.stability) })
    }
  }

  // —— 4. 不复习基线：单条 S0 衰减曲线，用于对比 ——
  const baseline = [{ day: 0, retention: 100 }]
  const baseSteps = 90
  for (let i = 1; i <= baseSteps; i += 1) {
    // 对数取样，让前 1 天不被压缩成一个点
    const day = MIN_DAY * Math.pow(horizon / MIN_DAY, i / baseSteps)
    baseline.push({ day, retention: 100 * Math.exp((-k * day) / S0) })
  }

  // 观察窗口末端两条曲线的对照值：把"复习 vs 不复习"的差距量化
  const tailSeg = segments[segments.length - 1]
  const tailRetention =
    tailSeg && tailSeg.to > tailSeg.from
      ? 100 * Math.exp((-k * (tailSeg.to - tailSeg.from)) / tailSeg.stability)
      : 0
  const tailBaselineRetention = 100 * Math.exp((-k * horizon) / S0)

  const finalStability = S0 * (1 + growth * reviews.length)
  // "进入稳定期"的判据：稳定度成长到终值的 90%，此后新增复习的边际收益已经很小。
  // 用实际日历天数表达（最后一次复习之后的成长按最后一次间隔的速度外推）。
  const stabilityGoal = finalStability * 0.9
  let plateauDay
  if (!reviews.length) {
    plateauDay = 0
  } else {
    const nNeeded = stabilityGoal / S0 / Math.max(growth, 1e-6) - 1
    const base = Math.floor(nNeeded)
    plateauDay = clamp((reviews[base] ? reviews[base].day : last.day) + last.interval, 0, MAX_DAY)
  }

  return {
    reviews,
    segments,
    points,
    baseline,
    horizon,
    summary: {
      reviewCount: reviews.length,
      finalInterval: last ? last.interval : lastInterval,
      plateauDay,
      // 经典快照：不复习时第 1 天 / 第 6 天的剩余率，用于文案对比
      day1: 100 * Math.exp(-k / S0),
      day6: 100 * Math.exp((-k * 6) / S0),
      day30: 100 * Math.exp((-k * 30) / S0),
      // 观察窗口末端的对照：同一天，复习过 vs 完全没复习
      tailDay: horizon,
      tailRetention,
      tailBaselineRetention,
    },
  }
}

export function useForgettingCurve() {
  // —— 可调参数 ——
  const decayK = ref(0.34) // 衰减敏感度 k：越大忘得越快
  const target = ref(0.9) // 目标保持率 R：每次复习都回到这个水位
  const growth = ref(1.6) // 稳定度增长系数 g
  const showBaseline = ref(true)

  // —— 交互状态 ——
  const intervalsOverride = ref([]) // 拖动复习点后的间隔覆盖值（空 = 全部用公式）
  const playing = ref(false)
  const cursorDay = ref(0)
  const speed = ref(1)

  /** 首次按公式算出间隔，之后可由用户拖动覆盖 */
  const formulaIntervals = computed(() => {
    const out = []
    let day = 0
    for (let i = 0; i < MAX_REVIEWS; i += 1) {
      const sPrev = i === 0 ? S0 : S0 * (1 + growth.value * i)
      const interval = clamp(
        (sPrev * Math.log(1 / clamp(target.value, 0.5, 0.95))) / Math.max(decayK.value, 0.05),
        MIN_INTERVAL,
        MAX_DAY,
      )
      if (day + interval > MAX_DAY) break
      out.push(interval)
      day += interval
    }
    return out
  })

  const intervals = computed(() => {
    const base = formulaIntervals.value
    const ov = intervalsOverride.value
    if (!ov.length) return base
    const len = Math.max(base.length, ov.length)
    const merged = []
    for (let i = 0; i < len; i += 1) {
      const v = ov[i] == null ? base[i] : ov[i]
      if (v == null) break
      merged.push(v)
    }
    return merged
  })

  const curves = computed(() =>
    buildCurves({
      decayK: decayK.value,
      target: target.value,
      growth: growth.value,
      intervals: intervals.value,
      capDay: MAX_DAY,
    }),
  )

  /** 复习点是否已被用户手动调整过（用于提示"已自定义"与重置） */
  const customized = computed(() => intervalsOverride.value.some((v) => v != null))

  // —— 坐标换算（对数横轴 + 线性纵轴） ——
  const xOf = (day, horizon, width) => {
    const hi = Math.max(horizon || MAX_DAY, MIN_DAY * 2)
    const d = clamp(day, MIN_DAY, hi)
    return (Math.log(d / MIN_DAY) / Math.log(hi / MIN_DAY)) * width
  }
  const yOf = (retention, height) => height - (clamp(retention, 0, 100) / 100) * height

  /**
   * 拖动复习点：把"目标天数"换算成该次间隔，并同时线性平移后续间隔。
   * 平移而非重算，保证只有被拖的那一次之后整体顺延，手感符合直觉。
   */
  function applyDrag(index, newDay) {
    const rs = curves.value.reviews
    const prevDay = index === 0 ? 0 : rs[index - 1].day
    const anchor = rs[index]
    if (!anchor) return
    const newInterval = clamp(newDay - prevDay, MIN_INTERVAL, MAX_DAY)

    const base = intervals.value.slice()
    const next = base.map((v) => v)
    const old = base[index]
    const delta = newInterval - old
    next[index] = newInterval
    for (let i = index + 1; i < next.length; i += 1) {
      next[i] = clamp(next[i] + delta, MIN_INTERVAL, MAX_DAY)
    }
    intervalsOverride.value = next
  }

  function resetIntervals() {
    intervalsOverride.value = []
  }

  function applyPreset(g) {
    growth.value = g
    resetIntervals()
  }

  function resetAll() {
    decayK.value = 0.34
    target.value = 0.9
    growth.value = 1.6
    resetIntervals()
    stop()
    cursorDay.value = 0
  }

  /**
   * t 时刻的保留率，供仿真光标读数使用。
   * 恰好在复习日当天视为"已复习"，回弹到 100%。
   */
  function retentionAt(day) {
    const rs = curves.value.reviews
    let cursor = 0
    let stability = S0
    for (const r of rs) {
      if (day <= r.day) {
        // 复习当天读完即回满：day === r.day 时直接给 100%，
        // 避免读数恰好卡在边界上显示成 90%
        if (near(day, r.day)) return 100
        return 100 * Math.exp((-(decayK.value * (day - cursor))) / stability)
      }
      cursor = r.day
      stability = r.stability
    }
    return 100 * Math.exp((-(decayK.value * (day - cursor))) / stability)
  }

  // —— 仿真播放 ——
  let raf = null
  let startedAt = 0
  let fromDay = 0
  // 1× 速度下走完全程的毫秒数。
  // 按需求放慢到原来的约 20%（即原 3200ms 的 5 倍），
  // 让每一个复习"回弹"都能看清楚，而不是一闪而过。
  const BASE_DURATION = 16000

  function step(now) {
    if (!startedAt) startedAt = now
    const elapsed = now - startedAt
    const total = BASE_DURATION / speed.value
    const progress = clamp(elapsed / total, 0, 1)
    const horizon = curves.value.horizon
    // easeOutQuad：开头快、结尾稳，避免光标在末段长时间爬行
    const eased = 1 - (1 - progress) * (1 - progress)
    cursorDay.value = fromDay + (horizon - fromDay) * eased
    if (progress >= 1) {
      playing.value = false
      raf = null
      return
    }
    raf = requestAnimationFrame(step)
  }

  function play() {
    if (typeof window === 'undefined') return
    // 尊重系统「减少动态效果」：直接落到终态，不做长动画
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      cursorDay.value = curves.value.horizon
      return
    }
    stop()
    // 已经播完的再从 0 开始，否则从当前位置续播
    fromDay = cursorDay.value >= curves.value.horizon - 0.01 ? 0 : cursorDay.value
    cursorDay.value = fromDay
    startedAt = 0
    playing.value = true
    raf = requestAnimationFrame(step)
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf)
    raf = null
    playing.value = false
    startedAt = 0
  }

  return {
    // 参数
    decayK,
    target,
    growth,
    showBaseline,
    // 状态
    intervalsOverride,
    playing,
    cursorDay,
    speed,
    // 派生
    curves,
    intervals,
    customized,
    // 工具
    xOf,
    yOf,
    retentionAt,
    applyDrag,
    resetIntervals,
    applyPreset,
    resetAll,
    play,
    stop,
  }
}
