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
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
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

    toggleSquareComments(postId);
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
  else navigateTo('explore');
}

/* =============================================
   广场评论系统（完整版：楼中楼 + 图片 + 软删除）
   ============================================= */

let sqLoadedComments = {};
let sqCommentImageMap = {};
let sqReplyingTo = {};

function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function toggleSquareComments(postId) {
  const section = document.getElementById(`sq-comments-${postId}`);
  if (!section) return;

  if (!sqLoadedComments[postId]) {
    section.innerHTML = renderSqCommentSkeleton();
    try {
      const data = await apiGet(`/api/square/posts/${postId}/comments?page=1&pageSize=20`);
      sqLoadedComments[postId] = {
        comments: data.comments || [],
        total: data.total || 0,
        page: 1,
        hasMore: (data.comments || []).length < (data.total || 0)
      };
      renderSqComments(section, postId);
    } catch {
      section.innerHTML = '<div class="comment-error">加载失败，点击重试</div>';
      section.querySelector('.comment-error')?.addEventListener('click', () => {
        sqLoadedComments[postId] = null;
        toggleSquareComments(postId);
      });
    }
  } else {
    renderSqComments(section, postId);
  }
}

function renderSqCommentSkeleton() {
  return Array(3).fill('').map(() => `
    <div class="comment-skeleton">
      <div class="comment-skeleton-avatar"></div>
      <div class="comment-skeleton-lines">
        <div class="comment-skeleton-line short"></div>
        <div class="comment-skeleton-line"></div>
      </div>
    </div>
  `).join('');
}

function renderSqComments(section, postId) {
  const data = sqLoadedComments[postId] || { comments: [], total: 0, page: 1, hasMore: false };
  const { comments, total, hasMore } = data;

  const rootComments = comments.filter(c => !c.parent_id);
  const childMap = {};
  comments.forEach(c => {
    if (c.parent_id) {
      if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
      childMap[c.parent_id].push(c);
    }
  });

  section.innerHTML = `
    <div class="comment-list" id="sq-comment-list-${postId}">
      ${rootComments.length === 0 && !hasMore
        ? '<p class="text-secondary" style="text-align:center;padding:16px;font-size:var(--text-sm)">暂无回复</p>'
        : rootComments.map((c, idx) => renderSqSingleComment(c, idx + 1, postId, childMap, 0)).join('')
      }
      ${hasMore ? `<div class="comment-load-more" id="sq-load-more-${postId}">加载更多回复</div>` : ''}
    </div>
    ${isLoggedIn() ? renderSqCommentInput(postId) : '<p class="text-secondary" style="margin-top:12px;font-size:var(--text-sm)"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
  `;

  bindSqCommentEvents(section, postId);
}

