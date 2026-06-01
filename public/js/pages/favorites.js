import { apiGet, apiPost, apiDelete, isLoggedIn } from '../core/api.js';
import { registerPage, navigateTo, animStagger, bindRipples } from '../core/router.js';
import { showToast, escHtml, formatTime } from '../components/ui.js';
import { navigateToCourseResult } from './auth.js';

export async function getFavoriteCourseIds() {
  if (!isLoggedIn()) return new Set();
  const courses = await apiGet('/api/favorites?type=courses');
  return new Set(Array.isArray(courses) ? courses.map(course => course.id) : []);
}

export async function getFavoritePostIds() {
  if (!isLoggedIn()) return new Set();
  const posts = await apiGet('/api/favorites?type=posts');
  return new Set(Array.isArray(posts) ? posts.map(post => post.id) : []);
}

export function renderCourseFavoriteButton(courseId, isFavorited) {
  return `
    <button class="btn btn-secondary btn-compact favorite-btn${isFavorited ? ' favorited' : ''}"
      onclick="event.stopPropagation();toggleCourseFavorite(${courseId}, this)">
      <span class="mi">${isFavorited ? 'bookmark' : 'bookmark_border'}</span>
      ${isFavorited ? '已收藏' : '收藏'}
    </button>
  `;
}

export function renderPostFavoriteButton(postId, isFavorited) {
  return `
    <button class="btn btn-secondary btn-compact favorite-btn${isFavorited ? ' favorited' : ''}"
      onclick="event.stopPropagation();togglePostFavorite(${postId}, this)">
      <span class="mi">${isFavorited ? 'bookmark' : 'bookmark_border'}</span>
      ${isFavorited ? '已收藏' : '收藏'}
    </button>
  `;
}

async function toggleFavorite(type, id, button) {
  const wasFavorited = button.classList.contains('favorited');
  const setState = (favorited) => {
    button.classList.toggle('favorited', favorited);
    button.querySelector('.mi').textContent = favorited ? 'bookmark' : 'bookmark_border';
    button.lastChild.textContent = favorited ? '已收藏' : '收藏';
  };
  setState(!wasFavorited);
  const url = `/api/favorites/${type}/${id}`;
  const result = wasFavorited ? await apiDelete(url) : await apiPost(url, {});
  if (result.error) {
    setState(wasFavorited);
    showToast(result.error);
  }
}

export async function toggleCourseFavorite(courseId, button) {
  await toggleFavorite('courses', courseId, button);
}

export async function togglePostFavorite(postId, button) {
  await toggleFavorite('posts', postId, button);
}

function renderCourseCards(courses) {
  if (!courses.length) return '<div class="card"><p class="text-secondary">暂未收藏课程</p></div>';
  return courses.map(course => `
    <div class="card mb-4 clickable" onclick="navigateToCourseResult(${course.id})">
      <h3 class="card-title">${escHtml(course.title)}</h3>
      <p class="text-secondary" style="margin-top:4px">${escHtml(course.teacher || '')} · ${course.enrollment_count || 0} 人选课</p>
    </div>
  `).join('');
}

function renderPostCards(posts) {
  if (!posts.length) return '<div class="card"><p class="text-secondary">暂未收藏帖子</p></div>';
  return posts.map(post => `
    <div class="card mb-4 clickable" onclick="navigateToCourseResult(${post.course_id}, ${post.id})">
      <h3 class="card-title">${escHtml(post.title)}</h3>
      <p class="text-secondary" style="margin-top:4px">${escHtml((post.content || '').replace(/<[^>]+>/g, '').slice(0, 100))}</p>
      <p class="text-secondary" style="margin-top:6px;font-size:12px">${escHtml(post.course_title)} · ${escHtml(post.author_name)} · ${formatTime(post.created_at)}</p>
    </div>
  `).join('');
}

registerPage('favorites', async (container) => {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }
  const [courses, posts] = await Promise.all([
    apiGet('/api/favorites?type=courses'),
    apiGet('/api/favorites?type=posts'),
  ]);
  container.innerHTML = `
    <div class="page-header"><h1 class="page-title">我的收藏</h1></div>
    <div class="md-tabs">
      <button class="md-tab-btn active" data-favorite-tab="courses">课程 ${courses.length}</button>
      <button class="md-tab-btn" data-favorite-tab="posts">帖子 ${posts.length}</button>
    </div>
    <div id="favorite-list">${renderCourseCards(courses)}</div>
  `;
  container.querySelectorAll('[data-favorite-tab]').forEach(button => {
    button.addEventListener('click', () => {
      container.querySelectorAll('[data-favorite-tab]').forEach(item => item.classList.toggle('active', item === button));
      document.getElementById('favorite-list').innerHTML = button.dataset.favoriteTab === 'courses'
        ? renderCourseCards(courses)
        : renderPostCards(posts);
    });
  });
  bindRipples(container);
  animStagger(Array.from(container.querySelectorAll('.card')), { y: 16, dur: 350, gap: 40 });
});
