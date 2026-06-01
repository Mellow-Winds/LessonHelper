# Favorites, Course Access, and Post Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add course and course-post favorites, enforce member-list privacy for non-members, route search results to read-only plaza pages when needed, rename the square search label, and support up to nine post attachments with image-grid previews.

**Architecture:** Keep favorites in a focused router with two relational tables. Extend the existing course router with enrollment guards and multipart post creation while preserving JSON requests. Add small frontend helpers for course-aware navigation, favorite toggles, attachment rendering, and the dedicated favorites page.

**Tech Stack:** Express 4, sql.js SQLite, multer, native JavaScript SPA, Node test runner.

---

### Task 1: Protect Course Members and Route Search Results Safely

**Files:**
- Modify: `routes/courses.js`
- Modify: `public/js/pages/auth.js`
- Modify: `public/js/pages/courses/plaza.js`
- Create: `tests/course_member_access.test.mjs`
- Create: `tests/search_course_navigation_frontend.test.mjs`

- [ ] **Step 1: Write failing backend tests**

Create a sql.js test database, invoke the `GET /:id/members` and `GET /:id/members/stats` handlers with authenticated and unauthenticated requests, and assert:

```js
assert.equal(runMembers({ userId: 1 }).statusCode, 200);
assert.equal(runMembers({ userId: 2 }).statusCode, 403);
assert.equal(runStats({ userId: 2 }).statusCode, 403);
```

- [ ] **Step 2: Write failing frontend source tests**

Assert that search results call a course-aware navigation helper rather than hard-coding `mycourse-detail`, and that plaza navigation resolves course IDs to aggregate indexes:

```js
assert.match(authSource, /navigateToCourseResult\(c\.id\)/);
assert.match(authSource, /navigateToCourseResult\(m\.course_id\)/);
assert.match(authSource, /navigateToCourseResult\(p\.course_id,\s*p\.id\)/);
assert.match(plazaSource, /export async function navigateToPlazaCourseById/);
```

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/course_member_access.test.mjs tests/search_course_navigation_frontend.test.mjs`

Expected: FAIL because member handlers are public and helpers do not exist.

- [ ] **Step 4: Add enrollment guards**

In `routes/courses.js`, add `authMiddleware` to both member routes and reject users not present in `user_courses`:

```js
function isEnrolled(db, userId, courseId) {
  return !!db.get(
    'SELECT 1 FROM user_courses WHERE user_id = ? AND course_id = ?',
    [userId, courseId]
  );
}
```

- [ ] **Step 5: Add course-aware frontend navigation**

In `public/js/pages/courses/plaza.js`, export:

```js
export async function navigateToPlazaCourseById(courseId, postId) {
  await loadPlazaDataOnce();
  const idx = _bigCoursesList.findIndex(item => item.courseIds.includes(Number(courseId)));
  if (idx < 0) return false;
  window._plazaTargetPostId = postId || null;
  navigateTo('plaza-course', idx);
  return true;
}
```

In `public/js/pages/auth.js`, load the user’s joined course IDs and route joined courses to `mycourse-detail`; otherwise dynamically import the plaza helper. Apply the helper to course, material, and course-post results. When a post ID is present, store a target for scrolling after render.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `node --test tests/course_member_access.test.mjs tests/search_course_navigation_frontend.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add routes/courses.js public/js/pages/auth.js public/js/pages/courses/plaza.js tests/course_member_access.test.mjs tests/search_course_navigation_frontend.test.mjs
git commit -m "fix: protect course members and route search safely"
```

### Task 2: Add Favorite Persistence and API

**Files:**
- Modify: `server.js`
- Create: `routes/favorites.js`
- Create: `tests/favorites.test.mjs`

- [ ] **Step 1: Write failing API tests**

Build a sql.js database with users, courses, posts, and favorite tables. Exercise router handlers and assert:

```js
assert.equal(createCourseFavorite(1, 10).statusCode, 201);
assert.equal(createCourseFavorite(1, 10).statusCode, 200);
assert.equal(listFavorites('courses', 1).body.length, 1);
assert.equal(listFavorites('posts', 1).body[0].course_title, '线性代数');
assert.equal(deletePostFavorite(1, 20).statusCode, 200);
```

Also assert missing resources return `404` and lists sort by `favorited_at DESC`.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/favorites.test.mjs`

