/**
 * pages/profile.js — 个人空间：三栖视角仪表盘 + 签到 + 完整度 + 关注系统
 * 纯 ES6 Module，零全局污染
 */

import { apiGet, apiPut, apiPost, apiDelete } from '../core/api.js';
import { navigateTo, animIn, animStagger } from '../core/router.js';
import { showToast, openModal, closeModal, escHtml, createMdInput, createMdSelect, renderLoginPrompt, bindLoginPrompt } from '../components/ui.js';
import { renderAuth } from './auth.js';

/* =============================================
   常量
   ============================================= */

const MBTI_OPTIONS = [
  'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
];

const GENDER_OPTIONS = [
  { text: '不设置', value: '' },
  { text: '男', value: 'male' },
  { text: '女', value: 'female' }
];

const COMPLETION_FACTORS = [
  { key: 'nickname',   label: '昵称' },
  { key: 'major',      label: '专业' },
  { key: 'grade',      label: '年级' },
  { key: 'qq',         label: 'QQ号' },
  { key: 'wechat',     label: '微信号' },
  { key: 'avatar_desc', label: '肖像描述' },
  { key: 'mbti',       label: 'MBTI人格' },
  { key: 'gender',     label: '性别' },
];

const PROFILE_SUB_PAGES = {
  'profile-edit':    renderEditPage,
  'profile-privacy': renderPrivacyPage,
  'profile-data':    renderDataPage,
  'profile-user':    renderPublicUserPage,
};

/* =============================================
   状态
   ============================================= */

let previewMode = false;

const CHECKIN_KEY = 'kedazi_checkin';

function getTodayShanghai() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

function saveCheckinState(streak, lastDate) {
  try {
    localStorage.setItem(CHECKIN_KEY, JSON.stringify({ streak, lastDate }));
  } catch (e) { /* quota exceeded */ }
}

