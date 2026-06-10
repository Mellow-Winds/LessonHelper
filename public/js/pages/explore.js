/**
 * pages/explore.js — 探索页（组件化卡片系统）
 * 统一帖子流 + 搜索筛选 + 帖子详情分栏布局 + 评论
 */

import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../core/router.js';
import { apiGet, apiPost, apiDelete, isLoggedIn, getToken } from '../core/api.js';
import { showToast, openModal, closeModal, renderLoginPrompt, createMdInput } from '../components/ui.js';
import { renderCard, renderPostCard, renderModule, startTimers, bindCardActions } from '../components/card-renderer.js';

/* =============================================
   状态
   ============================================= */

let _posts = [];
let _page = 1;
let _total = 0;
let _keyword = '';
let _hasMore = true;
let _timerInterval = null;

/* =============================================
   renderExplore — 渲染探索主页
   ============================================= */

async function renderExplore(container) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0">
        <i class="ri-compass-3-line" style="vertical-align:-3px;margin-right:4px"></i> 发现
      </h1>
      <div class="explore-header-actions">
        <button class="btn btn-secondary btn-compact" id="explore-my-btn">
          <i class="ri-file-list-3-line"></i> 我的发布
        </button>
      </div>
    </div>

    <div class="explore-search-bar" id="explore-search-bar"></div>

    <div id="explore-posts-list" class="explore-posts-grid"></div>
    <div id="explore-load-more" style="text-align:center;padding:16px"></div>

    <button class="explore-fab" id="explore-publish-btn" title="发布">
      <i class="ri-add-line"></i>
    </button>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  const searchBarEl = container.querySelector('#explore-search-bar');
  if (searchBarEl) {
    searchBarEl.innerHTML = createMdInput({
      id: 'explore-search', label: '搜索', placeholder: ' ', value: _keyword
    });
  }

  bindExploreEvents(container);

  _posts = [];
  _page = 1;
  _hasMore = true;
  await loadPosts(container);
}

/* =============================================
   事件绑定
   ============================================= */

function bindExploreEvents(container) {
  container.querySelector('#explore-publish-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) { showToast('请先登录'); return; }
    navigateTo('explore-tutorial');
  });

  container.querySelector('#explore-my-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) { showToast('请先登录'); return; }
    navigateTo('explore-my-posts');
  });

  let searchTimer = null;
  const searchInput = container.querySelector('#explore-search');
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      _keyword = e.target.value.trim();
      _posts = [];
      _page = 1;
      _hasMore = true;
      await loadPosts(container);
    }, 300);
  });

  container.querySelector('#explore-posts-list')?.addEventListener('click', (e) => {
    const postCard = e.target.closest('.explore-post-card');
    if (!postCard) return;
    navigateTo('explore-post-detail', postCard.dataset.postId);
  });
}

/* =============================================
   加载帖子
   ============================================= */

