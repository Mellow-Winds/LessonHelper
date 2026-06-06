const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/explore/posts/:postId/comments — 评论列表
  router.get('/:postId/comments', optionalAuthMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(pageSize);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize)));

    // 顶层评论
    const comments = db.all(
      `SELECT ec.*,
        u.username AS author_name,
        u.nickname AS author_nickname,
        u.avatar_url AS author_avatar
       FROM explore_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.post_id = ? AND ec.parent_id IS NULL
       ORDER BY ec.created_at ASC
       LIMIT ? OFFSET ?`,
      [postId, limit, offset]
    );

    // 为每个评论查回复（最多显示2条，展开查全部）
    for (const c of comments) {
      const replyCount = db.get(
        'SELECT COUNT(*) AS cnt FROM explore_comments WHERE parent_id = ?',
        [c.id]
      )?.cnt || 0;

      const replies = db.all(
        `SELECT ec.*,
          u.username AS author_name,
          u.nickname AS author_nickname,
          u.avatar_url AS author_avatar
         FROM explore_comments ec
         LEFT JOIN users u ON u.id = ec.author_id
         WHERE ec.parent_id = ?
         ORDER BY ec.created_at ASC`,
        [c.id]
      );

      c.replies = replies;
      c.reply_count = replyCount;
    }

    const total = db.get(
      'SELECT COUNT(*) AS cnt FROM explore_comments WHERE post_id = ? AND parent_id IS NULL',
      [postId]
    )?.cnt || 0;

    res.json({ items: comments, total, page: parseInt(page), pageSize: limit });
  });

  // POST /api/explore/posts/:postId/comments — 发表评论 [Auth]
  router.post('/:postId/comments', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;
    const { content, parent_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '评论内容不能为空' });
    }

    const post = db.get('SELECT id, creator_id, title FROM explore_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });

    // 如果是回复，验证父评论
    if (parent_id) {
      const parent = db.get('SELECT id, author_id FROM explore_comments WHERE id = ? AND post_id = ?', [parent_id, postId]);
      if (!parent) return res.status(400).json({ error: '被回复的评论不存在' });
    }

    const result = db.run(
      'INSERT INTO explore_comments (post_id, author_id, content, parent_id) VALUES (?, ?, ?, ?)',
      [postId, userId, content.trim(), parent_id || null]
    );
    const commentId = result.lastInsertRowid;

    // 通知
    const user = db.get('SELECT nickname, username FROM users WHERE id = ?', [userId]);
    const userName = user?.nickname || user?.username || '某用户';

    if (parent_id) {
      // 回复评论 → 通知被回复者
      const parent = db.get('SELECT author_id FROM explore_comments WHERE id = ?', [parent_id]);
      if (parent && parent.author_id !== userId) {
        createNotification(db, {
          userId: parent.author_id,
          type: 'comment_reply',
          title: '评论回复',
          message: `${userName} 回复了你在「${post.title}」下的评论`,
          relatedType: 'explore_post',
          relatedId: postId
        });
      }
    } else {
      // 新评论 → 通知帖子作者
      if (post.creator_id !== userId) {
        createNotification(db, {
          userId: post.creator_id,
          type: 'post_comment',
          title: '新评论',
          message: `${userName} 评论了你的帖子「${post.title}」`,
          relatedType: 'explore_post',
          relatedId: postId
        });
      }
    }

    db.save();

    // 返回完整评论
    const comment = db.get(
      `SELECT ec.*,
        u.username AS author_name,
        u.nickname AS author_nickname,
        u.avatar_url AS author_avatar
       FROM explore_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.id = ?`,
      [commentId]
    );
    res.status(201).json(comment);
  });

  // DELETE /api/explore/posts/:postId/comments/:commentId — 删除评论 [Auth, 仅作者]
  router.delete('/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.userId;

    const comment = db.get('SELECT author_id FROM explore_comments WHERE id = ?', [commentId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '无权删除' });

    // 软删除
    db.run("UPDATE explore_comments SET content = '[已删除]' WHERE id = ?", [commentId]);
    db.save();
    res.json({ message: '已删除' });
  });

  return router;
};
