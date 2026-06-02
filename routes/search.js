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

    let total = 0;

    if (type === 'all' || type === 'courses') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM courses c WHERE c.title LIKE ? OR c.description LIKE ? OR c.teacher LIKE ?`, [keyword, keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.courses = db.all(`
        SELECT c.id, c.title, c.teacher, c.semester,
          (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
        FROM courses c
        WHERE c.title LIKE ? OR c.description LIKE ? OR c.teacher LIKE ?
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'materials') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM materials m WHERE m.title LIKE ? OR m.description LIKE ? OR m.chapter LIKE ?`, [keyword, keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.materials = db.all(`
        SELECT m.id, m.title, m.chapter, m.category, m.course_id, m.created_at,
          c.title AS course_title, u.nickname AS uploader_name
        FROM materials m
        JOIN courses c ON m.course_id = c.id
        JOIN users u ON m.uploader_id = u.id
        WHERE m.title LIKE ? OR m.description LIKE ? OR m.chapter LIKE ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'posts') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM posts p WHERE p.title LIKE ? OR p.content LIKE ?`, [keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.posts = db.all(`
        SELECT p.id, p.title, p.content, p.course_id, p.created_at,
          c.title AS course_title, u.nickname AS author_name
        FROM posts p
        JOIN courses c ON p.course_id = c.id
        JOIN users u ON p.author_id = u.id
        WHERE p.title LIKE ? OR p.content LIKE ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, limit, offset]);
    }

    if (type === 'all' || type === 'squarePosts') {
      const countResult = db.all(`SELECT COUNT(*) AS cnt FROM square_posts sp WHERE (sp.title LIKE ? OR sp.description LIKE ?) AND sp.expires_at > datetime('now', '+8 hours') AND sp.status != 'expired'`, [keyword, keyword]);
      total += countResult[0]?.cnt || 0;
      results.squarePosts = db.all(`
        SELECT sp.id, sp.title, sp.description, sp.category, sp.status,
          sp.max_people, sp.current_count, sp.expires_at, sp.created_at,
          u.nickname AS creator_name
        FROM square_posts sp
        JOIN users u ON sp.creator_id = u.id
        WHERE (sp.title LIKE ? OR sp.description LIKE ?)
          AND sp.expires_at > datetime('now', '+8 hours')
          AND sp.status != 'expired'
        ORDER BY sp.created_at DESC
        LIMIT ? OFFSET ?
      `, [keyword, keyword, limit, offset]);
    }
    res.json({ ...results, total, q: q.trim() });
  });

  return router;
};
