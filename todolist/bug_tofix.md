# 🐛 BUG 待修复清单

> 审查日期：2026-06-02
> 涵盖：全部后端路由 + 全部前端页面模块

---

## 🔴 严重 BUG（影响功能正常使用）

### BUG-01: `routes/materials.js` 路由顺序错误 — 评分接口 404
- **文件**: `routes/materials.js:116-167`
- **问题**: `GET /:id`（第116行）定义在 `POST /:id/rate`（第145行）之前。Express 路由匹配是按定义顺序的，`/materials/123/rate` 会先被 `/:id` 匹配（id=`123`, 后面的 `/rate` 被忽略），导致评分请求返回 404 "资料不存在"。
- **修复**: 将 `POST /:id/rate` 路由移到 `GET /:id` **之前**。同理 `DELETE /:id` 也需要前移。

### BUG-02: 帖子评论表单 input 缺少 `name` 属性 — 回复功能失效
- **文件**: `public/js/pages/courses/my_courses.js:1001`
- **问题**: `createMdInput` 没有传 `name` 参数，生成的 `<input>` 没有 `name="content"` 属性。但 `handleAddComment`（第1017行）通过 `e.target.content` 取值，取到的是 `undefined`，导致回复永远为空被拦截。
- **修复**: 在 `createMdInput` 调用中加上 `name: 'content'`。

### BUG-03: 自习邀约发布页课程名显示 "undefined"
- **文件**: `public/js/pages/explore/posts.js:270`
- **问题**: `c.name || c.course_name || ...` — 但后端 `/api/courses` 返回的字段是 `c.title`，不是 `c.name` 或 `c.course_name`。导致关联课程下拉全部显示 "undefined"。
- **修复**: 改为 `c.title || ...`。

### BUG-04: 搜索分页不生效
- **文件**: `routes/search.js:16-27`
- **问题**: `offset` 在第16行已计算，但 SQL 查询参数中没有使用它。所有搜索查询只传了 `limit` 没传 `offset`，翻页永远返回第一页。
- **修复**: 每个搜索类型的 SQL 都加上 `LIMIT ? OFFSET ?`，参数中加入 `offset`。

### BUG-05: `handle401` 强制 `res.json()` — 非 JSON 响应导致前端报错
- **文件**: `public/js/core/api.js:14-20`
- **问题**: `handle401` 对所有响应都调用 `res.json()`，但某些接口可能返回 204 No Content 或非 JSON 响应体，`.json()` 会抛出 `SyntaxError`。
- **修复**: 先判断 `res.headers.get('content-type')` 是否包含 `json`，或用 `res.text()` 再尝试 `JSON.parse`。

---

## 🟡 中等 BUG（影响体验或数据一致性）

### BUG-06: 个人资料编辑 textarea maxlength 与后端校验不一致
- **文件**: `public/js/pages/profile.js:953` vs `routes/auth.js:222`
- **问题**: 编辑页 textarea 的 `maxlength="200"`，但后端 `avatar_desc.length > 80` 校验限制为80字。用户输入81-200字时前端不提示，后端返回400错误。
- **修复**: 前端 textarea 改为 `maxlength="80"`，与后端一致。

### BUG-07: 注册成功但邮件发送失败时，响应不返回（请求挂起）
- **文件**: `routes/auth.js:77-86`
- **问题**: `sendVerificationCode` 是异步的，如果发送失败，第79行 `return res.status(500).json(...)` 是在 `.then()` 回调中。但如果 `.then()` 抛异常或网络问题，外层的 `try/catch` 无法捕获，且没有任何 `catch` 处理。此外，第81行 `console.log` 在发送成功时才执行，但 `res.status(201).json(...)` 也在 `.then()` 里 — 如果 sendVerificationCode 内部 throw 了但没被 catch，请求会永远挂起。
- **修复**: 给 `sendVerificationCode(...).then(...)` 加上 `.catch()` 处理。

