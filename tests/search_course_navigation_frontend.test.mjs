import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../public/js/pages/auth.js', import.meta.url), 'utf8');
const allCoursesSource = await readFile(new URL('../public/js/pages/courses/all_courses.js', import.meta.url), 'utf8');

test('search results use course-aware navigation for courses, materials, and posts', () => {
  assert.match(authSource, /navigateToCourseResult\(\$\{c\.id\}\)/);
  assert.match(authSource, /navigateToCourseResult\(\$\{m\.course_id\}\)/);
  assert.match(authSource, /navigateToCourseResult\(\$\{p\.course_id\},\s*\$\{p\.id\}\)/);
});

test('navigateToCourseResult navigates to unified course-detail page', () => {
  assert.match(authSource, /navigateTo\('course-detail'/);
});

test('all_courses exports navigateToPlazaCourseById for search/favorites integration', () => {
  assert.match(allCoursesSource, /export async function navigateToPlazaCourseById/);
  assert.match(allCoursesSource, /item\.courseIds\.includes\(Number\(courseId\)\)/);
  assert.match(allCoursesSource, /navigateTo\('course-detail'/);
});
