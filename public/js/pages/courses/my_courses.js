/**
 * pages/courses/my_courses.js — 我的课程（选修课表列表）
 * registerPage: mycourse
 *
 * 职责：展示用户已选课程列表、选课模态框、导入课程表、退出课程
 * 详情页逻辑已迁移至 detail.js（统一 course-detail 页面）
 */

import { apiGet, apiPost, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
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
