/**
 * pages/courses/detail.js — 全站统一大课空间详情页
 * registerPage: course-detail
 *
 * 通过 courseId 动态评估当前用户的在修状态：
 *   - 已选修 → 三段药丸（论坛/资料/交友）+ 发布按钮激活
 *   - 未选修 → 两段药丸（论坛/资料）+ 发布按钮置灰 + 交友 Tab 隐藏
 *   交友 Tab = 课程搭子帖（course_square.js）
 */

import { apiGet, apiPost, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, formatTime, formatFileSize, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';
import { getFavoriteCourseIds, getFavoritePostIds, renderCourseFavoriteButton, renderPostFavoriteButton } from '../favorites.js';
import { renderPostAttachments } from './post_attachments.js';
import { cleanBigCourseName } from './all_courses.js';
import { renderCourseSquareTab, bindCourseSquareInterestBtn } from './course_square.js';

/* =============================================
   全局状态
   ============================================= */

window._courseDetail = {};
window._courseDetailTargetPostId = null;

/* =============================================
   辅助：判断用户是否已选修某课程
   ============================================= */

async function checkEnrollment(courseId) {
  if (!isLoggedIn()) return false;
  try {
    const myCourses = await apiGet('/api/courses');
    // 检查用户是否选了该大课下的任意一门小课
    return Array.isArray(myCourses) && myCourses.some(c =>
      c.big_course_id === Number(courseId) || c.id === Number(courseId)
    );
  } catch {
    return false;
  }
}

/* =============================================
   Page: 统一课程详情页
   ============================================= */

registerPage('course-detail', async (container, courseId) => {
  container.innerHTML = `<div class="card"><p class="text-secondary">加载中...</p></div>`;

  try {
    const course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `
        <div class="card" style="text-align:center;padding:48px">
          <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">error_outline</span>
          <p class="text-secondary" style="margin-top:12px">${escHtml(course.error)}</p>
          <button class="btn btn-secondary mt-6" onclick="navigateTo('mycourse')">
            <span class="mi">arrow_back</span> 返回我的课程
          </button>
        </div>
      `;
      return;
    }

    const enrolled = await checkEnrollment(courseId);
    const cleanName = cleanBigCourseName(course.title);
    const favoriteCourseIds = await getFavoriteCourseIds();

    window._courseDetail = { courseId: Number(courseId), course, enrolled, activeTab: null };

    // 构建药丸 Tabs：已选修多一个"交友"
    const squareTab = enrolled
      ? `<button class="md-pill-btn" data-tab="square" onclick="switchDetailTab('square', ${courseId})">
           <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 交友
         </button>`
      : '';

    container.innerHTML = `
      <div class="page-header">
        <div style="flex:1;min-width:0">
          <h1 class="page-title" style="margin-bottom:4px">${escHtml(cleanName)}</h1>
          <p class="text-secondary">
            ${course.enrollment_count || 0} 人选课
            ${enrolled ? '' : ' · <span style="color:var(--md-outline)">只读模式</span>'}
          </p>
        </div>
        ${renderCourseFavoriteButton(courseId, favoriteCourseIds.has(Number(courseId)))}
      </div>
      <div class="md-pills" id="detail-pills">
        <button class="md-pill-btn active" data-tab="forum" onclick="switchDetailTab('forum', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
        </button>
        <button class="md-pill-btn" data-tab="materials" onclick="switchDetailTab('materials', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
        </button>
        ${squareTab}
      </div>
      <div id="detail-tab-content" style="min-height:200px"></div>
    `;

    bindRipples(container);
    animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });
    animIn(container.querySelector('.md-pills'), { y: 12, delay: 80, dur: 350 });

    await switchDetailTab('forum', courseId);
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
});

/* ---- 未选修时的发布拦截 Toast ---- */

export function showPublishBlockedToast() {
  showToast('课程广场为只读档案馆。你未修读本门课程的任何班级，暂无发布权限。');
}

/* ---- 药丸 Tab 切换 ---- */

