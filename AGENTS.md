# AGENTS.md — 课搭子 项目指南

## 项目概述

**课搭子**（LessonHelper）是一个面向大学生的同课程学习互助平台。当前处于 MVP 第一阶段，聚焦三个核心功能：用户系统、课程界面、课程空间论坛。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express 4.x + SQLite (sql.js WASM) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |
| 前端 | 原生 JavaScript SPA + Material Design 3 |
| 样式 | 自定义 CSS（遵循 themerules 设计规范） |

## 项目结构

```
Lessonhelper/
├── server.js              # Express 入口，数据库初始化，路由挂载
├── package.json           # 依赖配置
├── themerules             # 前端设计规范（颜色/排版/间距/组件）
├── AGENTS.md              # 本文件 — 项目指南
├── docs/                  # 📚 项目文档
│   ├── requirements.md    #   开发需求文档
│   ├── tech-spec.md       #   技术规范（数据库/API/安全）
│   ├── design-spec.md     #   设计规范（页面布局/组件风格）
│   ├── development-steps.md # 分步开发计划（当前进度 + 待办）
│   └── api-spec.md        #   API 接口规范
├── devlog/                # 📝 开发日志（每天一个文件）
│   └── YYYY-MM-DD.md
├── db/                    # SQLite 数据库文件
├── routes/                # 后端路由
│   ├── courses.js         #   课程/帖子/评论 API
│   ├── user.js            #   用户 API
│   ├── schedule.js        #   课表导入 API
│   ├── middleware/         #   中间件（auth.js）
│   └── auth.js            #   认证 API
├── public/                # 前端静态文件
│   ├── index.html         #   SPA 入口
│   ├── css/style.css      #   样式
│   └── js/                #   客户端逻辑（ES6 Modules）
│       ├── main.js        #     全局入口
│       ├── core/          #     api.js + router.js
│       ├── components/    #     ui.js
│       └── pages/         #     auth.js / profile.js / courses.js / square.js
└── uploads/               # 上传文件存储（未来使用）
```

## 文档索引

| 需求 | 看这里 |
|------|--------|
| 产品要做什么功能 | [docs/requirements.md](docs/requirements.md) |
| 数据库表结构、API规范 | [docs/tech-spec.md](docs/tech-spec.md) |
| 页面长什么样 | [docs/design-spec.md](docs/design-spec.md) |
| 开发到哪一步了 | [docs/development-steps.md](docs/development-steps.md) |
| API怎么调用 | [docs/api-spec.md](docs/api-spec.md) |
| 今天的进度 | [devlog/](devlog/) 最新文件 |
| 样式规则 | [themerules](themerules) |

## 开发规则

### 工作流程
1. **开始前**：查看 `docs/development-steps.md` 确认当前轮次
2. **开发中**：先后端后前端，API 先用 curl 测通
3. **每轮结束**：验证功能可用 → 更新 `development-steps.md` 打勾 → 更新 `devlog/` 当天日志
4. **提交代码**：每轮完成后 git commit

### 代码规范
- 所有 API 错误消息用中文
- author_id/owner_id 从 JWT 提取，不从请求体获取
- 密码用 bcryptjs 哈希（cost=10）
- 前端样式遵循 themerules（无渐变、无玻璃态、色值用设计Token）
- 新页面用 `registerPage(name, renderFn)` 注册

### 启动命令
```bash
npm install          # 安装依赖
npm run dev          # 启动服务器 http://localhost:3000
```

### 测试 API
```bash
# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456","nickname":"测试","major":"计算机","grade":"2024级"}'
```

## 日志规则

- 每次开发会话开始：检查 `devlog/` 下是否有当天日志文件，没有则创建
- 每次开发会话结束：更新当天日志的完成事项和待办事项
- 日志文件命名：`YYYY-MM-DD.md`

---

> 创建于 2026-05-30
