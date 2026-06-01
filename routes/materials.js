const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware } = require('./middleware/auth');

// 文件类型映射
const FILE_TYPE_MAP = {
  '.pdf': 'pdf',
  '.ppt': 'ppt', '.pptx': 'ppt',
  '.doc': 'doc', '.docx': 'doc',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(FILE_TYPE_MAP));
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'materials');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rand = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}_${rand}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    // Windows 下 multer 的 originalname 可能是 Latin-1 编码，需要转 UTF-8
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) { /* ignore */ }
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXTENSIONS.has(ext));
  }
});

module.exports = function (db) {
  const router = express.Router();

  // POST /api/materials/courses/:courseId — 上传资料 [Auth]
  router.post('/courses/:courseId', authMiddleware, upload.single('file'), (req, res) => {
    const courseId = Number(req.params.courseId);
    const userId = req.user.userId;

    if (!req.file) return res.status(400).json({ error: '请选择文件' });

    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: '课程不存在' }); }

    const { title, description, chapter, category } = req.body;
    if (!title) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: '标题为必填项' }); }

    const ext = path.extname(req.file.originalname).toLowerCase();

    const result = db.run(
      `INSERT INTO materials (course_id, uploader_id, title, description, file_path, file_name, file_type, file_size, chapter, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseId, userId, title.trim(), (description || '').trim(), req.file.filename, req.file.originalname,
       FILE_TYPE_MAP[ext] || 'other', req.file.size, (chapter || '').trim(), category || '其他']
    );
    db.save();
    res.status(201).json({ id: result.lastInsertRowid, message: '上传成功' });
  });

  // GET /api/materials/courses/:courseId — 资料列表
  router.get('/courses/:courseId', (req, res) => {
    const courseId = Number(req.params.courseId);
    const { category, chapter, sort, page = 1, pageSize = 20 } = req.query;

    let sql = `SELECT m.*, u.nickname AS uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id WHERE m.course_id = ?`;
    const params = [courseId];

    if (category && category !== 'all') { sql += ' AND m.category = ?'; params.push(category); }
    if (chapter) { sql += ' AND m.chapter LIKE ?'; params.push(`%${chapter}%`); }

    switch (sort) {
      case 'rating': sql += ' ORDER BY m.avg_rating DESC, m.rating_count DESC'; break;
      case 'downloads': sql += ' ORDER BY m.download_count DESC'; break;
      case 'oldest': sql += ' ORDER BY m.created_at ASC'; break;
      default: sql += ' ORDER BY m.created_at DESC';
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    const countSql = sql.replace(/SELECT m\.\*, u\.nickname AS uploader_name/, 'SELECT COUNT(*) AS total');
    const total = (db.get(countSql, params) || {}).total || 0;

    sql += ' LIMIT ? OFFSET ?';
    params.push(Number(pageSize), offset);

    res.json({ materials: db.all(sql, params), total, page: Number(page), pageSize: Number(pageSize) });
  });

  // GET /api/materials/:id — 资料详情
  router.get('/:id', (req, res) => {
    const material = db.get(
      'SELECT m.*, u.nickname AS uploader_name FROM materials m JOIN users u ON m.uploader_id = u.id WHERE m.id = ?',
      [Number(req.params.id)]
    );
    if (!material) return res.status(404).json({ error: '资料不存在' });
    res.json(material);
  });

  // GET /api/materials/:id/download — 下载文件
  router.get('/:id/download', (req, res) => {
    const material = db.get('SELECT * FROM materials WHERE id = ?', [Number(req.params.id)]);
    if (!material) return res.status(404).json({ error: '资料不存在' });

    const filePath = path.join(__dirname, '..', 'uploads', 'materials', material.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });

    db.run('UPDATE materials SET download_count = download_count + 1 WHERE id = ?', [material.id]);
    db.save();

    // 用标题+扩展名作为下载文件名，避免原始文件名编码问题
    const ext = path.extname(material.file_name);
    const downloadName = material.title + ext;
    const encodedName = encodeURIComponent(downloadName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.sendFile(filePath);
  });

  // POST /api/materials/:id/rate — 评分 [Auth]
  router.post('/:id/rate', authMiddleware, (req, res) => {
    const materialId = Number(req.params.id);
    const userId = req.user.userId;
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: '评分范围为 1-5' });

    const material = db.get('SELECT id FROM materials WHERE id = ?', [materialId]);
    if (!material) return res.status(404).json({ error: '资料不存在' });

    const existing = db.get('SELECT id FROM material_ratings WHERE material_id = ? AND user_id = ?', [materialId, userId]);
    if (existing) {
      db.run('UPDATE material_ratings SET rating = ? WHERE material_id = ? AND user_id = ?', [rating, materialId, userId]);
    } else {
      db.run('INSERT INTO material_ratings (material_id, user_id, rating) VALUES (?, ?, ?)', [materialId, userId, rating]);
    }

    const stats = db.get('SELECT AVG(rating) AS avg, COUNT(*) AS cnt FROM material_ratings WHERE material_id = ?', [materialId]);
    db.run('UPDATE materials SET avg_rating = ?, rating_count = ? WHERE id = ?', [Math.round(stats.avg * 10) / 10, stats.cnt, materialId]);
    db.save();

    res.json({ message: '评分成功', avg_rating: Math.round(stats.avg * 10) / 10, rating_count: stats.cnt });
  });

  // DELETE /api/materials/:id — 删除资料 [Auth, 仅上传者]
  router.delete('/:id', authMiddleware, (req, res) => {
    const material = db.get('SELECT * FROM materials WHERE id = ?', [Number(req.params.id)]);
    if (!material) return res.status(404).json({ error: '资料不存在' });
    if (material.uploader_id !== req.user.userId) return res.status(403).json({ error: '只能删除自己上传的资料' });

    const filePath = path.join(__dirname, '..', 'uploads', 'materials', material.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.run('DELETE FROM materials WHERE id = ?', [material.id]);
    db.save();
    res.json({ message: '删除成功' });
  });

  return router;
};
