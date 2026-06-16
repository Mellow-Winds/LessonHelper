# 课搭子 — 设计风格语言 & 动画风格语言

> 本文档提炼自项目 CSS 设计系统、`rules` 规范文件及前端动画引擎源码，作为统一的设计语言参考。

---

## 一、设计风格语言

### 1.1 设计体系归属

**Material Design 3（MD3）** — 扁平化 · 圆润 · 克制

- 遵循 Google Material Design 3 色彩、组件、动效规范
- 无渐变背景（sidebar 除外，使用同色系微渐变营造层次）
- 无玻璃态（glassmorphism），无霓虹色，无彩虹色板
- 原则上：每个视图不超过 3 个品牌色

### 1.2 色彩系统

#### Design Token 层级

```
--md-primary           #4A90D9  主色（克莱因蓝变体）
--md-primary-hover     #3A7CC4  悬停态（加深 10%）
--md-primary-container #D3E4FD  主色容器（浅蓝底色）
--md-on-primary        #ffffff  主色之上的文字/图标
--md-on-primary-container #001C3B  主色容器之上的文字

--md-secondary         #565E71  次要色
--md-tertiary          #6E5676  第三色
--md-error             #BA1A1A  错误色（纯粹红色，无粉调）

--md-surface           #F9F9FF  页面底色（微蓝白）
--md-on-surface        #1A1B21  正文色（接近纯黑）

--md-outline           #74777F  轮廓线
--md-outline-variant   #C4C6D0  弱轮廓线（分割线色）
```

#### 容器颜色层级（由低到高）

```
surface-container-lowest  #ffffff   → 卡片内层、输入框内层
surface-container-low     #F3F3FA   → 次级面板
surface-container         #EDEDF4   → 表头
surface-container-high    #E8E8EF   → 悬停态
surface-container-highest #E2E2E9   → Modal 底板
```

#### 语义色

| 语义 | 背景 | 文字 |
|------|------|------|
| 成功 / 招募中 | `#e8f5e9` | `#2e7d32` |
| 警告 / 已满 | `#fff3e0` | `#e65100` |
| 中性 / 已关闭 | `#f5f5f5` | `#757575` |
| 星级激活 | — | `#FB8C00` |
| 完成进度条 | — | `#43A047` |

#### 文字层级

| 层级 | 色值 | 用途 |
|------|------|------|
| 主文字 | `#111827` | 标题、正文 |
| 次级文字 | `#6b7280` | 描述、元数据 |
| 三级文字 | `#9ca3af` | 占位、禁用态 |

### 1.3 字体排印

| Token | 大小 | 用途 |
|-------|------|------|
| `--text-xs` | 11–12px | 标签、徽章、辅助文字 |
| `--text-sm` | 14px | 按钮、导航、正文辅助 |
| `--text-base` | 16px | 正文、输入框 |
| `--text-lg` | 20px | 小标题、卡片标题 |
| `--text-xl` | 24px | 页面标题 |
| `--text-2xl` | 32px | 大标题（极少使用） |

- 字体族：`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- 正文：`font-weight: 400; line-height: 1.5`
- 标题：`font-weight: 600; line-height: 1.25–1.3`
- 字母间距：标题级 `-0.01em`，全大写标签 `0.06–0.08em`
- 统一使用 `px`，不混用 `rem`/`em`
- **禁止**使用字体比例表外的任意字号

### 1.4 间距系统

基于 4px 网格：

| Token | 值 | Token | 值 |
|-------|-----|-------|-----|
| `--space-1` | 4px | `--space-4` | 16px |
| `--space-2` | 8px | `--space-6` | 24px |
| `--space-3` | 12px | `--space-8` | 32px |

- 禁止魔法数字（13px、7px、23px 等）
- 组件族内保持一致的 padding

### 1.5 圆角系统

| Token | 值 | 典型用途 |
|-------|-----|----------|
| `--radius-sm` | 12px | 输入框、表格角、小卡片 |
| `--radius-md` | 16px | 中型容器、选项列表 |
| `--radius-lg` | 20px | 大卡片 |
| `--radius-xl` | 24px | 特大卡片 |
| `--radius-2xl` | 28px | Modal、Bottom Sheet |
| `--radius-pill` | 999px | 按钮、标签、导航项、徽章 |

规则：
- 卡片圆角 16–20px，不使用 ≥24px 的巨型圆角
- 按钮/标签/徽章统一 pill（999px）
- 输入框圆角 8px（MD3 Outlined 标准）

### 1.6 阴影系统

**原则：单页面不超过 2 个阴影深度层级**

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-1` | `0 1px 2px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.06)` | 导航项 active、卡片默认 |
| `--shadow-2` | `0 2px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)` | 卡片 hover、按钮 hover |
| `--shadow-3` | `0 4px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)` | Modal、展开卡片 |
| `--shadow-sm` | `0 0 0 2px rgba(74,144,217,0.15)` | 聚焦光环 |

