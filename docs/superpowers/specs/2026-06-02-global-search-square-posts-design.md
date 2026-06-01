# 全局搜索支持广场帖子设计说明

## 目标

扩展全局搜索，使用户能够在课程、资料和课程帖子之外搜索广场帖子，并进入匹配帖子的详情页。

## 范围

本次改动扩展现有的 `GET /api/search` 接口和全局搜索页面。不新增独立的广场搜索接口，不修改广场列表，也不改动广场帖子详情页。

## 后端

在 `GET /api/search` 中增加 `squarePosts` 结果集合。

- 当 `type=all` 或 `type=squarePosts` 时返回 `squarePosts`。
- 使用去除首尾空格后的关键词匹配 `square_posts.title` 和 `square_posts.description`。
- 关联 `users` 表，返回发布者昵称。
- 返回结果卡片需要的字段：`id`、`title`、`description`、`category`、`status`、`max_people`、`current_count`、`expires_at`、`created_at` 和 `creator_name`。
- 使用与广场列表一致的可见性规则：只返回 `expires_at > datetime('now')` 且 `status != 'expired'` 的帖子。
- `open`、`full` 和 `closed` 状态的帖子只要未过期都可以被搜索。过滤条件以广场列表的现有规则为准，而不是仅返回仍在招募的帖子。
- 按 `created_at DESC` 排序，并沿用现有的分区结果数量限制。
- 将 `squarePosts` 的数量计入响应中的 `total`。

## 前端

扩展 `public/js/pages/auth.js` 中的现有搜索页面。

- 新增标签为“广场帖子”的 `squarePosts` Tab。
- 在“全部”Tab 中加入 `squarePosts` 结果。
- 在课程帖子之后渲染独立的广场帖子结果分区。
- 每张卡片显示高亮后的标题、存在时显示高亮后的描述摘要，以及分类、发布者、状态和剩余天数。
- 复用现有的搜索结果卡片样式和关键词高亮工具。除非实现时发现布局问题，否则无需新增 CSS。
- 更新搜索输入框提示，使用户知道搜索范围包含广场帖子。

## 跳转

点击广场帖子搜索结果时调用：

```js
navigateTo('square-post', post.id)
```

现有 SPA 路由会将该页面映射到 `/explore/square/post/:id`，现有详情页会请求 `/api/square/posts/:id`。

## 错误处理

全局搜索沿用当前的校验和失败处理：

- 搜索词少于两个字符时，返回现有校验错误。
- 搜索请求失败时，显示现有的通用搜索失败卡片。
- `squarePosts` 为空时，不渲染广场帖子结果分区。

## 测试

增加以下回归测试：

- `type=squarePosts` 返回匹配且可见的广场帖子。
- `type=all` 包含广场帖子结果，并将其计入 `total`。
- 未过期的 `full` 状态帖子仍可搜索。
- 已过期的帖子不会返回。
- 不匹配关键词的帖子不会返回。
- 前端包含 `squarePosts` Tab，广场帖子结果卡片会跳转到 `square-post`。

## 不在本次范围

- 全文索引或排序策略调整。
- 分页逻辑调整。
- 搜索广场评论。
- 修改广场列表的可见性规则。
- 将现有搜索页面重构为独立模块。
