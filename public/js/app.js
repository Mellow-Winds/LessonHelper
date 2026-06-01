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

        <!-- 成员侧栏 -->
        <div style="width:220px;flex-shrink:0">
          <div class="card">
            <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px;color:var(--md-on-surface-variant)">
              <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 课程成员 (${members.length})
            </h3>
            ${members.map(m => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--md-outline-variant);border-bottom-color:transparent">
                <div class="avatar-small">${(m.nickname || '?')[0]}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:var(--text-sm);font-weight:500">${escHtml(m.nickname)}</div>
                  ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
                  ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">tag</span> ${escHtml(m.qq)}</div>` : ''}
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
