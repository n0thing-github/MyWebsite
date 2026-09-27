<script setup>
import { computed } from 'vue'

/**
 * 进度条。掌握度配色分档，让"哪一域不行"一眼可见。
 */
const props = defineProps({
  value: { type: Number, default: 0 }, // 0–100
  label: { type: String, default: '' },
  // strong | ok | weak | danger | plain
  tone: { type: String, default: 'plain' },
  height: { type: Number, default: 6 },
  showValue: { type: Boolean, default: true },
})

/** 按数值自动分档（tone='plain' 时生效） */
const autoTone = computed(() => {
  if (props.tone !== 'plain') return props.tone
  const v = props.value
  if (v >= 85) return 'strong'
  if (v >= 70) return 'ok'
  if (v >= 50) return 'weak'
  return 'danger'
})

const clampedWidth = computed(() => `${Math.max(0, Math.min(100, props.value))}%`)
</script>

<template>
  <div class="pb">
    <div v-if="label || showValue" class="pb-head">
      <span v-if="label" class="pb-label">{{ label }}</span>
      <span v-if="showValue" class="pb-value">{{ Math.round(value) }}%</span>
    </div>
    <div class="pb-track" :style="{ height: height + 'px' }">
      <span class="pb-fill" :class="'tone-' + autoTone" :style="{ width: clampedWidth }"></span>
    </div>
  </div>
</template>

<style scoped>
.pb-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}
.pb-label {
  font-size: 13px;
  color: var(--text);
}
.pb-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
}
.pb-track {
  width: 100%;
  background: var(--surface-2);
  overflow: hidden;
}
.pb-fill {
  display: block;
  height: 100%;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.tone-strong {
  background: linear-gradient(90deg, #0a7f8a, var(--cyan));
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
}
.tone-ok {
  background: linear-gradient(90deg, var(--red-dim), var(--red-bright));
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.45);
}
.tone-weak {
  background: linear-gradient(90deg, #7a5a00, #d9a400);
}
.tone-danger {
  background: linear-gradient(90deg, #6b0000, #ff4d4d);
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.6);
}
.tone-plain {
  background: var(--border-light);
}
</style>
