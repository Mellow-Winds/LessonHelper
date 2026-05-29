const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // GET /api/courses - 获取课程列表
  router.get('/', (req, res) => {
    const courses = db.all('SELECT * FROM courses ORDER BY created_at DESC');
    res.json(courses);
  });

  // GET /api/courses/:id - 获取课程详情
  router.get('/:id', (req, res) => {
    const course = db.get('SELECT * FROM courses WHERE id = ?', [Number(req.params.id)]);
    if (!course) return res.status(404).json({ error: '课程不存在' });
    res.json(course);
  });

  // POST /api/courses - 创建课程
  router.post('/', (req, res) => {
    const { title, description, owner_id } = req.body;
    if (!title || !owner_id) {
      return res.status(400).json({ error: 'title 和 owner_id 为必填项' });
    }
    const result = db.run(
      'INSERT INTO courses (title, description, owner_id) VALUES (?, ?, ?)',
      [title, description || '', owner_id]
    );
    db.save();
    res.status(201).json({ id: result.lastInsertRowid, title, description, owner_id });
  });

  // GET /api/courses/:id/posts - 获取课程帖子列表
  router.get('/:id/posts', (req, res) => {
    const posts = db.all(
      'SELECT p.*, u.display_name AS author_name FROM posts p JOIN users u ON p.author_id = u.id WHERE p.course_id = ? ORDER BY p.created_at DESC',
      [Number(req.params.id)]
    );
    res.json(posts);
  });

  // POST /api/courses/:id/posts - 创建帖子
  router.post('/:id/posts', (req, res) => {
    const { author_id, title, content } = req.body;
    if (!author_id || !title || !content) {
      return res.status(400).json({ error: 'author_id, title, content 为必填项' });
    }
    const result = db.run(
      'INSERT INTO posts (course_id, author_id, title, content) VALUES (?, ?, ?, ?)',
      [Number(req.params.id), author_id, title, content]
    );
    db.save();
    res.status(201).json({ id: result.lastInsertRowid, course_id: Number(req.params.id), author_id, title, content });
  });

  // GET /api/courses/posts/:postId/comments - 获取帖子评论
  router.get('/posts/:postId/comments', (req, res) => {
    const comments = db.all(
      'SELECT c.*, u.display_name AS author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC',
      [Number(req.params.postId)]
    );
    res.json(comments);
  });

  // POST /api/courses/posts/:postId/comments - 创建评论
  router.post('/posts/:postId/comments', (req, res) => {
    const { author_id, content } = req.body;
    if (!author_id || !content) {
      return res.status(400).json({ error: 'author_id 和 content 为必填项' });
    }
    const result = db.run(
      'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)',
      [Number(req.params.postId), author_id, content]
    );
    db.save();
    res.status(201).json({ id: result.lastInsertRowid, post_id: Number(req.params.postId), author_id, content });
  });

  return router;
};
