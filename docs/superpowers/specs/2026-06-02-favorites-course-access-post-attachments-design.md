# 收藏、课程访问控制与帖子附件设计说明

## 目标

本次改动包含四组关联需求：

1. 支持收藏课程和课程内帖子，并提供“我的收藏”页面。
2. 全局搜索可以展示全部课程，但用户进入未加入的课程时，只能看到与课程广场一致的只读页面，不能看到课程成员列表。
3. 全局搜索页面中，将“广场帖子”文案统一改为“广场”。
4. 修复课程帖子带附件时无法发布的问题，并支持最多 9 个附件。图片附件使用类似微博的宫格预览，普通附件显示下载入口。

广场帖子具有时效性，并已有“感兴趣”申请流程，因此不加入收藏范围。

## 实现方案

采用独立收藏表和帖子附件表：

- `favorite_courses` 保存用户收藏的课程。
- `favorite_posts` 保存用户收藏的课程帖子。
- `post_attachments` 保存课程帖子附件。

不使用通用 `favorites(resource_type, resource_id)` 表。独立表查询直观，能够使用明确的外键和级联删除约束。

帖子附件不复用课程资料表。附件随帖子展示，不自动进入课程“资料”列表。

## 数据库

新增表：

```sql
CREATE TABLE IF NOT EXISTS favorite_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS favorite_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```

收藏列表按收藏记录的 `created_at DESC` 排序，最近收藏优先。

## 后端接口

新增收藏路由 `routes/favorites.js`，挂载为 `/api/favorites`。全部接口要求登录。

```text
GET    /api/favorites?type=courses
GET    /api/favorites?type=posts
POST   /api/favorites/courses/:courseId
DELETE /api/favorites/courses/:courseId
POST   /api/favorites/posts/:postId
DELETE /api/favorites/posts/:postId
```

收藏课程列表返回课程名、教师、选课人数和收藏时间。收藏帖子列表返回帖子标题、摘要、所属课程、作者、发布时间、收藏时间和附件信息。

收藏接口保持幂等：重复收藏不会创建重复记录，取消未收藏的对象也不会报错。课程或帖子删除时，对应收藏记录通过外键级联删除。

## 课程访问控制

当前 `/api/courses/:id/members` 和 `/api/courses/:id/members/stats` 可被任意访问。两者改为要求登录，并验证当前用户已加入该课程。未加入时返回 `403`。

全局搜索仍返回全部匹配课程。前端进入搜索结果时，根据用户已加入的课程列表决定目标页面：

- 已加入课程：进入 `mycourse-detail`。
- 未加入课程：进入与课程广场一致的只读详情页。

资料和课程帖子搜索结果也遵循相同规则，按所属课程判断目标页面。只读详情不加载成员列表。

课程广场现有页面以“大课”为单位聚合多个班级。为了从搜索结果稳定进入该页面，课程广场模块提供按课程 ID 导航的辅助函数，由辅助函数在聚合数据中找到对应大课索引后进入 `plaza-course`。不直接把课程 ID 当成数组索引。

## 收藏前端

侧栏新增“我的收藏”入口，注册独立页面。页面提供两个 Tab：

- `课程`
- `帖子`

Tab 文案展示数量，例如“课程 3”“帖子 12”。列表为空时仅显示空状态提示，不附带前往课程广场的引导按钮。

课程收藏按钮同时出现在：

- “我的课程”详情页。
- 课程广场只读详情页。

课程帖子收藏按钮出现在帖子卡片上，包括“我的课程”详情和课程广场详情中的帖子卡片。

收藏按钮采用即时状态切换：点击后立即更新图标和状态；接口失败时恢复原状态并提示错误。

收藏帖子卡片点击后进入所属课程详情，并自动定位到对应帖子。若当前用户未加入所属课程，则进入课程广场只读详情，并定位到该帖子。

## 帖子附件

课程帖子发布接口兼容两种提交方式：

- 无附件：保持现有 JSON 请求。
- 有附件：使用 `multipart/form-data`。

课程帖子路由接入 `multer`，使用 `upload.array('files', 9)` 接收附件。约束如下：

- 每个帖子最多 9 个附件。
- 单个文件最大 20MB。
- 附件保存到独立目录 `uploads/post-attachments`。
- 文件名使用时间戳和随机值，保留原始扩展名。
- 接口校验失败时清理已经写入磁盘的文件。

新增附件访问接口：

```text
GET /api/courses/posts/attachments/:attachmentId/download
GET /api/courses/posts/attachments/:attachmentId/view
```

`download` 使用下载响应；`view` 用于图片原图访问。帖子查询接口返回 `attachments` 数组。

发布页文件输入框改为 `multiple`，展示已选文件数量和名称。附件存在时继续强制开启“同步发送到课程广场”。

## 图片宫格

图片附件显示在帖子正文下方，采用类似微博的自适应宫格：

- 1 张：大图预览，限制最大高度。
- 2 张：两列布局。
- 3 张：三列布局。
- 4 至 9 张：三列宫格。

图片使用固定比例容器和 `object-fit: cover`，避免不同尺寸图片破坏布局。点击图片在新标签页打开原图。

非图片附件显示为文件列表，包含文件名、文件大小和下载按钮。一个帖子可以同时包含图片和普通文件。

## 搜索文案

全局搜索页面中：

- 搜索输入提示由“搜索课程、资料、帖子、广场帖子...”改为“搜索课程、资料、帖子、广场...”。
- Tab 文案由“广场帖子”改为“广场”。
- 结果分区标题由“广场帖子”改为“广场”。

后端搜索参数 `squarePosts` 和响应字段 `squarePosts` 保持不变，避免无意义的接口改名。

## 错误处理

- 收藏不存在的课程或帖子时返回 `404`。
- 未登录访问收藏接口时返回 `401`。
- 未加入课程访问成员列表或成员统计时返回 `403`。
- 帖子附件超过 9 个或单文件超过 20MB 时返回明确的中文错误。
- 帖子发布失败时删除本次已上传文件，不留下孤立附件。
- 前端收藏请求失败时恢复按钮原状态。

## 测试

增加自动化回归测试：

- 收藏课程、取消收藏、重复收藏不产生重复记录。
- 收藏帖子、取消收藏、帖子删除后收藏记录自动清理。
- 收藏列表按收藏时间倒序返回，字段完整。
- 已加入课程的用户可访问成员列表和成员统计。
- 未加入课程的用户访问成员接口时收到 `403`。
- 搜索结果根据课程加入状态选择“我的课程”详情或课程广场只读详情。
- 搜索页面仅展示“广场”文案。
- 课程帖子支持 JSON 发布。
- 课程帖子支持 multipart 多附件发布。
- 附件超过 9 个时拒绝发布。
- 图片附件返回预览地址，普通附件返回下载地址。
- 前端发布页支持多选文件。
- 前端帖子卡片渲染图片宫格和普通附件列表。

## 不在本次范围

- 收藏广场帖子。
- 收藏夹分组、标签、备注、批量管理和收藏搜索。
- 将帖子附件自动加入课程资料列表。
- 图片弹窗轮播、裁剪或压缩处理。
- 重构课程广场的大课聚合规则。
