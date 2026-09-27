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
├─ router.js                hash 路由（零依赖，支持子视图）
├─ style.css                全局样式与设计令牌
├─ composables/
│  └─ useForgettingCurve.js 遗忘曲线演示页的模型与交互状态
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
│  ├─ ForgettingCurvePage.vue  遗忘曲线演示页
│  └─ hcip/                 HCIP 备考模块（按需加载，见下节）
├─ study/                   备考模块的纯逻辑层（数学/存储/计划/导入）
├─ data/
│  ├─ steam-games.json      Steam 数据（由脚本生成）
│  └─ hcip/                 考纲配置 + 种子题库
└─ assets/                  Lottie 动画数据与图片
```

## 路由

`src/router.js` 是一个约 80 行的 hash 路由，**刻意不引入 vue-router**。

原因：站点部署在 GitHub Pages 的子路径下，而 `.github/workflows/deploy-pages.yml` 直接上传 `dist`、
**没有 404.html 回退**。history 模式下刷新或直达任何子路由都会 404；hash 模式在任意静态托管下都可靠。

命名空间约定（避免与站内锚点冲突）：

| hash | 行为 |
|---|---|
| `#/ebbinghaus` | 二级页面：遗忘曲线演示 |
| `#/hcip` / `#/hcip/today` | 二级页面：HCIP 备考模块（子视图：today / quiz / wrong / review / mock / progress / diagnostic） |
| `#home` `#about` `#skills` … | 主页锚点，停留在主页，滚动交给浏览器 |
| 空 | 主页 |

备考模块的子视图**不各建一个路由**，而是同一个组件内切换：底部标签栏切页时不需要重新挂载整页，
移动端更顺；`setSubRoute()` 用 `history.replaceState` 写 hash，所以切标签不会堆历史记录
（否则手机返回键要按好几次才能退出备考页）。

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

## HCIP 备考模块

路由 `#/hcip`。面向华为 HCIP-Datacom（先 H12-821，考完再切 H12-831），
是一个**移动端优先**的学习工具：摸底 → 自适应每日计划 → 刷题/复习 → 模考 → 进度预估。

### 分层

| 层 | 位置 | 职责 |
|---|---|---|
| 纯逻辑 | `src/study/*.js` | 记忆模型、日期、判分、存储、计划、导入——全是纯函数，可单独测 |
| 状态源 | `src/study/useStudyStore.js` | 模块级单例：进度、设置、做题现场 |
| 视图 | `src/components/hcip/` | 壳 + 底部标签栏 + 6 个视图 |
| 数据 | `src/data/hcip/` | 考纲配置 + 两套种子题库 |

状态用**模块级单例**而不是 provide/inject：底部标签栏的视图是互斥切换的，
组件频繁卸载重建，状态必须活在组件之外。

### 记忆模型：显式间隔阶梯

```
保留率    R(t) = 100 · e^(−t/S)
间隔阶梯  [1, 2, 4, 7, 15, 30, 60, 120] 天     ← 记忆强度的权威定义
答对      升一级        答错      降两级
stability 由台阶派生（= 间隔 / ln(1/目标保留率)）
```

**为什么不用「每次乘一个增益」**：`gain = min(2, 1 + k·max(0, N−reps))` 这类写法，
当 `reps` 超过 `N` 后增益恒为 `1.0`，稳定度会永久冻结（实测冻结在 3.84 天 → 间隔 0.86 天），
于是**任何题都到不了稳定**，完成预估彻底失真；不封顶则变成 2ⁿ 爆炸增长。
阶梯把"复习几次、间隔多长"显式写出来，单调、有界、可核对。

到期队列按当前保留率**升序**，最模糊的排最前；掌握度取该域已学题目的**中位数**
（比平均值更抗个别长尾题拖累）。

### 计划与自适应

每日任务 = 复习 → 错题 → 新学 → 模考建议，合计不超过当日可用时长（顺序刻意如此：
复习的边际收益高于新学，时间不够时优先保复习）。

- `pace < 0.8`（落后）→ 压缩新学（保底 20%），把时间让给复习
- `pace > 1.2`（超前）→ 新学量最多提到 150%
- 某域掌握度持续偏低 → 降速、提高复习频次，标为「重点补强」
- 未完成的任务滚入次日队列头部，不清零

完成预估按**近 7 天实际有效时长**加权推算（实际权重 0.7），而不是只按用户填的计划值——
否则实际每天只学 20 分钟时，预估会严重乐观。

### 题库与导入

种子题库 240 题（H12-821 150 题 / H12-831 90 题），按考纲域权重分布、含解析。

> **注意**：这些是**按考纲编写的原创练习题，不是官方真题**，用于建立知识框架与跑通复习机制。
> 请以官方大纲与教材为准校对。

题库按考试**动态 import**，备考模块整体也按需加载——只看主页的访客不会下载它们
（拆分后首页 chunk 526KB，未拆分是 627KB）。

支持 JSON / CSV 导入：`{id, domain, type, stem, options, answer, explain, tags}`，
`type` 取 `single`/`multi`/`judge`，多选答案用 `|` 分隔（`A|C`）。
校验**宁可整批拒绝也不静默丢题**：错误逐条带行号与原因列出，避免"我明明导入过这道题"变成悬案。

### 考纲权重待复核

`src/data/hcip/examConfig.js` 里的各域 `weight` 是**估计值**（实现时官方 PDF 未能取得）。
改这个文件即可修正，页面会自动生效——不需要动任何代码。

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
