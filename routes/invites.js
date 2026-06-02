const express = require('express');
const { authMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

module.exports = function (db) {
  const router = express.Router();

  // POST /api/invites — 发布邀约 [Auth]
  router.post('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { course_id, title, description, study_date, start_time, end_time, location, max_participants } = req.body;

    if (!title || !study_date || !start_time || !end_time) {
      return res.status(400).json({ error: '标题、日期、时间为必填项' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: '结束时间必须晚于开始时间' });
    }

    const result = db.run(
      `INSERT INTO study_invites (creator_id, course_id, title, description, study_date, start_time, end_time, location, max_participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, course_id || null, title.trim(), (description || '').trim(), study_date, start_time, end_time, (location || '').trim(), max_participants || 4]
    );
    db.save();

    // 创建者自动加入
    db.run(
      'INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (?, ?, ?)',
      [result.lastInsertRowid, userId, 'accepted']
    );
    db.save();

    res.status(201).json({ id: result.lastInsertRowid, message: '发布成功' });
  });

  // GET /api/invites — 浏览邀约列表
  router.get('/', (req, res) => {
    const { course_id, date, status, page = 1, pageSize = 20 } = req.query;

    let where = ' WHERE 1=1';
    const params = [];

    if (course_id) {
      where += ' AND si.course_id = ?';
      params.push(Number(course_id));
    }
    if (date === 'today') {
      where += " AND si.study_date = date('now', '+8 hours')";
    } else if (date === 'week') {
      where += " AND si.study_date BETWEEN date('now', '+8 hours') AND date('now', '+8 hours', '+7 days')";
    } else if (date && date !== 'all') {
      where += ' AND si.study_date = ?';
      params.push(date);
    }
    if (status && status !== 'all') {
      where += ' AND si.status = ?';
      params.push(status);
    }

    // Count
    const total = (db.get(`SELECT COUNT(*) AS total FROM study_invites si${where}`, params) || {}).total || 0;

    // Data
    const userId = req.user ? req.user.userId : null;
    let sql = `
      SELECT si.*,
        u.nickname AS creator_name,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count
        ${userId ? `, (SELECT sir2.status FROM study_invite_responses sir2 WHERE sir2.invite_id = si.id AND sir2.user_id = ?) AS my_status` : ''}
      FROM study_invites si
      JOIN users u ON si.creator_id = u.id
      ${where}
      ORDER BY si.study_date ASC, si.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = userId ? [userId, ...params] : [...params];
    const offset = (Number(page) - 1) * Number(pageSize);
    dataParams.push(Number(pageSize), offset);

    const invites = db.all(sql, dataParams);
    res.json({ invites, total, page: Number(page), pageSize: Number(pageSize) });
  });

  // GET /api/invites/my — 我发起的 + 我参与的 [Auth]
  router.get('/my', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { type } = req.query; // created | joined | all

    let invites;
    if (type === 'created') {
      invites = db.all(`
        SELECT si.*,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count
        FROM study_invites si
        WHERE si.creator_id = ?
        ORDER BY si.study_date DESC, si.start_time DESC
      `, [userId]);
    } else if (type === 'joined') {
      invites = db.all(`
        SELECT si.*, u.nickname AS creator_name,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          'accepted' AS my_status
        FROM study_invite_responses sir
        JOIN study_invites si ON sir.invite_id = si.id
        JOIN users u ON si.creator_id = u.id
        WHERE sir.user_id = ? AND sir.status = 'accepted' AND si.creator_id != ?
        ORDER BY si.study_date DESC, si.start_time DESC
      `, [userId, userId]);
    } else {
      // all: both created and joined
      const created = db.all(`
        SELECT si.*, 'creator' AS role,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count
        FROM study_invites si WHERE si.creator_id = ?
      `, [userId]);
      const joined = db.all(`
        SELECT si.*, u.nickname AS creator_name, 'participant' AS role,
          (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count,
          'accepted' AS my_status
        FROM study_invite_responses resp
        JOIN study_invites si ON resp.invite_id = si.id
        JOIN users u ON si.creator_id = u.id
        WHERE resp.user_id = ? AND resp.status = 'accepted' AND si.creator_id != ?
      `, [userId, userId]);
      invites = [...created, ...joined].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    res.json(invites);
  });

  // GET /api/invites/:id — 邀约详情 + 参与者
  router.get('/:id', (req, res) => {
    const inviteId = Number(req.params.id);
    const invite = db.get(`
      SELECT si.*, u.nickname AS creator_name,
        (SELECT COUNT(*) FROM study_invite_responses sir WHERE sir.invite_id = si.id AND sir.status = 'accepted') AS participant_count
      FROM study_invites si
      JOIN users u ON si.creator_id = u.id
      WHERE si.id = ?
    `, [inviteId]);

    if (!invite) return res.status(404).json({ error: '邀约不存在' });

    const participants = db.all(`
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url
      FROM study_invite_responses sir
      JOIN users u ON sir.user_id = u.id
      WHERE sir.invite_id = ? AND sir.status = 'accepted'
      ORDER BY sir.created_at ASC
    `, [inviteId]);

    res.json({ ...invite, participants });
  });

  // POST /api/invites/:id/respond — 响应邀约（加入/取消）[Auth]
  router.post('/:id/respond', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;
    const { action } = req.body; // 'join' | 'cancel'

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });

    if (invite.status === 'closed') {
      return res.status(400).json({ error: '该邀约已关闭' });
    }
    if (invite.status === 'expired') {
      return res.status(400).json({ error: '该邀约已过期' });
    }

    const existing = db.get(
      'SELECT * FROM study_invite_responses WHERE invite_id = ? AND user_id = ?',
      [inviteId, userId]
    );

    if (action === 'cancel') {
      if (!existing) return res.status(400).json({ error: '你未参与该邀约' });
      db.run('DELETE FROM study_invite_responses WHERE invite_id = ? AND user_id = ?', [inviteId, userId]);
      // 如果之前满了，恢复为 open
      if (invite.status === 'full') {
        db.run("UPDATE study_invites SET status = 'open' WHERE id = ?", [inviteId]);
      }
      db.save();
      return res.json({ message: '已取消参与' });
    }

    // join
    if (existing) return res.status(400).json({ error: '你已参与该邀约' });
    if (invite.creator_id === userId) return res.status(400).json({ error: '你是邀约发起人，无需重复加入' });

    // 检查人数上限（max_participants 包含创建者，需预留 1 个名额）
    const count = db.get(
      "SELECT COUNT(*) AS cnt FROM study_invite_responses WHERE invite_id = ? AND status = 'accepted'",
      [inviteId]
    );
    if (count.cnt >= invite.max_participants - 1) {
      return res.status(400).json({ error: '人数已满' });
    }

    db.run(
      "INSERT INTO study_invite_responses (invite_id, user_id, status) VALUES (?, ?, 'accepted')",
      [inviteId, userId]
    );

    // 满员时自动更新状态
    if (count.cnt + 1 >= invite.max_participants - 1) {
      db.run("UPDATE study_invites SET status = 'full' WHERE id = ?", [inviteId]);
    }
    db.save();

    // 通知邀约创建者
    const joiner = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);
    if (invite.creator_id !== userId) {
      createNotification(db, {
        userId: invite.creator_id, type: 'invite_join', title: '有人加入自习',
        message: `${joiner?.nickname || '匿名'} 加入了你的自习邀约「${invite.title}」`,
        relatedType: 'invite', relatedId: inviteId
      });
      db.save();
    }

    res.json({ message: '加入成功' });
  });

  // PUT /api/invites/:id — 编辑邀约 [Auth, 仅创建者]
  router.put('/:id', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });
    if (invite.creator_id !== userId) return res.status(403).json({ error: '只能编辑自己发布的邀约' });

    const { title, description, study_date, start_time, end_time, location, max_participants, status } = req.body;

    db.run(
      `UPDATE study_invites SET title = ?, description = ?, study_date = ?, start_time = ?, end_time = ?, location = ?, max_participants = ?, status = ? WHERE id = ?`,
      [
        title !== undefined ? title.trim() : invite.title,
        description !== undefined ? description.trim() : invite.description,
        study_date || invite.study_date,
        start_time || invite.start_time,
        end_time || invite.end_time,
        location !== undefined ? location.trim() : invite.location,
        max_participants || invite.max_participants,
        status || invite.status,
        inviteId
      ]
    );
    db.save();
    res.json({ message: '更新成功' });
  });

  // DELETE /api/invites/:id — 取消邀约 [Auth, 仅创建者]
  router.delete('/:id', authMiddleware, (req, res) => {
    const inviteId = Number(req.params.id);
    const userId = req.user.userId;

    const invite = db.get('SELECT * FROM study_invites WHERE id = ?', [inviteId]);
    if (!invite) return res.status(404).json({ error: '邀约不存在' });
    if (invite.creator_id !== userId) return res.status(403).json({ error: '只能取消自己发布的邀约' });

    // 通知所有参与者
    const participants = db.all(
      "SELECT user_id FROM study_invite_responses WHERE invite_id = ? AND user_id != ?",
      [inviteId, userId]
    );
    for (const p of participants) {
      createNotification(db, {
        userId: p.user_id, type: 'invite_cancel', title: '自习邀约已取消',
        message: `「${invite.title}」已被发起人取消`,
        relatedType: 'invite', relatedId: inviteId
      });
    }
    db.save();

    db.run('DELETE FROM study_invites WHERE id = ?', [inviteId]);
    db.save();
    res.json({ message: '已取消' });
  });

  return router;
};
