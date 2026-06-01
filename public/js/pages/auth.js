/**
 * pages/auth.js — 登录/注册/验证码 + 通知系统 + 全局搜索
 * registerPage: profile（含auth入口）, search
 */

import { apiPost, apiGet, apiPut, saveToken, clearToken, isLoggedIn } from '../core/api.js';
import { registerPage, navigateTo, animIn, animOut, bindRipples } from '../core/router.js';
import { showToast, closeModal, createMdInput, escHtml, formatTime } from '../components/ui.js';

/* =============================================
   Auth State
   ============================================= */

let authTab = 'login';
let authEmail = '';
let authPassword = '';

/* =============================================
   Auth Render Functions
   ============================================= */

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

/* =============================================
   Auth Handlers
   ============================================= */

export function switchAuthTab(tab) {
  authTab = tab;
  const container = document.getElementById('main-content');

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

export async function handleLogin(e) {
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
  refreshNotifBadge();
  if (!window._notifInterval) window._notifInterval = setInterval(refreshNotifBadge, 30000);
}

export async function handleRegister(e) {
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

export async function handleVerify(e) {
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
  refreshNotifBadge();
  if (!window._notifInterval) window._notifInterval = setInterval(refreshNotifBadge, 30000);
}

export async function resendCode(e) {
  e.preventDefault();
  const result = await apiPost('/api/auth/resend-code', { email: authEmail });
  if (result.error) {
    showToast(result.error);
  } else {
    window._debugCode = result.debug_code || '';
    showToast(result.debug_code ? `验证码: ${result.debug_code}` : '验证码已重新发送');
    renderAuth(document.getElementById('main-content'));
  }
}

// 导出 renderAuth 供 profile.js 使用
export { renderAuth, authTab as _authTab_getter };

/* =============================================
   Page: Profile (含登录/注册入口)
   ============================================= */

registerPage('profile', async (container) => {
  if (!window._currentUser && isLoggedIn()) {
    await window.loadCurrentUser();
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
          ${user.qq ? `<span class="info-chip"><span class="mi" style="font-size:16px" data-icon="qq">qq</span> QQ: ${user.qq}</span>` : ''}
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

/* =============================================
   Notifications
   ============================================= */

export async function refreshNotifBadge() {
  if (!window._currentUser) return;
  try {
    const data = await apiGet('/api/notifications/unread-count');
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (data?.count > 0) {
        badge.textContent = data.count > 99 ? '99+' : data.count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch { /* ignore */ }
}

export function toggleNotificationPanel() {
  const existing = document.getElementById('notification-panel');
  if (existing) {
    existing.remove();
    return;
  }
  renderNotificationPanel();
}

async function renderNotificationPanel() {
  const bell = document.getElementById('notification-bell');
  if (!bell) return;

  const panel = document.createElement('div');
  panel.id = 'notification-panel';
  panel.className = 'notification-panel';
  panel.innerHTML = '<p style="text-align:center;padding:24px;color:var(--md-on-surface-variant)">加载中...</p>';
  document.body.appendChild(panel);

  try {
    const data = await apiGet('/api/notifications');
    const notifs = data?.notifications || [];

    if (notifs.length === 0) {
      panel.innerHTML = '<p style="text-align:center;padding:32px;color:var(--md-on-surface-variant)">暂无通知</p>';
      return;
    }

    panel.innerHTML = `
      <div class="notif-header">
        <span style="font-weight:600">通知</span>
        ${data.unread > 0 ? `<button class="notif-read-all" onclick="markAllRead()">全部已读</button>` : ''}
      </div>
      <div class="notif-list">
        ${notifs.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'notif-unread'}" onclick="handleNotifClick(${n.id}, '${n.related_type || ''}', ${n.related_id || 0}, ${n.course_id || 0}, ${n.is_read})">
            <div class="notif-icon">${getNotifIcon(n.type)}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:${n.is_read ? '400' : '600'}">${escHtml(n.title)}</div>
              <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:2px">${escHtml(n.message)}</div>
              <div style="font-size:11px;color:var(--md-outline);margin-top:4px">${formatTime(n.created_at)}</div>
            </div>
            ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  } catch {
    panel.innerHTML = '<p style="text-align:center;padding:24px;color:var(--md-on-surface-variant)">加载失败</p>';
  }
}

function getNotifIcon(type) {
  const icons = {
    new_post: 'forum',
    new_comment: 'chat',
    new_material: 'folder',
    invite_join: 'person_add',
    invite_cancel: 'event_busy',
  };
  return `<span class="mi" style="font-size:20px">${icons[type] || 'notifications'}</span>`;
}

export async function handleNotifClick(notifId, relatedType, relatedId, courseId, isRead) {
  if (!isRead) {
    await apiPut(`/api/notifications/${notifId}/read`, {});
    refreshNotifBadge();
  }
  document.getElementById('notification-panel')?.remove();
  if (relatedType === 'post' && courseId) {
    navigateTo('course', courseId);
  } else if (relatedType === 'invite') {
    navigateTo('invites');
  } else if (relatedType === 'material' && courseId) {
    navigateTo('course', courseId);
  }
}

export async function markAllRead() {
  await apiPut('/api/notifications/read-all', {});
  refreshNotifBadge();
  document.getElementById('notification-panel')?.remove();
  showToast('全部已读');
}

// 点击外部关闭通知面板
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notification-panel');
  const bell = document.getElementById('notification-bell');
  if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
    panel.remove();
  }
});

/* =============================================
   Global Search
   ============================================= */

export function handleSidebarSearchKey(e) {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q.length >= 2) {
      navigateTo('search', { q });
    }
  }
}

export function handleSearchPageKey(e) {
  if (e.key === 'Enter') executeSearch();
}

export async function executeSearch(type) {
  const input = document.getElementById('search-page-input');
  const q = input?.value?.trim() || '';
  if (q.length < 2) {
    showToast('关键词至少 2 个字符');
    return;
  }

  const activeTab = type || document.querySelector('#search-tabs .course-tab.active')?.dataset?.tab || 'all';
  const resultsEl = document.getElementById('search-results');
  if (resultsEl) resultsEl.innerHTML = '<div class="card"><p class="text-secondary">搜索中...</p></div>';

  try {
    const data = await apiGet(`/api/search?q=${encodeURIComponent(q)}&type=${activeTab}`);
    if (resultsEl) resultsEl.innerHTML = renderSearchResults(data, q);
  } catch {
    if (resultsEl) resultsEl.innerHTML = '<div class="card"><p class="text-secondary">搜索失败</p></div>';
  }

  document.querySelectorAll('#search-tabs .course-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === activeTab);
  });
}

export function switchSearchTab(type) {
  executeSearch(type);
}

function renderSearchResults(data, q) {
  const { courses = [], materials = [], posts = [] } = data;
  const total = courses.length + materials.length + posts.length;

  if (total === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">search_off</span>
        <p class="text-secondary" style="margin-top:12px">没有找到与「${escHtml(q)}」相关的内容</p>
      </div>
    `;
  }

  let html = '';

  if (courses.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">menu_book</span> 课程 (${courses.length})</h3>`;
    html += courses.map(c => `
      <div class="card search-result-card" onclick="navigateTo('course', ${c.id})">
        <div style="font-weight:600">${highlight(c.title, q)}</div>
        <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">
          ${c.teacher ? escHtml(c.teacher) + ' · ' : ''}${c.enrollment_count || 0} 人选课
        </div>
      </div>
    `).join('');
  }

  if (materials.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料 (${materials.length})</h3>`;
    html += materials.map(m => `
      <div class="card search-result-card" onclick="navigateTo('course', ${m.course_id})">
        <div style="font-weight:600">${highlight(m.title, q)}</div>
        <div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">
          ${escHtml(m.course_title)} · ${escHtml(m.category)}${m.chapter ? ' · ' + escHtml(m.chapter) : ''} · ${escHtml(m.uploader_name)}
        </div>
      </div>
    `).join('');
  }

  if (posts.length > 0) {
    html += `<h3 style="font-size:14px;color:var(--md-on-surface-variant);margin:16px 0 8px"><span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 帖子 (${posts.length})</h3>`;
    html += posts.map(p => {
      const snippet = getSnippet(p.content, q, 80);
      return `
        <div class="card search-result-card" onclick="navigateTo('course', ${p.course_id})">
          <div style="font-weight:600">${highlight(p.title, q)}</div>
          <div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px">${highlight(snippet, q)}</div>
          <div style="font-size:12px;color:var(--md-outline);margin-top:4px">
            ${escHtml(p.course_title)} · ${escHtml(p.author_name)}
          </div>
        </div>
      `;
    }).join('');
  }

  return html;
}

function highlight(text, q) {
  if (!text || !q) return escHtml(text);
  const escaped = escHtml(text);
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

function getSnippet(text, q, len) {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, len);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + q.length + 50);
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
}

function saveSearchHistory(q) {
  try {
    let history = JSON.parse(localStorage.getItem('search_history') || '[]');
    history = history.filter(h => h !== q);
    history.unshift(q);
    if (history.length > 5) history = history.slice(0, 5);
    localStorage.setItem('search_history', JSON.stringify(history));
  } catch { /* ignore */ }
}

registerPage('search', async (container, data) => {
  const q = data?.q || '';
  const activeTab = data?.type || 'all';

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">搜索结果</h1>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:8px;align-items:flex-start">
        <span class="mi" style="font-size:20px;color:var(--md-on-surface-variant);margin-top:18px">search</span>
        ${createMdInput({
          id: 'search-page-input',
          label: '搜索课程、资料、帖子...',
          value: q,
          style: 'flex:1;margin-bottom:0',
          attrs: `onkeydown="handleSearchPageKey(event)"`
        })}
        <button class="btn btn-primary" style="height:56px" onclick="executeSearch()">搜索</button>
      </div>
    </div>
    <div class="search-tabs" id="search-tabs">
      <button class="course-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all" onclick="switchSearchTab('all')">全部</button>
      <button class="course-tab ${activeTab === 'courses' ? 'active' : ''}" data-tab="courses" onclick="switchSearchTab('courses')">课程</button>
      <button class="course-tab ${activeTab === 'materials' ? 'active' : ''}" data-tab="materials" onclick="switchSearchTab('materials')">资料</button>
      <button class="course-tab ${activeTab === 'posts' ? 'active' : ''}" data-tab="posts" onclick="switchSearchTab('posts')">帖子</button>
    </div>
    <div id="search-results"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  if (q.length >= 2) {
    await executeSearch(activeTab);
  }

  if (q) saveSearchHistory(q);
});
