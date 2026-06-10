/**
 * pages/explore.js — 发现页（组件化卡片系统）
 * 统一帖子流 + 搜索筛选
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
  // 清理旧定时器
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  // 恢复 localStorage 中的冷却状态
  loadExploreCooldowns();

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

  // 渲染 MD3 搜索输入框
  const searchBarEl = container.querySelector('#explore-search-bar');
  if (searchBarEl) {
    searchBarEl.innerHTML = createMdInput({
      id: 'explore-search',
      label: '搜索',
      placeholder: ' ',
      value: _keyword
    });
  }

  // 绑定事件
  bindExploreEvents(container);

  // 加载帖子
  _posts = [];
  _page = 1;
  _hasMore = true;
  await loadPosts(container);
}

/* =============================================
   事件绑定
   ============================================= */

function bindExploreEvents(container) {
  // 发布按钮
  container.querySelector('#explore-publish-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      showToast('请先登录');
      return;
    }
    navigateTo('explore-post-editor');
  });

  // 我的发布
  container.querySelector('#explore-my-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) {
      showToast('请先登录');
      return;
    }
    navigateTo('explore-my-posts');
  });

  // 搜索框
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

  // 帖子点击 → 详情
  container.querySelector('#explore-posts-list')?.addEventListener('click', (e) => {
    const postCard = e.target.closest('.explore-post-card');
    if (!postCard) return;
    const postId = postCard.dataset.postId;
    if (postId) navigateTo('explore-post-detail', postId);
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
      // 不使用 explore-posts-grid 的 columns 布局，独立渲染居中卡片
      listEl.style.display = 'block';
      listEl.style.columns = 'auto';
      listEl.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">inbox</span>
          <p class="text-secondary" style="margin-top:12px">还没有帖子</p>
          <p class="text-secondary">点击右下角「发布」创建第一条内容</p>
        </div>`;
      loadMoreEl.innerHTML = '';
      return;
    } else {
      // 恢复网格布局
      listEl.style.display = '';
      listEl.style.columns = '';
    }

    _posts.push(...newItems);

    // 渲染新帖子
    const newCards = [];
    for (const post of newItems) {
      const el = document.createElement('div');
      el.innerHTML = renderPostCard(post);
      const cardEl = el.firstElementChild;
      listEl.appendChild(cardEl);
      newCards.push(cardEl);
    }

    // 动画
    animStagger(newCards, { y: 16, dur: 350, gap: 40 });

    // 启动倒计时
    _timerInterval = startTimers(listEl);

    // 加载更多
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

    // 帖子作者可见编辑 + 删除按钮
    if (post.creator_id && window._currentUser?.id === post.creator_id) {
      const placeholder = container.querySelector('#detail-delete-btn-placeholder');
      if (placeholder) {
        placeholder.style.cssText = 'display:flex;gap:6px;margin-left:auto';
        placeholder.innerHTML = `
          <button class="btn btn-secondary btn-compact" id="detail-edit-btn">
            <i class="ri-edit-line"></i> 编辑
          </button>
          <button class="btn btn-secondary btn-compact" id="detail-delete-btn" style="color:var(--md-error)">
            <i class="ri-delete-bin-line"></i> 删除
          </button>`;
        placeholder.querySelector('#detail-edit-btn')?.addEventListener('click', () => {
          navigateTo('explore-post-editor', post.id);
        });
        placeholder.querySelector('#detail-delete-btn')?.addEventListener('click', () => {
          openModal('确认删除', `
            <p style="margin-bottom:24px">确定要删除这篇帖子吗？删除后无法恢复。</p>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-secondary" onclick="closeModal()">取消</button>
              <button class="btn btn-primary" id="confirm-delete-post" style="background:var(--md-error,#e53935)">删除</button>
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

function renderPostDetail(el, post) {
  const nickname = post.creator_nickname || post.creator_name || '匿名';
  const timeStr = new Date(post.created_at).toLocaleString('zh-CN');
  const isOwner = post.creator_id && window._currentUser?.id === post.creator_id;

  // 从 blocks 渲染混合内容（文字 + 卡片交替）
  // 兼容新旧格式：新格式用 post.blocks，旧格式用 post.content + post.cards
  let blocks = post.blocks || [];

  // 如果没有 blocks 但有 content，尝试解析为 JSON blocks
  if (blocks.length === 0 && post.content) {
    try {
      const parsed = JSON.parse(post.content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
        blocks = parsed;
      }
    } catch (e) { /* 不是 JSON，按纯文本处理 */ }
  }

  let contentHtml = '';

  if (blocks.length > 0) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type === 'text' && block.data) {
        contentHtml += `<div class="post-text-block">${renderMarkdown(block.data)}</div>`;
      } else if (block.type === 'card' && block.card) {
        contentHtml += `<div class="explore-card-wrapper" data-block-index="${i}">`;
        contentHtml += renderCard(block.card, { compact: false, showActions: true, isOwner });
        contentHtml += `</div>`;
      }
    }
  } else {
    // 纯文本 fallback
    if (post.content) {
      contentHtml += `<div class="post-text-block">${renderMarkdown(post.content)}</div>`;
    }
    if (post.cards && post.cards.length > 0) {
      contentHtml += post.cards.map(card => renderCard(card, { compact: false, showActions: true, isOwner })).join('');
    }
  }

  el.innerHTML = `
    <div class="explore-detail">
      <div class="explore-detail-header">
        <div class="explore-post-meta">
          <span class="text-secondary">${timeStr}</span>
          <span class="text-secondary">${nickname}</span>
        </div>
        <h2 class="explore-post-title" style="font-size:var(--text-xl)">${escHtml(post.title)}</h2>
      </div>

      <div class="explore-detail-content">${contentHtml}</div>

      <div class="explore-detail-comments">
        <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">chat</span> 评论 (${post.comment_count || 0})</h3>
        <div id="explore-comments-${post.id}"></div>
      </div>
    </div>
  `;

  // 启动倒计时
  _timerInterval = startTimers(el);

  // 绑定卡片交互（复制 + 编辑）
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

  // 加载评论（论坛风格）
  toggleExploreComments(post.id);
}

