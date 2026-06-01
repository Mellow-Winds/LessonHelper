const express = require('express');
const { authMiddleware } = require('./middleware/auth');

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

  // GET /api/user/:id/profile — 公开名片（含关注计数 + 隐私过滤）
  router.get('/:id/profile', (req, res) => {
    const userId = Number(req.params.id);
    const viewerId = req.query.viewer_id ? Number(req.query.viewer_id) : null;

    const user = db.get(
      'SELECT id, nickname, major, grade, avatar_url, avatar_desc, mbti, qq, wechat, douyin, privacy_show_profile, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ error: '用户不存在' });

    // 隐私过滤：如果设置了不公开且不是本人查看
    if (!user.privacy_show_profile && viewerId !== userId) {
      return res.json({
        id: user.id,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        privacyHidden: true
      });
    }

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

    res.json({
      ...user,
      followingCount,
      followerCount,
      isFollowing
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
      SELECT u.id, u.nickname, u.major, u.grade, u.avatar_url
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
      SELECT u.id, u.nickname, u.major, u.grade, u.avatar_url
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
