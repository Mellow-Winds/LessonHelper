/**
 * pages/explore.js — 探索页（组件化卡片系统）
 * 统一帖子流 + 搜索筛选
 */

import { registerPage, navigateTo, animIn, animStagger, bindRipples, renderMarkdown } from '../core/router.js';
import { apiGet, apiPost, isLoggedIn } from '../core/api.js';
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

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0">
        <i class="ri-compass-3-line" style="vertical-align:-3px;margin-right:4px"></i> 探索
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
      listEl.innerHTML = `
        <div class="explore-empty">
          <div class="explore-empty-icon"><i class="ri-inbox-line"></i></div>
          <div class="explore-empty-text">还没有帖子</div>
          <div class="explore-empty-hint">点击右上角「发布」创建第一条内容</div>
        </div>`;
      loadMoreEl.innerHTML = '';
      return;
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

    renderPostDetail(container.querySelector('#detail-content'), post);
  } catch (e) {
    container.querySelector('#detail-content').innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
  }
});

function renderPostDetail(el, post) {
  const nickname = post.creator_nickname || post.creator_name || '匿名';
  const timeStr = new Date(post.created_at).toLocaleString('zh-CN');

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
    for (const block of blocks) {
      if (block.type === 'text' && block.data) {
        contentHtml += `<div class="post-text-block">${renderMarkdown(block.data)}</div>`;
      } else if (block.type === 'card' && block.card) {
        contentHtml += renderCard(block.card, { compact: false, showActions: true });
      }
    }
  } else {
    // 纯文本 fallback
    if (post.content) {
      contentHtml += `<div class="post-text-block">${renderMarkdown(post.content)}</div>`;
    }
    if (post.cards && post.cards.length > 0) {
      contentHtml += post.cards.map(card => renderCard(card, { compact: false, showActions: true })).join('');
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
        <h3 style="font-size:var(--text-base);font-weight:600;margin-bottom:12px">评论 (${post.comment_count || 0})</h3>
        <div id="detail-comments-list"><p class="text-secondary" style="text-align:center;padding:16px">暂无评论</p></div>
        ${isLoggedIn() ? `
          <div class="comment-editor" style="margin-top:12px">
            <textarea class="md-textarea" id="detail-comment-input" rows="2" placeholder=" " style="resize:none;width:100%;min-height:60px"></textarea>
            <button class="btn btn-primary btn-compact" id="detail-comment-submit" style="margin-top:8px">发表评论</button>
          </div>
        ` : '<p class="text-secondary" style="margin-top:12px"><a href="#" onclick="navigateTo(\'auth\');return false">登录</a>后可评论</p>'}
      </div>
    </div>
  `;

  // 启动倒计时
  _timerInterval = startTimers(el);

  // 绑定卡片交互（复制功能）
  bindCardActions(el, {
    onCopy: () => showToast('已复制')
  });

  // 加载评论
  loadComments(post.id, el.querySelector('#detail-comments-list'));

  // 评论提交
  el.querySelector('#detail-comment-submit')?.addEventListener('click', async () => {
    const input = el.querySelector('#detail-comment-input');
    const content = input?.value?.trim();
    if (!content) return;
    const res = await apiPost(`/api/explore/posts/${post.id}/comments`, { content });
    if (res.error) { showToast(res.error); return; }
    input.value = '';
    showToast('评论成功');
    loadComments(post.id, el.querySelector('#detail-comments-list'));
  });
}

async function loadComments(postId, listEl) {
  if (!listEl) return;
  try {
    const data = await apiGet(`/api/explore/posts/${postId}/comments`);
    const comments = data.items || [];
    if (comments.length === 0) {
      listEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:16px">暂无评论</p>';
      return;
    }
    listEl.innerHTML = comments.map(c => renderComment(c)).join('');
  } catch (e) {
    listEl.innerHTML = '<p class="text-secondary">加载评论失败</p>';
  }
}

function renderComment(c) {
  const nickname = c.author_nickname || c.author_name || '匿名';
  const avatarLetter = (nickname[0] || '?').toUpperCase();
  const avatarHtml = c.author_avatar
    ? `<img class="comment-avatar" src="${c.author_avatar}" alt="">`
    : `<div class="comment-avatar-letter">${avatarLetter}</div>`;

  let repliesHtml = '';
  if (c.replies && c.replies.length > 0) {
    repliesHtml = `<div class="comment-nested">${c.replies.map(r => {
      const rNick = r.author_nickname || r.author_name || '匿名';
      const rLetter = (rNick[0] || '?').toUpperCase();
      const rAvatar = r.author_avatar
        ? `<img class="comment-avatar" src="${r.author_avatar}" alt="">`
        : `<div class="comment-avatar-letter">${rLetter}</div>`;
      return `<div class="comment-item">
        <div class="comment-header">${rAvatar}<span class="comment-author">${escHtml(rNick)}</span><span class="comment-time">${formatTimeAgo(r.created_at)}</span></div>
        <div class="comment-body"><div class="comment-content">${escHtml(r.content)}</div></div>
      </div>`;
    }).join('')}</div>`;
  }

  return `<div class="comment-item">
    <div class="comment-header">${avatarHtml}<span class="comment-author">${escHtml(nickname)}</span><span class="comment-time">${formatTimeAgo(c.created_at)}</span></div>
    <div class="comment-body"><div class="comment-content">${escHtml(c.content)}</div></div>
    ${repliesHtml}
  </div>`;
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