async function loadPosts(container) {
  const listEl = container.querySelector('#explore-posts-list');
  const loadMoreEl = container.querySelector('#explore-load-more');
  if (!listEl) return;

  if (_page === 1) {
    listEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';
  }

  try {
    const params = new URLSearchParams({ page: _page, pageSize: 20 });
    if (_keyword) params.set('keyword', _keyword);

    const data = await apiGet(`/api/explore/posts?${params}`);

    if (data.error) {
      listEl.innerHTML = `<div class="card"><p class="text-secondary">${data.error}</p></div>`;
      return;
    }

    if (_page === 1) listEl.innerHTML = '';

    const newItems = data.items || [];
    _total = data.total || 0;

    if (newItems.length === 0 && _page === 1) {
      listEl.style.display = 'block';
      listEl.style.columns = 'auto';
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <i class="ri-inbox-line" style="font-size:48px;color:var(--md-outline-variant)"></i>
          <p class="text-secondary" style="margin-top:12px">还没有帖子</p>
          <p class="text-secondary">点击右下角 + 创建第一条内容</p>
        </div>`;
      loadMoreEl.innerHTML = '';
      return;
    } else {
      listEl.style.display = '';
      listEl.style.columns = '';
    }

    _posts.push(...newItems);

    const newCards = [];
    for (const post of newItems) {
      const el = document.createElement('div');
      el.innerHTML = renderPostCard(post);
      const cardEl = el.firstElementChild;
      listEl.appendChild(cardEl);
      newCards.push(cardEl);
    }

    animStagger(newCards, { y: 16, dur: 350, gap: 40 });
    _timerInterval = startTimers(listEl);

    _hasMore = _posts.length < _total;
    loadMoreEl.innerHTML = _hasMore
      ? '<button class="btn btn-secondary" id="explore-load-more-btn">加载更多</button>'
      : (_posts.length > 0 ? '<p class="text-secondary" style="text-align:center;font-size:12px">没有更多了</p>' : '');

    container.querySelector('#explore-load-more-btn')?.addEventListener('click', async () => {
      _page++;
      await loadPosts(container);
    });
  } catch (e) {
    if (_page === 1) {
      listEl.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
    }
  }
}

/* =============================================
   帖子详情页
   ============================================= */

registerPage('explore-post-detail', async (container, postId) => {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="detail-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <span id="detail-delete-btn-placeholder"></span>
    </div>
    <div id="detail-content"><div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div></div>
  `;

  container.querySelector('#detail-back-btn')?.addEventListener('click', () => navigateTo('explore'));

  try {
    const post = await apiGet(`/api/explore/posts/${postId}`);
    if (post.error) {
      container.querySelector('#detail-content').innerHTML = `<div class="card"><p class="text-secondary">${post.error}</p></div>`;
      return;
    }

    // 作者可见删除 + 编辑按钮
    if (post.creator_id && window._currentUser?.id === post.creator_id) {
      const placeholder = container.querySelector('#detail-delete-btn-placeholder');
      if (placeholder) {
        placeholder.innerHTML = `
          <span style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-compact" id="detail-edit-btn">
              <i class="ri-edit-line"></i> 编辑
            </button>
            <button class="btn btn-secondary btn-compact" id="detail-delete-btn" style="color:var(--md-error)">
              <i class="ri-delete-bin-line"></i> 删除
            </button>
          </span>
        `;
        container.querySelector('#detail-edit-btn')?.addEventListener('click', () => navigateTo('explore-post-editor', post.id));
        container.querySelector('#detail-delete-btn')?.addEventListener('click', () => {
          openModal('确认删除', `
            <p style="margin-bottom:24px">确定要删除这篇帖子吗？删除后无法恢复。</p>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-secondary" onclick="closeModal()">取消</button>
              <button class="btn btn-primary" id="confirm-delete-post" style="background:var(--md-error)">删除</button>
            </div>
          `);
          document.getElementById('confirm-delete-post')?.addEventListener('click', async () => {
            const res = await apiDelete(`/api/explore/posts/${post.id}`);
            if (res.error) { showToast(res.error); closeModal(); return; }
            closeModal();
            showToast('已删除');
            navigateTo('explore');
          });
        });
      }
    }

    renderPostDetail(container.querySelector('#detail-content'), post);
  } catch (e) {
    container.querySelector('#detail-content').innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
  }
});

/* =============================================
   帖子详情渲染 — 左右分栏布局
   ============================================= */

function renderPostDetail(el, post) {
  const nickname = post.creator_nickname || post.creator_name || '匿名';
  const avatarUrl = post.creator_avatar || '';
  const avatarLetter = (nickname || '?')[0].toUpperCase();
  const timeStr = new Date(post.created_at).toLocaleString('zh-CN');
  const isOwner = post.creator_id && window._currentUser?.id === post.creator_id;

  let blocks = post.blocks || [];
  if (blocks.length === 0 && post.content) {
    try {
      const parsed = JSON.parse(post.content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) blocks = parsed;
    } catch (e) {}
  }

  let contentHtml = '';
  if (blocks.length > 0) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === 'text' && block.data) {
        contentHtml += `<div class="post-text-block">${block.data}</div>`;
      } else if (block.type === 'card' && block.card) {
        contentHtml += `<div class="explore-card-wrapper" data-block-index="${i}">`;
        contentHtml += renderCard(block.card, { compact: false, showActions: true, isOwner });
        contentHtml += `</div>`;
      }
    }
  } else {
    if (post.content) contentHtml += `<div class="post-text-block">${renderMarkdown(post.content)}</div>`;
    if (post.cards) contentHtml += post.cards.map(c => renderCard(c, { compact: false, showActions: true, isOwner })).join('');
  }

  el.innerHTML = `
    <div class="explore-detail-layout">
      <div class="post-section">
        <div class="post-author-row">
          <div class="post-author-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="">` : avatarLetter}</div>
          <div class="post-author-info">
            <span class="post-author-nickname">${escHtml(nickname)}</span>
            <span class="post-author-time">${escHtml(timeStr)}</span>
          </div>
        </div>
        <h2 class="explore-post-title">${escHtml(post.title)}</h2>
        <div class="explore-detail-content">${contentHtml}</div>
      </div>
      <div class="comment-section">
        <div class="comment-section-header">共 ${post.comment_count || 0} 条评论</div>
        <div class="comment-list" id="comment-list-${post.id}">
          <p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">加载中...</p>
        </div>
        ${isLoggedIn() ? `
          <div class="comment-input-area" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:var(--space-3)">
              <div class="comment-input-wrapper" style="flex:1">
                <input type="text" class="comment-main-input" id="comment-main-input-${post.id}" placeholder="说点什么...">
                <label class="comment-input-img-btn" title="选择图片">
                  <i class="ri-image-line"></i>
                  <input type="file" style="position:absolute;width:0;height:0;opacity:0;overflow:hidden" accept="image/*" multiple id="comment-img-input-${post.id}" onchange="window._commentHandleFiles(this,${post.id})">
                </label>
              </div>
              <button class="comment-send-btn" id="comment-send-btn-${post.id}">发送</button>
            </div>
            <div class="forum-editor-previews" id="comment-previews-${post.id}"></div>
          </div>
        ` : `<p class="text-secondary" style="padding:12px 24px;font-size:12px;text-align:center"><a href="#" onclick="navigateTo('auth');return false">登录</a> 后参与评论</p>`}
      </div>
    </div>
  `;

  _timerInterval = startTimers(el);

  bindCardActions(el, {
    onCopy: () => showToast('已复制'),
    onEdit: (cardId, btn) => {
      const wrapper = btn.closest('.explore-card-wrapper');
      const blockIndex = wrapper ? parseInt(wrapper.dataset.blockIndex) : -1;
      if (blockIndex >= 0 && blocks[blockIndex]?.card) {
        openCardEditModal(post, blocks, blockIndex, el);
      }
    }
  });

  loadCommentsNew(post.id);
  bindCommentEvents(el, post.id);
}

/* ---- 卡片编辑弹窗 ---- */

function openCardEditModal(post, blocks, blockIndex, detailEl) {
  const card = blocks[blockIndex].card;
  if (!card) return;

  const components = card.components || [];
  let fieldsHtml = createMdInput({ id: 'card-edit-title', label: '卡片标题', placeholder: ' ', value: card.title || '' });

  components.forEach((comp, i) => {
    if (comp.type === 'days_matter') {
      const dateVal = (comp.value && comp.value.match(/^\d{4}-\d{2}-\d{2}/)) ? comp.value.slice(0, 10) : '';
      fieldsHtml += `<div class="card-edit-field">
        <label class="card-edit-label"><i class="${comp.icon || 'ri-calendar-event-line'}"></i> ${escHtml(comp.label || '')}</label>
        <div class="md-input-group" style="margin-bottom:4px">
          <input class="md-input" type="date" id="card-edit-field-${i}" value="${dateVal}" placeholder=" ">
          <fieldset class="md-border"><legend><span>${escHtml(comp.label || '')}</span></legend></fieldset>
          <label class="md-label">${escHtml(comp.label || '')}</label>
        </div>
      </div>`;
    } else {
      fieldsHtml += `<div class="card-edit-field">${createMdInput({ id: `card-edit-field-${i}`, label: comp.label || '', value: comp.value || '', placeholder: ' ' })}</div>`;
    }
  });

  openModal(escHtml(card.title || '编辑卡片'), `
    <div class="card-edit-form">${fieldsHtml}</div>
    <div class="card-edit-actions" style="margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="card-edit-confirm">确定</button>
    </div>
  `);

  document.getElementById('card-edit-confirm')?.addEventListener('click', () => {
    card.title = document.getElementById('card-edit-title')?.value?.trim() || card.title;
    components.forEach((comp, i) => {
      const input = document.getElementById(`card-edit-field-${i}`);
      if (input) comp.value = input.value;
    });
    card.components = components;
    blocks[blockIndex].card = card;
    renderPostDetail(detailEl, { ...post, blocks });
    closeModal();
    showToast('卡片已更新');
  });
}

/* ---- 评论图片预览状态 ---- */
const _commentImages = {};  // { postId: { files: File[], urls: string[] } }

function getCommentImages(postId) {
  if (!_commentImages[postId]) _commentImages[postId] = { files: [], urls: [] };
  return _commentImages[postId];
}

/* =============================================
   新版评论系统
   ============================================= */

async function loadCommentsNew(postId) {
  const listEl = document.getElementById(`comment-list-${postId}`);
  if (!listEl) return;
  try {
    const data = await apiGet(`/api/explore/posts/${postId}/comments`);
    const topComments = data.items || [];
    if (topComments.length === 0) {
      listEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">暂无评论</p>';
      return;
    }
    // 主评论渲染，子回复内嵌但平级（可展开/折叠）
    listEl.innerHTML = topComments.map(c => renderCommentWithReplies(c, postId)).join('');
  } catch (e) {
    listEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:24px;font-size:13px">加载失败</p>';
  }
}

// 核心：彻底把树状回复拍平成一维数组
function flattenReplies(replies, parentAuthorName = '') {
  let flatList = [];
  for (const r of replies) {
    r.replyToName = parentAuthorName;
    flatList.push(r);
    if (r.replies && r.replies.length > 0) {
      const authorName = r.author_nickname || r.author_name || '匿名';
      flatList = flatList.concat(flattenReplies(r.replies, authorName));
    }
  }
  return flatList;
}

// 采用 TikTok 级 UI 架构重写渲染
function renderCommentWithReplies(c, postId, depth = 0, parentAuthorName = '') {
  const nickname = c.author_nickname || c.author_name || '匿名';
  const avatarLetter = (nickname || '?')[0].toUpperCase();
  const timeStr = c.created_at ? formatTimeAgo(c.created_at) : '';
  const liked = likedComments.has(c.id);
  const replies = c.replies || [];
  const replyCount = c.reply_count || replies.length;

  // depth > 0 即为子回复
  const isSub = depth > 0;
  const avatarSize = isSub ? 24 : 32;

  // "回复 @某人" 的灰色高亮逻辑
  const replyToHtml = isSub && parentAuthorName && parentAuthorName !== nickname
    ? `<span class="tk-reply-to">回复 <span class="tk-reply-user">${escHtml(parentAuthorName)}</span>：</span>`
    : '';

  return `
    <div class="tk-comment-item ${isSub ? 'tk-sub-item' : ''}" id="comment-${c.id}">
      <div class="tk-avatar-col">
        ${c.author_avatar
          ? `<img src="${c.author_avatar}" class="tk-avatar" style="width:${avatarSize}px;height:${avatarSize}px">`
          : `<div class="tk-avatar-letter" style="width:${avatarSize}px;height:${avatarSize}px">${avatarLetter}</div>`}
      </div>

      <div class="tk-content-col">
        <div class="tk-username">${escHtml(nickname)}</div>
        <div class="tk-text">${replyToHtml}${escHtml(c.content || '')}</div>
        ${c.image_url ? `<img src="${c.image_url}" class="tk-comment-img" alt="">` : ''}

        <div class="tk-meta-row">
          <span class="tk-time">${escHtml(timeStr)}</span>
          <span class="tk-action-btn" data-action="reply" data-comment-id="${c.id}" data-post-id="${postId}" data-author="${escAttr(nickname)}">回复</span>
          ${window._currentUser && c.author_id === window._currentUser.id ? `
            <span class="tk-action-btn tk-danger" data-action="delete-comment" data-comment-id="${c.id}" data-post-id="${postId}">删除</span>
          ` : ''}

          <div class="tk-like-container ${liked ? 'liked' : ''}" data-action="like" data-comment-id="${c.id}" data-post-id="${postId}">
            <i class="${liked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            <span>${c.like_count || 0}</span>
          </div>
        </div>

        <div class="inline-reply-box" id="inline-reply-${c.id}">
          <div class="tk-inline-input-row">
            <input type="text" class="inline-reply-input" id="inline-reply-input-${c.id}" placeholder="回复 ${escAttr(nickname)}...">
            <label class="tk-inline-icon-btn">
              <i class="ri-image-line"></i>
              <input type="file" hidden accept="image/*" onchange="window._inlineReplyHandleFiles(this,${postId},${c.id})">
            </label>
            <button class="tk-inline-send-btn" data-action="send-reply" data-comment-id="${c.id}" data-post-id="${postId}">发送</button>
          </div>
          <div class="forum-editor-previews" id="inline-reply-previews-${c.id}"></div>
        </div>

        ${!isSub && replyCount > 0 ? `
          <div class="tk-replies-container" id="sub-list-${c.id}" style="display:none">
            ${flattenReplies(replies, nickname).map(r => renderCommentWithReplies(r, postId, 1, r.replyToName)).join('')}
          </div>
          <div class="tk-view-more-replies" data-action="toggle-sub" data-comment-id="${c.id}">
            <span class="tk-view-more-line"></span>
            <span class="toggle-text">展开 ${replyCount} 条回复</span>
            <i class="ri-arrow-down-s-line"></i>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/* ---- 评论事件 ---- */

function bindCommentEvents(el, postId) {
  const sendBtn = el.querySelector(`#comment-send-btn-${postId}`);
  const mainInput = el.querySelector(`#comment-main-input-${postId}`);
  sendBtn?.addEventListener('click', () => submitMainComment(postId));
  mainInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitMainComment(postId); });

  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const cid = Number(btn.dataset.commentId);
    const pid = Number(btn.dataset.postId);

    switch (action) {
      case 'reply':
        toggleInlineReply(cid, btn.dataset.author);
        break;
      case 'send-reply':
        submitInlineReply(pid, cid);
        break;
      case 'toggle-sub':
        toggleSubReplies(cid);
        break;
      case 'like':
        toggleLike(cid, pid);
        break;
      case 'delete-comment':
        deleteComment(pid, cid);
        break;
    }
  });
}

