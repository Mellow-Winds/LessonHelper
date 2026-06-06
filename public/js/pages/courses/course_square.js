/**
 * pages/courses/course_square.js — 课程搭子帖共享模块
 * 供 detail.js 和 my_courses.js 的「交友」标签页使用
 *
 * 所有 DOM ID 均以 prefix 参数化，防止多页面共存时冲突
 * API 走 /api/courses/:id/square-posts/* 课程作用域端点
 */

import { apiGet, apiPost, apiPut, apiDelete, isLoggedIn, getToken } from '../../core/api.js';
import { animIn, animStagger } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, createMdTextarea, escHtml, formatTime } from '../../components/ui.js';

/* =============================================
   Constants
   ============================================= */

const COURSE_SQUARE_CATEGORIES = ['考研搭子', '考公搭子', '考证搭子', '项目组队', '技能交换', '竞赛组队', '其他'];

/* =============================================
   State（per-prefix 隔离）
   ============================================= */

const _state = {};  // { [prefix]: { postId: {...} } }

function getState(prefix) {
  if (!_state[prefix]) _state[prefix] = { loadedComments: {}, commentImageMap: {}, replyingTo: {} };
  return _state[prefix];
}

/* =============================================
   Tab 入口：渲染交友面板
   ============================================= */

export async function renderCourseSquareTab(container, courseId, prefix) {
  const st = getState(prefix);

  container.innerHTML = `
    <div class="form-row" style="justify-content:space-between;margin-bottom:16px;flex-wrap:wrap">
      ${createMdSelect({
        id: `${prefix}-sq-filter-category`,
        options: [{ text: '全部类型', value: 'all' }, ...COURSE_SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))],
        style: 'width:auto;min-width:120px;margin-bottom:0',
        onchange: `window._refreshCourseSquare_${prefix}(${courseId})`
      })}
      <button class="btn btn-primary btn-compact" id="${prefix}-sq-create-btn">
        <span class="mi">add</span> 发布搭子帖
      </button>
    </div>
    <div id="${prefix}-sq-posts-list"></div>
  `;

  // 绑定发帖按钮
  document.getElementById(`${prefix}-sq-create-btn`)?.addEventListener('click', () => {
    openCourseSquareCreateModal(courseId, prefix);
  });

  // 注册全局刷新函数
  window[`_refreshCourseSquare_${prefix}`] = (cid) => refreshCourseSquarePosts(cid, prefix);

  await refreshCourseSquarePosts(courseId, prefix);
}

/* =============================================
   刷新帖子列表
   ============================================= */