### BUG-08: 注册时用户先入库再发验证码 — 验证码发送失败但用户已创建
- **文件**: `routes/auth.js:69-90`
- **问题**: 用户 INSERT 在第69行执行并 `db.save()`（第74行），之后才发验证码（第77行）。如果验证码发送失败返回500，但数据库中已存在未验证用户。下次再注册同邮箱会走"重新发送"逻辑，但用户可能不知道。
- **修复**: 建议先发验证码，成功后再写库。或至少记录状态方便重试。

### BUG-09: 自习邀约创建者被重复计入参与人数
- **文件**: `routes/invites.js:29-33`
- **问题**: 创建邀约时，创建者通过 `INSERT INTO study_invite_responses` 自动加入。之后查看邀约详情时，`participant_count` 子查询统计了所有 `status='accepted'` 的记录，包含创建者。前端显示 "1/4人"，但 `max_participants` 检查（第198行）也包含创建者。这意味着实际只能再加入3人而非4人。
- **修复**: 要么创建者不插入 responses 表（前端单独显示"发起人"），要么 `max_participants` 检查时 +1。

### BUG-10: sql.js 事务不生效 — 课表导入非原子操作
- **文件**: `routes/schedule.js:151-185`
- **问题**: `db.run('BEGIN TRANSACTION')` 和 `db.run('COMMIT')` 在 sql.js WASM 中是 no-op。如果导入中途出错，`db.run('ROLLBACK')` 也不会回滚已执行的 INSERT。实际上所有 `db.run` 都是立即执行的。
- **修复**: sql.js 需要用 `db.db.run('BEGIN')` 直接操作底层对象，或改为收集所有操作后批量执行。

### BUG-11: `auth.js` 注册接口未校验 `major`/`grade` 参数
- **文件**: `routes/auth.js:25-26`
- **问题**: 注册时 `major` 和 `grade` 从 `req.body` 直接取值，没有长度限制或格式校验。恶意用户可以提交超长字符串。
- **修复**: 添加 `major.length <= 50`、`grade.length <= 20` 等校验。

### BUG-12: 签到逻辑 `daysDiff` 计算有时差风险
- **文件**: `routes/auth.js:279-281`
- **问题**: `new Date(user.last_checkin_date)` 和 `new Date(today)` 都是 UTC 时间，但 `today` 来自 `new Date().toISOString().slice(0, 10)` 是 UTC 日期。如果用户在 UTC+8 的 23:30 签到，UTC 时间已经是第二天，`daysDiff` 可能比预期多1天。
- **修复**: 统一使用 UTC+8 时区计算日期，或用 `toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })`。

---

## 🟢 轻微 BUG（不影响主要功能）

### BUG-13: 搜索历史 XSS 风险
- **文件**: `public/js/pages/auth.js:573`
- **问题**: `onclick="navigateTo('search',{q:'${h.replace(/'/g, "\\'")}'})"` — 如果搜索历史包含 `</button><script>alert(1)</script>`，单引号转义不够，可能注入 HTML。
- **修复**: 使用 `escHtml(h)` 或改为事件委托绑定，避免内联 onclick。

### BUG-14: 广场帖子的 `tags`/`show_profile`/`contact_visibility` 字段被丢弃
- **文件**: `routes/square.js:26-30`
- **问题**: 前端发送了 `tags`、`show_profile`、`contact_visibility` 字段，但后端 INSERT 只用了 `title`/`category`/`description`/`max_people`，其他字段被忽略。
- **修复**: 要么后端建表并存储这些字段，要么前端不发送（减少误导）。

### BUG-15: 广场帖子详情不检查帖子是否已过期
- **文件**: `routes/square.js:80-130`
- **问题**: `GET /posts/:id` 不检查 `expires_at`，即使帖子已过期仍可查看详情和提交申请。
- **修复**: 在详情接口中检查过期状态，返回 `status: 'expired'` 标记。