规则：
- 卡片：边框**或**阴影，不同时使用两者
- 输入框聚焦：border-color 变主色 + border-width 收为 2px，不用 box-shadow

### 1.7 图标系统

- **主图标集**：Material Icons Round（`.mi`，通过 Google Fonts 加载）
- **辅助图标集**：Remix Icon（`.remix-align`，用于特定场景）
- **SVG 图标**（`.mi-svg`）：与 Material Icons 视觉对齐的 inline SVG 方案
- 内联尺寸：20px；独立尺寸：24px
- 图标垂直微调：`translateY(1–1.5px)` 实现视觉居中
- 禁止 emoji 作为功能性图标

### 1.8 组件设计语言

#### 卡片

- 白色背景（`surface-container-lowest`），1px 边框（`outline-variant`）
- hover：shadow-2 + translateY(-2px) + 边框变主色
- active：回弹至 translateY(0) + scale(0.995)
- 圆角统一 `--radius-lg`（20px）

#### 按钮

- **Primary**：纯色填充（`md-primary`），hover 加深 10%（`md-primary-hover`）
- **Secondary**：透明底 + 1.5px 轮廓线 + 主色文字，hover 切换为主色容器背景
- **Icon-only**：40×40px 圆形，hover 显示容器色背景
- **Ripple**：点击时从触点扩散圆形波纹，`currentColor` 15% 透明度，500ms 缩放 + 淡出
- active 态统一 `scale(0.97)`
- 所有按钮使用 `--radius-pill`（全圆角）
- **严禁**渐变填充按钮

#### 输入框 — MD3 Outlined

- 使用 `createMdInput()` / `createMdTextarea()` 工厂生成，**禁止**裸 `<input class="input">`
- 56px 高度，8px 圆角，透明背景
- 结构：`<input>` + `<label>` + `<fieldset class="md-border">`（含 `<legend>` 缺口）
- **placeholder 只能为空格 `' '`**，禁止在 placeholder 中使用任何中文/英文提示
- 标签悬浮：focus/has-value 时标签缩小至 0.75rem、浮至顶部、变主色
- 状态机：默认（1px outline）→ hover（on-surface）→ focus（2px primary）
- **`resize: none` 强制应用于所有 input 和 textarea**

#### 选择器 — 自定义实现

- 使用 `createMdSelect()` 生成，**禁止**原生 `<select>`
- 56px 高度，8px 圆角，点击展开下拉菜单
- 下拉菜单：12px 圆角，`shadow 0 4px 20px rgba(0,0,0,0.15)`，最大 240px 可滚动
- 箭头在 open 态旋转 180°
- 选中项：主色文字 + 主色容器背景

#### Modal / Dialog

- 底板色 `surface-container-highest`，28px 圆角
- 入场：`opacity 0 → 1` + `scale(0.85) → 1` + `translateY(24px → 0)`
- 关闭按钮：44×44px 圆形触摸区
- 遮罩：纯黑背景，入场时从 transparent 过渡

#### Bottom Sheet