export async function refreshCourseSquarePosts(courseId, prefix) {
  const category = document.getElementById(`${prefix}-sq-filter-category`)?.value || 'all';
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);

  const listEl = document.getElementById(`${prefix}-sq-posts-list`);
  if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/courses/${courseId}/square-posts?${params.toString()}`);
    const posts = data?.posts || [];
    if (listEl) listEl.innerHTML = renderCourseSquarePosts(posts, courseId, prefix);
    const cards = listEl?.querySelectorAll('.square-post-card');
    if (cards?.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
  } catch {
    if (listEl) listEl.innerHTML = '<div class="card"><p class="text-secondary">加载失败</p></div>';
  }
}

function renderCourseSquarePosts(posts, courseId, prefix) {
  if (posts.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:48px">
        <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">group_add</span>
        <p class="text-secondary" style="margin-top:12px">暂无搭子帖，来发布第一个吧</p>
      </div>
    `;
  }

  const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
  const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

  return posts.map(p => `
    <div class="card square-post-card" data-course-id="${courseId}" data-post-id="${p.id}" data-prefix="${prefix}" style="cursor:pointer">
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
            <span><span class="mi" style="font-size:14px;vertical-align:-2px">person</span> ${escHtml(p.creator_name)}</span>
          </div>
          ${p.my_status ? `<div style="margin-top:6px;font-size:12px;color:var(--md-primary);font-weight:500">你: ${p.my_status === 'pending' ? '已申请，等待确认' : p.my_status === 'accepted' ? '已通过' : '已拒绝'}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/* =============================================
   帖子卡片点击 → 内联详情
   ============================================= */

// 事件委托：点击帖子卡片查看详情
document.addEventListener('click', (e) => {
  const card = e.target.closest('.square-post-card[data-prefix]');
  if (!card) return;
  const courseId = Number(card.dataset.courseId);
  const postId = Number(card.dataset.postId);
  const prefix = card.dataset.prefix;
  if (!courseId || !postId || !prefix) return;
  viewCourseSquarePost(courseId, postId, prefix);
});

/* =============================================
   帖子详情（内联渲染，不注册路由）
   ============================================= */

export async function viewCourseSquarePost(courseId, postId, prefix) {
  const tabContent = document.getElementById('detail-tab-content') || document.getElementById('my-course-tab-content');
  if (!tabContent) return;

  tabContent.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';

  try {
    const data = await apiGet(`/api/courses/${courseId}/square-posts/${postId}`);
    if (data.error) { tabContent.innerHTML = `<div class="card"><p class="text-secondary">${data.error}</p></div>`; return; }

    const isCreator = data.creator_id === window._currentUser?.id;
    const statusMap = { open: '招募中', full: '已满', closed: '已关闭', expired: '已过期' };
    const statusClass = { open: 'status-open', full: 'status-full', closed: 'status-closed', expired: 'status-closed' };

    tabContent.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <button class="btn btn-secondary" style="padding:6px 8px" id="${prefix}-sq-back-btn"><span class="mi">arrow_back</span></button>
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
        ${!isCreator ? renderCourseSquareAction(data, courseId, prefix) : ''}
        ${isCreator ? `<div style="margin-top:12px"><button class="btn btn-secondary" style="font-size:12px;padding:4px 12px" id="${prefix}-sq-delete-btn"><span class="mi" style="font-size:14px">delete</span> 删除帖子</button></div>` : ''}
      </div>

      ${isCreator ? renderCourseSquareCreatorPanel(data, courseId, prefix) : ''}

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
              ${m.qq ? `<div style="font-size:13px;color:var(--md-primary);cursor:pointer" onclick="navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:14px;vertical-align:-2px">qq</span> QQ: ${escHtml(m.qq)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="card">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px"><span class="mi" style="font-size:16px;vertical-align:-3px">chat</span> 评论</h3>
        <div id="${prefix}-sq-comments-${postId}"></div>
      </div>
    `;

    // 返回按钮
    document.getElementById(`${prefix}-sq-back-btn`)?.addEventListener('click', () => {
      renderCourseSquareTab(tabContent, courseId, prefix);
    });

    // 删除按钮
    document.getElementById(`${prefix}-sq-delete-btn`)?.addEventListener('click', () => {
      openModal('确认删除', `
        <p style="margin-bottom:24px">确定要删除这篇搭子帖吗？删除后无法恢复</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="${prefix}-confirm-delete-post" style="background:var(--md-error,#e53935)">删除</button>
        </div>
      `);
      document.getElementById(`${prefix}-confirm-delete-post`)?.addEventListener('click', async () => {
        const result = await apiDelete(`/api/courses/${courseId}/square-posts/${postId}`);
        if (result.error) { showToast(result.error); return; }
        closeModal();
        showToast('已删除');
        renderCourseSquareTab(tabContent, courseId, prefix);
      });
    });

    // 感兴趣按钮
    bindCourseSquareInterestBtn(courseId, postId, prefix);

    animIn(tabContent.querySelector('.card'), { y: 16, dur: 380 });

    // 加载评论
    const st = getState(prefix);
    st.loadedComments = {};
    toggleCourseSquareComments(courseId, postId, prefix);
  } catch (e) {
    tabContent.innerHTML = `<div class="card"><p class="text-secondary">加载失败: ${e.message}</p></div>`;
  }
}

function renderCourseSquareAction(data, courseId, prefix) {
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
  return `<div style="margin-top:12px"><button class="btn btn-primary" id="${prefix}-sq-interest-btn"><span class="mi" style="font-size:16px">favorite</span> 感兴趣</button></div>`;
}

function renderCourseSquareCreatorPanel(data, courseId, prefix) {
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
            <button class="btn btn-primary csq-accept-btn" style="font-size:12px;padding:4px 12px" data-interest-id="${p.interest_id}" data-course-id="${courseId}" data-post-id="${data.id}" data-prefix="${prefix}">接受</button>
            <button class="btn btn-secondary csq-reject-btn" style="font-size:12px;padding:4px 12px" data-interest-id="${p.interest_id}" data-course-id="${courseId}" data-post-id="${data.id}" data-prefix="${prefix}">拒绝</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 事件委托：接受 / 拒绝（感兴趣按钮通过 bindCourseSquareInterestBtn 直接绑定）
document.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('.csq-accept-btn');
  if (acceptBtn) {
    const { interestId, courseId, postId, prefix } = acceptBtn.dataset;
    await handleCourseSquareInterest(courseId, interestId, 'accept', postId, prefix);
    return;
  }

  const rejectBtn = e.target.closest('.csq-reject-btn');
  if (rejectBtn) {
    const { interestId, courseId, postId, prefix } = rejectBtn.dataset;
    await handleCourseSquareInterest(courseId, interestId, 'reject', postId, prefix);
    return;
  }
});

/* =============================================
   感兴趣 / 接受拒绝
   ============================================= */

// 绑定感兴趣按钮（动态渲染后调用）
export function bindCourseSquareInterestBtn(courseId, postId, prefix) {
  const btn = document.getElementById(`${prefix}-sq-interest-btn`);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const result = await apiPost(`/api/courses/${courseId}/square-posts/${postId}/interest`, {});
    if (result.error) { showToast(result.error); return; }
    showToast('已申请');
    viewCourseSquarePost(courseId, postId, prefix);
  });
}

