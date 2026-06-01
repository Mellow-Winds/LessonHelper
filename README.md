# 课搭子 — 同课程学习互助平台

## 快速开始

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`

## 邮箱验证码配置（可选）

开发模式下，不配置邮件服务也能用，验证码会直接显示在页面上。

如需发送真实邮件，注册 [Resend](https://resend.com) 获取 API Key：

```bash
# Windows CMD
set RESEND_API_KEY=re_xxxxxx

# Windows PowerShell
$env:RESEND_API_KEY="re_xxxxxx"
```

## 功能

- 邮箱验证码注册 + 密码登录（JWT）
- 课程列表浏览 + 创建课程 + 加入课程
- 课程空间（论坛）：发帖、评论、成员列表
- Material Design 3 界面

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express + SQLite (sql.js) |
| 认证 | JWT + bcryptjs + Resend |
| 前端 | 原生 JavaScript SPA + MD3 CSS |

## 项目文档

| 文档 | 路径 |
|------|------|
| 开发需求 | [docs/requirements.md](docs/requirements.md) |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) |
| 开发步骤 | [docs/development-steps.md](docs/development-steps.md) |
| API 文档 | [docs/api-spec.md](docs/api-spec.md) |
| 项目指南 | [CLAUDE.md](CLAUDE.md) |
| 开发日志 | [devlog/](devlog/) |

## 项目结构

```
Lessonhelper/
├── server.js              # Express 入口
├── CLAUDE.md              # 项目指南
├── themerules             # 设计规范
├── docs/                  # 项目文档
├── devlog/                # 开发日志
├── db/                    # SQLite 数据库
├── routes/                # API 路由
│   ├── auth.js            #   认证
│   ├── courses.js         #   课程/帖子/评论
│   ├── user.js            #   用户
│   ├── schedule.js        #   课表导入
│   └── middleware/        #   JWT中间件 + 邮件服务
├── public/                # 前端
│   ├── index.html
│   ├── css/style.css
│   └── js/                #   ES6 Modules
│       ├── main.js
│       ├── core/          #   api.js + router.js
│       ├── components/    #   ui.js
│       └── pages/         #   auth / profile / courses / square
└── uploads/               # 文件存储（预留）
```