- 顶部圆角 28px，底部直角
- 入场：从 `translateY(100%)` 滑入
- 每项 56px 高度，active 态显示容器色背景
- 危险操作项使用 `--md-error` 色

#### 导航

- 侧边栏：240px 宽，微渐变背景（`surface-container-low → surface`）
- 导航项：pill 形状，图标 22px + 文字 14px
- 状态：默认灰色 → hover 变深 + 图标 scale(1.1) → active 主色容器 + shadow-1
- 标签页（`.md-tabs`）：底部 1px 分割线 + 3px 指示条（`scaleX(0→1)` 动画）

#### 标签与徽章

- 全部 pill 形状（999px）
- 胶囊标签（`.post-chip`）：`primary-container` 背景 + `on-primary-container` 文字
- 状态徽章（`.status-badge`）：按语义配色（绿/橙/灰）
- 分类标签（`.square-category-tag`）：主色容器背景

#### Toast

- 居中底部定位，pill 形状，深色底白字
- 入场：`translateY(20px → 0)` + `opacity(0 → 1)`，spring 缓动
- 2.5 秒后自动消失

#### Skeleton / 骨架屏

- 评论骨架：圆形头像 + 矩形文字行，统一 `skeleton-pulse` 呼吸动画（1.5s 循环，opacity 1 ↔ 0.4）
- 评论区骨架（tk-）：`tk-shimmer` 流光动画（gradient position 从左扫到右，1.5s）

### 1.9 布局规范

- **整体布局**：侧边栏（240px 固定宽度）+ 主内容区（flex: 1，overflow-y: auto）
- **内容最大宽度**：个人中心 560px，帖子创建 672px，Modal 560px
- **底部操作栏**（Preview Banner）：固定底部居中，深色半透明背景 + 毛玻璃效果（**仅此一处使用 backdrop-filter**）
- **移动端响应式**：≤767px 时侧边栏/回声洞隐藏，栅格变单列

### 1.10 品牌文化

- **名称**："课搭子"（英文 EduSpace）
- **品牌意象**：南京大学蓝鲸文化 — 鲸鱼（logo 中的鲸鱼图形）
- **品牌色**：`#4A90D9` — 介于克莱因蓝与蔚蓝之间，学术感与亲和力并存
- **品牌定位**：面向大学生的同课程学习互助平台

---

## 二、动画风格语言

### 2.1 缓动曲线体系

所有动画使用标准化的 cubic-bezier 曲线，定义在 CSS 变量和 JS 常量中：

| 曲线名 | CSS 变量 | cubic-bezier 值 | 语义 |
|--------|----------|-----------------|------|
| Standard | `--ease-standard` | `(0.2, 0, 0, 1)` | 通用过渡（强调开始、平稳结束） |
| Decelerate | `--ease-decelerate` | `(0, 0, 0, 1)` | 入场动画（快速开始、柔和着陆） |
| Accelerate | `--ease-accelerate` | `(0.3, 0, 1, 1)` | 退场动画（快速启动、加速消失） |
| Spring | `--ease-spring` | `(0.34, 1.56, 0.64, 1)` | 弹性动画（过冲回弹，活泼感） |
| Gentle | `--ease-gentle` | `(0.25, 0.1, 0.25, 1)` | 柔和过渡（对称缓动） |
| Bounce | JS only | `(0.18, 1.25, 0.4, 1)` | 弹性入场（比 spring 更强烈的回弹） |

### 2.2 时长层级

| Token | 值 | 适用场景 |
|-------|-----|----------|
| `--dur-fast` | 120ms | 微交互（scale 变化、icon 旋转） |
| `--dur-normal` | 250ms | 状态切换（hover、active、选中） |
| `--dur-smooth` | 350ms | 页面过渡、卡片动画 |
| `--dur-slow` | 500ms | Modal 入场、ripple |
| `--dur-xslow` | 650ms | 极少使用 |

