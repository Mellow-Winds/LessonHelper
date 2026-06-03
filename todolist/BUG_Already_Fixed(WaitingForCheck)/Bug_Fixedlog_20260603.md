# Bug 修复日志 — 2026-06-03

> 修复人：Claude (AI 辅助)
> 状态：已修复，待验证

---

## Bug 1：我的课程界面学期筛选失效

**问题描述**：学期筛选下拉菜单无法触发课程列表更新。

**根因分析**：
- **核心原因**：`ui.js` 中 `CustomEvent` 构造时缺少 `bubbles: true`，导致 `md-select-change` 事件仅在 `.md-select-container` 上触发，**不冒泡**到父元素 `#my-semester-filter-wrap`
- 父元素上的 `addEventListener('md-select-change', ...)` 永远收不到事件
- 次要问题：事件监听器被添加两次（初始渲染 + API 返回后重新渲染），导致潜在的重复调用
- 次要问题：选择"全部年份" + 指定学期类型时，`combineYearSemester('all', '1')` 返回 `'all-1'`，后端无法匹配

**修复方案**：
1. **核心修复** `public/js/components/ui.js`：
   - `CustomEvent` 构造添加 `bubbles: true`，使事件能冒泡到父元素
2. **前端** `public/js/pages/courses/my_courses.js`：
   - 移除重复的事件监听器（API 返回后不再重新绑定）
   - `loadMyCourseList()` 增加 `year='all' + type≠'all'` 分支，发送 `?type=X` 请求
   - 课程卡片优先使用 `enrolled_semester_key` 显示学期标签
3. **后端** `routes/courses.js`：
   - 新增 `type` 查询参数支持，使用 `LIKE '%-X'` 匹配
   - SELECT 中增加 `uc.semester_key AS enrolled_semester_key`

**修改文件**：
- [public/js/components/ui.js](public/js/components/ui.js) — CustomEvent 添加 bubbles: true
- [public/js/pages/courses/my_courses.js](public/js/pages/courses/my_courses.js) — 移除重复监听 + 修复筛选逻辑
- [routes/courses.js](routes/courses.js) — 新增 type 筛选参数 + 返回 enrolled_semester_key

---

## Bug 2：缩放致弹窗内容物理截断

**问题描述**：浏览器 150% 缩放或小屏设备下，弹窗内容溢出容器被截断，无法滚动。

**根因分析**：
- `.modal` 和 `.modal-body` 设置了 `overflow: visible !important`
- 虽然 `.modal` 有 `max-height: 80vh`，但 `overflow: visible` 导致内容不被裁剪，视觉上溢出弹窗边界
- `.modal-body` 缺少 `flex: 1; min-height: 0;`，在 flex 列布局中无法正确收缩产生滚动

**修复方案**：
1. `.modal`：`overflow: visible !important` → `overflow: hidden`
2. `.modal-body`：`overflow: visible !important` → `overflow-y: auto; flex: 1; min-height: 0;`

**修改文件**：
- [public/css/style.css](public/css/style.css) — 弹窗溢出修复

---

## Bug 3：资料筛选栏组件高度不对齐 + 下拉文字截断

**问题描述**：
1. 资料筛选栏中搜索框、下拉菜单、上传按钮高度不一致
2. 排序下拉显示"最新..."被截断，尽管有足够空间
3. 搜索输入框的 `.md-border` 有 `top: -5px` 导致视觉边框比其他组件高 5px

**根因分析**：
- 旧的 `.material-filter-bar` CSS 覆盖了基础组件样式（40px），与其他页面不一致
- 排序下拉宽度不足（140px），加上自定义 CSS 覆盖 padding 导致文字截断
- 搜索输入框使用浮动标签 + `.md-border` 绝对定位，在筛选栏场景下视觉不对齐
- `.replace()` 字符串替换修改类名的方式脆弱且难以维护

**修复方案**：不破不立，完全重构资料筛选栏
1. **删除旧 CSS**：移除所有 `.material-filter-bar` 的自定义高度/圆角/padding 覆盖
2. **重写 HTML**：布局改为「类型下拉 → 排序下拉 → 搜索输入框 → 搜索按钮 → 上传按钮」
   - 使用 `createMdSelect` / `createMdInput` 标准组件，不做任何类名替换
   - 所有组件使用基础 56px 高度，与搜索页/表单页完全一致
   - 类型下拉 120px，排序下拉 130px（足以显示"最新上传"），搜索框 flex:1
   - 搜索输入框支持 Enter 键触发搜索
3. **精简 CSS**：`.material-filter-bar` 仅保留 `display:flex; align-items:center; gap:8px` + 移动端换行规则

**修改文件**：
- [public/css/style.css](public/css/style.css) — 删除旧筛选栏 CSS，重写为极简 flex 容器
- [public/js/pages/courses/detail.js](public/js/pages/courses/detail.js) — 重构筛选栏 HTML

---

## Bug 4：FOUC（Flash of Unstyled Content）

**问题描述**：打开网站瞬间出现未样式化内容闪烁，首屏白屏时间长。

**根因分析**：
- 外部 CDN 资源同步加载阻塞渲染树构建
- `fonts.googleapis.com` 在中国大陆可能被墙或极慢
- 本地 `style.css` 被前面的外部 CSS 阻塞解析

**修复方案**（方案 A + B + F 组合）：
1. 内联关键 CSS 到 `<head>` 的 `<style>` 标签
2. 外部 CSS 使用 `preload + onload` 异步加载
3. 添加 `preconnect` 和 `dns-prefetch` 预连接
4. motion.js 和 markdown-it 添加 `defer`

**修改文件**：
- [public/index.html](public/index.html) — 内联关键 CSS + 异步加载外部资源 + 预连接

---

## 验证清单

- [ ] Bug 1：学期筛选下拉能正常触发课程列表更新
- [ ] Bug 1：选择"全部年份"+"第一学期"能正确筛选出所有年份的第一学期课程
- [ ] Bug 2：浏览器 150% 缩放下，弹窗内容可正常滚动，不溢出
- [ ] Bug 2：移动端弹窗（底部抽屉）滚动行为正常
- [ ] Bug 3：资料筛选栏五个组件（类型、排序、搜索、搜索按钮、上传）高度一致（56px）
- [ ] Bug 3：排序下拉完整显示"最新上传"/"评分最高"/"下载最多"，不截断
- [ ] Bug 3：搜索输入框与其他组件水平对齐，无上下偏移
- [ ] Bug 3：搜索输入框支持按 Enter 键触发搜索
- [ ] Bug 3：移动端筛选栏正确换行
- [ ] Bug 4：首次访问时首屏有正确的背景色和侧边栏布局，无白屏闪烁
- [ ] 回归：搜索页/课程广场搜索栏正常工作
- [ ] 回归：所有弹窗功能正常
- [ ] 回归：所有下拉菜单功能正常
