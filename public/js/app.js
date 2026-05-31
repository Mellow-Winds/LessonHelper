/**
 * 课搭子 - Client Application
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

function animIn(el, opts = {}) {
  const { y = 24, s = 1, dur = 450, delay = 0, ease = Ease.bounce } = opts;
  el.style.opacity = '0';
  return el.animate(
    [
      { opacity: 0, transform: `translateY(${y}px) scale(${s === 1 ? 1 : 0.96})` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: dur, delay, easing: ease, fill: 'forwards' }
  );
}

function animStagger(els, opts = {}) {
  const { y = 20, dur = 420, gap = 55, ease = Ease.bounce } = opts;
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

function renderMarkdown(text) {
  if (typeof marked === 'object' && typeof marked.parse === 'function') {
    return marked.parse(text);
  }
  if (typeof marked === 'function') {
    return marked(text);
  }
  console.warn('marked.js not loaded, using fallback renderer');
  return '<p>' + text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

function spawnRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.5;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  Object.assign(ripple.style, {
    width: size + 'px', height: size + 'px',
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

function registerPage(name, renderFn) { pages[name] = renderFn; }

function navigateTo(pageName, data) {
  const main = document.getElementById('main-content');
  if (!main || !pages[pageName]) return;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  const oldEls = Array.from(main.children);

  if (oldEls.length === 0) {
    main.innerHTML = '';
    pages[pageName](main, data);
    return;
  }

  const exits = oldEls.map(el => animOut(el, { dur: 180 }));
  Promise.all(exits.map(a => a.finished)).then(() => {
    main.innerHTML = '';
    pages[pageName](main, data);
  });
}

/* =============================================
   Auth State
   ============================================= */

const AUTH_KEY = 'kedazi_token';

function getToken() { return localStorage.getItem(AUTH_KEY); }
function saveToken(token) { localStorage.setItem(AUTH_KEY, token); }
function clearToken() { localStorage.removeItem(AUTH_KEY); }
function isLoggedIn() { return !!getToken(); }

window._currentUser = null;

async function loadCurrentUser() {
  if (!isLoggedIn()) return null;
  try {
    const user = await apiGet('/api/auth/me');
    if (user && !user.error) {
      window._currentUser = user;
      return user;
    }
    clearToken();
    return null;
  } catch {
    clearToken();
    return null;
  }
}

function logout() {
  clearToken();
  window._currentUser = null;
  navigateTo('profile');
  showToast('已退出登录');
}

/* =============================================
   Toast System
   ============================================= */

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  });
}

/* =============================================
   API Helpers
   ============================================= */

async function apiGet(url) {
  const token = getToken();
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(url, { headers });
  if (res.status === 401) { clearToken(); window._currentUser = null; }
  return res.json();
}

async function apiPost(url, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 401) { clearToken(); window._currentUser = null; }
  return res.json();
}

async function apiPut(url, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (res.status === 401) { clearToken(); window._currentUser = null; }
  return res.json();
}

async function apiPostFile(url, file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: fd });
  if (res.status === 401) { clearToken(); window._currentUser = null; }
  return res.json();
}

/* =============================================
   Modal System
   ============================================= */

function openModal(title, bodyHtml) {
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

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    overlay.animate(
      { backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)'] },
      { duration: 300, easing: Ease.decelerate, fill: 'forwards' }
    );
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
  overlay.animate(
    { backgroundColor: ['rgba(0,0,0,0.32)', 'rgba(0,0,0,0)'] },
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  );
  modal.animate(
    [
      { opacity: 1, transform: 'scale(1) translateY(0)' },
      { opacity: 0, transform: 'scale(0.92) translateY(12px)' },
    ],
    { duration: 250, easing: Ease.accelerate, fill: 'forwards' }
  ).onfinish = () => overlay.remove();
}

/* =============================================
   Page: Auth (Login / Register / Verify)
   ============================================= */

let authTab = 'login';            // 'login' | 'register' | 'verify'
let authEmail = '';
let authPassword = '';

