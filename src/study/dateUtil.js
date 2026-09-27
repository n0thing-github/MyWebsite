/**
 * 日期与时长工具（纯函数）
 *
 * 全部使用**本地时区**，且用本地日期键 'YYYY-MM-DD' 作为持久化格式。
 * 为什么不用 toISOString().slice(0,10)：它按 UTC 切分，
 * 东八区凌晨 0–8 点会得到"昨天"，复习到期判断会整体错一天。
 */

const pad = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DD'（本地时区） */
export function toDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → Date（本地零点） */
export function fromDateKey(key) {
  if (typeof key !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 今天（本地）的日期键 */
export function today(now = new Date()) {
  return toDateKey(now)
}

/**
 * a 到 b 相差几天（b - a），按**日历天**而非毫秒，
 * 避免夏令时导致的 23/25 小时日算出 0.958 天这种偏差。
 */
export function daysBetween(aKey, bKey) {
  const a = fromDateKey(aKey)
  const b = fromDateKey(bKey)
  if (!a || !b) return 0
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / 86400000)
}

/** 日期键加 n 天（n 可为小数，按四舍五入取整到日历天） */
export function addDays(key, n) {
  const d = fromDateKey(key) || new Date()
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() + Math.round(n))
  return toDateKey(out)
}

/** 两个日期键的先后：a 在 b 之前（含相等） */
export function isOnOrBefore(aKey, bKey) {
  const a = fromDateKey(aKey)
  const b = fromDateKey(bKey)
  if (!a || !b) return false
  return a.getTime() <= b.getTime()
}

/** 是否已过期（严格早于今天） */
export function isOverdue(dueKey, now = new Date()) {
  if (!dueKey) return false
  return daysBetween(dueKey, today(now)) > 0
}

/** 显示用：'9月28日' */
export function formatDateCN(key) {
  const d = fromDateKey(key)
  if (!d) return '—'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 显示用：'2026年9月28日' */
export function formatDateFullCN(key) {
  const d = fromDateKey(key)
  if (!d) return '—'
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 显示用：根据距今差返回 '今天' / '明天' / '3 天后' / '逾期 2 天' */
export function formatRelative(key, now = new Date()) {
  const diff = daysBetween(today(now), key)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff > 1) return `${diff} 天后`
  return `逾期 ${-diff} 天`
}

/** 分钟 → '1 小时 20 分' */
export function formatMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`
}

/** 分钟 → '1.5h' 这类紧凑写法，用于卡片角标 */
export function formatMinutesShort(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  if (m < 60) return `${m}m`
  return `${(m / 60).toFixed(m % 60 === 0 ? 0 : 1)}h`
}

/** 秒 → '12:34' */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${pad(m)}:${pad(rest)}`
}

/** 从 now 起 n 个连续日期键（含今天），用于热力图 */
export function lastNDaysKey(n, now = new Date()) {
  const out = []
  for (let i = n - 1; i >= 0; i -= 1) {
    out.push(addDays(today(now), -i))
  }
  return out
}
