const express = require('express');

module.exports = function(db) {
  const router = express.Router();

  // POST /api/user/register - 注册用户
  router.post('/register', (req, res) => {
    const { username, display_name } = req.body;
    if (!username || !display_name) {
      return res.status(400).json({ error: 'username 和 display_name 为必填项' });
    }
    try {
      const result = db.run(
        'INSERT INTO users (username, display_name) VALUES (?, ?)',
        [username, display_name]
      );
      db.save();
      res.status(201).json({ id: result.lastInsertRowid, username, display_name });
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: '用户名已存在' });
      }
      res.status(500).json({ error: '服务器错误' });
    }
  });

  // GET /api/user/:id - 获取用户信息
  router.get('/:id', (req, res) => {
    const user = db.get(
      'SELECT id, username, display_name, avatar_url, created_at FROM users WHERE id = ?',
      [Number(req.params.id)]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  });

  // GET /api/user/:id/courses - 获取用户的课程
  router.get('/:id/courses', (req, res) => {
    const courses = db.all(
      'SELECT * FROM courses WHERE owner_id = ? ORDER BY created_at DESC',
      [Number(req.params.id)]
    );
    res.json(courses);
  });

  return router;
};
