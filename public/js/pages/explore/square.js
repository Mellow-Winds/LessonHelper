/**
 * explore/square.js — 交友广场子模块
 * 仅负责：广场帖子列表渲染、发帖、筛选、帖子详情、评论
 * 由 explore.js 动态调用，不注册全局路由
 */

import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn, getToken } from '../../core/api.js';
import { navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { showToast, createMdInput, createMdSelect, escHtml, formatTime, openModal, closeModal, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';

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
        style: 'width:auto;min-width:120px;margin-bottom:0',
        onchange: 'refreshSquarePosts()'
      })}
    </div>
    <div id="square-posts-list"></div>
  `;

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

const _sqExpandedComments = {};
const _sqExpandedReplies = {};
const _sqReplyImages = {};

function renderSqCommentImages(imageUrlStr) {
  if (!imageUrlStr) return '';
  const urls = imageUrlStr.split(';').filter(Boolean);
  if (urls.length === 0) return '';
  if (urls.length === 1) {
    return `<a href="${urls[0]}" target="_blank" rel="noopener"><img class="forum-reply-image" src="${urls[0]}" alt="回复图片" loading="lazy"></a>`;
  }
  return `
    <div class="forum-image-grid count-${Math.min(urls.length, 9)}" style="max-width:240px">
      ${urls.map(url => `<a href="${url}" target="_blank" rel="noopener" class="forum-image-link"><img src="${url}" alt="回复图片" loading="lazy"></a>`).join('')}
    </div>
  `;
}

async function toggleSqComments(postId) {
  const section = document.getElementById(`sq-comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    _sqExpandedComments[postId] = false;
    return;
  }

  section.style.display = 'block';
  _sqExpandedComments[postId] = true;

  section.innerHTML = '<p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">加载中...</p>';

  try {
    const data = await apiGet(`/api/square/posts/${postId}/comments`);
    const comments = Array.isArray(data) ? data : (data.comments || []);

    const topComments = comments.filter(c => !c.parent_id);
    const childMap = {};
    comments.forEach(c => {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    });

    if (topComments.length === 0) {
      section.innerHTML = `
        <div class="forum-reply-section">
          <p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">暂无回复</p>
          <div id="sq-inline-post-${postId}"></div>
          ${isLoggedIn() ? `<button class="forum-action-btn" data-action="sq-reply-post" data-post-id="${postId}" style="margin-top:4px"><span class="mi" style="font-size:14px">chat_bubble_outline</span> 写回复</button>` : '<p class="text-secondary" style="font-size:12px"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
        </div>
      `;
    } else {
      section.innerHTML = `
        <div class="forum-reply-section">
          ${topComments.map(c => renderSqForumComment(c, postId, childMap)).join('')}
          <div id="sq-inline-post-${postId}"></div>
          ${isLoggedIn() ? `<button class="forum-action-btn" data-action="sq-reply-post" data-post-id="${postId}" style="margin-top:4px"><span class="mi" style="font-size:14px">chat_bubble_outline</span> 写回复</button>` : ''}
        </div>
      `;
    }

    bindSqForumEvents(section, postId);
  } catch {
    section.innerHTML = '<p style="font-size:12px;color:var(--md-error);padding:8px 0">加载失败，点击重试</p>';
    section.style.cursor = 'pointer';
    section.onclick = () => { section.onclick = null; toggleSqComments(postId); };
  }
}

