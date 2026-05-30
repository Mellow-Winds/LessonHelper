const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authMiddleware, generateToken } = require('./middleware/auth');
const { sendVerificationCode } = require('./middleware/email');

const SALT_ROUNDS = 10;
const CODE_EXPIRY_MINUTES = 10;

module.exports = function (db) {
  const router = express.Router();

  // 生成6位数字验证码
  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // 验证邮箱格式
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // POST /api/auth/register — 注册（发送验证码）
  router.post('/register', (req, res) => {
    const { email, password, nickname, major, grade } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ error: 'email, password, nickname 为必填项' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }

    // 检查邮箱是否已注册
    const existing = db.get('SELECT id, email_verified FROM users WHERE email = ?', [email]);
    if (existing) {
      if (existing.email_verified) {
        return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
      }
      // 邮箱存在但未验证 → 重新发送验证码
      const code = generateCode();
      const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
      db.run(
        'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
        [code, expires, existing.id]
      );
      db.save();

      sendVerificationCode(email, code).then(result => {
        if (!result.success) {
          return res.status(500).json({ error: '验证码发送失败: ' + result.error });
        }
        res.json({ message: '验证码已重新发送至 ' + email, debug_code: code });
      });
      return;
    }

    // 新用户注册
    const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const code = generateCode();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    try {
      const result = db.run(
        `INSERT INTO users (username, display_name, email, password_hash, nickname, major, grade, verification_code, verification_code_expires, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [email, nickname, email, password_hash, nickname, major || '', grade || '', code, expires]
      );
      db.save();

      // 发送验证码邮件
      sendVerificationCode(email, code).then(sendResult => {
        if (!sendResult.success) {
          return res.status(500).json({ error: '验证码发送失败: ' + sendResult.error });
        }
        console.log(`[Auth] 注册: ${email}, 验证码: ${code}`);
        res.status(201).json({
          message: '验证码已发送至 ' + email + '，请查收邮件完成验证',
          debug_code: code  // 开发环境返回验证码，生产环境删除此行
        });
      });
    } catch (e) {
      console.error('注册失败:', e);
      res.status(500).json({ error: '服务器错误' });
    }
  });

  // POST /api/auth/verify-email — 验证邮箱
  router.post('/verify-email', (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'email 和 code 为必填项' });
    }

    const user = db.get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: '该邮箱已验证，请直接登录' });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: '验证码错误' });
    }

    if (new Date(user.verification_code_expires) < new Date()) {
      return res.status(400).json({ error: '验证码已过期，请重新发送' });
    }

    // 验证成功
    db.run(
      'UPDATE users SET email_verified = 1, verification_code = NULL, verification_code_expires = NULL WHERE id = ?',
      [user.id]
    );
    db.save();

    const updated = db.get('SELECT * FROM users WHERE id = ?', [user.id]);
    const token = generateToken(updated);
    const { password_hash, verification_code, verification_code_expires, ...safeUser } = updated;
    res.json({ token, user: safeUser });
  });

  // POST /api/auth/login — 登录
  router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email 和 password 为必填项' });
    }

    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: '邮箱尚未验证，请先验证邮箱' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: '该账号未设置密码，请使用验证码登录' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = generateToken(user);
    const { password_hash, verification_code, verification_code_expires, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // POST /api/auth/resend-code — 重新发送验证码
  router.post('/resend-code', (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email 为必填项' });
    }

    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ error: '该邮箱未注册' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: '该邮箱已验证，无需重新发送' });
    }

    const code = generateCode();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    db.run(
      'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
      [code, expires, user.id]
    );
    db.save();

    sendVerificationCode(email, code).then(result => {
      if (!result.success) {
        return res.status(500).json({ error: '验证码发送失败: ' + result.error });
      }
      res.json({ message: '验证码已重新发送至 ' + email, debug_code: code });
    });
  });

  // GET /api/auth/me — 获取当前用户信息
  router.get('/me', authMiddleware, (req, res) => {
    const user = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
  });

  // PUT /api/auth/me — 更新个人信息
  router.put('/me', authMiddleware, (req, res) => {
    const { nickname, major, grade, avatar_url } = req.body;
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    db.run(
      'UPDATE users SET nickname = ?, major = ?, grade = ?, avatar_url = ? WHERE id = ?',
      [
        nickname !== undefined ? nickname : user.nickname,
        major !== undefined ? major : user.major,
        grade !== undefined ? grade : user.grade,
        avatar_url !== undefined ? avatar_url : user.avatar_url,
        req.user.userId
      ]
    );
    db.save();

    const updated = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    res.json(updated);
  });

  return router;
};