export async function switchDetailTab(tab, courseId) {
  if (tab === window._courseDetail.activeTab) return;
  window._courseDetail.activeTab = tab;

  document.querySelectorAll('#detail-pills .md-pill-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  const contentEl = document.getElementById('detail-tab-content');
  if (!contentEl) return;

  const { enrolled } = window._courseDetail;

  switch (tab) {
    case 'forum':
      await renderForumTab(contentEl, courseId, enrolled);
      break;
    case 'materials':
      await renderMaterialsTab(contentEl, courseId, enrolled);
      break;
    case 'square':
      if (enrolled) await renderCourseSquareTab(contentEl, courseId, 'dc');
      break;
  }
}

/* =============================================
   论坛标签页 — 扁平流式分割线架构
   ============================================= */

// ---- 论坛流式状态 ----
const _forumExpandedComments = {};   // { [postId]: bool }
const _forumExpandedReplies = {};    // { [commentId]: bool }
const _forumLikeState = {};          // { 'p123': { liked: bool, count: N } }
const _forumReplyImages = {};        // { ctxKey: { files: [], urls: [] } }
const _forumCooldownTimers = {};     // { postId: secondsRemaining }
let _forumDailyCount = 0;            // 当日发布计数
let _forumDailyDate = '';            // 当日日期标记

async function renderForumTab(contentEl, courseId, enrolled) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await apiGet(`/api/courses/${courseId}/posts`);
  const favoritePostIds = await getFavoritePostIds();

  // 初始化点赞状态
  posts.forEach(p => {
    const key = `p${p.id}`;
    if (!_forumLikeState[key]) {
      _forumLikeState[key] = { liked: false, count: p.comment_count || 0 };
    }
  });

  // 重置每日计数器（跨日重置）
  const today = new Date().toISOString().slice(0, 10);
  if (_forumDailyDate !== today) {
    _forumDailyDate = today;
    _forumDailyCount = 0;
  }

  const composeBar = enrolled ? `
    <div class="forum-compose-bar" id="forum-compose-bar" onclick="openForumCompose()">
      <div class="forum-compose-avatar">
        ${window._currentUser?.avatar_url
          ? `<img class="forum-avatar" src="${window._currentUser.avatar_url}" alt="">`
          : `<div class="forum-avatar-letter">${((window._currentUser?.nickname || '?')[0] || '?').toUpperCase()}</div>`
        }
      </div>
      <div class="forum-compose-placeholder">分享你的想法...</div>
      <span class="mi" style="color:var(--md-on-surface-variant);font-size:20px">photo_camera</span>
    </div>
    <div id="forum-compose-editor"></div>
  ` : '';

  contentEl.innerHTML = composeBar + (
    posts.length === 0
      ? `<div class="forum-empty">
           <span class="mi forum-empty-icon">forum</span>
           <p class="forum-empty-text">${enrolled ? '暂无帖子，来发第一个吧' : '暂无帖子'}</p>
         </div>`
      : `<div class="forum-stream">${posts.map(p => renderForumPostRow(p, enrolled, favoritePostIds)).join('')}</div>`
  );

  // 定位目标帖子
  const targetId = window._courseDetailTargetPostId;
  if (targetId) {
    document.getElementById(`forum-post-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window._courseDetailTargetPostId = null;
  }
}

function renderForumPostRow(p, enrolled, favoritePostIds) {
  const likeKey = `p${p.id}`;
  const like = _forumLikeState[likeKey] || { liked: false, count: 0 };
  const avatarLetter = (p.author_name || '?')[0].toUpperCase();
  const images = (p.attachments || []).filter(a => a.file_type === 'image');
  const files = (p.attachments || []).filter(a => a.file_type !== 'image');

  return `
    <div class="forum-post-row" id="forum-post-${p.id}">
      <div class="forum-avatar-col">
        ${p.author_avatar_url
          ? `<img class="forum-avatar" src="${p.author_avatar_url}" alt="" onclick="navigateTo('profile-user', ${p.author_id})" style="cursor:pointer">`
          : `<div class="forum-avatar-letter" onclick="navigateTo('profile-user', ${p.author_id})" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-content-col">
        <div class="forum-post-header">
          <div class="forum-post-meta">
            <button class="forum-post-name" onclick="navigateTo('profile-user', ${p.author_id})">${escHtml(p.author_name)}</button>
            <span class="forum-post-time">${formatTime(p.created_at)}</span>
          </div>
          <div class="forum-like-col">
            <button class="forum-like-btn${like.liked ? ' liked' : ''}" data-like-key="${likeKey}" onclick="toggleForumLike(${p.id}, 'post', this)">
              <span class="mi" style="font-size:18px;pointer-events:none">${like.liked ? 'favorite' : 'favorite_border'}</span>
            </button>
            <span class="forum-like-count">${like.count}</span>
          </div>
        </div>
        ${p.title ? `<h3 class="forum-post-title">${escHtml(p.title)}</h3>` : ''}
        ${p.content ? `<p class="forum-post-text">${escHtml(p.content)}</p>` : ''}
        ${images.length > 0 ? `
          <div class="forum-image-grid count-${images.length}">
            ${images.map(a => `
              <a href="${a.view_url}" target="_blank" rel="noopener" class="forum-image-link">
                <img src="${a.view_url}" alt="${escHtml(a.file_name)}" loading="lazy">
              </a>
            `).join('')}
          </div>
        ` : ''}
        ${files.length > 0 ? `
          <div class="forum-attachment-list">
            ${files.map(a => `
              <a class="forum-attachment-row" href="${a.download_url}">
                <span class="mi" style="font-size:14px">attach_file</span>
                <span>${escHtml(a.file_name)}</span>
                <span style="color:var(--md-on-surface-variant)">${formatFileSize(a.file_size)}</span>
              </a>
            `).join('')}
          </div>
        ` : ''}
        ${enrolled ? `
          <div class="forum-actions">
            <button class="forum-action-btn" onclick="openForumInlineEditor(${p.id}, null, 'post-${p.id}')">
              <span class="mi" style="font-size:16px">chat_bubble_outline</span> 回复
            </button>
            <button class="forum-action-btn" onclick="toggleForumComments(${p.id})" id="forum-toggle-${p.id}">
              <span class="mi" style="font-size:16px">forum</span> ${p.comment_count || 0} 回复
            </button>
            ${renderPostFavoriteButton(p.id, favoritePostIds.has(p.id))}
          </div>
        ` : `
          <div class="forum-actions">
            <span style="font-size:12px;color:var(--md-on-surface-variant)">
              <span class="mi" style="font-size:14px;vertical-align:-2px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
            </span>
          </div>
        `}
        <div id="forum-inline-post-${p.id}"></div>
        <div id="forum-comments-${p.id}" style="display:none"></div>
      </div>
    </div>
  `;
}

/* ---- 评论区展开/收起 ---- */

export async function toggleComments(postId) {
  await toggleForumComments(postId);
}

async function toggleForumComments(postId) {
  const section = document.getElementById(`forum-comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    _forumExpandedComments[postId] = false;
    return;
  }

  section.style.display = 'block';
  _forumExpandedComments[postId] = true;

  section.innerHTML = '<p style="font-size:12px;color:var(--md-on-surface-variant);padding:8px 0">加载中...</p>';

  try {
    const data = await apiGet(`/api/courses/posts/${postId}/comments`);
    const comments = Array.isArray(data) ? data : (data.comments || []);

    // 按 parent_id 分组
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
        </div>
      `;
    } else {
      section.innerHTML = `
        <div class="forum-reply-section">
          ${topComments.map(c => renderForumComment(c, postId, childMap)).join('')}
        </div>
      `;
    }
  } catch {
    section.innerHTML = '<p style="font-size:12px;color:var(--md-error);padding:8px 0">加载失败，点击重试</p>';
    section.style.cursor = 'pointer';
    section.onclick = () => { section.onclick = null; toggleForumComments(postId); };
  }
}

function renderCommentImages(imageUrlStr) {
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

function renderForumComment(c, postId, childMap) {
  const avatarLetter = (c.author_name || '?')[0].toUpperCase();
  const children = childMap[c.id] || [];
  const likeKey = `c${c.id}`;
  const like = _forumLikeState[likeKey] || { liked: false, count: 0 };
  const previewChildren = children.slice(-2);
  const hiddenCount = children.length - previewChildren.length;
  const isExpanded = _forumExpandedReplies[c.id];

  return `
    <div class="forum-reply-row" id="forum-comment-${c.id}">
      <div>
        ${c.author_avatar_url
          ? `<img class="forum-reply-avatar" src="${c.author_avatar_url}" alt="" onclick="navigateTo('profile-user', ${c.author_id})" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" onclick="navigateTo('profile-user', ${c.author_id})" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" onclick="navigateTo('profile-user', ${c.author_id})">${escHtml(c.author_name)}</button>
            <span class="forum-reply-time">${formatTime(c.created_at)}</span>
          </div>
          <div class="forum-reply-like">
            <button class="forum-like-btn${like.liked ? ' liked' : ''}" data-like-key="${likeKey}" onclick="toggleForumLike(${c.id}, 'comment', this)" style="padding:2px">
              <span class="mi" style="font-size:14px;pointer-events:none">${like.liked ? 'favorite' : 'favorite_border'}</span>
            </button>
            <span class="forum-like-count" style="font-size:11px">${like.count}</span>
          </div>
        </div>
        ${c.content === '[已删除]' ? `<p class="forum-reply-text" style="color:var(--md-on-surface-variant);font-style:italic">已删除</p>` : `
          <p class="forum-reply-text">${escHtml(c.content || '')}</p>
        `}
        ${renderCommentImages(c.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" onclick="openForumInlineEditor(${postId}, ${c.id}, 'comment-${c.id}')">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
        </div>
        <div id="forum-inline-comment-${c.id}"></div>
        ${children.length > 0 ? `
          ${isExpanded ? `
            <div class="forum-nested-replies">
              ${children.map(child => renderNestedReply(child, c.author_name, c.author_id, postId)).join('')}
            </div>
            <button class="forum-view-replies" onclick="toggleForumReplies(${c.id}, ${postId})">
              ── 收起回复 🔼
            </button>
          ` : `
            ${previewChildren.length > 0 ? `
              <div class="forum-nested-replies">
                ${previewChildren.map(child => renderNestedReply(child, c.author_name, c.author_id, postId)).join('')}
              </div>
            ` : ''}
            ${hiddenCount > 0 ? `
              <button class="forum-view-replies" onclick="toggleForumReplies(${c.id}, ${postId})">
                ── 查看更多 ${hiddenCount} 条回复 🔽
              </button>
            ` : ''}
          `}
        ` : ''}
      </div>
    </div>
  `;
}

function renderNestedReply(child, parentAuthorName, parentAuthorId, postId) {
  const avatarLetter = (child.author_name || '?')[0].toUpperCase();
  const likeKey = `c${child.id}`;
  const like = _forumLikeState[likeKey] || { liked: false, count: 0 };

  return `
    <div class="forum-nested-reply">
      <div>
        ${child.author_avatar_url
          ? `<img class="forum-reply-avatar" src="${child.author_avatar_url}" alt="" onclick="navigateTo('profile-user', ${child.author_id})" style="cursor:pointer">`
          : `<div class="forum-reply-avatar-letter" onclick="navigateTo('profile-user', ${child.author_id})" style="cursor:pointer">${escHtml(avatarLetter)}</div>`
        }
      </div>
      <div class="forum-reply-content">
        <div class="forum-reply-header">
          <div class="forum-reply-meta">
            <button class="forum-reply-name" onclick="navigateTo('profile-user', ${child.author_id})">${escHtml(child.author_name)}</button>
            <span class="forum-reply-to">
              回复 <button class="forum-reply-link" onclick="navigateTo('profile-user', ${parentAuthorId})">${escHtml(parentAuthorName || '')}</button>
            </span>
            <span class="forum-reply-time">${formatTime(child.created_at)}</span>
          </div>
          <div class="forum-reply-like">
            <button class="forum-like-btn${like.liked ? ' liked' : ''}" data-like-key="${likeKey}" onclick="toggleForumLike(${child.id}, 'comment', this)" style="padding:2px">
              <span class="mi" style="font-size:14px;pointer-events:none">${like.liked ? 'favorite' : 'favorite_border'}</span>
            </button>
            <span class="forum-like-count" style="font-size:11px">${like.count}</span>
          </div>
        </div>
        ${child.content === '[已删除]' ? `<p class="forum-reply-text" style="color:var(--md-on-surface-variant);font-style:italic">已删除</p>` : `
          <p class="forum-reply-text">${escHtml(child.content || '')}</p>
        `}
        ${renderCommentImages(child.image_url)}
        <div class="forum-reply-actions">
          <button class="forum-action-btn" onclick="openForumInlineEditor(${postId}, ${child.id || child.parent_id}, 'nested-${child.id}')">
            <span class="mi" style="font-size:14px">chat_bubble_outline</span> 回复
          </button>
        </div>
        <div id="forum-inline-nested-${child.id}"></div>
      </div>
    </div>
  `;
}

/* ---- 楼中楼展开/收起 ---- */

export function toggleForumReplies(commentId, postId) {
  _forumExpandedReplies[commentId] = !_forumExpandedReplies[commentId];
  // 重新渲染整个评论区
  if (_forumExpandedComments[postId]) {
    toggleForumComments(postId);
    setTimeout(() => toggleForumComments(postId), 30);
  }
}

/* ---- 点赞（纯本地 +1/-1，不触发通知） ---- */

export function toggleForumLike(id, type, el) {
  const key = `${type === 'post' ? 'p' : 'c'}${id}`;
  if (!_forumLikeState[key]) {
    _forumLikeState[key] = { liked: false, count: 0 };
  }
  const state = _forumLikeState[key];
  state.liked = !state.liked;
  state.count += state.liked ? 1 : -1;
  if (state.count < 0) state.count = 0;

  // 找到按钮（可能是 span 触发的，用 closest 兜底）
  const btn = el?.closest?.('.forum-like-btn') || el;
  if (!btn) return;

  btn.classList.toggle('liked', state.liked);
  const icon = btn.querySelector('.mi');
  if (icon) icon.textContent = state.liked ? 'favorite' : 'favorite_border';

  // 计数器在按钮的父元素（forum-like-col / forum-reply-like）里
  const wrapper = btn.parentElement;
  const countEl = wrapper?.querySelector('.forum-like-count');
  if (countEl) countEl.textContent = state.count;
}

/* ---- 行内回复编辑器 ---- */

export function openForumInlineEditor(postId, parentCommentId, ctxKey) {
  const containerId = parentCommentId
    ? `forum-inline-comment-${parentCommentId}`
    : `forum-inline-post-${postId}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  // 如果已有编辑器，切换关闭
  if (container.innerHTML.trim() !== '') {
    closeForumInlineEditor(ctxKey);
    return;
  }

  // 关闭其他编辑器
  document.querySelectorAll('[id^="forum-inline-"]').forEach(el => {
    if (el.id !== containerId && el.innerHTML.trim() !== '') {
      el.innerHTML = '';
    }
  });

  // 初始化图片状态
  _forumReplyImages[ctxKey] = { files: [], urls: [] };

  const cooldown = _forumCooldownTimers[postId] || 0;
  const isDailyLimit = _forumDailyCount >= 100;
  const sendDisabled = cooldown > 0 || isDailyLimit;
  const sendLabel = cooldown > 0 ? `重新发送(${cooldown}s)` : (isDailyLimit ? '已达上限' : '');

  container.innerHTML = `
    <div class="forum-inline-editor">
      <div class="forum-editor-row">
        <textarea class="forum-editor-textarea" id="forum-textarea-${ctxKey}"
          placeholder=" " rows="1"
          oninput="autoResizeForumTextarea(this)"></textarea>
        <div class="forum-editor-actions">
          <input type="file" id="forum-file-${ctxKey}" accept="image/jpeg,image/png,image/gif,image/webp"
            multiple style="display:none" onchange="handleForumReplyImageChange('${ctxKey}', ${postId})">
          <button class="forum-editor-btn forum-editor-camera" onclick="document.getElementById('forum-file-${ctxKey}').click()" title="添加图片">
            <span class="mi">photo_camera</span>
          </button>
          <button class="forum-editor-btn forum-editor-send" id="forum-send-${ctxKey}"
            onclick="submitForumReply(${postId}, ${parentCommentId || 'null'}, '${ctxKey}')"
            ${sendDisabled ? 'disabled' : ''}>
            ${cooldown > 0 ? `<span style="font-size:11px">${sendLabel}</span>` : '<span class="mi">send</span>'}
          </button>
        </div>
      </div>
      <div class="forum-editor-previews" id="forum-previews-${ctxKey}"></div>
      ${isDailyLimit ? '<div class="forum-rate-limit-banner">今日发布额度已达上限</div>' : ''}
    </div>
  `;

  // 自动聚焦
  setTimeout(() => {
    const textarea = document.getElementById(`forum-textarea-${ctxKey}`);
    if (textarea) textarea.focus();
  }, 100);

  // 失焦自动收回（延迟检测，避免点击按钮时误触）
  const textarea = document.getElementById(`forum-textarea-${ctxKey}`);
  if (textarea) {
    textarea.addEventListener('blur', () => {
      setTimeout(() => {
        const ta = document.getElementById(`forum-textarea-${ctxKey}`);
        const sendBtn = document.getElementById(`forum-send-${ctxKey}`);
        // 如果焦点不在编辑器区域内且内容为空，收回
        if (ta && !ta.value.trim() && (!sendBtn || document.activeElement !== sendBtn)) {
          const imgs = _forumReplyImages[ctxKey];
          if (!imgs || imgs.files.length === 0) {
            closeForumInlineEditor(ctxKey);
          }
        }
      }, 200);
    });
  }
}

function closeForumInlineEditor(ctxKey) {
  // 清理预览 URL
  const imgs = _forumReplyImages[ctxKey];
  if (imgs) {
    imgs.urls.forEach(url => URL.revokeObjectURL(url));
    delete _forumReplyImages[ctxKey];
  }
  // 清空所有可能的容器
  document.querySelectorAll('[id^="forum-inline-"]').forEach(el => {
    if (el.innerHTML.includes('forum-inline-editor')) {
      el.innerHTML = '';
    }
  });
}

/* ---- 文本框自动伸缩 ---- */

export function autoResizeForumTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ---- 回复图片上传 ---- */

export function handleForumReplyImageChange(ctxKey, postId) {
  const input = document.getElementById(`forum-file-${ctxKey}`);
  if (!input || !input.files.length) return;

  if (!_forumReplyImages[ctxKey]) {
    _forumReplyImages[ctxKey] = { files: [], urls: [] };
  }
  const imgs = _forumReplyImages[ctxKey];

  const remaining = 9 - imgs.files.length;
  if (remaining <= 0) {
    showToast('最多上传 9 张图片');
    input.value = '';
    return;
  }

  const newFiles = Array.from(input.files).slice(0, remaining);
  newFiles.forEach(file => {
    if (file.size > 20 * 1024 * 1024) {
      showToast(`${file.name} 超过 20MB，已跳过`);
      return;
    }
    imgs.files.push(file);
    imgs.urls.push(URL.createObjectURL(file));
  });

  input.value = '';
  renderForumImagePreviews(ctxKey);
}

function renderForumImagePreviews(ctxKey) {
  const container = document.getElementById(`forum-previews-${ctxKey}`);
  const imgs = _forumReplyImages[ctxKey];
  if (!container || !imgs) return;

  if (imgs.files.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = imgs.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="预览">
      <button class="forum-editor-preview-remove" onclick="removeForumReplyImage('${ctxKey}', ${i})">×</button>
    </div>
  `).join('');
}

export function removeForumReplyImage(ctxKey, index) {
  const imgs = _forumReplyImages[ctxKey];
  if (!imgs) return;
  URL.revokeObjectURL(imgs.urls[index]);
  imgs.files.splice(index, 1);
  imgs.urls.splice(index, 1);
  renderForumImagePreviews(ctxKey);
}

/* ---- 发布回复（防刷流控） ---- */

export async function submitForumReply(postId, parentCommentId, ctxKey) {
  const textarea = document.getElementById(`forum-textarea-${ctxKey}`);
  if (!textarea) return;

  const content = textarea.value.trim();
  const imgs = _forumReplyImages[ctxKey];
  const hasImages = imgs && imgs.files.length > 0;

  if (!content && !hasImages) {
    showToast('请输入内容或上传图片');
    return;
  }

  // 每日上限检查
  if (_forumDailyCount >= 100) {
    showToast('今日发布额度已达上限');
    return;
  }

  // 冷却检查
  if (_forumCooldownTimers[postId] > 0) {
    showToast(`请等待 ${_forumCooldownTimers[postId]} 秒后再发送`);
    return;
  }

  const sendBtn = document.getElementById(`forum-send-${ctxKey}`);
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '发送中...'; }

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (parentCommentId) formData.append('parent_id', String(parentCommentId));
    if (hasImages) {
      imgs.files.forEach(file => formData.append('image', file));
    }

    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/posts/${postId}/comments`, {
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

    // 成功：清理编辑器、刷新评论区
    closeForumInlineEditor(ctxKey);
    _forumDailyCount++;
    showToast('回复成功');

    // 刷新评论区
    if (_forumExpandedComments[postId]) {
      toggleForumComments(postId);
      setTimeout(() => toggleForumComments(postId), 30);
    }

    // 启动 30 秒冷却
    startForumCooldown(postId);

  } catch {
    showToast('网络错误，请重试');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<span class="mi">send</span>'; }
  }
}

function startForumCooldown(postId) {
  _forumCooldownTimers[postId] = 30;
  const tick = () => {
    _forumCooldownTimers[postId]--;
    if (_forumCooldownTimers[postId] <= 0) {
      delete _forumCooldownTimers[postId];
      return;
    }
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

/* ---- 帖子创作（行内 compose） ---- */

const _forumComposeImages = { files: [], urls: [] };

export async function focusForumCompose(courseId) {
  // 确保在论坛 tab
  if (window._courseDetail.activeTab !== 'forum') {
    await switchDetailTab('forum', courseId);
  }
  // 滚动到顶部并打开 compose
  const bar = document.getElementById('forum-compose-bar');
  if (bar) {
    bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => openForumCompose(), 300);
  }
}

export function openForumCompose() {
  const bar = document.getElementById('forum-compose-bar');
  const editor = document.getElementById('forum-compose-editor');
  if (!bar || !editor) return;

  // 隐藏 compose bar，展开编辑器
  bar.style.display = 'none';
  _forumComposeImages.files = [];
  _forumComposeImages.urls = [];

  editor.innerHTML = `
    <div class="forum-compose-expanded">
      <div class="forum-compose-header">
        <span style="font-size:var(--text-base);font-weight:600">发布新帖</span>
        <button class="forum-action-btn" onclick="closeForumCompose()">
          <span class="mi" style="font-size:18px">close</span>
        </button>
      </div>
      <div class="md-input-group" style="margin-bottom:8px">
        <input class="md-input" id="forum-compose-title" placeholder=" " style="font-family:inherit!important">
        <label class="md-label">标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>标题</span></legend></fieldset>
      </div>
      <textarea class="forum-compose-textarea" id="forum-compose-content"
        placeholder=" " rows="3" oninput="autoResizeForumTextarea(this)"></textarea>
      <div class="forum-compose-preview-grid" id="forum-compose-previews"></div>
      <div class="forum-compose-footer">
        <input type="file" id="forum-compose-files" accept="image/jpeg,image/png,image/gif,image/webp"
          multiple style="display:none" onchange="handleForumComposeImageChange()">
        <button class="forum-action-btn" onclick="document.getElementById('forum-compose-files').click()">
          <span class="mi" style="font-size:18px">photo_camera</span> 图片
        </button>
        <span id="forum-compose-count" style="font-size:12px;color:var(--md-on-surface-variant)"></span>
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-compact" id="forum-compose-submit" onclick="submitForumPost()">
          <span class="mi">send</span> 发布
        </button>
      </div>
    </div>
  `;

  setTimeout(() => {
    document.getElementById('forum-compose-title')?.focus();
  }, 100);
}

export function closeForumCompose() {
  const bar = document.getElementById('forum-compose-bar');
  const editor = document.getElementById('forum-compose-editor');
  if (bar) bar.style.display = '';
  if (editor) editor.innerHTML = '';
  _forumComposeImages.urls.forEach(u => URL.revokeObjectURL(u));
  _forumComposeImages.files = [];
  _forumComposeImages.urls = [];
}

export function handleForumComposeImageChange() {
  const input = document.getElementById('forum-compose-files');
  if (!input || !input.files.length) return;

  const remaining = 9 - _forumComposeImages.files.length;
  if (remaining <= 0) { showToast('最多 9 张图片'); input.value = ''; return; }

  Array.from(input.files).slice(0, remaining).forEach(file => {
    if (file.size > 20 * 1024 * 1024) { showToast(`${file.name} 超过 20MB`); return; }
    _forumComposeImages.files.push(file);
    _forumComposeImages.urls.push(URL.createObjectURL(file));
  });
  input.value = '';
  renderForumComposePreviews();
}

function renderForumComposePreviews() {
  const container = document.getElementById('forum-compose-previews');
  const countEl = document.getElementById('forum-compose-count');
  if (!container) return;
  if (countEl) countEl.textContent = _forumComposeImages.files.length > 0 ? `${_forumComposeImages.files.length}/9` : '';

  container.innerHTML = _forumComposeImages.urls.map((url, i) => `
    <div class="forum-editor-preview">
      <img src="${url}" alt="">
      <button class="forum-editor-preview-remove" onclick="removeForumComposeImage(${i})">×</button>
    </div>
  `).join('');
}

export function removeForumComposeImage(index) {
  URL.revokeObjectURL(_forumComposeImages.urls[index]);
  _forumComposeImages.files.splice(index, 1);
  _forumComposeImages.urls.splice(index, 1);
  renderForumComposePreviews();
}

export async function submitForumPost() {
  const titleEl = document.getElementById('forum-compose-title');
  const contentEl = document.getElementById('forum-compose-content');
  const title = titleEl?.value.trim();
  const content = contentEl?.value.trim();

  if (!title) { showToast('请输入标题'); titleEl?.focus(); return; }
  if (!content) { showToast('请输入内容'); contentEl?.focus(); return; }

  // 每日上限
  if (_forumDailyCount >= 100) { showToast('今日发布额度已达上限'); return; }

  const btn = document.getElementById('forum-compose-submit');
  if (btn) { btn.disabled = true; btn.textContent = '发布中...'; }

  try {
    const { courseId } = window._courseDetail;
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    _forumComposeImages.files.forEach(f => formData.append('files', f));

    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/${courseId}/posts`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">send</span> 发布'; }
      return;
    }

    _forumDailyCount++;
    closeForumCompose();
    showToast('发布成功');

    // 刷新论坛
    const contentEl2 = document.getElementById('detail-tab-content');
    const { enrolled } = window._courseDetail;
    if (contentEl2) await renderForumTab(contentEl2, courseId, enrolled);

  } catch {
    showToast('网络错误，请重试');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">send</span> 发布'; }
  }
}

/* =============================================
   资料标签页
   ============================================= */

async function renderMaterialsTab(contentEl, courseId, enrolled) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  await loadMaterials(contentEl, courseId, enrolled);
}

async function loadMaterials(contentEl, courseId, enrolled, opts = {}) {
  const params = new URLSearchParams();
  if (opts.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts.chapter) params.set('chapter', opts.chapter);
  if (opts.sort) params.set('sort', opts.sort);

  const data = await apiGet(`/api/materials/courses/${courseId}?${params.toString()}`);
  const materials = data?.materials || [];
  const categories = ['全部', '课件', '笔记', '作业', '真题', '其他'];

  const uploadBtn = enrolled
    ? `<button class="btn btn-primary" onclick="openUploadMaterialModal(${courseId})">
         <span class="mi">upload</span> 上传资料
       </button>`
    : '';

  contentEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${createMdSelect({
          id: 'detail-mat-category',
          options: categories.map(c => ({ text: c, value: c === '全部' ? 'all' : c })),
          style: 'width:auto;min-width:100px;margin-bottom:0',
          onchange: `refreshMyMaterials(${courseId})`
        })}
        ${createMdInput({
          id: 'detail-mat-chapter',
          label: '按章节搜索',
          style: 'width:auto;min-width:120px;margin-bottom:0',
          onchange: `refreshMyMaterials(${courseId})`,
          placeholder: ' '
        })}
        ${createMdSelect({
          id: 'detail-mat-sort',
          options: [
            { text: '最新上传', value: 'newest' },
            { text: '评分最高', value: 'rating' },
            { text: '下载最多', value: 'downloads' }
          ],
          style: 'width:auto;min-width:100px;margin-bottom:0',
          onchange: `refreshMyMaterials(${courseId})`
        })}
      </div>
      ${uploadBtn}
    </div>
    <div id="detail-materials-list">
      ${renderMaterialsList(materials, courseId, enrolled)}
    </div>
  `;

  const cards = contentEl.querySelectorAll('.material-card');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}

function renderMaterialsList(materials, courseId, enrolled) {
  if (materials.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">folder_open</span>
        <p class="text-secondary" style="margin-top:12px">${enrolled ? '暂无资料，来上传第一份吧' : '暂无资料'}</p>
      </div>
    `;
  }

  const typeIcons = { pdf: 'picture_as_pdf', ppt: 'slideshow', doc: 'description', image: 'image', other: 'insert_drive_file' };
  const typeColors = { pdf: '#e53935', ppt: '#FB8C00', doc: '#1E88E5', image: '#43A047', other: '#757575' };

  return materials.map(m => `
    <div class="card material-card">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="material-icon" style="color:${typeColors[m.file_type] || typeColors.other}">
          <span class="mi" style="font-size:28px">${typeIcons[m.file_type] || typeIcons.other}</span>
          <span style="font-size:10px;text-transform:uppercase">${m.file_type}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:var(--text-base)">${escHtml(m.title)}</div>
          ${m.description ? `<div style="font-size:12px;color:var(--md-on-surface-variant);margin-top:4px">${escHtml(m.description)}</div>` : ''}
          <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;font-size:12px;color:var(--md-on-surface-variant)">
            ${m.chapter ? `<span><span class="mi" style="font-size:14px;vertical-align:-2px">bookmark</span> ${escHtml(m.chapter)}</span>` : ''}
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">category</span> ${escHtml(m.category)}</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> <button class="user-profile-link" onclick="navigateTo('profile-user', ${m.uploader_id})">${escHtml(m.uploader_name)}</button></span>
            <span>${formatFileSize(m.file_size)}</span>
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">download</span> ${m.download_count}</span>
          </div>
          ${enrolled ? `
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              ${renderStars(m.avg_rating, m.id)}
              <span style="font-size:12px;color:var(--md-on-surface-variant)">${m.rating_count > 0 ? m.avg_rating.toFixed(1) + ' 分' : '暂无评分'}</span>
            </div>
          ` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
          <a href="/api/materials/${m.id}/download" class="btn btn-primary" style="font-size:12px;padding:6px 12px">
            <span class="mi" style="font-size:16px">download</span> 下载
          </a>
          ${enrolled && m.uploader_id === window._currentUser?.id ? `<button class="btn btn-secondary" style="font-size:12px;padding:6px 12px" onclick="deleteMyMaterial(${m.id}, ${courseId})"><span class="mi" style="font-size:16px">delete</span> 删除</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function renderStars(avgRating, materialId) {
  let html = '<div class="stars-row">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(avgRating) ? 'star' : 'star_border';
    html += `<span class="mi star-icon" style="font-size:18px;cursor:pointer;color:${i <= Math.round(avgRating) ? '#FB8C00' : 'var(--md-outline-variant)'}" onclick="rateMyMaterial(${materialId}, ${i})">${filled}</span>`;
  }
  html += '</div>';
  return html;
}

export async function rateMyMaterial(materialId, rating) {
  if (!window._currentUser) {
    showToast('请先登录后再评分');
    return;
  }
  const result = await apiPost(`/api/materials/${materialId}/rate`, { rating });
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast(`评分成功 (${result.avg_rating} 分)`);
  const { courseId, enrolled } = window._courseDetail;
  const contentEl = document.getElementById('detail-tab-content');
  if (contentEl && courseId) await loadMaterials(contentEl, courseId, enrolled);
}

export async function refreshMyMaterials(courseId) {
  const category = document.getElementById('detail-mat-category')?.value || 'all';
  const chapter = document.getElementById('detail-mat-chapter')?.value || '';
  const sort = document.getElementById('detail-mat-sort')?.value || 'newest';
  const contentEl = document.getElementById('detail-tab-content');
  const { enrolled } = window._courseDetail;
  if (contentEl) await loadMaterials(contentEl, courseId, enrolled, { category, chapter, sort });
}

export async function deleteMyMaterial(materialId, courseId) {
  if (!confirm('确定删除这份资料？')) return;
  const result = await apiDelete(`/api/materials/${materialId}`);
  if (result.error) {
    showToast(result.error);
    return;
  }
  showToast('删除成功');
  const contentEl = document.getElementById('detail-tab-content');
  const { enrolled } = window._courseDetail;
  if (contentEl) await loadMaterials(contentEl, courseId, enrolled);
}

export function openUploadMaterialModal(courseId) {
  const categories = ['课件', '笔记', '作业', '真题', '其他'];
  const html = `
    <form id="upload-material-form" onsubmit="handleUploadMaterial(event, ${courseId})" style="display:flex;flex-direction:column;gap:16px">
      <div id="upload-drop-zone" class="upload-drop-zone">
        <span class="mi" style="font-size:36px;color:var(--md-outline-variant)">cloud_upload</span>
        <p style="margin-top:8px;color:var(--md-on-surface-variant);font-size:14px">点击选择文件或拖拽到此处</p>
        <p style="font-size:12px;color:var(--md-outline)">支持 PDF、PPT、Word、图片，最大 20MB</p>
        <input type="file" id="upload-file-input" style="display:none" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" onchange="onFileSelected(this)">
        <p id="upload-file-name" style="display:none;font-size:14px;font-weight:500;color:var(--md-primary);margin-top:8px"></p>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="title" placeholder=" " required>
        <label class="md-label">资料标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>资料标题</span></legend></fieldset>
      </div>
      <div class="md-input-group">
        <input class="md-input" name="description" placeholder=" ">
        <label class="md-label">描述（可选）</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>描述（可选）</span></legend></fieldset>
      </div>
      <div style="display:flex;gap:12px">
        <div class="md-input-group" style="flex:1">
          <input class="md-input" name="chapter" placeholder=" ">
          <label class="md-label">章节（如：第3章）</label>
          <fieldset class="md-border" aria-hidden="true"><legend><span>章节</span></legend></fieldset>
        </div>
        <div style="flex:1">
          ${createMdSelect({
            id: 'upload-category',
            label: '分类',
            options: categories.map(c => ({ text: c, value: c })),
            selected: '其他'
          })}
        </div>
      </div>
      <div class="form-error" id="upload-error" style="display:none"></div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">上传</button>
    </form>
  `;
  openModal('上传资料', html);

  setTimeout(() => {
    const dropZone = document.getElementById('upload-drop-zone');
    const fileInput = document.getElementById('upload-file-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
          fileInput.files = e.dataTransfer.files;
          onFileSelected(fileInput);
        }
      });
    }
  }, 100);
}

export function onFileSelected(input) {
  const nameEl = document.getElementById('upload-file-name');
  if (input.files.length && nameEl) {
    nameEl.textContent = '📎 ' + input.files[0].name;
    nameEl.style.display = 'block';
  }
}

export async function handleUploadMaterial(e, courseId) {
  e.preventDefault();
  const form = e.target;
  const fileInput = document.getElementById('upload-file-input');
  const errEl = document.getElementById('upload-error');

  if (!fileInput.files.length) {
    if (errEl) { errEl.textContent = '请选择文件'; errEl.style.display = 'block'; }
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('title', form.title.value.trim());
  formData.append('description', form.description.value.trim());
  formData.append('chapter', form.chapter.value.trim());
  formData.append('category', document.getElementById('upload-category')?.value || '其他');

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = '上传中...';

  try {
    const { getToken } = await import('../../core/api.js');
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`/api/materials/courses/${courseId}`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.textContent = '上传';
      return;
    }

    closeModal();
    showToast('上传成功');
    const contentEl = document.getElementById('detail-tab-content');
    const { enrolled } = window._courseDetail;
    if (contentEl) await loadMaterials(contentEl, courseId, enrolled);
  } catch (err) {
    if (errEl) { errEl.textContent = '上传失败'; errEl.style.display = 'block'; }
    btn.disabled = false;
    btn.textContent = '上传';
  }
}

/* ---- Backward-compatible exports ---- */
export async function handleAddComment(e, postId) {
  e.preventDefault();
  // Delegate to the new stream architecture
  await submitForumReply(postId, null, `post-${postId}`);
}
