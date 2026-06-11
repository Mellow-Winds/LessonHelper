/**
 * explore/square.js — 交友广场子模块
 * 仅负责：广场帖子列表渲染、发帖、筛选、帖子详情、评论
 * 由 explore.js 动态调用，不注册全局路由
 */

import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn, getToken } from '../../core/api.js';
import { navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { showToast, createMdInput, createMdSelect, escHtml, formatTime, openModal, closeModal, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';
import { renderTkComment, renderTkInputArea, toggleLike, getLikedSet, bindTkCommentEvents, getTkImages, clearTkImages, getTkReplyImages, clearTkReplyImages, renderTkPreviews, renderTkReplyPreviews } from '../../components/tk-comments.js';

/* =============================================
   Constants
   ============================================= */

const SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];

/* =============================================
   Render — 渲染广场列表面板
   ============================================= */

export async function renderSquare(container) {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="form-row" style="margin-bottom:16px;flex-wrap:wrap">
      ${createMdSelect({
        id: 'square-filter-category',
        options: [{ text: '全部类型', value: 'all' }, ...SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))],
        style: 'width:auto;min-width:120px;margin-bottom:0'
      })}
    </div>
    <div id="square-posts-list"></div>
  `;

  document.getElementById('square-filter-category-container')?.addEventListener('md-select-change', refreshSquarePosts);

  await refreshSquarePosts();
}

/* =============================================
   Bind — 事件绑定（事件委托，只绑一次）
   ============================================= */

export function bindSquareEvents(container) {
  if (container._squareBound) return;
  container._squareBound = true;
}

/* =============================================
   Data — 数据加载
   ============================================= */

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
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> <button class="user-profile-link" onclick="event.stopPropagation();navigateTo('profile-user', ${p.creator_id})">${escHtml(p.creator_name)}</button></span>
          </div>
          ${p.my_status ? `<div style="margin-top:6px;font-size:12px;color:var(--md-primary);font-weight:500">你: ${p.my_status === 'pending' ? '已申请，等待确认' : p.my_status === 'accepted' ? '已通过' : '已拒绝'}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* =============================================
   帖子详情（独立路由 square-post）
   ============================================= */

export async function renderSquarePost(container, postId) {
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
        <button class="btn-icon" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
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
          <span><span class="mi" style="font-size:16px;vertical-align:-3px">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${data.creator_id})">${escHtml(data.creator_name)}</button>${data.creator_major ? ' · ' + escHtml(data.creator_major) : ''}${data.creator_grade ? ' · ' + escHtml(data.creator_grade) : ''}</span>
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
                <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">${escHtml(m.nickname)}</button>
                ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
              </div>
              ${m.qq ? `<div style="font-size:13px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:14px;vertical-align:-2px" data-icon="qq">qq</span> QQ: ${escHtml(m.qq)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">chat</span> 评论</h3>
        <div id="sq-comments-${postId}"></div>
      </div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.card'), { y: 16, dur: 380 });

    toggleSqComments(postId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
}

function renderSquareAction(data) {
  if (data.my_status === 'accepted') {
    return '<div class="square-status-msg square-status-accepted"><span class="mi" style="font-size:16px;vertical-align:-3px">check_circle</span> 你的申请已通过，可查看联系方式</div>';
  }
  if (data.my_status === 'pending') {
    return '<div style="margin-top:12px"><button class="btn btn-secondary" disabled>已申请，等待确认</button></div>';
  }
  if (data.my_status === 'rejected') {
    return '<div class="square-status-msg square-status-rejected">你的申请未通过</div>';
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
            <button class="user-profile-link" onclick="navigateTo('profile-user', ${p.user_id})">${escHtml(p.nickname)}</button>
            ${(p.major || p.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([p.major, p.grade].filter(Boolean).join(' · '))}</div>` : ''}
          </div>
          <div class="inline-btn-group" style="display:flex;gap:6px">
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
  else navigateTo('explore');
}

/* =============================================
   广场评论系统（课程论坛风格：内联编辑器 + 事件委托）
   ============================================= */

const TK_SQ_LIKE_KEY = 'square_liked_comments';
const _sqLikedSet = getLikedSet(TK_SQ_LIKE_KEY);

let _sqCommentsCache = {};  // postId → { comments }

function getSqCache(postId) {
  if (!_sqCommentsCache[postId]) _sqCommentsCache[postId] = { comments: [] };
  return _sqCommentsCache[postId];
}

