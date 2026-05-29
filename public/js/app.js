/**
 * EduSpace - Client Application
 * Handles navigation and page rendering
 */

// ---- Page Registry ----
const pages = {};

function registerPage(name, renderFn) {
  pages[name] = renderFn;
}

// ---- Navigation ----
function navigateTo(pageName) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  if (pages[pageName]) {
    mainContent.innerHTML = '';
    pages[pageName](mainContent);
  }
}

// ---- API Helpers ----
async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function apiPostFile(url, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  return res.json();
}

// ---- Global State ----
window._importedSchedule = null;

// ---- Modal ----
function openModal(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

// ---- Import Modal ----
async function openImportModal() {
  let notesHtml = '<p class="text-secondary">加载中...</p>';

  const bodyHtml = `
    <div class="import-section">
      <h3 class="import-section-title">显示</h3>
      <div class="import-notes markdown-body" id="import-notes">${notesHtml}</div>
    </div>
    <div class="import-section">
      <h3 class="import-section-title">导入</h3>
      <label class="btn btn-primary" style="cursor:pointer">
        <i data-lucide="upload"></i>
        <span>选择课程表文件</span>
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleScheduleImport(this.files[0])">
      </label>
    </div>
  `;

  openModal('导入课程表', bodyHtml);
  if (window.lucide) lucide.createIcons();

  // Load notes.md
  try {
    const data = await apiGet('/api/schedule/notes');
    const notesEl = document.getElementById('import-notes');
    if (data.content && data.content.trim()) {
      notesEl.innerHTML = marked.parse(data.content);
    } else {
      notesEl.innerHTML = '<p class="text-secondary">暂无说明。</p>';
    }
  } catch {
    document.getElementById('import-notes').innerHTML = '<p class="text-secondary">加载说明失败。</p>';
  }
}

async function handleScheduleImport(file) {
  if (!file) return;

  try {
    const result = await apiPostFile('/api/schedule/import', file);
    if (result.error) {
      alert('导入失败: ' + result.error);
      return;
    }
    window._importedSchedule = result.courses;
    closeModal();
    navigateTo('courses');
  } catch {
    alert('导入失败，请检查网络连接。');
  }
}

// ---- Page: Course List ----
registerPage('courses', async (container) => {
  const schedule = window._importedSchedule;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-6)">
      <h1 class="page-title" style="margin-bottom:0">课程列表</h1>
      <button class="btn btn-primary" onclick="openImportModal()">
        <i data-lucide="upload"></i>
        <span>导入课程表</span>
      </button>
    </div>
    ${schedule ? renderScheduleTable(schedule) : `
      <div id="course-list" class="card">
        <p class="text-secondary">加载中...</p>
      </div>
    `}
  `;

  if (window.lucide) lucide.createIcons();

  if (schedule) return;

  try {
    const courses = await apiGet('/api/courses');
    const listEl = document.getElementById('course-list');

    if (courses.length === 0) {
      listEl.innerHTML = `
        <p class="text-secondary">暂无课程，点击右上角创建第一门课程。</p>
      `;
      return;
    }

    listEl.innerHTML = courses.map(c => `
      <div class="card mb-4" style="cursor:pointer" onclick="navigateTo('course-${c.id}')">
        <h3 class="card-title">${c.title}</h3>
        <p class="text-secondary">${c.description || '暂无描述'}</p>
      </div>
    `).join('');
  } catch {
    document.getElementById('course-list').innerHTML = `
      <p class="text-secondary">加载失败，请检查网络连接。</p>
    `;
  }
});

function renderScheduleTable(courses) {
  return `
    <div class="card" style="overflow-x:auto">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>课程号</th>
            <th>教学班名称</th>
            <th>教师</th>
            <th>时间</th>
            <th>地点</th>
          </tr>
        </thead>
        <tbody>
          ${courses.map(c => `
            <tr>
              <td>${c.courseId}</td>
              <td>${c.className}</td>
              <td>${c.teacher}</td>
              <td>${c.time}</td>
              <td>${c.location}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---- Page: Personal Space ----
registerPage('profile', async (container) => {
  container.innerHTML = `
    <h1 class="page-title">个人空间</h1>
    <div class="card">
      <h2 class="card-title">个人信息</h2>
      <p class="text-secondary mt-4">请先登录以查看个人信息。</p>
    </div>
  `;
});

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    lucide.createIcons();
  }

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });

  navigateTo('courses');
});
