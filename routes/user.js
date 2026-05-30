const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/user/:id — 用户公开信息
  router.get('/:id', (req, res) => {
    const user = db.get(
      'SELECT id, username, nickname, major, grade, avatar_url, created_at FROM users WHERE id = ?',
      [Number(req.params.id)]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json(user);
  });

  // GET /api/user/:id/courses — 用户参加的课程（通过 user_courses）
  router.get('/:id/courses', (req, res) => {
    const courses = db.all(`
      SELECT c.*, uc.enrolled_at
      FROM courses c
      JOIN user_courses uc ON c.id = uc.course_id
      WHERE uc.user_id = ?
      ORDER BY uc.enrolled_at DESC
    `, [Number(req.params.id)]);
    res.json(courses);
  });

  return router;
};