function renderAuth(container) {
  container.innerHTML = `
    <div style="max-width:420px;margin:0 auto">
      <h1 class="page-title" style="text-align:center">课搭子</h1>

      ${authTab === 'verify' ? renderVerifyForm() : `
        <div class="auth-tabs">
          <button class="auth-tab ${authTab === 'login' ? 'active' : ''}" onclick="switchAuthTab('login')">登录</button>
          <button class="auth-tab ${authTab === 'register' ? 'active' : ''}" onclick="switchAuthTab('register')">注册</button>
        </div>

        <div class="card" id="auth-form-card">
          ${authTab === 'login' ? renderLoginForm() : renderRegisterForm()}
        </div>
      `}
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-title'), { y: 16, dur: 380 });
  const card = container.querySelector('.card');
  if (card) animIn(card, { y: 20, delay: 80, dur: 420 });
}

function renderLoginForm() {
  return `
    <form id="login-form" onsubmit="handleLogin(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="form-field">
        <label class="form-label">邮箱</label>
        <input class="input" type="email" name="email" placeholder="请输入邮箱" required autocomplete="email">
      </div>
      <div class="form-field">
        <label class="form-label">密码</label>
        <input class="input" type="password" name="password" placeholder="请输入密码" required autocomplete="current-password">
      </div>
      <div class="form-error" id="login-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">登录</button>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-form" onsubmit="handleRegister(event)" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-field">
        <label class="form-label">邮箱</label>
        <input class="input" type="email" name="email" placeholder="请输入邮箱" required autocomplete="email">
      </div>
      <div class="form-field">
        <label class="form-label">密码</label>
        <input class="input" type="password" name="password" placeholder="至少6位密码" required minlength="6" autocomplete="new-password">
      </div>
      <div class="form-field">
        <label class="form-label">昵称</label>
        <input class="input" type="text" name="nickname" placeholder="你的昵称" required>
      </div>
      <div style="display:flex;gap:12px">
        <div class="form-field" style="flex:1">
          <label class="form-label">专业</label>
          <input class="input" type="text" name="major" placeholder="如：计算机科学">
        </div>
        <div class="form-field" style="flex:1">
          <label class="form-label">年级</label>
          <input class="input" type="text" name="grade" placeholder="如：2024级">
        </div>
      </div>
      <div class="form-error" id="register-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">注册</button>
    </form>
  `;
}

function renderVerifyForm() {
  const debugCode = window._debugCode || '';
  return `
    <div class="card">
      <p class="text-secondary" style="text-align:center;margin-bottom:16px">
        验证码已发送至 <strong>${authEmail}</strong>
      </p>
      ${debugCode ? `<div style="background:var(--md-primary-container);color:var(--md-on-primary-container);text-align:center;padding:12px;border-radius:12px;margin-bottom:16px;font-weight:600">
        🔑 开发模式 — 验证码：<span style="font-size:24px;letter-spacing:6px">${debugCode}</span>
      </div>` : ''}
      <form id="verify-form" onsubmit="handleVerify(event)" style="display:flex;flex-direction:column;gap:16px">
        <div class="form-field">
          <label class="form-label">验证码</label>
          <input class="input" type="text" name="code" placeholder="请输入6位验证码" required maxlength="6" style="text-align:center;font-size:24px;letter-spacing:8px" autocomplete="one-time-code">
        </div>
        <div class="form-error" id="verify-error" style="display:none"></div>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">验证邮箱</button>
      </form>
      <p style="text-align:center;margin-top:12px;font-size:var(--text-sm);color:var(--md-on-surface-variant)">
        没收到邮件？
        <a href="#" onclick="resendCode(event)" style="color:var(--md-primary);font-weight:600">重新发送</a>
      </p>
      <p style="text-align:center;margin-top:4px">
        <a href="#" onclick="switchAuthTab('login')" style="color:var(--md-on-surface-variant);font-size:var(--text-sm)">返回登录</a>
      </p>
    </div>
  `;
}

function switchAuthTab(tab) {
  authTab = tab;
  const container = document.getElementById('main-content');
  const pageTitle = container.querySelector('.page-title');
  const existing = container.querySelector('.card, .auth-tabs');

  // Quick re-render without full transition
  if (tab === 'verify') {
    renderAuth(container);
    return;
  }

  const tabBtns = container.querySelectorAll('.auth-tab');
  tabBtns.forEach(b => b.classList.toggle('active',
    (b.textContent.trim() === '登录' && tab === 'login') ||
    (b.textContent.trim() === '注册' && tab === 'register')
  ));

  const formCard = document.getElementById('auth-form-card');
  if (formCard) {
    animOut(formCard, { dur: 120 }).onfinish = () => {
      formCard.innerHTML = tab === 'login' ? renderLoginForm() : renderRegisterForm();
      animIn(formCard, { y: 12, dur: 300 });
    };
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;

  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = '登录中...';

  const result = await apiPost('/api/auth/login', { email, password });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '登录';
    return;
  }

  saveToken(result.token);
  window._currentUser = result.user;
  showToast('登录成功');
  navigateTo('courses');
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const nickname = form.nickname.value.trim();
  const major = form.major.value.trim();
  const grade = form.grade.value.trim();

  const errEl = document.getElementById('register-error');
  errEl.style.display = 'none';

  if (password.length < 6) {
    errEl.textContent = '密码至少6位';
    errEl.style.display = 'block';
    return;
  }

  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = '发送验证码...';

  const result = await apiPost('/api/auth/register', { email, password, nickname, major, grade });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '注册';
    return;
  }

  authEmail = email;
  authPassword = password;
  authTab = 'verify';
  window._debugCode = result.debug_code || '';
  showToast(result.debug_code ? `验证码: ${result.debug_code}` : '验证码已发送');
  renderAuth(document.getElementById('main-content'));
}

async function handleVerify(e) {
  e.preventDefault();
  const code = e.target.code.value.trim();

  const errEl = document.getElementById('verify-error');
  errEl.style.display = 'none';

  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = '验证中...';

  const result = await apiPost('/api/auth/verify-email', { email: authEmail, code });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = '验证邮箱';
    return;
  }

  saveToken(result.token);
  window._currentUser = result.user;
  showToast('注册成功！');
  navigateTo('courses');
}

async function resendCode(e) {
  e.preventDefault();
  const result = await apiPost('/api/auth/resend-code', { email: authEmail });
  if (result.error) {
    showToast(result.error);
  } else {
    window._debugCode = result.debug_code || '';
    showToast(result.debug_code ? `验证码: ${result.debug_code}` : '验证码已重新发送');
    // 刷新验证码显示
    renderAuth(document.getElementById('main-content'));
  }
}

/* =============================================
   Page: Profile (含登录/注册)
   ============================================= */

registerPage('profile', async (container) => {
  // Check if logged in
  if (!window._currentUser && isLoggedIn()) {
    await loadCurrentUser();
  }

  if (!window._currentUser) {
    authTab = 'login';
    renderAuth(container);
    return;
  }

  // Logged in — show profile
  const user = window._currentUser;
  container.innerHTML = `
    <h1 class="page-title">个人中心</h1>
    <div style="max-width:480px">
      <div class="card" style="text-align:center">
        <div class="avatar-placeholder">${(user.nickname || user.username)[0]}</div>
        <h2 style="margin-top:12px">${user.nickname || user.username}</h2>
        <p class="text-secondary">${user.email}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:16px;flex-wrap:wrap">
          ${user.major ? `<span class="info-chip"><span class="mi" style="font-size:16px">school</span> ${user.major}</span>` : ''}
          ${user.grade ? `<span class="info-chip"><span class="mi" style="font-size:16px">calendar_month</span> ${user.grade}</span>` : ''}
        </div>
        <button class="btn btn-secondary" style="margin-top:24px" onclick="openEditProfileModal()">
          <span class="mi">edit</span> 编辑资料
        </button>
      </div>
      <button class="btn btn-secondary" style="margin-top:16px;width:100%;justify-content:center" onclick="logout()">
        <span class="mi">logout</span> 退出登录
      </button>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-title'), { y: 16, dur: 380 });
  animIn(container.querySelector('.card'), { y: 20, delay: 80, dur: 420 });
});

