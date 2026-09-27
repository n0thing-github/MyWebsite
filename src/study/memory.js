import { addDays, today } from './dateUtil'

/**
 * 记忆模型（纯函数）
 *
 * 与站点里演示用的艾宾浩斯曲线**共用同一个指数形式**：
 *     R(t) = 100 · e^(−t / S)          R 保留率，t 距上次接触的天数，S 记忆稳定度
 *
 * 但驱动量不同。演示页是按"天数轴"预设复习点；这里是按**每次答题结果**
 * 更新该题的稳定度，从而给每道题排出各自的复习到期日 —— 这才是间隔重复。
 *
 * 设计取舍：
 *   · 答对增益随复习次数递减（min(2.0, 1 + 0.6·max(0, 2−reps))）：
 *     新题头两次收益最大，之后趋于收敛，避免刷几次就"永不遗忘"。
 *   · 答错不归零而是砍到 0.4 倍并设下限：完全清零会让旧知识反复重学，
 *     反而拖慢进度；保留一点稳定度更接近真实记忆。
 */

/** 稳定度上下限（天） */
export const MIN_STABILITY = 0.3
export const MAX_STABILITY = 365
/** 到期间隔下限（天）：小于一天的话队列会一直重复同一题，体验很差 */
export const MIN_INTERVAL = 1

/** 默认目标保留率：到期阈值。0.8 表示"预计还记得 80% 时复习" */
export const DEFAULT_TARGET = 0.8

/** 新题初始稳定度 */
export const INIT_STABILITY = 1.2
/** 摸底答对 / 答错种下的初始稳定度（摸底是一次性信号，样本少，故取值保守） */
export const DIAGNOSTIC_CORRECT = 2.0
export const DIAGNOSTIC_WRONG = 0.6

/**
 * 复习间隔阶梯（天）—— 记忆状态的**权威定义**
 *
 * 为什么用具名阶梯而不是"每次乘一个增益"：
 *   增益写成 min(2.0, 1 + k·max(0, N−reps)) 这类形式，当 reps 超过 N 后
 *   增益恒为 1.0，稳定度就永久冻结（实测冻结在 3.84 天，间隔 0.86 天），
 *   于是任何题都到不了"稳定"，预估完成时间会完全失真。
 *   上限不封顶则又变成 2^n 爆炸增长，同样不真实。
 *
 * 阶梯把"复习几次、间隔多长"显式写出来，单调、有界、可核对，
 * 也正好对应间隔重复的标准做法（1 → 2 → 4 → 7 → 15 → 30 → 60 → 120 天）。
 */
export const INTERVAL_LADDER = [1, 2, 4, 7, 15, 30, 60, 120]

/** 稳定判据：间隔达到 21 天（三周后仍能记住，考试周期内够用） */
export const STABLE_INTERVAL = 21

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** 第 step 级的间隔（天）；step 超出阶梯则沿用最后一级 */
export function ladderInterval(step) {
  const i = clamp(Math.round(Number(step) || 0), 0, INTERVAL_LADDER.length - 1)
  return INTERVAL_LADDER[i]
}

/** 间隔（天）→ 对应的记忆稳定度 */
export function stabilityForInterval(days) {
  const d = clamp(Number(days) || INTERVAL_LADDER[0], INTERVAL_LADDER[0], MAX_STABILITY)
  return d / Math.log(1 / DEFAULT_TARGET)
}

/** 稳定度 → 最接近的阶梯级数（用于从旧数据/摸底分数反推） */
export function stepForStability(stability) {
  const interval = intervalFor(stability)
  let best = 0
  for (let i = 0; i < INTERVAL_LADDER.length; i += 1) {
    if (INTERVAL_LADDER[i] <= interval + 1e-9) best = i
  }
  return best
}

/** 保留率 0–100。t 可正可负（负数视为刚复习，直接 100） */
export function retention(t, stability) {
  const s = clamp(stability, MIN_STABILITY, MAX_STABILITY)
  if (!Number.isFinite(s) || s <= 0) return 0
  const days = Math.max(0, Number(t) || 0)
  return 100 * Math.exp(-days / s)
}

/** 到期间隔（天）：让保留率刚好降到 target 所需的天数 */
export function intervalFor(stability, target = DEFAULT_TARGET) {
  const s = clamp(stability, MIN_STABILITY, MAX_STABILITY)
  const r = clamp(target, 0.5, 0.98)
  return clamp(s * Math.log(1 / r), MIN_INTERVAL, MAX_STABILITY)
}

/**
 * 答对：阶梯升一级。
 * `step` 为当前级数（0 起），返回新级数。
 */
export function nextStep(step) {
  return clamp(Math.round(Number(step) || 0) + 1, 0, INTERVAL_LADDER.length - 1)
}

/** 答错：阶梯降两级（不低于 0 级）—— 忘得厉害就退回去多复习几轮 */
export function fellStep(step) {
  return clamp(Math.round(Number(step) || 0) - 2, 0, INTERVAL_LADDER.length - 1)
}

