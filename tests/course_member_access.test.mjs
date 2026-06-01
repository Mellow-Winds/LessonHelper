import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createCoursesRouter from '../routes/courses.js';
import { generateToken } from '../routes/middleware/auth.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE user_courses (
      id INTEGER PRIMARY KEY, user_id INTEGER, course_id INTEGER, enrolled_at TEXT
    );
    CREATE TABLE users (
      id INTEGER PRIMARY KEY, nickname TEXT, major TEXT, grade TEXT,
      avatar_url TEXT, qq TEXT, privacy_show_profile INTEGER, privacy_allow_match INTEGER
    );
    INSERT INTO courses VALUES (10, '线性代数');
    INSERT INTO users VALUES (1, '已选课', '数学', '2024', '', '', 1, 1);
    INSERT INTO users VALUES (2, '未选课', '物理', '2024', '', '', 1, 1);
    INSERT INTO user_courses VALUES (1, 1, 10, '2026-06-02');
  `);
  return {
    get(sql, params = []) {
      const stmt = raw.prepare(sql);
      stmt.bind(params);
      const value = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return value;
    },
    all(sql, params = []) {
      const stmt = raw.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
  };
}

function runRoute(router, path, userId) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods.get);
  let statusCode = 200;
  let body;
  const req = {
    params: { id: '10' },
    query: {},
    headers: { authorization: `Bearer ${generateToken({ id: userId, username: `u${userId}` })}` },
  };
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; },
  };
  let index = 0;
  const next = () => layer.route.stack[index++]?.handle(req, res, next);
  next();
  return { statusCode, body };
}

const SQL = await initSqlJs();

test('course members are visible to enrolled users', () => {
  const router = createCoursesRouter(createDb(SQL));
  const result = runRoute(router, '/:id/members', 1);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.length, 1);
});

test('course members are hidden from users outside the course', () => {
  const router = createCoursesRouter(createDb(SQL));
  assert.equal(runRoute(router, '/:id/members', 2).statusCode, 403);
  assert.equal(runRoute(router, '/:id/members/stats', 2).statusCode, 403);
});
