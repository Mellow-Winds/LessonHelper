import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publishSource = await readFile(new URL('../public/js/pages/courses/publish.js', import.meta.url), 'utf8');
const myCoursesSource = await readFile(new URL('../public/js/pages/courses/my_courses.js', import.meta.url), 'utf8');
const plazaSource = await readFile(new URL('../public/js/pages/courses/plaza.js', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('../public/css/style.css', import.meta.url), 'utf8');

test('publish page selects and submits multiple attachments', () => {
  assert.match(publishSource, /id="publish-file-input"[^>]*multiple/);
  assert.match(publishSource, /formData\.append\('files', file\)/);
  assert.match(publishSource, /MAX_FILE_COUNT = 9/);
});

test('course post cards render image grids and ordinary attachment links', () => {
  assert.match(myCoursesSource, /renderPostAttachments/);
  assert.match(plazaSource, /renderPostAttachments/);
  assert.match(styleSource, /\.post-image-grid/);
  assert.match(styleSource, /\.post-attachment-row/);
});
