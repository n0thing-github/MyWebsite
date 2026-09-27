import { useStudyStore } from './useStudyStore'
import { getDomains } from '../data/hcip/examConfig'
import { normalizeAnswer } from './grading'

/**
 * 题库导入（JSON / CSV）
 *
 * 设计原则：**宁可整批拒绝，也不静默丢题**。
 * 导入的是用户的学习资料，悄悄丢掉几条会让"我明明导入过这道题"变成无解的悬案。
 * 因此每条错误都带行号/题号与原因，全部列给用户看。
 */

const TYPE_ALIASES = {
  single: 'single',
  '单选': 'single',
  单选题: 'single',
  multi: 'multi',
  '多选': 'multi',
  多选题: 'multi',
  judge: 'judge',
  '判断': 'judge',
  判断题: 'judge',
  tf: 'judge',
}

function normalizeType(raw) {
  const k = String(raw ?? '').trim().toLowerCase()
  return TYPE_ALIASES[k] || TYPE_ALIASES[String(raw ?? '').trim()] || null
}

/** 把 'A|B' / 'A,B' / 'AB' / ['A','B'] 统一成 ['A','B'] */
function parseAnswerCell(raw) {
  if (Array.isArray(raw)) return normalizeAnswer(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  if (/^[A-Za-z](\s*[|,、;/\s]\s*[A-Za-z])*$/.test(s)) {
    // 含分隔符，或连续的单个字母（如 "AB"）
    if (/[|,、;/]/.test(s)) return normalizeAnswer(s.split(/[|,、;/\s]+/))
    return normalizeAnswer(s.split(''))
  }
  return normalizeAnswer(s.split(/[|,、;/\s]+/))
}

/**
 * 极简 CSV 解析：支持双引号包裹、字段内逗号、"" 转义。
 * 不引入 papaparse 之类依赖——需求只有"读一张表"这一点。
 */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }
  row.push(field)
  rows.push(row)

  // 丢掉全空行
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''))
}

/** CSV → 原始题目对象数组（字段名按表头映射） */
function csvToRaw(text) {
  const rows = parseCsv(text)
  if (rows.length < 2) return { raw: [], error: 'CSV 至少需要表头 + 一行数据' }
  const header = rows[0].map((h) => String(h).trim().toLowerCase())
  const idx = (name) => header.indexOf(name)
  const need = ['stem', 'answer']
  for (const n of need) {
    if (idx(n) < 0) return { raw: [], error: `CSV 缺少必需列：${n}` }
  }
  const raw = []
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r]
    const get = (name) => {
      const i = idx(name)
      return i >= 0 ? String(cells[i] ?? '').trim() : ''
    }
    const options = []
    for (const key of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const t = get(key.toLowerCase())
      if (t) options.push({ key, text: t })
    }
    raw.push({
      id: get('id'),
      domain: get('domain'),
      type: get('type'),
      stem: get('stem'),
      options,
      answer: parseAnswerCell(get('answer')),
      explain: get('explain'),
      difficulty: get('difficulty'),
      tags: get('tags') ? get('tags').split(/[|,、;]/).map((s) => s.trim()).filter(Boolean) : [],
      _row: r + 1,
    })
  }
  return { raw, error: '' }
}

/** JSON → 原始题目对象数组 */
function jsonToRaw(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { raw: [], error: `JSON 解析失败：${e.message}` }
  }
  // 兼容 {questions:[...]} 与直接数组两种写法
  const arr = Array.isArray(parsed) ? parsed : parsed?.questions
  if (!Array.isArray(arr)) return { raw: [], error: 'JSON 顶层必须是数组，或含 questions 数组' }
  return { raw: arr.map((q, i) => ({ ...q, _row: i + 1 })), error: '' }
}

/**
 * 校验并规范化单条题目。
 * @returns {{ok:true, q:object} | {ok:false, reason:string}}
 */
