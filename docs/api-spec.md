# 课搭子 — API 接口规范

## 约定

- 基础路径：`http://localhost:3000/api`
- `[Auth]` = 需要 Authorization Header
- Content-Type: `application/json`

---

## 1. 认证 `/api/auth`

### 注册（发送验证码）
```
POST /api/auth/register
```
Body:
```json
{
  "email": "test@example.com",
  "password": "123456",
  "nickname": "张三",
  "major": "计算机科学与技术",
  "grade": "2024级"
}
```
Response 201:
```json
{
  "message": "验证码已发送至 test@example.com，请查收邮件完成验证",
  "debug_code": "123456"
}
```
> `debug_code` 仅在未配置邮件 API 时返回，生产环境删除。
> 如果邮箱已注册但未验证，会重新发送验证码。
Error: 400（缺少字段/邮箱格式错/密码太短）, 409（邮箱已验证）

### 验证邮箱
```
POST /api/auth/verify-email
```
Body:
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```
Response 200:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "email": "test@example.com", "nickname": "张三", "email_verified": 1, ... }
}
```
Error: 400（验证码错误/过期）, 404（邮箱未注册）

### 登录
```
POST /api/auth/login
```
Body:
```json
{
  "email": "test@example.com",
  "password": "123456"
}
```
Response 200:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "email": "test@example.com", "nickname": "张三", ... }
}
```
Error: 400（缺少字段）, 401（邮箱或密码错误）, 403（邮箱未验证）

### 重新发送验证码
```
POST /api/auth/resend-code
```
Body: `{ "email": "test@example.com" }`
Response 200: `{ "message": "验证码已重新发送...", "debug_code": "..." }`

### 查个人信息
```
GET /api/auth/me   [Auth]
```
Response 200: user 对象

### 更新个人信息
```
PUT /api/auth/me   [Auth]
```
Body（全可选）: `{ "nickname?", "major?", "grade?", "avatar_url?" }`
Response 200: 更新后的 user

---

## 2. 课程 `/api/courses`

### 列表
```
GET /api/courses
```

### 详情
```
GET /api/courses/:id
```

### 创建
```
POST /api/courses   [Auth]
```
Body: `{ "title", "description?", "semester?", "teacher?" }`
（owner_id 从 JWT 提取）

### 加入课程
```
POST /api/courses/:id/enroll   [Auth]
```

### 成员列表
```
GET /api/courses/:id/members
```

### 帖子列表
```
GET /api/courses/:id/posts
```

### 发帖
```
POST /api/courses/:id/posts   [Auth]
```
Body: `{ "title", "content" }`
（author_id 从 JWT 提取）

### 评论列表
```
GET /api/courses/posts/:postId/comments
```

### 发评论
```
POST /api/courses/posts/:postId/comments   [Auth]
```
Body: `{ "content" }`
（author_id 从 JWT 提取）

---

## 3. 用户 `/api/user`

### 公开信息
```
GET /api/user/:id
```

### 参加的课程
```
GET /api/user/:id/courses
```

---

## 邮件配置

设置环境变量以启用真实邮件发送：
```bash
# Windows PowerShell
$env:RESEND_API_KEY="re_xxxxxx"

# Windows CMD
set RESEND_API_KEY=re_xxxxxx
```
不配置时，服务器仍正常运行，验证码通过 `debug_code` 在响应中返回（仅开发调试用）。

---

> 最后更新：2026-05-30
