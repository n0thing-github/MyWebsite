/**
 * 判分（纯函数）
 *
 * 华为 HCIP 考试为单选 + 多选 + 判断：
 *   · 单选 / 判断：必须完全一致
 *   · 多选：**少选、多选、错选均不得分**（这是华为考试的通行规则）
 * 如果后续确认某类题支持部分给分，只需改这里一处。
 */

/** 归一化答案：去重 + 排序 + 转大写，保证比较不受顺序与大小写影响 */
export function normalizeAnswer(answer) {
  if (answer == null) return []
  const arr = Array.isArray(answer) ? answer : [answer]
  return [...new Set(arr.map((a) => String(a).trim().toUpperCase()).filter(Boolean))].sort()
}

/**
 * 判断作答是否正确。
 * @param {object} question 题目（需含 type / answer）
 * @param {string[]|string} response 用户作答（选项 key）
 */
export function isCorrect(question, response) {
  if (!question) return false
  const correct = normalizeAnswer(question.answer)
  const given = normalizeAnswer(response)
  if (!correct.length) return false
  // 多选：集合完全相等才算对（少选/多选都不得分）
  return given.length === correct.length && given.every((k, i) => k === correct[i])
}

/** 是否漏选（多选里选对了但不全）——仅用于给出更友好的反馈文案 */
export function isPartial(question, response) {
  if (!question || question.type !== 'multi') return false
  const correct = normalizeAnswer(question.answer)
  const given = normalizeAnswer(response)
  if (!given.length || given.length >= correct.length) return false
  return given.every((k) => correct.includes(k))
}

/** 是否未作答 */
export function isBlank(response) {
  return normalizeAnswer(response).length === 0
}

/**
 * 交卷判分。
 * @returns {{ total, correct, wrong, blank, rate, details }}
 */
export function gradePaper(questions, responses) {
  const details = (questions || []).map((q) => {
    const response = (responses || {})[q.id] ?? []
    const blank = isBlank(response)
    const ok = !blank && isCorrect(q, response)
    return {
      id: q.id,
      domain: q.domain,
      type: q.type,
      response: normalizeAnswer(response),
      answer: normalizeAnswer(q.answer),
      blank,
      ok,
      partial: !ok && !blank && isPartial(q, response),
    }
  })

  const total = details.length
  const correct = details.filter((d) => d.ok).length
  const blank = details.filter((d) => d.blank).length
  const wrong = total - correct - blank

  return {
    total,
    correct,
    wrong,
    blank,
    // 正确率按已作答题计算，避免"没做完"把正确率拉低误导判断
    rate: total - blank > 0 ? correct / (total - blank) : 0,
    details,
  }
}

/**
 * 按域聚合正确率，用于生成薄弱项报告。
 * @returns {Record<string, {total, correct, rate}>}
 */
export function gradeByDomain(details) {
  const out = {}
  for (const d of details || []) {
    if (!out[d.domain]) out[d.domain] = { total: 0, correct: 0, blank: 0, rate: 0 }
    const cell = out[d.domain]
    cell.total += 1
    if (d.ok) cell.correct += 1
    if (d.blank) cell.blank += 1
  }
  for (const id of Object.keys(out)) {
    const cell = out[id]
    const answered = cell.total - cell.blank
    cell.rate = answered > 0 ? cell.correct / answered : 0
  }
  return out
}
