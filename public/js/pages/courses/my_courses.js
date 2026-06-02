/**
 * pages/courses/my_courses.js — 我的课程（选修课表列表）
 * registerPage: mycourse
 *
 * 职责：展示用户已选课程列表、选课模态框、导入课程表、退出课程
 * 详情页逻辑已迁移至 detail.js（统一 course-detail 页面）
 */

import { apiGet, apiPost, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdTextarea, createMdSelect, escHtml, formatTime, formatFileSize, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';

/* =============================================
   学期工具函数
   ============================================= */

export function getCurrentSemesterKey() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  if ((m === 8 && d >= 15) || m >= 9 || (m === 1 && d === 1)) return `${y}-1`;
  if ((m === 2 && d >= 15) || (m >= 3 && m <= 5) || (m === 6 && d <= 14)) return `${y}-2`;
  if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 14)) return `${y}-summer`;
  return `${y}-closed`;
}

export function semesterLabel(key) {
  if (!key || key === 'all') return '全部学期';
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const year = parts[0];
  const tag = parts[1];
  if (tag === '1') return `${year} 第一学期`;
  if (tag === '2') return `${year} 第二学期`;
  if (tag === 'summer') return `${year} 暑期`;
  return key;
}

export function semesterFullLabel(key) {
  if (!key || key === 'all') return '';
  const parts = key.split('-');
  if (parts.length < 2) return key;
  const year = parts[0];
  const tag = parts[1];
  if (tag === '1') return `${year}学年 第1学期`;
  if (tag === '2') return `${year}学年 第2学期`;
  if (tag === 'summer') return `${year}学年 暑期`;
  return key;
}

let _myCurrentSemester = getCurrentSemesterKey();

/* =============================================
   Page: 我的课程列表
   ============================================= */

registerPage('mycourse', async (container) => {
  if (!isLoggedIn()) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="margin-bottom:0">我的课程</h1>
        <p class="text-secondary" style="margin-top:4px;font-size:var(--text-sm)">当前学期的班级课程</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="openCourseSearchModal()">
          <span class="mi">search</span> 选择已有课程
        </button>
        <button class="btn btn-primary" onclick="openImportModal()">
          <span class="mi">upload_file</span> 导入课程表
        </button>
      </div>
    </div>
    <div id="my-semester-filter-wrap" style="margin-bottom:var(--space-4);width:auto;min-width:180px;display:inline-block">
      ${createMdSelect({
        id: 'my-semester-filter',
        options: [{ text: semesterLabel(_myCurrentSemester), value: _myCurrentSemester }],
        selected: _myCurrentSemester,
      })}
    </div>
    <div id="my-course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  const semContainer = document.getElementById('my-semester-filter-container');
  if (semContainer) {
    semContainer.addEventListener('md-select-change', (e) => {
      _myCurrentSemester = e.detail.value;
      loadMyCourseList(_myCurrentSemester);
    });
  }

  try {
    const semesters = await apiGet('/api/courses/semesters');
    if (semesters.length > 0) {
      const allKeys = new Set([_myCurrentSemester, ...semesters]);
      const sorted = Array.from(allKeys).sort().reverse();
      const options = [
        { text: '全部学期', value: 'all' },
        ...sorted.map(k => ({ text: semesterLabel(k), value: k }))
      ];
      const wrap = document.getElementById('my-semester-filter-wrap');
      if (wrap) {
        wrap.innerHTML = createMdSelect({
          id: 'my-semester-filter',
          options,
          selected: _myCurrentSemester,
        });
        const newSemContainer = document.getElementById('my-semester-filter-container');
        if (newSemContainer) {
          newSemContainer.addEventListener('md-select-change', (e) => {
            _myCurrentSemester = e.detail.value;
            loadMyCourseList(_myCurrentSemester);
          });
        }
      }
    }
  } catch {}

  await loadMyCourseList(_myCurrentSemester);
});

