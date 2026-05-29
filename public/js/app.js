/**
 * EduSpace - Client Application
 * Material Design 3 · Fluid Motion System
 */

/* =============================================
   Animation Engine
   ============================================= */

const Ease = {
  standard:   'cubic-bezier(0.2, 0, 0, 1)',
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  spring:     'cubic-bezier(0.34, 1.56, 0.64, 1)',
  gentle:     'cubic-bezier(0.25, 0.1, 0.25, 1)',
  bounce:     'cubic-bezier(0.18, 1.25, 0.4, 1)',
};

// Animate a single element in (fade + slide up + optional scale)
function animIn(el, opts = {}) {
  const {
    y = 24,
    s = 1,
    dur = 450,
    delay = 0,
    ease = Ease.bounce,
  } = opts;

  el.style.opacity = '0';

  return el.animate(
    [
      { opacity: 0, transform: `translateY(${y}px) scale(${s === 1 ? 1 : 0.96})` },
      { opacity: 1, transform: `translateY(0) scale(1)` },
    ],
    { duration: dur, delay, easing: ease, fill: 'forwards' }
  );
}

// Stagger-animate a list of elements
function animStagger(els, opts = {}) {
  const {
    y = 20,
    dur = 420,
    gap = 55,
    ease = Ease.bounce,
  } = opts;

  els.forEach((el, i) => {
    el.style.opacity = '0';
    el.animate(
      [
        { opacity: 0, transform: `translateY(${y}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: dur, delay: i * gap, easing: ease, fill: 'forwards' }
    );
  });
}

// Fade + scale out (for old content before removal)
function animOut(el, opts = {}) {
  const { dur = 160, ease = Ease.accelerate } = opts;
  return el.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(-10px) scale(0.99)' },
    ],
    { duration: dur, easing: ease, fill: 'forwards' }
  );
}

// Material ripple effect
function spawnRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.5;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  Object.assign(ripple.style, {
    width: size + 'px',
    height: size + 'px',
    left: (e.clientX - rect.left - size / 2) + 'px',
    top: (e.clientY - rect.top - size / 2) + 'px',
  });
  btn.appendChild(ripple);
  ripple.animate(
    [
      { transform: 'scale(0)', opacity: 0.35 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 550, easing: Ease.standard }
  ).onfinish = () => ripple.remove();
}

/* =============================================
   Page System
   ============================================= */

const pages = {};

function registerPage(name, renderFn) {
  pages[name] = renderFn;
}

// Crossfade page transition
function navigateTo(pageName) {
  const main = document.getElementById('main-content');
  if (!main || !pages[pageName]) return;

  // Highlight nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  const oldEls = Array.from(main.children);

  if (oldEls.length === 0) {
    // First load - no exit animation needed
    main.innerHTML = '';
    pages[pageName](main);
    return;
  }

  // Fade out old content
  const exits = oldEls.map(el => animOut(el, { dur: 180 }));
  Promise.all(exits.map(a => a.finished)).then(() => {
    main.innerHTML = '';
    pages[pageName](main);
  });
}

/* =============================================
   API Helpers
   ============================================= */

async function apiGet(url) {
  const res = await fetch(url);
  return res.json();
}

async function apiPostFile(url, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(url, { method: 'POST', body: fd });
  return res.json();
}

/* =============================================
   Global State
   ============================================= */

window._importedSchedule = null;

/* =============================================
   Modal System
   ============================================= */

function openModal(title, bodyHtml) {
  // Close any existing modal first
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" onclick="closeModal()">
          <span class="mi">close</span>
        </button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Escape to close
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);

  // Animate in - two phase: backdrop first, then dialog
  requestAnimationFrame(() => {
    overlay.classList.add('active');

    // Backdrop fade in
    overlay.animate(
      { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)'] },
      { duration: 300, easing: Ease.decelerate, fill: 'forwards' }
    );

    // Dialog spring in
    const modal = overlay.querySelector('.modal');
    modal.animate(
      [
        { opacity: 0, transform: 'scale(0.82) translateY(32px)' },
        { opacity: 1, transform: 'scale(1) translateY(0)' },
      ],
      { duration: 450, easing: Ease.bounce, fill: 'forwards' }
    );
  });
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;

  const modal = overlay.querySelector('.modal');

  // Backdrop fade out
  overlay.animate(
    { backgroundColor: ['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)'] },
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  );

  // Dialog scale out
  modal.animate(
    [
      { opacity: 1, transform: 'scale(1) translateY(0)' },
      { opacity: 0, transform: 'scale(0.92) translateY(12px)' },
    ],
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  ).onfinish = () => overlay.remove();
}

/* =============================================
   Import Flow
   ============================================= */

async function openImportModal() {
  const bodyHtml = `
    <div class="import-section">
      <h3 class="import-section-title">显示</h3>
      <div class="import-notes markdown-body" id="import-notes">
        <p class="text-secondary">加载中...</p>
      </div>
    </div>
    <div class="import-section">
      <h3 class="import-section-title">导入</h3>
      <label class="btn btn-primary" style="cursor:pointer">
        <span class="mi">upload_file</span>
        <span>选择课程表文件</span>
        <input type="file" accept=".xlsx,.xls" style="display:none" onchange="handleScheduleImport(this.files[0])">
      </label>
    </div>
  `;

  openModal('导入课程表', bodyHtml);

  // Load notes
  try {
    const data = await apiGet('/api/schedule/notes');
    const el = document.getElementById('import-notes');
    if (data.content && data.content.trim()) {
      el.innerHTML = marked.parse(data.content);
    } else {
      el.innerHTML = '<p class="text-secondary">暂无说明。</p>';
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
    // Wait for modal close animation, then navigate
    setTimeout(() => navigateTo('courses'), 280);
  } catch {
    alert('导入失败，请检查网络连接。');
  }
}

/* =============================================
   Page: Course List
   ============================================= */

registerPage('courses', async (container) => {
  const schedule = window._importedSchedule;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin-bottom:0">课程列表</h1>
      <button class="btn btn-primary" onclick="openImportModal()">
        <span class="mi">upload_file</span>
        <span>导入课程表</span>
      </button>
    </div>
    ${schedule ? renderScheduleTable(schedule) : `
      <div id="course-list" class="card">
        <p class="text-secondary">加载中...</p>
      </div>
    `}
  `;

  bindRipples(container);

  if (schedule) {
    showScheduleAnimation(container);
    return;
  }

  try {
    const courses = await apiGet('/api/courses');
    const listEl = document.getElementById('course-list');

    if (courses.length === 0) {
      listEl.innerHTML = `
        <p class="text-secondary">暂无课程，点击右上角创建第一门课程。</p>
      `;
      animIn(container.querySelector('.page-header'), { y: 20 });
      animIn(listEl, { y: 20, delay: 80 });
      return;
    }

    listEl.innerHTML = courses.map(c => `
      <div class="card card-interactive mb-4" onclick="navigateTo('course-${c.id}')">
        <h3 class="card-title">${c.title}</h3>
        <p class="text-secondary">${c.description || '暂无描述'}</p>
      </div>
    `).join('');

    // Animate: header first, then cards stagger in
    const header = container.querySelector('.page-header');
    animIn(header, { y: 16, dur: 380 });

    const cards = listEl.querySelectorAll('.card');
    animStagger(Array.from(cards), { y: 22, dur: 420, gap: 65 });

  } catch {
    document.getElementById('course-list').innerHTML = `
      <p class="text-secondary">加载失败，请检查网络连接。</p>
    `;
    animIn(container.querySelector('.page-header'), { y: 16 });
  }
});

function showScheduleAnimation(container) {
  const header = container.querySelector('.page-header');
  animIn(header, { y: 16, dur: 380 });

  const tableCard = container.querySelector('.card');
  if (tableCard) animIn(tableCard, { y: 20, delay: 80, dur: 420 });

  const rows = container.querySelectorAll('.schedule-table tbody tr');
  if (rows.length) {
    animStagger(Array.from(rows), { y: 14, dur: 350, gap: 40 });
  }
}

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

/* =============================================
   Page: Personal Space
   ============================================= */

registerPage('profile', async (container) => {
  container.innerHTML = `
    <h1 class="page-title">个人空间</h1>
    <div class="card">
      <h2 class="card-title">个人信息</h2>
      <p class="text-secondary mt-4">请先登录以查看个人信息。</p>
    </div>
  `;
  animIn(container.querySelector('.page-title'), { y: 16, dur: 380 });
  animIn(container.querySelector('.card'), { y: 20, delay: 80, dur: 420 });
});

/* =============================================
   Helpers
   ============================================= */

function bindRipples(container) {
  container.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', spawnRipple);
  });
}

/* =============================================
   Init
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  navigateTo('courses');
});
