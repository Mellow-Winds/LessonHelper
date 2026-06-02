/**
 * explore/posts.js — 统一发布子网页
 * 多模式发布状态机：交友 / 自习邀约
 * 独立路由 explore-posts，由 explore.js 懒加载
 */

import { apiGet, apiPost } from '../../core/api.js';
import { navigateTo, animIn, bindRipples } from '../../core/router.js';
import { showToast, createMdInput, createMdTextarea, createMdSelect, escHtml, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';

/* =============================================
   Constants
   ============================================= */

const SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00',
];

/* =============================================
   Render — 发布主面板
   ============================================= */

export async function renderPosts(container) {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title" style="margin:0">发布</h1>
      </div>
    </div>
    <div class="md-tabs" id="post-mode-tabs">
      <button class="md-tab-btn active" data-post-mode="square">交友</button>
      <button class="md-tab-btn" data-post-mode="invite">自习邀约</button>
    </div>
    <div id="post-form-container" class="post-form-container"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 绑定模式切换
  container.querySelectorAll('#post-mode-tabs .md-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPostMode(btn.dataset.postMode, container));
  });

  // 渲染默认模式
  await renderModeForm('square');
}

/* =============================================
   switchPostMode — 切换发布模式
   ============================================= */

async function switchPostMode(mode, container) {
  document.querySelectorAll('#post-mode-tabs .md-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.postMode === mode);
  });
  await renderModeForm(mode);
}

/* =============================================
   renderModeForm — 渲染对应模式的表单
   ============================================= */

async function renderModeForm(mode) {
  const formEl = document.getElementById('post-form-container');
  if (!formEl) return;

  formEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';

  if (mode === 'square') {
    formEl.innerHTML = buildSquareForm();
    bindSquareForm();
  } else if (mode === 'invite') {
    await renderInviteForm(formEl);
  }
}

/* =============================================
   模式 A — 交友发布卡片
   ============================================= */

function buildSquareForm() {
  return `
    <form id="post-square-form" class="post-form" data-post-type="square">
      ${createMdInput({ id: 'post-title', label: '标题', placeholder: ' ', required: true, attrs: 'maxlength="15"' })}
      ${createMdTextarea({ id: 'post-description', label: '详细描述', rows: 4 })}
      <div>
        ${createMdSelect({
          id: 'post-category',
          label: '搭子类型',
          options: SQUARE_CATEGORIES.map(c => ({ text: c, value: c })),
        })}
      </div>

      <div class="post-field-group">
        <label class="post-field-label">搭子倾向标签</label>
        <div class="post-chips-container" id="post-chips">
          <div class="post-chips-list" id="post-chips-list"></div>
          <div class="post-chip-add" id="post-chip-add">
            <span class="mi" style="font-size:18px">add</span>
          </div>
          <input type="text" class="post-chip-input" id="post-chip-input" placeholder="输入标签，回车确认" style="display:none">
        </div>
        <input type="hidden" id="post-tags" name="tags" value="[]">
      </div>

      <div class="post-field-group">
        <label class="post-field-label">附加个人名片</label>
        <label class="post-switch-row">
          <span class="post-switch-text">允许他人查看你的公开主页</span>
          <span class="toggle-switch">
            <input type="checkbox" id="post-show-profile" checked>
            <span class="toggle-slider"></span>
          </span>
        </label>
      </div>

      <div class="post-field-group">
        <label class="post-field-label">联系渠道可见性</label>
        <div class="post-radio-group">
          <label class="post-radio-item">
            <input type="radio" name="contact-visibility" value="public" checked>
            <span class="post-radio-label">公开展示联系方式</span>
          </label>
          <label class="post-radio-item">
            <input type="radio" name="contact-visibility" value="login_only">
            <span class="post-radio-label">仅登录同学可见</span>
          </label>
        </div>
      </div>

      <div class="form-error" id="post-square-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary btn-full">发布</button>
    </form>
  `;
}

function bindSquareForm() {
  const form = document.getElementById('post-square-form');
  if (!form) return;

  // Chips 系统
  const addBtn = document.getElementById('post-chip-add');
  const chipInput = document.getElementById('post-chip-input');
  const chipsList = document.getElementById('post-chips-list');
  const tagsInput = document.getElementById('post-tags');
  const tags = [];

  function renderChips() {
    chipsList.innerHTML = tags.map((tag, i) => `
      <span class="post-chip">
        ${escHtml(tag)}
        <span class="post-chip-remove" data-index="${i}"><span class="mi" style="font-size:14px">close</span></span>
      </span>
    `).join('');
    tagsInput.value = JSON.stringify(tags);
  }

  addBtn.addEventListener('click', () => {
    addBtn.style.display = 'none';
    chipInput.style.display = 'block';
    chipInput.focus();
  });

  chipInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = chipInput.value.trim();
      if (val && !tags.includes(val) && tags.length < 8) {
        tags.push(val);
        renderChips();
      }
      chipInput.value = '';
    }
    if (e.key === 'Escape') {
      chipInput.value = '';
      chipInput.style.display = 'none';
      addBtn.style.display = 'flex';
    }
  });

  chipInput.addEventListener('blur', () => {
    const val = chipInput.value.trim();
    if (val && !tags.includes(val) && tags.length < 8) {
      tags.push(val);
      renderChips();
    }
    chipInput.value = '';
    chipInput.style.display = 'none';
    addBtn.style.display = 'flex';
  });

  chipsList.addEventListener('click', (e) => {
    const rm = e.target.closest('.post-chip-remove');
    if (rm) {
      tags.splice(Number(rm.dataset.index), 1);
      renderChips();
    }
  });

  // 表单提交
  form.addEventListener('submit', handleSquareSubmit);
}

