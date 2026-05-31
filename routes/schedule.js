const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// Rate limit state
let lastScheduleImport = null;
const MAX_COURSES = 50;
const COOLDOWN_DAYS = 100;

module.exports = function (db) {
  const router = express.Router();

  // GET /api/schedule/notes - 获取导入说明
  router.get('/notes', (req, res) => {
    const notesPath = path.join(__dirname, '..', 'notes.md');
    if (!fs.existsSync(notesPath)) {
      return res.json({ content: '' });
    }
    const content = fs.readFileSync(notesPath, 'utf-8');
    res.json({ content });
  });

  // GET /api/schedule/pre-notes - 获取使用须知
  router.get('/pre-notes', (req, res) => {
    const filePath = path.join(__dirname, '..', 'pre-notes.md');
    if (!fs.existsSync(filePath)) {
      return res.json({ content: '' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  });

  // POST /api/schedule/import - 解析xlsx并写入课程表 [Auth]
  router.post('/import', authMiddleware, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    // --- 限流：100天内最多导入一次 ---
    if (lastScheduleImport) {
      const daysSince = (Date.now() - lastScheduleImport) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS) {
        const remaining = Math.ceil(COOLDOWN_DAYS - daysSince);
        return res.status(429).json({
          error: `导入过于频繁，请 ${remaining} 天后再试（限制：${COOLDOWN_DAYS} 天内最多导入一次）`
        });
      }
    }

    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const parsed = parseSchedule(data);

      // --- 限流：单次最多50门 ---
      if (parsed.length > MAX_COURSES) {
        return res.status(400).json({
          error: `单次导入上限 ${MAX_COURSES} 门课程，当前解析到 ${parsed.length} 门`
        });
      }

      if (parsed.length === 0) {
        return res.status(400).json({ error: '未解析到任何课程，请检查文件格式' });
      }

      // --- 写入数据库 ---
      const userId = req.user.userId;
      let importedCount = 0;

      db.run('BEGIN TRANSACTION');
      try {
        for (const c of parsed) {
          // 按课程号+教师+时间 去重（同一课程可由不同教师/时间开设）
          const existing = db.get(
            'SELECT id FROM courses WHERE description LIKE ? AND teacher = ?',
            [`%${c.courseId}%`, c.teacher]
          );

          if (existing) {
            // 课程已存在 → 确保当前用户已加入
            const enrolled = db.get(
              'SELECT id FROM user_courses WHERE user_id = ? AND course_id = ?',
              [userId, existing.id]
            );
            if (!enrolled) {
              db.run(
                'INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)',
                [userId, existing.id]
              );
              importedCount++;
            }
          } else {
            // 新课程 → 创建并关联当前用户
            const desc = [c.courseId, c.time, c.location].filter(Boolean).join(' · ');
            const result = db.run(
              'INSERT INTO courses (title, description, teacher, owner_id) VALUES (?, ?, ?, ?)',
              [c.className, desc, c.teacher, userId]
            );
            db.run(
              'INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)',
              [userId, result.lastInsertRowid]
            );
            importedCount++;
          }
        }
        db.run('COMMIT');
        db.save();
      } catch (dbErr) {
        db.run('ROLLBACK');
        throw dbErr;
      }

      // 记录导入时间
      lastScheduleImport = Date.now();

      // 返回当前用户的课程列表
      const courses = db.all(`
        SELECT DISTINCT c.*,
          (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
        FROM courses c
        JOIN user_courses uc ON uc.course_id = c.id
        WHERE uc.user_id = ?
        ORDER BY c.created_at DESC
      `, [userId]);
      res.json({ courses, imported: importedCount });
    } catch (err) {
      console.error('解析课表失败:', err);
      res.status(500).json({ error: '解析课表失败，请检查文件格式' });
    }
  });

  return router;
};

// ===== 解析引擎 =====

function parseSchedule(data) {
  const courseMap = new Map();
  const courseRows = [6, 9, 12, 15, 18, 21];

  for (const rowIdx of courseRows) {
    if (rowIdx >= data.length) continue;
    const row = data[rowIdx];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const colStart = 1 + dayIdx * 3;

      for (let colOff = 0; colOff < 3; colOff++) {
        const colIdx = colStart + colOff;
        if (colIdx >= row.length) continue;

        const cellValue = String(row[colIdx] || '').trim();
        if (!cellValue) continue;

        const parsed = parseCourseCell(cellValue);
        if (parsed) {
          const key = parsed.courseId + '|' + parsed.className;
          if (!courseMap.has(key)) {
            courseMap.set(key, parsed);
          }
        }
      }
    }
  }

  return Array.from(courseMap.values());
}

function parseCourseCell(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const firstLine = lines[0];
  const idMatch = firstLine.match(/^(\S+)\s+(.+)$/);
  if (!idMatch) return null;

  return {
    courseId: idMatch[1],
    className: idMatch[2],
    teacher: lines[1],
    time: lines[2],
    location: lines.length >= 4 ? lines[3] : ''
  };
}