function renderSqForumComment(c, postId, childMap) {
  const avatarLetter = (c.author_name || '?')[0].toUpperCase();
  const children = childMap[c.id] || [];
  const previewChildren = children.slice(-2);
  const hiddenCount = children.length - previewChildren.length;
  const isExpanded = _sqExpandedReplies[c.id];

  return `
    <div class="forum-reply-row" id="sq-comment-${c.id}">
      <div>
        ${c.author_avatar_url
          ? `<img class="forum-reply-avatar" src="${c.author_avatar_url}" alt="" data-action="sq-navigate-profile" data-user-id="${c.author_id}" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" data-action="sq-navigate-profile" data-user-id="${c.author_id}" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" data-action="sq-navigate-profile" data-user-id="${c.author_id}">${escHtml(c.author_name)}</button>
            <span class="forum-reply-time">${formatTime(c.created_at)}</span>
          </div>
        </div>
        <p class="forum-reply-text">${escHtml(c.content || '')}</p>
        ${renderSqCommentImages(c.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" data-action="sq-reply-comment" data-post-id="${postId}" data-comment-id="${c.id}">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
          ${window._currentUser && c.author_id === window._currentUser.id ? `<button class="forum-action-btn" data-action="sq-delete" data-post-id="${postId}" data-comment-id="${c.id}" style="color:var(--md-error)"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
        <div id="sq-inline-comment-${c.id}"></div>
        ${children.length > 0 ? `
          ${isExpanded ? `
            <div class="forum-nested-replies">
              ${children.map(child => renderSqNestedReply(child, c.author_name, c.author_id, postId, childMap, 1)).join('')}
            </div>
            <button class="forum-view-replies" data-action="sq-toggle-replies" data-comment-id="${c.id}" data-post-id="${postId}">
              ── 收起回复 🔼
            </button>
          ` : `
            ${previewChildren.length > 0 ? `
              <div class="forum-nested-replies">
                ${previewChildren.map(child => renderSqNestedReply(child, c.author_name, c.author_id, postId, childMap, 1)).join('')}
              </div>
            ` : ''}
            ${hiddenCount > 0 ? `
              <button class="forum-view-replies" data-action="sq-toggle-replies" data-comment-id="${c.id}" data-post-id="${postId}">
                ── 查看更多 ${hiddenCount} 条回复 🔽
              </button>
            ` : ''}
          `}
        ` : ''}
      </div>
    </div>
  `;
}

function renderSqNestedReply(child, parentAuthorName, parentAuthorId, postId, childMap, depth) {
  const avatarLetter = (child.author_name || '?')[0].toUpperCase();
  const children = (childMap || {})[child.id] || [];
  const curDepth = depth || 0;
  const maxPreview = curDepth >= 3 ? 0 : 2;
  const previewChildren = children.slice(-maxPreview);
  const hiddenCount = children.length - previewChildren.length;
  const isExpanded = _sqExpandedReplies[child.id];

  return `
    <div class="forum-nested-reply">
      <div>
        ${child.author_avatar_url
          ? `<img class="forum-reply-avatar" src="${child.author_avatar_url}" alt="" data-action="sq-navigate-profile" data-user-id="${child.author_id}" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" data-action="sq-navigate-profile" data-user-id="${child.author_id}" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" data-action="sq-navigate-profile" data-user-id="${child.author_id}">${escHtml(child.author_name)}</button>
            <span class="forum-reply-to">
              回复 <button class="forum-reply-link" data-action="sq-navigate-profile" data-user-id="${parentAuthorId}">${escHtml(parentAuthorName || '')}</button>
            </span>
            <span class="forum-reply-time">${formatTime(child.created_at)}</span>
          </div>
        </div>
        <p class="forum-reply-text">${escHtml(child.content || '')}</p>
        ${renderSqCommentImages(child.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" data-action="sq-reply-nested" data-post-id="${postId}" data-comment-id="${child.id}">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
          ${window._currentUser && child.author_id === window._currentUser.id ? `<button class="forum-action-btn" data-action="sq-delete" data-post-id="${postId}" data-comment-id="${child.id}" style="color:var(--md-error)"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
        <div id="sq-inline-comment-${child.id}"></div>
        ${children.length > 0 ? `
          ${isExpanded ? `
            <div class="forum-nested-replies">
              ${children.map(c => renderSqNestedReply(c, child.author_name, child.author_id, postId, childMap, curDepth + 1)).join('')}
            </div>
            <button class="forum-view-replies" data-action="sq-toggle-replies" data-comment-id="${child.id}" data-post-id="${postId}">
              ── 收起回复 🔼
            </button>
          ` : `
            ${previewChildren.length > 0 ? `
              <div class="forum-nested-replies">
                ${previewChildren.map(c => renderSqNestedReply(c, child.author_name, child.author_id, postId, childMap, curDepth + 1)).join('')}
              </div>
            ` : ''}
            ${hiddenCount > 0 ? `
              <button class="forum-view-replies" data-action="sq-toggle-replies" data-comment-id="${child.id}" data-post-id="${postId}">
                ── 查看更多 ${hiddenCount} 条回复 🔽
              </button>
            ` : ''}
          `}
        ` : ''}
      </div>
    </div>
  `;
}

function bindSqForumEvents(root, postId) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const pId = Number(btn.dataset.postId) || postId;
    const commentId = Number(btn.dataset.commentId);

    switch (action) {
      case 'sq-reply-post':
        openSqInlineEditor(postId, null, `post-${postId}`);
        break;
      case 'sq-reply-comment':
        openSqInlineEditor(postId, commentId, `comment-${commentId}`);
        break;
      case 'sq-reply-nested':
        openSqInlineEditor(postId, commentId, `nested-${commentId}`);
        break;
      case 'sq-toggle-replies':
        _sqExpandedReplies[commentId] = !_sqExpandedReplies[commentId];
        if (_sqExpandedComments[postId]) {
          toggleSqComments(postId);
          setTimeout(() => toggleSqComments(postId), 30);
        }
        break;
      case 'sq-delete':
        openModal('确认删除', `
          <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
          <div class="inline-btn-group" style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" id="confirm-sq-delete" style="background:var(--md-error,#e53935)">删除</button>
          </div>
        `);
        document.getElementById('confirm-sq-delete')?.addEventListener('click', async () => {
          const result = await apiDelete(`/api/square/posts/${pId}/comments/${commentId}`);
          if (result.error) { showToast(result.error); return; }
          closeModal();
          if (_sqExpandedComments[postId]) {
            toggleSqComments(postId);
            setTimeout(() => toggleSqComments(postId), 30);
          }
          showToast('已删除');
        });
        break;
      case 'sq-navigate-profile':
        navigateTo('profile-user', Number(btn.dataset.userId));
        break;
    }
  });
}

function openSqInlineEditor(postId, parentCommentId, ctxKey) {
  const containerId = parentCommentId
    ? `sq-inline-comment-${parentCommentId}`
    : `sq-inline-post-${postId}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.innerHTML.trim() !== '') {
    closeSqInlineEditor(ctxKey);
    return;
  }

  document.querySelectorAll('[id^="sq-inline-"]').forEach(el => {
    if (el.id !== containerId && el.innerHTML.trim() !== '') {
      el.innerHTML = '';
    }
  });

  _sqReplyImages[ctxKey] = { files: [], urls: [] };

  container.innerHTML = `
    <div class="forum-inline-editor">
      <div class="forum-editor-row">
        <textarea class="forum-editor-textarea" id="sq-textarea-${ctxKey}"
          placeholder=" " rows="1"
          oninput="autoResizeForumTextarea(this)"></textarea>
        <div class="forum-editor-actions">
          <input type="file" id="sq-file-${ctxKey}" accept="image/jpeg,image/png,image/gif,image/webp"
            multiple style="display:none" onchange="handleSqReplyImageChange('${ctxKey}', ${postId})">
          <button class="forum-editor-btn forum-editor-camera" onclick="document.getElementById('sq-file-${ctxKey}').click()" title="添加图片">
            <span class="mi">photo_camera</span>
          </button>
          <button class="forum-editor-btn forum-editor-send" id="sq-send-${ctxKey}"
            onclick="submitSqForumReply(${postId}, ${parentCommentId || 'null'}, '${ctxKey}')">
            <span class="mi">send</span>
          </button>
        </div>
      </div>
      <div class="forum-editor-previews" id="sq-previews-${ctxKey}"></div>
    </div>
  `;

  setTimeout(() => {
    const textarea = document.getElementById(`sq-textarea-${ctxKey}`);
    if (textarea) textarea.focus();
  }, 150);

  setTimeout(() => {
    const editorDiv = container.querySelector('.forum-inline-editor');
    if (!editorDiv) return;
    editorDiv.addEventListener('focusout', () => {
      setTimeout(() => {
        if (editorDiv.contains(document.activeElement)) return;
        const ta = editorDiv.querySelector('textarea');
        if (ta && ta.value.trim()) return;
        const imgs = _sqReplyImages[ctxKey];
        if (imgs && imgs.files.length > 0) return;
        closeSqInlineEditor(ctxKey);
      }, 300);
    });
  }, 200);
}

function closeSqInlineEditor(ctxKey) {
  const textarea = document.getElementById(`sq-textarea-${ctxKey}`);
  if (!textarea) return;
  const container = textarea.closest('.forum-inline-editor')?.parentElement;
  if (container) container.innerHTML = '';
  delete _sqReplyImages[ctxKey];
}

window.openSqInlineEditor = openSqInlineEditor;
window.submitSqForumReply = submitSqForumReply;
window.handleSqReplyImageChange = handleSqReplyImageChange;

function handleSqReplyImageChange(ctxKey, postId) {
  const input = document.getElementById(`sq-file-${ctxKey}`);
  if (!input) return;
  const files = Array.from(input.files);
  if (files.length === 0) return;
  if (files.length > 9) { showToast('最多上传 9 张图片'); input.value = ''; return; }
  if (files.some(f => !f.type.startsWith('image/'))) { showToast('仅支持图片文件'); input.value = ''; return; }
  if (files.some(f => f.size > 20 * 1024 * 1024)) { showToast('图片不能超过 20MB'); input.value = ''; return; }

  _sqReplyImages[ctxKey] = { files, urls: files.map(f => URL.createObjectURL(f)) };
  renderSqImagePreviews(ctxKey);
}

function renderSqImagePreviews(ctxKey) {
  const container = document.getElementById(`sq-previews-${ctxKey}`);
  if (!container) return;
  const imgs = _sqReplyImages[ctxKey];
  if (!imgs || imgs.files.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = imgs.urls.map((url, i) => `
    <div class="forum-preview-thumb">
      <img src="${url}" alt="">
      <button class="forum-preview-remove" onclick="removeSqPreviewImage('${ctxKey}', ${i})"><span class="mi" style="font-size:14px">close</span></button>
    </div>
  `).join('');
}

window.removeSqPreviewImage = function(ctxKey, index) {
  const imgs = _sqReplyImages[ctxKey];
  if (!imgs) return;
  imgs.files.splice(index, 1);
  imgs.urls.splice(index, 1);
  renderSqImagePreviews(ctxKey);
};

async function submitSqForumReply(postId, parentCommentId, ctxKey) {
  const textarea = document.getElementById(`sq-textarea-${ctxKey}`);
  if (!textarea) return;

  const content = textarea.value.trim();
  const imgs = _sqReplyImages[ctxKey];
  const hasImages = imgs && imgs.files.length > 0;

  if (!content && !hasImages) {
    showToast('请输入内容或上传图片');
    return;
  }

  const sendBtn = document.getElementById(`sq-send-${ctxKey}`);
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '发送中...'; }

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (parentCommentId) formData.append('parent_id', String(parentCommentId));
    if (hasImages) {
      imgs.files.forEach(file => formData.append('image', file));
    }

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/square/posts/${postId}/comments`, {
      method: 'POST',
      headers,
      body: formData
    });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="mi">send</span>'; }
      return;
    }

    closeSqInlineEditor(ctxKey);
    showToast('回复成功');

    if (_sqExpandedComments[postId]) {
      toggleSqComments(postId);
      setTimeout(() => toggleSqComments(postId), 30);
    }
  } catch {
    showToast('网络错误，请重试');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="mi">send</span>'; }
  }
}

/* =============================================
   我的广场（子页面，独立路由 square-my）
   ============================================= */

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
