# FOUC 问题分析报告

> 创建时间：2026-06-03
> 状态：待处理
> 严重程度：中等（影响首屏体验）

---

## 问题描述

打开网站瞬间出现 **FOUC（Flash of Unstyled Content）**，即页面短暂显示未样式化内容后才闪现正常样式。

---

## 根因分析

### 🔴 根因 1：外部 CDN 资源同步阻塞渲染（最主要）

**文件**：[index.html:9-18](public/index.html#L9-L18)

```html
<!-- 以下资源全部同步加载，任一卡顿都会阻塞整个页面 -->
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet">
<link href="https://unpkg.com/@material/web@2.3.0/dist/md.theme.css" rel="stylesheet">
<script type="module" src="https://unpkg.com/@material/web@2.3.0/button/filled-button.js?module"></script>
<script type="module" src="https://unpkg.com/@material/web@2.3.0/button/outlined-button.js?module"></script>
<script type="module" src="https://unpkg.com/@material/web@2.3.0/icon/icon.js?module"></script>
<script src="https://unpkg.com/motion@11.18.2/dist/motion.js"></script>
```

**问题**：
- `fonts.googleapis.com` 在中国大陆可能被墙或极慢（DNS 污染、连接超时）
- `unpkg.com` 在国内访问不稳定
- 3 个外部 CSS 用 `<link>` 同步加载，会 **阻塞渲染树构建**
- 浏览器必须等所有 CSS 下载完成才开始首次绘制

**影响**：白屏时间延长，CSS 加载完成后整体闪现。

---

### 🔴 根因 2：Material Icons 字体闪烁

**文件**：[style.css:140-161](public/css/style.css#L140-L161)

```css
.mi {
  font-family: 'Material Icons Round';
  /* ... */
}
```

**问题**：
- Material Icons 通过 Google Fonts 加载，属于 Web Font
- 字体加载前，图标显示为空白或回退字符
- 字体加载完成后瞬间切换，造成 **布局抖动 + 内容闪烁**
- 未设置 `font-display` 策略（Google Fonts 默认 `swap`）

---

### 🟡 根因 3：自定义元素注册延迟

**文件**：[style.css:84-88](public/css/style.css#L84-L88)

```css
/* ---- FOUE Guard: hide unregistered custom elements ---- */
:not(:defined) {
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}
```

**问题**：
- 已有 FOUC 防护（`:not(:defined)` 隐藏未注册元素），但 Material Web Components 从 CDN 加载
- CDN 慢时，自定义元素注册时间延长，页面内容区域为空
- 注册完成后 opacity 从 0 变 1，仍然有视觉跳变

---

### 🟡 根因 4：JS 动态渲染页面内容

**文件**：[main.js:279](public/js/main.js#L279)

```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 页面内容在此动态渲染
});
```

**问题**：
- `main.js` 使用 `type="module"` 加载（默认 defer）
- 页面内容（侧边栏高亮、主区域）依赖 JS 渲染
- JS 未执行完成前，HTML 中的默认状态可能与最终状态不一致
- `DOMContentLoaded` → 异步渲染 → 内容闪现

---

### 🟢 根因 5：CSS 加载位置

**文件**：[index.html:22](public/index.html#L22)

```html
<link rel="stylesheet" href="/css/style.css">
```

**问题**：
- 自己的 `style.css` 在 head 末尾加载
- 前面有 3 个外部 CSS 阻塞，本地 CSS 解析被延后
- 如果外部资源超时，本地样式也会被延迟应用

---

## 解决方案

### 方案 A：内联关键 CSS（推荐，解决根因 1 + 5）

将首屏必需的 CSS（布局、背景色、字体、侧边栏）直接内联到 `<head>` 的 `<style>` 标签中：

```html
<head>
  <style>
    /* 关键路径 CSS：确保首屏有基本样式 */
    :root { --md-surface: #F9F9FF; --md-on-surface: #1A1B21; /* ... */ }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body { background-color: var(--md-surface); color: var(--md-on-surface); display: flex; }
    .sidebar { width: 240px; /* ... */ }
    .main-content { flex: 1; /* ... */ }
    :not(:defined) { opacity: 0; }
  </style>
  <!-- 外部资源改为异步加载 -->
</head>
```

**效果**：首屏立即有正确的背景色和布局，不再白屏。

---

### 方案 B：外部资源异步/延迟加载（解决根因 1）

```html
<!-- CSS 用 preload + onload 异步加载 -->
<link rel="preload" href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet"></noscript>

<!-- 或者使用 media="print" trick -->
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" media="print" onload="this.media='all'">
```

**效果**：外部 CSS 不再阻塞渲染，页面立即绘制。

---

### 方案 C：本地托管字体文件（解决根因 1 + 2）

将 Material Icons 和 Remix Icon 的字体文件下载到本地：

```
public/
├── fonts/
│   ├── material-icons-round.woff2
│   └── remixicon.woff2
```

```css
@font-face {
  font-family: 'Material Icons Round';
  src: url('/fonts/material-icons-round.woff2') format('woff2');
  font-display: swap;
}
```

**效果**：彻底消除外部 CDN 依赖，字体加载更快更稳定。

---

### 方案 D：font-display 控制字体闪烁（解决根因 2）

通过 Google Fonts API 添加 `font-display` 参数：

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round&display=block" rel="stylesheet">
```

- `block`：短暂隐藏文本，等待字体加载（适合图标）
- `fallback`：短暂使用回退字体，快速切换
- `optional`：完全由浏览器决定是否使用自定义字体

---

### 方案 E：骨架屏 / Loading 状态（解决根因 3 + 4）

在 HTML 中预设骨架屏，JS 渲染完成后替换：

```html
<main class="main-content" id="main-content">
  <div class="skeleton-loader">
    <div class="skeleton-sidebar"></div>
    <div class="skeleton-content"></div>
  </div>
</main>
```

**效果**：JS 加载期间显示占位内容，避免空白区域突然出现。

---

### 方案 F：预连接 + DNS 预解析（缓解根因 1）

```html
<head>
  <!-- 预建立连接，减少 DNS + TLS 握手时间 -->
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://unpkg.com" crossorigin>
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
</head>
```

**效果**：提前建立连接，减少外部资源加载延迟。

---

## 推荐实施顺序

| 优先级 | 方案 | 效果 | 工作量 |
|--------|------|------|--------|
| ⭐⭐⭐ | A + B | 消除白屏，首屏立即有内容 | 中 |
| ⭐⭐ | F | 预连接，减少延迟 | 低 |
| ⭐⭐ | E | 骨架屏改善感知体验 | 中 |
| ⭐ | C | 本地字体，彻底解决 CDN 问题 | 高 |
| ⭐ | D | 字体闪烁细节优化 | 低 |

---

## 验证方法

1. Chrome DevTools → Network → Throttling → Slow 3G 模拟慢网速
2. Chrome DevTools → Performance → 录制页面加载过程
3. Lighthouse → Performance 评分
4. 清空缓存后多次刷新观察首屏表现

---

## 相关文件

- [public/index.html](../public/index.html) — HTML 入口，外部资源加载
- [public/css/style.css](../public/css/style.css) — 主样式文件
- [public/js/main.js](../public/js/main.js) — JS 入口，DOMContentLoaded 渲染