async function openEditProfileModal() {
  const user = window._currentUser;
  const html = `
    <form id="edit-profile-form" onsubmit="handleEditProfile(event)" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-field">
        <label class="form-label">昵称</label>
        <input class="input" type="text" name="nickname" value="${user.nickname || ''}" required>
      </div>
      <div class="form-field">
        <label class="form-label">专业</label>
        <input class="input" type="text" name="major" value="${user.major || ''}">
      </div>
      <div class="form-field">
        <label class="form-label">年级</label>
        <input class="input" type="text" name="grade" value="${user.grade || ''}">
      </div>
      <div class="form-error" id="edit-profile-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">保存</button>
    </form>
  `;
  openModal('编辑资料', html);
}

async function handleEditProfile(e) {
  e.preventDefault();
  const form = e.target;
  const nickname = form.nickname.value.trim();
  const major = form.major.value.trim();
  const grade = form.grade.value.trim();

  const errEl = document.getElementById('edit-profile-error');
  errEl.style.display = 'none';

  const result = await apiPut('/api/auth/me', { nickname, major, grade });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return;
  }

  window._currentUser = result;
  closeModal();
  showToast('资料已更新');
  navigateTo('profile');
}

/* =============================================
   Import Schedule
   ============================================= */

async function openImportModal() {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }

  // Step 1: Show pre-import agreement
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

