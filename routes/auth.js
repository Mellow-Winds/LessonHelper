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
  router.post('/register', async (req, res) => {
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

    if (major && major.length > 50) {
      return res.status(400).json({ error: '专业名称不能超过50字' });
    }

    if (grade && grade.length > 20) {
      return res.status(400).json({ error: '年级不能超过20字' });
    }

    // 检查邮箱是否已注册
    const existing = db.get('SELECT id, email_verified FROM users WHERE email = ?', [email]);
    if (existing) {
      if (existing.email_verified) {
        return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
      }
      // 邮箱存在但未验证 → 重新生成验证码
      const code = generateCode();
      const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
      db.run(
        'UPDATE users SET verification_code = ?, verification_code_expires = ? WHERE id = ?',
        [code, expires, existing.id]
      );
      db.save();
      return res.json({ message: '验证码已重新发送', debug_code: code });
    }

    // 新用户注册：生成验证码，写库，返回验证码供前端显示
    const code = generateCode();
    const expires = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    try {
      const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
      db.run(
        `INSERT INTO users (username, display_name, email, password_hash, nickname, major, grade, verification_code, verification_code_expires, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [email, nickname, email, password_hash, nickname, major || '', grade || '', code, expires]
      );
      db.save();

      console.log(`[Auth] 注册: ${email}, 验证码: ${code}`);
      res.status(201).json({ message: '验证码已发送', debug_code: code });
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
      res.json({ message: '验证码已重新发送', debug_code: code });
    }).catch(e => {
      console.error('验证码发送异常:', e);
      res.status(500).json({ error: '验证码发送失败，请稍后重试' });
    });
  });

  // GET /api/auth/me — 获取当前用户信息
  router.get('/me', authMiddleware, (req, res) => {
    const user = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, checkin_streak, last_checkin_date, grace_days, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
  });

  // PUT /api/auth/me — 更新个人信息
  router.put('/me', authMiddleware, (req, res) => {
    const { nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers } = req.body;
    const user = db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证 avatar_desc 长度
    if (avatar_desc !== undefined && avatar_desc.length > 80) {
      return res.status(400).json({ error: '肖像描述不能超过80字' });
    }

    // 验证 mbti 选项
    const validMbti = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
    if (mbti !== undefined && mbti !== '' && !validMbti.includes(mbti)) {
      return res.status(400).json({ error: '无效的MBTI人格类型' });
    }

    // 验证 gender 选项
    const validGender = ['', 'male', 'female'];
    if (gender !== undefined && !validGender.includes(gender)) {
      return res.status(400).json({ error: '无效的性别选项' });
    }

    db.run(
      'UPDATE users SET nickname = ?, major = ?, grade = ?, avatar_url = ?, qq = ?, wechat = ?, douyin = ?, avatar_desc = ?, mbti = ?, gender = ?, privacy_show_profile = ?, privacy_allow_match = ?, privacy_show_following = ?, privacy_show_followers = ? WHERE id = ?',
      [
        nickname !== undefined ? nickname : user.nickname,
        major !== undefined ? major : user.major,
        grade !== undefined ? grade : user.grade,
        avatar_url !== undefined ? avatar_url : user.avatar_url,
        qq !== undefined ? qq : user.qq,
        wechat !== undefined ? wechat : user.wechat,
        douyin !== undefined ? douyin : user.douyin,
        avatar_desc !== undefined ? avatar_desc : user.avatar_desc,
        mbti !== undefined ? mbti : user.mbti,
        gender !== undefined ? gender : user.gender,
        privacy_show_profile !== undefined ? (privacy_show_profile ? 1 : 0) : user.privacy_show_profile,
        privacy_allow_match !== undefined ? (privacy_allow_match ? 1 : 0) : user.privacy_allow_match,
        privacy_show_following !== undefined ? (privacy_show_following ? 1 : 0) : user.privacy_show_following,
        privacy_show_followers !== undefined ? (privacy_show_followers ? 1 : 0) : user.privacy_show_followers,
        req.user.userId
      ]
    );
    db.save();

    const updated = db.get(
      'SELECT id, username, email, nickname, major, grade, avatar_url, qq, wechat, douyin, avatar_desc, mbti, gender, checkin_streak, last_checkin_date, grace_days, privacy_show_profile, privacy_allow_match, privacy_show_following, privacy_show_followers, email_verified, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    res.json(updated);
  });

  // POST /api/auth/checkin — 每日签到（连续学习天数 + 双重保护机制）
  router.post('/checkin', authMiddleware, (req, res) => {
    const user = db.get(
      'SELECT id, checkin_streak, last_checkin_date, grace_days FROM users WHERE id = ?',
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 使用 UTC+8 时区计算今日日期
    const today = req.body.date || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });

    // 已经今天签到过了
    if (user.last_checkin_date === today) {
      return res.json({ streak: user.checkin_streak, alreadyCheckedIn: true });
    }

    let streak = user.checkin_streak || 0;
    let graceDays = user.grace_days || 0;

    // 计算上次签到距今天数
    const lastDate = user.last_checkin_date ? new Date(user.last_checkin_date) : null;
    const todayDate = new Date(today);
    const daysDiff = lastDate ? Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24)) : 999;

    if (daysDiff === 1) {
      // 连续签到：累加
      streak += 1;
      graceDays = 0;
    } else if (daysDiff > 1 && streak > 0) {
      // 漏签：根据连续天数判断保护机制
      if (streak >= 45) {
        // 长期保护：7天缓冲
        if (daysDiff <= 7 + 1) {
          // 在缓冲期内签到：重燃
          graceDays = 0;
          streak += 1;
        } else {
          // 缓冲期过：归零 + 老友标记
          streak = 1;
          graceDays = 0;
        }
      } else if (streak >= 7) {
        // 短期保护：3天缓冲
        if (daysDiff <= 3 + 1) {
          // 在缓冲期内签到：重燃
          graceDays = 0;
          streak += 1;
        } else {
          // 缓冲期过：归零 + 老友标记
          streak = 1;
          graceDays = 0;
        }
      } else {
        // 无保护：直接归零
        streak = 1;
        graceDays = 0;
      }
    } else if (daysDiff > 1) {
      // 首次或已归零后重新签到
      streak = 1;
      graceDays = 0;
    }

    // graceDays 已在上方逻辑中根据签到结果正确设置（签到成功 = 0，归零 = 0），此处无需再更新

    db.run(
      'UPDATE users SET checkin_streak = ?, last_checkin_date = ?, grace_days = ? WHERE id = ?',
      [streak, today, graceDays, req.user.userId]
    );
    db.save();

    res.json({ streak, alreadyCheckedIn: false });
  });

  return router;
};