async function toggleSqComments(postId) {
  const section = document.getElementById(`sq-comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const cache = getSqCache(postId);
  if (!cache._loaded) {
    section.innerHTML = '<p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">加载中...</p>';
    try {
      const data = await apiGet(`/api/square/posts/${postId}/comments`);
      const comments = Array.isArray(data) ? data : (data.comments || []);
      cache.comments = comments;
      cache._loaded = true;
      renderSqTkComments(section, postId);
    } catch {
      section.innerHTML = '<p style="font-size:12px;color:var(--md-error);padding:8px 0">加载失败，点击重试</p>';
      section.style.cursor = 'pointer';
      section.onclick = () => { section.onclick = null; cache._loaded = false; toggleSqComments(postId); };
    }
  } else {
    renderSqTkComments(section, postId);
  }
}

function renderSqTkComments(section, postId) {
  const cache = getSqCache(postId);
  const allComments = cache.comments || [];

  const topComments = allComments.filter(c => !c.parent_id);
  const childMap = {};
  allComments.forEach(c => {
    if (c.parent_id) {
      if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
      childMap[c.parent_id].push(c);
    }
  });
  function attach(comment) {
    const children = childMap[comment.id] || [];
    children.forEach(attach);
    comment.replies = children;
    comment.reply_count = children.length;
  }
  topComments.forEach(attach);

  section.innerHTML = `
    <div class="comment-list">
      ${topComments.length === 0
        ? '<p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">暂无回复</p>'
        : topComments.map(c => renderTkComment(c, postId, 0, {
            deleteAction: 'delete-comment',
            replyAction: 'reply',
            likedSet: _sqLikedSet
          })).join('')
      }
    </div>
    ${isLoggedIn() ? renderTkInputArea(postId, '写回复...') : '<p class="text-secondary" style="font-size:12px;padding:8px 0"><a href="#" onclick="navigateTo(\'auth\');return false">登录</a> 后参与讨论</p>'}
  `;

  bindTkCommentEvents(section, {
    onSubmitReply: (ctxId, cid) => submitSqTkReply(ctxId, cid, section),
    onDelete: (ctxId, cid) => deleteSqTkComment(ctxId, cid, section),
    onLike: (cid) => toggleLike(cid, TK_SQ_LIKE_KEY)
  });

  const sendBtn = document.getElementById(`comment-send-btn-${postId}`);
  const mainInput = document.getElementById(`comment-main-input-${postId}`);
  sendBtn?.addEventListener('click', () => submitSqTkMain(postId, section));
  mainInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitSqTkMain(postId, section); });

  // Profile navigation
  section.querySelectorAll('.tk-avatar, .tk-avatar-letter, .tk-username').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      const commentItem = el.closest('.tk-comment-item');
      const authorId = commentItem?.querySelector('[data-action="delete-comment"]')?.dataset.authorId;
    });
  });
}

async function submitSqTkMain(postId, section) {
  const input = document.getElementById(`comment-main-input-${postId}`);
  const content = input?.value?.trim();
  const state = getTkImages(postId);
  if (!content && state.files.length === 0) return;

  try {
    let res;
    if (state.files.length > 0) {
      const formData = new FormData();
      formData.append('content', content || '');
      state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const fetchRes = await fetch(`/api/square/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
      res = await fetchRes.json();
    } else {
      res = await apiPost(`/api/square/posts/${postId}/comments`, { content });
    }
    if (res.error) { showToast(res.error); return; }
    if (input) input.value = '';
    clearTkImages(postId);
    renderTkPreviews(postId);
    getSqCache(postId)._loaded = false;
    toggleSqComments(postId);
    showToast('回复成功');
  } catch { showToast('发送失败'); }
}

async function submitSqTkReply(postId, parentCommentId, section) {
  const input = document.getElementById(`inline-reply-input-${parentCommentId}`);
  const content = input?.value?.trim();
  const state = getTkReplyImages(parentCommentId);
  if (!content && state.files.length === 0) return;

  try {
    let res;
    if (state.files.length > 0) {
      const formData = new FormData();
      formData.append('content', content || '');
      formData.append('parent_id', parentCommentId);
      state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const fetchRes = await fetch(`/api/square/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
      res = await fetchRes.json();
    } else {
      res = await apiPost(`/api/square/posts/${postId}/comments`, { content, parent_id: parentCommentId });
    }
    if (res.error) { showToast(res.error); return; }
    clearTkReplyImages(parentCommentId);
    renderTkReplyPreviews(parentCommentId);
    getSqCache(postId)._loaded = false;
    toggleSqComments(postId);
    showToast('回复成功');
  } catch { showToast('发送失败'); }
}

async function deleteSqTkComment(postId, commentId, section) {
  openModal('确认删除', `
    <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-sq-delete" style="background:var(--md-error,#e53935)">删除</button>
    </div>
  `);
  document.getElementById('confirm-sq-delete')?.addEventListener('click', async () => {
    const result = await apiDelete(`/api/square/posts/${postId}/comments/${commentId}`);
    if (result.error) { showToast(result.error); return; }
    closeModal();
    getSqCache(postId)._loaded = false;
    toggleSqComments(postId);
    showToast('已删除');
  });
}

/* ============================================
   我的广场（保留原有功能）
   ============================================ */

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

export async function renderSquareMy(container) {
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn-icon" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title"><span class="mi" style="vertical-align:-4px;margin-right:4px">people</span>我的广场</h1>
      </div>
    </div>
    <div class="inline-btn-group" style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary tab-btn active" id="square-tab-created" onclick="switchSquareMyTab('created')">我发起的</button>
      <button class="btn btn-secondary tab-btn" id="square-tab-interested" onclick="switchSquareMyTab('interested')">我感兴趣的</button>
    </div>
    <div id="square-my-list"></div>
  `;

  await loadSquareMyPosts('created');
}

export async function switchSquareMyTab(type) {
  document.getElementById('square-tab-created')?.classList.toggle('active', type === 'created');
  document.getElementById('square-tab-created')?.classList.toggle('btn-primary', type === 'created');
  document.getElementById('square-tab-created')?.classList.toggle('btn-secondary', type !== 'created');
  document.getElementById('square-tab-interested')?.classList.toggle('active', type === 'interested');
  document.getElementById('square-tab-interested')?.classList.toggle('btn-primary', type === 'interested');
  document.getElementById('square-tab-interested')?.classList.toggle('btn-secondary', type !== 'interested');
  await loadSquareMyPosts(type);
}