function loadCheckinState() {
  try {
    const raw = localStorage.getItem(CHECKIN_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted */ }
  return { streak: 0, lastDate: '' };
}

function syncCheckinToUser() {
  const saved = loadCheckinState();
  if (saved.streak > 0) {
    window._currentUser.checkin_streak = saved.streak;
    window._currentUser.last_checkin_date = saved.lastDate;
  }
}

/* =============================================
   路由注册
   ============================================= */

export function registerProfilePages(registerPage) {
  registerPage('profile', renderProfilePage);
  registerPage('profile-edit', renderEditPage);
  registerPage('profile-privacy', renderPrivacyPage);
  registerPage('profile-data', renderDataPage);
  registerPage('profile-user', renderPublicUserPage);
}

function getProfilePath() {
  const p = location.pathname;
  if (p.startsWith('/profile/')) return p.slice('/profile'.length);
  return '';
}

/* =============================================
   数据获取
   ============================================= */

async function fetchProfileData() {
  const user = window._currentUser;
  if (!user) return null;
  const stats = await apiGet(`/api/user/${user.id}/profile`);
  if (stats.error) return null;
  return { ...user, ...stats };
}

async function fetchPreviewData() {
  const user = window._currentUser;
  if (!user) return null;
  if (user.privacy_show_profile === 0) {
    return { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url, privacyHidden: true };
  }
  const stats = await apiGet(`/api/user/${user.id}/profile`);
  if (stats.error) return null;
  return { ...user, ...stats };
}

async function fetchPublicUserData(userId) {
  return apiGet(`/api/user/${userId}/profile`);
}

/* =============================================
   主入口：根据子路径分发
   ============================================= */

async function renderProfilePage(container) {
  const sub = getProfilePath();
  if (sub && PROFILE_SUB_PAGES[sub]) {
    await PROFILE_SUB_PAGES[sub](container);
    return;
  }

  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  // 从 localStorage 恢复签到状态
  syncCheckinToUser();

  const mode = previewMode ? 'preview' : 'owner';
  const data = previewMode
    ? (await fetchPreviewData().catch(() => null)) || window._currentUser
    : (await fetchProfileData().catch(() => null)) || window._currentUser;
  container.innerHTML = renderProfileCard(data, mode);
  if (previewMode) container.innerHTML += renderPreviewBanner();
  animateProfile(container);
  bindProfileInteractions(container);
  bindModeSwitch(container);
}

function renderErrorCard(msg) {
  return `
    <div class="profile-page">
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">error_outline</span>
        <h2 class="profile-empty-title">加载失败</h2>
        <p class="profile-empty-desc">${escHtml(msg || '请刷新页面重试')}</p>
        <button class="btn btn-primary" onclick="navigateTo('profile')">
          <span class="mi">refresh</span>
          重新加载
        </button>
      </div>
    </div>
  `;
}

function renderPreviewBanner() {
  return `
    <div class="profile-preview-banner">
      <span class="mi">visibility</span>
      <span>正在预览他人看到的你的主页</span>
      <button class="profile-preview-banner-btn" onclick="window._exitProfilePreview()">
        <span class="mi">edit</span>
        退出预览
      </button>
    </div>
  `;
}

function animateProfile(container) {
  const cards = container.querySelectorAll('.profile-card, .profile-section');
  animStagger(Array.from(cards), { y: 20, gap: 60 });
}

/* =============================================
   三栖视角：主名片渲染
   ============================================= */

function renderProfileCard(data, mode) {
  const isOwner = mode === 'owner';
  const isPreview = mode === 'preview';
  const isPublic = mode === 'public';
  const readonly = isPreview || isPublic;

  const avatar = data.avatar_url
    ? `<img class="profile-avatar-img" src="${escHtml(data.avatar_url)}" alt="">`
    : `<span class="profile-avatar-letter">${(data.nickname || data.username || '?')[0]}</span>`;

  const streak = data.checkin_streak || 0;
  const checkedInToday = data.last_checkin_date === getTodayShanghai();
  const streakBadge = renderStreakBadge(streak, checkedInToday, data.grace_days);

  const completion = calcCompletion(data);
  const completionBar = renderCompletionBar(completion, readonly);

  const fields = renderProfileFields(data, readonly);
  const statsRow = renderStatsRow(data);
  const settingsList = isOwner ? renderSettingsList() : '';
  const logoutBtn = isOwner ? `
    <div class="profile-section">
      <button class="btn btn-secondary btn-full" onclick="window.logout()">
        <span class="mi">logout</span>
        退出登录
      </button>
    </div>
  ` : '';

  const checkinAction = isOwner && !checkedInToday ? `
    <button class="btn btn-primary btn-compact profile-checkin-btn" id="profile-checkin-btn">
      <span class="mi">event_available</span>
      签到
    </button>
  ` : '';

  return `
    <div class="profile-page">
      <div class="profile-card profile-main-card">
        <div class="profile-header">
          <div class="profile-avatar">${avatar}</div>
          <div class="profile-identity">
            <div class="profile-name">${escHtml(data.nickname || data.username || '未设置昵称')}</div>
            ${streakBadge}
            ${checkinAction}
          </div>
        </div>
        ${completionBar}
        ${fields}
        ${statsRow}
      </div>
      ${settingsList}
      ${logoutBtn}
    </div>
  `;
}

/* =============================================
   签到勋章
   ============================================= */

function renderStreakBadge(streak, checkedIn, graceDays) {
  if (streak === 0) {
    return `<div class="profile-streak-badge">
      <span class="mi profile-streak-icon">local_fire_department</span>
      <span class="profile-streak-count">0</span>
      <span class="profile-streak-label">天</span>
    </div>`;
  }

  let graceInfo = '';
  if (!checkedIn && graceDays > 0) {
    graceInfo = `<span class="profile-streak-grace">${graceDays}天后归零</span>`;
  }

  const iconColor = streak >= 45 ? 'profile-streak-icon-gold' : streak >= 7 ? 'profile-streak-icon-fire' : '';

  return `
    <div class="profile-streak-badge ${checkedIn ? 'checked-in' : ''}">
      <span class="mi profile-streak-icon ${iconColor}">local_fire_department</span>
      <span class="profile-streak-count">${streak}</span>
      <span class="profile-streak-label">天</span>
      ${graceInfo}
    </div>
  `;
}

/* =============================================
   完整度进度条
   ============================================= */

function calcCompletion(data) {
  const total = COMPLETION_FACTORS.length;
  let done = 0;
  for (const f of COMPLETION_FACTORS) {
    if (data[f.key] && String(data[f.key]).trim()) done++;
  }
  return { done, total, percent: Math.round((done / total) * 100) };
}

function renderCompletionBar(completion, readonly) {
  const label = readonly ? '资料完整度' : '我的资料完整度';
  const pct = completion.percent;
  const trackClass = pct === 100 ? 'complete' : '';
  return `
    <div class="profile-completion">
      <div class="profile-completion-head">
        <span class="profile-completion-label">${label}</span>
        <span class="profile-completion-count">${completion.done}/${completion.total}</span>
      </div>
      <div class="profile-completion-track ${trackClass}">
        <div class="profile-completion-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function updateCompletionBar(container, data) {
  const completion = calcCompletion(data);
  const pct = completion.percent;
  const countEl = container.querySelector('.profile-completion-count');
  const fillEl = container.querySelector('.profile-completion-fill');
  const trackEl = container.querySelector('.profile-completion-track');
  if (countEl) countEl.textContent = `${completion.done}/${completion.total}`;
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (trackEl) trackEl.classList.toggle('complete', pct === 100);
}

/* =============================================
   资料字段列表（支持原位编辑）
   ============================================= */

function renderProfileFields(data) {
  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '';
  const fields = [
    { icon: 'school',            remixIcon: null,             label: '专业',     value: data.major },
    { icon: 'class',             remixIcon: null,             label: '年级',     value: data.grade },
    { icon: 'person',            remixIcon: null,             label: '性别',     value: genderText },
    { icon: '',                  remixIcon: 'ri-qq-fill',     label: 'QQ号',     value: data.qq },
    { icon: '',                  remixIcon: 'ri-wechat-fill', label: '微信号',   value: data.wechat },
    { icon: '',                  remixIcon: 'ri-tiktok-fill', label: '抖音号',   value: data.douyin },
    { icon: 'face',              remixIcon: null,             label: '肖像描述', value: data.avatar_desc },
    { icon: 'psychology',        remixIcon: null,             label: 'MBTI',     value: data.mbti },
  ];

  return `
    <div class="profile-fields">
      ${fields.map(f => renderProfileField(f)).join('')}
    </div>
  `;
}

function renderProfileField(field) {
  const value = field.value && String(field.value).trim();
  const displayValue = value
    ? escHtml(field.value)
    : `<span class="profile-field-empty">未填写</span>`;

  const iconClass = field.remixIcon
    ? `${field.remixIcon} profile-field-icon remix-align`
    : 'mi profile-field-icon';
  const iconText = field.remixIcon ? '' : field.icon;

  return `
    <div class="profile-field-row">
      <span class="${iconClass}">${iconText}</span>
      <span class="profile-field-label">${field.label}</span>
      <span class="profile-field-value ${!value ? 'empty' : ''}">${displayValue}</span>
    </div>
  `;
}

/* =============================================
   统计行（关注 / 粉丝）
   ============================================= */

function renderStatsRow(data) {
  const isSelf = window._currentUser && String(window._currentUser.id) === String(data.id);
  const showFollowing = isSelf || data.privacyShowFollowing !== false;
  const showFollowers = isSelf || data.privacyShowFollowers !== false;

  const following = data.followingCount;
  const followers = data.followerCount;

  const followingHtml = following !== null
    ? `<button class="profile-stat-btn" data-stat="following" data-user-id="${data.id}">
        <span class="profile-stat-count">${following || 0}</span>
        <span class="profile-stat-label">关注</span>
      </button>`
    : `<div class="profile-stat-item">
        <span class="profile-stat-count">--</span>
        <span class="profile-stat-label">关注</span>
      </div>`;

  const followersHtml = followers !== null
    ? `<button class="profile-stat-btn" data-stat="followers" data-user-id="${data.id}">
        <span class="profile-stat-count">${followers || 0}</span>
        <span class="profile-stat-label">粉丝</span>
      </button>`
    : `<div class="profile-stat-item">
        <span class="profile-stat-count">--</span>
        <span class="profile-stat-label">粉丝</span>
      </div>`;

  return `
    <div class="profile-stats-row">
      ${followingHtml}
      <div class="profile-stat-divider"></div>
      ${followersHtml}
    </div>
  `;
}

/* =============================================
   MD3 设置列表
   ============================================= */

function renderSettingsList() {
  const items = [
    { icon: 'edit',              title: '编辑资料',   desc: '修改昵称、专业、年级等个人信息',        page: 'profile-edit' },
    { icon: 'lock',              title: '隐私与安全', desc: '管理资料可见性、匹配权限',              page: 'profile-privacy' },
    { icon: 'storage',           title: '管理我的数据', desc: '查看数据概览、导出个人信息',          page: 'profile-data' },
    { icon: 'bug_report',        title: '问题反馈',   desc: '遇到问题？向开发者提交反馈',            page: 'profile-feedback' },
    { icon: 'preview',           title: '预览他人看我', desc: '切换到他人视角，检查隐私隐藏效果',     page: 'profile-preview' },
  ];

  return `
    <div class="profile-section">
      <div class="profile-card">
        ${items.map(item => renderListItem(item)).join('')}
      </div>
    </div>
  `;
}

function renderListItem(item) {
  return `
    <div class="profile-list-item" data-page="${item.page}">
      <span class="mi profile-list-icon">${item.icon}</span>
      <div class="profile-list-content">
        <div class="profile-list-title">${item.title}</div>
        <div class="profile-list-desc">${item.desc}</div>
      </div>
      <span class="mi profile-list-arrow">chevron_right</span>
    </div>
  `;
}

/* =============================================
   事件绑定
   ============================================= */

function bindProfileInteractions(container) {
  // 签到
  const checkinBtn = container.querySelector('#profile-checkin-btn');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', handleCheckin);
  }

  // 设置列表点击
  container.addEventListener('click', (e) => {
    const item = e.target.closest('.profile-list-item');
    if (item) {
      const page = item.dataset.page;
      if (page === 'profile-preview') {
        previewMode = true;
        navigateTo('profile');
      } else if (page === 'profile-feedback') {
        showFeedbackModal();
      } else {
        navigateTo(page);
      }
    }
  });

  // 关注/取关
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.profile-follow-btn');
    if (btn) handleFollow(btn);
    const unfollowBtn = e.target.closest('.profile-unfollow-btn');
    if (unfollowBtn) handleUnfollow(unfollowBtn);
  });

  // 交换联系方式
  container.addEventListener('click', (e) => {
    const exchangeBtn = e.target.closest('.profile-exchange-btn');
    if (exchangeBtn) {
      const userId = exchangeBtn.dataset.userId;
      showExchangeModal(userId);
    }
  });

  // 统计点击（粉丝/关注列表）
  container.addEventListener('click', (e) => {
    const statBtn = e.target.closest('.profile-stat-btn');
    if (statBtn) {
      const type = statBtn.dataset.stat;
      const userId = statBtn.dataset.userId;
      showFollowList(container, userId, type);
    }
  });

}

function bindModeSwitch(container) {
  // 由全局函数控制
}

/* =============================================
   签到逻辑
   ============================================= */

async function handleCheckin() {
  const btn = document.getElementById('profile-checkin-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;

  let result;
  try {
    result = await apiPost('/api/auth/checkin', {});
  } catch (err) {
    result = { error: '接口请求异常或未就绪' };
  }

  // 后端接口未就绪时，前端 Mock 兜底
  if (result.error) {
    console.warn('[Checkin] 后端签到接口未就绪，使用前端模拟数据');
    const saved = loadCheckinState();
    const today = getTodayShanghai();
    if (saved.lastDate === today) {
      result = { streak: saved.streak, alreadyCheckedIn: true };
    } else {
      result = {
        streak: saved.streak + 1,
        alreadyCheckedIn: false,
      };
    }
  }

  if (result.alreadyCheckedIn) {
    showToast('今天已经签到过了');
  } else {
    showToast(`签到成功！已连续 ${result.streak} 天`);
    window._currentUser.checkin_streak = result.streak;
    const todayStr = getTodayShanghai();
    window._currentUser.last_checkin_date = todayStr;
    window._currentUser.grace_days = 0;
    saveCheckinState(result.streak, todayStr);
  }

  btn.disabled = false;
  navigateTo('profile');
}

/* =============================================
   原位编辑（In-place Edit）
   ============================================= */

function startInlineEdit(el) {
  if (previewMode) return;

  const key = el.dataset.editKey;
  const currentValue = el.dataset.editValue || '';
  const row = el.closest('.profile-field-row');
  const label = row ? row.querySelector('.profile-field-label')?.textContent : key;

  // MBTI 特殊处理：下拉选择
  if (key === 'mbti') {
    startMbtiSelect(el, currentValue);
    return;
  }

  // 性别特殊处理：下拉选择
  if (key === 'gender') {
    startGenderSelect(el, currentValue);
    return;
  }

  // avatar_desc 限制 80 字
  const maxLen = key === 'avatar_desc' ? 80 : 999;

  // 替换为输入框
  el.innerHTML = `
    <input class="profile-inline-input" type="text"
      value="${escHtml(currentValue)}"
      placeholder=" "
      maxlength="${maxLen}"
      data-key="${key}">
  `;

  const input = el.querySelector('.profile-inline-input');
  input.focus();
  input.select();

  let saved = false;

  async function save() {
    if (saved) return;
    saved = true;
    const newValue = input.value.trim();

    // 未变化则还原
    if (newValue === currentValue) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      el.dataset.editValue = currentValue;
      return;
    }

    // 长度校验
    if (key === 'avatar_desc' && newValue.length > 80) {
      showToast('肖像描述不能超过80字');
      saved = false;
      return;
    }

    // 发送 API
    const result = await apiPut('/api/auth/me', { [key]: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      saved = false;
      return;
    }

    // 更新全局状态
    window._currentUser[key] = newValue;

    // 更新显示
    el.innerHTML = newValue
      ? escHtml(newValue)
      : '<span class="profile-field-empty">未填写</span>';
    el.dataset.editValue = newValue;
    el.classList.toggle('empty', !newValue);

    showToast('已更新');

    // 更新完整度
    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  }

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      saved = true; // 防止 blur 触发保存
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      el.dataset.editValue = currentValue;
    }
  });
}

function startMbtiSelect(el, currentValue) {
  const optionsHtml = MBTI_OPTIONS.map(m =>
    `<div class="profile-mbti-option ${m === currentValue ? 'selected' : ''}" data-value="${m}">${m}</div>`
  ).join('');

  el.innerHTML = `
    <div class="profile-mbti-dropdown">
      ${optionsHtml}
    </div>
  `;

  const dropdown = el.querySelector('.profile-mbti-dropdown');

  dropdown.addEventListener('click', async (e) => {
    const opt = e.target.closest('.profile-mbti-option');
    if (!opt) return;

    const newValue = opt.dataset.value;
    if (newValue === currentValue) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      return;
    }

    const result = await apiPut('/api/auth/me', { mbti: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      return;
    }

    window._currentUser.mbti = newValue;
    el.innerHTML = escHtml(newValue);
    el.dataset.editValue = newValue;
    el.classList.remove('empty');
    showToast('MBTI 已更新');

    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  });

  // 点击外部关闭
  const closeHandler = (e) => {
    if (!el.contains(e.target)) {
      el.innerHTML = currentValue
        ? escHtml(currentValue)
        : '<span class="profile-field-empty">未填写</span>';
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

function startGenderSelect(el, currentValue) {
  const genderDisplay = { male: '男', female: '女' };
  const optionsHtml = GENDER_OPTIONS.map(g =>
    `<div class="profile-mbti-option ${g.value === currentValue ? 'selected' : ''}" data-value="${g.value}">${g.text}</div>`
  ).join('');

  el.innerHTML = `
    <div class="profile-mbti-dropdown">
      ${optionsHtml}
    </div>
  `;

  const dropdown = el.querySelector('.profile-mbti-dropdown');

  dropdown.addEventListener('click', async (e) => {
    const opt = e.target.closest('.profile-mbti-option');
    if (!opt) return;

    const newValue = opt.dataset.value;
    if (newValue === currentValue) {
      el.innerHTML = genderDisplay[currentValue]
        ? escHtml(genderDisplay[currentValue])
        : '<span class="profile-field-empty">未填写</span>';
      return;
    }

    const result = await apiPut('/api/auth/me', { gender: newValue });
    if (result.error) {
      showToast('保存失败：' + result.error);
      return;
    }

    window._currentUser.gender = newValue;
    el.innerHTML = genderDisplay[newValue]
      ? escHtml(genderDisplay[newValue])
      : '<span class="profile-field-empty">未填写</span>';
    el.dataset.editValue = newValue;
    el.classList.toggle('empty', !newValue);
    showToast('性别已更新');

    const page = el.closest('.profile-page');
    if (page) updateCompletionBar(page, window._currentUser);
  });

  // 点击外部关闭
  const closeHandler = (e) => {
    if (!el.contains(e.target)) {
      el.innerHTML = genderDisplay[currentValue]
        ? escHtml(genderDisplay[currentValue])
        : '<span class="profile-field-empty">未填写</span>';
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/* =============================================
   关注 / 取关
   ============================================= */

async function handleFollow(btn) {
  const userId = btn.dataset.userId;
  btn.disabled = true;

  const result = await apiPost(`/api/user/${userId}/follow`, {});
  if (result.error) {
    showToast(result.error);
    btn.disabled = false;
    return;
  }

  showToast('已关注');
  navigateTo('profile-user', userId);
}

async function handleUnfollow(btn) {
  const userId = btn.dataset.userId;
  btn.disabled = true;

  const result = await apiDelete(`/api/user/${userId}/follow`);
  if (result.error) {
    showToast(result.error);
    btn.disabled = false;
    return;
  }

  showToast('已取消关注');
  navigateTo('profile-user', userId);
}

/* =============================================
   交换联系方式
   ============================================= */

async function showExchangeModal(userId) {
  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:var(--space-4);">
      <p style="color:var(--md-on-surface-variant);font-size:var(--text-sm);margin:0;">
        发送交换请求后，对方可以在通知中查看并决定是否同意。同意后双方可以看到彼此的联系方式。
      </p>
      ${createMdTextarea({
        id: 'exchange-message',
        label: '附带信息',
        rows: 3,
        placeholder: ' '
      })}
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="exchange-confirm-btn">
          <span class="mi">send</span> 发送请求
        </button>
      </div>
    </div>
  `;

  openModal('交换联系方式', bodyHtml);

  document.getElementById('exchange-confirm-btn').addEventListener('click', async () => {
    const btn = document.getElementById('exchange-confirm-btn');
    btn.disabled = true;

    const message = document.getElementById('exchange-message')?.value?.trim() || '';
    const result = await apiPost(`/api/user/${userId}/contact-exchange`, { message });

    if (result.error) {
      showToast(result.error);
      btn.disabled = false;
      return;
    }

    showToast('请求已发送');
    closeModal();
  });
}

/* =============================================
   粉丝 / 关注列表弹窗
   ============================================= */

async function showFollowList(container, userId, type) {
  const endpoint = type === 'followers'
    ? `/api/user/${userId}/followers`
    : `/api/user/${userId}/following`;

  const list = await apiGet(endpoint);
  if (list.error) {
    showToast('获取列表失败');
    return;
  }

  const title = type === 'followers' ? '粉丝列表' : '关注列表';

  if (!list.length) {
    showToast(type === 'followers' ? '暂无粉丝' : '暂未关注任何人');
    return;
  }

  const listHtml = list.map(u => `
    <div class="profile-follow-item" data-user-id="${u.id}">
      <div class="avatar-small">${(u.nickname || u.username || '?')[0]}</div>
      <div class="profile-follow-info">
        <div class="profile-follow-name">${escHtml(u.nickname || u.username || '未设置昵称')}</div>
        <div class="profile-follow-meta">${escHtml(u.major || '')} ${escHtml(u.grade || '')}</div>
      </div>
      <span class="mi profile-list-arrow">chevron_right</span>
    </div>
  `).join('');

  // 使用模态框显示
  openModal(title, `<div class="profile-follow-list">${listHtml}</div>`);

  // 绑定点击事件
  document.querySelectorAll('.profile-follow-item').forEach(item => {
    item.addEventListener('click', () => {
      const uid = item.dataset.userId;
      closeModal();
      if (String(uid) === String(window._currentUser?.id)) {
        previewMode = false;
        navigateTo('profile');
      } else {
        navigateTo('profile-user', uid);
      }
    });
  });
}

/* =============================================
   公开主页（查看他人）
   ============================================= */

async function renderPublicUserPage(container, userId) {
  // 从 URL 获取 userId
  const pathParts = location.pathname.split('/');
  const uid = userId || pathParts[pathParts.length - 1];

  if (!uid || isNaN(uid)) {
    container.innerHTML = renderNotFound();
    return;
  }

  // 如果是自己，跳转到自己的主页
  if (window._currentUser && String(window._currentUser.id) === String(uid)) {
    previewMode = false;
    navigateTo('profile');
    return;
  }

  try {
    const data = await fetchPublicUserData(uid);
    if (!data || data.error) {
      container.innerHTML = renderNotFound();
      return;
    }

    if (data.privacyHidden) {
      container.innerHTML = renderPrivacyLocked(data);
      bindProfileInteractions(container);
      return;
    }

    container.innerHTML = `
      <div class="profile-page">
        ${renderBackButton()}
        ${renderPublicProfileCard(data)}
      </div>
    `;
    animateProfile(container);
    bindProfileInteractions(container);
  } catch (err) {
    console.error('[Profile] 加载用户主页失败:', err);
    container.innerHTML = renderErrorCard(err.message);
  }
}

function renderPublicProfileCard(data) {
  const avatar = data.avatar_url
    ? `<img class="profile-avatar-img" src="${escHtml(data.avatar_url)}" alt="">`
    : `<span class="profile-avatar-letter">${(data.nickname || '?')[0]}</span>`;

  const followBtn = data.isFollowing
    ? `<button class="btn btn-secondary btn-compact profile-unfollow-btn" data-user-id="${data.id}">
        <span class="mi">person_remove</span> 取消关注
      </button>`
    : `<button class="btn btn-primary btn-compact profile-follow-btn" data-user-id="${data.id}">
        <span class="mi">person_add</span> 关注
      </button>`;

  const exchangeBtn = window._currentUser
    ? `<button class="btn btn-secondary btn-compact profile-exchange-btn" data-user-id="${data.id}">
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>`
    : '';

  const genderText = data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '';
  const fields = [
    { icon: 'school',      remixIcon: null,             label: '专业', value: data.major },
    { icon: 'class',       remixIcon: null,             label: '年级', value: data.grade },
    { icon: 'person',      remixIcon: null,             label: '性别', value: genderText },
    { icon: '',            remixIcon: 'ri-qq-fill',     label: 'QQ号', value: data.qq },
    { icon: '',            remixIcon: 'ri-wechat-fill', label: '微信号', value: data.wechat },
    { icon: '',            remixIcon: 'ri-tiktok-fill', label: '抖音号', value: data.douyin },
    { icon: 'face',        remixIcon: null,             label: '肖像', value: data.avatar_desc },
    { icon: 'psychology',  remixIcon: null,             label: 'MBTI', value: data.mbti },
  ];

  const fieldsHtml = fields.map(f => {
    if (!f.value) return '';
    const iconClass = f.remixIcon
      ? `${f.remixIcon} profile-field-icon remix-align`
      : 'mi profile-field-icon';
    const iconText = f.remixIcon ? '' : f.icon;
    return `
      <div class="profile-field-row">
        <span class="${iconClass}">${iconText}</span>
        <span class="profile-field-label">${f.label}</span>
        <span class="profile-field-value">${escHtml(f.value)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="profile-card profile-main-card">
      <div class="profile-header">
        <div class="profile-avatar">${avatar}</div>
        <div class="profile-identity">
          <div class="profile-name">${escHtml(data.nickname || '未设置昵称')}</div>
          <div class="profile-action-btns">
            ${window._currentUser ? followBtn : ''}
            ${exchangeBtn}
          </div>
        </div>
      </div>
      <div class="profile-fields">${fieldsHtml}</div>
      ${renderCommonCourses(data.commonCourses)}
      ${renderStatsRow(data)}
    </div>
  `;
}

function renderCommonCourses(courses = []) {
  if (!courses.length) return '';
  return `
    <div class="profile-common-courses">
      <div class="profile-common-title"><span class="mi">school</span>共同课程 ${courses.length} 门</div>
      <div class="profile-common-list">
        ${courses.map(course => `
          <button class="profile-common-course" onclick="navigateTo('course-detail', ${course.id})">
            ${escHtml(course.title)}${course.teacher ? `<span>${escHtml(course.teacher)}</span>` : ''}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPrivacyLocked(data) {
  const followBtn = data.isFollowing
    ? `<button class="btn btn-secondary btn-compact profile-unfollow-btn" data-user-id="${data.id}">
        <span class="mi">person_remove</span> 取消关注
      </button>`
    : `<button class="btn btn-primary btn-compact profile-follow-btn" data-user-id="${data.id}">
        <span class="mi">person_add</span> 关注
      </button>`;

  const exchangeBtn = window._currentUser
    ? `<button class="btn btn-secondary btn-compact profile-exchange-btn" data-user-id="${data.id}">
        <span class="mi">swap_horiz</span> 交换联系方式
      </button>`
    : '';

  return `
    <div class="profile-page">
      ${renderBackButton()}
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">lock</span>
        <h2 class="profile-empty-title">该用户已设置隐私</h2>
        <p class="profile-empty-desc">${escHtml(data.nickname || '该用户')} 暂未公开个人资料</p>
        <div class="profile-action-btns">
          ${window._currentUser ? followBtn : ''}
          ${exchangeBtn}
        </div>
      </div>
    </div>
  `;
}

function renderNotFound() {
  return `
    <div class="profile-page">
      ${renderBackButton()}
      <div class="profile-empty-card">
        <span class="mi profile-empty-icon">person_off</span>
        <h2 class="profile-empty-title">用户不存在</h2>
        <p class="profile-empty-desc">该用户可能已注销</p>
      </div>
    </div>
  `;
}

function renderBackButton() {
  return `
    <div class="profile-sub-header">
      <button class="btn-icon" onclick="history.back()">
        <span class="mi">arrow_back</span>
      </button>
      <span class="profile-breadcrumb">返回</span>
    </div>
  `;
}

/* =============================================
   子页面：编辑资料
   ============================================= */

async function renderEditPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  let data;
  try {
    data = await fetchProfileData();
  } catch (e) {
    console.error('[Profile] 加载编辑页失败:', e);
  }
  if (!data) data = window._currentUser;

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 编辑资料</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">基本资料</h2>
        ${createMdInput({ id: 'edit-nickname', label: '昵称', value: data.nickname || '', required: true })}
        ${createMdInput({ id: 'edit-major', label: '专业', value: data.major || '' })}
        ${createMdInput({ id: 'edit-grade', label: '年级', value: data.grade || '' })}
        ${createMdInput({ id: 'edit-qq', label: 'QQ号', value: data.qq || '' })}
        ${createMdInput({ id: 'edit-wechat', label: '微信号', value: data.wechat || '' })}
        ${createMdInput({ id: 'edit-douyin', label: '抖音号', value: data.douyin || '' })}
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">个性资料</h2>
        <div class="md-input-group">
          <textarea class="md-input" id="edit-avatar-desc" placeholder=" " rows="3" maxlength="80" style="resize:none">${escHtml(data.avatar_desc || '')}</textarea>
          <label class="md-label">个人肖像描述</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>个人肖像描述</span></legend></fieldset>
        </div>
        ${createMdSelect({
          id: 'edit-mbti',
          label: 'MBTI 人格',
          options: [
            { text: '请选择', value: '' },
            ...MBTI_OPTIONS.map(m => ({ text: m, value: m }))
          ],
          selected: data.mbti || ''
        })}
        ${createMdSelect({
          id: 'edit-gender',
          label: '性别',
          options: GENDER_OPTIONS,
          selected: data.gender || ''
        })}
      </div>

      <div class="profile-section">
        <button class="btn btn-primary btn-full" id="profile-save-btn">
          <span class="mi">save</span>
          保存修改
        </button>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定保存
  const saveBtn = document.getElementById('profile-save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveProfile);
  }
}

async function handleSaveProfile() {
  try {
    const nickname = document.getElementById('edit-nickname')?.value?.trim();
    if (!nickname) {
      showToast('昵称不能为空');
      return;
    }

    const updates = {
      nickname,
      major:    document.getElementById('edit-major')?.value?.trim() || '',
      grade:    document.getElementById('edit-grade')?.value?.trim() || '',
      qq:       document.getElementById('edit-qq')?.value?.trim() || '',
      wechat:   document.getElementById('edit-wechat')?.value?.trim() || '',
      douyin:   document.getElementById('edit-douyin')?.value?.trim() || '',
      avatar_desc: document.getElementById('edit-avatar-desc')?.value?.trim() || '',
      mbti:     document.getElementById('edit-mbti')?.value?.trim() || '',
      gender:   document.getElementById('edit-gender')?.value?.trim() || '',
    };

    const btn = document.getElementById('profile-save-btn');
    if (btn) btn.disabled = true;

    const result = await apiPut('/api/auth/me', updates);
    if (result.error) {
      showToast('保存失败：' + result.error);
      if (btn) btn.disabled = false;
      return;
    }

    window._currentUser = result;
    showToast('资料已保存');
    navigateTo('profile');
  } catch (err) {
    console.error('[Profile] 保存失败:', err);
    showToast('保存异常：' + (err.message || '未知错误'));
    const btn = document.getElementById('profile-save-btn');
    if (btn) btn.disabled = false;
  }
}

/* =============================================
   子页面：隐私与安全
   ============================================= */

async function renderPrivacyPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  const user = window._currentUser;
  const showFollowing = user.privacy_show_following !== 0;
  const showFollowers = user.privacy_show_followers !== 0;

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 隐私与安全</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">隐私设置</h2>

        <div class="profile-toggle-row" data-field="privacy_show_following">
          <div class="profile-toggle-info">
            <span class="mi profile-toggle-icon">visibility</span>
            <div>
              <div class="profile-toggle-title">允许其他人查看关注列表</div>
              <div class="profile-toggle-desc">其他用户可以查看你的关注列表</div>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-show-following" ${showFollowing ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="profile-toggle-row" data-field="privacy_show_followers">
          <div class="profile-toggle-info">
            <span class="mi profile-toggle-icon">group</span>
            <div>
              <div class="profile-toggle-title">允许其他人查看粉丝列表</div>
              <div class="profile-toggle-desc">其他用户可以查看你的粉丝列表</div>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-show-followers" ${showFollowers ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定开关
  document.getElementById('toggle-show-following').addEventListener('change', (e) => {
    handlePrivacyToggle('privacy_show_following', e.target.checked);
  });
  document.getElementById('toggle-show-followers').addEventListener('change', (e) => {
    handlePrivacyToggle('privacy_show_followers', e.target.checked);
  });
}

async function handlePrivacyToggle(field, value) {
  const result = await apiPut('/api/auth/me', { [field]: value });
  if (result.error) {
    showToast('设置失败：' + result.error);
    return;
  }
  window._currentUser = result;
  showToast(value ? '已开启' : '已关闭');
}

/* =============================================
   子页面：管理我的数据
   ============================================= */

async function renderDataPage(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  const user = window._currentUser;
  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('zh-CN')
    : '未知';
  const completion = calcCompletion(user);

  container.innerHTML = `
    <div class="profile-page">
      <div class="profile-sub-header">
        <button class="btn-icon" onclick="navigateTo('profile')">
          <span class="mi">arrow_back</span>
        </button>
        <span class="profile-breadcrumb">个人空间 <span class="mi breadcrumb-sep">chevron_right</span> 管理我的数据</span>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">数据概览</h2>
        <div class="profile-data-grid">
          <div class="profile-data-item">
            <span class="mi profile-data-icon">calendar_today</span>
            <div class="profile-data-label">注册时间</div>
            <div class="profile-data-value">${joinDate}</div>
          </div>
          <div class="profile-data-item">
            <span class="mi profile-data-icon">assessment</span>
            <div class="profile-data-label">资料完整度</div>
            <div class="profile-data-value">${completion.percent}%</div>
          </div>
          <div class="profile-data-item">
            <span class="mi profile-data-icon">local_fire_department</span>
            <div class="profile-data-label">连续签到</div>
            <div class="profile-data-value">${user.checkin_streak || 0} 天</div>
          </div>
        </div>
      </div>

      <div class="profile-card">
        <h2 class="profile-section-title">操作</h2>
        <div class="profile-list-item" id="btn-export-data">
          <span class="mi profile-list-icon">download</span>
          <div class="profile-list-content">
            <div class="profile-list-title">下载个人信息</div>
            <div class="profile-list-desc">导出你的账号数据副本</div>
          </div>
          <span class="mi profile-list-arrow">chevron_right</span>
        </div>
        <div class="profile-list-item danger" id="btn-delete-account">
          <span class="mi profile-list-icon">delete_forever</span>
          <div class="profile-list-content">
            <div class="profile-list-title">注销账号</div>
            <div class="profile-list-desc">永久删除你的账号和所有数据</div>
          </div>
          <span class="mi profile-list-arrow">chevron_right</span>
        </div>
      </div>
    </div>
  `;

  animIn(container.querySelector('.profile-card'));

  // 绑定导出
  document.getElementById('btn-export-data')?.addEventListener('click', handleExportData);
  // 绑定注销
  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    showToast('注销功能暂未开放，如需注销请联系管理员');
  });
}

