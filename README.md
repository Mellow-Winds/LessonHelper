# EduSpace - 课程交流平台 API 文档

## 启动方式

```bash
npm install
npm run dev
```

服务启动后访问 `http://localhost:3000`

---

## 数据库表结构

### users（用户表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| username | TEXT UNIQUE | 登录用户名 |
| display_name | TEXT | 显示名称 |
| avatar_url | TEXT | 头像地址，默认空 |
| created_at | DATETIME | 创建时间 |

### courses（课程表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT | 课程标题 |
| description | TEXT | 课程描述 |
| owner_id | INTEGER FK → users.id | 创建者 |
| created_at | DATETIME | 创建时间 |

### posts（帖子表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| course_id | INTEGER FK → courses.id | 所属课程 |
| author_id | INTEGER FK → users.id | 作者 |
| title | TEXT | 帖子标题 |
| content | TEXT | 帖子内容 |
| created_at | DATETIME | 创建时间 |

### comments（评论表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| post_id | INTEGER FK → posts.id | 所属帖子 |
| author_id | INTEGER FK → users.id | 作者 |
| content | TEXT | 评论内容 |
| created_at | DATETIME | 创建时间 |

---

## API 接口

### 用户模块 `/api/user`

#### 注册用户
```
POST /api/user/register
```
**Request Body:**
```json
{
  "username": "zhangsan",
  "display_name": "张三"
}
```
**Response 201:**
```json
{
  "id": 1,
  "username": "zhangsan",
  "display_name": "张三"
}
```
**Error 409:** `{ "error": "用户名已存在" }`

---

#### 获取用户信息
```
GET /api/user/:id
```
**Response 200:**
```json
{
  "id": 1,
  "username": "zhangsan",
  "display_name": "张三",
  "avatar_url": "",
  "created_at": "2026-05-26T00:00:00.000Z"
}
```
**Error 404:** `{ "error": "用户不存在" }`

---

#### 获取用户的课程
```
GET /api/user/:id/courses
```
**Response 200:**
```json
[
  {
    "id": 1,
    "title": "高等数学",
    "description": "微积分与线性代数",
    "owner_id": 1,
    "created_at": "2026-05-26T00:00:00.000Z"
  }
]
```

---

### 课程模块 `/api/courses`

#### 获取课程列表
```
GET /api/courses
```
**Response 200:**
```json
[
  {
    "id": 1,
    "title": "高等数学",
    "description": "微积分与线性代数",
    "owner_id": 1,
    "created_at": "2026-05-26T00:00:00.000Z"
  }
]
```

---

#### 获取课程详情
```
GET /api/courses/:id
```
**Response 200:**
```json
{
  "id": 1,
  "title": "高等数学",
  "description": "微积分与线性代数",
  "owner_id": 1,
  "created_at": "2026-05-26T00:00:00.000Z"
}
```
**Error 404:** `{ "error": "课程不存在" }`

---

#### 创建课程
```
POST /api/courses
```
**Request Body:**
```json
{
  "title": "高等数学",
  "description": "微积分与线性代数",
  "owner_id": 1
}
```
**Response 201:**
```json
{
  "id": 1,
  "title": "高等数学",
  "description": "微积分与线性代数",
  "owner_id": 1
}
```
**Error 400:** `{ "error": "title 和 owner_id 为必填项" }`

---

#### 获取课程帖子列表
```
GET /api/courses/:id/posts
```
**Response 200:**
```json
[
  {
    "id": 1,
    "course_id": 1,
    "author_id": 1,
    "title": "第一章重点整理",
    "content": "极限的定义与性质...",
    "author_name": "张三",
    "created_at": "2026-05-26T00:00:00.000Z"
  }
]
```

---

#### 创建帖子
```
POST /api/courses/:id/posts
```
**Request Body:**
```json
{
  "author_id": 1,
  "title": "第一章重点整理",
  "content": "极限的定义与性质..."
}
```
**Response 201:**
```json
{
  "id": 1,
  "course_id": 1,
  "author_id": 1,
  "title": "第一章重点整理",
  "content": "极限的定义与性质..."
}
```
**Error 400:** `{ "error": "author_id, title, content 为必填项" }`

---

### 帖子评论 `/api/courses/posts`

#### 获取帖子评论
```
GET /api/courses/posts/:postId/comments
```
**Response 200:**
```json
[
  {
    "id": 1,
    "post_id": 1,
    "author_id": 2,
    "content": "写得很清楚！",
    "author_name": "李四",
    "created_at": "2026-05-26T00:00:00.000Z"
  }
]
```

---

#### 创建评论
```
POST /api/courses/posts/:postId/comments
```
**Request Body:**
```json
{
  "author_id": 2,
  "content": "写得很清楚！"
}
```
**Response 201:**
```json
{
  "id": 1,
  "post_id": 1,
  "author_id": 2,
  "content": "写得很清楚！"
}
```
**Error 400:** `{ "error": "author_id 和 content 为必填项" }`

---

## 项目结构

```
LessonHelper/
├── package.json
├── server.js              # Express 入口，数据库初始化
├── themerules             # 前端设计规范
├── db/
│   └── eduspace.db        # SQLite 数据库文件（自动创建）
├── public/
│   ├── index.html         # 主页面
│   ├── css/
│   │   └── style.css      # 样式（遵循 themerules）
│   └── js/
│       └── app.js         # 客户端逻辑
└── routes/
    ├── courses.js          # 课程相关 API
    └── user.js             # 用户相关 API
```
