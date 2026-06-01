import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const routerSource = await readFile(new URL('../public/js/core/router.js', import.meta.url), 'utf8');
const favoritesSource = await readFile(new URL('../public/js/pages/favorites.js', import.meta.url), 'utf8').catch(() => '');
const myCoursesSource = await readFile(new URL('../public/js/pages/courses/my_courses.js', import.meta.url), 'utf8');
const plazaSource = await readFile(new URL('../public/js/pages/courses/plaza.js', import.meta.url), 'utf8');

test('favorites page is reachable from the sidebar', () => {
  assert.match(indexSource, /data-page="favorites"/);
  assert.match(routerSource, /page: 'favorites'/);
  assert.match(favoritesSource, /registerPage\('favorites'/);
});

test('favorites page loads courses and posts and exposes optimistic toggles', () => {
  assert.match(favoritesSource, /\/api\/favorites\?type=courses/);
  assert.match(favoritesSource, /\/api\/favorites\?type=posts/);
  assert.match(favoritesSource, /export async function toggleCourseFavorite/);
  assert.match(favoritesSource, /export async function togglePostFavorite/);
  assert.match(favoritesSource, /课程 \$\{courses\.length\}/);
  assert.match(favoritesSource, /帖子 \$\{posts\.length\}/);
});

test('course detail pages and course post cards render favorite controls', () => {
  assert.match(myCoursesSource, /renderCourseFavoriteButton/);
  assert.match(myCoursesSource, /renderPostFavoriteButton/);
  assert.match(plazaSource, /renderCourseFavoriteButton/);
  assert.match(plazaSource, /renderPostFavoriteButton/);
});
