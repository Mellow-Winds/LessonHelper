const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

const COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
const COMMENT_IMAGE_MAX = 1 * 1024 * 1024;
const COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);
const COMMENT_COOLDOWN_SECONDS = 30;

const commentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(COMMENT_IMAGE_DIR, { recursive: true });
      cb(null, COMMENT_IMAGE_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `ec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: COMMENT_IMAGE_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, COMMENT_IMAGE_EXT.has(ext));
  }
});

function parseCommentImage(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  commentUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '图片不能超过 1MB'
      : error.code === 'LIMIT_FILE_COUNT'
        ? '只能上传一张图片'
        : '仅支持 jpg/jpeg/png 格式';
    return res.status(400).json({ error: message });
  });
}

function getRemainingCooldownSeconds(comment) {
  if (!comment?.created_at) return 0;
  const createdAt = new Date(String(comment.created_at).replace(' ', 'T') + 'Z').getTime();
  if (!Number.isFinite(createdAt)) return 0;
  const elapsedSeconds = Math.floor((Date.now() - createdAt) / 1000);
  return Math.max(0, COMMENT_COOLDOWN_SECONDS - elapsedSeconds);
}

function getCommentCount(db, postId) {
  return (db.get('SELECT COUNT(*) AS cnt FROM explore_comments WHERE post_id = ?', [postId]) || {}).cnt || 0;
}

function collectDescendantComments(db, commentId) {
  const result = [];
  const stack = [commentId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    const children = db.all('SELECT * FROM explore_comments WHERE parent_id = ?', [currentId]);
    for (const child of children) {
      result.push(child);
      stack.push(child.id);
    }
  }
  return result;
}

function deleteCommentImage(imageUrl) {
  if (!imageUrl) return;
  imageUrl.split(';').filter(Boolean).forEach(url => {
    const imgPath = path.join(__dirname, '..', url);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  });
}

module.exports = function (db) {
  const router = express.Router();

  // GET /api/explore/posts/:postId/comments — 评论列表
  router.get('/:postId/comments', optionalAuthMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(pageSize);
    const limit = Math.min(100, Math.max(1, parseInt(pageSize)));

    // 拉取该帖子所有评论，在前端构建嵌套树（保证楼中楼递归展示）
    const allComments = db.all(
      `SELECT ec.*,
        u.nickname AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM explore_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.post_id = ?
       ORDER BY ec.created_at ASC`,
      [postId]
    );

    // 构建 parentId -> children 映射
    const childrenMap = {};
    allComments.forEach(c => {
      const pid = c.parent_id;
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(c);
    });

    // 递归挂载 replies
    function attachReplies(comment) {
      const replies = childrenMap[comment.id] || [];
      for (const r of replies) attachReplies(r);
      comment.replies = replies;
      comment.reply_count = replies.length;
    }

    const topComments = allComments.filter(c => !c.parent_id);
    topComments.forEach(attachReplies);

    const total = topComments.length;
    const paged = topComments.slice(offset, offset + limit);

    res.json({ items: paged, total, comment_count: allComments.length, page: parseInt(page), pageSize: limit });
  });

  // POST /api/explore/posts/:postId/comments — 发表评论 [Auth]（支持图片 + 楼中楼）
  router.post('/:postId/comments', authMiddleware, parseCommentImage, (req, res) => {
    const postId = parseInt(req.params.postId);
    const userId = req.user.userId;
    const { content, parent_id } = req.body;
    const imageFile = req.file;

    // 至少需要文字或图片
    if ((!content || !content.trim()) && !imageFile) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '请输入内容或上传图片' });
    }

    // 字数限制
    if (content && content.length > 500) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '评论内容不能超过 500 字' });
    }

    const post = db.get('SELECT id, creator_id, title FROM explore_posts WHERE id = ?', [postId]);
    if (!post) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 楼中楼：校验 parent_id
    const lastComment = db.get(
      'SELECT created_at FROM explore_comments WHERE post_id = ? AND author_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
      [postId, userId]
    );
    const retryAfter = getRemainingCooldownSeconds(lastComment);
    if (retryAfter > 0) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(429).json({ error: `请等待 ${retryAfter} 秒后再发送`, retry_after: retryAfter });
    }

    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, author_id FROM explore_comments WHERE id = ? AND post_id = ?', [parentId, postId]);
      if (!parentComment) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    const imageUrl = imageFile ? `/uploads/comment-images/${imageFile.filename}` : '';

    const result = db.run(
      'INSERT INTO explore_comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, userId, (content || '').trim(), parentId, imageUrl]
    );
    const commentId = result.lastInsertRowid;

    // 通知
    const user = db.get('SELECT nickname, username FROM users WHERE id = ?', [userId]);
    const userName = user?.nickname || user?.username || '某用户';

    if (parentId) {
      const parentComment = db.get('SELECT author_id FROM explore_comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== userId) {
        createNotification(db, {
          userId: parentComment.author_id,
          type: 'comment_reply',
          title: '评论回复',
          message: `${userName} 回复了你在「${post.title}」下的评论`,
          relatedType: 'explore_post',
          relatedId: postId,
          relatedCommentId: commentId
        });
      }
    } else {
      if (post.creator_id !== userId) {
        createNotification(db, {
          userId: post.creator_id,
          type: 'post_comment',
          title: '新评论',
          message: `${userName} 评论了你的帖子「${post.title}」`,
          relatedType: 'explore_post',
          relatedId: postId,
          relatedCommentId: commentId
        });
      }
    }

    db.save();

    // 返回完整评论
    const comment = db.get(
      `SELECT ec.*,
        u.nickname AS author_name,
        u.username AS author_username,
        u.avatar_url AS author_avatar
       FROM explore_comments ec
       LEFT JOIN users u ON u.id = ec.author_id
       WHERE ec.id = ?`,
      [commentId]
    );
    res.status(201).json(comment);
  });

  // DELETE /api/explore/posts/:postId/comments/:commentId — 删除评论 [Auth, 仅作者]（硬删除）
  router.delete('/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const postId = parseInt(req.params.postId);
    const commentId = parseInt(req.params.commentId);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM explore_comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的评论' });

    // 删除图片文件
    const descendants = collectDescendantComments(db, commentId);
    [comment, ...descendants].forEach(c => deleteCommentImage(c.image_url));

    // 硬删除
    const ids = [commentId, ...descendants.map(c => c.id)];
    for (const id of ids) db.run('DELETE FROM explore_comments WHERE id = ?', [id]);
    db.save();

    res.json({ message: '已删除', deleted_count: ids.length, comment_count: getCommentCount(db, postId) });
  });

  // GET /api/explore/posts/:postId/comments/:commentId/replies — 获取楼中楼回复
  router.get('/:postId/comments/:commentId/replies', (req, res) => {
    const commentId = parseInt(req.params.commentId);
    const replies = db.all(
      `SELECT ec.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
       FROM explore_comments ec
       JOIN users u ON ec.author_id = u.id
       WHERE ec.parent_id = ?
       ORDER BY ec.created_at ASC`,
      [commentId]
    );
    res.json(replies);
  });

  return router;
};
