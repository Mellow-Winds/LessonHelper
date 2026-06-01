/**
 * 课搭子 - Client Application
 * Material Design 3 · Fluid Motion System
 */

/* =============================================
   i18n Language Foundation (executes before any DOM)
   ============================================= */

window.i18nDict = {
  zh: {
    app_name: '课搭子',
    courses: '课程列表',
    profile: '个人中心',
    import_schedule: '导入课程表',
    select_existing: '选择已有课程',
    search: '搜索',
    login: '登录',
    register: '注册',
    email: '邮箱',
    password: '密码',
    password_min: '密码（至少6位）',
    nickname: '昵称',
    major: '专业',
    grade: '年级',
    verify_code: '验证码',
    course_id: '课程号',
    course_name: '课程名称',
    teacher: '教师',
    all_time: '全部时间',
    all_semester: '全部学期',
    title: '标题',
    content: '内容',
    save: '保存',
    publish: '发布',
    logout: '退出登录',
    edit_profile: '编辑资料',
  },
  en: {
    app_name: 'EduSpace',
    courses: 'Courses',
    profile: 'Profile',
    import_schedule: 'Import Schedule',
    select_existing: 'Select Course',
    search: 'Search',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    password_min: 'Password (min 6)',
    nickname: 'Nickname',
    major: 'Major',
    grade: 'Grade',
    verify_code: 'Verification Code',
    course_id: 'Course ID',
    course_name: 'Course Name',
    teacher: 'Teacher',
    all_time: 'All Time',
    all_semester: 'All Semesters',
    title: 'Title',
    content: 'Content',
    save: 'Save',
    publish: 'Publish',
    logout: 'Logout',
    edit_profile: 'Edit Profile',
  },
};

// Lock language synchronously before any rendering
window.currentLang = localStorage.getItem('lang') || 'zh';

// Global translation function with key fallback
window.t = function(key) {
  return (window.i18nDict[window.currentLang] && window.i18nDict[window.currentLang][key]) || key;
};

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
  if (typeof markdownit === 'function') {
    return markdownit().render(text);
  }
  console.warn('markdown-it not loaded, using fallback renderer');
  return '<p>' + text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
}

/* =============================================
   MD3 Component Factories
   ============================================= */

/**
 * createMdInput — MD3 outlined input with CSS-driven floating label
 * @param {{ id?: string, label: string, type?: string, value?: string, required?: boolean, attrs?: string }} config
 * @returns {string} HTML string
 */
function createMdInput(config) {
  const { id = '', label, type = 'text', value = '', required = false, attrs = '' } = config;
  const idAttr = id ? `id="${id}"` : '';
  const reqAttr = required ? 'required' : '';
  const valAttr = value ? `value="${escHtml(value)}"` : '';
  return `
    <div class="md-input-group">
      <input class="md-input" ${idAttr} type="${type}" placeholder=" " ${reqAttr} ${valAttr} ${attrs}>
      <label class="md-label">${escHtml(label)}</label>
      <fieldset class="md-border" aria-hidden="true"><legend><span>${escHtml(label)}</span></legend></fieldset>
    </div>
  `;
}

/**
 * createMdTextarea — MD3 outlined textarea with <fieldset> native notch
 * @param {{ id?: string, label: string, rows?: number, required?: boolean, attrs?: string }} config
 * @returns {string} HTML string
 */
function createMdTextarea(config) {
  const { id = '', label, rows = 5, required = false, attrs = '' } = config;
  const idAttr = id ? `id="${id}"` : '';
  const reqAttr = required ? 'required' : '';
  return `
    <div class="md-input-group">
      <textarea class="md-input" ${idAttr} placeholder=" " rows="${rows}" ${reqAttr} style="resize:vertical" ${attrs}></textarea>
      <label class="md-label">${escHtml(label)}</label>
      <fieldset class="md-border" aria-hidden="true"><legend><span>${escHtml(label)}</span></legend></fieldset>
    </div>
  `;
}

/**
 * createMdSelect — Custom div+ul select (no native <select>)
 * @param {{ id?: string, label?: string, options: {text: string, value: string}[], selected?: string }} config
 * @returns {string} HTML string
 */
