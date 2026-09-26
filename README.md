# Pius.Prime

未来科技风（黑红）个人主页，Vue 3 + Vite 单页应用，附带一个可交互的**艾宾浩斯遗忘曲线**演示页。

线上地址：<https://n0thing-github.github.io/MyWebsite/>

## 技术栈

| | |
|---|---|
| 框架 | Vue 3（`<script setup>` SFC） |
| 构建 | Vite 8 |
| 动画 | lottie-web（开场遮罩）、CSS 动画、SVG |
| 图表 | 手写内联 SVG，**未引入图表库** |
| 路由 | 自研轻量 hash 路由，**未引入 vue-router** |

运行时依赖只有 `vue` 与 `lottie-web`。

## 快速开始

```bash
npm ci          # 按 package-lock.json 精确安装
npm run dev     # 开发服务器
npm run build   # 生产构建 → dist/
npm run preview # 本地预览构建产物
```

开发服务器默认跑在 `http://localhost:5173/MyWebsite/`。

> **注意路径**：`vite.config.js` 里 `base: '/MyWebsite/'`，是为了 GitHub Pages 的子路径部署。
> 本地访问也必须带 `/MyWebsite/` 后缀，直接开 `http://localhost:5173/` 会拿不到资源。

## 目录结构

```
src/
├─ main.js                  应用入口
├─ App.vue                  壳：背景装饰 + 路由切换 + reveal 观察器
├─ router.js                hash 路由（零依赖）
├─ style.css                全局样式与设计令牌
├─ composables/
│  └─ useForgettingCurve.js 遗忘曲线的数学模型与交互状态
├─ components/
│  ├─ HomePage.vue          主页内容装配（把各 section 串起来）
│  ├─ Preloader.vue         开场遮罩（Lottie 反向播放揭示）
│  ├─ NavBar.vue            玻璃导航 + 斜切标签 + 右侧抽屉菜单
│  ├─ BackdropFX.vue        全局矢量平铺背景（纯装饰）
│  ├─ HeroSection.vue       首屏
│  ├─ GameBanner.vue        游戏轮播横幅
│  ├─ AboutSection.vue      关于
│  ├─ PortfolioSection.vue  作品集
│  ├─ SkillsSection.vue     技能
│  ├─ SteamSection.vue      Steam 游戏库
│  ├─ ContactSection.vue    联系
│  ├─ SiteFooter.vue        页脚
│  ├─ TechButton.vue        斜切角描边按钮
│  └─ ForgettingCurvePage.vue  遗忘曲线二级页面
├─ data/steam-games.json    Steam 数据（由脚本生成）
└─ assets/                  Lottie 动画数据与图片
```

## 路由

`src/router.js` 是一个约 80 行的 hash 路由，**刻意不引入 vue-router**。

原因：站点部署在 GitHub Pages 的子路径下，而 `.github/workflows/deploy-pages.yml` 直接上传 `dist`、
**没有 404.html 回退**。history 模式下刷新或直达任何子路由都会 404；hash 模式在任意静态托管下都可靠。

命名空间约定（避免与站内锚点冲突）：

| hash | 行为 |
|---|---|
| `#/ebbinghaus` | 二级页面：遗忘曲线 |
| `#home` `#about` `#skills` … | 主页锚点，停留在主页，滚动交给浏览器 |
| 空 | 主页 |

两个容易踩的坑，代码里已处理：

1. **重复点击同一锚点**：浏览器对未变化的 hash 不派发 `hashchange`，路由 watch 不会触发。
   所以 `go()` 在 hash 相同时会同步补一次滚动定位——这是首页 logo 能反复点击回顶部的关键。
2. **跨页锚点定位**：从二级页面点「关于」时，目标元素要等 Vue 把主页渲染出来才存在。
   滚动定位必须放在 `nextTick` 之后（见 `App.vue` 的 `watch(route)`）。

## 遗忘曲线页面

路由 `#/ebbinghaus`，导航与抽屉菜单中的「遗忘曲线」入口进入。

### 模型

```
保留率      R(t) = 100 · e^(−t/S)          t = 距上次复习的天数
稳定度      S₀ = 1.2 天
            S(n) = S₀ · (1 + g·n)          第 n 次复习之后
复习时刻    等保留率间隔：Δtₙ = S(n−1) · ln(1/R)
```

