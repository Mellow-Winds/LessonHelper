const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware } = require('./middleware/auth');
const { createNotification, notifyCourseMembers } = require('./notifications');

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

// 评论图片上传配置（单张，JPG/PNG，≤1MB）
const COMMENT_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'comment-images');
const COMMENT_IMAGE_MAX = 1 * 1024 * 1024;
const COMMENT_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png']);

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
  limits: { fileSize: COMMENT_IMAGE_MAX, files: 1 },
  fileFilter: (req, file, cb) => {
    try { file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8'); } catch {}
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, COMMENT_IMAGE_EXT.has(ext));
  },
});

function parseCommentImage(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  commentImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '图片不能超过 1MB'
      : error.code === 'LIMIT_FILE_COUNT'
        ? '只能上传一张图片'
        : '仅支持 JPG、PNG 格式';
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

  // GET /api/courses/semesters — 当前用户已选课程涉及的学期列表
  router.get('/semesters', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const rows = db.all(
      'SELECT DISTINCT semester_key FROM user_courses WHERE user_id = ? AND semester_key != "" ORDER BY semester_key DESC',
      [userId]
    );
    res.json(rows.map(r => r.semester_key));
  });

  // GET /api/courses/all — 全校课程列表（公开，供课程广场使用，不需要登录）
  router.get('/all', (req, res) => {
    const courses = db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
      FROM courses c
      ORDER BY c.title ASC
    `);
    res.json(courses);
  });

  // GET /api/courses — 当前用户的课程列表（支持学期筛选）
  router.get('/', authMiddleware, (req, res) => {
    const userId = req.user.userId;
    const { semester } = req.query;

    let sql = `
      SELECT DISTINCT c.*,
        (SELECT COUNT(*) FROM user_courses uc2 WHERE uc2.course_id = c.id) AS enrollment_count
      FROM courses c
      JOIN user_courses uc ON uc.course_id = c.id
      WHERE uc.user_id = ?
    `;
    const params = [userId];

    if (semester && semester !== 'all') {
      sql += ' AND uc.semester_key = ?';
      params.push(semester);
    }

    sql += ' ORDER BY c.created_at DESC';
    const courses = db.all(sql, params);
    res.json(courses);
  });

  // GET /api/courses/:id — 课程详情
  router.get('/:id', (req, res) => {
    const course = db.get(`
      SELECT c.*,
        (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
      FROM courses c
      WHERE c.id = ?
    `, [Number(req.params.id)]);
    if (!course) return res.status(404).json({ error: '课程不存在' });
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

    // 检查课程总数上限
    const count = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE user_id = ?',
      [userId]
    );
    if (count.cnt >= 50) {
      return res.status(400).json({ error: '课程总数已达 50 门上限，请先退出部分课程' });
    }

    db.run(
      'INSERT INTO user_courses (user_id, course_id) VALUES (?, ?)',
      [userId, courseId]
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

  // GET /api/courses/:id/members — 课程成员列表（支持 major/grade 筛选）
  router.get('/:id/members', authMiddleware, (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });
    if (!isEnrolled(req.user.userId, courseId)) {
      return res.status(403).json({ error: '只有课程成员可以查看成员列表' });
    }

    const { major, grade, match_only } = req.query;

    let sql = `
      SELECT u.id AS user_id, u.nickname, u.major, u.grade, u.avatar_url, u.qq, u.privacy_show_profile, u.privacy_allow_match
      FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ?
    `;
    const params = [courseId];

    // match_only=1 时过滤掉不允许匹配的用户
    if (match_only === '1') {
      sql += ' AND u.privacy_allow_match = 1';
    }

    if (major) {
      sql += ' AND u.major LIKE ?';
      params.push(`%${major}%`);
    }
    if (grade) {
      sql += ' AND u.grade = ?';
      params.push(grade);
    }

    sql += ' ORDER BY uc.enrolled_at ASC';

    const members = db.all(sql, params);

    // 隐私过滤：privacy_show_profile=0 时隐藏敏感信息
    const result = members.map(m => {
      const { privacy_show_profile, privacy_allow_match, ...rest } = m;
      if (!privacy_show_profile) {
        return { ...rest, major: '', grade: '', qq: '' };
      }
      return rest;
    });

    res.json(result);
  });

  // GET /api/courses/:id/members/stats — 成员专业和年级分布
  router.get('/:id/members/stats', authMiddleware, (req, res) => {
    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ error: '课程不存在' });
    if (!isEnrolled(req.user.userId, courseId)) {
      return res.status(403).json({ error: '只有课程成员可以查看成员统计' });
    }

    const majors = db.all(`
      SELECT DISTINCT u.major FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ? AND u.major != '' AND u.privacy_allow_match = 1
      ORDER BY u.major ASC
    `, [courseId]).map(r => r.major);

    const grades = db.all(`
      SELECT DISTINCT u.grade FROM user_courses uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.course_id = ? AND u.grade != '' AND u.privacy_allow_match = 1
      ORDER BY u.grade DESC
    `, [courseId]).map(r => r.grade);

    const total = db.get(
      'SELECT COUNT(*) AS cnt FROM user_courses WHERE course_id = ?',
      [courseId]
    ).cnt;

    res.json({ majors, grades, total });
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

  // POST /api/courses/:id/posts — 发帖 [Auth]
  router.post('/:id/posts', authMiddleware, parsePostAttachments, (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
      cleanupUploadedFiles(req.files);
      return res.status(400).json({ error: 'title 和 content 为必填项' });
    }

    const courseId = Number(req.params.id);
    const course = db.get('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      cleanupUploadedFiles(req.files);
      return res.status(404).json({ error: '课程不存在' });
    }
    if (!isEnrolled(req.user.userId, courseId)) {
      cleanupUploadedFiles(req.files);
      return res.status(403).json({ error: '只有课程成员可以发布帖子' });
    }

    const result = db.run(
      'INSERT INTO posts (course_id, author_id, title, content) VALUES (?, ?, ?, ?)',
      [courseId, req.user.userId, title, content]
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

    // 通知：课程有新帖
    const author = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);
    const courseInfo = db.get('SELECT title FROM courses WHERE id = ?', [courseId]);
    notifyCourseMembers(db, {
      courseId, excludeUserId: req.user.userId,
      type: 'new_post', title: '新帖子',
      message: `${author?.nickname || '匿名'} 在「${courseInfo?.title || ''}」发布了「${title}」`,
      relatedType: 'post', relatedId: result.lastInsertRowid
    });
    db.save();

    res.status(201).json({
      id: result.lastInsertRowid,
      course_id: courseId,
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

  // POST /api/courses/posts/:postId/comments — 发评论 [Auth]（支持图片 + 楼中楼）
  router.post('/posts/:postId/comments', authMiddleware, parseCommentImage, (req, res) => {
    const { content, parent_id } = req.body;
    const imageFile = req.file;

    // 至少需要文字或图片
    if ((!content || !content.trim()) && !imageFile) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '请输入内容或上传图片' });
    }

    // 字数限制
    if (content && content.length > 500) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: '回复内容不能超过 500 字' });
    }

    const postId = Number(req.params.postId);
    const post = db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: '帖子不存在' });
    }

    // 楼中楼：校验 parent_id
    let parentId = null;
    if (parent_id) {
      parentId = Number(parent_id);
      const parentComment = db.get('SELECT id, post_id FROM comments WHERE id = ?', [parentId]);
      if (!parentComment || parentComment.post_id !== postId) {
        if (imageFile && fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: '被回复的评论不存在' });
      }
    }

    const imageUrl = imageFile ? `/uploads/comment-images/${imageFile.filename}` : '';

    const result = db.run(
      'INSERT INTO comments (post_id, author_id, content, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [postId, req.user.userId, (content || '').trim(), parentId, imageUrl]
    );
    db.save();

    // 通知逻辑
    const commenter = db.get('SELECT nickname FROM users WHERE id = ?', [req.user.userId]);

    if (parentId) {
      // 楼中楼回复：通知被回复的用户
      const parentComment = db.get('SELECT author_id FROM comments WHERE id = ?', [parentId]);
      if (parentComment && parentComment.author_id !== req.user.userId) {
        createNotification(db, {
          userId: parentComment.author_id, type: 'new_comment', title: '新回复',
          message: `${commenter?.nickname || '匿名'} 回复了你的评论`,
          relatedType: 'post', relatedId: postId
        });
        db.save();
      }
    } else {
      // 主回复：通知帖子作者
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
      image_url: imageUrl
    });
  });

  // DELETE /api/courses/posts/:postId/comments/:commentId — 删除自己的回复
  router.delete('/posts/:postId/comments/:commentId', authMiddleware, (req, res) => {
    const commentId = Number(req.params.commentId);
    const postId = Number(req.params.postId);
    const userId = req.user.userId;

    const comment = db.get('SELECT * FROM comments WHERE id = ? AND post_id = ?', [commentId, postId]);
    if (!comment) return res.status(404).json({ error: '评论不存在' });
    if (comment.author_id !== userId) return res.status(403).json({ error: '只能删除自己的回复' });

    // 删除图片文件
    if (comment.image_url) {
      const imgPath = path.join(__dirname, '..', comment.image_url);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    // 软删除：标记为已删除，保留楼层号
    db.run("UPDATE comments SET content = '[已删除]', image_url = '' WHERE id = ?", [commentId]);
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

  return router;
};