function handleAgreeAndImport() {
  // Step 2: Open actual import interface
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

async function handleScheduleImport(file) {
  if (!file) return;
  try {
    const result = await apiPostFile('/api/schedule/import', file);
    if (result.error) {
      showToast('导入失败: ' + result.error);
      return;
    }
    closeModal();
    showToast(`成功导入 ${result.imported} 门课程`);
    setTimeout(() => navigateTo('courses'), 280);
  } catch {
    showToast('导入失败，请检查网络连接');
  }
}

/* =============================================
   Page: Course List
   ============================================= */

registerPage('courses', async (container) => {
  // 未登录 → 跳转登录
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin-bottom:0">课程列表</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="openImportModal()">
          <span class="mi">upload_file</span> 导入课程表
        </button>
      </div>
    </div>
    <div id="course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  const header = container.querySelector('.page-header');
  animIn(header, { y: 16, dur: 380 });

  try {
    const courses = await apiGet('/api/courses');
    const listEl = document.getElementById('course-list');

    if (courses.length === 0) {
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">menu_book</span>
          <p class="text-secondary" style="margin-top:12px">暂无课程</p>
          <p class="text-secondary">点击"导入课程表"从 xlsx 文件导入</p>
        </div>
      `;
      animIn(listEl.querySelector('.card'), { y: 20, delay: 80 });
      return;
    }

    listEl.innerHTML = courses.map(c => `
      <div class="card card-interactive mb-4" onclick="navigateTo('course', ${c.id})">
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
          </div>
        </div>
      </div>
    `).join('');

    const cards = listEl.querySelectorAll('.card');
    animStagger(Array.from(cards), { y: 22, dur: 420, gap: 60 });
  } catch {
    document.getElementById('course-list').innerHTML = `
      <div class="card"><p class="text-secondary">加载失败，请检查网络连接</p></div>
    `;
  }
});

/* =============================================
   Page: Course Space (Forum)
   ============================================= */

registerPage('course', async (container, courseId) => {
  container.innerHTML = `
    <div class="card"><p class="text-secondary">加载中...</p></div>
  `;

  try {
    const course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `<div class="card"><p class="text-secondary">${course.error}</p></div>`;
      return;
    }

    const posts = await apiGet(`/api/courses/${courseId}/posts`);
    const members = await apiGet(`/api/courses/${courseId}/members`);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title" style="margin-bottom:4px">${escHtml(course.title)}</h1>
          <p class="text-secondary">
            ${course.teacher ? escHtml(course.teacher) + ' · ' : ''}
            ${course.enrollment_count || 0} 人选课
          </p>
        </div>
        <button class="btn btn-primary" onclick="openCreatePostModal(${courseId})">
          <span class="mi">edit</span> 发帖
        </button>
      </div>

      <div style="display:flex;gap:24px">
        <!-- 帖子列表 -->
        <div style="flex:1;min-width:0" id="posts-area">
          ${posts.length === 0 ? `
            <div class="card" style="text-align:center;padding:48px">
              <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">forum</span>
              <p class="text-secondary" style="margin-top:12px">暂无帖子，来发第一个吧</p>
            </div>
          ` : posts.map(p => `
            <div class="card mb-4 post-card">
              <h3 class="card-title" style="cursor:pointer" onclick="toggleComments(${p.id})">${escHtml(p.title)}</h3>
              <p style="margin-top:8px;white-space:pre-wrap">${escHtml(p.content)}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:var(--text-sm);color:var(--md-on-surface-variant)">
                <span>${escHtml(p.author_name)} · ${formatTime(p.created_at)}</span>
                <span style="cursor:pointer;color:var(--md-primary);font-weight:500" onclick="toggleComments(${p.id})">
                  <span class="mi" style="font-size:16px;vertical-align:-3px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
                </span>
              </div>
              <div class="comments-section" id="comments-${p.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--md-outline-variant)"></div>
            </div>
          `).join('')}
        </div>

        <!-- 成员侧栏 -->
        <div style="width:220px;flex-shrink:0">
          <div class="card">
            <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px;color:var(--md-on-surface-variant)">
              <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 课程成员 (${members.length})
            </h3>
            ${members.map(m => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--md-outline-variant);border-bottom-color:transparent">
                <div class="avatar-small">${(m.nickname || '?')[0]}</div>
                <div>
                  <div style="font-size:var(--text-sm);font-weight:500">${escHtml(m.nickname)}</div>
                  <div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml(m.major + ' · ' + m.grade)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
    const cards = container.querySelectorAll('.post-card');
    if (cards.length) animStagger(Array.from(cards), { y: 20, dur: 400, gap: 50 });
    const memberCard = container.querySelector('.card:not(.post-card)');
    if (memberCard) animIn(memberCard, { y: 16, delay: 150, dur: 400 });
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

// ===== Post & Comment Helpers =====

async function openCreatePostModal(courseId) {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }
  const html = `
    <form id="create-post-form" onsubmit="handleCreatePost(event, ${courseId})" style="display:flex;flex-direction:column;gap:14px">
      <div class="form-field">
        <label class="form-label">标题 *</label>
        <input class="input" type="text" name="title" placeholder="帖子标题" required>
      </div>
      <div class="form-field">
        <label class="form-label">内容 *</label>
        <textarea class="input" name="content" placeholder="写点什么..." rows="5" required style="resize:vertical"></textarea>
      </div>
      <div class="form-error" id="create-post-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">发布</button>
    </form>
  `;
  openModal('发帖', html);
}

async function handleCreatePost(e, courseId) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const content = form.content.value.trim();

  if (!title || !content) return;

  const errEl = document.getElementById('create-post-error');
  errEl.style.display = 'none';

  const result = await apiPost(`/api/courses/${courseId}/posts`, { title, content });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return;
  }

  closeModal();
  showToast('发帖成功');
  navigateTo('course', courseId);
}

let loadedComments = {};

async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (!loadedComments[postId]) {
    section.innerHTML = '<p class="text-secondary">加载中...</p>';
    try {
      const comments = await apiGet(`/api/courses/posts/${postId}/comments`);
      loadedComments[postId] = comments;
      renderComments(section, postId, comments);
    } catch {
      section.innerHTML = '<p class="text-secondary">加载失败</p>';
    }
  } else {
    renderComments(section, postId, loadedComments[postId]);
  }
}

function renderComments(section, postId, comments) {
  section.innerHTML = `
    ${comments.length === 0 ? '<p class="text-secondary">暂无回复</p>' : comments.map(c => `
      <div style="padding:10px 0;border-bottom:1px solid var(--md-outline-variant)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:var(--text-sm);font-weight:600">${escHtml(c.author_name)}</span>
          <span style="font-size:12px;color:var(--md-on-surface-variant)">${formatTime(c.created_at)}</span>
        </div>
        <p style="font-size:var(--text-sm);white-space:pre-wrap">${escHtml(c.content)}</p>
      </div>
    `).join('')}
    ${isLoggedIn() ? `
      <form onsubmit="handleAddComment(event, ${postId})" style="display:flex;gap:8px;margin-top:12px">
        <input class="input" type="text" name="content" placeholder="写回复..." required style="flex:1">
        <button type="submit" class="btn btn-primary" style="padding:12px 16px">
          <span class="mi">send</span>
        </button>
      </form>
    ` : '<p class="text-secondary" style="margin-top:12px;font-size:var(--text-sm)"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
  `;
}

async function handleAddComment(e, postId) {
  e.preventDefault();
  const input = e.target.content;
  const content = input.value.trim();
  if (!content) return;

  const result = await apiPost(`/api/courses/posts/${postId}/comments`, { content });

  if (result.error) {
    showToast(result.error);
    return;
  }

  input.value = '';
  loadedComments[postId] = null; // force reload
  toggleComments(postId); // close
  setTimeout(() => toggleComments(postId), 50); // reopen with fresh data
  showToast('回复成功');
}

/* =============================================
   Utilities
   ============================================= */

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escHtml(str) {
  if (!str || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindRipples(container) {
  container.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', spawnRipple);
  });
}

/* =============================================
   Init
   ============================================= */

document.addEventListener('DOMContentLoaded', async () => {
  // Load current user if token exists
  await loadCurrentUser();

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  navigateTo('courses');
});