Expected: FAIL because `routes/favorites.js` does not exist.

- [ ] **Step 3: Add schema and router mount**

In `server.js`, create `favorite_courses`, `favorite_posts`, and later-used `post_attachments` tables with unique constraints and cascading foreign keys. Require and mount:

```js
const favoritesRouter = require('./routes/favorites')(db);
app.use('/api/favorites', favoritesRouter);
```

- [ ] **Step 4: Implement favorites router**

Create authenticated list, create, and delete handlers. Use `INSERT OR IGNORE` for idempotent favorites and return resource details needed by cards:

```sql
SELECT c.*, fc.created_at AS favorited_at,
  (SELECT COUNT(*) FROM user_courses uc WHERE uc.course_id = c.id) AS enrollment_count
FROM favorite_courses fc
JOIN courses c ON c.id = fc.course_id
WHERE fc.user_id = ?
ORDER BY fc.created_at DESC, fc.id DESC
```

- [ ] **Step 5: Run test and verify GREEN**

Run: `node --test tests/favorites.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.js routes/favorites.js tests/favorites.test.mjs
git commit -m "feat: add course and post favorites api"
```

### Task 3: Build Favorite UI and Rename the Square Search Label

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/main.js`
- Modify: `public/js/pages/auth.js`
- Modify: `public/js/pages/courses/my_courses.js`
- Modify: `public/js/pages/courses/plaza.js`
- Create: `public/js/pages/favorites.js`
- Create: `tests/favorites_frontend.test.mjs`
- Modify: `tests/search_square_posts_frontend.test.mjs`

- [ ] **Step 1: Write failing frontend source tests**

Assert:

```js
assert.match(indexSource, /navigateTo\('favorites'\)/);
assert.match(favoritesSource, /registerPage\('favorites'/);
assert.match(favoritesSource, /\/api\/favorites\?type=courses/);
assert.match(favoritesSource, /\/api\/favorites\?type=posts/);
assert.match(authSource, /data-tab="squarePosts">广场<\/button>/);
assert.doesNotMatch(authSource, /广场帖子/);
```

Also assert both course detail modules render course favorite controls and course-post cards render post favorite controls.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/favorites_frontend.test.mjs tests/search_square_posts_frontend.test.mjs`

Expected: FAIL because the page and controls do not exist and old text remains.

- [ ] **Step 3: Add sidebar page registration**

Add the sidebar entry in `public/index.html`, import `./pages/favorites.js` from `public/js/main.js`, and expose required click handlers through the existing `window` export pattern.

- [ ] **Step 4: Implement favorites page**

Create `public/js/pages/favorites.js` with two tabs, counts, loading state, empty state without a plaza link, recent-first cards, and optimistic delete behavior. Course cards call the course-aware navigation helper. Post cards pass `course_id` and `id` so the destination can scroll to the post.

- [ ] **Step 5: Add optimistic favorite buttons**

Add reusable toggle functions in `favorites.js`:

```js
export async function toggleCourseFavorite(courseId, button) { /* optimistic POST or DELETE */ }
export async function togglePostFavorite(postId, button) { /* optimistic POST or DELETE */ }
```

Render course favorite buttons in both course detail pages and post favorite buttons in both post-card renderers. Stop propagation when a favorite button is clicked.

- [ ] **Step 6: Rename square labels**

In `public/js/pages/auth.js`, change only visible strings from `广场帖子` to `广场`. Keep `squarePosts` request and response identifiers.

- [ ] **Step 7: Run tests and verify GREEN**

Run: `node --test tests/favorites_frontend.test.mjs tests/search_square_posts_frontend.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public/js/main.js public/js/pages/auth.js public/js/pages/courses/my_courses.js public/js/pages/courses/plaza.js public/js/pages/favorites.js tests/favorites_frontend.test.mjs tests/search_square_posts_frontend.test.mjs
git commit -m "feat: add favorites page and controls"
```

### Task 4: Accept Multiple Post Attachments

**Files:**
- Modify: `routes/courses.js`
- Modify: `public/js/pages/courses/publish.js`
- Create: `tests/course_post_attachments.test.mjs`
- Create: `tests/course_post_attachments_frontend.test.mjs`

- [ ] **Step 1: Write failing backend attachment tests**

Use a temporary upload directory and invoke the multipart middleware through an Express test server. Assert:

```js
assert.equal(jsonPost.statusCode, 201);
assert.equal(multipartPost.statusCode, 201);
assert.equal(multipartPost.body.attachments.length, 2);
assert.equal(tooManyAttachments.statusCode, 400);
```

Also assert image attachments have view URLs and ordinary files have download URLs.

- [ ] **Step 2: Write failing frontend attachment tests**

Assert:

```js
assert.match(publishSource, /multiple/);
assert.match(publishSource, /formData\.append\('files'/);
assert.match(myCoursesSource, /post-image-grid/);
assert.match(plazaSource, /post-image-grid/);
assert.match(myCoursesSource, /attachment\.view_url/);
```

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/course_post_attachments.test.mjs tests/course_post_attachments_frontend.test.mjs`

Expected: FAIL because the post route only parses JSON and the UI is single-file.

- [ ] **Step 4: Add multipart middleware and attachment persistence**

In `routes/courses.js`, configure `multer.diskStorage` for `uploads/post-attachments`, allow at most 9 files with a 20MB per-file limit, and wrap `upload.array('files', 9)` so JSON requests bypass multer cleanly. Insert `post_attachments` after creating the post and delete uploaded files on validation or database failure.

- [ ] **Step 5: Return attachment metadata**

Attach arrays to post-list responses and post-create responses:

```js
{
  id,
  file_name,
  file_type,
  file_size,
  view_url: file_type === 'image' ? `/api/courses/posts/attachments/${id}/view` : null,
  download_url: `/api/courses/posts/attachments/${id}/download`
}
```

Add view and download endpoints using `res.sendFile` and a UTF-8 `Content-Disposition` header for downloads.

- [ ] **Step 6: Update publish page**

Change the file input to `multiple`, enforce 9 files client-side, list selected names, append all files:

```js
for (const file of fileInput.files) formData.append('files', file);
```

- [ ] **Step 7: Render attachment grids**

Add shared rendering behavior in the existing course-card modules. Render images in `post-image-grid count-N` and ordinary attachments as file rows with download links. Add CSS classes in `public/css/style.css` for one-image, two-image, and three-column layouts.

- [ ] **Step 8: Run tests and verify GREEN**

Run: `node --test tests/course_post_attachments.test.mjs tests/course_post_attachments_frontend.test.mjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add routes/courses.js public/js/pages/courses/publish.js public/js/pages/courses/my_courses.js public/js/pages/courses/plaza.js public/css/style.css tests/course_post_attachments.test.mjs tests/course_post_attachments_frontend.test.mjs
git commit -m "feat: support course post attachments"
```

### Task 5: Documentation and Full Verification

**Files:**
- Modify: `docs/development-steps.md`
- Modify: `devlog/2026-06-02.md`

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run whitespace check**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Update project docs**

Record favorites, protected course member APIs, search routing, square label rename, and multi-attachment post support in `docs/development-steps.md` and `devlog/2026-06-02.md`.

- [ ] **Step 4: Re-run full verification**

Run: `npm test`

Expected: all tests pass with zero failures.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/development-steps.md devlog/2026-06-02.md
git commit -m "docs: record favorites and post attachments"
```