async function loadMyCourseList(semester) {
  const listEl = document.getElementById('my-course-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const url = semester === 'all' ? '/api/courses' : `/api/courses?semester=${encodeURIComponent(semester)}`;
    const courses = await apiGet(url);

    if (courses.length === 0) {
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">menu_book</span>
          <p class="text-secondary" style="margin-top:12px">该学期暂无课程</p>
          <p class="text-secondary">点击"导入课程表"或"选择已有课程"添加</p>
        </div>
      `;
      animIn(listEl.querySelector('.card'), { y: 20, delay: 80 });
      return;
    }

    listEl.innerHTML = courses.map(c => `
      <div class="card mb-4 clickable" onclick="navigateTo('course-detail', ${c.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <h3 class="card-title">${escHtml(c.title)}</h3>
            <p class="text-secondary" style="margin-top:4px">${escHtml(c.teacher || '')}</p>
            <p class="text-secondary" style="margin-top:2px;font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.description || '暂无描述')}</p>
          </div>
          <div style="flex-shrink:0;margin-left:16px;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <span style="font-size:var(--text-sm);color:var(--md-primary);font-weight:600;white-space:nowrap">
              <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${c.enrollment_count || 0} 人
            </span>
            <button class="btn btn-secondary" style="padding:4px 12px;font-size:12px" onclick="event.stopPropagation();handleLeaveCourse(${c.id})">
              <span class="mi" style="font-size:14px">logout</span> 退出课程
            </button>
          </div>
        </div>
      </div>
    `).join('');

    const cards = listEl.querySelectorAll('.card');
    animStagger(Array.from(cards), { y: 22, dur: 420, gap: 60 });
  } catch {
    listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

/* =============================================
   选择已有课程（模态框）
   ============================================= */

export async function openCourseSearchModal() {
  const weekdaySelect = createMdSelect({
    id: 'search-course-day',
    options: [
      { text: '全部时间', value: '' },
      { text: '周一', value: '周一' },
      { text: '周二', value: '周二' },
      { text: '周三', value: '周三' },
      { text: '周四', value: '周四' },
      { text: '周五', value: '周五' },
      { text: '周六', value: '周六' },
      { text: '周日', value: '周日' },
    ],
    selected: '',
  });

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:16px">
      <div style="display:flex;gap:12px">
        <div style="flex:1">${createMdInput({ id: 'search-course-id', label: '课程号' })}</div>
        <div style="flex:1">${createMdInput({ id: 'search-course-name', label: '课程名称' })}</div>
      </div>
      <div style="display:flex;gap:12px">
        <div style="flex:1">${weekdaySelect}</div>
        <div style="flex:1">${createMdInput({ id: 'search-course-teacher', label: '教师' })}</div>
      </div>
      <button class="btn btn-primary" onclick="doCourseSearch()" style="align-self:flex-end">
        <span class="mi">search</span> 搜索
      </button>
    </div>
    <div id="search-results" style="max-height:320px;overflow-y:auto">
      <p class="text-secondary" style="text-align:center">输入条件后点击搜索</p>
    </div>
  `;

  openModal('选择已有课程', bodyHtml);
}

export async function doCourseSearch() {
  const courseId = document.getElementById('search-course-id').value.trim();
  const name = document.getElementById('search-course-name').value.trim();
  const day = document.getElementById('search-course-day').value;
  const teacher = document.getElementById('search-course-teacher').value.trim();

  const params = new URLSearchParams();
  if (courseId) params.set('courseId', courseId);
  if (name) params.set('name', name);
  if (day) params.set('day', day);
  if (teacher) params.set('teacher', teacher);

  const resultsEl = document.getElementById('search-results');
  resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">搜索中...</p>';

  try {
    const courses = await apiGet('/api/schedule/available?' + params.toString());
    if (courses.length === 0) {
      resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">未找到匹配课程</p>';
      return;
    }

    resultsEl.innerHTML = courses.map(c => `
      <div class="card mb-4" style="padding:12px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:var(--text-sm)">${escHtml(c.title)}</div>
            <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:2px">${escHtml(c.teacher || '')} · ${escHtml(c.description || '')}</div>
          </div>
          <div style="flex-shrink:0;margin-left:12px">
            ${c.is_enrolled
              ? '<span class="enrolled-badge" style="font-size:12px"><span class="mi" style="font-size:14px">check</span> 已加入</span>'
              : `<button class="btn btn-primary" style="padding:4px 12px;font-size:12px" onclick="handleEnrollFromSearch(${c.id})">加入</button>`
            }
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    resultsEl.innerHTML = '<p class="text-secondary" style="text-align:center">搜索失败</p>';
  }
}

export async function handleEnrollFromSearch(courseId) {
  const result = await apiPost(`/api/courses/${courseId}/enroll`, {});
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('加入成功');
    closeModal();
    navigateTo('mycourse');
  }
}

/* =============================================
   导入课程表（模态框）
   ============================================= */

export async function openImportModal() {
  if (!isLoggedIn()) {
    showToast('请先登录后再导入课程表');
    return;
  }

  const bodyHtml = `
    <div class="import-section">
      <div class="import-notes markdown-body" id="pre-notes-content">
        <p class="text-secondary">加载中...</p>
      </div>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:var(--space-4)">
      <button class="btn btn-secondary" onclick="closeModal()">不同意</button>
      <button class="btn btn-primary" onclick="handleAgreeAndImport()">我已同意并知晓</button>
    </div>
  `;

  openModal('使用须知', bodyHtml);

  try {
    const data = await apiGet('/api/schedule/pre-notes');
    const el = document.getElementById('pre-notes-content');
    if (data.content && data.content.trim()) {
      el.innerHTML = renderMarkdown(data.content);
    } else {
      el.innerHTML = '<p class="text-secondary">暂无须知内容。</p>';
    }
  } catch (err) {
    console.error('加载须知失败:', err);
    const el = document.getElementById('pre-notes-content');
    if (el) el.innerHTML = '<p class="text-secondary">加载失败。</p>';
  }
}

export function handleAgreeAndImport() {
  const bodyHtml = `
    <div class="import-section">
      <h3 class="import-section-title">导入说明</h3>
      <div class="import-notes markdown-body" id="import-notes">
        <p class="text-secondary">加载中...</p>
      </div>
    </div>
    <div class="import-section">
      <h3 class="import-section-title">选择文件</h3>
      <label class="btn btn-primary" style="cursor:pointer">
        <span class="mi">upload_file</span>
        <span>选择课程表文件</span>
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleScheduleImport(this.files[0])">
      </label>
    </div>
  `;

  openModal('导入课程表', bodyHtml);

  apiGet('/api/schedule/notes').then(data => {
    const el = document.getElementById('import-notes');
    if (data.content && data.content.trim()) {
      el.innerHTML = renderMarkdown(data.content);
    } else {
      el.innerHTML = '<p class="text-secondary">暂无说明。</p>';
    }
  }).catch(() => {
    const el = document.getElementById('import-notes');
    if (el) el.innerHTML = '<p class="text-secondary">加载说明失败。</p>';
  });
}

export async function handleScheduleImport(file) {
  if (!file) return;
  try {
    const { apiPostFile } = await import('../../core/api.js');
    const result = await apiPostFile('/api/schedule/import', file);
    if (result.error) {
      showToast('导入失败: ' + result.error);
      return;
    }
    closeModal();
    showToast(`成功导入 ${result.imported} 门课程`);
    setTimeout(() => navigateTo('mycourse'), 280);
  } catch {
    showToast('导入失败，请检查网络连接');
  }
}

/* =============================================
   退出课程
   ============================================= */

export async function handleLeaveCourse(courseId) {
  if (!confirm('确定要退出该课程吗？')) return;
  const result = await apiDelete(`/api/courses/${courseId}/leave`);
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('已退出课程');
    navigateTo('mycourse');
  }
}

/* =============================================
   Page: 我的课程详情（小班空间 · 三段式药丸）
   ============================================= */

window._myCourseSpace = {};

registerPage('mycourse-detail', async (container, courseId) => {
  loadedComments = {}; // 切换课程时清空评论缓存
  container.innerHTML = `<div class="card"><p class="text-secondary">加载中...</p></div>`;

  try {
    const course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `<div class="card"><p class="text-secondary">${course.error}</p></div>`;
      return;
    }

    window._myCourseSpace = { courseId, course, activeTab: null };
    const portalName = cleanPortalName(course.title);
    const favoriteCourseIds = await getFavoriteCourseIds();

    container.innerHTML = `
      <div class="page-header">
        <div style="flex:1;min-width:0">
          <h1 class="page-title" style="margin-bottom:4px">${escHtml(course.title)}</h1>
          <p class="text-secondary">
            ${course.teacher ? escHtml(course.teacher) + ' · ' : ''}
            ${course.enrollment_count || 0} 人选课
          </p>
      </div>
        ${renderCourseFavoriteButton(courseId, favoriteCourseIds.has(Number(courseId)))}
        <button class="btn btn-secondary btn-compact" onclick="handlePortalToPlaza('${escHtml(portalName)}')" title="穿梭到课程广场·大课主页">
          <span class="mi">open_in_new</span> 穿梭到广场
        </button>
        <button class="btn btn-primary btn-compact" onclick="navigateTo('publish', ${courseId})">
          <span class="mi">edit</span> 发布
        </button>
      </div>
      <div class="md-pills" id="my-course-pills">
        <button class="md-pill-btn active" data-tab="forum" onclick="switchMyCourseTab('forum', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
        </button>
        <button class="md-pill-btn" data-tab="materials" onclick="switchMyCourseTab('materials', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
        </button>
        <button class="md-pill-btn" data-tab="members" onclick="switchMyCourseTab('members', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 成员
        </button>
      </div>
      <div id="my-course-tab-content" style="min-height:200px"></div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
    animIn(container.querySelector('.md-pills'), { y: 12, delay: 80, dur: 350 });

    await switchMyCourseTab('forum', courseId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

/* ---- 药丸Tab切换 ---- */

export async function switchMyCourseTab(tab, courseId) {
  if (tab === window._myCourseSpace.activeTab) return;
  window._myCourseSpace.activeTab = tab;

  document.querySelectorAll('#my-course-pills .md-pill-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const contentEl = document.getElementById('my-course-tab-content');
  if (!contentEl) return;

  switch (tab) {
    case 'forum':
      await renderMyForumTab(contentEl, courseId);
      break;
    case 'materials':
      await renderMyMaterialsTab(contentEl, courseId);
      break;
    case 'members':
      await renderMyMembersTab(contentEl, courseId);
      break;
  }
}

/* ---- 论坛标签页 ---- */

async function renderMyForumTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await apiGet(`/api/courses/${courseId}/posts`);
  const favoritePostIds = await getFavoritePostIds();

  contentEl.innerHTML = `
    <div style="display:flex;gap:24px">
      <div style="flex:1;min-width:0" id="my-posts-area">
        ${posts.length === 0 ? `
          <div class="card" style="text-align:center;padding:48px">
            <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">forum</span>
            <p class="text-secondary" style="margin-top:12px">暂无帖子，来发第一个吧</p>
          </div>
        ` : posts.map(p => `
          <div class="card mb-4 post-card clickable" id="post-${p.id}">
            <h3 class="card-title" style="cursor:pointer" onclick="toggleComments(${p.id})">${escHtml(p.title)}</h3>
            <p style="margin-top:8px;white-space:pre-wrap">${escHtml(p.content)}</p>
            ${renderPostAttachments(p.attachments)}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:var(--text-sm);color:var(--md-on-surface-variant)">
              <span><button class="user-profile-link" onclick="event.stopPropagation();navigateTo('profile-user', ${p.author_id})">${escHtml(p.author_name)}</button> · ${formatTime(p.created_at)}</span>
              ${renderPostFavoriteButton(p.id, favoritePostIds.has(p.id))}
              <span style="cursor:pointer;color:var(--md-primary);font-weight:500" onclick="toggleComments(${p.id})">
                <span class="mi" style="font-size:16px;vertical-align:-3px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
              </span>
            </div>
            <div class="comments-section" id="comments-${p.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--md-outline-variant)"></div>
          </div>
        `).join('')}
      </div>
      ${await renderMyMemberSidebar(courseId)}
    </div>
  `;

  const cards = contentEl.querySelectorAll('.post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 20, dur: 400, gap: 50 });
  if (window._myCourseTargetPostId) {
    document.getElementById(`post-${window._myCourseTargetPostId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window._myCourseTargetPostId = null;
  }
}

/* ---- 成员侧栏 ---- */

async function renderMyMemberSidebar(courseId) {
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  return `
    <div style="width:220px;flex-shrink:0">
      <div class="card" id="my-members-sidebar">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px;color:var(--md-on-surface-variant)">
          <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 成员 (<span id="my-member-count">${members.length}</span>)
        </h3>
        <div id="my-member-filters" style="margin-bottom:12px">
          ${createMdSelect({
            id: 'my-filter-major',
            options: [{ text: '全部专业', value: '' }, ...(stats?.majors || []).map(m => ({ text: m, value: m }))],
            onchange: `filterMyMembers(${courseId})`
          })}
          ${createMdSelect({
            id: 'my-filter-grade',
            options: [{ text: '全部年级', value: '' }, ...(stats?.grades || []).map(g => ({ text: g, value: g }))],
            onchange: `filterMyMembers(${courseId})`
          })}
        </div>
        <div id="my-members-list">
          ${renderMyMembersList(members)}
        </div>
      </div>
    </div>
  `;
}

function renderMyMembersList(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-item member-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">qq</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

export async function filterMyMembers(courseId) {
  const major = document.getElementById('my-filter-major')?.value || '';
  const grade = document.getElementById('my-filter-grade')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const listEl = document.getElementById('my-members-list');
  if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (listEl) listEl.innerHTML = renderMyMembersList(members);
    const countEl = document.getElementById('my-member-count');
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载失败</p>';
  }
}

/* ---- 资料标签页 ---- */

async function renderMyMaterialsTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  await loadMyMaterials(contentEl, courseId);
}

async function loadMyMaterials(contentEl, courseId, opts = {}) {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts.chapter) params.set('chapter', opts.chapter);
  if (opts.sort) params.set('sort', opts.sort);

  const data = await apiGet(`/api/materials/courses/${courseId}?${params.toString()}`);
  const materials = data?.materials || [];
  const categories = ['全部', '课件', '笔记', '作业', '真题', '其他'];

  contentEl.innerHTML = `
    <div style="display:flex;gap:24px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${createMdSelect({
              id: 'my-mat-category',
              options: categories.map(c => ({ text: c, value: c === '全部' ? 'all' : c })),
              style: 'width:auto;min-width:100px;margin-bottom:0',
              onchange: `refreshMyMaterials(${courseId})`
            })}
            ${createMdInput({
              id: 'my-mat-chapter',
              label: '按章节搜索',
              style: 'width:auto;min-width:120px;margin-bottom:0',
              onchange: `refreshMyMaterials(${courseId})`,
              placeholder: ' '
            })}
            ${createMdSelect({
              id: 'my-mat-sort',
              options: [
                { text: '最新上传', value: 'newest' },
                { text: '评分最高', value: 'rating' },
                { text: '下载最多', value: 'downloads' }
              ],
              style: 'width:auto;min-width:100px;margin-bottom:0',
              onchange: `refreshMyMaterials(${courseId})`
            })}
          </div>
          <button class="btn btn-primary" onclick="openUploadMaterialModal(${courseId})">
            <span class="mi">upload</span> 上传资料
          </button>
        </div>
        <div id="my-materials-list">
          ${renderMyMaterialsList(materials, courseId)}
        </div>
      </div>
      ${await renderMyMemberSidebar(courseId)}
    </div>
  `;

  const cards = contentEl.querySelectorAll('.material-card');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}

function renderMyMaterialsList(materials, courseId) {
  if (materials.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">folder_open</span>
        <p class="text-secondary" style="margin-top:12px">暂无资料，来上传第一份吧</p>
      </div>
    `;
  }

  const typeIcons = { pdf: 'picture_as_pdf', ppt: 'slideshow', doc: 'description', image: 'image', other: 'insert_drive_file' };
  const typeColors = { pdf: '#e53935', ppt: '#FB8C00', doc: '#1E88E5', image: '#43A047', other: '#757575' };

  return materials.map(m => `
    <div class="card material-card">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="material-icon" style="color:${typeColors[m.file_type] || typeColors.other}">
          <span class="mi" style="font-size:28px">${typeIcons[m.file_type] || typeIcons.other}</span>
          <span style="font-size:10px;text-transform:uppercase">${m.file_type}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:var(--text-base)">${escHtml(m.title)}</div>
          ${m.description ? `<div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">${escHtml(m.description)}</div>` : ''}
          <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
            ${m.chapter ? `<span><span class="mi" style="font-size:14px;vertical-align:-2px">bookmark</span> ${escHtml(m.chapter)}</span>` : ''}
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">category</span> ${escHtml(m.category)}</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.uploader_id})">${escHtml(m.uploader_name)}</button></span>
            <span>${formatFileSize(m.file_size)}</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">download</span> ${m.download_count}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            ${renderMyStars(m.avg_rating, m.id)}
            <span style="font-size:12px;color:var(--md-on-surface-variant)">${m.rating_count > 0 ? m.avg_rating.toFixed(1) + ' 分' : '暂无评分'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
          <a href="/api/materials/${m.id}/download" class="btn btn-primary" style="font-size:12px;padding:6px 12px">
            <span class="mi" style="font-size:16px">download</span> 下载
          </a>
          ${m.uploader_id === window._currentUser?.id ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 12px" onclick="deleteMyMaterial(${m.id}, ${courseId})"><span class="mi" style="font-size:16px">delete</span> 删除</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderMyStars(avgRating, materialId) {
  let html = '<div class="stars-row">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(avgRating) ? 'star' : 'star_border';
    html += `<span class="mi star-icon" style="font-size:18px;cursor:pointer;color:${i <= Math.round(avgRating) ? '#FB8C00' : 'var(--md-outline-variant)'}" onclick="rateMyMaterial(${materialId}, ${i})">${filled}</span>`;
  }
  html += '</div>';
  return html;
}

export async function rateMyMaterial(materialId, rating) {
  if (!window._currentUser) {
    showToast('请先登录后再评分');
    return;
  }
  const result = await apiPost(`/api/materials/${materialId}/rate`, { rating });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(`评分成功 (${result.avg_rating} 分)`);
  const courseId = window._myCourseSpace.courseId;
  const contentEl = document.getElementById('my-course-tab-content');
  if (contentEl && courseId) await loadMyMaterials(contentEl, courseId);
}

export async function refreshMyMaterials(courseId) {
  const category = document.getElementById('my-mat-category')?.value || 'all';
  const chapter = document.getElementById('my-mat-chapter')?.value || '';
  const sort = document.getElementById('my-mat-sort')?.value || 'newest';
  const contentEl = document.getElementById('my-course-tab-content');
  if (contentEl) await loadMyMaterials(contentEl, courseId, { category, chapter, sort });
}

export async function deleteMyMaterial(materialId, courseId) {
  if (!confirm('确定删除这份资料？')) return;
  const result = await apiDelete(`/api/materials/${materialId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('删除成功');
  const contentEl = document.getElementById('my-course-tab-content');
  if (contentEl) await loadMyMaterials(contentEl, courseId);
}

export function openUploadMaterialModal(courseId) {
  const categories = ['课件', '笔记', '作业', '真题', '其他'];
  const html = `
    <form id="upload-material-form" onsubmit="handleUploadMaterial(event, ${courseId})" style="display:flex;flex-direction:column;gap:16px">
      <div id="upload-drop-zone" class="upload-drop-zone">
        <span class="mi" style="font-size:36px;color:var(--md-outline-variant)">cloud_upload</span>
        <p style="margin-top:8px;color:var(--md-on-surface-variant);font-size:14px">点击选择文件或拖拽到此处</p>
        <p style="font-size:12px;color:var(--md-outline)">支持 PDF、PPT、Word、图片，最大 20MB</p>
        <input type="file" id="upload-file-input" style="display:none" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" onchange="onFileSelected(this)">
        <p id="upload-file-name" style="display:none;font-size:14px;font-weight:500;color:var(--md-primary);margin-top:8px"></p>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="title" placeholder=" " required>
        <label class="md-label">资料标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>资料标题</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="description" placeholder=" ">
        <label class="md-label">描述（可选）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>描述（可选）</span></legend></fieldset>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" name="chapter" placeholder=" ">
          <label class="md-label">章节（如：第3章）</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>章节</span></legend></fieldset>
        </div>
        <div style="flex:1">
          ${createMdSelect({
            id: 'upload-category',
            label: '分类',
            options: categories.map(c => ({ text: c, value: c })),
            selected: '其他'
          })}
        </div>
      </div>
      <div class="form-error" id="upload-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">上传</button>
    </form>
  `;
  openModal('上传资料', html);

  setTimeout(() => {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('upload-file-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          onFileSelected(fileInput);
        }
      });
    }
  }, 100);
}

export function onFileSelected(input) {
  const nameEl = document.getElementById('upload-file-name');
  if (input.files.length && nameEl) {
    nameEl.textContent = '📎 ' + input.files[0].name;
    nameEl.style.display = 'block';
  }
}

export async function handleUploadMaterial(e, courseId) {
  e.preventDefault();
  const form = e.target;
  const fileInput = document.getElementById('upload-file-input');
  const errEl = document.getElementById('upload-error');

  if (!fileInput.files.length) {
    if (errEl) { errEl.textContent = '请选择文件'; errEl.style.display = 'block'; }
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', form.title.value.trim());
  formData.append('description', form.description.value.trim());
  formData.append('chapter', form.chapter.value.trim());
  formData.append('category', document.getElementById('upload-category')?.value || '其他');

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '上传中...';

  try {
    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/materials/courses/${courseId}`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.textContent = '上传';
      return;
    }

    closeModal();
    showToast('上传成功');
    const contentEl = document.getElementById('my-course-tab-content');
    if (contentEl) await loadMyMaterials(contentEl, courseId);
  } catch (err) {
    if (errEl) { errEl.textContent = '上传失败'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '上传';
  }
}

/* ---- 成员标签页（全宽）---- */

async function renderMyMembersTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  contentEl.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <span style="font-weight:600;color:var(--md-on-surface-variant)"><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 课程成员 (<span id="my-member-count-full">${members.length}</span>)</span>
        <div style="flex:1"></div>
        ${createMdSelect({
          id: 'my-filter-major-full',
          options: [{ text: '全部专业', value: '' }, ...(stats?.majors || []).map(m => ({ text: m, value: m }))],
          style: 'width:auto;min-width:120px;margin-bottom:0',
          onchange: `filterMyMembersTab(${courseId})`
        })}
        ${createMdSelect({
          id: 'my-filter-grade-full',
          options: [{ text: '全部年级', value: '' }, ...(stats?.grades || []).map(g => ({ text: g, value: g }))],
          style: 'width:auto;min-width:120px;margin-bottom:0',
          onchange: `filterMyMembersTab(${courseId})`
        })}
      </div>
      <div id="my-members-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${renderMyMemberCards(members)}
      </div>
    </div>
  `;

  const cards = contentEl.querySelectorAll('.member-card-grid');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}

function renderMyMemberCards(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-card-grid member-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">qq</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

export async function filterMyMembersTab(courseId) {
  const major = document.getElementById('my-filter-major-full')?.value || '';
  const grade = document.getElementById('my-filter-grade-full')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const gridEl = document.getElementById('my-members-grid');
  const countEl = document.getElementById('my-member-count-full');
  if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (gridEl) gridEl.innerHTML = renderMyMemberCards(members);
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载失败</p>';
  }
}

/* =============================================
   穿梭门：清洗班级名 → 导航到广场
   ============================================= */

function cleanPortalName(title) {
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

export async function handlePortalToPlaza(cleanName) {
  // 先搜索课程ID，确保URL正确
  try {
    const allCourses = await apiGet('/api/courses');
    const q = cleanName.toLowerCase();
    const found = allCourses.find(c => {
      const big = cleanPortalName(c.title).toLowerCase();
      return big.includes(q) || (c.title || '').toLowerCase().includes(q);
    });
    if (found) {
      navigateTo('plaza-course', found.id);
    } else {
      showToast('未在课程广场找到对应的课程');
    }
  } catch {
    showToast('搜索课程失败');
  }
}

/* =============================================
   Post & Comment Helpers（增强版）
   ============================================= */

let loadedComments = {};       // 缓存：postId → { comments, total, page, hasMore }
let commentImageMap = {};      // 待上传图片：postId → File
let replyingTo = {};           // 楼中楼回复目标：postId → { id, author_name }

// 格式化相对时间
function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 切换评论区显示/隐藏
export async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (!loadedComments[postId]) {
    section.innerHTML = renderCommentSkeleton();
    try {
      const data = await apiGet(`/api/courses/posts/${postId}/comments?page=1&pageSize=20`);
      loadedComments[postId] = {
        comments: data.comments || [],
        total: data.total || 0,
        page: 1,
        hasMore: (data.comments || []).length < (data.total || 0)
      };
      renderComments(section, postId);
    } catch {
      section.innerHTML = '<div class="comment-error">加载失败，点击重试</div>';
      section.querySelector('.comment-error')?.addEventListener('click', () => {
        loadedComments[postId] = null;
        toggleComments(postId);
      });
    }
  } else {
    renderComments(section, postId);
  }
}

// 骨架屏
function renderCommentSkeleton() {
  return Array(3).fill('').map(() => `
    <div class="comment-skeleton">
      <div class="comment-skeleton-avatar"></div>
      <div class="comment-skeleton-lines">
        <div class="comment-skeleton-line short"></div>
        <div class="comment-skeleton-line"></div>
      </div>
    </div>
  `).join('');
}

// 渲染评论区主函数
function renderComments(section, postId) {
  const data = loadedComments[postId] || { comments: [], total: 0, page: 1, hasMore: false };
  const { comments, total, hasMore } = data;

  // 分离主回复和楼中楼
  const rootComments = comments.filter(c => !c.parent_id);
  const childMap = {};
  comments.forEach(c => {
    if (c.parent_id) {
      if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
      childMap[c.parent_id].push(c);
    }
  });

  section.innerHTML = `
    <div class="comment-list" id="comment-list-${postId}">
      ${rootComments.length === 0 && !hasMore
        ? '<p class="text-secondary" style="text-align:center;padding:16px;font-size:var(--text-sm)">暂无回复</p>'
        : rootComments.map((c, idx) => renderSingleComment(c, idx + 1, postId, childMap, 0)).join('')
      }
      ${hasMore ? `<div class="comment-load-more" id="comment-load-more-${postId}">加载更多回复</div>` : ''}
    </div>
    ${isLoggedIn() ? renderCommentInput(postId) : renderLoginPromptHtml()}
  `;

  // 绑定事件
  bindCommentEvents(section, postId);
}

// 渲染单条评论（递归支持楼中楼）
function renderSingleComment(comment, floorNum, postId, childMap, depth) {
  const isDeleted = comment.content === '[已删除]';
  const isOwner = window._currentUser && comment.author_id === window._currentUser.id;
  const children = childMap[comment.id] || [];
  const maxDepth = 3;

  return `
    <div class="comment-item ${depth > 0 ? 'comment-nested' : ''}" data-comment-id="${comment.id}" data-depth="${depth}">
      <div class="comment-header">
        ${depth === 0 ? `<span class="comment-floor">${floorNum} 楼</span>` : ''}
        ${comment.author_avatar_url
          ? `<img class="comment-avatar" src="${escHtml(comment.author_avatar_url)}" alt="">`
          : `<div class="comment-avatar-letter">${isDeleted ? '?' : escHtml((comment.author_name || '?')[0])}</div>`
        }
        <div class="comment-meta">
          <button class="user-profile-link" ${isDeleted ? 'disabled' : `onclick="navigateTo('profile-user', ${comment.author_id})"`}>
            ${isDeleted ? '已注销用户' : escHtml(comment.author_name)}
          </button>
          <span class="comment-time">${formatRelativeTime(comment.created_at)}</span>
        </div>
      </div>
      ${comment.parent_id && depth > 0 ? (() => {
        const parent = (loadedComments[postId]?.comments || []).find(c => c.id === comment.parent_id);
        return parent ? `<div class="comment-reply-ref">回复 @${escHtml(parent.author_name || '已注销用户')}</div>` : '';
      })() : ''}
      <div class="comment-body">
        ${isDeleted
          ? '<p class="comment-deleted">该回复已被删除</p>'
          : `<p class="comment-content">${escHtml(comment.content)}</p>`
        }
        ${comment.image_url ? `<div class="comment-image-wrap"><img src="${escHtml(comment.image_url)}" alt="评论图片" class="comment-image" loading="lazy" onclick="window.open('${escHtml(comment.image_url)}', '_blank')"></div>` : ''}
      </div>
      ${!isDeleted ? `
        <div class="comment-actions">
          ${isLoggedIn() ? `<button class="comment-action-btn comment-reply-btn" data-comment-id="${comment.id}" data-author="${escHtml(comment.author_name)}"><span class="mi" style="font-size:14px">reply</span> 回复</button>` : ''}
          ${isOwner ? `<button class="comment-action-btn comment-delete-btn" data-comment-id="${comment.id}" data-post-id="${postId}"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
      ` : ''}
      ${children.length > 0 && depth < maxDepth
        ? children.map(c => renderSingleComment(c, 0, postId, childMap, depth + 1)).join('')
        : ''
      }
      ${children.length > 0 && depth >= maxDepth
        ? `<button class="comment-load-more-replies" data-parent-id="${comment.id}" data-post-id="${postId}">查看更多回复 (${children.length})</button>`
        : ''
      }
    </div>
  `;
}

// 渲染输入区域
function renderCommentInput(postId) {
  const replyRef = replyingTo[postId];
  return `
    <div class="comment-input-area" id="comment-input-area-${postId}">
      ${replyRef ? `<div class="comment-reply-ref-bar">回复 @${escHtml(replyRef.author_name)}<button class="comment-cancel-reply" data-post-id="${postId}"><span class="mi" style="font-size:16px">close</span></button></div>` : ''}
      <div class="comment-input-row">
        <div class="comment-textarea-wrap">
          <textarea class="comment-textarea" id="comment-textarea-${postId}" placeholder="写回复..." rows="2" maxlength="500"></textarea>
          <span class="comment-char-count" id="comment-char-count-${postId}">0/500</span>
        </div>
        <div class="comment-input-actions">
          <label class="comment-action-btn comment-upload-btn" title="上传图片">
            <span class="mi" style="font-size:20px">add_photo_alternate</span>
            <input type="file" accept=".jpg,.jpeg,.png" style="display:none" id="comment-image-input-${postId}">
          </label>
          <button class="btn btn-primary comment-send-btn" id="comment-send-btn-${postId}" data-post-id="${postId}" disabled>
            <span class="mi" style="font-size:18px">send</span>
          </button>
        </div>
      </div>
      <div class="comment-image-preview" id="comment-image-preview-${postId}" style="display:none">
        <img id="comment-preview-img-${postId}" src="" alt="">
        <button class="comment-remove-image" data-post-id="${postId}"><span class="mi" style="font-size:16px">close</span></button>
      </div>
      <div class="comment-tip">请遵守社区规范，禁止发布违规内容</div>
    </div>
  `;
}

function renderLoginPromptHtml() {
  return '<p class="text-secondary" style="margin-top:12px;font-size:var(--text-sm)"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>';
}

// 绑定评论区所有事件
function bindCommentEvents(section, postId) {
  // 回复按钮
  section.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      replyingTo[postId] = { id: Number(btn.dataset.commentId), author_name: btn.dataset.author };
      renderComments(section, postId);
      const textarea = document.getElementById(`comment-textarea-${postId}`);
      if (textarea) { textarea.focus(); textarea.value = `@${btn.dataset.author} `; updateCharCount(postId); }
    });
  });

  // 取消回复
  section.querySelectorAll('.comment-cancel-reply').forEach(btn => {
    btn.addEventListener('click', () => {
      delete replyingTo[postId];
      renderComments(section, postId);
    });
  });

  // 删除按钮
  section.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('确认删除', `
        <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="confirm-delete-comment" data-comment-id="${btn.dataset.commentId}" data-post-id="${btn.dataset.postId}" style="background:var(--md-error,#e53935)">删除</button>
        </div>
      `);
      document.getElementById('confirm-delete-comment')?.addEventListener('click', async () => {
        const result = await apiDelete(`/api/courses/posts/${btn.dataset.postId}/comments/${btn.dataset.commentId}`);
        if (result.error) { showToast(result.error); return; }
        closeModal();
        loadedComments[postId] = null;
        toggleComments(postId);
        showToast('已删除');
      });
    });
  });

  // 加载更多
  const loadMoreBtn = document.getElementById(`comment-load-more-${postId}`);
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.textContent = '加载中...';
      loadMoreBtn.disabled = true;
      const data = loadedComments[postId];
      const nextPage = data.page + 1;
      try {
        const result = await apiGet(`/api/courses/posts/${postId}/comments?page=${nextPage}&pageSize=20`);
        data.comments.push(...(result.comments || []));
        data.page = nextPage;
        data.hasMore = data.comments.length < data.total;
        renderComments(section, postId);
      } catch {
        loadMoreBtn.textContent = '加载失败，点击重试';
        loadMoreBtn.disabled = false;
      }
    });
  }

  // 查看更多回复（展开嵌套）
  section.querySelectorAll('.comment-load-more-replies').forEach(btn => {
    btn.addEventListener('click', async () => {
      const parentId = Number(btn.dataset.parentId);
      btn.textContent = '加载中...';
      try {
        const replies = await apiGet(`/api/courses/posts/${postId}/comments/${parentId}/replies`);
        const data = loadedComments[postId];
        replies.forEach(r => {
          if (!data.comments.find(c => c.id === r.id)) data.comments.push(r);
        });
        renderComments(section, postId);
      } catch {
        btn.textContent = '加载失败';
      }
    });
  });

  // 文本输入
  const textarea = document.getElementById(`comment-textarea-${postId}`);
  if (textarea) {
    textarea.addEventListener('input', () => updateCharCount(postId));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitComment(postId, section);
      }
    });
    textarea.focus();
  }

  // 发送按钮
  const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
  if (sendBtn) {
    sendBtn.addEventListener('click', () => submitComment(postId, section));
  }

  // 图片上传
  const imgInput = document.getElementById(`comment-image-input-${postId}`);
  if (imgInput) {
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) { showToast('图片不能超过 1MB'); imgInput.value = ''; return; }
      commentImageMap[postId] = file;
      const preview = document.getElementById(`comment-image-preview-${postId}`);
      const previewImg = document.getElementById(`comment-preview-img-${postId}`);
      if (preview && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        preview.style.display = 'block';
      }
      updateSendBtn(postId);
    });
  }

  // 移除图片
  section.querySelectorAll('.comment-remove-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = Number(btn.dataset.postId);
      delete commentImageMap[pid];
      const preview = document.getElementById(`comment-image-preview-${pid}`);
      if (preview) preview.style.display = 'none';
      const imgInput = document.getElementById(`comment-image-input-${pid}`);
      if (imgInput) imgInput.value = '';
      updateSendBtn(pid);
    });
  });
}

