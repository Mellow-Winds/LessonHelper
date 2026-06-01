const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const { createNotification, notifyCourseMembers } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/courses/semesters — 当前用户已选课程涉及的学期列表
  router.get('/semesters', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const rows = db.all(
      'SELECT DISTINCT semester_key FROM user_courses WHERE user_id = ? AND semester_key != "" ORDER BY semester_key DESC',
      [userId]
    );
    res.json(rows.map(r => r.semester_key));
  });

  // GET /api/courses — 当前用户的课程列表（支持学期筛选）
  router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { semester } = req.query;

    let sql = `
      SELECT DISTINCT c.*,
        (SELECT COUNT(*) FROM user_courses uc2 WHERE uc2.course_id = c.id) AS enrollment_count
      FROM courses c
      JOIN user_courses uc ON uc.course_id = c.id
      WHERE uc.user_id = ?
    `;
    const params = [userId];

    if (semester && semester !== 'all') {
      sql += ' AND uc.semester_key = ?';
      params.push(semester);
    }

    sql += ' ORDER BY c.created_at DESC';
    const courses = db.all(sql, params);
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

  // POST /api/courses/:id/enroll — 加入课程 [Auth]
  router.post('/:id/enroll', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const courseId = Number(req.params.id);
    const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const enrolled = db.get(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (enrolled) {
      return res.status(400).json({ error: '已加入该课程' });
    }

    // 检查课程总数上限
    const count = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE user_id = ?',
      [userId]
    );
    if (count.cnt >= 50) {
      return res.status(400).json({ error: '课程总数已达 50 门上限，请先退出部分课程' });
    }

    db.run(
      'INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)',
      [userId, courseId]
    );
    db.save();
    res.json({ message: '加入成功' });
  });

  // DELETE /api/courses/:id/leave — 退出课程 [Auth]
  router.delete('/:id/leave', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const courseId = Number(req.params.id);

    const enrolled = db.get(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (!enrolled) {
      return res.status(400).json({ error: '未加入该课程' });
    }

    db.run(
      'DELETE FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    db.save();
    res.json({ message: '已退出课程' });
  });

  // GET /api/courses/:id/members — 课程成员列表（支持 major/grade 筛选）
  router.get('/:id/members', (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const { major, grade, match_only } = req.query;

    let sql = `
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url, u.qq, u.privacy_show_profile, u.privacy_allow_match
      FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ?
    `;
    const params = [courseId];

    // match_only=1 时过滤掉不允许匹配的用户
    if (match_only === '1') {
      sql += ' AND u.privacy_allow_match = 1';
    }

    if (major) {
      sql += ' AND u.major LIKE ?';
      params.push(`%${major}%`);
    }
    if (grade) {
      sql += ' AND u.grade = ?';
      params.push(grade);
    }

    sql += ' ORDER BY uc.enrolled_at ASC';

    const members = db.all(sql, params);

    // 隐私过滤：privacy_show_profile=0 时隐藏敏感信息
    const result = members.map(m => {
      const { privacy_show_profile, privacy_allow_match, ...rest } = m;
      if (!privacy_show_profile) {
        return { ...rest, major: '', grade: '', qq: '' };
      }
      return rest;
    });

    res.json(result);
  });

  // GET /api/courses/:id/members/stats — 成员专业和年级分布
  router.get('/:id/members/stats', (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    const majors = db.all(`
      SELECT DISTINCT u.major FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ? AND u.major != '' AND u.privacy_allow_match = 1
      ORDER BY u.major ASC
    `, [courseId]).map(r => r.major);

    const grades = db.all(`
      SELECT DISTINCT u.grade FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ? AND u.grade != '' AND u.privacy_allow_match = 1
      ORDER BY u.grade DESC
    `, [courseId]).map(r => r.grade);

    const total = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE course_id = ?',
      [courseId]
    ).cnt;

    res.json({ majors, grades, total });
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

    // 通知：课程有新帖
    const author = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);
    const courseInfo = db.get('SELECT title FROM courses WHERE id = ?', [courseId]);
    notifyCourseMembers(db, {
      courseId, excludeUserId: req.user.userId,
      type: 'new_post', title: '新帖子',
      message: `${author?.nickname || '匿名'} 在「${courseInfo?.title || ''}」发布了「${title}」`,
      relatedType: 'post', relatedId: result.lastInsertRowid
    });
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

    // 通知：帖子有新评论（通知帖子作者）
    const postDetail = db.get('SELECT author_id, title, course_id FROM posts WHERE id = ?', [postId]);
    const commenter = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);
    if (postDetail && postDetail.author_id !== req.user.userId) {
      createNotification(db, {
        userId: postDetail.author_id, type: 'new_comment', title: '新评论',
        message: `${commenter?.nickname || '匿名'} 评论了你的帖子「${postDetail.title}」`,
        relatedType: 'post', relatedId: postId, courseId: postDetail.course_id
      });
      db.save();
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      post_id: postId,
      author_id: req.user.userId,
      content
    });
  });

  return router;
};
