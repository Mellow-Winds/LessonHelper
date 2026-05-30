const jwt = require('jsonwebtoken');

// JWT Secret — 生产环境应放在环境变量中
const JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET_PLACEHOLDER';
const TOKEN_EXPIRY = '7d';

// 生成 Token
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// 验证中间件
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, username }
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
