const express = require('express');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db', 'eduspace.db');

// --- Database Wrapper ---
class Database {
  constructor(sqlDb) {
    this.db = sqlDb;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    const id = this.db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0];
    const changes = this.db.getRowsModified();
    return { lastInsertRowid: id, changes };
  }

  get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(sql, params = []) {
    const results = this.db.exec(sql, params);
    if (results.length === 0) return [];
    return results[0].values.map(row => {
      const obj = {};
      results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  save() {
    const data = this.db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// --- Init ---
async function start() {
  const SQL = await initSqlJs();

  fs.mkdirSync(path.join(__dirname, 'db'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, 'uploads', 'materials'), { recursive: true });

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  const db = new Database(sqlDb);

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // --- Migration: add new columns (safe if already exist) ---
  const migrateTable = (table, col, type) => {
    const info = db.all(`PRAGMA table_info(${table})`);
    if (!info.some(c => c.name === col)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      console.log(`  ✓ 迁移: ${table}.${col} (${type})`);
    }
  };

  migrateTable('users', 'password_hash', "TEXT DEFAULT ''");
  migrateTable('users', 'nickname', "TEXT DEFAULT ''");
  migrateTable('users', 'major', "TEXT DEFAULT ''");
  migrateTable('users', 'grade', "TEXT DEFAULT ''");
  migrateTable('users', 'email', "TEXT DEFAULT ''");
  migrateTable('users', 'email_verified', "INTEGER DEFAULT 0");
  migrateTable('users', 'verification_code', "TEXT DEFAULT ''");
  migrateTable('users', 'verification_code_expires', "TEXT DEFAULT ''");
  migrateTable('users', 'qq', "TEXT DEFAULT ''");
  migrateTable('users', 'privacy_show_profile', "INTEGER DEFAULT 1");
  migrateTable('users', 'privacy_allow_match', "INTEGER DEFAULT 1");
  migrateTable('users', 'wechat', "TEXT DEFAULT ''");
  migrateTable('users', 'douyin', "TEXT DEFAULT ''");
  migrateTable('users', 'avatar_desc', "TEXT DEFAULT ''");
  migrateTable('users', 'mbti', "TEXT DEFAULT ''");
  migrateTable('users', 'checkin_streak', "INTEGER DEFAULT 0");
  migrateTable('users', 'last_checkin_date', "TEXT DEFAULT ''");
  migrateTable('users', 'grace_days', "INTEGER DEFAULT 0");
  migrateTable('courses', 'semester', "TEXT DEFAULT ''");
  migrateTable('courses', 'teacher', "TEXT DEFAULT ''");

  // New table: user_courses (many-to-many enrollment)
  db.run(`CREATE TABLE IF NOT EXISTS user_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
  )`);

  migrateTable('user_courses', 'semester_key', "TEXT DEFAULT ''");

  // New table: materials (学习资料)
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    uploader_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    chapter TEXT DEFAULT '',
    category TEXT DEFAULT '其他',
    avg_rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  )`);

  // New table: material_ratings (资料评分)
  db.run(`CREATE TABLE IF NOT EXISTS material_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(material_id, user_id)
  )`);

  // New table: study_invites (自习邀约)
  db.run(`CREATE TABLE IF NOT EXISTS study_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    course_id INTEGER,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    study_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT DEFAULT '',
    max_participants INTEGER DEFAULT 4,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);

  // New table: study_invite_responses (邀约响应)
  db.run(`CREATE TABLE IF NOT EXISTS study_invite_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invite_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'accepted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invite_id) REFERENCES study_invites(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(invite_id, user_id)
  )`);

  // New table: notifications (消息提醒)
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_type TEXT,
    related_id INTEGER,
    course_id INTEGER,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // New table: square_posts (交友广场帖子)
  db.run(`CREATE TABLE IF NOT EXISTS square_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    max_people INTEGER DEFAULT 1,
    current_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    expires_at TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`);

  // New table: square_interests (感兴趣记录)
  db.run(`CREATE TABLE IF NOT EXISTS square_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(post_id, user_id)
  )`);

  // New table: square_comments (广场评论)
  db.run(`CREATE TABLE IF NOT EXISTS square_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES square_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // New table: follows (关注关系)
  db.run(`CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
  )`);

  // New table: feedback (问题反馈)
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    contact TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS favorite_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS favorite_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE(user_id, post_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS post_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
  )`);

  db.save();

  // --- Middleware ---
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // --- API Routes ---
  const coursesRouter = require('./routes/courses')(db);
  const userRouter = require('./routes/user')(db);
  const scheduleRouter = require('./routes/schedule')(db);
  const authRouter = require('./routes/auth')(db);
  const materialsRouter = require('./routes/materials')(db);
  const invitesRouter = require('./routes/invites')(db);
  const notificationsRouter = require('./routes/notifications')(db);
  const searchRouter = require('./routes/search')(db);
  const squareRouter = require('./routes/square')(db);
  const myPostsRouter = require('./routes/my_posts')(db);
  const favoritesRouter = require('./routes/favorites')(db);

  app.use('/api/courses', coursesRouter);
  app.use('/api/materials', materialsRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/square', squareRouter);
  app.use('/api/user', userRouter);
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/my-posts', myPostsRouter);
  app.use('/api/favorites', favoritesRouter);

  // --- SPA Fallback ---
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // --- Auto-save on shutdown ---
  process.on('SIGINT', () => { db.save(); process.exit(); });
  process.on('SIGTERM', () => { db.save(); process.exit(); });

  app.listen(PORT, () => {
    console.log(`课搭子 server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
