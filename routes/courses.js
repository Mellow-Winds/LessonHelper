const express = require('express');
const { authMiddleware } = require('./middleware/auth');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/courses — 课程列表（含选课人数）
  router.get('/', (req, res) => {
    const courses = db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
      FROM courses c
      ORDER BY c.created_at DESC
    `);
    res.json(courses);
  });

  // GET /api/courses/:id — 课程详情
  router.get('/:id', (req, res) => {
    const course = db.get(`
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
      FROM courses c
      WHERE c.id = ?
    `, [Number(req.params.id)]);
    if (!course) return res.status(404).json({ error: '课程不存在' });
    res.json(course);
  });

  // POST /api/courses — 创建课程 [Auth]
  router.post('/', authMiddleware, (req, res) => {
    const { title, description, semester, teacher } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }

    const result = db.run(
      'INSERT INTO courses (title, description, owner_id, semester, teacher) VALUES (?, ?, ?, ?, ?)',
      [title, description || '', req.user.userId, semester || '', teacher || '']
    );

    // 创建者自动加入课程
    db.run(
      'INSERT OR IGNORE INTO user_courses (user_id, course_id) VALUES (?, ?)',
      [req.user.userId, result.lastInsertRowid]
    );

    db.save();

    const course = db.get('SELECT * FROM courses WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(course);
  });

  // POST /api/courses/:id/enroll — 加入课程 [Auth]
  router.post('/:id/enroll', authMiddleware, (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const enrolled = db.get(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [req.user.userId, courseId]
    );
    if (enrolled) {
      return res.status(400).json({ error: '已加入该课程' });
    }

    db.run(
      'INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)',
      [req.user.userId, courseId]
    );
    db.save();
    res.json({ message: '加入成功' });
  });

  // GET /api/courses/:id/members — 课程成员列表
  router.get('/:id/members', (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const members = db.all(`
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url
      FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ?
      ORDER BY uc.enrolled_at ASC
    `, [courseId]);
    res.json(members);
  });

  // GET /api/courses/:id/posts — 帖子列表
  router.get('/:id/posts', (req, res) => {
    const posts = db.all(`
      SELECT p.*, u.nickname AS author_name,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.course_id = ?
      ORDER BY p.created_at DESC
    `, [Number(req.params.id)]);
    res.json(posts);
  });

  // POST /api/courses/:id/posts — 发帖 [Auth]
  router.post('/:id/posts', authMiddleware, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title 和 content 为必填项' });
    }

    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const result = db.run(
      'INSERT INTO posts (course_id, author_id, title, content) VALUES (?, ?, ?, ?)',
      [courseId, req.user.userId, title, content]
    );
    db.save();

    res.status(201).json({
      id: result.lastInsertRowid,
      course_id: courseId,
      author_id: req.user.userId,
      title,
      content
    });
  });

  // GET /api/courses/posts/:postId/comments — 评论列表
  router.get('/posts/:postId/comments', (req, res) => {
    const comments = db.all(`
      SELECT c.*, u.nickname AS author_name
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [Number(req.params.postId)]);
    res.json(comments);
  });

  // POST /api/courses/posts/:postId/comments — 发评论 [Auth]
  router.post('/posts/:postId/comments', authMiddleware, (req, res) => {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content 为必填项' });
    }

    const postId = Number(req.params.postId);
    const post = db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });

    const result = db.run(
      'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)',
      [postId, req.user.userId, content]
    );
    db.save();

    res.status(201).json({
      id: result.lastInsertRowid,
      post_id: postId,
      author_id: req.user.userId,
      content
    });
  });

  return router;
};
