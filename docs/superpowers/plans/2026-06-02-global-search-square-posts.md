# 全局搜索支持广场帖子实施计划

> **面向执行代理：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实施。每一步使用复选框（`- [ ]`）跟踪状态。

**目标：** 扩展现有全局搜索，使其能够查询未过期的广场帖子、在前端单独展示结果，并点击进入现有广场帖子详情页。

**架构：** 在现有 `GET /api/search` 响应中增加 `squarePosts` 集合，不新增接口。前端继续使用 `public/js/pages/auth.js` 中的搜索页，增加 Tab 和结果分区，并复用现有 `square-post` 路由。

**技术栈：** Express 4、SQLite（`sql.js`）、原生 JavaScript SPA、Node.js 内置测试框架 `node:test`

---

## 文件结构

- 新建 `tests/search_square_posts.test.mjs`：使用内存 SQLite 验证搜索接口的广场帖子查询规则。
- 新建 `tests/search_square_posts_frontend.test.mjs`：验证搜索页包含广场帖子 Tab、结果渲染和详情跳转。
- 修改 `routes/search.js`：增加 `squarePosts` 查询并计入 `total`。
- 修改 `public/js/pages/auth.js`：增加广场帖子搜索 Tab 和结果卡片。

不修改广场列表、详情页和 CSS。

### 任务 1：增加后端广场帖子搜索

**文件：**
- 新建：`tests/search_square_posts.test.mjs`
- 修改：`routes/search.js:50-65`

- [ ] **步骤 1：编写后端失败测试**

新建 `tests/search_square_posts.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import createSearchRouter from '../routes/search.js';

function createDb(SQL) {
  const raw = new SQL.Database();
  raw.run(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, nickname TEXT);
    CREATE TABLE courses (
      id INTEGER PRIMARY KEY, title TEXT, description TEXT, teacher TEXT,
      semester TEXT, created_at TEXT
    );
    CREATE TABLE user_courses (course_id INTEGER);
    CREATE TABLE materials (
      id INTEGER PRIMARY KEY, title TEXT, description TEXT, chapter TEXT,
      category TEXT, course_id INTEGER, uploader_id INTEGER, created_at TEXT
    );
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY, title TEXT, content TEXT, course_id INTEGER,
      author_id INTEGER, created_at TEXT
    );
    CREATE TABLE square_posts (
      id INTEGER PRIMARY KEY, creator_id INTEGER, title TEXT, category TEXT,
      description TEXT, max_people INTEGER, current_count INTEGER,
      status TEXT, expires_at TEXT, created_at TEXT
    );

    INSERT INTO users VALUES (1, '小林');
    INSERT INTO square_posts VALUES
      (1, 1, '线性代数考研搭子', '考研搭子', '一起刷线性代数题', 2, 0, 'open', datetime('now', '+2 day'), '2026-06-02 09:00:00'),
      (2, 1, '线性代数冲刺小组', '考研搭子', '名额已满但仍可查看', 1, 1, 'full', datetime('now', '+1 day'), '2026-06-02 10:00:00'),
      (3, 1, '线性代数过期小组', '考研搭子', '不应出现在搜索结果中', 2, 0, 'open', datetime('now', '-1 day'), '2026-06-02 11:00:00'),
      (4, 1, '英语口语练习', '技能交换', '与查询关键词无关', 2, 0, 'open', datetime('now', '+2 day'), '2026-06-02 12:00:00');
  `);

  return {
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

function runSearch(db, query) {
  const router = createSearchRouter(db);
  const layer = router.stack.find(item => item.route?.path === '/' && item.route.methods.get);
  let statusCode = 200;
  let body;

  layer.route.stack[0].handle(
    { query },
    {
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        body = value;
      },
    },
  );

  return { statusCode, body };
}

const SQL = await initSqlJs();

test('type=squarePosts returns matching visible square posts including full posts', () => {
  const result = runSearch(createDb(SQL), { q: '线性代数', type: 'squarePosts' });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body.squarePosts.map(post => post.id), [2, 1]);
  assert.equal(result.body.squarePosts[0].creator_name, '小林');
  assert.equal(result.body.total, 2);
});