// 更新字数计数
function updateCharCount(postId) {
  const textarea = document.getElementById(`comment-textarea-${postId}`);
  const counter = document.getElementById(`comment-char-count-${postId}`);
  if (!textarea || !counter) return;
  const len = textarea.value.length;
  counter.textContent = `${len}/500`;
  counter.classList.toggle('exceeded', len >= 500);
  updateSendBtn(postId);
}

// 更新发送按钮状态
function updateSendBtn(postId) {
  const textarea = document.getElementById(`comment-textarea-${postId}`);
  const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;
  const hasContent = textarea.value.trim().length > 0;
  const hasImage = !!commentImageMap[postId];
  const notExceeded = textarea.value.length <= 500;
  sendBtn.disabled = !(hasContent || hasImage) || !notExceeded;
}

// 提交评论
async function submitComment(postId, section) {
  const textarea = document.getElementById(`comment-textarea-${postId}`);
  const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;

  const content = textarea.value.trim();
  const imageFile = commentImageMap[postId];
  if (!content && !imageFile) return;
  if (content.length > 500) { showToast('回复内容不能超过 500 字'); return; }

  // 禁用状态
  textarea.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="mi" style="font-size:18px">hourglass_empty</span>';

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (replyingTo[postId]) formData.append('parent_id', replyingTo[postId].id);
    if (imageFile) formData.append('image', imageFile);

    const token = localStorage.getItem('kedazi_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      textarea.disabled = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="mi" style="font-size:18px">send</span>';
      return;
    }

    // 成功：清空状态
    textarea.value = '';
    delete commentImageMap[postId];
    delete replyingTo[postId];
    const preview = document.getElementById(`comment-image-preview-${postId}`);
    if (preview) preview.style.display = 'none';
    const imgInput = document.getElementById(`comment-image-input-${postId}`);
    if (imgInput) imgInput.value = '';

    loadedComments[postId] = null;
    toggleComments(postId);
    // 滚动到最新回复
    setTimeout(() => {
      const list = document.getElementById(`comment-list-${postId}`);
      if (list) list.scrollTop = list.scrollHeight;
    }, 300);
    showToast('回复成功');
  } catch {
    showToast('发送失败，请重试');
    textarea.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span class="mi" style="font-size:18px">send</span>';
}