function createMdSelect(config) {
  const { id = '', label = '', options, selected = '' } = config;
  const containerId = id ? `${id}-container` : 'md-select-' + Math.random().toString(36).slice(2, 8);
  const hiddenId = id;
  const valueId = id ? `${id}-value` : '';

  const selectedOpt = options.find(o => o.value === selected) || options[0];
  const triggerLabel = label ? label : selectedOpt.text;

  const listItems = options.map(o =>
    `<li class="md-select-option${o.value === selected ? ' selected' : ''}" data-value="${escHtml(o.value)}">${escHtml(o.text)}</li>`
  ).join('');

  return `
    <div class="md-select-container" id="${containerId}">
      <div class="md-select-trigger">
        <span class="md-select-value" id="${valueId}">${escHtml(triggerLabel)}</span>
        <span class="md-select-arrow mi">arrow_drop_down</span>
      </div>
      <ul class="md-select-menu">${listItems}</ul>
      <input type="hidden" id="${hiddenId}" value="${escHtml(selected)}">
    </div>
  `;
}

/* ---- Global Event Delegation (select only — inputs handled by CSS) ---- */

// Custom select: toggle menu, pick option, close on outside click
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.md-select-trigger');
  if (trigger) {
    const container = trigger.closest('.md-select-container');
    if (container) {
      document.querySelectorAll('.md-select-container.open').forEach(c => {
        if (c !== container) c.classList.remove('open');
      });
      container.classList.toggle('open');
      e.stopPropagation();
    }
    return;
  }

  const option = e.target.closest('.md-select-option');
  if (option) {
    const container = option.closest('.md-select-container');
    if (container) {
      const value = option.getAttribute('data-value');
      const text = option.textContent;
      const hidden = container.querySelector('input[type="hidden"]');
      const valueEl = container.querySelector('.md-select-value');
      if (hidden) hidden.value = value;
      if (valueEl) valueEl.textContent = text;
      container.querySelectorAll('.md-select-option').forEach(li => {
        li.classList.toggle('selected', li === option);
      });
      container.classList.remove('open');
      container.dispatchEvent(new CustomEvent('md-select-change', { detail: { value, text } }));
      e.stopPropagation();
    }
    return;
  }

  if (!e.target.closest('.md-select-container')) {
    document.querySelectorAll('.md-select-container.open').forEach(c => c.classList.remove('open'));
  }
});

