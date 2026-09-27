<script setup>
/**
 * 数据卡片。用于今日任务概览、摸底结果、预估完成时间等。
 */
defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  unit: { type: String, default: '' },
  hint: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // default | red | cyan | warn
})
</script>

<template>
  <div class="stat" :class="'tone-' + tone">
    <span v-if="label" class="stat-label">{{ label }}</span>
    <span class="stat-value">
      {{ value }}<small v-if="unit">{{ unit }}</small>
    </span>
    <span v-if="hint" class="stat-hint">{{ hint }}</span>
    <slot />
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 14px 15px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.stat-label {
  font-size: 11.5px;
  letter-spacing: 0.5px;
  color: var(--text-dim);
}
.stat-value {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text);
}
.stat-value small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-left: 3px;
}
.stat-hint {
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-dim);
}
.tone-red .stat-value {
  color: var(--red-bright);
  text-shadow: 0 0 14px rgba(255, 45, 45, 0.4);
}
.tone-cyan .stat-value {
  color: var(--cyan);
  text-shadow: 0 0 14px rgba(0, 229, 255, 0.35);
}
.tone-warn .stat-value {
  color: #e0a800;
}
</style>
