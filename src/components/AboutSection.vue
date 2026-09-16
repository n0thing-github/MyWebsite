<script setup>
const stats = [
  { num: '3+', label: '年开发经验' },
  { num: '20+', label: '完成项目' },
  { num: '10+', label: '掌握技术' },
  { num: '∞', label: '探索热情' },
]

const highlights = [
  '热爱干净、可维护的代码与优雅的交互设计',
  '追求极致的视觉与性能体验',
  '持续学习前沿 Web 技术',
]
</script>

<template>
  <section id="about" class="section about">
    <div class="container">
      <span class="section-tag">About</span>
      <h2 class="section-title">关于<span class="accent">我</span></h2>

      <div class="about-grid">
        <p class="section-desc">
          你好，我是 N0THING，一名专注于 Web 前端与创意开发的全栈开发者。
          我喜欢把复杂的问题拆解成优雅的解决方案，用代码构建沉浸式的数字体验。
          从静态页面到交互式应用，从视觉动效到性能优化，
          我始终相信 —— 好的产品，是技术与美学的结合。
        </p>

        <ul class="highlights">
          <li v-for="(h, i) in highlights" :key="i">
            <span class="marker"></span>{{ h }}
          </li>
        </ul>
      </div>

      <div class="stats">
        <div v-for="s in stats" :key="s.label" class="stat">
          <span class="stat-num">{{ s.num }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 50px;
  align-items: start;
  margin-bottom: 60px;
}

.highlights {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.highlights li {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1.7;
}
.marker {
  width: 10px;
  height: 10px;
  margin-top: 7px;
  background: var(--red-bright);
  transform: rotate(45deg);
  box-shadow: 0 0 8px rgba(255, 45, 45, 0.7);
  flex-shrink: 0;
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
}
.stat {
  background: var(--bg-alt);
  padding: 34px 20px;
  text-align: center;
}
.stat-num {
  display: block;
  font-family: var(--font-mono);
  font-size: 38px;
  font-weight: 800;
  color: var(--red-bright);
  text-shadow: 0 0 20px rgba(255, 45, 45, 0.5);
}
.stat-label {
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--text-dim);
}

@media (max-width: 820px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
