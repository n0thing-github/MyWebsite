import { computed } from 'vue'
import { useStudyStore } from './useStudyStore'
import { priority, isDue, reviewsToStable, STABLE_INTERVAL, intervalFor } from './memory'
import { addDays, today } from './dateUtil'
import { getDomains, splitByWeight, totalHours } from '../data/hcip/examConfig'

/**
 * 每日计划与完成预估
 *
 * 计划由四段组成，合计不超过当日可用时长：
 *   复习 → 错题重做 → 新学 → 模考
 * 顺序是刻意的：复习的边际收益远高于新学，时间不够时优先保复习。
 *
 * 自适应重排规则（每次完成任务或补录时长后触发）：
 *   pace < 0.8（落后）      → 压缩新学（保底 20%），把时间让给复习与错题
 *   pace > 1.2（超前）      → 新学量最多放到 150%，并提前引入下一域
 *   连续 3 天某域正确率 <60% → 该域降速，提高复习频次，标记为"重点补强"
 */

/** 单位题时（分钟）：初值，之后随实际作答滚动修正 */
export const DEFAULT_MIN_PER_NEW = 1.6
export const DEFAULT_MIN_PER_REVIEW = 1.2

export function useStudyPlan() {
  const store = useStudyStore()

  /** 当日可用分钟：支持按星期微调 */
  const plannedMinutes = computed(() => {
    const s = store.settings.value
    const dow = new Date().getDay() === 0 ? 7 : new Date().getDay() // 1..7
    const override = s.weekdayMinutes?.[dow]
    return override && override > 0 ? override : s.dailyMinutes
  })

  /** 近 7 天实际学习分钟（含今天） */
  const recentMinutes = computed(() => {
    const dk = store.dateKey.value
    const logs = store.state.log
    let sum = 0
    for (let i = 0; i < 7; i += 1) {
      const key = addDays(dk, -i)
      const e = logs.find((x) => x.d === key)
      if (e) sum += e.min || 0
    }
    return sum
  })

  /**
   * 日均有效时长：计划值与近期实际值的加权。
   * 如果只按"用户填的 60 分钟"估，一旦实际每天只学 20 分钟，
   * 预估完成时间就会严重乐观 —— 用实际值主导更诚实。
   */
  const effectiveDailyMinutes = computed(() => {
    const planned = plannedMinutes.value
    const logs = store.state.log
    const activeDays = logs.filter((e) => (e.min || 0) > 0).slice(-7)
    if (!activeDays.length) return planned
    const actualAvg = activeDays.reduce((a, e) => a + (e.min || 0), 0) / activeDays.length
    // 实际权重 0.7：既反映真实节奏，又不会因为某天生病只学 5 分钟就把预估拉爆
    return Math.max(5, actualAvg * 0.7 + planned * 0.3)
  })

  /** 进度比：近 7 天实际 / 应完成 */
  const pace = computed(() => {
    const planned = plannedMinutes.value * 7
    const actual = recentMinutes.value
    if (planned <= 0) return 1
    if (actual === 0) return 0
    return actual / planned
  })

  const paceLabel = computed(() => {
    const p = pace.value
    if (p < 0.8) return { key: 'behind', label: '落后于计划', hint: '已自动压缩新学量，优先保住复习' }
    if (p > 1.2) return { key: 'ahead', label: '超前于计划', hint: '已提高新学量，进度会提前' }
    return { key: 'onTrack', label: '进度正常', hint: '按当前节奏推进即可' }
  })

  /** 连续低正确率的域（近 3 天窗口内）→ 需要降速补强 */
  const weakDomains = computed(() => {
    const stats = store.domainStats.value
    return Object.values(stats)
      .filter((c) => c.touched >= 3 && c.mastery > 0 && c.mastery < 60)
      .sort((a, b) => a.mastery - b.mastery)
  })

  /** 单位题时：有实测就用实测，否则用默认值 */
  const minutesPerNew = computed(() => {
    const log = store.state.log.slice(-14)
    const answered = log.reduce((a, e) => a + (e.new || 0), 0)
    const mins = log.reduce((a, e) => a + (e.min || 0), 0)
    if (answered >= 20 && mins > 0) {
      return Math.min(4, Math.max(0.6, mins / Math.max(1, log.reduce((a, e) => a + (e.new || 0) + (e.review || 0), 0))))
    }
    return DEFAULT_MIN_PER_NEW
  })

  const minutesPerReview = computed(() =>
    Math.max(0.4, Math.min(minutesPerNew.value * 1.2, DEFAULT_MIN_PER_REVIEW)),
  )

  /**
   * 生成今日计划。
   * @param {{dense?:boolean}} opts dense 仅用于展示紧凑摘要
   */
  const plan = computed(() => {
    const budget = plannedMinutes.value
    const dk = store.dateKey.value
    const questions = store.questions.value
    const items = store.state.items
    const style = store.settings.value.stageStyle
    const target = store.settings.value.targetRetention

    // —— 1. 复习段：到期题按保留率升序（最该复习的先排）——
    const due = store.dueQuestions.value
    const wrongIds = new Set(store.wrongQuestions.value.map((q) => q.id))

    const reviewPool = due.filter((q) => !wrongIds.has(q.id))
    const wrongPool = due.filter((q) => wrongIds.has(q.id))

    const mNew = minutesPerNew.value
    const mRev = minutesPerReview.value

    let remaining = budget * 0.45 // 复习+错题的总预算上限
    const reviewItems = []
    for (const q of reviewPool) {
      if (remaining < mRev) break
      reviewItems.push(q)
      remaining -= mRev
    }

    const wrongItems = []
    // 错题至少留 15% 预算，避免被普通复习吃光
    let wrongBudget = Math.min(remaining + budget * 0.15, budget * 0.3)
    for (const q of wrongPool) {
      if (wrongBudget < mRev) break
      wrongItems.push(q)
      wrongBudget -= mRev
    }

    const reviewMinutes = (reviewItems.length + wrongItems.length) * mRev
    let left = Math.max(0, budget - reviewMinutes)

    // —— 2. 新学段：按 pace 调节系数 ——
    let newFactor = 1
    if (pace.value < 0.8) newFactor = 0.2
    else if (pace.value > 1.2) newFactor = 1.5

    // 复习优先策略下进一步压缩新学
    if (style === 'reviewFirst') newFactor *= 0.5
    if (style === 'newFirst') newFactor *= 1.3

    // 复习欠账太多（到期 > 预算能处理的两倍）时，新学直接砍半
    if (due.length > (budget / mRev) * 2) newFactor *= 0.5

    let newBudget = left * Math.min(1, newFactor)
    const newItems = []
    const unseen = store.unseenQueue.value
    for (const q of unseen) {
      if (newBudget < mNew) break
      newItems.push(q)
      newBudget -= mNew
    }

    const newMinutes = newItems.length * mNew

    // —— 3. 模考段：整卷通常远超单日预算，只作为"建议"出现 ——
    const examMeta = store.examMeta.value
    const mockSuggested = store.settings.value.weeklyMock && shouldSuggestMock(store.state.log, dk)

    const totalMinutes = Math.round(reviewMinutes + newMinutes)

    return {
      dateKey: dk,
      budget,
      reviewItems,
      wrongItems,
      newItems,
      items: [
        ...wrongItems.map((q) => ({ q, mode: 'review', kind: 'wrong', minutes: mRev })),
        ...reviewItems.map((q) => ({ q, mode: 'review', kind: 'review', minutes: mRev })),
        ...newItems.map((q) => ({ q, mode: 'new', kind: 'new', minutes: mNew })),
      ],
      counts: {
        review: reviewItems.length,
        wrong: wrongItems.length,
        new: newItems.length,
      },
      dueTotal: due.length,
      totalMinutes,
      minutesPerNew: mNew,
      minutesPerReview: mRev,
      newFactor,
      mockSuggested,
      mockMinutes: examMeta?.durationMinutes || 90,
      // 到期题多到一天做不完时给出明确提示，而不是假装能做完
      backlog: due.length > (budget / mRev) * 1.5,
    }
  })

  /** 剩余工作量与完工预估 */
  const forecast = computed(() => {
    const dk = store.dateKey.value
    const target = store.settings.value.targetRetention
    const items = store.state.items
    const questions = store.questions.value
    const mNew = minutesPerNew.value
    const mRev = minutesPerReview.value

    let unseen = 0
    let reviewsLeft = 0
    for (const q of questions) {
      const st = items[q.id]
      if (!st) {
        unseen += 1
        reviewsLeft += reviewsToStable(0.6, target) // 新题按初始水平估复习次数
      } else {
        reviewsLeft += reviewsToStable(st.stability, target)
      }
    }

    const remainingMinutes = unseen * mNew + reviewsLeft * mRev
    const perDay = effectiveDailyMinutes.value
    const daysLeft = Math.max(0, Math.ceil(remainingMinutes / Math.max(1, perDay)))
    const finishKey = addDays(dk, daysLeft)

    // 与上周对比：上周的日均 vs 现在的日均，估算趋势
    const trend = computeTrend(store.state.log, remainingMinutes, perDay, dk)

    return {
      unseen,
      reviewsLeft,
      remainingMinutes: Math.round(remainingMinutes),
      daysLeft,
      finishKey,
      perDay: Math.round(perDay),
      trend, // 正数=比上周预计更早完成
    }
  })

  return {
    plannedMinutes,
    effectiveDailyMinutes,
    pace,
    paceLabel,
    plan,
    forecast,
    weakDomains,
    weakDomainCount: computed(() => weakDomains.value.length),
    minutesPerNew,
    minutesPerReview,
  }
}

