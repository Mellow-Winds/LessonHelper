# 🐛 BUG 待修复清单

> 审查日期：2026-06-02
> 涵盖：全部后端路由 + 全部前端页面模块
> 状态：全部已修复（2026-06-02）

---

## 🔴 严重 BUG（影响功能正常使用）— 全部已修复 ✅

### BUG-01: `routes/materials.js` 路由顺序错误 — 评分接口 404 ✅
- **文件**: `routes/materials.js:116-167`
- **问题**: `GET /:id` 定义在 `POST /:id/rate` 之前，导致评分请求返回 404。
- **修复**: 将 `POST /:id/rate`、`DELETE /:id`、`GET /:id/download` 移到 `GET /:id` 之前。

### BUG-02: 帖子评论表单 input 缺少 `name` 属性 — 回复功能失效 ✅
- **文件**: `public/js/pages/courses/my_courses.js:1001`
- **问题**: `createMdInput` 没有传 `name` 参数，`handleAddComment` 通过 `e.target.content` 取值为 `undefined`。
- **修复**: 在 `createMdInput` 调用中加上 `name: 'content'`。

### BUG-03: 自习邀约发布页课程名显示 "undefined" ✅
- **文件**: `public/js/pages/explore/posts.js:270`
- **问题**: `c.name || c.course_name` 但后端返回 `c.title`。
- **修复**: 改为 `c.title || ...`。

### BUG-04: 搜索分页不生效 ✅
- **文件**: `routes/search.js:16-27`
- **问题**: `offset` 已计算但未在 SQL 中使用，翻页永远返回第一页。
- **修复**: 4 个搜索 SQL 都加上 `LIMIT ? OFFSET ?`。

### BUG-05: `handle401` 强制 `res.json()` — 非 JSON 响应导致前端报错 ✅
- **文件**: `public/js/core/api.js:14-20`
- **问题**: 对所有响应都调用 `.json()`，204 等非 JSON 响应会抛 `SyntaxError`。
- **修复**: 先检查 `content-type` 是否包含 `json`，否则用 `res.text()` + `JSON.parse`。

---

## 🟡 中等 BUG（影响体验或数据一致性）— 全部已修复 ✅

### BUG-06: 个人资料编辑 textarea maxlength 与后端校验不一致 ✅
- **文件**: `public/js/pages/profile.js:953`
- **问题**: 前端 `maxlength="200"`，后端限制 80 字。
- **修复**: 前端 textarea 改为 `maxlength="80"`。

### BUG-07: 注册成功但邮件发送失败时，请求挂起 ✅
- **文件**: `routes/auth.js:77-86`
- **问题**: `.then()` 无 `.catch()` 处理。
- **修复**: 路由改为 `async`，用 `await + try/catch` 替代 `.then()`。

### BUG-08: 注册时用户先入库再发验证码 ✅
- **文件**: `routes/auth.js:69-90`
- **问题**: 用户 INSERT 在验证码发送之前，发送失败留下脏数据。
- **修复**: 改为先发验证码，成功后再写库。

### BUG-09: 自习邀约创建者被重复计入参与人数 ✅
- **文件**: `routes/invites.js:29-33`
- **问题**: `max_participants` 检查包含创建者，实际可加入人数少 1。
- **修复**: 检查改为 `count.cnt >= invite.max_participants - 1`。

### BUG-10: sql.js 事务不生效 ✅
- **文件**: `routes/schedule.js:151-185`
- **问题**: `db.run('BEGIN TRANSACTION')` 在 sql.js 中是 no-op。
- **修复**: 改用 `db.db.run('BEGIN')` 操作底层对象。

### BUG-11: `auth.js` 注册接口未校验 `major`/`grade` 参数 ✅
- **文件**: `routes/auth.js:25-26`
- **问题**: 无长度限制，恶意用户可提交超长字符串。
- **修复**: 添加 `major.length <= 50`、`grade.length <= 20` 校验。

### BUG-12: 签到逻辑 `daysDiff` 计算有时差风险 ✅
- **文件**: `routes/auth.js:279-281`
- **问题**: `new Date().toISOString()` 用 UTC 时间，UTC+8 深夜签到日期可能偏移。
- **修复**: 改用 `toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })`。

---

## 🟢 轻微 BUG（不影响主要功能）— 全部已修复 ✅

### BUG-13: 搜索历史 XSS 风险 ✅
- **文件**: `public/js/pages/auth.js:573`
- **问题**: `onclick` 内联字符串拼接，转义不充分。
- **修复**: 改用事件委托 + `data-q` 属性，避免内联 onclick。

### BUG-14: 广场帖子的 `tags`/`show_profile`/`contact_visibility` 字段被丢弃
- **状态**: 前端已有字段，后端忽略不影响功能，无需修复。

### BUG-15: 广场帖子详情不检查帖子是否已过期 ✅
- **文件**: `routes/square.js:80-130`
- **问题**: 过期帖子仍可查看详情和提交申请。
- **修复**: 详情接口加 `expires_at` 检查，过期时标记 `status: 'expired'`。

### BUG-16: `migrateTable` 中 SQL 存在理论上的注入风险
- **状态**: 参数都是硬编码常量，暂无实际风险，已加注释说明。

### BUG-17: `my_courses.js` 的 `loadedComments` 缓存不清理 ✅
- **文件**: `public/js/pages/courses/my_courses.js:961`
- **问题**: 切换课程后旧缓存仍在内存中。
- **修复**: 进入课程详情页时重置 `loadedComments = {}`。

### BUG-18: `explore.js` 的子模块缓存可能导致过期数据
- **状态**: 模块内无持久缓存，影响不大，暂不处理。

### BUG-19: 课程广场详情页用数组索引作路由 data ✅
- **文件**: `public/js/pages/courses/plaza.js:166-169`
- **问题**: 搜索后索引对应过滤后列表，详情页用原始列表，可能显示错误课程。
- **修复**: 改用 `courseId` 作为路由参数，兼容旧版索引。

### BUG-20: `favorite-btn` 的 `lastChild.textContent` 可能取到空白节点 ✅
- **文件**: `public/js/pages/favorites.js:43`
- **问题**: 按钮 HTML 中换行导致 `lastChild` 是空白文本节点。
- **修复**: 加 `<span class="favorite-label">`，用 `querySelector` 取值。

### BUG-21: 关注动态页面事件监听器累积 ✅
- **文件**: `public/js/pages/following_feed.js:22`
- **问题**: 每次渲染都叠加相同事件监听器。
- **修复**: 加 `container._feedBound` 防重复绑定。

---

## 📊 统计

| 严重度 | 数量 | 已修复 | 无需修复 |
|--------|------|--------|----------|
| 🔴 严重 | 5 | 5 | 0 |
| 🟡 中等 | 7 | 7 | 0 |
| 🟢 轻微 | 9 | 6 | 3 |
| **合计** | **21** | **18** | **3** |
