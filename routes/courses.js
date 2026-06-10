const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware } = require('./middleware/auth');
const { createNotification } = require('./notifications');

const POST_ATTACHMENT_DIR = path.join(__dirname, '..', 'uploads', 'post-attachments');
const POST_ATTACHMENT_LIMIT = 9;
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(POST_ATTACHMENT_DIR, { recursive: true });
      cb(null, POST_ATTACHMENT_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: POST_ATTACHMENT_LIMIT },
});

function parsePostAttachments(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  attachmentUpload.array('files', POST_ATTACHMENT_LIMIT)(req, res, (error) => {
    if (!error) return next();
    (req.files || []).forEach(file => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
    const message = error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
      ? '每个帖子最多上传 9 个附件'
      : error.code === 'LIMIT_FILE_SIZE'
        ? '单个附件不能超过 20MB'
        : '附件上传失败';
    res.status(400).json({ error: message });
  });
}

function cleanupUploadedFiles(files = []) {
  files.forEach(file => {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  });
}

function toAttachmentResponse(attachment) {
  const base = `/api/courses/posts/attachments/${attachment.id}`;
  return {
    ...attachment,
    view_url: attachment.file_type === 'image' ? `${base}/view` : null,
    download_url: `${base}/download`,
  };
}

// 评论图片上传配置（最多 9 张，JPG/PNG/GIF/WebP，每张 ≤ 20MB）
const COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
const COMMENT_IMAGE_MAX = 20 * 1024 * 1024;
const COMMENT_IMAGE_LIMIT = 9;
const COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const commentImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(COMMENT_IMAGE_DIR, { recursive: true });
      cb(null, COMMENT_IMAGE_DIR);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: COMMENT_IMAGE_MAX, files: COMMENT_IMAGE_LIMIT },
  fileFilter: (req, file, cb) => {
    try { file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8'); } catch {}
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, COMMENT_IMAGE_EXT.has(ext));
  },
});

function parseCommentImage(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  commentImageUpload.array('image', COMMENT_IMAGE_LIMIT)(req, res, (error) => {
    if (!error) return next();
    (req.files || []).forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '单张图片不能超过 20MB'
      : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
        ? '最多上传 9 张图片'
        : '仅支持 JPG、PNG、GIF、WebP 格式';
    res.status(400).json({ error: message });
  });
}

