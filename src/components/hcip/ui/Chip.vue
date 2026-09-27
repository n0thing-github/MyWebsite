<script setup>
/**
 * 小标签 / 按钮。移动端可点变体高度 ≥ 40px。
 */
defineProps({
  active: { type: Boolean, default: false },
  tone: { type: String, default: 'default' }, // default | red | cyan | warn
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  as: { type: String, default: 'button' }, // button | span
})
</script>

<template>
  <component
    :is="as"
    class="chip"
    :class="['tone-' + tone, { 'is-active': active, 'is-block': block, 'is-disabled': disabled }]"
    :disabled="as === 'button' ? disabled : undefined"
  >
    <slot />
  </component>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}
.is-block {
  width: 100%;
  min-height: 46px;
  font-size: 14px;
}
.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}
.is-active {
  color: #fff;
  border-color: var(--red-bright);
  background: rgba(225, 6, 0, 0.16);
}
.tone-cyan.is-active {
  border-color: var(--cyan);
  background: rgba(0, 229, 255, 0.14);
}
.tone-warn.is-active {
  border-color: #e0a800;
  background: rgba(224, 168, 0, 0.14);
}
/* sticky hover 只给真正支持悬停的设备 */
@media (hover: hover) {
  .chip:hover:not(.is-disabled) {
    color: #fff;
    border-color: var(--red-bright);
  }
}
</style>
