<script setup>
import { ref, computed } from 'vue'
import { useSync } from '../../study/useSync'
import { Chip } from './ui'

/**
 * 云同步面板（作为 Sheet 的内容使用，与 ImportPanel 同一套用法）
 *
 * 安全模型必须写清楚，否则用户要么不敢用、要么用全权限 token：
 *   · token 只存在这台设备的 localStorage，不进进度数据、不进导出备份、不被同步
 *   · 只用勾了 gist 权限的细粒度 token；丢了最多被人读写你的 gist
 *   · 同步的是进度/设置/摸底/日志，**不含**导入的题库与做题现场
 */
const sync = useSync()

const token = ref('')
const gistId = ref(sync.gistId.value || '')
const busy = ref(false)
const msg = ref('')

const enabled = computed(() => sync.enabled.value)
const statusText = computed(() => {
  if (sync.status.state === 'syncing') return sync.status.message
  if (sync.status.state === 'error') return '同步失败'
  return sync.status.message
})

async function onEnable() {
  busy.value = true
  msg.value = ''
  const res = await sync.enableSync(token.value, gistId.value)
  busy.value = false
  if (res.ok) {
    token.value = ''
    msg.value = '已启用。换设备时粘贴同一个 Token 即可取回进度。'
  } else {
    msg.value = res.error
  }
}

async function onSyncNow() {
  busy.value = true
  msg.value = ''
  const res = await sync.syncNow()
  busy.value = false
  if (!res.ok) msg.value = res.error || '同步失败'
}

function onDisable() {
  sync.disableSync()
  gistId.value = ''
  msg.value = '已停用。云端那份数据还在你的 Gist 里，随时可以重新启用。'
}
</script>

<template>
  <div class="sync">
    <p class="state" :class="sync.status.state">
      {{ statusText }}<template v-if="sync.status.error">：{{ sync.status.error }}</template>
    </p>

    <template v-if="!enabled">
      <p class="hint">
        把进度同步到你自己 GitHub 账号里的一个 <b>secret Gist</b>：免费、不用服务器、不用备案。
        换手机/清缓存后粘同一个 Token 就能取回。
      </p>
      <label class="field">
        <span class="label">细粒度 Token（只勾 gist 权限）</span>
        <input v-model="token" type="password" autocomplete="off" placeholder="github_pat_…" />
      </label>
      <label class="field">
        <span class="label">Gist ID（留空则自动创建一个）</span>
        <input v-model="gistId" type="text" autocomplete="off" placeholder="留空自动创建" />
      </label>
      <Chip block tone="cyan" :disabled="busy || !token.trim()" @click="onEnable">
        {{ busy ? '正在启用…' : '启用云同步' }}
      </Chip>
    </template>

    <template v-else>
      <p class="hint">
        已连接 Gist <code>{{ sync.gistId.value || '（本机新建）' }}</code>。
        本地写完约 30 秒后自动推送；切后台时也会补推一次。断网不影响刷题。
      </p>
      <div class="row">
        <Chip :disabled="busy" @click="onSyncNow">{{ busy ? '同步中…' : '立即同步' }}</Chip>
        <Chip @click="onDisable">停用</Chip>
      </div>
    </template>

    <p v-if="msg" class="msg">{{ msg }}</p>

    <p class="note">
      同步内容：做题记录、设置、摸底结果、每日统计。<b>不含</b>导入的题库正文与"答到一半"的现场。
      Token 只保存在这台设备上，不会进导出备份，也不会被同步出去。
    </p>
  </div>
</template>

<style scoped>
.sync {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.state {
  font-size: 13px;
  color: var(--text-dim);
  border-left: 2px solid var(--border-light);
  padding-left: 11px;
}
.state.ok {
  color: var(--cyan);
  border-color: var(--cyan);
}
.state.syncing,
.state.idle {
  color: var(--text);
}
.state.error {
  color: var(--red-bright);
  border-color: var(--red-bright);
}

.hint {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--text-dim);
}
.hint b {
  color: var(--text);
}
.hint code {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--cyan);
  word-break: break-all;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.label {
  font-size: 11.5px;
  color: var(--text-dim);
}
.field input {
  width: 100%;
  min-height: 40px;
  padding: 0 10px;
  background: var(--bg);
  border: 1px solid var(--border-light);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
}
.field input:focus {
  outline: 1px solid var(--cyan);
  outline-offset: 1px;
}

.row {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}

.msg {
  font-size: 12px;
  line-height: 1.7;
  color: var(--cyan);
}

.note {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--text-dim);
  border-left: 2px solid var(--border-light);
  padding-left: 11px;
}
.note b {
  color: var(--text);
}
</style>