/**
 * 卡片编辑弹窗
 */
function openCardEditModal(post, blocks, blockIndex, detailEl) {
  const card = blocks[blockIndex].card;
  if (!card) return;

  const components = card.components || [];
  let fieldsHtml = '';

  // 卡片标题
  fieldsHtml += createMdInput({
    id: 'card-edit-title',
    label: '卡片标题',
    placeholder: ' ',
    value: card.title || ''
  });

  // 每个组件渲染为可编辑字段
  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const fieldId = `card-edit-field-${i}`;
    fieldsHtml += createMdInput({
      id: fieldId,
      label: comp.label || `字段 ${i + 1}`,
      placeholder: ' ',
      value: comp.value || ''
    });
  }

  openModal('编辑卡片', `
    <div style="display:flex;flex-direction:column;gap:16px;max-height:60vh;overflow-y:auto;padding-right:4px">
      ${fieldsHtml}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="confirm-card-edit">保存</button>
    </div>
  `);

  document.getElementById('confirm-card-edit')?.addEventListener('click', async () => {
    // 更新卡片标题
    const newTitle = document.getElementById('card-edit-title')?.value?.trim() || '';
    card.title = newTitle;

    // 更新各组件值
    for (let i = 0; i < components.length; i++) {
      const fieldEl = document.getElementById(`card-edit-field-${i}`);
      if (fieldEl) {
        components[i].value = fieldEl.value || '';
      }
    }

    // 更新 blocks
    blocks[blockIndex].card = card;

    // 保存到后端
    const res = await apiPost(`/api/explore/posts/${post.id}`, {
      _method: 'PUT',
      content: JSON.stringify(blocks)
    });
    // apiPost doesn't support PUT directly, use fetch
    const token = getToken && getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const fetchRes = await fetch(`/api/explore/posts/${post.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ content: JSON.stringify(blocks) })
    });
    const result = await fetchRes.json();

    if (result.error) { showToast(result.error); return; }
    closeModal();
    showToast('已更新');
    // 刷新详情
    if (detailEl) {
      const updatedPost = { ...post, blocks, content: JSON.stringify(blocks) };
      renderPostDetail(detailEl, updatedPost);
    }
  });
}

/* =============================================
   论坛风格评论系统（复用 square.js 模式）
   ============================================= */

const _exploreExpandedReplies = {};
const _exploreReplyImages = {};
const _exploreCooldownTimers = {};     // { postId: secondsRemaining }
const _exploreCooldownTicking = new Set();  // 防重复 tick
const COOLDOWN_STORAGE_KEY = 'lc_cooldowns';  // localStorage key

// 读取 localStorage 中的冷却记录，恢复未过期的计时器
function loadExploreCooldowns() {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);  // { postId: endTimestamp }
    const now = Date.now();
    for (const [postId, endTime] of Object.entries(data)) {
      const remaining = Math.ceil((endTime - now) / 1000);
      if (remaining > 0) {
        const pid = Number(postId);
        _exploreCooldownTimers[pid] = remaining;
        if (!_exploreCooldownTicking.has(pid)) resumeExploreCooldownTick(pid);
      }
    }
    // 清理过期条目
    cleanExploreCooldownStorage();
  } catch { /* ignore */ }
}

function saveExploreCooldown(postId) {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[postId] = Date.now() + 30000;
    localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function removeExploreCooldown(postId) {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    delete data[postId];
    if (Object.keys(data).length === 0) {
      localStorage.removeItem(COOLDOWN_STORAGE_KEY);
    } else {
      localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(data));
    }
  } catch { /* ignore */ }
}

function cleanExploreCooldownStorage() {
  try {
    const raw = localStorage.getItem(COOLDOWN_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const now = Date.now();
    let changed = false;
    for (const [postId, endTime] of Object.entries(data)) {
      if (endTime <= now) { delete data[postId]; changed = true; }
    }
    if (changed) {
      if (Object.keys(data).length === 0) localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      else localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(data));
    }
  } catch { /* ignore */ }
}

function startExploreCooldown(postId, ctxKey) {
  _exploreCooldownTimers[postId] = 30;
  saveExploreCooldown(postId);
  const btn = document.getElementById(`explore-send-${ctxKey}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span style="font-size:11px">重新发送(30s)</span>';
  }
  resumeExploreCooldownTick(postId);
}

function resumeExploreCooldownTick(postId) {
  _exploreCooldownTicking.add(postId);
  const tick = () => {
    const remaining = _exploreCooldownTimers[postId];
    if (!remaining || remaining <= 0) {
      delete _exploreCooldownTimers[postId];
      _exploreCooldownTicking.delete(postId);
      removeExploreCooldown(postId);
      // 仅恢复属于本 post 的冷却按钮
      document.querySelectorAll(`[id^="explore-send-"][data-post-id="${postId}"]`).forEach(b => {
        if (!b.disabled) return;
        b.disabled = false;
        b.innerHTML = '<span class="mi">send</span>';
      });
      return;
    }
    _exploreCooldownTimers[postId] = remaining - 1;
    // 仅更新属于本 post 的冷却按钮文字
    document.querySelectorAll(`[id^="explore-send-"][data-post-id="${postId}"]`).forEach(b => {
      if (b.disabled && b.innerHTML.includes('重新发送')) {
        b.innerHTML = `<span style="font-size:11px">重新发送(${remaining - 1}s)</span>`;
      }
    });
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function renderExploreCommentImages(imageUrlStr) {
  if (!imageUrlStr) return '';
  const urls = imageUrlStr.split(';').filter(Boolean);
  if (urls.length === 0) return '';
  if (urls.length === 1) {
    return `<a href="${urls[0]}" target="_blank" rel="noopener"><img class="forum-reply-image" src="${urls[0]}" alt="评论图片" loading="lazy"></a>`;
  }
  return `<div class="forum-image-grid">${urls.map(url => `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="评论图片" loading="lazy"></a>`).join('')}</div>`;
}

async function toggleExploreComments(postId) {
  const section = document.getElementById(`explore-comments-${postId}`);
  if (!section) return;

  section.innerHTML = '<p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">加载中...</p>';

  try {
    const data = await apiGet(`/api/explore/posts/${postId}/comments`);

    // 递归展平后端返回的嵌套 replies，使 childMap 能捕获所有层级的楼中楼
    function flattenReplies(comment) {
      const result = [];
      if (comment.replies && comment.replies.length) {
        comment.replies.forEach(r => {
          result.push(r);
          result.push(...flattenReplies(r));
        });
      }
      return result;
    }

    const topComments = data.items || [];
    const allComments = [];
    topComments.forEach(c => {
      allComments.push(c);
      allComments.push(...flattenReplies(c));
    });

    const childMap = {};
    allComments.forEach(c => {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    });

    if (topComments.length === 0) {
      section.innerHTML = `
        <div class="forum-reply-section">
          <p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">暂无回复</p>
          <div id="explore-inline-post-${postId}"></div>
          ${isLoggedIn() ? `<button class="forum-action-btn" data-action="explore-reply-post" data-post-id="${postId}" style="margin-top:4px"><span class="mi" style="font-size:14px">chat_bubble_outline</span> 写回复</button>` : '<p class="text-secondary" style="font-size:12px"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
        </div>
      `;
    } else {
      section.innerHTML = `
        <div class="forum-reply-section">
          ${topComments.map(c => renderExploreForumComment(c, postId, childMap)).join('')}
          <div id="explore-inline-post-${postId}"></div>
          ${isLoggedIn() ? `<button class="forum-action-btn" data-action="explore-reply-post" data-post-id="${postId}" style="margin-top:4px"><span class="mi" style="font-size:14px">chat_bubble_outline</span> 写回复</button>` : ''}
        </div>
      `;
    }

    bindExploreForumEvents(section, postId);
  } catch {
    section.innerHTML = '<p style="font-size:12px;color:var(--md-error);padding:8px 0">加载失败，点击重试</p>';
    section.style.cursor = 'pointer';
    section.onclick = () => { section.onclick = null; toggleExploreComments(postId); };
  }
}

function renderExploreForumComment(c, postId, childMap) {
  const displayName = c.author_nickname || c.author_name || '匿名';
  const avatarLetter = (displayName || '?')[0].toUpperCase();
  const children = childMap[c.id] || [];
  const previewChildren = children.slice(-2);
  const hiddenCount = children.length - previewChildren.length;
  const isExpanded = _exploreExpandedReplies[c.id];
  const timeStr = c.created_at ? new Date(c.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  return `
    <div class="forum-reply-row" id="explore-comment-${c.id}">
      <div>
        ${c.author_avatar
          ? `<img class="forum-reply-avatar" src="${c.author_avatar}" alt="" data-action="explore-navigate-profile" data-user-id="${c.author_id}" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" data-action="explore-navigate-profile" data-user-id="${c.author_id}" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" data-action="explore-navigate-profile" data-user-id="${c.author_id}">${escHtml(displayName)}</button>
            <span class="forum-reply-time">${escHtml(timeStr)}</span>
          </div>
        </div>
        <p class="forum-reply-text">${escHtml(c.content || '')}</p>
        ${renderExploreCommentImages(c.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" data-action="explore-reply-comment" data-post-id="${postId}" data-comment-id="${c.id}">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
          ${window._currentUser && c.author_id === window._currentUser.id ? `<button class="forum-action-btn" data-action="explore-delete-comment" data-post-id="${postId}" data-comment-id="${c.id}" style="color:var(--md-error)"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
        <div id="explore-inline-comment-${c.id}"></div>
        ${children.length > 0 ? `
          ${isExpanded ? `
            <div class="forum-nested-replies">
              ${children.map(child => renderExploreNestedReply(child, displayName, c.author_id, postId, childMap)).join('')}
            </div>
            <button class="forum-view-replies" data-action="explore-toggle-replies" data-comment-id="${c.id}" data-post-id="${postId}">── 收起回复 🔼</button>
          ` : `
            ${previewChildren.length > 0 ? `
              <div class="forum-nested-replies">
                ${previewChildren.map(child => renderExploreNestedReply(child, c.author_name, c.author_id, postId, childMap)).join('')}
              </div>
            ` : ''}
            ${hiddenCount > 0 ? `
              <button class="forum-view-replies" data-action="explore-toggle-replies" data-comment-id="${c.id}" data-post-id="${postId}">── 查看更多 ${hiddenCount} 条回复 🔽</button>
            ` : ''}
          `}
        ` : ''}
      </div>
    </div>
  `;
}

function renderExploreNestedReply(child, parentAuthorName, parentAuthorId, postId, childMap, depth = 1) {
  const childDisplayName = child.author_nickname || child.author_name || '匿名';
  const avatarLetter = (childDisplayName || '?')[0].toUpperCase();
  const timeStr = child.created_at ? new Date(child.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const grandchildren = childMap[child.id] || [];
  const maxDepth = 10;
  const childrenHtml = (grandchildren.length > 0 && depth <= maxDepth)
    ? `<div class="forum-nested-replies">${grandchildren.map(c =>
        renderExploreNestedReply(c, childDisplayName, child.author_id, postId, childMap, depth + 1)
      ).join('')}</div>`
    : '';

  return `
    <div class="forum-nested-reply">
      <div>
        ${child.author_avatar
          ? `<img class="forum-reply-avatar" src="${child.author_avatar}" alt="" data-action="explore-navigate-profile" data-user-id="${child.author_id}" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" data-action="explore-navigate-profile" data-user-id="${child.author_id}" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" data-action="explore-navigate-profile" data-user-id="${child.author_id}">${escHtml(childDisplayName)}</button>
            <span class="forum-reply-to">回复 <button class="forum-reply-link" data-action="explore-navigate-profile" data-user-id="${parentAuthorId}">${escHtml(parentAuthorName || '')}</button></span>
            <span class="forum-reply-time">${escHtml(timeStr)}</span>
          </div>
        </div>
        <p class="forum-reply-text">${escHtml(child.content || '')}</p>
        ${renderExploreCommentImages(child.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" data-action="explore-reply-nested" data-post-id="${postId}" data-comment-id="${child.id}">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
          ${window._currentUser && child.author_id === window._currentUser.id ? `<button class="forum-action-btn" data-action="explore-delete-comment" data-post-id="${postId}" data-comment-id="${child.id}" style="color:var(--md-error)"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
        </div>
        <div id="explore-inline-comment-${child.id}"></div>
        ${childrenHtml}
      </div>
    </div>
  `;
}

function bindExploreForumEvents(root, postId) {
  if (root._forumBound) return;
  root._forumBound = true;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const pId = Number(btn.dataset.postId) || postId;
    const commentId = Number(btn.dataset.commentId);

    switch (action) {
      case 'explore-reply-post':
        openExploreInlineEditor(postId, null, `post-${postId}`);
        break;
      case 'explore-reply-comment':
        openExploreInlineEditor(postId, commentId, `comment-${commentId}`);
        break;
      case 'explore-reply-nested':
        openExploreInlineEditor(postId, commentId, `nested-${commentId}`);
        break;
      case 'explore-toggle-replies':
        _exploreExpandedReplies[commentId] = !_exploreExpandedReplies[commentId];
        toggleExploreComments(postId);
        break;
      case 'explore-delete-comment':
        openModal('确认删除', `
          <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-primary" id="confirm-explore-delete" style="background:var(--md-error,#e53935)">删除</button>
          </div>
        `);
        document.getElementById('confirm-explore-delete')?.addEventListener('click', async () => {
          const result = await apiDelete(`/api/explore/posts/${pId}/comments/${commentId}`);
          if (result.error) { showToast(result.error); closeModal(); return; }
          closeModal();
          toggleExploreComments(postId);
          showToast('已删除');
        });
        break;
      case 'explore-navigate-profile':
        navigateTo('profile-user', Number(btn.dataset.userId));
        break;
    }
  });
}

function openExploreInlineEditor(postId, parentCommentId, ctxKey) {
  const containerId = parentCommentId
    ? `explore-inline-comment-${parentCommentId}`
    : `explore-inline-post-${postId}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  if (container.innerHTML.trim() !== '') {
    closeExploreInlineEditor(ctxKey);
    return;
  }

  // 关闭其他已打开的编辑器
  document.querySelectorAll('[id^="explore-inline-"]').forEach(el => {
    if (el.id !== containerId && el.innerHTML.trim() !== '') {
      el.innerHTML = '';
    }
  });

  _exploreReplyImages[ctxKey] = { files: [], urls: [] };

  const cooldown = _exploreCooldownTimers[postId] || 0;
  const sendDisabled = cooldown > 0;
  const sendLabel = cooldown > 0 ? `重新发送(${cooldown}s)` : '';

  container.innerHTML = `
    <div class="forum-inline-editor">
      <div class="forum-editor-row">
        <textarea class="forum-editor-textarea" id="explore-textarea-${ctxKey}"
          placeholder=" " rows="1"></textarea>
        <div class="forum-editor-actions">
          <input type="file" id="explore-file-${ctxKey}" accept="image/jpeg,image/png"
            style="display:none" onchange="window._handleExploreReplyImageChange('${ctxKey}', ${postId})">
          <button class="forum-editor-btn forum-editor-camera" onclick="document.getElementById('explore-file-${ctxKey}').click()" title="添加图片">
            <span class="mi">photo_camera</span>
          </button>
          <button class="forum-editor-btn forum-editor-send" id="explore-send-${ctxKey}"
            data-post-id="${postId}"
            onclick="window._submitExploreForumReply(${postId}, ${parentCommentId || 'null'}, '${ctxKey}')"
            ${sendDisabled ? 'disabled' : ''}>
            ${sendDisabled ? `<span style="font-size:11px">${sendLabel}</span>` : '<span class="mi">send</span>'}
          </button>
        </div>
      </div>
      <div class="forum-editor-previews" id="explore-previews-${ctxKey}"></div>
    </div>
  `;

  setTimeout(() => {
    const textarea = document.getElementById(`explore-textarea-${ctxKey}`);
    if (textarea) textarea.focus();
  }, 150);

  // 失焦自动关闭
  setTimeout(() => {
    const editorDiv = container.querySelector('.forum-inline-editor');
    if (!editorDiv) return;
    editorDiv.addEventListener('focusout', () => {
      setTimeout(() => {
        if (editorDiv.contains(document.activeElement)) return;
        const ta = editorDiv.querySelector('textarea');
        if (ta && ta.value.trim()) return;
        const imgs = _exploreReplyImages[ctxKey];
        if (imgs && imgs.files.length > 0) return;
        closeExploreInlineEditor(ctxKey);
      }, 300);
    });
  }, 200);
}

function closeExploreInlineEditor(ctxKey) {
  const textarea = document.getElementById(`explore-textarea-${ctxKey}`);
  if (!textarea) return;
  const container = textarea.closest('.forum-inline-editor')?.parentElement;
  if (container) container.innerHTML = '';
  delete _exploreReplyImages[ctxKey];
}

// 全局函数供 inline onclick 调用
window._handleExploreReplyImageChange = function(ctxKey, postId) {
  const input = document.getElementById(`explore-file-${ctxKey}`);
  if (!input) return;
  const files = Array.from(input.files);
  if (files.length === 0) return;
  if (files.some(f => !f.type.startsWith('image/'))) { showToast('仅支持图片文件'); input.value = ''; return; }
  if (files.some(f => f.size > 1 * 1024 * 1024)) { showToast('图片不能超过 1MB'); input.value = ''; return; }

  _exploreReplyImages[ctxKey] = { files: [files[0]], urls: [URL.createObjectURL(files[0])] };
  const container = document.getElementById(`explore-previews-${ctxKey}`);
  if (container) {
    container.innerHTML = _exploreReplyImages[ctxKey].urls.map((url, i) => `
      <div class="forum-preview-thumb">
        <img src="${url}" alt="">
        <button class="forum-preview-remove" onclick="window._removeExplorePreviewImage('${ctxKey}', ${i})"><span class="mi" style="font-size:14px">close</span></button>
      </div>
    `).join('');
  }
};

window._removeExplorePreviewImage = function(ctxKey, index) {
  const imgs = _exploreReplyImages[ctxKey];
  if (!imgs) return;
  imgs.files.splice(index, 1);
  imgs.urls.splice(index, 1);
  const container = document.getElementById(`explore-previews-${ctxKey}`);
  if (container) container.innerHTML = '';
  delete _exploreReplyImages[ctxKey];
};

window._submitExploreForumReply = async function(postId, parentCommentId, ctxKey) {
  const textarea = document.getElementById(`explore-textarea-${ctxKey}`);
  if (!textarea) return;

  const content = textarea.value.trim();
  const imgs = _exploreReplyImages[ctxKey];
  const hasImage = imgs && imgs.files.length > 0;

  if (!content && !hasImage) {
    showToast('请输入内容或上传图片');
    return;
  }

  // 冷却检查
  if (_exploreCooldownTimers[postId] > 0) {
    showToast(`请等待 ${_exploreCooldownTimers[postId]} 秒后再发送`);
    return;
  }

  const sendBtn = document.getElementById(`explore-send-${ctxKey}`);
  if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<span class="mi">hourglass_empty</span>'; }

  try {
    let result;

    if (hasImage) {
      // 有图片 → FormData（multer 解析）
      const formData = new FormData();
      formData.append('content', content);
      if (parentCommentId) formData.append('parent_id', String(parentCommentId));
      imgs.files.forEach(file => formData.append('image', file));

      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/explore/posts/${postId}/comments`, {
        method: 'POST',
        headers,
        body: formData
      });
      result = await res.json();
    } else {
      // 无图片 → JSON 请求（避免 multer 解析问题）
      result = await apiPost(`/api/explore/posts/${postId}/comments`, {
        content,
        parent_id: parentCommentId || undefined
      });
    }

    if (result.error) {
      showToast(result.error);
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="mi">send</span>'; }
      return;
    }

    closeExploreInlineEditor(ctxKey);
    showToast('回复成功');

    // 启动 30 秒冷却
    startExploreCooldown(postId, ctxKey);
    toggleExploreComments(postId);
  } catch {
    showToast('网络错误，请重试');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="mi">send</span>'; }
  }
};

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
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">post_add</span>
          <p class="text-secondary">还没有发布过内容</p>
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
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
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