module.exports = function (db) {
  const router = express.Router();

  function isEnrolled(userId, courseId) {
    return !!db.get(
      'SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
  }

  // --- 大课体系工具函数 ---
  function cleanBigCourseName(title) {
    if (!title) return '';
    const parens = title.match(/[（(].+?[)）]/g) || [];
    let temp = title;
    parens.forEach((p, i) => { temp = temp.replace(p, `__PH${i}__`); });
    temp = temp.replace(/\d{1,3}\s*班\s*$/, '');
    temp = temp.replace(/[\s ]*\d{1,3}\s*$/, '');
    temp = temp.replace(/\d{1,3}$/, '');
    parens.forEach((p, i) => { temp = temp.replace(`__PH${i}__`, p); });
    return temp.trim();
  }

  function findOrCreateBigCourse(title) {
    const bigName = cleanBigCourseName(title);
    if (!bigName) return null;
    let big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND (description = "" OR description IS NULL)', [bigName]);
    if (!big) {
      db.run('INSERT INTO courses (title, description, owner_id, teacher) VALUES (?, "", 0, "")', [bigName]);
      big = db.get('SELECT id FROM courses WHERE title = ? AND big_course_id IS NULL AND (description = "" OR description IS NULL)', [bigName]);
    }
    return big ? big.id : null;
  }

  function isEnrolledInBigCourse(userId, bigCourseId) {
    // 检查是否直接选了这门大课，或选了其下的任意小课
    return !!db.get(
      `SELECT 1 FROM user_courses uc
       JOIN courses c ON uc.course_id = c.id
       WHERE uc.user_id = ? AND (c.id = ? OR c.big_course_id = ?)`,
      [userId, bigCourseId, bigCourseId]
    );
  }

  function getSmallCourseIds(bigCourseId) {
    return db.all('SELECT id FROM courses WHERE big_course_id = ?', [bigCourseId]).map(r => r.id);
  }

  function notifyBigCourseMembers(bigCourseId, excludeUserId, type, title, message, relatedType, relatedId) {
    const smallIds = getSmallCourseIds(bigCourseId);
    if (smallIds.length === 0) return;
    const placeholders = smallIds.map(() => '?').join(',');
    const members = db.all(
      `SELECT DISTINCT user_id FROM user_courses WHERE course_id IN (${placeholders}) AND user_id != ?`,
      [...smallIds, excludeUserId]
    );
    for (const m of members) {
      createNotification(db, {
        userId: m.user_id, type, title, message, relatedType, relatedId, courseId: bigCourseId
      });
    }
  }

  // GET /api/courses/semesters — 当前用户已选课程涉及的学期列表
  router.get('/semesters', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const rows = db.all(
      'SELECT DISTINCT semester_key FROM user_courses WHERE user_id = ? AND semester_key != "" ORDER BY semester_key DESC',
      [userId]
    );
    res.json(rows.map(r => r.semester_key));
  });

  // GET /api/courses/all — 全校大课列表（公开，供课程广场使用，不需要登录）
  router.get('/all', (req, res) => {
    const courses = db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc
         JOIN courses c2 ON uc.course_id = c2.id
         WHERE c2.big_course_id = c.id) AS enrollment_count
      FROM courses c
      WHERE c.big_course_id IS NULL AND (c.description = '' OR c.description IS NULL)
      ORDER BY c.title ASC
    `);
    res.json(courses);
  });

  // GET /api/courses — 当前用户的课程列表（支持学期筛选）
  router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { semester, year } = req.query;

    let sql = `
      SELECT DISTINCT c.*,
        uc.semester_key AS enrolled_semester_key,
        (SELECT COUNT(*) FROM user_courses uc2 WHERE uc2.course_id = c.id) AS enrollment_count
      FROM courses c
      JOIN user_courses uc ON uc.course_id = c.id
      WHERE uc.user_id = ?
    `;
    const params = [userId];

    if (semester && semester !== 'all') {
      if (semester.includes('-')) {
        sql += ' AND uc.semester_key = ?';
        params.push(semester);
      } else {
        sql += ' AND uc.semester_key LIKE ?';
        params.push(`%-${semester}`);
      }
    } else if (year && year !== 'all') {
      sql += ' AND uc.semester_key LIKE ?';
      params.push(`${year}-%`);
    } else if (req.query.type && req.query.type !== 'all') {
      sql += ' AND uc.semester_key LIKE ?';
      params.push(`%-${req.query.type}`);
    }

    sql += ' ORDER BY c.created_at DESC';
    const courses = db.all(sql, params);
    res.json(courses);
  });

  // GET /api/courses/:id — 课程详情（支持大课和小课 ID）
  router.get('/:id', (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });

    // 判断是大课还是小课
    const isBig = !course.big_course_id && (!course.description || course.description === '');
    if (isBig) {
      // 大课：enrollment_count = 所有小课的选课人数总和
      const count = db.get(
        'SELECT COUNT(*) AS cnt FROM user_courses uc JOIN courses c ON uc.course_id = c.id WHERE c.big_course_id = ?',
        [courseId]
      );
      course.enrollment_count = count ? count.cnt : 0;
    } else {
      // 小课：enrollment_count = 该小课的选课人数
      const count = db.get(
        'SELECT COUNT(*) AS cnt FROM user_courses WHERE course_id = ?',
        [courseId]
      );
      course.enrollment_count = count ? count.cnt : 0;
    }

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

    const semesterKey = req.body.semester_key || '';

    // 检查本学期课程数上限（每学期 50 门）
    const count = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE user_id = ? AND semester_key = ?',
      [userId, semesterKey]
    );
    if (count.cnt >= 50) {
      return res.status(400).json({ error: '本学期课程数已达 50 门上限，请先退出部分课程' });
    }

    db.run(
      'INSERT INTO user_courses (user_id, course_id, semester_key) VALUES (?, ?, ?)',
      [userId, courseId, semesterKey]
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

  // PUT /api/courses/:id/move-semester — 移动课程到指定学期 [Auth]
  router.put('/:id/move-semester', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const courseId = Number(req.params.id);
    const { semester_key } = req.body;

    if (!semester_key) {
      return res.status(400).json({ error: '请指定目标学期' });
    }

    const enrolled = db.get(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );
    if (!enrolled) {
      return res.status(400).json({ error: '未加入该课程' });
    }

    db.run(
      'UPDATE user_courses SET semester_key = ? WHERE user_id = ? AND course_id = ?',
      [semester_key, userId, courseId]
    );
    db.save();
    res.json({ message: '移动成功' });
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
    for (const post of posts) {
      post.attachments = db.all(
        'SELECT id, file_name, file_type, file_size FROM post_attachments WHERE post_id = ? ORDER BY id ASC',
        [post.id]
      ).map(toAttachmentResponse);
    }
    res.json(posts);
  });

  // POST /api/courses/:id/posts — 发帖 [Auth]（:id 为大课 ID）
  router.post('/:id/posts', authMiddleware, parsePostAttachments, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'title 和 content 为必填项' });
    }

    const bigCourseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [bigCourseId]);
    if (!course) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({ error: '课程不存在' });
    }
    if (!isEnrolledInBigCourse(req.user.userId, bigCourseId)) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({ error: '只有课程成员可以发布帖子' });
    }

    const result = db.run(
      'INSERT INTO posts (course_id, author_id, title, content) VALUES (?, ?, ?, ?)',
      [bigCourseId, req.user.userId, title, content]
    );
    const attachments = (req.files || []).map(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      const attachment = db.run(
        'INSERT INTO post_attachments (post_id, file_path, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
        [result.lastInsertRowid, file.filename, file.originalname, IMAGE_EXTENSIONS.has(ext) ? 'image' : 'file', file.size]
      );
      return toAttachmentResponse({
        id: attachment.lastInsertRowid,
        file_name: file.originalname,
        file_type: IMAGE_EXTENSIONS.has(ext) ? 'image' : 'file',
        file_size: file.size,
      });
    });
    db.save();

    // 通知：大课空间有新帖
    const author = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);
    const courseInfo = db.get('SELECT title FROM courses WHERE id = ?', [bigCourseId]);
    notifyBigCourseMembers(bigCourseId, req.user.userId,
      'new_post', '新帖子',
      `${author?.nickname || '匿名'} 在「${courseInfo?.title || ''}」发布了「${title}」`,
      'post', result.lastInsertRowid
    );
    db.save();

    res.status(201).json({
      id: result.lastInsertRowid,
      course_id: bigCourseId,
      author_id: req.user.userId,
      title,
      content,
      attachments
    });
  });

  router.get('/posts/attachments/:attachmentId/view', (req, res) => {
    const attachment = db.get('SELECT * FROM post_attachments WHERE id = ?', [Number(req.params.attachmentId)]);
    if (!attachment || attachment.file_type !== 'image') return res.status(404).json({ error: '图片不存在' });
    res.sendFile(path.join(POST_ATTACHMENT_DIR, attachment.file_path));
  });

  router.get('/posts/attachments/:attachmentId/download', (req, res) => {
    const attachment = db.get('SELECT * FROM post_attachments WHERE id = ?', [Number(req.params.attachmentId)]);
    if (!attachment) return res.status(404).json({ error: '附件不存在' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
    res.sendFile(path.join(POST_ATTACHMENT_DIR, attachment.file_path));
  });

  // GET /api/courses/posts/:postId/comments — 评论列表（分页 + 楼中楼）
  router.get('/posts/:postId/comments', (req, res) => {
    const postId = Number(req.params.postId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const total = (db.get('SELECT COUNT(*) AS cnt FROM comments WHERE post_id = ?', [postId]) || {}).cnt || 0;

    const comments = db.all(`
      SELECT c.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
      LIMIT ? OFFSET ?
    `, [postId, pageSize, offset]);

    res.json({ comments, total, page, pageSize });
  });

  // POST /api/courses/posts/:postId/comments — 发评论 [Auth]（支持多图 + 楼中楼）
  router.post('/posts/:postId/comments', authMiddleware, parseCommentImage, (req, res) => {
    const { content, parent_id } = req.body;
    const imageFiles = req.files || [];

    // 至少需要文字或图片
    if ((!content || !content.trim()) && imageFiles.length === 0) {
      imageFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(400).json({ error: '请输入内容或上传图片' });
    }

    const postId = Number(req.params.postId);
    const post = db.get('SELECT id, course_id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      imageFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 楼中楼：校验 parent_id
    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, post_id FROM comments WHERE id = ?', [parentId]);
      if (!parentComment || parentComment.post_id !== postId) {
        imageFiles.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    // 多图：用分号连接多张图片 URL
    const imageUrls = imageFiles.map(f => `/uploads/comment-images/${f.filename}`);
    const imageUrlStr = imageUrls.join(';');

    const result = db.run(
      'INSERT INTO comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, req.user.userId, (content || '').trim(), parentId, imageUrlStr]
    );
    db.save();

    // 通知逻辑
    const commenter = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);

    if (parentId) {
      const parentComment = db.get('SELECT author_id FROM comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== req.user.userId) {
        createNotification(db, {
          userId: parentComment.author_id, type: 'new_comment', title: '新回复',
          message: `${commenter?.nickname || '匿名'} 回复了你的评论`,
          relatedType: 'post', relatedId: postId, courseId: post.course_id
        });
        db.save();
      }
    } else {
      const postDetail = db.get('SELECT author_id, title, course_id FROM posts WHERE id = ?', [postId]);
      if (postDetail && postDetail.author_id !== req.user.userId) {
        createNotification(db, {
          userId: postDetail.author_id, type: 'new_comment', title: '新评论',
          message: `${commenter?.nickname || '匿名'} 评论了你的帖子「${postDetail.title}」`,
          relatedType: 'post', relatedId: postId, courseId: postDetail.course_id
        });
        db.save();
      }
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      post_id: postId,
      author_id: req.user.userId,
      content: (content || '').trim(),
      parent_id: parentId,
      image_url: imageUrlStr,
      image_urls: imageUrls
    });
  });

  // DELETE /api/courses/posts/:postId — 删除帖子（级联删除所有回复）
  router.delete('/posts/:postId', authMiddleware, (req, res) => {
    const postId = Number(req.params.postId);
    const userId = req.user.userId;

    const post = db.get('SELECT * FROM posts WHERE id = ?', [postId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.author_id !== userId) return res.status(403).json({ error: '只能删除自己发布的帖子' });

    // 删除帖子相关的所有图片文件
    if (post.image_url) {
      post.image_url.split(';').filter(Boolean).forEach(url => {
        const imgPath = path.join(__dirname, '..', url);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    }

    // 删除所有回复的图片文件
    const comments = db.all('SELECT image_url FROM comments WHERE post_id = ?', [postId]);
    comments.forEach(c => {
      if (c.image_url) {
        c.image_url.split(';').filter(Boolean).forEach(url => {
          const imgPath = path.join(__dirname, '..', url);
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
      }
    });

    // 级联删除所有回复
    db.run('DELETE FROM comments WHERE post_id = ?', [postId]);
    // 删除帖子
    db.run('DELETE FROM posts WHERE id = ?', [postId]);
    db.save();

    res.json({ message: '已删除' });
  });

  // DELETE /api/courses/posts/:postId/comments/:commentId — 删除自己的回复（硬删除）
  router.delete('/posts/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const commentId = Number(req.params.commentId);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的回复' });

    // 删除图片文件（支持多图，分号分隔）
    if (comment.image_url) {
      comment.image_url.split(';').filter(Boolean).forEach(url => {
        const imgPath = path.join(__dirname, '..', url);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    }

    // 硬删除：直接删除评论
    db.run('DELETE FROM comments WHERE id = ?', [commentId]);
    db.save();

    res.json({ message: '已删除' });
  });

  // GET /api/courses/posts/:postId/comments/:commentId/replies — 获取楼中楼回复
  router.get('/posts/:postId/comments/:commentId/replies', (req, res) => {
    const commentId = Number(req.params.commentId);
    const replies = db.all(`
      SELECT c.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.parent_id = ?
      ORDER BY c.created_at ASC
    `, [commentId]);
    res.json(replies);
  });

  /* =============================================
     课程搭子帖（course-scoped square posts）
     ============================================= */

  const COURSE_SQ_COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
  const COURSE_SQ_COMMENT_IMAGE_MAX = 1 * 1024 * 1024;
  const COURSE_SQ_COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

  const courseSquareCommentUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        fs.mkdirSync(COURSE_SQ_COMMENT_IMAGE_DIR, { recursive: true });
        cb(null, COURSE_SQ_COMMENT_IMAGE_DIR);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `csq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
      }
    }),
    limits: { fileSize: COURSE_SQ_COMMENT_IMAGE_MAX, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, COURSE_SQ_COMMENT_IMAGE_EXT.has(ext));
    }
  });

  function parseCourseSquareCommentImage(req, res, next) {
    if (!req.is('multipart/form-data')) return next();
    courseSquareCommentUpload.single('image')(req, res, (error) => {
      if (!error) return next();
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? '图片不能超过 1MB'
        : error.code === 'LIMIT_FILE_COUNT'
          ? '只能上传一张图片'
          : '仅支持 jpg/jpeg/png 格式';
      return res.status(400).json({ error: message });
    });
  }

  const COURSE_SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];
  const COURSE_SQUARE_EXPIRY_DAYS = 7;

  // POST /api/courses/:id/square-posts — 发布课程搭子帖 [Auth + 选课]（:id 为大课 ID）
  router.post('/:id/square-posts', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const userId = req.user.userId;
    if (!isEnrolledInBigCourse(userId, bigCourseId)) return res.status(403).json({ error: '未选修该课程' });

    const { title, category, description, max_people } = req.body;
    if (!title || !category) return res.status(400).json({ error: '标题和类型为必填项' });
    if (!COURSE_SQUARE_CATEGORIES.includes(category)) return res.status(400).json({ error: '无效的需求类型' });

    const expiresAt = new Date(Date.now() + COURSE_SQUARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const result = db.run(
      `INSERT INTO square_posts (creator_id, title, category, description, max_people, current_count, status, expires_at, course_id)
       VALUES (?, ?, ?, ?, ?, 0, 'open', ?, ?)`,
      [userId, title.trim(), category, (description || '').trim(), max_people || 1, expiresAt, bigCourseId]
    );
    db.save();

    res.status(201).json({ id: result.lastInsertRowid, message: '发布成功' });
  });

  // GET /api/courses/:id/square-posts — 课程搭子帖列表 [Auth + 选课]（:id 为大课 ID）
  router.get('/:id/square-posts', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const userId = req.user.userId;
    if (!isEnrolledInBigCourse(userId, bigCourseId)) return res.status(403).json({ error: '未选修该课程' });

    const { category } = req.query;
    let where = " WHERE sp.course_id = ? AND sp.expires_at > datetime('now', '+8 hours') AND sp.status != 'expired'";
    const params = [bigCourseId];

    if (category && category !== 'all') {
      where += ' AND sp.category = ?';
      params.push(category);
    }

    const posts = db.all(`
      SELECT sp.*,
        u.nickname AS creator_name,
        (SELECT COUNT(*) FROM square_interests si WHERE si.post_id = sp.id AND si.status = 'accepted') AS confirmed_count,
        (SELECT si2.status FROM square_interests si2 WHERE si2.post_id = sp.id AND si2.user_id = ?) AS my_status
      FROM square_posts sp
      JOIN users u ON sp.creator_id = u.id
      ${where}
      ORDER BY sp.created_at DESC
    `, [userId, ...params]);

    const result = posts.map(p => {
      const remaining = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));
      return { ...p, remaining_days: remaining };
    });

    res.json({ posts: result });
  });

  // GET /api/courses/:id/square-posts/:postId — 帖子详情 [Auth + 选课]（:id 为大课 ID）
  router.get('/:id/square-posts/:postId', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;
    if (!isEnrolledInBigCourse(userId, bigCourseId)) return res.status(403).json({ error: '未选修该课程' });

    const post = db.get(`
      SELECT sp.*, u.nickname AS creator_name, u.major AS creator_major, u.grade AS creator_grade
      FROM square_posts sp
      JOIN users u ON sp.creator_id = u.id
      WHERE sp.id = ? AND sp.course_id = ?
    `, [postId, bigCourseId]);

    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (new Date(post.expires_at) <= new Date()) post.status = 'expired';

    const confirmed = db.all(`
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url, u.qq
      FROM square_interests si
      JOIN users u ON si.user_id = u.id
      WHERE si.post_id = ? AND si.status = 'accepted'
      ORDER BY si.created_at ASC
    `, [postId]);

    let pending = [];
    if (post.creator_id === userId) {
      pending = db.all(`
        SELECT si.id AS interest_id, si.user_id, si.created_at,
          u.nickname, u.major, u.grade, u.avatar_url
        FROM square_interests si
        JOIN users u ON si.user_id = u.id
        WHERE si.post_id = ? AND si.status = 'pending'
        ORDER BY si.created_at ASC
      `, [postId]);
    }

    const myInterest = db.get(
      'SELECT status FROM square_interests WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    const remaining = Math.max(0, Math.ceil((new Date(post.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));

    res.json({ ...post, remaining_days: remaining, confirmed, pending, my_status: myInterest ? myInterest.status : null });
  });

  // DELETE /api/courses/:id/square-posts/:postId — 删除帖子 [Auth, 仅创建者]
  router.delete('/:id/square-posts/:postId', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;

    const post = db.get('SELECT * FROM square_posts WHERE id = ? AND course_id = ?', [postId, bigCourseId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id !== userId) return res.status(403).json({ error: '只能删除自己发布的帖子' });

    db.run('DELETE FROM square_posts WHERE id = ?', [postId]);
    db.save();
    res.json({ message: '已删除' });
  });

  // PUT /api/courses/:id/square-posts/:postId — 编辑帖子 [Auth, 仅创建者]
  router.put('/:id/square-posts/:postId', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;
    const { title, category, description, max_people } = req.body;

    const post = db.get('SELECT * FROM square_posts WHERE id = ? AND course_id = ?', [postId, bigCourseId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id !== userId) return res.status(403).json({ error: '只能编辑自己发布的帖子' });

    // 校验 category
    if (category && !COURSE_SQUARE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: '无效的需求类型' });
    }

    db.run(
      `UPDATE square_posts SET
        title = COALESCE(?, title),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        max_people = COALESCE(?, max_people)
       WHERE id = ?`,
      [
        title?.trim() || null,
        category || null,
        description !== undefined ? description.trim() : null,
        max_people !== undefined ? Number(max_people) : null,
        postId
      ]
    );
    db.save();
    res.json({ message: '已更新' });
  });

  // POST /api/courses/:id/square-posts/:postId/interest — 表示感兴趣 [Auth + 选课]（:id 为大课 ID）
  router.post('/:id/square-posts/:postId/interest', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;
    if (!isEnrolledInBigCourse(userId, bigCourseId)) return res.status(403).json({ error: '未选修该课程' });

    const post = db.get('SELECT * FROM square_posts WHERE id = ? AND course_id = ?', [postId, bigCourseId]);
    if (!post) return res.status(404).json({ error: '帖子不存在' });
    if (post.creator_id === userId) return res.status(400).json({ error: '不能对自己的帖子感兴趣' });
    if (post.status !== 'open') return res.status(400).json({ error: '该帖子已不再接受申请' });
    if (new Date(post.expires_at) <= new Date()) return res.status(400).json({ error: '该帖子已过期' });

    const existing = db.get('SELECT * FROM square_interests WHERE post_id = ? AND user_id = ?', [postId, userId]);
    if (existing) return res.status(400).json({ error: '你已经申请过了' });

    db.run("INSERT INTO square_interests (post_id, user_id, status) VALUES (?, ?, 'pending')", [postId, userId]);
    db.save();

    const applicant = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);
    createNotification(db, {
      userId: post.creator_id, type: 'course_square_interest', title: '有人对你的搭子帖感兴趣',
      message: `${applicant?.nickname || '匿名'} 对「${post.title}」感兴趣`,
      relatedType: 'course_square_post', relatedId: postId
    });
    db.save();

    res.json({ message: '已申请，等待对方确认' });
  });

  // PUT /api/courses/:id/square-interests/:interestId — 接受/拒绝 [Auth]
  router.put('/:id/square-interests/:interestId', authMiddleware, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const interestId = Number(req.params.interestId);
    const userId = req.user.userId;
    const { action } = req.body;

    const interest = db.get('SELECT * FROM square_interests WHERE id = ?', [interestId]);
    if (!interest) return res.status(404).json({ error: '记录不存在' });

    const post = db.get('SELECT * FROM square_posts WHERE id = ? AND course_id = ?', [interest.post_id, bigCourseId]);
    if (!post || post.creator_id !== userId) return res.status(403).json({ error: '无权操作' });
    if (interest.status !== 'pending') return res.status(400).json({ error: '该申请已处理' });

    if (action === 'reject') {
      db.run("UPDATE square_interests SET status = 'rejected' WHERE id = ?", [interestId]);
      db.save();
      return res.json({ message: '已拒绝' });
    }

    const actualCount = db.get(
      "SELECT COUNT(*) AS cnt FROM square_interests WHERE post_id = ? AND status = 'accepted'",
      [post.id]
    );
    if (actualCount.cnt >= post.max_people) return res.status(400).json({ error: '人数已满' });

    db.run("UPDATE square_interests SET status = 'accepted' WHERE id = ?", [interestId]);
    const newCount = actualCount.cnt + 1;
    db.run('UPDATE square_posts SET current_count = ? WHERE id = ?', [newCount, post.id]);
    if (newCount >= post.max_people) db.run("UPDATE square_posts SET status = 'full' WHERE id = ?", [post.id]);
    db.save();

    createNotification(db, {
      userId: interest.user_id, type: 'course_square_accepted', title: '搭子申请已通过',
      message: `你对「${post.title}」的申请已被接受`,
      relatedType: 'course_square_post', relatedId: post.id
    });
    db.save();

    res.json({ message: '已接受' });
  });

  // GET /api/courses/:id/square-posts/:postId/comments — 评论列表
  router.get('/:id/square-posts/:postId/comments', (req, res) => {
    const postId = Number(req.params.postId);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const total = (db.get('SELECT COUNT(*) AS cnt FROM square_comments WHERE post_id = ?', [postId]) || {}).cnt || 0;

    const comments = db.all(`
      SELECT sc.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM square_comments sc
      JOIN users u ON sc.author_id = u.id
      WHERE sc.post_id = ?
      ORDER BY sc.created_at ASC
      LIMIT ? OFFSET ?
    `, [postId, pageSize, offset]);

    res.json({ comments, total, page, pageSize });
  });

  // POST /api/courses/:id/square-posts/:postId/comments — 发评论 [Auth + 选课]（:id 为大课 ID）
  router.post('/:id/square-posts/:postId/comments', authMiddleware, parseCourseSquareCommentImage, (req, res) => {
    const bigCourseId = Number(req.params.id);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;
    if (!isEnrolledInBigCourse(userId, bigCourseId)) return res.status(403).json({ error: '未选修该课程' });

    const { content, parent_id } = req.body;
    const imageFile = req.file;

    if ((!content || !content.trim()) && !imageFile) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '请输入内容或上传图片' });
    }
    if (content && content.length > 500) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '回复内容不能超过 500 字' });
    }

    const post = db.get('SELECT id, creator_id, title FROM square_posts WHERE id = ? AND course_id = ?', [postId, bigCourseId]);
    if (!post) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: '帖子不存在' });
    }

    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, post_id FROM square_comments WHERE id = ?', [parentId]);
      if (!parentComment || parentComment.post_id !== postId) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    const imageUrl = imageFile ? `/uploads/comment-images/${imageFile.filename}` : '';

    const result = db.run(
      'INSERT INTO square_comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, userId, (content || '').trim(), parentId, imageUrl]
    );
    db.save();

    const commenter = db.get('SELECT nickname FROM users WHERE id = ?', [userId]);

    if (parentId) {
      const parentComment = db.get('SELECT author_id FROM square_comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== userId) {
        createNotification(db, {
          userId: parentComment.author_id, type: 'new_comment', title: '新回复',
          message: `${commenter?.nickname || '匿名'} 回复了你的评论`,
          relatedType: 'course_square_post', relatedId: postId, courseId: bigCourseId
        });
        db.save();
      }
    } else {
      if (post.creator_id !== userId) {
        createNotification(db, {
          userId: post.creator_id, type: 'new_comment', title: '新评论',
          message: `${commenter?.nickname || '匿名'} 评论了你的搭子帖「${post.title}」`,
          relatedType: 'course_square_post', relatedId: postId, courseId: bigCourseId
        });
        db.save();
      }
    }

    res.status(201).json({ id: result.lastInsertRowid, post_id: postId, author_id: userId, content: (content || '').trim(), parent_id: parentId, image_url: imageUrl });
  });

  // DELETE /api/courses/:id/square-posts/:postId/comments/:commentId — 删除评论（硬删除）
  router.delete('/:id/square-posts/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const commentId = Number(req.params.commentId);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM square_comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的回复' });

    if (comment.image_url) {
      const imgPath = path.join(__dirname, '..', comment.image_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    // 硬删除：直接删除评论
    db.run('DELETE FROM square_comments WHERE id = ?', [commentId]);
    db.save();
    res.json({ message: '已删除' });
  });

  // GET /api/courses/:id/square-posts/:postId/comments/:commentId/replies — 嵌套回复
  router.get('/:id/square-posts/:postId/comments/:commentId/replies', (req, res) => {
    const commentId = Number(req.params.commentId);
    const replies = db.all(`
      SELECT sc.*, u.nickname AS author_name, u.avatar_url AS author_avatar_url
      FROM square_comments sc
      JOIN users u ON sc.author_id = u.id
      WHERE sc.parent_id = ?
      ORDER BY sc.created_at ASC
    `, [commentId]);
    res.json(replies);
  });

  return router;
};