export function validateQuestion(raw, examCode, seq) {
  const domains = getDomains(examCode).map((d) => d.id)

  const stem = String(raw?.stem ?? '').trim()
  if (!stem) return { ok: false, reason: '题干为空' }

  const domain = String(raw?.domain ?? '').trim()
  if (!domain) return { ok: false, reason: '缺少 domain' }
  if (!domains.includes(domain)) {
    return { ok: false, reason: `domain "${domain}" 不属于 ${examCode}（可用：${domains.join('/')}）` }
  }

  const type = normalizeType(raw?.type) || (Array.isArray(raw?.answer) && raw.answer.length > 1 ? 'multi' : 'single')
  if (!type) return { ok: false, reason: `无法识别的题型 "${raw?.type}"` }

  // 判断题允许不写选项，自动补 正确/错误
  let options = Array.isArray(raw?.options) ? raw.options : []
  options = options
    .map((o) => {
      if (typeof o === 'string') return { key: '', text: o }
      return { key: String(o?.key ?? '').trim().toUpperCase(), text: String(o?.text ?? '').trim() }
    })
    .filter((o) => o.text)

  if (type === 'judge' && options.length === 0) {
    options = [
      { key: 'A', text: '正确' },
      { key: 'B', text: '错误' },
    ]
  }

  if (options.length < 2) return { ok: false, reason: '选项少于 2 个' }

  // 补齐缺失的选项 key（按 A/B/C… 顺序）
  const letters = 'ABCDEFGH'
  options = options.map((o, i) => ({ ...o, key: o.key || letters[i] }))

  const keys = options.map((o) => o.key)
  if (new Set(keys).size !== keys.length) return { ok: false, reason: '选项 key 重复' }

  const answer = parseAnswerCell(raw?.answer)
  if (!answer.length) return { ok: false, reason: '答案为空' }
  const bad = answer.filter((a) => !keys.includes(a))
  if (bad.length) return { ok: false, reason: `答案 ${bad.join('/')} 不在选项中（${keys.join('/')}）` }

  if (type === 'single' && answer.length !== 1) {
    return { ok: false, reason: `单选题答案必须恰好 1 个，当前 ${answer.length} 个` }
  }
  if (type === 'multi' && answer.length < 2) {
    return { ok: false, reason: '多选题答案至少 2 个（单答案请改为 type=single）' }
  }
  if (type === 'judge' && answer.length !== 1) {
    return { ok: false, reason: '判断题答案必须恰好 1 个' }
  }

  const id = String(raw?.id ?? '').trim() || `${examCode.replace('H12-', '')}-imp-${seq}`

  return {
    ok: true,
    q: {
      id,
      exam: examCode,
      domain,
      type,
      stem,
      options,
      answer,
      explain: String(raw?.explain ?? '').trim(),
      tags: Array.isArray(raw?.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
      difficulty: Math.min(3, Math.max(1, Number(raw?.difficulty) || 2)),
      source: 'import',
    },
  }
}

/**
 * 导入入口。
 * @param {string} text 文件内容
 * @param {'json'|'csv'|'auto'} format
 * @param {string} examCode
 * @param {(qid:string)=>object|null} getExisting 用于检测与现有题库的 id 冲突
 * @returns {{ok, accepted, errors, duplicates, total}}
 */
export function parseImport(text, format, examCode, getExisting) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return { ok: false, accepted: [], errors: ['文件内容为空'], duplicates: [], total: 0 }

  const fmt = format === 'auto' ? (/^\s*[[{]/.test(trimmed) ? 'json' : 'csv') : format
  const { raw, error } = fmt === 'json' ? jsonToRaw(trimmed) : csvToRaw(trimmed)
  if (error) return { ok: false, accepted: [], errors: [error], duplicates: [], total: 0 }

  const accepted = []
  const errors = []
  const duplicates = []
  const seen = new Set()

  raw.forEach((r, i) => {
    const res = validateQuestion(r, examCode, i + 1)
    const label = `第 ${r._row ?? i + 1} 条`
    if (!res.ok) {
      errors.push(`${label}：${res.reason}`)
      return
    }
    const q = res.q
    // 批次内重复
    if (seen.has(q.id)) {
      duplicates.push(`${label}：id "${q.id}" 在本批次中重复，已跳过`)
      return
    }
    // 与现有题库冲突
    if (getExisting && getExisting(q.id)) {
      duplicates.push(`${label}：id "${q.id}" 已存在，已跳过（如需覆盖请先删除旧题）`)
      return
    }
    seen.add(q.id)
    accepted.push(q)
  })

  return { ok: errors.length === 0, accepted, errors, duplicates, total: raw.length }
}

/** 把解析结果落库 */
export function commitImport(list, examCode, meta) {
  const store = useStudyStore()
  const prev = store.getImported(examCode)
  store.saveImported(examCode, [...prev, ...list], meta)
}

/** 从文件名猜格式 */
export function guessFormat(filename) {
  const n = String(filename || '').toLowerCase()
  if (n.endsWith('.json')) return 'json'
  if (n.endsWith('.csv') || n.endsWith('.txt')) return 'csv'
  return 'auto'
}
