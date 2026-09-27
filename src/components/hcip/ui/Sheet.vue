<script setup>
import { watch, onBeforeUnmount } from 'vue'

/**
 * 底部抽屉。
 * 移动端优于居中弹窗：拇指可达、内容可滚动、不遮挡上半屏。
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const emit = defineEmits(['close'])

/**
 * 打开时锁住底层滚动。
 * 只锁 <html> 上的 class 而不是写 body 的 inline style ——
 * 与站点既有的做法保持一致（NavBar 的滚动锁），避免多处互相覆盖。
 */
function syncLock(open) {
  document.documentElement.classList.toggle('sheet-open', open)
}

watch(() => props.open, syncLock, { immediate: true })
onBeforeUnmount(() => syncLock(false))
</script>

<template>
  <Teleport to="body">
    <div class="mask" :class="{ 'is-open': open }" @click="emit('close')"></div>
    <section class="sheet" :class="{ 'is-open': open }" role="dialog" aria-modal="true">
      <header class="sheet-head">
        <h3 class="sheet-title">{{ title }}</h3>
        <button class="sheet-close" aria-label="关闭" @click="emit('close')">×</button>
      </header>
      <div class="sheet-body">
        <slot />
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.66);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.28s ease, visibility 0.28s;
}
.mask.is-open {
  opacity: 1;
  visibility: visible;
}

.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 901;
  max-height: 86dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-alt);
  border-top: 2px solid var(--red);
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.6);
  transform: translateY(102%);
  transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.sheet.is-open {
  transform: translateY(0);
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sheet-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.sheet-close {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1px solid var(--border-light);
  color: var(--text);
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}

.sheet-body {
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