### BUG-16: `migrateTable` 中 SQL 存在理论上的注入风险
- **文件**: `server.js:108-114`
- **问题**: `PRAGMA table_info(${table})` 和 `ALTER TABLE ${table} ADD COLUMN ${col} ${type}` 使用字符串拼接。虽然目前参数都是硬编码常量，但如果未来有人传入用户输入就会有 SQL 注入。
- **修复**: 参数都是常量所以暂无实际风险，但建议加注释说明"仅限硬编码调用"。

### BUG-17: `my_courses.js` 的 `loadedComments` 缓存不清理
- **文件**: `public/js/pages/courses/my_courses.js:961`
- **问题**: `loadedComments[postId]` 在新评论发布后设为 `null`（第1029行），但切换课程后旧缓存仍在内存中，不会自动清理。
- **修复**: 在切换课程详情页时清空 `loadedComments = {}`。

### BUG-18: `explore.js` 的子模块缓存可能导致过期数据
- **文件**: `public/js/pages/explore.js:13-15`
- **问题**: `invitesModule`、`squareModule` 等模块缓存后不会刷新。如果模块内部有状态（如列表缓存），切换 Tab 后可能显示旧数据。
- **修复**: 目前模块内无持久缓存，影响不大。但设计上应注意。

### BUG-19: 课程广场详情页用数组索引作路由 data
- **文件**: `public/js/pages/courses/plaza.js:166-169`
- **问题**: `navigateTo('plaza-course', idx)` 传的是 `_bigCoursesList` 的索引。如果用户在广场搜索后点击结果，索引对应的是过滤后的列表，但详情页用的是原始 `_bigCoursesList`，可能显示错误课程。
- **修复**: 用课程名或第一个 courseId 作为路由参数，而非数组索引。

### BUG-20: `favorite-btn` 的 `lastChild.textContent` 可能取到空白节点
- **文件**: `public/js/pages/favorites.js:43`
- **问题**: `button.lastChild.textContent = favorited ? '已收藏' : '收藏'` — 如果按钮 HTML 中有换行空白，`lastChild` 可能是文本节点而非预期的 `<span>`。
- **修复**: 给文字加一个 `<span class="favorite-label">` 并用 `querySelector` 取值。

### BUG-21: 关注动态页面事件监听器累积
- **文件**: `public/js/pages/following_feed.js:22`
- **问题**: `container.addEventListener('click', handleFeedClick)` 在每次 `renderFollowingFeed` 调用时都执行，但从不移除。如果用户多次切换到"关注动态" Tab，同一个容器上会叠加多个相同的事件监听器，导致点击一次触发多次导航。
- **修复**: 用 `container.removeEventListener` 先移除旧监听器，或用 `{ once: true }` 标志，或在容器上设置 `_feedBound` 防重复绑定（类似 invites.js 的做法）。

### BUG-22: `favorites.js` 的 `lastChild` 取值可能取到空白文本节点
- **文件**: `public/js/pages/favorites.js:43`
- **问题**: `button.lastChild.textContent = favorited ? '已收藏' : '收藏'` — 按钮 HTML 模板中 `<span class="mi">` 和文字之间有换行，`lastChild` 可能是空白文本节点而非文字节点，导致修改无效。
- **修复**: 给文字加 `<span class="favorite-label">`，用 `querySelector` 取值。

---

## 📊 统计

| 严重度 | 数量 |
|--------|------|
| 🔴 严重 | 5 |
| 🟡 中等 | 7 |
| 🟢 轻微 | 10 |
| **合计** | **22** |

---

## 优先修复建议

1. **BUG-01** — materials 路由顺序（评分功能完全不可用）
2. **BUG-02** — 评论表单 name 属性（回复功能完全不可用）
3. **BUG-03** — 邀约课程名 undefined（发布体验很差）
4. **BUG-04** — 搜索分页（结果被截断）
5. **BUG-06** — avatar_desc 长度前后端不一致
