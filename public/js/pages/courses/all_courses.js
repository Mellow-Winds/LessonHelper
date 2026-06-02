/**
 * pages/courses/all_courses.js — 课程广场（全校大库目录 · 全局检索）
 * registerPage: allcourse
 *
 * 职责：展示全校大课卡片流、搜索过滤、导航到统一详情页
 * 大课 = 清洗后同名课程的集合（如"离散数学"聚合"离散数学01班""02班"...）
 */

import { apiGet } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { escHtml } from '../../components/ui.js';

/* =============================================
   大课名称清洗
   物理剥离末尾班级号数字与"班"字
   强行保留括号内教学层次限定词
   ============================================= */

export function cleanBigCourseName(title) {
  if (!title) return '';
  const parens = title.match(/[（(].+?[)）]/g) || [];
  let temp = title;
  parens.forEach((p, i) => { temp = temp.replace(p, `__PH${i}__`); });
  // 清除末尾班级号：支持 "07班"、"25班"、孤立数字 "25"、带空格 " 25"
  temp = temp.replace(/\d{1,3}\s*班\s*$/, '');
  temp = temp.replace(/[\s ]*\d{1,3}\s*$/, '');
  temp = temp.replace(/\d{1,3}$/, '');
  parens.forEach((p, i) => { temp = temp.replace(`__PH${i}__`, p); });
  return temp.trim();
}

/* =============================================
   全校课程聚合缓存
   ============================================= */

let _allCoursesRaw = [];
let _bigCoursesMap = {};  // { bigName: [course, course, ...] }
let _bigCoursesList = []; // [{ name, courseIds, totalCount, courseCount }, ...]
let _plazaLoaded = false;

async function loadPlazaDataOnce() {
  if (_plazaLoaded) return;
  try {
    _allCoursesRaw = await apiGet('/api/courses/all');
  } catch {
    _allCoursesRaw = [];
  }

  // 按大课名聚合
  _bigCoursesMap = {};
  for (const c of _allCoursesRaw) {
    const big = cleanBigCourseName(c.title);
    if (!big) continue;
    if (!_bigCoursesMap[big]) _bigCoursesMap[big] = [];
    _bigCoursesMap[big].push(c);
  }

  _bigCoursesList = Object.entries(_bigCoursesMap).map(([name, courses]) => {
    const totalEnrollment = courses.reduce((sum, c) => sum + (c.enrollment_count || 0), 0);
    return {
      name,
      courseIds: courses.map(c => c.id),
      totalCount: totalEnrollment,
      courseCount: courses.length,
    };
  }).sort((a, b) => b.totalCount - a.totalCount);

  _plazaLoaded = true;
}

/**
 * navigateToPlazaCourseById — 根据 courseId 找到对应大课并导航
 * 供全局搜索和收藏页跳转使用
 */
export async function navigateToPlazaCourseById(courseId, postId) {
  await loadPlazaDataOnce();
  const bigCourse = _bigCoursesList.find(item => item.courseIds.includes(Number(courseId)));
  if (!bigCourse) return false;
  window._courseDetailTargetPostId = postId || null;
  // 导航到统一详情页，使用该大课的第一个 courseId
  navigateTo('course-detail', bigCourse.courseIds[0]);
  return true;
}

/* =============================================
   Page: 课程广场列表
   ============================================= */

registerPage('allcourse', async (container) => {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom:0">课程广场</h1>
        <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">全校课程档案馆 · 跨届检索</p>
      </div>
    </div>
    <div class="plaza-search-bar">
      <span class="mi plaza-search-icon">search</span>
      <input class="plaza-search-input" id="plaza-search" type="text" placeholder="搜索课程名称..." oninput="filterPlazaCourses(this.value)">
    </div>
    <div id="plaza-course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  animIn(container.querySelector('.plaza-search-bar'), { y: 12, delay: 60, dur: 350 });

  await loadPlazaDataOnce();
  renderPlazaList(_bigCoursesList);
});

function renderPlazaList(list) {
  const listEl = document.getElementById('plaza-course-list');
  if (!listEl) return;

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">search_off</span>
        <p class="text-secondary" style="margin-top:12px">未找到匹配课程</p>
      </div>
    `;
    animIn(listEl.querySelector('.card'), { y: 20, delay: 80 });
    return;
  }

  listEl.innerHTML = list.map(item => `
    <div class="card mb-4 clickable plaza-course-card" onclick="navigateTo('course-detail', ${item.courseIds[0]})">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1;min-width:0">
          <h3 class="card-title">${escHtml(item.name)}</h3>
          <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">${item.courseCount} 个班级</p>
        </div>
        <div style="flex-shrink:0;margin-left:16px">
          <span style="font-size:var(--text-sm);color:var(--md-primary);font-weight:600;white-space:nowrap">
            <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${item.totalCount} 人
          </span>
        </div>
      </div>
    </div>
  `).join('');

  const cards = listEl.querySelectorAll('.plaza-course-card');
  if (cards.length) animStagger(Array.from(cards), { y: 22, dur: 420, gap: 60 });
}

export function filterPlazaCourses(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderPlazaList(_bigCoursesList);
    return;
  }
  const filtered = _bigCoursesList.filter(item =>
    item.name.toLowerCase().includes(q)
  );
  renderPlazaList(filtered);
}