/* ---- 评论图片预览 ---- */

window._commentHandleFiles = function(input, postId) {
  const state = getCommentImages(postId);
  const maxImages = 9;
  const remaining = maxImages - state.files.length;
  if (remaining <= 0) {
    showToast(`最多只能添加 ${maxImages} 张图片`);
    input.value = '';
    return;
  }
  for (const file of Array.from(input.files).slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 20 * 1024 * 1024) { showToast('图片不能超过 20MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
  input.value = '';
  renderCommentPreviews(postId);
};

function renderCommentPreviews(postId) {
  const el = document.getElementById(`comment-previews-${postId}`);
  if (!el) return;
  const state = getCommentImages(postId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._commentRemoveImage(${postId},${i})">&times;</button>
    </div>
  `).join('');
}

window._commentRemoveImage = function(postId, index) {
  const state = getCommentImages(postId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
  renderCommentPreviews(postId);
};

/* ---- 行内回复图片预览 ---- */
const _inlineReplyImages = {};  // { commentId: { files, urls } }

function getInlineReplyImages(commentId) {
  if (!_inlineReplyImages[commentId]) _inlineReplyImages[commentId] = { files: [], urls: [] };
  return _inlineReplyImages[commentId];
}

window._inlineReplyHandleFiles = function(input, postId, commentId) {
  const state = getInlineReplyImages(commentId);
  const maxImages = 9;
  const remaining = maxImages - state.files.length;
  if (remaining <= 0) { showToast(`最多只能添加 ${maxImages} 张图片`); input.value = ''; return; }
  for (const file of Array.from(input.files).slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 20 * 1024 * 1024) { showToast('图片不能超过 20MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
  input.value = '';
  renderInlineReplyPreviews(commentId);
};

function renderInlineReplyPreviews(commentId) {
  const el = document.getElementById(`inline-reply-previews-${commentId}`);
  if (!el) return;
  const state = getInlineReplyImages(commentId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._inlineReplyRemoveImage(${commentId},${i})">&times;</button>
    </div>
  `).join('');
}

window._inlineReplyRemoveImage = function(commentId, index) {
  const state = getInlineReplyImages(commentId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
  renderInlineReplyPreviews(commentId);
};

async function submitMainComment(postId) {
  const input = document.getElementById(`comment-main-input-${postId}`);
  const content = input?.value?.trim();
  const state = getCommentImages(postId);
  if (!content && state.files.length === 0) return;

  if (state.files.length > 0) {
    const formData = new FormData();
    formData.append('content', content);
    state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
    try {
      const token = getToken();
      const res = await fetch(`/api/explore/posts/${postId}/comments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
    } catch { showToast('发送失败'); return; }
  } else {
    const res = await apiPost(`/api/explore/posts/${postId}/comments`, { content });
    if (res.error) { showToast(res.error); return; }
  }
  // 清理
  input.value = '';
  state.urls.forEach(u => URL.revokeObjectURL(u));
  _commentImages[postId] = { files: [], urls: [] };
  renderCommentPreviews(postId);
  showToast('评论成功');
  loadCommentsNew(postId);
}

function toggleInlineReply(commentId, authorName) {
  const box = document.getElementById(`inline-reply-${commentId}`);
  if (!box) return;
  const isOpen = box.classList.contains('open');
  document.querySelectorAll('.inline-reply-box.open').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    box.classList.add('open');
    const input = box.querySelector('.inline-reply-input');
    if (input) { input.placeholder = `回复 @${authorName}...`; input.value = ''; setTimeout(() => input.focus(), 100); }
  }
}

async function submitInlineReply(postId, parentCommentId) {
  const input = document.getElementById(`inline-reply-input-${parentCommentId}`);
  const content = input?.value?.trim();
  const state = getInlineReplyImages(parentCommentId);
  if (!content && state.files.length === 0) return;

  if (state.files.length > 0) {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('parent_id', parentCommentId);
    state.files.forEach((f, i) => formData.append(i === 0 ? 'image' : 'images', f));
    try {
      const token = getToken();
      const res = await fetch(`/api/explore/posts/${postId}/comments`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
    } catch { showToast('发送失败'); return; }
  } else {
    const res = await apiPost(`/api/explore/posts/${postId}/comments`, { content, parent_id: parentCommentId });
    if (res.error) { showToast(res.error); return; }
  }
  // 清理
  state.urls.forEach(u => URL.revokeObjectURL(u));
  delete _inlineReplyImages[parentCommentId];
  renderInlineReplyPreviews(parentCommentId);
  showToast('回复成功');
  loadCommentsNew(postId);
}

function toggleSubReplies(commentId) {
  const list = document.getElementById(`sub-list-${commentId}`);
  const toggleBar = document.querySelector(`[data-comment-id="${commentId}"][data-action="toggle-sub"]`);
  const text = toggleBar?.querySelector('.toggle-text');
  const arrow = toggleBar?.querySelector('i');
  if (!list) return;
  if (list.style.display === 'none' || list.style.display === '') {
    list.style.display = 'block';
    if (text) text.textContent = '收起回复';
    if (arrow) { arrow.className = 'ri-arrow-up-s-line'; }
  } else {
    list.style.display = 'none';
    if (text) text.textContent = `展开 ${list.children.length} 条回复`;
    if (arrow) { arrow.className = 'ri-arrow-down-s-line'; }
  }
}

// 点赞（localStorage）
const LIKED_STORAGE_KEY = 'explore_liked_comments';
const likedComments = new Set(
  (() => { try { return JSON.parse(localStorage.getItem(LIKED_STORAGE_KEY) || '[]'); } catch { return []; } })()
);

function toggleLike(commentId, postId) {
  const btn = document.querySelector(`[data-comment-id="${commentId}"][data-action="like"]`);
  if (!btn) return;
  const wasLiked = likedComments.has(commentId);
  const icon = btn.querySelector('i');
  const countSpan = btn.querySelector('span');
  let count = parseInt(countSpan?.textContent || '0');

  if (wasLiked) {
    likedComments.delete(commentId);
    count = Math.max(0, count - 1);
    icon.className = 'ri-heart-line';
    btn.classList.remove('liked');
  } else {
    likedComments.add(commentId);
    count++;
    icon.className = 'ri-heart-fill';
    btn.classList.add('liked');
  }
  countSpan.textContent = count;
  try { localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...likedComments])); } catch {}
}

async function deleteComment(postId, commentId) {
  openModal('确认删除', `
    <p style="margin-bottom:24px">确定要删除这条评论吗？</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-del-cmt" style="background:var(--md-error)">删除</button>
    </div>
  `);
  document.getElementById('confirm-del-cmt')?.addEventListener('click', async () => {
    const res = await apiDelete(`/api/explore/posts/${postId}/comments/${commentId}`);
    if (res.error) { showToast(res.error); } else { showToast('已删除'); loadCommentsNew(postId); }
    closeModal();
  });
}

/* =============================================
   我的发布页
   ============================================= */

registerPage('explore-my-posts', async (container) => {
  if (!isLoggedIn()) { navigateTo('explore'); return; }

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" onclick="navigateTo('explore')">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">我的发布</h1>
    </div>
    <div id="my-posts-list"><div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div></div>
  `;

  try {
    const user = window._currentUser;
    const data = await apiGet(`/api/explore/posts?pageSize=100&creator_id=${user?.id || 0}`);
    const posts = data.items || [];
    const listEl = container.querySelector('#my-posts-list');

    if (posts.length === 0) {
      listEl.innerHTML = `
        <div class="explore-empty">
          <div class="explore-empty-icon"><i class="ri-file-list-3-line"></i></div>
          <div class="explore-empty-text">还没有发布过内容</div>
        </div>`;
      return;
    }

    listEl.innerHTML = posts.map(p => renderPostCard(p)).join('');
    animStagger(Array.from(listEl.children), { y: 16, dur: 350, gap: 40 });

    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('.explore-post-card');
      if (card) navigateTo('explore-post-detail', card.dataset.postId);
    });
  } catch (e) {
    container.querySelector('#my-posts-list').innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
  }
});

/* =============================================
   工具函数
   ============================================= */

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  // 数据库存的是 UTC，补上 +08:00 时区
  let date = new Date(dateStr);
  if (isNaN(date.getTime())) date = new Date(dateStr + '+08:00');
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString('zh-CN');
}

/* =============================================
   页面注册
   ============================================= */

registerPage('explore', (container) => renderExplore(container));
