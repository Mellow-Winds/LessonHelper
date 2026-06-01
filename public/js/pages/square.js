/**
 * pages/square.js — 交友广场 + 自习邀约
 * registerPage: invites, invites-my, square, square-my, square-post
 */

import { apiGet, apiPost, apiPut, apiDelete } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, formatTime } from '../components/ui.js';

/* =============================================
   Page: Invites (自习邀约)
   ============================================= */

registerPage('invites', async (container) => {
  if (!window._currentUser) {
    await window.loadCurrentUser();
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
      ${createMdSelect({
        id: 'invite-filter-date',
        options: [
          { text: '全部日期', value: 'all' },
          { text: '今天', value: 'today' },
          { text: '近7天', value: 'week' }
        ],
        style: 'width:auto;min-width:100px;margin-bottom:0',
        onchange: 'refreshInvites()'
      })}
      ${createMdSelect({
        id: 'invite-filter-status',
        options: [
          { text: '全部状态', value: 'all' },
          { text: '招募中', value: 'open' },
          { text: '已满', value: 'full' },
          { text: '已关闭', value: 'closed' }
        ],
        style: 'width:auto;min-width:100px;margin-bottom:0',
        onchange: 'refreshInvites()'
      })}
    </div>
    <div id="invites-list"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  await refreshInvites();
});

export async function refreshInvites() {
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

export async function respondInvite(inviteId, action) {
  const result = await apiPost(`/api/invites/${inviteId}/respond`, { action });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(result.message);
  await refreshInvites();
}

export async function cancelInvite(inviteId) {
  if (!confirm('确定取消这个邀约？')) return;
  const result = await apiDelete(`/api/invites/${inviteId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('已取消');
  await refreshInvites();
}

export function openCreateInviteModal() {
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

export async function handleCreateInvite(e) {
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

/* ===== 我的邀约 ===== */

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

export async function switchMyTab(type) {
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

/* =============================================
   Page: Square (交友广场)
   ============================================= */

const SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];

registerPage('square', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">请先登录后浏览交友广场</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">交友广场</h1>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="navigateTo('square-my')">
          <span class="mi">person</span> 我的
        </button>
        <button class="btn btn-primary" onclick="openCreateSquarePostModal()">
          <span class="mi">add</span> 发帖
        </button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
      ${createMdSelect({
        id: 'square-filter-category',
        options: [{ text: '全部类型', value: 'all' }, ...SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))],
        style: 'width:auto;min-width:120px;margin-bottom:0',
        onchange: 'refreshSquarePosts()'
      })}
    </div>
    <div id="square-posts-list"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
  await refreshSquarePosts();
});

export async function refreshSquarePosts() {
  const category = document.getElementById('square-filter-category')?.value || 'all';
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);

  const listEl = document.getElementById('square-posts-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/square/posts?${params.toString()}`);
    const posts = data?.posts || [];
    if (listEl) listEl.innerHTML = renderSquarePosts(posts);
    const cards = listEl?.querySelectorAll('.square-post-card');
    if (cards?.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  } catch {
    if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

function renderSquarePosts(posts) {
  if (posts.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">explore</span>
        <p class="text-secondary" style="margin-top:12px">暂无帖子，来发布第一个吧</p>
      </div>
    `;
  }

  const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
  const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

  return posts.map(p => `
    <div class="card square-post-card" onclick="navigateTo('square-post', ${p.id})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <h3 style="font-size:var(--text-lg);font-weight:600">${escHtml(p.title)}</h3>
            <span class="square-category-tag">${escHtml(p.category)}</span>
            <span class="status-badge ${statusClass[p.status] || ''}">${statusMap[p.status] || p.status}</span>
          </div>
          ${p.description ? `<p style="margin-top:6px;font-size:14px;color:var(--md-on-surface-variant);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(p.description)}</p>` : ''}
          <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">people</span> ${p.confirmed_count || 0}/${p.max_people}人</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">schedule</span> 剩余 ${p.remaining_days} 天</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> ${escHtml(p.creator_name)}</span>
          </div>
          ${p.my_status ? `<div style="margin-top:6px;font-size:12px;color:var(--md-primary);font-weight:500">你: ${p.my_status === 'pending' ? '已申请，等待确认' : p.my_status === 'accepted' ? '已通过' : '已拒绝'}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

export function openCreateSquarePostModal() {
  const html = `
    <form id="create-square-form" onsubmit="handleCreateSquarePost(event)" style="display:flex;flex-direction:column;gap:16px">
      <div class="md-input-group">
        <input class="md-input" name="title" placeholder=" " required>
        <label class="md-label">标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>标题</span></legend></fieldset>
      </div>
      <div>
        ${createMdSelect({
          id: 'square-category',
          label: '需求类型',
          options: SQUARE_CATEGORIES.map(c => ({ text: c, value: c })),
        })}
      </div>
      <div class="md-input-group">
        <textarea class="md-input md-textarea" name="description" placeholder=" " rows="3"></textarea>
        <label class="md-label">详细描述</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>详细描述</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" type="number" name="max_people" value="2" min="1" max="20" placeholder=" ">
        <label class="md-label">期望人数</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>期望人数</span></legend></fieldset>
      </div>
      <div class="form-error" id="create-square-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">发布</button>
    </form>
  `;
  openModal('发布交友帖', html);
}

export async function handleCreateSquarePost(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('create-square-error');

  const data = {
    title: form.title.value.trim(),
    category: document.getElementById('square-category')?.value || '',
    description: form.description.value.trim(),
    max_people: Number(form.max_people.value) || 1,
  };

  if (!data.category) {
    if (errEl) { errEl.textContent = '请选择需求类型'; errEl.style.display = 'block'; }
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

  closeModal();
  showToast('发布成功');
  await refreshSquarePosts();
}

/* =============================================
   Page: Square Post Detail
   ============================================= */

registerPage('square-post', async (container, postId) => {
  container.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  window._squarePostId = postId;

  try {
    const data = await apiGet(`/api/square/posts/${postId}`);
    if (data.error) { container.innerHTML = `<div class="card"><p class="text-secondary">${data.error}</p></div>`; return; }

    const isCreator = data.creator_id === window._currentUser?.id;
    const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
    const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('square')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title" style="margin:0">${escHtml(data.title)}</h1>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
          <span class="square-category-tag">${escHtml(data.category)}</span>
          <span class="status-badge ${statusClass[data.status] || ''}">${statusMap[data.status] || data.status}</span>
        </div>
        <p style="white-space:pre-wrap;line-height:1.6">${escHtml(data.description) || '无描述'}</p>
        <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;font-size:14px;color:var(--md-on-surface-variant)">
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> ${data.confirmed?.length || 0}/${data.max_people}人</span>
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">schedule</span> 剩余 ${data.remaining_days} 天</span>
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">person</span> ${escHtml(data.creator_name)}${data.creator_major ? ' · ' + escHtml(data.creator_major) : ''}${data.creator_grade ? ' · ' + escHtml(data.creator_grade) : ''}</span>
        </div>
        ${!isCreator ? renderSquareAction(data) : ''}
      </div>

      ${isCreator ? renderSquareCreatorPanel(data) : ''}

      ${data.confirmed && data.confirmed.length > 0 ? `
        <div class="card" style="margin-bottom:16px">
          <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">check_circle</span> 已确认成员</h3>
          ${data.confirmed.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${data.confirmed.indexOf(m) > 0 ? 'border-top:1px solid var(--md-outline-variant)' : ''}">
              <div class="avatar-small">${(m.nickname || '?')[0]}</div>
              <div style="flex:1">
                <div style="font-weight:500">${escHtml(m.nickname)}</div>
                ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
              </div>
              ${m.qq ? `<div style="font-size:13px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:14px;vertical-align:-2px" data-icon="qq">qq</span> QQ: ${escHtml(m.qq)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">chat</span> 评论</h3>
        <div id="square-comments-${postId}"><p class="text-secondary" style="font-size:12px">加载中...</p></div>
        ${window._currentUser ? `
          <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-start">
            ${createMdInput({
              id: `square-comment-input-${postId}`,
              label: '写评论',
              style: 'flex:1;margin-bottom:0',
              placeholder: ' '
            })}
            <button class="btn btn-primary" style="font-size:13px;padding:6px 14px;height:56px" onclick="submitSquareComment(${postId})">发送</button>
          </div>
        ` : ''}
      </div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.card'), { y: 16, dur: 380 });

    loadSquareComments(postId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

function renderSquareAction(data) {
  if (data.my_status === 'accepted') {
    return '<div style="margin-top:12px;padding:10px;background:#e8f5e9;border-radius:8px;font-size:14px;color:#2e7d32;font-weight:500"><span class="mi" style="font-size:16px;vertical-align:-3px">check_circle</span> 你的申请已通过，可查看联系方式</div>';
  }
  if (data.my_status === 'pending') {
    return '<div style="margin-top:12px"><button class="btn btn-secondary" disabled>已申请，等待确认</button></div>';
  }
  if (data.my_status === 'rejected') {
    return '<div style="margin-top:12px;padding:10px;background:#fce4ec;border-radius:8px;font-size:14px;color:#c62828">你的申请未通过</div>';
  }
  if (data.status !== 'open') {
    return '<div style="margin-top:12px"><button class="btn btn-secondary" disabled>暂不接受申请</button></div>';
  }
  return `<div style="margin-top:12px"><button class="btn btn-primary" onclick="submitSquareInterest(${data.id})"><span class="mi" style="font-size:16px">favorite</span> 感兴趣</button></div>`;
}

function renderSquareCreatorPanel(data) {
  if (!data.pending || data.pending.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">pending</span> 待处理申请 (${data.pending.length})</h3>
      ${data.pending.map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${data.pending.indexOf(p) > 0 ? 'border-top:1px solid var(--md-outline-variant)' : ''}">
          <div class="avatar-small">${(p.nickname || '?')[0]}</div>
          <div style="flex:1">
            <div style="font-weight:500">${escHtml(p.nickname)}</div>
            ${(p.major || p.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([p.major, p.grade].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary" style="font-size:12px;padding:4px 12px" onclick="handleSquareInterest(${p.interest_id}, 'accept')">接受</button>
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" onclick="handleSquareInterest(${p.interest_id}, 'reject')">拒绝</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export async function submitSquareInterest(postId) {
  const result = await apiPost(`/api/square/posts/${postId}/interest`, {});
  if (result.error) { showToast(result.error); return; }
  showToast('已申请');
  navigateTo('square-post', postId);
}

export async function handleSquareInterest(interestId, action) {
  const result = await apiPut(`/api/square/interests/${interestId}`, { action });
  if (result.error) { showToast(result.error); return; }
  showToast(action === 'accept' ? '已接受' : '已拒绝');
  const postId = window._squarePostId;
  if (postId) navigateTo('square-post', postId);
  else navigateTo('square');
}

async function loadSquareComments(postId) {
  const el = document.getElementById(`square-comments-${postId}`);
  if (!el) return;
  try {
    const comments = await apiGet(`/api/square/posts/${postId}/comments`);
    if (comments.length === 0) {
      el.innerHTML = '<p class="text-secondary" style="font-size:12px">暂无评论</p>';
    } else {
      el.innerHTML = comments.map(c => `
        <div style="padding:8px 0;${comments.indexOf(c) > 0 ? 'border-top:1px solid var(--md-outline-variant)' : ''}">
          <div style="font-size:13px"><strong>${escHtml(c.author_name)}</strong> · ${formatTime(c.created_at)}</div>
          <div style="font-size:14px;margin-top:4px;white-space:pre-wrap">${escHtml(c.content)}</div>
        </div>
      `).join('');
    }
  } catch { el.innerHTML = '<p class="text-secondary" style="font-size:12px">加载失败</p>'; }
}

export async function submitSquareComment(postId) {
  const input = document.getElementById(`square-comment-input-${postId}`);
  const content = input?.value?.trim();
  if (!content) return;

  const result = await apiPost(`/api/square/posts/${postId}/comments`, { content });
  if (result.error) { showToast(result.error); return; }
  input.value = '';
  await loadSquareComments(postId);
}

/* =============================================
   Page: Square My
   ============================================= */

registerPage('square-my', async (container) => {
  if (!window._currentUser) {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">请先登录</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('square')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title">我的广场</h1>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary tab-btn active" id="square-tab-created" onclick="switchSquareMyTab('created')">我发起的</button>
      <button class="btn btn-secondary tab-btn" id="square-tab-interested" onclick="switchSquareMyTab('interested')">我感兴趣的</button>
    </div>
    <div id="square-my-list"></div>
  `;

  bindRipples(container);
  await loadSquareMyPosts('created');
});

export async function switchSquareMyTab(type) {
  document.getElementById('square-tab-created')?.classList.toggle('active', type === 'created');
  document.getElementById('square-tab-created')?.classList.toggle('btn-primary', type === 'created');
  document.getElementById('square-tab-created')?.classList.toggle('btn-secondary', type !== 'created');
  document.getElementById('square-tab-interested')?.classList.toggle('active', type === 'interested');
  document.getElementById('square-tab-interested')?.classList.toggle('btn-primary', type === 'interested');
  document.getElementById('square-tab-interested')?.classList.toggle('btn-secondary', type !== 'interested');
  await loadSquareMyPosts(type);
}

async function loadSquareMyPosts(type) {
  const listEl = document.getElementById('square-my-list');
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const posts = await apiGet(`/api/square/my?type=${type}`);
    if (!posts || posts.length === 0) {
      const msg = type === 'created' ? '你还没有发布过帖子' : '你还没有感兴趣的帖子';
      listEl.innerHTML = `<div class="card" style="text-align:center;padding:48px"><p class="text-secondary">${msg}</p></div>`;
      return;
    }
    listEl.innerHTML = posts.map(p => {
      const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
      const extra = type === 'created'
        ? `<span style="font-size:12px;color:var(--md-on-surface-variant)"><span class="mi" style="font-size:14px;vertical-align:-2px">pending</span> ${p.pending_count || 0} 待处理</span>`
        : `<span style="font-size:12px;color:var(--md-primary);font-weight:500">${p.my_status === 'pending' ? '等待确认' : p.my_status === 'accepted' ? '已通过' : '已拒绝'}</span>`;
      return `
        <div class="card square-post-card" onclick="navigateTo('square-post', ${p.id})" style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:600">${escHtml(p.title)}</span>
              <span class="square-category-tag" style="margin-left:8px">${escHtml(p.category)}</span>
            </div>
            ${extra}
          </div>
        </div>
      `;
    }).join('');
  } catch {
    listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}