经验时长：
- 按钮 active scale：100–150ms
- 标签悬浮浮动：200ms
- Toast 出入：300–350ms
- 页面切换退场：160–180ms
- 列表交错入场：420ms（每项间隔 55ms）
- Modal 入场：300–350ms

### 2.3 核心动画模式

#### 页面路由过渡（router.js `animIn` / `animOut`）

```
入场：opacity 0→1 + translateY(24px→0) + scale(0.96→1)
     时长 450ms，bounce 缓动，支持延迟

退场：opacity 1→0 + translateY(0→-10px) + scale(1→0.99)
     时长 160–180ms，accelerate 缓动

交错入场（Stagger）：每个子元素延迟 index × 55ms
     时长 420ms，bounce 缓动
```

页面导航流程：
1. 旧页面所有子元素并行退场（180ms）
2. 等待所有退场动画完成
3. 清空容器，渲染新页面
4. 新页面自行触发入场动画

#### Ripple（水波纹）

```
触点为中心扩散圆形
opacity: 0.2 → 0
scale: 0 → 1
时长 500ms，standard 缓动
完成后自动移除 DOM
```

绑定目标：`.btn`、`.clickable` 元素

#### Modal 动画

```
遮罩：background rgba(0,0,0,0 → 0.5)，300ms
面板：opacity 0→1 + scale(0.85→1) + translateY(24px→0)
     时长由 JS 控制，decelerate 缓动
```

#### Bottom Sheet 动画

```
遮罩：background rgba(0,0,0,0 → 0.4)，300ms
面板：translateY(100% → 0)，300ms，decelerate 缓动
```

#### Toast

```
入场：opacity 0→1 + translateY(20px→0)，350ms spring
退场：opacity 1→0 + translateY(0→20px)，300ms
显示时长：2500ms
```

### 2.4 CSS Keyframe 动画目录

| 动画名 | 位置 | 用途 | 风格 |
|--------|------|------|------|
| `slideUpIn` | profile banner | 底部横幅滑入 | 0.3s decelerate |
| `chipIn` | 标签胶囊 | 标签插入弹出 | 200ms spring，scale(0.8→1) |
| `skeleton-pulse` | 骨架屏 | 加载占位呼吸 | 1.5s 循环，opacity 1↔0.4 |
| `tk-shimmer` | 评论区骨架屏 | 流光扫过 | 1.5s，gradient position 位移 |
| `forum-slide-down` | 论坛帖子 | 内容展开 | max-height 0→300px + translateY |
| `forum-fade-in` | 论坛帖子 | 内容淡入 | translateY(6px→0) |
| `heart-pop` | 点赞按钮 | 爱心弹跳 | 0.35s spring，scale 1→1.4→0.9→1 |
| `spin` | 上传指示器 | 旋转加载 | 无限循环 |
| `coin-flip` | 百宝箱-抛硬币 | 硬币翻转 | 0.8s，Y轴旋转 1440° |
| `dice-shake` | 百宝箱-骰子 | 骰子抖动 | 0.5s，多方向位移+旋转 |
| `box-open` | 百宝箱-盲盒 | 开盒弹跳 | 0.5s spring，scale+rotate 组合 |
| `answer-appear` | 百宝箱-答案之书 | 结果浮现 | 0.5s spring，translateY+scale |
| `answer-text-in` | 百宝箱-答案之书 | 文字弹入 | 0.6s spring，scale(0.8→1.05→1) |
| `wf-bump` | 百宝箱-木鱼 | 敲击反馈 | 0.15s，scale(1→0.9→1) |
| `wf-float-up` | 百宝箱-木鱼 | 功德数字飘升 | 0.8–1.2s decelerate，translateY 上升+淡出 |
| `fp-reveal` | 百宝箱-运势 | 签文揭示 | 0.35s spring，translateY(8px→0) |
| `tb-expand-in` | 百宝箱-卡片展开 | 卡片放大 | scale(0.92→1) |
| `search-ai-pulse` | AI搜索 | 搜索图标脉冲 | 2s 循环，scale(1↔1.08)+opacity |
| `search-ai-bounce` | AI搜索 | 思考点弹跳 | 0.8s 循环，scale(0.6↔1.2) |
| `drop-pulse` | 上传区域 | 拖拽区脉冲提示 | 1s 循环 |

