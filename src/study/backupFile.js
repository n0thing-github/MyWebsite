/**
 * 备份落地：优先下载成文件，被拦截时退化为复制到剪贴板。
 *
 * 为什么单独一层：进度页的「导出进度」和顶部警告条的「导出备份」必须走
 * 同一条路径 —— 两份实现早晚会分叉（一边改了文件名，另一边忘了）。
 *
 * 微信内置浏览器里下载经常被拦，所以剪贴板不是可选装饰，而是主要退路。
 */

/** 导出文件名：带日期，方便用户自己按天保留 */
export function backupFilename(dateKey) {
  return `hcip-backup-${dateKey || 'backup'}.json`
}

/** 复制文本；navigator.clipboard 不可用时退回 execCommand（微信 WebView 常见） */
export function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 落到 execCommand */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 导出一份备份。
 * @returns {'download'|'clipboard'|'failed'} 实际落地的途径，供调用方提示用户
 */
export function downloadText(text, filename) {
  try {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return 'download'
  } catch {
    return copyText(text) ? 'clipboard' : 'failed'
  }
}
