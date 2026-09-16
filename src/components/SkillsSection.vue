<script setup>
const skills = [
  { name: 'HTML / CSS', level: 90 },
  { name: 'JavaScript / TypeScript', level: 85 },
  { name: 'Vue / React', level: 82 },
  { name: 'Node.js', level: 72 },
  { name: 'Three.js / WebGL', level: 60 },
  { name: 'UI / 动效设计', level: 78 },
]
</script>

<template>
  <section id="skills" class="section skills">
    <div class="container">
      <span class="section-tag">Skills</span>
      <h2 class="section-title">技术<span class="accent">栈</span></h2>

      <div class="skill-list">
        <div v-for="s in skills" :key="s.name" class="skill">
          <div class="skill-head">
            <span class="skill-name">{{ s.name }}</span>
            <span class="skill-pct">{{ s.level }}%</span>
          </div>
          <div class="skill-bar">
            <div class="skill-fill" :style="{ width: s.level + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.skill-list {
  margin-top: 46px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px 46px;
}

.skill-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}
.skill-name {
  font-size: 15px;
  letter-spacing: 1px;
  color: var(--text);
}
.skill-pct {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--red-bright);
}

.skill-bar {
  height: 4px;
  background: var(--surface-2);
  overflow: hidden;
}
.skill-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--red-dim), var(--red-bright));
  box-shadow: 0 0 10px rgba(255, 45, 45, 0.6);
  transition: width 1.1s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (max-width: 700px) {
  .skill-list {
    grid-template-columns: 1fr;
  }
}
</style>
