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
> 最后更新：2026-05-31

---

## 维护记录：UI 细节修复 ✅

**目标**：修正 MD3 输入框缺口宽度与复合按钮图标基线偏移

- [x] 输入框浮起 Label 改用真实 `font-size: 0.75rem`，避免 `transform: scale()` 导致 legend 缺口物理宽度失真
- [x] `legend span` 同步为 `0.75rem`，让可见 Label 与边框断口宽度一致
- [x] `.mi` 图标盒改为固定 `1em` 的 `inline-flex`
- [x] 导航项与按钮分别加入 `--mi-y` 基线补偿，并保留 hover/active 缩放动效
- [x] Label 增加容器同色背景遮罩，避免聚焦描边穿过文字
- [x] MD 输入框统一强制 `placeholder=" "`，由纯 CSS `:not(:placeholder-shown)` / `:autofill` 接管浮起态
- [x] 增加 autofill 状态选择器，刷新后浏览器自动填充值也能在首帧顶起 Label

**验证**：本地服务 200；CSS 资源已包含新规则

---

## 第7轮：隐私设置 + QQ 号 ✅

**目标**：个人资料扩展，隐私控制基础设施

- [x] `server.js`：users 表新增 `qq`、`privacy_show_profile`、`privacy_allow_match` 字段
- [x] `routes/auth.js`：GET/PUT `/me` 支持 qq 和隐私字段
- [x] `routes/courses.js`：成员列表返回 qq，`privacy_show_profile=0` 时隐藏敏感信息
- [x] `app.js`：个人中心增加 QQ 展示和隐私开关，编辑资料增加 QQ 输入，成员侧栏显示 QQ（可复制）
- [x] `style.css`：toggle-switch 开关组件和 privacy-toggle-row 样式

**验证**：注册→编辑资料填 QQ→保存→刷新后 QQ 仍在；关闭隐私开关→成员列表隐藏敏感信息