async function handleSquareSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('post-square-error');

  const tags = JSON.parse(document.getElementById('post-tags')?.value || '[]');
  const data = {
    title: document.getElementById('post-title')?.value?.trim() || '',
    category: document.getElementById('post-category')?.value || '',
    description: document.getElementById('post-description')?.value?.trim() || '',
    max_people: 2,
    tags,
    show_profile: document.getElementById('post-show-profile')?.checked ?? true,
    contact_visibility: document.querySelector('input[name="contact-visibility"]:checked')?.value || 'public',
  };

  if (!data.title) {
    if (errEl) { errEl.textContent = '请输入标题'; errEl.style.display = 'block'; }
    return;
  }
  if (!data.category) {
    if (errEl) { errEl.textContent = '请选择搭子类型'; errEl.style.display = 'block'; }
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '发布中...';

  const result = await apiPost('/api/square/posts', data);

  if (result.error) {
    if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '发布';
    return;
  }

  showToast('发布成功');
  navigateTo('explore');
}

/* =============================================
   模式 B — 自习邀约卡片
   ============================================= */

async function renderInviteForm(formEl) {
  // 加载用户课程
  let courseOptions = [{ text: '不关联课程', value: '' }];
  try {
    const courses = await apiGet('/api/courses');
    if (Array.isArray(courses)) {
      courseOptions = [
        { text: '不关联课程', value: '' },
        ...courses.map(c => ({ text: c.title || `课程${c.id}`, value: String(c.id) })),
      ];
    }
  } catch { /* fallback to empty */ }

  const today = new Date().toISOString().split('T')[0];
  const dateOptions = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const val = d.toISOString().split('T')[0];
    const label = i === 0 ? '今天' : i === 1 ? '明天' : `${d.getMonth() + 1}月${d.getDate()}日`;
    dateOptions.push({ text: label, value: val });
  }

  const startTimeSlots = TIME_SLOTS.slice(0, -1).map(t => ({ text: t, value: t }));
  const endTimeSlots = TIME_SLOTS.slice(1).map(t => ({ text: t, value: t }));

  formEl.innerHTML = `
    <form id="post-invite-form" class="post-form" data-post-type="invite">
      ${createMdInput({ id: 'invite-title', label: '自习主题', placeholder: ' ', required: true, attrs: 'maxlength="15"' })}
      <div>
        ${createMdSelect({ id: 'invite-course', label: '关联课程', options: courseOptions })}
      </div>
      ${createMdInput({ id: 'invite-location', label: '自习地点', placeholder: ' ' })}
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          ${createMdSelect({ id: 'invite-date', label: '日期', options: dateOptions, selected: today })}
        </div>
        <div style="flex:1">
          ${createMdSelect({ id: 'invite-start', label: '开始时间', options: startTimeSlots, selected: '14:00' })}
        </div>
        <div style="flex:1">
          ${createMdSelect({ id: 'invite-end', label: '结束时间', options: endTimeSlots, selected: '17:00' })}
        </div>
      </div>
      ${createMdTextarea({ id: 'invite-requirements', label: '详细搭子要求', rows: 3 })}
      <div class="form-error" id="post-invite-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary btn-full">发布邀约</button>
    </form>
  `;

  const form = document.getElementById('post-invite-form');
  if (form) form.addEventListener('submit', handleInviteSubmit);
}

async function handleInviteSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('post-invite-error');

  const courseId = document.getElementById('invite-course')?.value || '';
  const data = {
    title: document.getElementById('invite-title')?.value?.trim() || '',
    description: document.getElementById('invite-requirements')?.value?.trim() || '',
    study_date: document.getElementById('invite-date')?.value || '',
    start_time: document.getElementById('invite-start')?.value || '',
    end_time: document.getElementById('invite-end')?.value || '',
    location: document.getElementById('invite-location')?.value?.trim() || '',
    max_participants: 4,
    ...(courseId ? { course_id: Number(courseId) } : {}),
  };

  if (!data.title) {
    if (errEl) { errEl.textContent = '请输入自习主题'; errEl.style.display = 'block'; }
    return;
  }
  if (data.start_time >= data.end_time) {
    if (errEl) { errEl.textContent = '结束时间必须晚于开始时间'; errEl.style.display = 'block'; }
    return;
  }

  const btn = document.querySelector('#post-invite-form button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '发布中...';

  const result = await apiPost('/api/invites', data);

  if (result.error) {
    if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '发布邀约';
    return;
  }

  showToast('发布成功');
  navigateTo('explore');
}