test('type=all includes square posts in the total', () => {
  const result = runSearch(createDb(SQL), { q: '线性代数', type: 'all' });

  assert.deepEqual(result.body.squarePosts.map(post => post.id), [2, 1]);
  assert.equal(result.body.total, 2);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node --test tests/search_square_posts.test.mjs
```

预期：失败，提示 `squarePosts` 为 `undefined`，因为搜索接口尚未返回广场帖子集合。

- [ ] **步骤 3：实现后端查询**

在 `routes/search.js` 的课程帖子查询之后增加：

```js
    if (type === 'all' || type === 'squarePosts') {
      results.squarePosts = db.all(`
        SELECT sp.id, sp.title, sp.description, sp.category, sp.status,
          sp.max_people, sp.current_count, sp.expires_at, sp.created_at,
          u.nickname AS creator_name
        FROM square_posts sp
        JOIN users u ON sp.creator_id = u.id
        WHERE (sp.title LIKE ? OR sp.description LIKE ?)
          AND sp.expires_at > datetime('now')
          AND sp.status != 'expired'
        ORDER BY sp.created_at DESC
        LIMIT ?
      `, [keyword, keyword, limit]);
    }
```

将 `total` 计算改为：

```js
    const total = (results.courses?.length || 0)
      + (results.materials?.length || 0)
      + (results.posts?.length || 0)
      + (results.squarePosts?.length || 0);
```

- [ ] **步骤 4：运行后端测试并确认通过**

运行：

```bash
node --test tests/search_square_posts.test.mjs
```

预期：2 个测试全部通过。

- [ ] **步骤 5：提交后端改动**

```bash
git add routes/search.js tests/search_square_posts.test.mjs
git commit -m "feat: 支持搜索广场帖子"
```

### 任务 2：增加前端广场帖子结果分区和跳转

**文件：**
- 新建：`tests/search_square_posts_frontend.test.mjs`
- 修改：`public/js/pages/auth.js:401-510`

- [ ] **步骤 1：编写前端失败测试**

新建 `tests/search_square_posts_frontend.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/js/pages/auth.js', import.meta.url), 'utf8');

test('search page exposes a square posts tab', () => {
  assert.match(source, /data-tab="squarePosts">广场帖子/);
  assert.match(source, /搜索课程、资料、帖子、广场帖子\.\.\./);
});

test('search results render square posts and link to the existing detail page', () => {
  assert.match(source, /const \{ courses = \[\], materials = \[\], posts = \[\], squarePosts = \[\] \} = data;/);
  assert.match(source, /if \(squarePosts\.length > 0\)/);
  assert.match(source, /navigateTo\('square-post', \$\{p\.id\}\)/);
  assert.match(source, /remainingDays/);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
node --test tests/search_square_posts_frontend.test.mjs
```

预期：失败，提示找不到 `squarePosts` Tab 或渲染逻辑。

- [ ] **步骤 3：扩展结果集合和总数**

在 `public/js/pages/auth.js` 的 `renderSearchResults` 中，将开头改为：

```js
function renderSearchResults(data, q) {
  const { courses = [], materials = [], posts = [], squarePosts = [] } = data;
  const total = courses.length + materials.length + posts.length + squarePosts.length;
```

- [ ] **步骤 4：增加广场帖子结果分区**

在课程帖子分区之后、`return html;` 之前增加：

```js
  if (squarePosts.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">explore</span> 广场帖子 (${squarePosts.length})</h3>`;
    html += squarePosts.map(p => {
      const snippet = getSnippet(p.description, q, 80);
      const remainingDays = Math.max(0, Math.ceil((new Date(p.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)));
      return `
        <div class="card search-result-card" onclick="navigateTo('square-post', ${p.id})">
          <div style="font-weight:600">${highlight(p.title, q)}</div>
          ${snippet ? `<div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px">${highlight(snippet, q)}</div>` : ''}
          <div style="font-size:12px;color:var(--md-outline);margin-top:4px">
            ${escHtml(p.category)} · ${escHtml(p.creator_name)} · ${escHtml(p.status)} · 剩余 ${remainingDays} 天
          </div>
        </div>
      `;
    }).join('');
  }
```

- [ ] **步骤 5：增加 Tab 并更新搜索提示**

将搜索输入框标签改为：

```js
          label: '搜索课程、资料、帖子、广场帖子...',
```

在课程帖子 Tab 后增加：

```html
      <button class="md-tab-btn ${activeTab === 'squarePosts' ? 'active' : ''}" data-tab="squarePosts">广场帖子</button>
```

- [ ] **步骤 6：运行前端测试并确认通过**

运行：

```bash
node --test tests/search_square_posts_frontend.test.mjs
```

预期：2 个测试全部通过。

- [ ] **步骤 7：提交前端改动**

```bash
git add public/js/pages/auth.js tests/search_square_posts_frontend.test.mjs
git commit -m "feat: 展示广场帖子搜索结果"
```

### 任务 3：统一验证

**文件：**
- 验证：`routes/search.js`
- 验证：`public/js/pages/auth.js`
- 验证：`tests/search_square_posts.test.mjs`
- 验证：`tests/search_square_posts_frontend.test.mjs`

- [ ] **步骤 1：运行本次功能测试**

```bash
node --test tests/search_square_posts.test.mjs tests/search_square_posts_frontend.test.mjs
```

预期：4 个测试全部通过。

- [ ] **步骤 2：运行现有测试**

```bash
npm test
```

预期：现有通知跳转测试全部通过。

- [ ] **步骤 3：检查格式问题**

```bash
git diff --check
```

预期：无输出。

- [ ] **步骤 4：检查提交范围**

```bash
git status --short
git log --oneline -5
```

预期：本次功能仅包含后端搜索、前端搜索页和新增测试；工作区中原有的通知相关改动保持不变。
