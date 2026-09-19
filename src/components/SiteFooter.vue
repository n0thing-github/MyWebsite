<template>
  <footer class="footer">
    <div class="container footer-inner">
      <a class="f-logo" href="#home">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <polygon points="20,2 35,11 35,29 20,38 5,29 5,11" />
        </svg>
        <span>Pius.Prime</span>
      </a>

      <p class="f-copy">© 2026 PIUSPRIME · Built with Vue 3 + Vite</p>

      <div class="f-social">
        <a href="https://github.com/n0thing-github" target="_blank" rel="noopener" aria-label="GitHub">
          GitHub
        </a>
        <a href="#home" aria-label="回到顶部">Top ↑</a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  border-top: 1px solid var(--border);
  padding: 34px 0;
  background: var(--bg-alt);
}
.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.f-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.f-logo svg {
  width: 22px;
  height: 22px;
}
.f-logo svg polygon {
  fill: none;
  stroke: var(--red-bright);
  stroke-width: 2;
}
.f-logo span {
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 1px;
}
.f-copy {
  color: var(--text-dim);
  font-size: 13px;
}
.f-social {
  display: flex;
  gap: 20px;
}
.f-social a {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 1px;
  color: var(--text-dim);
  transition: color 0.2s;
}
.f-social a:hover {
  color: var(--red-bright);
}
</style>