/** 一周内没安排过模考就建议一次 */
function shouldSuggestMock(log, dk) {
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(dk, -i)
    const e = log.find((x) => x.d === key)
    if (e && e.mock > 0) return false
  }
  return true
}

/**
 * 趋势：用"上周日均有效时长"重算一次完工天数，
 * 与当前对比得出提前/推迟多少天。
 */
function computeTrend(log, remainingMinutes, perDay, dk) {
  const lastWeek = []
  for (let i = 7; i < 14; i += 1) {
    const key = addDays(dk, -i)
    const e = log.find((x) => x.d === key)
    if (e && e.min > 0) lastWeek.push(e.min)
  }
  if (!lastWeek.length || perDay <= 0) return 0
  const prevAvg = Math.max(5, lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length)
  const prevDays = Math.ceil(remainingMinutes / prevAvg)
  const nowDays = Math.ceil(remainingMinutes / perDay)
  return prevDays - nowDays
}

/** 组卷：按域权重抽题（模考与小测共用） */
export function buildPaper(questions, domainIds, count, weights) {
  const byDomain = new Map()
  for (const q of questions) {
    if (domainIds && !domainIds.includes(q.domain)) continue
    if (!byDomain.has(q.domain)) byDomain.set(q.domain, [])
    byDomain.get(q.domain).push(q)
  }

  let quota
  if (weights && domainIds) {
    // 指定域时按域平均分配后再按权重微调
    quota = {}
    const ids = [...byDomain.keys()]
    const per = Math.floor(count / Math.max(1, ids.length))
    ids.forEach((id) => {
      quota[id] = per
    })
    let left = count - per * ids.length
    const order = ids.slice().sort((a, b) => (weights[b] || 0) - (weights[a] || 0))
    for (let i = 0; left > 0; i = (i + 1) % order.length, left -= 1) {
      quota[order[i]] += 1
    }
  }

  const picked = []
  for (const [domain, list] of byDomain) {
    const want = quota ? quota[domain] || 0 : list.length
    // 洗牌后取前 want 个：避免每次模考都抽到同一批题
    picked.push(...shuffle(list).slice(0, want))
  }

  // 配额未填满（某些域题不够）时用剩余题补齐
  if (picked.length < count) {
    const chosen = new Set(picked.map((q) => q.id))
    const rest = questions.filter((q) => !chosen.has(q.id) && (!domainIds || domainIds.includes(q.domain)))
    picked.push(...shuffle(rest).slice(0, count - picked.length))
  }

  return shuffle(picked).slice(0, count)
}

/** Fisher–Yates 洗牌（不修改入参） */
export function shuffle(list) {
  const arr = list.slice()
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
