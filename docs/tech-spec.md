# 课搭子 — 技术规范

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | — |
| 后端框架 | Express | ^4.21 |
| 数据库 | SQLite (sql.js WASM) | ^1.12 |
| 认证 | JWT (jsonwebtoken) + bcryptjs | 待安装 |
| 文件上传 | Multer | ^2.1 |
| 前端 | 原生 JavaScript | — |
| 样式 | Material Design 3 + 自定义 CSS | — |
| CDN | Material Web Components, Motion, Marked | — |

---

## 数据库设计

### users 表变更

保留现有列：`id`, `username`, `display_name`, `avatar_url`, `created_at`

新增列（迁移添加）：
| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| password_hash | TEXT | '' | bcrypt 密码哈希 |
| nickname | TEXT | '' | 昵称 |
| major | TEXT | '' | 专业 |
| grade | TEXT | '' | 年级 |

### courses 表变更

新增列：
| 列名 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| semester | TEXT | '' | 学期，如"2025-2026-2" |
| teacher | TEXT | '' | 授课教师 |

### 新增表：user_courses

```sql
CREATE TABLE user_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);
```

### posts 和 comments 表

保持现有结构不变。

---

## API 设计规范

### 认证
- JWT Token，Header：`Authorization: Bearer <token>`
- Token 有效期：7 天
- 需要认证的端点标注 `[Auth]`

### 响应格式
- 成功：返回数据对象或数组，HTTP 2xx
- 失败：`{ "error": "中文错误描述" }`，HTTP 4xx/5xx

### 安全
1. 密码 bcryptjs 哈希，cost factor = 10
2. author_id/owner_id 从 JWT 提取，不从请求体获取
3. SQL 参数化查询
4. 所有输入验证

---

## 前端架构

- SPA 模式，`registerPage()` + `navigateTo()`
- 全局状态：`window._currentUser`
- API 封装自动附加 Authorization header
- 样式遵循 [themerules](../themerules)

---

> 最后更新：2026-05-30
