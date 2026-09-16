<script setup>
defineProps({
  href: { type: String, default: '' },
  ghost: { type: Boolean, default: false },
})
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :href="href || undefined"
    class="tech-btn"
    :class="{ 'is-ghost': ghost }"
  >
    <span class="btn-label"><slot /></span>
    <svg
      class="btn-svg"
      viewBox="0 0 220 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <!-- 斜切角描边 -->
      <path d="M16 2 H204 L218 16 V44 L204 58 H16 L2 44 V16 Z" />
    </svg>
  </component>
</template>

<style scoped>
.tech-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16px 40px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  outline: none;
}

.btn-label {
  position: relative;
  z-index: 2;
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: var(--text);
  white-space: nowrap;
  transition: color 0.3s ease, text-shadow 0.3s ease;
}

.btn-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.btn-svg path {
  fill: rgba(225, 6, 0, 0.05);
  stroke: var(--red-bright);
  stroke-width: 1.6;
  stroke-dasharray: 1 0;
  stroke-linejoin: miter;
  transition: fill 0.3s ease, stroke 0.3s ease, filter 0.3s ease;
}

.tech-btn:hover .btn-svg path {
  fill: rgba(225, 6, 0, 0.16);
  stroke: #ff4d4d;
  stroke-dasharray: 14 9;
  filter: drop-shadow(0 0 6px rgba(255, 45, 45, 0.7));
  animation: dash-flow 0.8s linear infinite;
}

.tech-btn:hover .btn-label {
  color: #fff;
  text-shadow: 0 0 16px rgba(255, 45, 45, 0.95);
}

/* ghost 变体：仅描边、更低调 */
.tech-btn.is-ghost .btn-svg path {
  fill: transparent;
  stroke: var(--text-dim);
}
.tech-btn.is-ghost:hover .btn-svg path {
  stroke: var(--cyan);
  filter: drop-shadow(0 0 6px rgba(0, 229, 255, 0.6));
}
.tech-btn.is-ghost:hover .btn-label {
  color: #fff;
  text-shadow: 0 0 16px rgba(0, 229, 255, 0.8);
}

@keyframes dash-flow {
  to {
    stroke-dashoffset: -23;
  }
}
</style>
