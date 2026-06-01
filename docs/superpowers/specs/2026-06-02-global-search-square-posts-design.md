# 全局搜索支持广场帖子设计说明

## 目标

在现有全局搜索中加入广场帖子，并支持点击结果进入广场帖子详情页。

## 后端

扩展 `GET /api/search`：

- 当 `type=all` 或 `type=squarePosts` 时返回 `squarePosts`。
- 按标题和描述匹配关键词，关联用户表返回发布者昵称。
- 返回卡片所需字段：`id`、`title`、`description`、`category`、`status`、`max_people`、`current_count`、`expires_at`、`created_at`、`creator_name`。
- 过滤规则与广场列表一致：只返回 `expires_at > datetime('now')` 且 `status != 'expired'` 的帖子。
- `open`、`full`、`closed` 状态只要未过期都可被搜索。
- 将 `squarePosts` 数量计入响应中的 `total`。

## 前端

修改 `public/js/pages/auth.js`：

- 新增“广场帖子”搜索 Tab，对应类型 `squarePosts`。
- “全部”Tab 中增加广场帖子结果分区。
- 卡片显示标题、描述摘要、分类、发布者、状态和剩余天数。
- 点击卡片执行：

```js
navigateTo('square-post', post.id)
```

现有路由会进入 `/explore/square/post/:id`，无需新增详情页。

## 测试

覆盖以下场景：

- `type=squarePosts` 能返回匹配且未过期的帖子。
- `type=all` 包含广场帖子，并正确累计 `total`。
- 未过期的 `full` 帖子仍可搜索。
- 已过期或不匹配的帖子不会返回。
- 前端包含“广场帖子”Tab，结果卡片跳转到 `square-post`。

## 不在本次范围

- 全文索引和排序优化。
- 搜索广场评论。
- 修改广场列表或详情页。