/** 答对后的新稳定度（保留旧接口语义，内部走阶梯） */
export function onCorrect(stability, step) {
  const s = step == null ? stepForStability(stability) : Math.round(Number(step) || 0)
  return stabilityForInterval(ladderInterval(nextStep(s)))
}

/** 答错后的新稳定度 */
export function onWrong(stability, step) {
  const s = step == null ? stepForStability(stability) : Math.round(Number(step) || 0)
  return stabilityForInterval(ladderInterval(fellStep(s)))
}

/**
 * 应用一次作答结果，返回**新的记忆状态**（不修改入参）。
 *
 * `step` 是记忆强度的主状态（间隔阶梯级数）；`stability` 由 step 派生，
 * 保留它是为了 continue 用同一个指数模型算保留率，以及展示"当前能撑多久"。
 * 兼容旧数据：没有 step 时从 stability 反推。
 *
 * @param {{stability?:number, step?:number, reps:number, lapses:number}} state
 * @param {'correct'|'wrong'|'skip'} result
 * @param {{dateKey?:string, target?:number}} opts
 */
export function applyAnswer(state, result, opts = {}) {
  const dateKey = opts.dateKey || today()
  const target = opts.target ?? DEFAULT_TARGET

  const prevStability = clamp(state?.stability ?? INIT_STABILITY, MIN_STABILITY, MAX_STABILITY)
  const prevStep =
    state?.step != null ? clamp(Math.round(state.step), 0, INTERVAL_LADDER.length - 1) : stepForStability(prevStability)

  let step = prevStep
  let reps = Math.max(0, state?.reps ?? 0)
  let lapses = Math.max(0, state?.lapses ?? 0)

  if (result === 'correct') {
    step = nextStep(prevStep)
    reps += 1
  } else if (result === 'wrong') {
    step = fellStep(prevStep)
    lapses += 1
  }
  // skip：不改变记忆状态，也不推迟到期（会被再次排入队列）

  // 答错时稳定度可能比原来低，保留率据此下降 —— 这正是"忘了要重来"的体现
  const stability = stabilityForInterval(ladderInterval(step))

  return {
    stability,
    step,
    reps,
    lapses,
    lastResult: result,
    lastSeen: dateKey,
    due: addDays(dateKey, intervalFor(stability, target)),
    streak: result === 'correct' ? (state?.streak ?? 0) + 1 : 0,
  }
}

/** 从摸底结果种下初始状态 */
export function seedFromDiagnostic(correct, dateKey = today(), target = DEFAULT_TARGET) {
  // 答对给到第 1 级（2 天），答错留在第 0 级（1 天）—— 摸底只是一次信号，不宜给太高起点
  const step = correct ? 1 : 0
  const stability = stabilityForInterval(ladderInterval(step))
  return {
    stability,
    step,
    reps: correct ? 1 : 0,
    lapses: correct ? 0 : 1,
    lastResult: correct ? 'correct' : 'wrong',
    lastSeen: dateKey,
    due: addDays(dateKey, intervalFor(stability, target)),
    streak: correct ? 1 : 0,
  }
}

/**
 * 复习优先级：保留率越低越该先复习。
 * 直接返回保留率，调用方升序排序即可。
 */
export function priority(state, dateKey, target = DEFAULT_TARGET) {
  if (!state) return -1 // 未接触过的题，优先级最低（由"新学"通道处理）
  const elapsed = Math.max(0, daysSince(state.lastSeen, dateKey))
  return retention(elapsed, state.stability)
}

/** 是否已到复习期 */
export function isDue(state, dateKey) {
  if (!state?.due) return true
  return state.due <= dateKey
}

/** 距离上次接触的天数（本地日历天） */
export function daysSince(lastSeenKey, dateKey) {
  if (!lastSeenKey) return 0
  const a = new Date(`${lastSeenKey}T00:00:00`)
  const b = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

/**
 * 掌握度：一组题按保留率聚合。
 * 用**中位数**而非平均：少数长期没碰的题会把平均拉垮，
 * 而"我这一域到底行不行"更接近中位水平。
 */
export function masteryOf(states, dateKey, target = DEFAULT_TARGET) {
  if (!states || !states.length) return 0
  const values = states.map((s) => priority(s, dateKey, target)).sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
  return clamp(median, 0, 100)
}

/** 掌握度分档，用于配色与文案 */
export function masteryLevel(score) {
  if (score >= 85) return { key: 'strong', label: '稳固' }
  if (score >= 70) return { key: 'ok', label: '尚可' }
  if (score >= 50) return { key: 'weak', label: '薄弱' }
  return { key: 'danger', label: '急需补强' }
}

/**
 * 预估某道题从当前状态到"稳定"还需几次复习。
 * 稳定判据：间隔达到 STABLE_INTERVAL（21 天）。
 * 走的是同一条间隔阶梯，因此结果与真实复习路径完全一致，不会出现"永远到不了"。
 */
export function reviewsToStable(stability) {
  const startStep = stepForStability(clamp(stability, MIN_STABILITY, MAX_STABILITY))
  let step = startStep
  let n = 0
  while (ladderInterval(step) < STABLE_INTERVAL && n <= INTERVAL_LADDER.length) {
    step = nextStep(step)
    n += 1
  }
  return n
}
