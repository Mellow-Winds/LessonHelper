/**
 * pages/explore.js — 探索总控制基座
 * 统一承载「自习邀约」与「交友广场」的级联 Tab 切换
 * 子模块：explore/invites.js、explore/square.js
 */

import { registerPage, navigateTo, animIn, bindRipples } from '../core/router.js';

/* =============================================
   子模块懒加载缓存
   ============================================= */

let invitesModule = null;
let squareModule = null;
let postsModule = null;

async function loadInvitesModule() {
  if (!invitesModule) invitesModule = await import('./explore/invites.js');
  return invitesModule;
}

async function loadSquareModule() {
  if (!squareModule) squareModule = await import('./explore/square.js');
  return squareModule;
}

async function loadPostsModule() {
  if (!postsModule) postsModule = await import('./explore/posts.js');
  return postsModule;
}

/* =============================================
   状态
   ============================================= */

let _activeTab = null;
let _exploreContainer = null;

/* =============================================
   Tab 配置
   ============================================= */

const TABS = [
  { key: 'invites', label: '自习邀约', icon: 'event_available' },
  { key: 'square',  label: '交友广场', icon: 'people' },
];

/* =============================================
   renderExplore — 渲染主面板（页面 + 选项卡 + 内容）
   ============================================= */

async function renderExplore(container, data) {
  _exploreContainer = container;
  const initialTab = typeof data === 'string' ? data : data?.tab;
  window._pendingInviteHighlightId = data?.inviteId || null;
  const tab = initialTab || _activeTab || 'invites';
  _activeTab = tab;

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">explore</span>发现</h1>
      <div class="explore-header-actions inline-btn-group">
        <button class="btn btn-secondary btn-compact" id="explore-publish-btn">
          <span class="mi">add</span><span class="btn-text">发布</span>
        </button>
        <button class="btn btn-secondary btn-compact" onclick="navigateTo('my_post')">
          <span class="mi">edit_note</span> 我的发布
        </button>
      </div>
    </div>
    <div class="md-pills" id="explore-pills">
      ${TABS.map(t => `
        <button class="md-pill-btn${t.key === tab ? ' active' : ''}" data-tab="${t.key}">
          <span class="mi" style="font-size:16px;vertical-align:-3px">${t.icon}</span> ${t.label}
        </button>
      `).join('')}
    </div>
    <div id="explore-tab-content" class="explore-content-container"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 绑定 Tab 切换
  container.querySelectorAll('#explore-pills .md-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => switchExploreTab(btn.dataset.tab));
  });

  // 绑定发布按钮
  document.getElementById('explore-publish-btn')?.addEventListener('click', () => navigateTo('explore-posts'));

  // 加载初始 Tab 内容
  await loadTabContent(tab);
}

/* =============================================
   switchExploreTab — 切换子版块
   ============================================= */

async function switchExploreTab(tabName) {
  if (tabName === _activeTab) return;
  _activeTab = tabName;

  // 更新 Tab 高亮
  document.querySelectorAll('#explore-pills .md-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  await loadTabContent(tabName);
}

/* =============================================
   loadTabContent — 动态加载子模块并渲染
   ============================================= */

async function loadTabContent(tabName) {
  const contentEl = document.getElementById('explore-tab-content');
  if (!contentEl) return;

  contentEl.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';

  try {
    if (tabName === 'invites') {
      const mod = await loadInvitesModule();
      await mod.renderInvites(contentEl);
      mod.bindInvitesEvents(contentEl);
      const highlightId = window._pendingInviteHighlightId;
      if (highlightId) {
        const card = contentEl.querySelector(`[data-invite-card-id="${highlightId}"]`);
        if (card) {
          card.scrollIntoView({ block: 'center', behavior: 'smooth' });
          card.style.outline = '2px solid var(--md-primary)';
          card.style.outlineOffset = '3px';
        }
        window._pendingInviteHighlightId = null;
      }
    } else if (tabName === 'square') {
      const mod = await loadSquareModule();
      await mod.renderSquare(contentEl);
      mod.bindSquareEvents(contentEl);
    }
  } catch (e) {
    contentEl.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
}

/* =============================================
   页面注册
   ============================================= */

registerPage('explore', (container) => renderExplore(container));

// 子路由注册（详情页 / 我的页面）
registerPage('square-post', async (container, postId) => {
  const mod = await loadSquareModule();
  await mod.renderSquarePost(container, postId);
});

registerPage('invites-my', async (container) => {
  const mod = await loadInvitesModule();
  await mod.renderMyInvites(container);
});

registerPage('square-my', async (container) => {
  const mod = await loadSquareModule();
  await mod.renderSquareMy(container);
});

registerPage('explore-posts', async (container) => {
  const mod = await loadPostsModule();
  await mod.renderPosts(container);
});

/* =============================================
   清理（可选：离开页面时重置状态）
   ============================================= */

export function destroyExplore() {
  _activeTab = null;
  _exploreContainer = null;
}

/* =============================================
   导出：供 main.js 注册到 window
   ============================================= */

export { switchExploreTab };