function renderSqSingleComment(comment, floorNum, postId, childMap, depth) {
  const isDeleted = comment.content === '[已删除]';
  const isOwner = window._currentUser && comment.author_id === window._currentUser.id;
  const children = childMap[comment.id] || [];
  const maxDepth = 3;

  return `
    <div class="comment-item ${depth > 0 ? 'comment-nested' : ''}" data-comment-id="${comment.id}" data-depth="${depth}">
      <div class="comment-header">
        ${depth === 0 ? `<span class="comment-floor">${floorNum} 楼</span>` : ''}
        ${comment.author_avatar_url
          ? `<img class="comment-avatar" src="${escHtml(comment.author_avatar_url)}" alt="">`
          : `<div class="comment-avatar-letter">${isDeleted ? '?' : escHtml((comment.author_name || '?')[0])}</div>`
        }
        <div class="comment-meta">
          <button class="user-profile-link" ${isDeleted ? 'disabled' : `onclick="navigateTo('profile-user', ${comment.author_id})"`}>
            ${isDeleted ? '已注销用户' : escHtml(comment.author_name)}
          </button>
          <span class="comment-time">${formatRelativeTime(comment.created_at)}</span>
        </div>
      </div>
      ${comment.parent_id && depth > 0 ? (() => {
        const parent = (sqLoadedComments[postId]?.comments || []).find(c => c.id === comment.parent_id);
        return parent ? `<div class="comment-reply-ref">回复 @${escHtml(parent.author_name || '已注销用户')}</div>` : '';
      })() : ''}
      <div class="comment-body">
        ${isDeleted
          ? '<p class="comment-deleted">该回复已被删除</p>'
          : `<p class="comment-content">${escHtml(comment.content)}</p>`
        }
        ${comment.image_url ? `<div class="comment-image-wrap"><img src="${escHtml(comment.image_url)}" alt="评论图片" class="comment-image" loading="lazy" onclick="window.open('${escHtml(comment.image_url)}', '_blank')"></div>` : ''}
      </div>
      ${!isDeleted ? `
        <div class="comment-actions">
          ${isLoggedIn() ? `<button class="comment-action-btn comment-reply-btn" data-comment-id="${comment.id}" data-author="${escHtml(comment.author_name)}"><span class="mi" style="font-size:14px">reply</span> 回复</button>` : ''}
          ${isOwner ? `<button class="comment-action-btn comment-delete-btn" data-comment-id="${comment.id}" data-post-id="${postId}"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
      ` : ''}
      ${children.length > 0 && depth < maxDepth
        ? children.map(c => renderSqSingleComment(c, 0, postId, childMap, depth + 1)).join('')
        : ''
      }
      ${children.length > 0 && depth >= maxDepth
        ? `<button class="comment-load-more-replies" data-parent-id="${comment.id}" data-post-id="${postId}">查看更多回复 (${children.length})</button>`
        : ''
      }
    </div>
  `;
}

function renderSqCommentInput(postId) {
  const replyRef = sqReplyingTo[postId];
  return `
    <div class="comment-input-area" id="sq-input-area-${postId}">
      ${replyRef ? `<div class="comment-reply-ref-bar">回复 @${escHtml(replyRef.author_name)}<button class="comment-cancel-reply" data-post-id="${postId}"><span class="mi" style="font-size:16px">close</span></button></div>` : ''}
      <div class="comment-input-row">
        <div class="comment-textarea-wrap">
          <textarea class="comment-textarea" id="sq-textarea-${postId}" placeholder="写回复..." rows="2" maxlength="500"></textarea>
          <span class="comment-char-count" id="sq-char-count-${postId}">0/500</span>
        </div>
        <div class="comment-input-actions">
          <label class="comment-action-btn comment-upload-btn" title="上传图片">
            <span class="mi" style="font-size:20px">add_photo_alternate</span>
            <input type="file" accept=".jpg,.jpeg,.png" style="display:none" id="sq-img-input-${postId}">
          </label>
          <button class="btn btn-primary comment-send-btn" id="sq-send-btn-${postId}" data-post-id="${postId}" disabled>
            <span class="mi" style="font-size:18px">send</span>
          </button>
        </div>
      </div>
      <div class="comment-image-preview" id="sq-img-preview-${postId}" style="display:none">
        <img id="sq-preview-img-${postId}" src="" alt="">
        <button class="comment-remove-image" data-post-id="${postId}"><span class="mi" style="font-size:16px">close</span></button>
      </div>
      <div class="comment-tip">请遵守社区规范，禁止发布违规内容</div>
    </div>
  `;
}

function bindSqCommentEvents(section, postId) {
  // 回复按钮
  section.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sqReplyingTo[postId] = { id: Number(btn.dataset.commentId), author_name: btn.dataset.author };
      renderSqComments(section, postId);
      const textarea = document.getElementById(`sq-textarea-${postId}`);
      if (textarea) { textarea.focus(); textarea.value = `@${btn.dataset.author} `; updateSqCharCount(postId); }
    });
  });

  // 取消回复
  section.querySelectorAll('.comment-cancel-reply').forEach(btn => {
    btn.addEventListener('click', () => {
      delete sqReplyingTo[postId];
      renderSqComments(section, postId);
    });
  });

  // 删除按钮
  section.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('确认删除', `
        <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="confirm-delete-sq-comment" data-comment-id="${btn.dataset.commentId}" data-post-id="${btn.dataset.postId}" style="background:var(--md-error,#e53935)">删除</button>
        </div>
      `);
      document.getElementById('confirm-delete-sq-comment')?.addEventListener('click', async () => {
        const result = await apiDelete(`/api/square/posts/${btn.dataset.postId}/comments/${btn.dataset.commentId}`);
        if (result.error) { showToast(result.error); return; }
        closeModal();
        sqLoadedComments[postId] = null;
        toggleSquareComments(postId);
        showToast('已删除');
      });
    });
  });

  // 加载更多
  const loadMoreBtn = document.getElementById(`sq-load-more-${postId}`);
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.textContent = '加载中...';
      loadMoreBtn.disabled = true;
      const data = sqLoadedComments[postId];
      const nextPage = data.page + 1;
      try {
        const result = await apiGet(`/api/square/posts/${postId}/comments?page=${nextPage}&pageSize=20`);
        data.comments.push(...(result.comments || []));
        data.page = nextPage;
        data.hasMore = data.comments.length < data.total;
        renderSqComments(section, postId);
      } catch {
        loadMoreBtn.textContent = '加载失败，点击重试';
        loadMoreBtn.disabled = false;
      }
    });
  }

  // 查看更多回复
  section.querySelectorAll('.comment-load-more-replies').forEach(btn => {
    btn.addEventListener('click', async () => {
      const parentId = Number(btn.dataset.parentId);
      btn.textContent = '加载中...';
      try {
        const replies = await apiGet(`/api/square/posts/${postId}/comments/${parentId}/replies`);
        const data = sqLoadedComments[postId];
        replies.forEach(r => {
          if (!data.comments.find(c => c.id === r.id)) data.comments.push(r);
        });
        renderSqComments(section, postId);
      } catch {
        btn.textContent = '加载失败';
      }
    });
  });

  // 文本输入
  const textarea = document.getElementById(`sq-textarea-${postId}`);
  if (textarea) {
    textarea.addEventListener('input', () => updateSqCharCount(postId));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitSqComment(postId, section);
      }
    });
    textarea.focus();
  }

  // 发送按钮
  const sendBtn = document.getElementById(`sq-send-btn-${postId}`);
  if (sendBtn) {
    sendBtn.addEventListener('click', () => submitSqComment(postId, section));
  }

  // 图片上传
  const imgInput = document.getElementById(`sq-img-input-${postId}`);
  if (imgInput) {
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) { showToast('图片不能超过 1MB'); imgInput.value = ''; return; }
      sqCommentImageMap[postId] = file;
      const preview = document.getElementById(`sq-img-preview-${postId}`);
      const previewImg = document.getElementById(`sq-preview-img-${postId}`);
      if (preview && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        preview.style.display = 'block';
      }
      updateSqSendBtn(postId);
    });
  }

  // 移除图片
  section.querySelectorAll('.comment-remove-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = Number(btn.dataset.postId);
      delete sqCommentImageMap[pid];
      const preview = document.getElementById(`sq-img-preview-${pid}`);
      if (preview) preview.style.display = 'none';
      const imgInput = document.getElementById(`sq-img-input-${pid}`);
      if (imgInput) imgInput.value = '';
      updateSqSendBtn(pid);
    });
  });
}

function updateSqCharCount(postId) {
  const textarea = document.getElementById(`sq-textarea-${postId}`);
  const counter = document.getElementById(`sq-char-count-${postId}`);
  if (!textarea || !counter) return;
  const len = textarea.value.length;
  counter.textContent = `${len}/500`;
  counter.classList.toggle('exceeded', len >= 500);
  updateSqSendBtn(postId);
}

function updateSqSendBtn(postId) {
  const textarea = document.getElementById(`sq-textarea-${postId}`);
  const sendBtn = document.getElementById(`sq-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;
  const hasContent = textarea.value.trim().length > 0;
  const hasImage = !!sqCommentImageMap[postId];
  const notExceeded = textarea.value.length <= 500;
  sendBtn.disabled = !(hasContent || hasImage) || !notExceeded;
}

