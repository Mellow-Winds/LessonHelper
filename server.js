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

  db.save();

  // --- Middleware ---
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // --- API Routes ---
  const coursesRouter = require('./routes/courses')(db);
  const userRouter = require('./routes/user')(db);
  const scheduleRouter = require('./routes/schedule')();

  app.use('/api/courses', coursesRouter);
  app.use('/api/user', userRouter);
  app.use('/api/schedule', scheduleRouter);

  // --- SPA Fallback ---
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // --- Auto-save on shutdown ---
  process.on('SIGINT', () => { db.save(); process.exit(); });
  process.on('SIGTERM', () => { db.save(); process.exit(); });

  app.listen(PORT, () => {
    console.log(`EduSpace server running at http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
