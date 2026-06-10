# 课搭子 — 同课程学习互助平台

面向大学生的同课程学习互助平台，以南京大学蓝鲸文化为品牌背景。

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

### 用户系统
- 邮箱验证码注册 + 密码登录（JWT 认证）
- 个人资料：昵称、性别、专业、年级、QQ、微信、抖音、MBTI、肖像描述
- 每日签到（连续打卡 + 双重宽限期保护）
- 完整度进度条（7 项因子）
- 关注/粉丝系统 + 关注动态
- 隐私设置（公开资料 / 允许被匹配）
- 个人名片公开主页 + 预览「他人看我」模式
- 数据导出（JSON）
- 问题反馈

### 课程系统
- 课表 Excel 导入（南京大学教务系统 XLSX 解析）
- 课程列表（学期筛选、选课/退课、移学期、50 门上限）
- 大课空间：论坛（发帖/评论/楼中楼/附件）+ 资料（上传/下载/评分）+ 搭子
- 课程广场：全校课程聚合浏览（大课归并、跨班内容共享）
- 统一发布页：富文本编辑器 + 多文件附件（最多 9 个）+ 分类选择
- 未选课用户只读模式

### 发现模块
- 全局帖子流（瀑布流卡片布局）
- 帖子详情页（编辑/删除 + 论坛式评论）
- 论坛式评论系统：内联编辑器 + 图片上传 + 楼中楼递归渲染 + 30 秒冷却
- 评论冷却 localStorage 持久化（刷新不丢失）
- 我的发布管理

### 学习资料
- 上传：PDF / PPT / Word / 图片，单文件 20MB
- 分类浏览：按类型 / 章节筛选，评分排序
- 下载（中文文件名 RFC 5987 编码）
- 评分（1-5 星）

### 自习邀约
- 发布 / 加入 / 取消
- 人数上限管理，自动状态（招募中 / 已满 / 已关闭）
- 我的邀约（发起 / 参与 Tab）

### 交友广场
- 7 类需求帖（考研 / 考公 / 考证 / 项目组队 / 技能交换 / 竞赛组队 / 其他）
- 7 天自动过期
- 感兴趣 → 双方确认 → 显示联系方式
- 评论交流

### 消息通知
- 铃铛角标 + 通知面板 + 30 秒轮询
- 点击通知跳转对应帖子/课程/用户
- 全部已读

### 全局搜索
- 搜索课程 / 资料 / 帖子
- 分 Tab 展示、关键词高亮、搜索历史

### 收藏系统
- 收藏课程 / 帖子
- 我的收藏页面

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Express 4.x + SQLite (sql.js WASM) |
| 认证 | JWT + bcryptjs |
| 邮件 | Resend API |
| 文件上传 | Multer |
| 课表解析 | xlsx (SheetJS) |
| 前端 | 原生 JavaScript SPA + ES6 Modules |
| 设计系统 | Material Design 3 |
| Markdown | markdown-it |
| 测试 | node:test（16 个测试文件，49 个测试用例） |

## 项目结构

详见 [CLAUDE.md](CLAUDE.md)。简要概览：

- `routes/` — 12 个后端 API 路由文件
- `public/js/pages/` — 15+ 个前端页面模块
- `tests/` — 16 个自动化测试文件
- `docs/` — 项目文档（需求/技术/设计/API/开发步骤/课程设计）
- `todolist/` — 待规划功能清单
- `devlog/` — 开发日志

## 项目文档

| 文档 | 路径 |
|------|------|
| 项目指南 | [CLAUDE.md](CLAUDE.md) |
| 开发需求 | [docs/requirements.md](docs/requirements.md) |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) |
| 开发步骤 | [docs/development-steps.md](docs/development-steps.md) |
| API 文档 | [docs/api-spec.md](docs/api-spec.md) |
| 课程系统设计 | [docs/course.md](docs/course.md) |
| 开发日志 | [devlog/](devlog/) |
| 待办事项 | [todolist/](todolist/) |
