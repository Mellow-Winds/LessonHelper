# 课搭子 — 分步开发计划

## 总原则

- **小步快跑**：每轮只改1-3个文件，改完立即测试
- **先后端后前端**：API 先用 curl 测通，再做页面
- **每步可运行**：`node server.js` 不能崩
- **每轮提交 Git**

---

## 第1轮：认证系统后端 ✅

**目标**：邮箱验证码注册 + 密码登录，JWT Token

- [x] 安装 `jsonwebtoken`、`bcryptjs`、`resend`
- [x] `server.js`：users 表迁移（email, email_verified, verification_code 等8个新列）
- [x] 创建 `routes/middleware/auth.js`（JWT 中间件）
- [x] 创建 `routes/middleware/email.js`（Resend 邮件服务）
- [x] 创建 `routes/auth.js`（6个端点）
- [x] curl 全流程测试通过

**验证结果**：注册 → 验证码错误拒绝 → 正确验证码通过 → 登录成功 → JWT 查个人信息成功

---

## 第2轮：课程系统后端改造 ✅

**目标**：课程支持多人选课，有成员列表

- [x] `server.js`：user_courses 表 + courses 加 semester、teacher（第1轮已完成）
- [x] `routes/courses.js`：认证保护、创建者从 JWT 提取、成员列表、加入课程、帖子评论
- [x] `routes/user.js`：移除 /register，通过 user_courses 查用户课程
- [x] curl 全流程测试通过

**验证结果**：创建课程→自动加入→成员列表→发帖→评论→未认证拦截→公开信息不含密码

---

## 第3轮：前端认证系统 ✅

**目标**：前端能登录注册，状态持久化

- [x] `public/js/app.js`：完全重写，加入认证状态管理、JWT Token 持久化
- [x] API 封装：`apiGet`/`apiPost`/`apiPut` 自动附加 Authorization header
- [x] 登录/注册页面：tab 切换、邮箱验证码流程、表单验证、错误提示
- [x] 个人中心：登录后显示信息（头像/昵称/专业/年级）、编辑资料弹窗、退出登录
- [x] Toast 通知系统（替换 alert）
- [x] `public/index.html`：品牌名改为"课搭子"
- [x] `public/css/style.css`：新增 auth-tabs、form-field、avatar、info-chip、toast 样式
- [x] 全栈验证通过：注册→验证→登录→API调用，前后端协同工作

**验证结果**：页面加载正确、静态文件200 OK、注册登录全流程通过

---

## 第4轮：课程列表页前端 ✅

**目标**：浏览、创建、加入课程

- [x] `public/js/app.js`：课程卡片列表（标题/教师/学期/选课人数）
- [x] 创建课程弹窗（标题/教师/学期/描述）
- [x] 课程空状态友好提示
- [x] `public/css/style.css`：已有卡片样式

**验证**：课程列表正确展示、创建课程弹窗可用

---

## 第5轮：课程空间页（论坛）前端 ✅

**目标**：课程详情 = 论坛，发帖评论看成员

- [x] `public/js/app.js`：课程空间页面（课程信息 + 帖子列表 + 成员侧栏）
- [x] 帖子列表 + 发帖弹窗
- [x] 评论展开/收起 + 发评论
- [x] 成员侧栏（头像/昵称/专业/年级）
- [x] 已登录/未登录状态区分

**验证**：进课程空间 → 帖子列表 → 发帖 → 展开评论 → 发评论 → 成员列表

---

## 第6轮：打磨收尾 ✅

**目标**：品牌统一、体验优化

- [x] `public/index.html`：品牌名改为"课搭子"
- [x] Toast 通知系统（替换 alert）
- [x] 空状态/错误状态/加载状态处理
- [x] 「加入课程」按钮 + "已加入"标记
- [x] 验证码开发模式下直接页面显示
- [x] 更新 README.md

**验证**：全流程可用

---

## ✅ MVP 6轮全部完成！

> 当前进度：6/6 完成
> 最后更新：2026-05-30