function spawnRipple(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.5;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  Object.assign(ripple.style, {
    width: size + 'px', height: size + 'px',
    left: (e.clientX - rect.left - size / 2) + 'px',
    top: (e.clientY - rect.top - size / 2) + 'px',
  });
  el.appendChild(ripple);
  ripple.animate(
    [
      { transform: 'scale(0)', opacity: 0.2 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }
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

async function apiDelete(url) {
  const token = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'DELETE', headers });
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
    <form id="login-form" onsubmit="handleLogin(event)" style="display:flex;flex-direction:column;gap:20px">
      <div class="md-input-group">
        <input class="md-input" type="email" name="email" placeholder=" " required autocomplete="email">
        <label class="md-label">${window.t('email')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('email')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="password" name="password" placeholder=" " required autocomplete="current-password">
        <label class="md-label">${window.t('password')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('password')}</span></legend></fieldset>
      </div>
      <div class="form-error" id="login-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">${window.t('login')}</button>
    </form>
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-form" onsubmit="handleRegister(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="md-input-group">
        <input class="md-input" type="email" name="email" placeholder=" " required autocomplete="email">
        <label class="md-label">${window.t('email')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('email')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="password" name="password" placeholder=" " required minlength="6" autocomplete="new-password">
        <label class="md-label">${window.t('password_min')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('password_min')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="text" name="nickname" placeholder=" " required>
        <label class="md-label">${window.t('nickname')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('nickname')}</span></legend></fieldset>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="text" name="major" placeholder=" ">
          <label class="md-label">${window.t('major')}</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('major')}</span></legend></fieldset>
        </div>
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="text" name="grade" placeholder=" ">
          <label class="md-label">${window.t('grade')}</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('grade')}</span></legend></fieldset>
        </div>
      </div>
      <div class="form-error" id="register-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">${window.t('register')}</button>
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
      <form id="verify-form" onsubmit="handleVerify(event)" style="display:flex;flex-direction:column;gap:20px">
        <div class="md-input-group">
          <input class="md-input" type="text" name="code" placeholder=" " required maxlength="6" style="text-align:center;font-size:24px;letter-spacing:8px" autocomplete="one-time-code">
          <label class="md-label" style="text-align:center;left:50%;transform:translate(-50%,-50%)">${window.t('verify_code')}</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('verify_code')}</span></legend></fieldset>
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
          ${user.qq ? `<span class="info-chip"><span class="mi" style="font-size:16px">tag</span> QQ: ${user.qq}</span>` : ''}
        </div>
        <button class="btn btn-secondary" style="margin-top:24px" onclick="openEditProfileModal()">
          <span class="mi">edit</span> 编辑资料
        </button>
      </div>
      <div class="card" style="margin-top:16px">
        <h3 style="margin-bottom:16px"><span class="mi" style="font-size:20px;vertical-align:middle;margin-right:8px">privacy_tip</span>隐私设置</h3>
        <div class="privacy-toggle-row">
          <div>
            <div style="font-weight:500">公开个人信息</div>
            <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:2px">关闭后，其他用户无法看到你的专业、年级和QQ</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="privacy-show-profile" ${user.privacy_show_profile !== 0 ? 'checked' : ''} onchange="handlePrivacyChange('privacy_show_profile', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="privacy-toggle-row">
          <div>
            <div style="font-weight:500">允许被匹配</div>
            <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:2px">关闭后，你不会出现在同课程同学匹配结果中</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="privacy-allow-match" ${user.privacy_allow_match !== 0 ? 'checked' : ''} onchange="handlePrivacyChange('privacy_allow_match', this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
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
    <form id="edit-profile-form" onsubmit="handleEditProfile(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="md-input-group">
        <input class="md-input" type="text" name="nickname" placeholder=" " value="${user.nickname || ''}" required>
        <label class="md-label">${window.t('nickname')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('nickname')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="text" name="major" placeholder=" " value="${user.major || ''}">
        <label class="md-label">${window.t('major')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('major')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="text" name="grade" placeholder=" " value="${user.grade || ''}">
        <label class="md-label">${window.t('grade')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('grade')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="text" name="qq" placeholder=" " value="${user.qq || ''}">
        <label class="md-label">QQ号</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>QQ号</span></legend></fieldset>
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
  const qq = form.qq.value.trim();

  const errEl = document.getElementById('edit-profile-error');
  errEl.style.display = 'none';

  const result = await apiPut('/api/auth/me', { nickname, major, grade, qq });

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

async function handlePrivacyChange(field, value) {
  const result = await apiPut('/api/auth/me', { [field]: value });
  if (result.error) {
    showToast('设置失败：' + result.error);
    return;
  }
  window._currentUser = result;
  showToast(value ? '已开启' : '已关闭');
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

// 获取当前学期标识（与后端 getSemesterKey 逻辑一致）
function getCurrentSemesterKey() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const y = now.getFullYear();
  if ((m === 8 && d >= 15) || m >= 9 || (m === 1 && d === 1)) return `${y}-1`;
  if ((m === 2 && d >= 15) || (m >= 3 && m <= 5) || (m === 6 && d <= 14)) return `${y}-2`;
  if ((m === 6 && d >= 15) || m === 7 || (m === 8 && d <= 14)) return `${y}-summer`;
  return `${y}-closed`;
}

// 学期标识 → 中文标签
function semesterLabel(key) {
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

let _currentSemester = getCurrentSemesterKey();

registerPage('courses', async (container) => {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin-bottom:0">课程列表</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="openCourseSearchModal()">
          <span class="mi">search</span> 选择已有课程
        </button>
        <button class="btn btn-primary" onclick="openImportModal()">
          <span class="mi">upload_file</span> 导入课程表
        </button>
      </div>
    </div>
    <div id="semester-filter-wrap" style="margin-bottom:var(--space-4);width:auto;min-width:180px;display:inline-block">
      ${createMdSelect({
        id: 'semester-filter',
        options: [{ text: semesterLabel(_currentSemester), value: _currentSemester }],
        selected: _currentSemester,
      })}
    </div>
    <div id="course-list">
      <div class="card"><p class="text-secondary">加载中...</p></div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // Listen for semester select changes
  const semContainer = document.getElementById('semester-filter-container');
  if (semContainer) {
    semContainer.addEventListener('md-select-change', (e) => {
      handleSemesterChange(e.detail.value);
    });
  }

  // 加载学期列表并重建下拉框
  try {
    const semesters = await apiGet('/api/courses/semesters');
    if (semesters.length > 0) {
      const allKeys = new Set([_currentSemester, ...semesters]);
      const sorted = Array.from(allKeys).sort().reverse();
      const options = [
        { text: '全部学期', value: 'all' },
        ...sorted.map(k => ({ text: semesterLabel(k), value: k }))
      ];
      const wrap = document.getElementById('semester-filter-wrap');
      if (wrap) {
        wrap.innerHTML = createMdSelect({
          id: 'semester-filter',
          options,
          selected: _currentSemester,
        });
        const newSemContainer = document.getElementById('semester-filter-container');
        if (newSemContainer) {
          newSemContainer.addEventListener('md-select-change', (e) => {
            handleSemesterChange(e.detail.value);
          });
        }
      }
    }
  } catch {}

  // 加载课程列表
  await loadCourseList(_currentSemester);
});

async function handleSemesterChange(semester) {
  _currentSemester = semester;
  await loadCourseList(semester);
}

async function loadCourseList(semester) {
  const listEl = document.getElementById('course-list');
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
      <div class="card mb-4 clickable" onclick="navigateTo('course', ${c.id})">
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

// ===== 退出课程 =====

async function handleLeaveCourse(courseId) {
  if (!confirm('确定要退出该课程吗？')) return;
  const result = await apiDelete(`/api/courses/${courseId}/leave`);
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('已退出课程');
    navigateTo('courses');
  }
}

// ===== 选择已有课程 =====

async function openCourseSearchModal() {
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

async function doCourseSearch() {
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

async function handleEnrollFromSearch(courseId) {
  const result = await apiPost(`/api/courses/${courseId}/enroll`, {});
  if (result.error) {
    showToast(result.error);
  } else {
    showToast('加入成功');
    closeModal();
    navigateTo('courses');
  }
}

/* =============================================
   Page: Course Space (Forum)
   ============================================= */

// 全局存储课程空间状态
window._courseSpace = {};

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

    window._courseSpace = { courseId, course, activeTab: 'forum' };

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title" style="margin-bottom:4px">${escHtml(course.title)}</h1>
          <p class="text-secondary">
            ${course.teacher ? escHtml(course.teacher) + ' · ' : ''}
            ${course.enrollment_count || 0} 人选课
          </p>
        </div>
      </div>
      <div class="course-tabs" id="course-tabs">
        <button class="course-tab active" data-tab="forum" onclick="switchCourseTab('forum', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
        </button>
        <button class="course-tab" data-tab="materials" onclick="switchCourseTab('materials', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
        </button>
        <button class="course-tab" data-tab="members" onclick="switchCourseTab('members', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 成员
        </button>
      </div>
      <div id="course-tab-content"></div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
    animIn(container.querySelector('.course-tabs'), { y: 12, delay: 80, dur: 350 });

    // 默认加载论坛
    await switchCourseTab('forum', courseId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

async function switchCourseTab(tab, courseId) {
  window._courseSpace.activeTab = tab;

  // 更新 tab 高亮
  document.querySelectorAll('.course-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const contentEl = document.getElementById('course-tab-content');
  if (!contentEl) return;

  switch (tab) {
    case 'forum':
      await renderForumTab(contentEl, courseId);
      break;
    case 'materials':
      await renderMaterialsTab(contentEl, courseId);
      break;
    case 'members':
      await renderMembersTab(contentEl, courseId);
      break;
  }
}

// ===== 论坛标签页 =====
async function renderForumTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await apiGet(`/api/courses/${courseId}/posts`);

  contentEl.innerHTML = `
    <div style="display:flex;gap:24px">
      <div style="flex:1;min-width:0" id="posts-area">
        <div style="margin-bottom:16px;text-align:right">
          <button class="btn btn-primary" onclick="openCreatePostModal(${courseId})">
            <span class="mi">edit</span> 发帖
          </button>
        </div>
        ${posts.length === 0 ? `
          <div class="card" style="text-align:center;padding:48px">
            <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">forum</span>
            <p class="text-secondary" style="margin-top:12px">暂无帖子，来发第一个吧</p>
          </div>
        ` : posts.map(p => `
          <div class="card mb-4 post-card clickable">
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
      ${await renderMemberSidebar(courseId)}
    </div>
  `;

  const cards = contentEl.querySelectorAll('.post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 20, dur: 400, gap: 50 });
}

// ===== 成员侧栏（论坛和资料页共用）=====
async function renderMemberSidebar(courseId) {
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  return `
    <div style="width:220px;flex-shrink:0">
      <div class="card" id="members-sidebar">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px;color:var(--md-on-surface-variant)">
          <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 成员 (<span id="member-count">${members.length}</span>)
        </h3>
        <div id="member-filters" style="margin-bottom:12px">
          <select id="filter-major" class="member-filter-select" onchange="filterMembers(${courseId})">
            <option value="">全部专业</option>
            ${(stats?.majors || []).map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
          </select>
          <select id="filter-grade" class="member-filter-select" onchange="filterMembers(${courseId})">
            <option value="">全部年级</option>
            ${(stats?.grades || []).map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('')}
          </select>
        </div>
        <div id="members-list">
          ${renderMembersList(members)}
        </div>
      </div>
    </div>
  `;
}

// ===== 资料标签页 =====
async function renderMaterialsTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  await loadMaterials(contentEl, courseId);
}

async function loadMaterials(contentEl, courseId, opts = {}) {
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
            <select id="mat-category" class="member-filter-select" style="width:auto;min-width:100px;margin-bottom:0" onchange="refreshMaterials(${courseId})">
              ${categories.map(c => `<option value="${c === '全部' ? 'all' : c}">${c}</option>`).join('')}
            </select>
            <input id="mat-chapter" class="member-filter-select" style="width:auto;min-width:120px;margin-bottom:0" placeholder="按章节搜索" onchange="refreshMaterials(${courseId})">
            <select id="mat-sort" class="member-filter-select" style="width:auto;min-width:100px;margin-bottom:0" onchange="refreshMaterials(${courseId})">
              <option value="newest">最新上传</option>
              <option value="rating">评分最高</option>
              <option value="downloads">下载最多</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="openUploadMaterialModal(${courseId})">
            <span class="mi">upload</span> 上传资料
          </button>
        </div>
        <div id="materials-list">
          ${renderMaterialsList(materials, courseId)}
        </div>
      </div>
      ${await renderMemberSidebar(courseId)}
    </div>
  `;
}

function renderMaterialsList(materials, courseId) {
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
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> ${escHtml(m.uploader_name)}</span>
            <span>${formatFileSize(m.file_size)}</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">download</span> ${m.download_count}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
            ${renderStars(m.avg_rating, m.id)}
            <span style="font-size:12px;color:var(--md-on-surface-variant)">${m.rating_count > 0 ? m.avg_rating.toFixed(1) + ' 分' : '暂无评分'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
          <a href="/api/materials/${m.id}/download" class="btn btn-primary" style="font-size:12px;padding:6px 12px">
            <span class="mi" style="font-size:16px">download</span> 下载
          </a>
          ${m.uploader_id === window._currentUser?.id ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 12px" onclick="deleteMaterial(${m.id}, ${courseId})"><span class="mi" style="font-size:16px">delete</span> 删除</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderStars(avgRating, materialId) {
  let html = '<div class="stars-row">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(avgRating) ? 'star' : 'star_border';
    html += `<span class="mi star-icon" style="font-size:18px;cursor:pointer;color:${i <= Math.round(avgRating) ? '#FB8C00' : 'var(--md-outline-variant)'}" onclick="rateMaterial(${materialId}, ${i})">${filled}</span>`;
  }
  html += '</div>';
  return html;
}

async function rateMaterial(materialId, rating) {
  if (!window._currentUser) {
    showToast('请先登录');
    return;
  }
  const result = await apiPost(`/api/materials/${materialId}/rate`, { rating });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(`评分成功 (${result.avg_rating} 分)`);
  // 刷新资料列表
  const courseId = window._courseSpace.courseId;
  const contentEl = document.getElementById('course-tab-content');
  if (contentEl && courseId) await loadMaterials(contentEl, courseId);
}

async function refreshMaterials(courseId) {
  const category = document.getElementById('mat-category')?.value || 'all';
  const chapter = document.getElementById('mat-chapter')?.value || '';
  const sort = document.getElementById('mat-sort')?.value || 'newest';
  const contentEl = document.getElementById('course-tab-content');
  if (contentEl) await loadMaterials(contentEl, courseId, { category, chapter, sort });
}

async function deleteMaterial(materialId, courseId) {
  if (!confirm('确定删除这份资料？')) return;
  const result = await apiDelete(`/api/materials/${materialId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('删除成功');
  const contentEl = document.getElementById('course-tab-content');
  if (contentEl) await loadMaterials(contentEl, courseId);
}

function openUploadMaterialModal(courseId) {
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

  // 点击拖拽区触发文件选择
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

function onFileSelected(input) {
  const nameEl = document.getElementById('upload-file-name');
  if (input.files.length && nameEl) {
    nameEl.textContent = '📎 ' + input.files[0].name;
    nameEl.style.display = 'block';
  }
}

async function handleUploadMaterial(e, courseId) {
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
    const contentEl = document.getElementById('course-tab-content');
    if (contentEl) await loadMaterials(contentEl, courseId);
  } catch (err) {
    if (errEl) { errEl.textContent = '上传失败'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '上传';
  }
}

// ===== 成员标签页（全宽）=====
async function renderMembersTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  contentEl.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <span style="font-weight:600;color:var(--md-on-surface-variant)"><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 课程成员 (<span id="member-count">${members.length}</span>)</span>
        <div style="flex:1"></div>
        <select id="filter-major" class="member-filter-select" style="width:auto;min-width:120px;margin-bottom:0" onchange="filterMembersTab(${courseId})">
          <option value="">全部专业</option>
          ${(stats?.majors || []).map(m => `<option value="${escHtml(m)}">${escHtml(m)}</option>`).join('')}
        </select>
        <select id="filter-grade" class="member-filter-select" style="width:auto;min-width:120px;margin-bottom:0" onchange="filterMembersTab(${courseId})">
          <option value="">全部年级</option>
          ${(stats?.grades || []).map(g => `<option value="${escHtml(g)}">${escHtml(g)}</option>`).join('')}
        </select>
      </div>
      <div id="members-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${renderMemberCards(members)}
      </div>
    </div>
  `;
}

function renderMemberCards(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-card-grid">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">tag</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

async function filterMembersTab(courseId) {
  const major = document.getElementById('filter-major')?.value || '';
  const grade = document.getElementById('filter-grade')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const gridEl = document.getElementById('members-grid');
  const countEl = document.getElementById('member-count');
  if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (gridEl) gridEl.innerHTML = renderMemberCards(members);
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载失败</p>';
  }
}

function renderMembersList(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-item">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">tag</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

async function filterMembers(courseId) {
  const major = document.getElementById('filter-major')?.value || '';
  const grade = document.getElementById('filter-grade')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const listEl = document.getElementById('members-list');
  if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (listEl) listEl.innerHTML = renderMembersList(members);
    const countEl = document.getElementById('member-count');
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载失败</p>';
  }
}

/* =============================================
   Page: Invites (自习邀约)
   ============================================= */

registerPage('invites', async (container) => {
  if (!window._currentUser) {
    await loadCurrentUser();
  }
  if (!window._currentUser) {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">请先登录后查看自习邀约</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">自习邀约</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="navigateTo('invites-my')">
          <span class="mi">person</span> 我的
        </button>
        <button class="btn btn-primary" onclick="openCreateInviteModal()">
          <span class="mi">add</span> 发布邀约
        </button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      <select id="invite-filter-date" class="member-filter-select" style="width:auto;min-width:100px;margin-bottom:0" onchange="refreshInvites()">
        <option value="all">全部日期</option>
        <option value="today">今天</option>
        <option value="week">近7天</option>
      </select>
      <select id="invite-filter-status" class="member-filter-select" style="width:auto;min-width:100px;margin-bottom:0" onchange="refreshInvites()">
        <option value="all">全部状态</option>
        <option value="open">招募中</option>
        <option value="full">已满</option>
        <option value="closed">已关闭</option>
      </select>
    </div>
    <div id="invites-list"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  await refreshInvites();
});

async function refreshInvites() {
  const date = document.getElementById('invite-filter-date')?.value || 'all';
  const status = document.getElementById('invite-filter-status')?.value || 'all';
  const params = new URLSearchParams();
  if (date !== 'all') params.set('date', date);
  if (status !== 'all') params.set('status', status);

  const listEl = document.getElementById('invites-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/invites?${params.toString()}`);
    const invites = data?.invites || [];
    if (listEl) listEl.innerHTML = renderInvitesList(invites);

    const cards = listEl?.querySelectorAll('.invite-card');
    if (cards?.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  } catch {
    if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

function renderInvitesList(invites) {
  if (invites.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">event_available</span>
        <p class="text-secondary" style="margin-top:12px">暂无自习邀约，来发布第一个吧</p>
      </div>
    `;
  }

  return invites.map(inv => {
    const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
    const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };
    const isCreator = inv.creator_id === window._currentUser?.id;
    const isJoined = inv.my_status === 'accepted' || isCreator;
    const isFull = inv.participant_count >= inv.max_participants;

    return `
      <div class="card invite-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <h3 style="font-size:var(--text-lg);font-weight:600">${escHtml(inv.title)}</h3>
              <span class="status-badge ${statusClass[inv.status] || ''}">${statusMap[inv.status] || inv.status}</span>
            </div>
            <div style="display:flex;gap:16px;margin-top:8px;flex-wrap:wrap;font-size:14px;color:var(--md-on-surface-variant)">
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">event</span> ${escHtml(inv.study_date)}</span>
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">schedule</span> ${escHtml(inv.start_time)} - ${escHtml(inv.end_time)}</span>
              ${inv.location ? `<span><span class="mi" style="font-size:16px;vertical-align:-3px">location_on</span> ${escHtml(inv.location)}</span>` : ''}
              <span><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${inv.participant_count}/${inv.max_participants}人</span>
            </div>
            ${inv.description ? `<p style="margin-top:8px;font-size:14px;color:var(--md-on-surface-variant)">${escHtml(inv.description)}</p>` : ''}
            <div style="margin-top:8px;font-size:12px;color:var(--md-outline)">发起人: ${escHtml(inv.creator_name)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
            ${!isCreator && !isJoined && inv.status === 'open' && !isFull ? `<button class="btn btn-primary" style="font-size:12px;padding:6px 16px" onclick="respondInvite(${inv.id}, 'join')">加入</button>` : ''}
            ${isJoined && !isCreator ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 16px" onclick="respondInvite(${inv.id}, 'cancel')">取消参与</button>` : ''}
            ${isCreator ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 16px" onclick="cancelInvite(${inv.id})">取消邀约</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function respondInvite(inviteId, action) {
  const result = await apiPost(`/api/invites/${inviteId}/respond`, { action });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(result.message);
  await refreshInvites();
}

async function cancelInvite(inviteId) {
  if (!confirm('确定取消这个邀约？')) return;
  const result = await apiDelete(`/api/invites/${inviteId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('已取消');
  await refreshInvites();
}

function openCreateInviteModal() {
  const today = new Date().toISOString().split('T')[0];
  const html = `
    <form id="create-invite-form" onsubmit="handleCreateInvite(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="md-input-group">
        <input class="md-input" name="title" placeholder=" " required>
        <label class="md-label">邀约标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>邀约标题</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <textarea class="md-input md-textarea" name="description" placeholder=" " rows="2"></textarea>
        <label class="md-label">描述（可选）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>描述</span></legend></fieldset>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="date" name="study_date" value="${today}" required>
          <label class="md-label">日期</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>日期</span></legend></fieldset>
        </div>
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="number" name="max_participants" value="4" min="2" max="20" placeholder=" ">
          <label class="md-label">人数上限</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>人数上限</span></legend></fieldset>
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="time" name="start_time" value="14:00" required>
          <label class="md-label">开始时间</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>开始时间</span></legend></fieldset>
        </div>
        <div class="md-input-group" style="flex:1">
          <input class="md-input" type="time" name="end_time" value="17:00" required>
          <label class="md-label">结束时间</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>结束时间</span></legend></fieldset>
        </div>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="location" placeholder=" ">
        <label class="md-label">地点（如：图书馆3楼）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>地点</span></legend></fieldset>
      </div>
      <div class="form-error" id="create-invite-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">发布</button>
    </form>
  `;
  openModal('发布自习邀约', html);
}

async function handleCreateInvite(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('create-invite-error');

  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    study_date: form.study_date.value,
    start_time: form.start_time.value,
    end_time: form.end_time.value,
    location: form.location.value.trim(),
    max_participants: Number(form.max_participants.value) || 4,
  };

  if (data.start_time >= data.end_time) {
    if (errEl) { errEl.textContent = '结束时间必须晚于开始时间'; errEl.style.display = 'block'; }
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '发布中...';

  const result = await apiPost('/api/invites', data);

  if (result.error) {
    if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '发布';
    return;
  }

  closeModal();
  showToast('发布成功');
  await refreshInvites();
}

// ===== 我的邀约 =====
registerPage('invites-my', async (container) => {
  if (!window._currentUser) {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">请先登录</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('invites')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title">我的邀约</h1>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary tab-btn active" id="my-tab-created" onclick="switchMyTab('created')">我发起的</button>
      <button class="btn btn-secondary tab-btn" id="my-tab-joined" onclick="switchMyTab('joined')">我参与的</button>
    </div>
    <div id="my-invites-list"></div>
  `;

  bindRipples(container);
  await loadMyInvites('created');
});

async function switchMyTab(type) {
  document.getElementById('my-tab-created')?.classList.toggle('active', type === 'created');
  document.getElementById('my-tab-created')?.classList.toggle('btn-primary', type === 'created');
  document.getElementById('my-tab-created')?.classList.toggle('btn-secondary', type !== 'created');
  document.getElementById('my-tab-joined')?.classList.toggle('active', type === 'joined');
  document.getElementById('my-tab-joined')?.classList.toggle('btn-primary', type === 'joined');
  document.getElementById('my-tab-joined')?.classList.toggle('btn-secondary', type !== 'joined');
  await loadMyInvites(type);
}

async function loadMyInvites(type) {
  const listEl = document.getElementById('my-invites-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  const invites = await apiGet(`/api/invites/my?type=${type}`);
  if (!invites || invites.length === 0) {
    const emptyMsg = type === 'created' ? '你还没有发布过邀约' : '你还没有参与过邀约';
    if (listEl) listEl.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">event_available</span>
        <p class="text-secondary" style="margin-top:12px">${emptyMsg}</p>
      </div>
    `;
    return;
  }

  if (listEl) listEl.innerHTML = renderInvitesList(invites);
}

// ===== Post & Comment Helpers =====

async function openCreatePostModal(courseId) {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }
  const html = `
    <form id="create-post-form" onsubmit="handleCreatePost(event, ${courseId})" style="display:flex;flex-direction:column;gap:16px">
      <div class="md-input-group">
        <input class="md-input" type="text" name="title" placeholder=" " required>
        <label class="md-label">${window.t('title')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('title')}</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <textarea class="md-input" name="content" placeholder=" " rows="5" required style="resize:vertical"></textarea>
        <label class="md-label">${window.t('content')}</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>${window.t('content')}</span></legend></fieldset>
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

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function escHtml(str) {
  if (!str || typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindRipples(container) {
  container.querySelectorAll('.btn, .clickable').forEach(el => {
    el.removeEventListener('click', spawnRipple);
    el.addEventListener('click', spawnRipple);
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
