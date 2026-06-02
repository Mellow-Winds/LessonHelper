const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

const EXPIRY_DAYS = 7;

const SQUARE_COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
const SQUARE_COMMENT_IMAGE_MAX = 1 * 1024 * 1024;
const SQUARE_COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

const squareCommentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(SQUARE_COMMENT_IMAGE_DIR, { recursive: true });
      cb(null, SQUARE_COMMENT_IMAGE_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `sq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: SQUARE_COMMENT_IMAGE_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, SQUARE_COMMENT_IMAGE_EXT.has(ext));
  }
});

function parseSquareCommentImage(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  squareCommentUpload.single('image')(req, res, (error) => {
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

module.exports = function (db) {
  const router = express.Router();

  // POST /api/square/posts — 发布帖子 [Auth]
  router.post('/posts', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { title, category, description, max_people } = req.body;

    if (!title || !category) {
      return res.status(400).json({ error: '标题和类型为必填项' });
    }

    const validCategories = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: '无效的需求类型' });
    }

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const result = db.run(
      `INSERT INTO square_posts (creator_id, title, category, description, max_people, current_count, status, expires_at)
       VALUES (?, ?, ?, ?, ?, 0, 'open', ?)`,
      [userId, title.trim(), category, (description || '').trim(), max_people || 1, expiresAt]
    );
    db.save();

    res.status(201).json({ id: result.lastInsertRowid, message: '发布成功' });
  });

  // GET /api/square/posts — 帖子列表 [Auth]
  router.get('/posts', authMiddleware, (req, res) => {
    const { category, page = 1, pageSize = 20 } = req.query;
    const userId = req.user.userId;

    let where = " WHERE sp.expires_at > datetime('now', '+8 hours') AND sp.status != 'expired'";
    const params = [];

    if (category && category !== 'all') {
      where += ' AND sp.category = ?';
      params.push(category);
    }

    // Count
    const total = (db.get(`SELECT COUNT(*) AS cnt FROM square_posts sp${where}`, params) || {}).cnt || 0;

    // Data
    let sql = `
      SELECT sp.*,
        u.nickname AS creator_name,
        (SELECT COUNT(*) FROM square_interests si WHERE si.post_id = sp.id AND si.status = 'accepted') AS confirmed_count,
        (SELECT si2.status FROM square_interests si2 WHERE si2.post_id = sp.id AND si2.user_id = ?) AS my_status
      FROM square_posts sp
      JOIN users u ON sp.creator_id = u.id
      ${where}
      ORDER BY sp.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [userId, ...params];
    const offset = (Number(page) - 1) * Number(pageSize);
    dataParams.push(Number(pageSize), offset);

    const posts = db.all(sql, dataParams);

    // 计算剩余天数
    const result = posts.map(p => {
      const remaining = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));
      return { ...p, remaining_days: remaining };
    });

    res.json({ posts: result, total, page: Number(page), pageSize: Number(pageSize) });
  });

  // GET /api/square/posts/:id — 帖子详情 [Auth]
  router.get('/posts/:id', authMiddleware, (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.user.userId;

    const post = db.get(`
      SELECT sp.*, u.nickname AS creator_name, u.major AS creator_major, u.grade AS creator_grade
      FROM square_posts sp
      JOIN users u ON sp.creator_id = u.id
      WHERE sp.id = ?
    `, [postId]);

    if (!post) return res.status(404).json({ error: '帖子不存在' });

    // 检查过期状态
    if (new Date(post.expires_at) <= new Date()) {
      post.status = 'expired';
    }

    // 已确认成员（显示 QQ）
    const confirmed = db.all(`
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url, u.qq
      FROM square_interests si
      JOIN users u ON si.user_id = u.id
      WHERE si.post_id = ? AND si.status = 'accepted'
      ORDER BY si.created_at ASC
    `, [postId]);

    // 待处理的感兴趣（仅发帖人可见）
    let pending = [];
    if (post.creator_id === userId) {
      pending = db.all(`
        SELECT si.id AS interest_id, si.user_id, si.created_at,
          u.nickname, u.major, u.grade, u.avatar_url
        FROM square_interests si
        JOIN users u ON si.user_id = u.id
        WHERE si.post_id = ? AND si.status = 'pending'
        ORDER BY si.created_at ASC
      `, [postId]);
    }

    // 我的状态
    const myInterest = db.get(
      'SELECT status FROM square_interests WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    const remaining = Math.max(0, Math.ceil((new Date(post.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));

    res.json({
      ...post,
      remaining_days: remaining,
      confirmed,
      pending,
      my_status: myInterest ? myInterest.status : null
    });
  });

  // DELETE /api/square/posts/:id — 删除帖子 [Auth, 仅创建者]
  router.delete('/posts/:id', authMiddleware, (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.user.userId;

    const post = db.get('SELECT * FROM square_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id !== userId) return res.status(403).json({ error: '只能删除自己发布的帖子' });

    db.run('DELETE FROM square_posts WHERE id = ?', [postId]);
    db.save();
    res.json({ message: '已删除' });
  });

  // POST /api/square/posts/:id/interest — 表示感兴趣 [Auth]
  router.post('/posts/:id/interest', authMiddleware, (req, res) => {
    const postId = Number(req.params.id);
    const userId = req.user.userId;

    const post = db.get('SELECT * FROM square_posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id === userId) return res.status(400).json({ error: '不能对自己的帖子感兴趣' });
    if (post.status !== 'open') return res.status(400).json({ error: '该帖子已不再接受申请' });
    if (new Date(post.expires_at) <= new Date()) return res.status(400).json({ error: '该帖子已过期' });

    const existing = db.get(
      'SELECT * FROM square_interests WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );
    if (existing) return res.status(400).json({ error: '你已经申请过了' });

    db.run(
      "INSERT INTO square_interests (post_id, user_id, status) VALUES (?, ?, 'pending')",
      [postId, userId]
    );
    db.save();

    // 通知发帖人
    const applicant = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);
    createNotification(db, {
      userId: post.creator_id, type: 'square_interest', title: '有人对你的帖子感兴趣',
      message: `${applicant?.nickname || '匿名'} 对「${post.title}」感兴趣`,
      relatedType: 'square_post', relatedId: postId
    });
    db.save();

    res.json({ message: '已申请，等待对方确认' });
  });

  // PUT /api/square/interests/:id — 接受/拒绝 [Auth]
  router.put('/interests/:id', authMiddleware, (req, res) => {
    const interestId = Number(req.params.id);
    const userId = req.user.userId;
    const { action } = req.body; // 'accept' | 'reject'

    const interest = db.get('SELECT * FROM square_interests WHERE id = ?', [interestId]);
    if (!interest) return res.status(404).json({ error: '记录不存在' });

    const post = db.get('SELECT * FROM square_posts WHERE id = ?', [interest.post_id]);
    if (!post || post.creator_id !== userId) return res.status(403).json({ error: '无权操作' });
    if (interest.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });

    if (action === 'reject') {
      db.run("UPDATE square_interests SET status = 'rejected' WHERE id = ?", [interestId]);
      db.save();
      return res.json({ message: '已拒绝' });
    }

    // accept — 从实际数据计算当前人数，避免漂移
    const actualCount = db.get(
      "SELECT COUNT(*) AS cnt FROM square_interests WHERE post_id = ? AND status = 'accepted'",
      [post.id]
    );
    if (actualCount.cnt >= post.max_people) {
      return res.status(400).json({ error: '人数已满' });
    }

    db.run("UPDATE square_interests SET status = 'accepted' WHERE id = ?", [interestId]);
    const newCount = actualCount.cnt + 1;
    db.run('UPDATE square_posts SET current_count = ? WHERE id = ?', [newCount, post.id]);

    // 满员时自动更新状态
    if (newCount >= post.max_people) {
      db.run("UPDATE square_posts SET status = 'full' WHERE id = ?", [post.id]);
    }
    db.save();

    // 通知申请人
    createNotification(db, {
      userId: interest.user_id, type: 'square_accepted', title: '申请已通过',
      message: `你对「${post.title}」的申请已被接受，可查看联系方式`,
      relatedType: 'square_post', relatedId: post.id
    });
    db.save();

    res.json({ message: '已接受' });
  });

  // GET /api/square/my — 我的广场 [Auth]
  router.get('/my', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { type } = req.query; // created | interested

    if (type === 'created') {
      const posts = db.all(`
        SELECT sp.*,
          (SELECT COUNT(*) FROM square_interests si WHERE si.post_id = sp.id AND si.status = 'accepted') AS confirmed_count,
          (SELECT COUNT(*) FROM square_interests si WHERE si.post_id = sp.id AND si.status = 'pending') AS pending_count
        FROM square_posts sp
        WHERE sp.creator_id = ?
        ORDER BY sp.created_at DESC
      `, [userId]);
      return res.json(posts);
    }

    if (type === 'interested') {
      const posts = db.all(`
        SELECT sp.*, u.nickname AS creator_name,
          si.status AS my_status,
          (SELECT COUNT(*) FROM square_interests si2 WHERE si2.post_id = sp.id AND si2.status = 'accepted') AS confirmed_count
        FROM square_interests si
        JOIN square_posts sp ON si.post_id = sp.id
        JOIN users u ON sp.creator_id = u.id
        WHERE si.user_id = ?
        ORDER BY si.created_at DESC
      `, [userId]);
      return res.json(posts);
    }

    res.status(400).json({ error: 'type 参数无效' });
  });

  // GET /api/square/posts/:id/comments — 评论列表（分页 + 楼中楼）
  router.get('/posts/:id/comments', (req, res) => {
    const postId = Number(req.params.id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const total = (db.get('SELECT COUNT(*) AS cnt FROM square_comments WHERE post_id = ?', [postId]) || {}).cnt || 0;

    const comments = db.all(`
      SELECT sc.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM square_comments sc
      JOIN users u ON sc.author_id = u.id
      WHERE sc.post_id = ?
      ORDER BY sc.created_at ASC
      LIMIT ? OFFSET ?
    `, [postId, pageSize, offset]);

    res.json({ comments, total, page, pageSize });
  });

  // POST /api/square/posts/:id/comments — 发评论 [Auth]（支持图片 + 楼中楼）
  router.post('/posts/:id/comments', authMiddleware, parseSquareCommentImage, (req, res) => {
    const postId = Number(req.params.id);
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
      return res.status(400).json({ error: '回复内容不能超过 500 字' });
    }

    const post = db.get('SELECT id, creator_id, title FROM square_posts WHERE id = ?', [postId]);
    if (!post) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 楼中楼：校验 parent_id
    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, post_id FROM square_comments WHERE id = ?', [parentId]);
      if (!parentComment || parentComment.post_id !== postId) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    const imageUrl = imageFile ? `/uploads/comment-images/${imageFile.filename}` : '';

    const result = db.run(
      'INSERT INTO square_comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, userId, (content || '').trim(), parentId, imageUrl]
    );
    db.save();

    // 通知逻辑
    const commenter = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);

    if (parentId) {
      // 楼中楼回复：通知被回复的用户
      const parentComment = db.get('SELECT author_id FROM square_comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== userId) {
        createNotification(db, {
          userId: parentComment.author_id, type: 'new_comment', title: '新回复',
          message: `${commenter?.nickname || '匿名'} 回复了你的评论`,
          relatedType: 'square_post', relatedId: postId
        });
        db.save();
      }
    } else {
      // 主回复：通知帖子作者
      if (post.creator_id !== userId) {
        createNotification(db, {
          userId: post.creator_id, type: 'new_comment', title: '新评论',
          message: `${commenter?.nickname || '匿名'} 评论了你的帖子「${post.title}」`,
          relatedType: 'square_post', relatedId: postId
        });
        db.save();
      }
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      post_id: postId,
      author_id: userId,
      content: (content || '').trim(),
      parent_id: parentId,
      image_url: imageUrl
    });
  });

  // DELETE /api/square/posts/:id/comments/:commentId — 删除自己的回复
  router.delete('/posts/:id/comments/:commentId', authMiddleware, (req, res) => {
    const commentId = Number(req.params.commentId);
    const postId = Number(req.params.id);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM square_comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的回复' });

    // 删除图片文件
    if (comment.image_url) {
      const imgPath = path.join(__dirname, '..', comment.image_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    // 软删除：标记为已删除，保留楼层号
    db.run("UPDATE square_comments SET content = '[已删除]', image_url = '' WHERE id = ?", [commentId]);
    db.save();

    res.json({ message: '已删除' });
  });

  // GET /api/square/posts/:id/comments/:commentId/replies — 获取楼中楼回复
  router.get('/posts/:id/comments/:commentId/replies', (req, res) => {
    const commentId = Number(req.params.commentId);
    const replies = db.all(`
      SELECT sc.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM square_comments sc
      JOIN users u ON sc.author_id = u.id
      WHERE sc.parent_id = ?
      ORDER BY sc.created_at ASC
    `, [commentId]);
    res.json(replies);
  });

  return router;
};
