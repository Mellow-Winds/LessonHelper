const express = require('express');
const { authMiddleware, optionalAuthMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // GET /api/user/feed — 关注动态 [Auth]
  router.get('/feed', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 50);
    const offset = (page - 1) * pageSize;

    const activities = db.all(`
      SELECT * FROM (
        SELECT 'material' AS activity_type, m.id AS related_id, m.course_id,
          u.id AS author_id, u.nickname AS author_name, m.title,
          c.title AS context_title, m.description AS summary, m.created_at
        FROM follows f
        JOIN materials m ON m.uploader_id = f.following_id
        JOIN users u ON u.id = m.uploader_id
        JOIN courses c ON c.id = m.course_id
        WHERE f.follower_id = ?

        UNION ALL

        SELECT 'invite' AS activity_type, si.id AS related_id, si.course_id,
          u.id AS author_id, u.nickname AS author_name, si.title,
          COALESCE(c.title, '公开自习邀约') AS context_title, si.description AS summary, si.created_at
        FROM follows f
        JOIN study_invites si ON si.creator_id = f.following_id
        JOIN users u ON u.id = si.creator_id
        LEFT JOIN courses c ON c.id = si.course_id
        WHERE f.follower_id = ? AND si.status IN ('open', 'full') AND si.study_date >= date('now')

        UNION ALL

        SELECT 'square_post' AS activity_type, sp.id AS related_id, NULL AS course_id,
          u.id AS author_id, u.nickname AS author_name, sp.title,
          sp.category AS context_title, sp.description AS summary, sp.created_at
        FROM follows f
        JOIN square_posts sp ON sp.creator_id = f.following_id
        JOIN users u ON u.id = sp.creator_id
        WHERE f.follower_id = ? AND sp.status IN ('open', 'full') AND sp.expires_at > datetime('now')
      ) activities
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, userId, pageSize, offset]);

    res.json({ activities, page, pageSize });
  });

  // GET /api/user/:id — 用户公开信息
  router.get('/:id', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const user = db.get(
      'SELECT id, nickname, major, grade, avatar_url, privacy_show_profile, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.privacy_show_profile && req.user?.userId !== userId) {
      return res.json({ id: user.id, nickname: user.nickname, avatar_url: user.avatar_url, privacyHidden: true });
    }
    const { privacy_show_profile, ...publicUser } = user;
    res.json(publicUser);
  });

  // GET /api/user/:id/courses — 用户参加的课程（通过 user_courses）
  router.get('/:id/courses', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const user = db.get('SELECT id, privacy_show_profile FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.privacy_show_profile && req.user?.userId !== userId) {
      return res.status(403).json({ error: '该用户未公开个人资料' });
    }
    const courses = db.all(`
      SELECT c.*, uc.enrolled_at
      FROM courses c
      JOIN user_courses uc ON c.id = uc.course_id
      WHERE uc.user_id = ?
      ORDER BY uc.enrolled_at DESC
    `, [userId]);
    res.json(courses);
  });

  // GET /api/user/:id/profile — 公开名片（含关注计数 + 隐私过滤）
  router.get('/:id/profile', optionalAuthMiddleware, (req, res) => {
    const userId = Number(req.params.id);
    const viewerId = req.user?.userId || null;

    const user = db.get(
      'SELECT id, nickname, major, grade, avatar_url, avatar_desc, mbti, qq, wechat, douyin, privacy_show_profile, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 获取关注/粉丝数
    const followingCount = db.get(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId]
    )?.count || 0;
    const followerCount = db.get(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [userId]
    )?.count || 0;

    // 是否被当前查看者关注
    let isFollowing = false;
    if (viewerId && viewerId !== userId) {
      const follow = db.get(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [viewerId, userId]
      );
      isFollowing = !!follow;
    }

    // 隐私过滤：如果设置了不公开且不是本人查看
    if (!user.privacy_show_profile && viewerId !== userId) {
      return res.json({
        id: user.id,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        privacyHidden: true,
        followingCount,
        followerCount,
        isFollowing
      });
    }

    const commonCourses = viewerId && viewerId !== userId
      ? db.all(`
          SELECT c.id, c.title, c.teacher
          FROM courses c
          JOIN user_courses mine ON mine.course_id = c.id AND mine.user_id = ?
          JOIN user_courses theirs ON theirs.course_id = c.id AND theirs.user_id = ?
          ORDER BY c.title ASC
        `, [viewerId, userId])
      : [];

    res.json({
      ...user,
      followingCount,
      followerCount,
      isFollowing,
      commonCourses
    });
  });

  // POST /api/user/:id/follow — 关注用户
  router.post('/:id/follow', authMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const myId = req.user.userId;

    if (targetId === myId) {
      return res.status(400).json({ error: '不能关注自己' });
    }

    const target = db.get('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    const existing = db.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [myId, targetId]
    );
    if (existing) {
      return res.status(409).json({ error: '已经关注了' });
    }

    db.run(
      'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
      [myId, targetId]
    );
    const follower = db.get('SELECT nickname FROM users WHERE id = ?', [myId]);
    createNotification(db, {
      userId: targetId,
      type: 'new_follower',
      title: '新的关注',
      message: `${follower?.nickname || '一位同学'} 关注了你`,
      relatedType: 'user',
      relatedId: myId
    });
    db.save();

    res.json({ success: true });
  });

  // DELETE /api/user/:id/follow — 取消关注
  router.delete('/:id/follow', authMiddleware, (req, res) => {
    const targetId = Number(req.params.id);
    const myId = req.user.userId;

    db.run(
      'DELETE FROM follows WHERE follower_id = ? AND following_id = ?',
      [myId, targetId]
    );
    db.save();

    res.json({ success: true });
  });

  // GET /api/user/:id/followers — 粉丝列表
  router.get('/:id/followers', (req, res) => {
    const userId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const list = db.all(`
      SELECT u.id, u.nickname,
        CASE WHEN u.privacy_show_profile = 1 THEN u.major ELSE '' END AS major,
        CASE WHEN u.privacy_show_profile = 1 THEN u.grade ELSE '' END AS grade,
        u.avatar_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    res.json(list);
  });

  // GET /api/user/:id/following — 关注列表
  router.get('/:id/following', (req, res) => {
    const userId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const list = db.all(`
      SELECT u.id, u.nickname,
        CASE WHEN u.privacy_show_profile = 1 THEN u.major ELSE '' END AS major,
        CASE WHEN u.privacy_show_profile = 1 THEN u.grade ELSE '' END AS grade,
        u.avatar_url
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);

    res.json(list);
  });

  // POST /api/user/feedback — 问题反馈
  router.post('/feedback', authMiddleware, (req, res) => {
    const { category, content, contact } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '反馈内容不能为空' });
    }

    db.run(
      'INSERT INTO feedback (user_id, category, content, contact) VALUES (?, ?, ?, ?)',
      [req.user.userId, category || 'bug', content.trim(), contact || '']
    );
    db.save();

    res.json({ success: true });
  });

  return router;
};
