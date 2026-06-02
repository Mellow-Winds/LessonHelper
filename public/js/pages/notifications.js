/**
 * pages/notifications.js — 通知中心
 * 独立全页面展示通知列表
 */

import { apiGet, apiPut } from '../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../core/router.js';
import { showToast, escHtml, formatTime, renderLoginPrompt, bindLoginPrompt } from '../components/ui.js';
import { renderAuth } from './auth.js';
import { resolveNotificationTarget } from './notification_routes.mjs';
import { renderFollowingFeed } from './following_feed.js';

let activeTab = 'messages';

/* =============================================
   页面注册
   ============================================= */

registerPage('notifications', async (container) => {
  if (!window._currentUser) { await window.loadCurrentUser(); }
  if (!window._currentUser) {
    container.innerHTML = renderLoginPrompt();
    bindLoginPrompt(container, renderAuth);
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title" style="margin:0"><span class="mi" style="vertical-align:-4px;margin-right:4px">notifications</span>通知</h1>
      <button class="btn btn-secondary btn-compact" id="notif-mark-all-btn" style="display:none">
        <span class="mi">done_all</span> 全部已读
      </button>
    </div>
    <div class="md-tabs" id="notification-tabs">
      <button class="md-tab-btn${activeTab === 'messages' ? ' active' : ''}" data-notification-tab="messages">消息通知</button>
      <button class="md-tab-btn${activeTab === 'following' ? ' active' : ''}" data-notification-tab="following">关注动态</button>
    </div>
    <div id="notification-tab-content"></div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  document.getElementById('notif-mark-all-btn')?.addEventListener('click', handleMarkAllRead);

  container.querySelectorAll('[data-notification-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchNotificationTab(btn.dataset.notificationTab));
  });

  await renderActiveTab();
});

/* =============================================
   页签切换
   ============================================= */

async function switchNotificationTab(tab) {
  if (tab === activeTab) return;
  activeTab = tab;
  document.querySelectorAll('[data-notification-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.notificationTab === tab);
  });
  await renderActiveTab();
}

async function renderActiveTab() {
  const content = document.getElementById('notification-tab-content');
  if (!content) return;

  const markAllBtn = document.getElementById('notif-mark-all-btn');
  if (markAllBtn) markAllBtn.style.display = 'none';

  if (activeTab === 'following') {
    await renderFollowingFeed(content);
  } else {
    content.innerHTML = '<div id="notif-list-container"></div>';
    const listContainer = document.getElementById('notif-list-container');
    listContainer?.addEventListener('click', (e) => {
      const item = e.target.closest('.notif-page-item');
      if (!item) return;
      const { notifId, relatedType, relatedId, courseId, isRead } = item.dataset;
      handleNotifItemClick(Number(notifId), relatedType, Number(relatedId), Number(courseId), isRead === 'true');
    });
    await loadNotifications();
  }
}

/* =============================================
   加载通知列表
   ============================================= */

async function loadNotifications() {
  const container = document.getElementById('notif-list-container');
  if (!container) return;

  container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载中...</p></div>';

  try {
    const data = await apiGet('/api/notifications');
    const notifs = data?.notifications || [];

    if (notifs.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">notifications_none</span>
          <p class="text-secondary" style="margin-top:12px">暂无通知</p>
        </div>
      `;
      return;
    }

    // 显示/隐藏「全部已读」按钮
    const markAllBtn = document.getElementById('notif-mark-all-btn');
    if (markAllBtn) {
      markAllBtn.style.display = data.unread > 0 ? 'inline-flex' : 'none';
    }

    container.innerHTML = notifs.map(n => `
      <div class="card notif-page-item${n.is_read ? '' : ' notif-page-unread'}"
           data-notif-id="${n.id}"
           data-related-type="${n.related_type || ''}"
           data-related-id="${n.related_id || 0}"
           data-course-id="${n.course_id || 0}"
           data-is-read="${!!n.is_read}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div class="notif-page-icon">${getNotifIcon(n.type)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-sm);font-weight:${n.is_read ? '400' : '600'};color:var(--md-on-surface)">${escHtml(n.title)}</div>
            <div style="font-size:13px;color:var(--md-on-surface-variant);margin-top:4px;line-height:1.5">${escHtml(n.message)}</div>
            <div style="font-size:12px;color:var(--md-outline);margin-top:6px">${formatTime(n.created_at)}</div>
          </div>
          ${!n.is_read ? '<div class="notif-page-dot"></div>' : ''}
        </div>
      </div>
    `).join('');

    const cards = container.querySelectorAll('.notif-page-item');
    if (cards.length) animStagger(Array.from(cards), { y: 12, dur: 300, gap: 30 });
  } catch {
    container.innerHTML = '<div class="card"><p class="text-secondary" style="text-align:center">加载失败</p></div>';
  }
}

/* =============================================
   点击通知项
   ============================================= */

async function handleNotifItemClick(notifId, relatedType, relatedId, courseId, isRead) {
  if (!isRead) {
    await apiPut(`/api/notifications/${notifId}/read`, {});
    if (window.refreshNotifBadge) window.refreshNotifBadge();
  }

  const target = resolveNotificationTarget(relatedType, relatedId, courseId);
  if (target) navigateTo(target.page, target.data);
}

/* =============================================
   全部已读
   ============================================= */

async function handleMarkAllRead() {
  await apiPut('/api/notifications/read-all', {});
  if (window.refreshNotifBadge) window.refreshNotifBadge();
  showToast('全部已读');
  await loadNotifications();
}

/* =============================================
   图标映射
   ============================================= */

function getNotifIcon(type) {
  const icons = {
    new_post: 'forum',
    new_comment: 'chat',
    new_material: 'folder',
    invite_join: 'person_add',
    invite_cancel: 'event_busy',
    new_follower: 'person_add',
  };
  return `<span class="mi" style="font-size:22px">${icons[type] || 'notifications'}</span>`;
}
