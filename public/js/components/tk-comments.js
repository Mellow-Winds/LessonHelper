/**
 * components/tk-comments.js — 统一评论区 UI 工具（tk-* 标准）
 * 供 detail.js / square.js / course_square.js / my_courses.js 共用
 *
 * 标准基于 explore.js 的 TikTok 风格评论系统：
 *   - 32px 圆形头像 + 用户名 + 正文 + 操作行 + 点赞（Remix 心形图标）
 *   - 扁平化楼中楼 + "展开 N 条回复" 切换
 *   - 单行输入框 + 图片上传 + 发送按钮
 */

import { escHtml, formatTimeAgo } from './ui.js';

/* =============================================
   楼中楼扁平化
   ============================================= */

export function flattenReplies(replies, parentAuthorName = '') {
  let flatList = [];
  for (const r of replies) {
    r._replyToName = parentAuthorName;
    flatList.push(r);
    if (r.replies && r.replies.length > 0) {
      const authorName = r.author_nickname || r.author_name || '匿名';
      flatList = flatList.concat(flattenReplies(r.replies, authorName));
    }
  }
  return flatList;
}

/* =============================================
   渲染单条评论（tk-* 标准 HTML）
   ============================================= */

/**
 * @param {Object} c       — 评论对象（已归一化字段）
 * @param {string} ctxId   — 上下文 ID（postId / courseId 等，用于 data 属性）
 * @param {number} depth   — 0=顶层, >0=子回复
 * @param {Object} opts    — 选项
 * @param {string} opts.deleteAction — 删除的 data-action 值
 * @param {string} opts.replyAction  — 回复的 data-action 值
 * @param {string} opts.likeStorageKey — localStorage key 前缀
 * @param {Set}    opts.likedSet     — 当前已点赞的评论 ID Set
 */
