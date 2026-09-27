<script setup>
/**
 * 空状态 / 错误状态占位。
 */
defineProps({
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  tone: { type: String, default: 'default' }, // default | error
})
</script>

<template>
  <div class="empty" :class="'tone-' + tone">
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <polygon points="20,3 35,11.5 35,28.5 20,37 5,28.5 5,11.5" />
      </svg>
    </span>
    <h3 v-if="title" class="title">{{ title }}</h3>
    <p v-if="desc" class="desc">{{ desc }}</p>
    <div v-if="$slots.default" class="actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  padding: 52px 24px 60px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.mark svg {
  width: 44px;
  height: 44px;
  fill: none;
  stroke: var(--border-light);
  stroke-width: 1.5;
}
.tone-error .mark svg {
  stroke: var(--red-dim);
}
.title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-dim);
  max-width: 320px;
}
.actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 280px;
}
</style>
