# AGENTS.md — 课搭子 项目指南

## 项目概述

**课搭子**（LessonHelper）是一个面向大学生的同课程学习互助平台。核心功能包括：用户系统、课程管理、学习资料共享、自习邀约、交友广场、消息通知、全局搜索。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express 4.x + SQLite (sql.js WASM) |
| 认证 | JWT (jsonwebtoken) + bcryptjs |
| 前端 | 原生 JavaScript SPA + ES6 Modules |
| 设计系统 | Material Design 3（自定义 CSS） |

## 项目结构

```
Lessonhelper/
├── server.js                    # Express 入口，数据库初始化，路由挂载
├── package.json                 # 依赖配置
├── rules                        # 前端设计规范 + 统一规则
├── CLAUDE.md / AGENTS.md        # 项目指南
├── docs/                        # 📚 项目文档
├── devlog/                      # 📝 开发日志
├── db/                          # SQLite 数据库文件
├── routes/                      # 后端路由（10 个文件）
├── public/                      # 前端静态文件
│   ├── index.html               #   SPA 入口
│   ├── css/style.css            #   样式
│   └── js/
│       ├── main.js              #   全局入口
│       ├── core/
│       │   ├── api.js           #   Fetch 请求层 + Token 管理
│       │   └── router.js        #   路由系统 + 动效引擎
│       ├── components/
│       │   └── ui.js            #   MD3 组件工厂 + Toast + Modal
│       └── pages/
│           ├── auth.js          #   登录/注册 + 搜索页
│           ├── profile.js       #   个人中心
│           ├── notifications.js #   通知中心
│           ├── my_posts.js      #   我的创作
│           ├── explore.js       #   探索页入口
│           ├── explore/
│           │   ├── invites.js   #   自习邀约
│           │   ├── square.js    #   交友广场
│           │   └── posts.js     #   统一发布页
│           └── courses/
│               ├── my_courses.js #   我的课程（选修课表列表）
│               ├── all_courses.js#   课程广场（全校大库检索）
│               ├── detail.js    #   统一大课空间详情页
│               ├── publish.js   #   发布（富文本+附件）
│               └── post_attachments.js # 帖子附件渲染工具
└── uploads/                     # 上传文件存储
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
| 样式规则 + 统一规范 | [rules](rules) |

## 开发规则

### 工作流程
1. **开始前**：查看 `docs/development-steps.md` 确认当前轮次
2. **开发中**：先后端后前端，API 先用 curl 测通
3. **每轮结束**：验证功能可用 → 更新 `development-steps.md` 打勾 → 更新 `devlog/` 当天日志
4. **提交代码**：每轮完成后 git commit

### 代码规范
- **每次修改代码前，必须先阅读 [rules](rules) 文件**，了解统一设定要求
- 所有 API 错误消息用中文
- author_id/owner_id 从 JWT 提取，不从请求体获取
- 密码用 bcryptjs 哈希（cost=10）
- 前端样式遵循 rules（无渐变、无玻璃态、色值用设计Token）
- 新页面用 `registerPage(name, renderFn)` 注册
- 输入框必须用 `createMdInput()` / `createMdSelect()` 工厂，禁止原生 `<select>`
- **输入框 placeholder 禁止使用汉字**，只允许 `placeholder: ' '`（一个空格）

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

> 创建于 2026-05-30 | 最后更新：2026-06-03（输入框规范 + rules 重命名）