async function submitSqComment(postId, section) {
  const textarea = document.getElementById(`sq-textarea-${postId}`);
  const sendBtn = document.getElementById(`sq-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;

  const content = textarea.value.trim();
  const imageFile = sqCommentImageMap[postId];
  if (!content && !imageFile) return;
  if (content.length > 500) { showToast('回复内容不能超过 500 字'); return; }

  textarea.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="mi" style="font-size:18px">hourglass_empty</span>';

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (sqReplyingTo[postId]) formData.append('parent_id', sqReplyingTo[postId].id);
    if (imageFile) formData.append('image', imageFile);

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/square/posts/${postId}/comments`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      textarea.disabled = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="mi" style="font-size:18px">send</span>';
      return;
    }

    textarea.value = '';
    delete sqCommentImageMap[postId];
    delete sqReplyingTo[postId];
    const preview = document.getElementById(`sq-img-preview-${postId}`);
    if (preview) preview.style.display = 'none';
    const imgInput = document.getElementById(`sq-img-input-${postId}`);
    if (imgInput) imgInput.value = '';

    sqLoadedComments[postId] = null;
    toggleSquareComments(postId);
    setTimeout(() => {
      const list = document.getElementById(`sq-comment-list-${postId}`);
      if (list) list.scrollTop = list.scrollHeight;
    }, 300);
    showToast('回复成功');
  } catch {
    showToast('发送失败，请重试');
    textarea.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span class="mi" style="font-size:18px">send</span>';
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
        <button class="btn btn-secondary" style="padding:6px 8px" onclick="navigateTo('explore')"><span class="mi">arrow_back</span></button>
        <h1 class="page-title">我的广场</h1>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
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