### 2.5 交互微动效规范

#### Hover 态
- **卡片**：`box-shadow` 从无到 shadow-2 + `translateY(-2px)` + 边框变主色，250–350ms standard
- **按钮**：背景加深 10% + shadow-2 出现，250ms standard
- **导航项**：背景切换为 `surface-container-high` + 颜色加深 + 图标 `scale(1.1)`，250ms standard
- **表格行**：背景切换为 `primary-container`，250ms standard
- **列表项**：背景微变，120–250ms standard

#### Active / Press 态
- **按钮**：`scale(0.97)`，120ms spring
- **卡片**：`scale(0.995)` + `translateY(0)`（回弹），120ms
- **导航项**：`scale(0.97)`，120ms spring
- **图标按钮**：`scale(0.9–0.92)`，120ms spring
- **木鱼/头像**：`scale(0.9–0.95)`，100–150ms standard

#### 选中态切换
- **导航项 active**：背景变 `primary-container` + shadow-1 出现
- **标签页 active**：底部指示条 `scaleX(0→1)` + 文字变主色 + font-weight 变 600
- **Toggle Switch**：背景从 `outline`（灰）变为 `primary`（蓝），滑块右移 20px，200ms

#### 展开/收起
- **论坛编辑器**：`forum-slide-down`，max-height + translateY 组合
- **选择器下拉**：`display: none → block`，菜单从触发点下方展开
- **评论区**：子回复通过 `forum-fade-in` 逐条出现

### 2.6 JS 动画引擎设计原则

（定义于 [public/js/core/router.js](public/js/core/router.js#L10-L54) 和 [public/js/components/ui.js](public/js/components/ui.js#L10-L16)）

1. **Web Animations API**（`element.animate()`）而非 CSS transition 实现页面级动画
2. **Promise-based 编排**：`animOut().finished` 等待退场完成后再渲染新内容
3. **交错延迟**：`animStagger()` 对数组元素自动分配递增延迟
4. **缓动常量双轨维护**：CSS 变量（供样式表引用）+ JS 常量（供 animate() 调用）
5. **回声洞打字机动画**：分段乱码→解码算法（35ms 吐出 + 30ms 解码 + 60ms 段间停顿），纯 JS 实现

### 2.7 性能约束

- 动画属性限制在 `transform`、`opacity`（GPU 加速，避免 layout thrashing）
- 使用 `will-change: transform, opacity` 标记将要动画的元素（Modal）
- Ripple 使用 `will-change: transform, opacity`
- 无限循环动画（skeleton-pulse、shimmer）在数据加载完成后立即移除 DOM
- 冷却机制：评论 30 秒冷却、回声洞点击冷却（persist 到 localStorage）

---

## 三、设计原则总结

1. **克制优于丰富** — 不超过 3 个品牌色，不超过 2 层阴影深度，不加渐变
2. **一致优于个性** — 所有输入框统一 MD3 Outlined，所有按钮统一 pill，间距统一 4px 网格
3. **清晰优于花哨** — 动画服务于功能理解（从哪里来、到哪里去），不单纯装饰
4. **弹性而不弹跳** — spring/bounce 缓动带来愉悦感但不过度，active 态用 scale 微缩不用颜色跳变
5. **分层而不堆叠** — 用容器颜色六级梯度（lowest → highest）替代多层阴影表达层级
6. **触控优先** — 所有交互元素 ≥44px 点击区域，`-webkit-tap-highlight-color: transparent`

---

> 相关文件：
> - 设计 Token 定义：[public/css/style.css](public/css/style.css#L6-L84)
> - 组件规范：[rules](rules)
> - 动画引擎：[public/js/core/router.js](public/js/core/router.js#L10-L54)
> - UI 组件工厂：[public/js/components/ui.js](public/js/components/ui.js)
