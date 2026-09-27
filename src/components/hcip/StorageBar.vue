<script setup>
import { ref, computed } from 'vue'
import { useStudyStore } from '../../study/useStudyStore'
import { downloadText, backupFilename } from '../../study/backupFile'

/**
 * 存储状态警告条
 *
 * 只在"写不进去"或"刚发生过恢复"时出现，平时不占地方。
 * 这是无痕模式、配额满、微信清理过的环境里用户唯一的预警 ——
 * 没有它，用户会一直以为进度在存，直到下次打开才发现全没了。
 */
const store = useStudyStore()

/** 操作结果提示（下载被拦 / 快照不可用） */
const notice = ref('')

const alert = computed(() => {
  if (!store.storageOk.value) {
    return {
      tone: 'bad',
      text: '当前环境无法写入本机存储（无痕模式或被限制），进度只存在于本次会话，关闭页面即丢失。先导出备份。',
    }
  }
  if (!store.saveOk.value) {
    return {
      tone: 'bad',
      text: '进度没能写入本机存储（可能是空间已满，或被浏览器/微信清理），关闭页面后会丢失。先导出备份。',
    }
  }
  if (store.recoveredFrom.value === 'bak') {
    return {
      tone: 'warn',
      text: '检测到本地存档损坏，已自动用上一份快照恢复。请核对一下进度是否完整。',
    }
  }
  if (store.recoveredFrom.value === 'failed') {
    return {
      tone: 'bad',
      text: '本地存档损坏且没有可用快照，已按新用户处理。若之前导出过备份，请到「进度」页恢复。',
    }
  }
  return null
})

function onExport() {
  const text = store.doExport()
  const how = downloadText(text, backupFilename(store.dateKey.value))
  notice.value =
    how === 'download'
      ? '备份已导出'
      : how === 'clipboard'
        ? '下载被拦截，备份内容已复制到剪贴板'
        : '导出失败：当前环境既不能下载也不能复制'
}

function onRestore() {
  const res = store.restoreFromBak()
  notice.value = res.ok ? '已用上一份快照恢复' : res.error
}
</script>

<template>
  <div v-if="alert" class="storage-bar" :class="alert.tone">
    <p class="msg">{{ alert.text }}</p>
    <div class="row">
      <button class="act" @click="onExport">导出备份</button>
      <button
        v-if="store.hasBackup.value && store.recoveredFrom.value !== 'bak'"
        class="act ghost"
        @click="onRestore"
      >
        用快照恢复
      </button>
    </div>
    <p v-if="notice" class="hint">{{ notice }}</p>
  </div>
</template>

<style scoped>
.storage-bar {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 11px 13px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 45, 45, 0.1);
}
.storage-bar.warn {
  background: rgba(224, 168, 0, 0.12);
}
.msg {
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--red-bright);
}
.storage-bar.warn .msg {
  color: #e0a800;
}
.row {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
.act {
  min-height: 34px;
  padding: 0 12px;
  font-family: inherit;
  font-size: 12.5px;
  color: #fff;
  background: linear-gradient(180deg, var(--red-bright), var(--red));
  border: none;
  cursor: pointer;
  touch-action: manipulation;
}
.act.ghost {
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text-dim);
}
.hint {
  font-size: 11.5px;
  color: var(--cyan);
}
</style>
