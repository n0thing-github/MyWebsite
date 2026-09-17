<script setup>
/**
 * 全局背景装饰层（纯装饰，无交互）
 *
 * 用内联 SVG <pattern> 做矢量图案平铺：比位图清晰、体积极小，缩放不变形。
 * 每个平铺层都是一块比视口更大的 fixed 容器，靠 CSS transform 整体平移
 * 来制造"缓慢流动"——走合成器，不触发重绘。
 *
 * 无缝的关键：位移量必须是平铺周期的整数倍，否则循环回首帧会跳一下。
 *   · 网格层  周期 40px → 平移 80px  = 40 × 2
 *   · 电路层  周期 96px → 平移 192px = 96 × 2
 */
</script>

<template>
  <div class="bk" aria-hidden="true">
    <!-- 层 1：斜向菱形网格 + 节点 -->
    <div class="bk-tile bk-tile--grid">
      <svg>
        <defs>
          <pattern id="bkGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M0 0L40 40M40 0L0 40"
              fill="none"
              stroke="rgb(255 255 255 / 0.05)"
              stroke-width="1"
            />
            <circle cx="20" cy="20" r="1.1" fill="rgb(225 6 0 / 0.34)" />
            <circle cx="0" cy="0" r="1.1" fill="rgb(0 229 255 / 0.26)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bkGrid)" />
      </svg>
    </div>

    <!-- 层 2：电路走线 + 焊盘 -->
    <div class="bk-tile bk-tile--circuit">
      <svg>
        <defs>
          <pattern id="bkCircuit" width="96" height="96" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="rgb(225 6 0 / 0.13)" stroke-width="1">
              <path d="M0 24H36V52H64V24H96" />
              <path d="M0 68H40V96" />
              <path d="M96 68H68V96" />
              <path d="M0 12H26V40" />
              <path d="M96 12H70V40" />
            </g>
            <g fill="rgb(0 229 255 / 0.22)">
              <circle cx="36" cy="24" r="1.7" />
              <circle cx="64" cy="24" r="1.7" />
              <circle cx="26" cy="12" r="1.7" />
              <circle cx="70" cy="12" r="1.7" />
              <circle cx="40" cy="68" r="1.7" />
              <circle cx="68" cy="68" r="1.7" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bkCircuit)" />
      </svg>
    </div>

    <!-- 层 3：上下扫描光带 -->
    <span class="bk-scan"></span>

    <!-- 层 4：缓缓升起的光点 -->
    <div class="bk-sparks">
      <span v-for="n in 9" :key="n"></span>
    </div>
  </div>
</template>

<style scoped>
.bk {
  position: fixed;
  inset: 0;
  z-index: -3; /* 比 .grid-bg(-2) 更靠底，叠起来才有层次 */
  pointer-events: none;
}

/* ===== 平铺层 ===== */
.bk-tile {
  position: absolute;
  inset: -240px; /* 比视口大一圈，给平移留余量 */
  overflow: hidden;
}
.bk-tile svg {
  display: block;
  width: 100%;
  height: 100%;
}

.bk-tile--grid {
  animation: bkDriftGrid 90s linear infinite;
}
@keyframes bkDriftGrid {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-80px, -80px, 0); }
}

.bk-tile--circuit {
  animation: bkDriftCircuit 46s linear infinite;
}
@keyframes bkDriftCircuit {
  from { transform: translate3d(-192px, 0, 0); }
  to { transform: translate3d(0, -192px, 0); }
}

/* ===== 扫描光带 ===== */
.bk-scan {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.bk-scan::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 34vh;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(225, 6, 0, 0.055) 45%,
    rgba(0, 229, 255, 0.03) 55%,
    transparent 100%
  );
  animation: bkScan 13s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
@keyframes bkScan {
  from { transform: translate3d(0, -40vh, 0); }
  to { transform: translate3d(0, 105vh, 0); }
}

/* ===== 光点 ===== */
.bk-sparks span {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--red-bright);
  box-shadow: 0 0 10px 2px rgba(255, 45, 45, 0.5);
  opacity: 0;
  animation: bkSpark 11s ease-in-out infinite;
}
@keyframes bkSpark {
  0%, 100% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.6); }
  45% { opacity: 0.8; transform: translate3d(0, -46px, 0) scale(1); }
  70% { opacity: 0.2; transform: translate3d(0, -70px, 0) scale(0.8); }
}

.bk-sparks span:nth-child(1) { top: 18%; left: 8%; animation-delay: 0s; }
.bk-sparks span:nth-child(2) { top: 34%; left: 26%; animation-delay: 1.6s; }
.bk-sparks span:nth-child(3) { top: 62%; left: 14%; animation-delay: 3.4s; }
.bk-sparks span:nth-child(4) { top: 78%; left: 38%; animation-delay: 5.1s; }
.bk-sparks span:nth-child(5) { top: 12%; left: 58%; animation-delay: 2.3s; }
.bk-sparks span:nth-child(6) { top: 46%; left: 72%; animation-delay: 6.8s; }
.bk-sparks span:nth-child(7) { top: 26%; left: 88%; animation-delay: 4.2s; }
.bk-sparks span:nth-child(8) { top: 68%; left: 82%; animation-delay: 8.5s; }
.bk-sparks span:nth-child(9) { top: 86%; left: 60%; animation-delay: 9.7s; }

/* ===== 尊重「减少动态效果」 ===== */
@media (prefers-reduced-motion: reduce) {
  .bk-tile,
  .bk-scan::before,
  .bk-sparks span {
    animation: none;
  }
  .bk-sparks span {
    opacity: 0.3;
  }
}

/* 小屏降开销：去掉电路层与后一半光点 */
@media (max-width: 768px) {
  .bk-tile--circuit {
    display: none;
  }
  .bk-sparks span:nth-child(n + 6) {
    display: none;
  }
}
</style>