async function handleCourseSquareInterest(courseId, interestId, action, postId, prefix) {
  const result = await apiPut(`/api/courses/${courseId}/square-interests/${interestId}`, { action });
  if (result.error) { showToast(result.error); return; }
  showToast(action === 'accept' ? '已接受' : '已拒绝');
  viewCourseSquarePost(courseId, Number(postId), prefix);
}

/* =============================================
   发帖 Modal
   ============================================= */

export function openCourseSquareCreateModal(courseId, prefix) {
  openModal('发布搭子帖', `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${createMdInput({ id: `${prefix}-sq-title`, label: '标题', placeholder: ' ' })}
      ${createMdSelect({
        id: `${prefix}-sq-category`,
        label: '类型',
        options: COURSE_SQUARE_CATEGORIES.map(c => ({ text: c, value: c }))
      })}
      ${createMdTextarea({ id: `${prefix}-sq-desc`, label: '描述', placeholder: '详细描述你的需求...', rows: 4 })}
      ${createMdInput({ id: `${prefix}-sq-max`, label: '期望人数', type: 'number', value: '2', min: '1', max: '20' })}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" id="${prefix}-sq-submit-btn">发布</button>
      </div>
    </div>
  `);

  document.getElementById(`${prefix}-sq-submit-btn`)?.addEventListener('click', async () => {
    const title = document.getElementById(`${prefix}-sq-title`)?.value?.trim();
    const category = document.getElementById(`${prefix}-sq-category`)?.value;
    const description = document.getElementById(`${prefix}-sq-desc`)?.value?.trim();
    const max_people = Number(document.getElementById(`${prefix}-sq-max`)?.value) || 2;

    if (!title) { showToast('请输入标题'); return; }
    if (!category) { showToast('请选择类型'); return; }

    const btn = document.getElementById(`${prefix}-sq-submit-btn`);
    btn.disabled = true;
    btn.textContent = '发布中...';

    const result = await apiPost(`/api/courses/${courseId}/square-posts`, { title, category, description, max_people });
    if (result.error) {
      showToast(result.error);
      btn.disabled = false;
      btn.textContent = '发布';
      return;
    }

    closeModal();
    showToast('发布成功');
    await refreshCourseSquarePosts(courseId, prefix);
  });
}

/* =============================================
   评论系统（楼中楼 + 图片 + 软删除）
   ============================================= */

