<script setup>
import TechButton from './TechButton.vue'

const contacts = [
  { label: 'GitHub', value: 'n0thing-github', href: 'https://github.com/n0thing-github' },
  { label: 'Email', value: 'n0thing-github@users.noreply.github.com', href: 'mailto:n0thing-github@users.noreply.github.com' },
]
</script>

<template>
  <section id="contact" class="section contact">
    <div class="container">
      <span class="section-tag">Contact</span>
      <h2 class="section-title">联系<span class="accent">我</span></h2>
      <p class="section-desc">
        有项目想法，或想一起合作？欢迎随时联系。
      </p>

      <div class="contact-links">
        <a
          v-for="c in contacts"
          :key="c.label"
          class="contact-item"
          :href="c.href"
          target="_blank"
          rel="noopener"
        >
          <span class="c-label">{{ c.label }}</span>
          <span class="c-value">{{ c.value }}</span>
          <span class="c-arrow">→</span>
        </a>
      </div>

      <div class="cta">
        <TechButton href="mailto:n0thing-github@users.noreply.github.com">
          发送邮件
        </TechButton>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact-links {
  margin-top: 46px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 22px 26px;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: border-color 0.3s ease, transform 0.3s ease;
}

.contact-item:hover {
  border-color: rgba(225, 6, 0, 0.55);
  transform: translateX(8px);
}

.c-label {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--text-dim);
  min-width: 70px;
  text-transform: uppercase;
}

.c-value {
  flex: 1;
  font-size: 17px;
  color: var(--text);
  word-break: break-all;
}

.c-arrow {
  font-size: 20px;
  color: var(--red-bright);
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.contact-item:hover .c-arrow {
  opacity: 1;
  transform: translateX(0);
}

.cta {
  margin-top: 46px;
}
</style>