用 `exp(-t/S)` 而不是照搬"1 天后 33%"的固定点：固定点只是某个 `S` 下的特例，不能随参数变化；
指数形式下 `S = 1.2` 天时 `R(1) ≈ 43%`，调低衰减敏感度即可逼近经典位置，既可解释又能驱动交互。

`Δtₙ = S(n−1)·ln(1/R)` 是间隔重复（Spaced Repetition）的核心结论：**间隔应随稳定度逐次放大**。

### 交互

- **三个滑块**：衰减敏感度 `k`、目标保持率 `R`、稳定度增长 `g`，曲线实时重算
- **四个预置方案**：1天速记 / 3天 / 7天 / 30天
- **拖动复习节点**：直接改某次间隔，其后各次顺延
- **鼠标跟随读数**：在图表上移动鼠标，十字准线跟随并显示该天数的保留率
- **播放动画**：1× / 2× / 4× 三档速度演示记忆衰减与复习回弹
- **不复习基线**：暗红虚线，用于对比

### 图表实现要点

图表是手写内联 SVG，有几处必须留意的细节：

- **viewBox 等于实测像素**：用 `ResizeObserver` 量出容器宽高再写入 `viewBox`，使 1 个 viewBox 单位
  = 1 个 CSS 像素。若改用 `preserveAspectRatio="none"` 拉伸，圆点会变成椭圆、文字会被横向抻宽。
- **横轴用对数刻度**：经典方案的复习点集中在前 20 天，线性轴会把它们全挤在最左侧。
  代价是最左端约 55px 内指针映射到的天数会小于刻度下限 `0.05` 天而被钳制在轴起点。
- **节点命中必须按屏幕像素判定**：早期复习点在对数轴上只隔几个像素，若用固定*天数*容差
  （例如 `horizon × 0.012` ≈ 0.66 天），判定区会横向覆盖几十像素，鼠标离得老远就被"吸"到节点上。
  现在用横向 7px + 纵向 10px 的二维判定。
- **装饰图层必须 `pointer-events: none`**：十字准线正好画在鼠标所在位置，若参与命中判定，
  光标会在"准线"和"命中区"之间来回跳，表现为鼠标快速闪烁。
- **脚本里 `chartGeom` 要写 `.value`**：它是 computed ref，模板会自动解包，`<script setup>` 里不会。
  漏掉 `.value` 会得到 `undefined`，参与算术后变成 `NaN` 属性（元素静默失效 + 控制台刷错）。

## Steam 数据

`src/data/steam-games.json` 由脚本在**构建前抓取一次**并入库，访客零等待，也不受 Steam 波动影响。

```bash
cp .env.example .env.local   # 填入 STEAM_API_KEY
npm run steam
```

不直接在浏览器里调 Steam API 的原因：接口不返回 CORS 头；API Key 进前端产物等于公开泄露；
构建时抓成静态 JSON 更稳。详见 `scripts/fetch-steam-games.mjs` 顶部注释。

前置条件：Steam → 个人资料 → 隐私设置 → 「游戏详情」需设为**公开**。

## 部署

推送到 `main` 触发 `.github/workflows/deploy-pages.yml`：

```
checkout → setup-node 24 → npm ci → npm run build → upload dist → deploy-pages
```

`base: '/MyWebsite/'` 与该工作流是配套的；若改仓库名或部署到自定义域名，两者都要同步改。

## 约定

- 文案与注释统一使用中文，术语保留英文原词（如 Spaced Repetition）。
- 视觉沿用黑红科技风，颜色全部走 `style.css` 里的 CSS 变量，不硬编码新配色；
  强调色用 `--red-bright`，对比色用 `--cyan`。
- 所有源码文件使用 **UTF-8 无 BOM** 保存。
  在 Windows PowerShell 里用 `Set-Content` 批量改写源码会把中文按 GBK 破坏并写入 BOM，
  文本编辑请使用支持 UTF-8 的编辑器或工具。
- 提交信息遵循 Conventional Commits：`feat(scope): …` / `fix(scope): …` / `ci: …`。