export function renderTkComment(c, ctxId, depth = 0, opts = {}) {
  const {
    deleteAction = 'delete-comment',
    replyAction = 'reply',
  } = opts;

  const nickname = c.author_nickname || c.author_name || '匿名';
  const avatarUrl = c.author_avatar || c.author_avatar_url || '';
  const avatarLetter = (nickname || '?')[0].toUpperCase();
  const timeStr = c.created_at ? formatTimeAgo(c.created_at) : '';
  const liked = opts.likedSet ? opts.likedSet.has(c.id) : false;
  const replies = c.replies || [];
  const replyCount = c.reply_count || replies.length;
  const isSub = depth > 0;
  const avatarSize = isSub ? 24 : 32;

  const replyToHtml = isSub && c._replyToName
    ? `<span class="tk-reply-to">回复 <span class="tk-reply-user">${escHtml(c._replyToName)}</span>：</span>`
    : '';

  const isOwner = window._currentUser && c.author_id === window._currentUser.id;

  return `
    <div class="tk-comment-item ${isSub ? 'tk-sub-item' : ''}" id="tk-comment-${c.id}">
      <div class="tk-avatar-col">
        ${avatarUrl
          ? `<img src="${escHtml(avatarUrl)}" class="tk-avatar" style="width:${avatarSize}px;height:${avatarSize}px" alt="">`
          : `<div class="tk-avatar-letter" style="width:${avatarSize}px;height:${avatarSize}px">${avatarLetter}</div>`}
      </div>

      <div class="tk-content-col">
        <div class="tk-username">${escHtml(nickname)}</div>
        <div class="tk-text">${replyToHtml}${escHtml(c.content || '')}</div>
        ${c.image_url ? `<img src="${escHtml(c.image_url)}" class="tk-comment-img" alt="">` : ''}

        <div class="tk-meta-row">
          <span class="tk-time">${escHtml(timeStr)}</span>
          <span class="tk-action-btn" data-action="${replyAction}" data-comment-id="${c.id}" data-ctx-id="${ctxId}" data-author="${escHtml(nickname)}">回复</span>
          ${isOwner ? `
            <span class="tk-action-btn tk-danger" data-action="${deleteAction}" data-comment-id="${c.id}" data-ctx-id="${ctxId}">删除</span>
          ` : ''}

          <div class="tk-like-container ${liked ? 'liked' : ''}" data-action="tk-like" data-comment-id="${c.id}" data-ctx-id="${ctxId}">
            <i class="${liked ? 'ri-heart-fill' : 'ri-heart-line'}"></i>
            <span>${c.like_count || 0}</span>
          </div>
        </div>

        <div class="inline-reply-box" id="inline-reply-${c.id}">
          <div class="tk-inline-input-row">
            <input type="text" class="inline-reply-input" id="inline-reply-input-${c.id}" placeholder="回复 ${escHtml(nickname)}...">
            <label class="tk-inline-icon-btn">
              <i class="ri-image-line"></i>
              <input type="file" hidden accept="image/*" onchange="window._tkReplyHandleFiles(this,${ctxId},${c.id})">
            </label>
            <button class="tk-inline-send-btn" data-action="${replyAction}-send" data-comment-id="${c.id}" data-ctx-id="${ctxId}">发送</button>
          </div>
          <div class="forum-editor-previews" id="inline-reply-previews-${c.id}"></div>
        </div>

        ${!isSub && replyCount > 0 ? `
          <div class="tk-replies-container" id="sub-list-${c.id}" style="display:none">
            ${flattenReplies(replies, nickname).map(r => renderTkComment(r, ctxId, 1, opts)).join('')}
          </div>
          <div class="tk-view-more-replies" data-action="tk-toggle-sub" data-comment-id="${c.id}">
            <span class="tk-view-more-line"></span>
            <span class="toggle-text">展开 ${replyCount} 条回复</span>
            <i class="ri-arrow-down-s-line"></i>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/* =============================================
   评论输入区 HTML（底部固定栏）
   ============================================= */

export function renderTkInputArea(ctxId, placeholder = '说点什么...') {
  return `
    <div class="comment-input-area" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;align-items:center;gap:var(--space-3)">
        <div class="comment-input-wrapper" style="flex:1">
          <input type="text" class="comment-main-input" id="comment-main-input-${ctxId}" placeholder="${escHtml(placeholder)}">
          <label class="comment-input-img-btn" title="选择图片">
            <i class="ri-image-line"></i>
            <input type="file" style="position:absolute;width:0;height:0;opacity:0;overflow:hidden" accept="image/*" multiple id="comment-img-input-${ctxId}" onchange="window._tkCommentHandleFiles(this,${ctxId})">
          </label>
        </div>
        <button class="comment-send-btn" id="comment-send-btn-${ctxId}">发送</button>
      </div>
      <div class="forum-editor-previews" id="comment-previews-${ctxId}"></div>
    </div>
  `;
}

/* =============================================
   通用 DOM 操作
   ============================================= */

export function toggleSubReplies(commentId) {
  const list = document.getElementById(`sub-list-${commentId}`);
  const toggleBar = document.querySelector(`[data-comment-id="${commentId}"][data-action="tk-toggle-sub"]`);
  const text = toggleBar?.querySelector('.toggle-text');
  const arrow = toggleBar?.querySelector('i');
  if (!list) return;

  const isOpen = list.dataset.subOpen === 'true';

  if (!isOpen) {
    // 展开：用 max-height 做平滑动画
    list.style.display = 'block';
    list.style.overflow = 'hidden';
    list.style.maxHeight = '0';
    list.style.opacity = '0';
    list.style.transition = 'max-height 0.35s var(--ease-standard), opacity 0.25s var(--ease-standard)';
    list.dataset.subOpen = 'true';
    requestAnimationFrame(() => {
      list.style.maxHeight = list.scrollHeight + 'px';
      list.style.opacity = '1';
    });
    if (text) text.textContent = '收起回复';
    if (arrow) arrow.className = 'ri-arrow-up-s-line';
  } else {
    // 收起：max-height → 0
    list.style.maxHeight = list.scrollHeight + 'px';
    list.style.overflow = 'hidden';
    list.style.transition = 'max-height 0.3s var(--ease-standard), opacity 0.15s var(--ease-accelerate)';
    list.dataset.subOpen = 'false';
    requestAnimationFrame(() => {
      list.style.maxHeight = '0';
      list.style.opacity = '0';
    });
    var onDone = function() {
      list.removeEventListener('transitionend', onDone);
      if (list.dataset.subOpen === 'false') {
        list.style.display = 'none';
      }
    };
    list.addEventListener('transitionend', onDone, { once: true });
    if (text) text.textContent = '展开 ' + list.children.length + ' 条回复';
    if (arrow) arrow.className = 'ri-arrow-down-s-line';
  }
}

export function toggleInlineReply(commentId, authorName) {
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

/* =============================================
   点赞（localStorage 持久化）
   ============================================= */

export function getLikedSet(storageKey) {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return new Set();
  }
}

export function toggleLike(commentId, storageKey) {
  const likedSet = getLikedSet(storageKey);
  const btn = document.querySelector(`[data-comment-id="${commentId}"][data-action="tk-like"]`);
  if (!btn) return;
  const wasLiked = likedSet.has(commentId);
  const icon = btn.querySelector('i');
  const countSpan = btn.querySelector('span');
  let count = parseInt(countSpan?.textContent || '0');

  if (wasLiked) {
    likedSet.delete(commentId);
    count = Math.max(0, count - 1);
    if (icon) icon.className = 'ri-heart-line';
    btn.classList.remove('liked');
  } else {
    likedSet.add(commentId);
    count++;
    if (icon) icon.className = 'ri-heart-fill';
    btn.classList.add('liked');
  }
  if (countSpan) countSpan.textContent = count;
  try { localStorage.setItem(storageKey, JSON.stringify([...likedSet])); } catch {}
}

/* =============================================
   图片预览管理
   ============================================= */

const _tkImages = {}; // { ctxId: { files, urls } }
const _tkReplyImages = {}; // { commentId: { files, urls } }

export function getTkImages(ctxId) {
  if (!_tkImages[ctxId]) _tkImages[ctxId] = { files: [], urls: [] };
  return _tkImages[ctxId];
}

export function getTkReplyImages(commentId) {
  if (!_tkReplyImages[commentId]) _tkReplyImages[commentId] = { files: [], urls: [] };
  return _tkReplyImages[commentId];
}

export function clearTkImages(ctxId) {
  const state = _tkImages[ctxId];
  if (state) { state.urls.forEach(u => URL.revokeObjectURL(u)); }
  _tkImages[ctxId] = { files: [], urls: [] };
}

export function clearTkReplyImages(commentId) {
  const state = _tkReplyImages[commentId];
  if (state) { state.urls.forEach(u => URL.revokeObjectURL(u)); }
  delete _tkReplyImages[commentId];
}

export function addTkImages(ctxId, files, maxFiles, maxSize, toastFn) {
  const state = getTkImages(ctxId);
  const remaining = maxFiles - state.files.length;
  if (remaining <= 0) { if (toastFn) toastFn(`最多只能添加 ${maxFiles} 张图片`); return; }
  for (const file of Array.from(files).slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxSize) { if (toastFn) toastFn('图片不能超过 20MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
}

export function addTkReplyImages(commentId, files, maxFiles, maxSize, toastFn) {
  const state = getTkReplyImages(commentId);
  const remaining = maxFiles - state.files.length;
  if (remaining <= 0) { if (toastFn) toastFn(`最多只能添加 ${maxFiles} 张图片`); return; }
  for (const file of Array.from(files).slice(0, remaining)) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > maxSize) { if (toastFn) toastFn('图片不能超过 20MB'); continue; }
    state.files.push(file);
    state.urls.push(URL.createObjectURL(file));
  }
}

export function removeTkImage(ctxId, index) {
  const state = getTkImages(ctxId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
}

export function removeTkReplyImage(commentId, index) {
  const state = getTkReplyImages(commentId);
  if (state.urls[index]) URL.revokeObjectURL(state.urls[index]);
  state.files.splice(index, 1);
  state.urls.splice(index, 1);
}

export function renderTkPreviews(ctxId) {
  const el = document.getElementById(`comment-previews-${ctxId}`);
  if (!el) return;
  const state = getTkImages(ctxId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._tkRemoveImage(${ctxId},${i})">&times;</button>
    </div>
  `).join('');
}

export function renderTkReplyPreviews(commentId) {
  const el = document.getElementById(`inline-reply-previews-${commentId}`);
  if (!el) return;
  const state = getTkReplyImages(commentId);
  if (state.urls.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = state.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="window._tkRemoveReplyImage(${commentId},${i})">&times;</button>
    </div>
  `).join('');
}

/* =============================================
   事件委托绑定
   ============================================= */

/**
 * 绑定评论区通用事件（回复/删除/点赞/展开子回复）
 * @param {HTMLElement} el      — 评论区容器
 * @param {Object} callbacks    — { onReply, onDelete, onLike, onSubmitReply, onToggleSub }
 */
export function bindTkCommentEvents(el, callbacks = {}) {
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const cid = Number(btn.dataset.commentId);
    const ctxId = Number(btn.dataset.ctxId);

    switch (action) {
      case 'tk-reply':
      case 'reply':
        toggleInlineReply(cid, btn.dataset.author);
        break;
      case 'tk-reply-send':
      case 'reply-send':
        if (callbacks.onSubmitReply) callbacks.onSubmitReply(ctxId, cid);
        break;
      case 'tk-toggle-sub':
        toggleSubReplies(cid);
        break;
      case 'tk-like':
        if (callbacks.onLike) callbacks.onLike(cid);
        else toggleLike(cid, 'tk_liked_comments');
        break;
      case 'tk-delete-comment':
      case 'delete-comment':
        if (callbacks.onDelete) callbacks.onDelete(ctxId, cid);
        break;
    }
  });
}

/* =============================================
   全局文件处理（供 inline onchange/onclick 调用）
   ============================================= */

window._tkCommentHandleFiles = function(input, ctxId) {
  addTkImages(ctxId, input.files, 9, 20 * 1024 * 1024, (msg) => {
    if (typeof showToast === 'function') showToast(msg);
  });
  input.value = '';
  renderTkPreviews(ctxId);
};

window._tkRemoveImage = function(ctxId, index) {
  removeTkImage(ctxId, index);
  renderTkPreviews(ctxId);
};

window._tkReplyHandleFiles = function(input, ctxId, commentId) {
  addTkReplyImages(commentId, input.files, 9, 20 * 1024 * 1024, (msg) => {
    if (typeof showToast === 'function') showToast(msg);
  });
  input.value = '';
  renderTkReplyPreviews(commentId);
};

window._tkRemoveReplyImage = function(commentId, index) {
  removeTkReplyImage(commentId, index);
  renderTkReplyPreviews(commentId);
};