function handleExportData() {
  const user = window._currentUser;
  if (!user) return;

  const data = {
    导出时间: new Date().toISOString(),
    用户ID: user.id,
    邮箱: user.email,
    昵称: user.nickname,
    专业: user.major,
    年级: user.grade,
    QQ号: user.qq,
    微信号: user.wechat,
    抖音号: user.douyin,
    肖像描述: user.avatar_desc,
    MBTI: user.mbti,
    连续签到: user.checkin_streak,
    注册时间: user.created_at,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `课搭子_个人数据_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
}

/* =============================================
   子页面：问题反馈（模态框）
   ============================================= */

// 反馈通过设置列表的 page='profile-feedback' 触发
// 在 bindProfileInteractions 中处理

export async function showFeedbackModal() {
  const html = `
    <div class="profile-feedback-form">
      ${createMdSelect({
        id: 'feedback-category',
        label: '反馈类型',
        options: [
          { text: '功能异常', value: 'bug' },
          { text: '体验建议', value: 'suggestion' },
          { text: '其他问题', value: 'other' },
        ],
        selected: 'bug'
      })}
      <div class="md-input-group">
        <textarea class="md-input" id="feedback-content" placeholder=" " rows="5" required style="resize:none"></textarea>
        <label class="md-label">详细描述</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>详细描述</span></legend></fieldset>
      </div>
      ${createMdInput({ id: 'feedback-contact', label: '联系方式（选填）', placeholder: ' ' })}
      <button class="btn btn-primary btn-full" id="feedback-submit-btn">
        <span class="mi">send</span>
        提交反馈
      </button>
    </div>
  `;

  openModal('问题反馈', html);

  document.getElementById('feedback-submit-btn')?.addEventListener('click', async () => {
    const content = document.getElementById('feedback-content')?.value?.trim();
    if (!content) {
      showToast('请填写反馈内容');
      return;
    }

    const category = document.getElementById('feedback-category')?.value || 'bug';
    const contact = document.getElementById('feedback-contact')?.value?.trim() || '';

    const btn = document.getElementById('feedback-submit-btn');
    if (btn) btn.disabled = true;

    const result = await apiPost('/api/user/feedback', { category, content, contact });
    if (result.error) {
      showToast('提交失败：' + result.error);
      if (btn) btn.disabled = false;
      return;
    }

    showToast('反馈已提交，感谢你的反馈！');
    closeModal();
  });
}

/* =============================================
   退出预览模式（全局函数）
   ============================================= */

window._exitProfilePreview = function () {
  previewMode = false;
  navigateTo('profile');
};

/* =============================================
   导出（供 main.js 注册）
   ============================================= */

// 旧版兼容导出
export async function openEditProfileModal() {
  navigateTo('profile-edit');
}

export async function handleEditProfile(e) {
  // 旧版兼容，重定向到新页面
  navigateTo('profile-edit');
}

export async function handlePrivacyChange(field, value) {
  return handlePrivacyToggle(field, value);
}

// 新版导出
export { handleCheckin, handleSaveProfile, handlePrivacyToggle };