function formatCsqRelativeTime(ts) {
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

async function toggleCourseSquareComments(courseId, postId, prefix) {
  const st = getState(prefix);
  const section = document.getElementById(`${prefix}-sq-comments-${postId}`);
  if (!section) return;

  if (!st.loadedComments[postId]) {
    section.innerHTML = renderCsqCommentSkeleton(prefix);
    try {
      const data = await apiGet(`/api/courses/${courseId}/square-posts/${postId}/comments?page=1&pageSize=20`);
      st.loadedComments[postId] = {
        comments: data.comments || [],
        total: data.total || 0,
        page: 1,
        hasMore: (data.comments || []).length < (data.total || 0)
      };
      renderCsqComments(section, courseId, postId, prefix);
    } catch {
      section.innerHTML = '<div class="comment-error">加载失败，点击重试</div>';
      section.querySelector('.comment-error')?.addEventListener('click', () => {
        st.loadedComments[postId] = null;
        toggleCourseSquareComments(courseId, postId, prefix);
      });
    }
  } else {
    renderCsqComments(section, courseId, postId, prefix);
  }
}

function renderCsqCommentSkeleton(prefix) {
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

function renderCsqComments(section, courseId, postId, prefix) {
  const st = getState(prefix);
  const data = st.loadedComments[postId] || { comments: [], total: 0, page: 1, hasMore: false };
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
    <div class="comment-list" id="${prefix}-sq-comment-list-${postId}">
      ${rootComments.length === 0 && !hasMore
        ? '<p class="text-secondary" style="text-align:center;padding:16px;font-size:var(--text-sm)">暂无回复</p>'
        : rootComments.map((c, idx) => renderCsqSingleComment(c, idx + 1, courseId, postId, prefix, childMap, 0)).join('')
      }
      ${hasMore ? `<div class="comment-load-more" id="${prefix}-sq-load-more-${postId}">加载更多回复</div>` : ''}
    </div>
    ${isLoggedIn() ? renderCsqCommentInput(postId, prefix) : '<p class="text-secondary" style="margin-top:12px;font-size:var(--text-sm)"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
  `;

  bindCsqCommentEvents(section, courseId, postId, prefix);
}

function renderCsqSingleComment(comment, floorNum, courseId, postId, prefix, childMap, depth) {
  const st = getState(prefix);
  const isOwner = window._currentUser && comment.author_id === window._currentUser.id;
  const children = childMap[comment.id] || [];
  const maxDepth = 3;

  return `
    <div class="comment-item ${depth > 0 ? 'comment-nested' : ''}" data-comment-id="${comment.id}" data-depth="${depth}">
      <div class="comment-header">
        ${depth === 0 ? `<span class="comment-floor">${floorNum} 楼</span>` : ''}
        ${comment.author_avatar_url
          ? `<img class="comment-avatar" src="${escHtml(comment.author_avatar_url)}" alt="">`
          : `<div class="comment-avatar-letter">${escHtml((comment.author_name || '?')[0])}</div>`
        }
        <div class="comment-meta">
          <button class="user-profile-link" onclick="navigateTo('profile-user', ${comment.author_id})">
            ${escHtml(comment.author_name)}
          </button>
          <span class="comment-time">${formatCsqRelativeTime(comment.created_at)}</span>
        </div>
      </div>
      ${comment.parent_id && depth > 0 ? (() => {
        const parent = (st.loadedComments[postId]?.comments || []).find(c => c.id === comment.parent_id);
        return parent ? `<div class="comment-reply-ref">回复 @${escHtml(parent.author_name || '')}</div>` : '';
      })() : ''}
      <div class="comment-body">
        <p class="comment-content">${escHtml(comment.content)}</p>
        ${comment.image_url ? `<div class="comment-image-wrap"><img src="${escHtml(comment.image_url)}" alt="评论图片" class="comment-image" loading="lazy" onclick="window.open('${escHtml(comment.image_url)}', '_blank')"></div>` : ''}
      </div>
      <div class="comment-actions">
        ${isLoggedIn() ? `<button class="comment-action-btn comment-reply-btn" data-comment-id="${comment.id}" data-author="${escHtml(comment.author_name)}"><span class="mi" style="font-size:14px">reply</span> 回复</button>` : ''}
        ${isOwner ? `<button class="comment-action-btn comment-delete-btn" data-comment-id="${comment.id}" data-post-id="${postId}"><span class="mi" style="font-size:14px">delete</span> 删除</button>` : ''}
      </div>
      ${children.length > 0 && depth < maxDepth
        ? children.map(c => renderCsqSingleComment(c, 0, courseId, postId, prefix, childMap, depth + 1)).join('')
        : ''
      }
      ${children.length > 0 && depth >= maxDepth
        ? `<button class="comment-load-more-replies" data-parent-id="${comment.id}" data-post-id="${postId}" data-course-id="${courseId}" data-prefix="${prefix}">查看更多回复 (${children.length})</button>`
        : ''
      }
    </div>
  `;
}

function renderCsqCommentInput(postId, prefix) {
  const st = getState(prefix);
  const replyRef = st.replyingTo[postId];
  return `
    <div class="comment-input-area" id="${prefix}-sq-input-area-${postId}">
      ${replyRef ? `<div class="comment-reply-ref-bar">回复 @${escHtml(replyRef.author_name)}<button class="comment-cancel-reply" data-post-id="${postId}" data-prefix="${prefix}"><span class="mi" style="font-size:16px">close</span></button></div>` : ''}
      <div class="comment-input-row">
        <div class="comment-textarea-wrap">
          <textarea class="comment-textarea" id="${prefix}-sq-textarea-${postId}" placeholder="写回复..." rows="2" maxlength="500"></textarea>
          <span class="comment-char-count" id="${prefix}-sq-char-count-${postId}">0/500</span>
        </div>
        <div class="comment-input-actions">
          <label class="comment-action-btn comment-upload-btn" title="上传图片">
            <span class="mi" style="font-size:20px">add_photo_alternate</span>
            <input type="file" accept=".jpg,.jpeg,.png" style="display:none" id="${prefix}-sq-img-input-${postId}">
          </label>
          <button class="btn btn-primary comment-send-btn" id="${prefix}-sq-send-btn-${postId}" disabled>
            <span class="mi" style="font-size:18px">send</span>
          </button>
        </div>
      </div>
      <div class="comment-image-preview" id="${prefix}-sq-img-preview-${postId}" style="display:none">
        <img id="${prefix}-sq-preview-img-${postId}" src="" alt="">
        <button class="comment-remove-image" data-post-id="${postId}" data-prefix="${prefix}"><span class="mi" style="font-size:16px">close</span></button>
      </div>
      <div class="comment-tip">请遵守社区规范，禁止发布违规内容</div>
    </div>
  `;
}

function bindCsqCommentEvents(section, courseId, postId, prefix) {
  const st = getState(prefix);

  // 回复按钮
  section.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      st.replyingTo[postId] = { id: Number(btn.dataset.commentId), author_name: btn.dataset.author };
      renderCsqComments(section, courseId, postId, prefix);
      const textarea = document.getElementById(`${prefix}-sq-textarea-${postId}`);
      if (textarea) { textarea.focus(); textarea.value = `@${btn.dataset.author} `; updateCsqCharCount(postId, prefix); }
    });
  });

  // 取消回复
  section.querySelectorAll('.comment-cancel-reply').forEach(btn => {
    btn.addEventListener('click', () => {
      delete st.replyingTo[postId];
      renderCsqComments(section, courseId, postId, prefix);
    });
  });

  // 删除按钮
  section.querySelectorAll('.comment-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal('确认删除', `
        <p style="margin-bottom:24px">确定要删除这条回复吗？删除后无法恢复</p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" id="${prefix}-confirm-delete-csq-comment" style="background:var(--md-error,#e53935)">删除</button>
        </div>
      `);
      document.getElementById(`${prefix}-confirm-delete-csq-comment`)?.addEventListener('click', async () => {
        const result = await apiDelete(`/api/courses/${courseId}/square-posts/${postId}/comments/${btn.dataset.commentId}`);
        if (result.error) { showToast(result.error); return; }
        closeModal();
        st.loadedComments[postId] = null;
        toggleCourseSquareComments(courseId, postId, prefix);
        showToast('已删除');
      });
    });
  });

  // 加载更多
  const loadMoreBtn = document.getElementById(`${prefix}-sq-load-more-${postId}`);
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
      loadMoreBtn.textContent = '加载中...';
      loadMoreBtn.disabled = true;
      const data = st.loadedComments[postId];
      const nextPage = data.page + 1;
      try {
        const result = await apiGet(`/api/courses/${courseId}/square-posts/${postId}/comments?page=${nextPage}&pageSize=20`);
        data.comments.push(...(result.comments || []));
        data.page = nextPage;
        data.hasMore = data.comments.length < data.total;
        renderCsqComments(section, courseId, postId, prefix);
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
        const replies = await apiGet(`/api/courses/${courseId}/square-posts/${postId}/comments/${parentId}/replies`);
        const data = st.loadedComments[postId];
        replies.forEach(r => {
          if (!data.comments.find(c => c.id === r.id)) data.comments.push(r);
        });
        renderCsqComments(section, courseId, postId, prefix);
      } catch {
        btn.textContent = '加载失败';
      }
    });
  });

  // 文本输入
  const textarea = document.getElementById(`${prefix}-sq-textarea-${postId}`);
  if (textarea) {
    textarea.addEventListener('input', () => updateCsqCharCount(postId, prefix));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitCsqComment(courseId, postId, prefix, section);
      }
    });
    textarea.focus();
  }

  // 发送按钮
  const sendBtn = document.getElementById(`${prefix}-sq-send-btn-${postId}`);
  if (sendBtn) {
    sendBtn.addEventListener('click', () => submitCsqComment(courseId, postId, prefix, section));
  }

  // 图片上传
  const imgInput = document.getElementById(`${prefix}-sq-img-input-${postId}`);
  if (imgInput) {
    imgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) { showToast('图片不能超过 1MB'); imgInput.value = ''; return; }
      st.commentImageMap[postId] = file;
      const preview = document.getElementById(`${prefix}-sq-img-preview-${postId}`);
      const previewImg = document.getElementById(`${prefix}-sq-preview-img-${postId}`);
      if (preview && previewImg) {
        previewImg.src = URL.createObjectURL(file);
        preview.style.display = 'block';
      }
      updateCsqSendBtn(postId, prefix);
    });
  }

  // 移除图片
  section.querySelectorAll('.comment-remove-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = Number(btn.dataset.postId);
      delete st.commentImageMap[pid];
      const preview = document.getElementById(`${prefix}-sq-img-preview-${pid}`);
      if (preview) preview.style.display = 'none';
      const imgInputEl = document.getElementById(`${prefix}-sq-img-input-${pid}`);
      if (imgInputEl) imgInputEl.value = '';
      updateCsqSendBtn(pid, prefix);
    });
  });
}

function updateCsqCharCount(postId, prefix) {
  const textarea = document.getElementById(`${prefix}-sq-textarea-${postId}`);
  const counter = document.getElementById(`${prefix}-sq-char-count-${postId}`);
  if (!textarea || !counter) return;
  const len = textarea.value.length;
  counter.textContent = `${len}/500`;
  counter.classList.toggle('exceeded', len >= 500);
  updateCsqSendBtn(postId, prefix);
}

function updateCsqSendBtn(postId, prefix) {
  const st = getState(prefix);
  const textarea = document.getElementById(`${prefix}-sq-textarea-${postId}`);
  const sendBtn = document.getElementById(`${prefix}-sq-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;
  const hasContent = textarea.value.trim().length > 0;
  const hasImage = !!st.commentImageMap[postId];
  const notExceeded = textarea.value.length <= 500;
  sendBtn.disabled = !(hasContent || hasImage) || !notExceeded;
}

async function submitCsqComment(courseId, postId, prefix, section) {
  const st = getState(prefix);
  const textarea = document.getElementById(`${prefix}-sq-textarea-${postId}`);
  const sendBtn = document.getElementById(`${prefix}-sq-send-btn-${postId}`);
  if (!textarea || !sendBtn) return;

  const content = textarea.value.trim();
  const imageFile = st.commentImageMap[postId];
  if (!content && !imageFile) return;
  if (content.length > 500) { showToast('回复内容不能超过 500 字'); return; }

  textarea.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span class="mi" style="font-size:18px">hourglass_empty</span>';

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (st.replyingTo[postId]) formData.append('parent_id', st.replyingTo[postId].id);
    if (imageFile) formData.append('image', imageFile);

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/courses/${courseId}/square-posts/${postId}/comments`, { method: 'POST', headers, body: formData });
    const result = await res.json();

    if (result.error) {
      showToast(result.error);
      textarea.disabled = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="mi" style="font-size:18px">send</span>';
      return;
    }

    textarea.value = '';
    delete st.commentImageMap[postId];
    delete st.replyingTo[postId];
    const preview = document.getElementById(`${prefix}-sq-img-preview-${postId}`);
    if (preview) preview.style.display = 'none';
    const imgInputEl = document.getElementById(`${prefix}-sq-img-input-${postId}`);
    if (imgInputEl) imgInputEl.value = '';

    st.loadedComments[postId] = null;
    toggleCourseSquareComments(courseId, postId, prefix);
    setTimeout(() => {
      const list = document.getElementById(`${prefix}-sq-comment-list-${postId}`);
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
