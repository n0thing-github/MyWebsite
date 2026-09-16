<script setup>
import TechButton from './TechButton.vue'

const projects = [
  {
    title: 'MyWebsite',
    desc: '未来科技风个人主页，含开场动画、斜切导航与描边按钮。',
    tags: ['Vue 3', 'Vite', 'CSS'],
    link: '#',
  },
  {
    title: 'RSI 风格官网',
    desc: '星际科技主题站点，clip-path 斜切标签与下拉导航。',
    tags: ['HTML', 'CSS', 'JS'],
    link: '#',
  },
  {
    title: '预约系统',
    desc: 'Vue + ElementUI 预约平台，SVG 描边动效与状态管理。',
    tags: ['Vue', 'ElementUI'],
    link: '#',
  },
  {
    title: '聊天机器人',
    desc: '对话式交互应用，自然语言处理与流式响应。',
    tags: ['JavaScript', 'API'],
    link: '#',
  },
  {
    title: '数据可视化',
    desc: '大屏数据看板，实时渲染与炫酷动效。',
    tags: ['ECharts', 'Canvas'],
    link: '#',
  },
  {
    title: '实验作品',
    desc: 'WebGL / 动效实验合集，探索技术与美学的边界。',
    tags: ['WebGL', '动画'],
    link: '#',
  },
]
</script>

<template>
  <section id="portfolio" class="section portfolio">
    <div class="container">
      <span class="section-tag">Portfolio</span>
      <h2 class="section-title">我的<span class="accent">作品</span></h2>
      <p class="section-desc">精选项目与实验作品，持续更新中。</p>

      <div class="grid">
        <article v-for="p in projects" :key="p.title" class="card">
          <div class="card-top">
            <span class="card-index">0{{ projects.indexOf(p) + 1 }}</span>
            <span class="card-corner"></span>
          </div>
          <h3 class="card-title">{{ p.title }}</h3>
          <p class="card-desc">{{ p.desc }}</p>
          <div class="card-tags">
            <span v-for="t in p.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <div class="card-action">
            <TechButton :href="p.link" ghost>查看详情</TechButton>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  margin-top: 50px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 28px 26px;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.35s ease, box-shadow 0.35s ease;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-8px);
  border-color: rgba(225, 6, 0, 0.55);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.card-index {
  font-family: var(--font-mono);
  font-size: 15px;
  color: var(--red-bright);
}
.card-corner {
  width: 16px;
  height: 16px;
  border-top: 1px solid var(--red-bright);
  border-right: 1px solid var(--red-bright);
  transition: transform 0.3s ease;
}
.card:hover .card-corner {
  transform: translate(-4px, 4px);
}

.card-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}
.card-desc {
  color: var(--text-dim);
  font-size: 14.5px;
  line-height: 1.7;
  margin-bottom: 20px;
  min-height: 72px;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 22px;
}
.tag {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  padding: 4px 10px;
  border: 1px solid var(--border-light);
  transition: color 0.2s, border-color 0.2s;
}
.card:hover .tag {
  color: var(--cyan);
  border-color: rgba(0, 229, 255, 0.35);
}

.card-action {
  display: flex;
  justify-content: flex-start;
}
.card-action :deep(.tech-btn) {
  padding: 12px 28px;
}

@media (max-width: 1024px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
