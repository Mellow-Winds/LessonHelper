const express = require('express');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/search — 全局搜索
  router.get('/', (req, res) => {
    const { q, type = 'all', page = 1, pageSize = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: '关键词至少 2 个字符' });
    }

    const keyword = `%${q.trim()}%`;
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const results = {};

    if (type === 'all' || type === 'courses') {
      results.courses = db.all(`
        SELECT c.id, c.title, c.teacher, c.semester,
          (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
        FROM courses c
        WHERE c.title LIKE ? OR c.description LIKE ? OR c.teacher LIKE ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `, [keyword, keyword, keyword, limit]);
    }

    if (type === 'all' || type === 'materials') {
      results.materials = db.all(`
        SELECT m.id, m.title, m.chapter, m.category, m.course_id, m.created_at,
          c.title AS course_title, u.nickname AS uploader_name
        FROM materials m
        JOIN courses c ON m.course_id = c.id
        JOIN users u ON m.uploader_id = u.id
        WHERE m.title LIKE ? OR m.description LIKE ? OR m.chapter LIKE ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [keyword, keyword, keyword, limit]);
    }

    if (type === 'all' || type === 'posts') {
      results.posts = db.all(`
        SELECT p.id, p.title, p.content, p.course_id, p.created_at,
          c.title AS course_title, u.nickname AS author_name
        FROM posts p
        JOIN courses c ON p.course_id = c.id
        JOIN users u ON p.author_id = u.id
        WHERE p.title LIKE ? OR p.content LIKE ?
        ORDER BY p.created_at DESC
        LIMIT ?
      `, [keyword, keyword, limit]);
    }

    const total = (results.courses?.length || 0) + (results.materials?.length || 0) + (results.posts?.length || 0);
    res.json({ ...results, total, q: q.trim() });
  });

  return router;
};
