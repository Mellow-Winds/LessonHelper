const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = function () {
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

  // POST /api/schedule/import - 解析课程表xlsx
  router.post('/import', upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const courses = parseSchedule(data);
      res.json({ courses });
    } catch (err) {
      console.error('解析课表失败:', err);
      res.status(500).json({ error: '解析课表失败，请检查文件格式' });
    }
  });

  return router;
};

// 解析课程表数据
function parseSchedule(data) {
  const courseMap = new Map(); // 用课程号去重

  // 每天占3列: 星期一(B-D=1-3), 星期二(E-G=4-6), ..., 星期日(T-V=19-21)
  // 课程数据行: 第6,9,12,15,18,21行 (0-indexed)
  const courseRows = [6, 9, 12, 15, 18, 21];

  for (const rowIdx of courseRows) {
    if (rowIdx >= data.length) continue;
    const row = data[rowIdx];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const colStart = 1 + dayIdx * 3; // 每天起始列

      // 检查该天的3列中是否有课程
      for (let colOff = 0; colOff < 3; colOff++) {
        const colIdx = colStart + colOff;
        if (colIdx >= row.length) continue;

        const cellValue = String(row[colIdx] || '').trim();
        if (!cellValue) continue;

        const parsed = parseCourseCell(cellValue);
        if (parsed) {
          // 用课程号+教学班作为去重key
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

// 解析单个课程单元格
function parseCourseCell(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  // 第一行: 课程号 + 教学班名称, e.g. "25000400 离散数学03班"
  const firstLine = lines[0];
  const idMatch = firstLine.match(/^(\S+)\s+(.+)$/);
  if (!idMatch) return null;

  const courseId = idMatch[1];
  const className = idMatch[2];

  // 第二行: 教师
  const teacher = lines[1];

  // 第三行: 时间, e.g. "周一 2-4节 1-16周"
  const time = lines[2];

  // 第四行: 地点 (可能不存在)
  const location = lines.length >= 4 ? lines[3] : '';

  return { courseId, className, teacher, time, location };
}
