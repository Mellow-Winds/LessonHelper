/**
 * pages/courses/detail.js — 全站统一大课空间详情页
 * registerPage: course-detail
 *
 * 通过 courseId 动态评估当前用户的在修状态：
 *   - 已选修 → 三段药丸（论坛/资料/交友）+ 发布按钮激活
 *   - 未选修 → 两段药丸（论坛/资料）+ 发布按钮置灰 + 交友物理隐藏
 */

import { apiGet, apiPost, apiDelete, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, animStagger, bindRipples } from '../../core/router.js';
import { showToast, openModal, closeModal, createMdInput, createMdSelect, escHtml, formatTime, formatFileSize, renderLoginPrompt, bindLoginPrompt } from '../../components/ui.js';
import { renderAuth } from '../auth.js';
import { getFavoriteCourseIds, getFavoritePostIds, renderCourseFavoriteButton, renderPostFavoriteButton } from '../favorites.js';
import { renderPostAttachments } from './post_attachments.js';
import { cleanBigCourseName } from './all_courses.js';

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
    return Array.isArray(myCourses) && myCourses.some(c => c.id === Number(courseId));
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

    // 构建发布按钮：已选修 → 可用；未选修 → 置灰
    const publishBtn = enrolled
      ? `<button class="btn btn-primary btn-compact" onclick="navigateTo('publish', ${courseId})">
           <span class="mi">edit</span> 发布
         </button>`
      : `<button class="btn btn-disabled btn-compact" onclick="showPublishBlockedToast()">
           <span class="mi">edit</span> 发布
         </button>`;

    // 构建药丸 Tabs：已选修多一个"交友"
    const memberTab = enrolled
      ? `<button class="md-pill-btn" data-tab="members" onclick="switchDetailTab('members', ${courseId})">
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
        ${publishBtn}
      </div>
      <div class="md-pills" id="detail-pills">
        <button class="md-pill-btn active" data-tab="forum" onclick="switchDetailTab('forum', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">forum</span> 论坛
        </button>
        <button class="md-pill-btn" data-tab="materials" onclick="switchDetailTab('materials', ${courseId})">
          <span class="mi" style="font-size:16px;vertical-align:-3px">folder</span> 资料
        </button>
        ${memberTab}
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
    case 'members':
      if (enrolled) await renderMembersTab(contentEl, courseId);
      break;
  }
}

/* =============================================
   论坛标签页
   ============================================= */

async function renderForumTab(contentEl, courseId, enrolled) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const posts = await apiGet(`/api/courses/${courseId}/posts`);
  const favoritePostIds = await getFavoritePostIds();

  // 已选修时显示成员侧栏
  const memberSidebar = enrolled ? await renderMemberSidebar(courseId) : '';

  contentEl.innerHTML = `
    <div style="display:flex;gap:24px">
      <div style="flex:1;min-width:0" id="detail-posts-area">
        ${posts.length === 0 ? `
          <div class="card" style="text-align:center;padding:48px">
            <span class="mi" style="font-size:48px;color:var(--md-outline-variant)">forum</span>
            <p class="text-secondary" style="margin-top:12px">${enrolled ? '暂无帖子，来发第一个吧' : '暂无帖子'}</p>
          </div>
        ` : posts.map(p => `
          <div class="card mb-4 post-card${enrolled ? ' clickable' : ''}" id="post-${p.id}">
            <h3 class="card-title" ${enrolled ? `style="cursor:pointer" onclick="toggleComments(${p.id})"` : ''}>${escHtml(p.title)}</h3>
            <p style="margin-top:8px;white-space:pre-wrap">${escHtml(p.content)}</p>
            ${renderPostAttachments(p.attachments)}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:var(--text-sm);color:var(--md-on-surface-variant)">
              <span><button class="user-profile-link" onclick="event.stopPropagation();navigateTo('profile-user', ${p.author_id})">${escHtml(p.author_name)}</button> · ${formatTime(p.created_at)}</span>
              ${renderPostFavoriteButton(p.id, favoritePostIds.has(p.id))}
              ${enrolled ? `
                <span style="cursor:pointer;color:var(--md-primary);font-weight:500" onclick="toggleComments(${p.id})">
                  <span class="mi" style="font-size:16px;vertical-align:-3px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
                </span>
              ` : `
                <span>
                  <span class="mi" style="font-size:16px;vertical-align:-3px">chat_bubble_outline</span> ${p.comment_count || 0} 回复
                </span>
              `}
            </div>
            ${enrolled ? `<div class="comments-section" id="comments-${p.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--md-outline-variant)"></div>` : ''}
          </div>
        `).join('')}
      </div>
      ${memberSidebar}
    </div>
  `;

  const cards = contentEl.querySelectorAll('.post-card');
  if (cards.length) animStagger(Array.from(cards), { y: 20, dur: 400, gap: 50 });

  // 定位目标帖子
  const targetId = window._courseDetailTargetPostId;
  if (targetId) {
    document.getElementById(`post-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window._courseDetailTargetPostId = null;
  }
}

/* =============================================
   成员侧栏（已选修时论坛/资料页右侧显示）
   ============================================= */

async function renderMemberSidebar(courseId) {
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  return `
    <div style="width:220px;flex-shrink:0">
      <div class="card" id="detail-members-sidebar">
        <h3 style="font-size:var(--text-sm);font-weight:600;margin-bottom:12px;color:var(--md-on-surface-variant)">
          <span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 成员 (<span id="detail-member-count">${members.length}</span>)
        </h3>
        <div id="detail-member-filters" style="margin-bottom:12px">
          ${createMdSelect({
            id: 'detail-filter-major',
            options: [{ text: '全部专业', value: '' }, ...(stats?.majors || []).map(m => ({ text: m, value: m }))],
            onchange: `filterMembers(${courseId})`
          })}
          ${createMdSelect({
            id: 'detail-filter-grade',
            options: [{ text: '全部年级', value: '' }, ...(stats?.grades || []).map(g => ({ text: g, value: g }))],
            onchange: `filterMembers(${courseId})`
          })}
        </div>
        <div id="detail-members-list">
          ${renderMembersList(members)}
        </div>
      </div>
    </div>
  `;
}

function renderMembersList(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-item member-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--text-sm);font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">qq</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

export async function filterMembers(courseId) {
  const major = document.getElementById('detail-filter-major')?.value || '';
  const grade = document.getElementById('detail-filter-grade')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const listEl = document.getElementById('detail-members-list');
  if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (listEl) listEl.innerHTML = renderMembersList(members);
    const countEl = document.getElementById('detail-member-count');
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (listEl) listEl.innerHTML = '<p class="text-secondary" style="font-size:12px;text-align:center;padding:8px 0">加载失败</p>';
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

  // 已选修时显示成员侧栏和上传按钮
  const memberSidebar = enrolled ? await renderMemberSidebar(courseId) : '';
  const uploadBtn = enrolled
    ? `<button class="btn btn-primary" onclick="openUploadMaterialModal(${courseId})">
         <span class="mi">upload</span> 上传资料
       </button>`
    : '';

  contentEl.innerHTML = `
    <div style="display:flex;gap:24px">
      <div style="flex:1;min-width:0">
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
      </div>
      ${memberSidebar}
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

/* =============================================
   交友标签页（已选修专属 · 全宽网格）
   ============================================= */

async function renderMembersTab(contentEl, courseId) {
  contentEl.innerHTML = '<div class="card"><p class="text-secondary">加载中...</p></div>';
  const members = await apiGet(`/api/courses/${courseId}/members`);
  const stats = await apiGet(`/api/courses/${courseId}/members/stats`);

  contentEl.innerHTML = `
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <span style="font-weight:600;color:var(--md-on-surface-variant)"><span class="mi" style="font-size:16px;vertical-align:-3px">people</span> 课程成员 (<span id="detail-member-count-full">${members.length}</span>)</span>
        <div style="flex:1"></div>
        ${createMdSelect({
          id: 'detail-filter-major-full',
          options: [{ text: '全部专业', value: '' }, ...(stats?.majors || []).map(m => ({ text: m, value: m }))],
          style: 'width:auto;min-width:120px;margin-bottom:0',
          onchange: `filterMembersTab(${courseId})`
        })}
        ${createMdSelect({
          id: 'detail-filter-grade-full',
          options: [{ text: '全部年级', value: '' }, ...(stats?.grades || []).map(g => ({ text: g, value: g }))],
          style: 'width:auto;min-width:120px;margin-bottom:0',
          onchange: `filterMembersTab(${courseId})`
        })}
      </div>
      <div id="detail-members-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${renderMemberCards(members)}
      </div>
    </div>
  `;

  const cards = contentEl.querySelectorAll('.member-card-grid');
  if (cards.length) animStagger(Array.from(cards), { y: 16, dur: 350, gap: 40 });
}

function renderMemberCards(members) {
  if (members.length === 0) {
    return '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">暂无匹配成员</p>';
  }
  return members.map(m => `
    <div class="member-card-grid member-profile-link" onclick="navigateTo('profile-user', ${m.user_id})">
      <div class="avatar-small">${(m.nickname || '?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${escHtml(m.nickname)}</div>
        ${(m.major || m.grade) ? `<div style="font-size:12px;color:var(--md-on-surface-variant)">${escHtml([m.major, m.grade].filter(Boolean).join(' · '))}</div>` : ''}
        ${m.qq ? `<div style="font-size:12px;color:var(--md-primary);cursor:pointer" onclick="event.stopPropagation();navigator.clipboard.writeText('${escHtml(m.qq)}');showToast('QQ号已复制')"><span class="mi" style="font-size:12px;vertical-align:-1px">qq</span> ${escHtml(m.qq)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

export async function filterMembersTab(courseId) {
  const major = document.getElementById('detail-filter-major-full')?.value || '';
  const grade = document.getElementById('detail-filter-grade-full')?.value || '';
  const params = new URLSearchParams();
  if (major) params.set('major', major);
  if (grade) params.set('grade', grade);

  const gridEl = document.getElementById('detail-members-grid');
  const countEl = document.getElementById('detail-member-count-full');
  if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载中...</p>';

  try {
    const members = await apiGet(`/api/courses/${courseId}/members?${params.toString()}`);
    if (gridEl) gridEl.innerHTML = renderMemberCards(members);
    if (countEl) countEl.textContent = members.length;
  } catch {
    if (gridEl) gridEl.innerHTML = '<p class="text-secondary" style="text-align:center;padding:32px;grid-column:1/-1">加载失败</p>';
  }
}

/* =============================================
   Post & Comment Helpers
   ============================================= */

let loadedComments = {};

export async function toggleComments(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  if (section.style.display === 'block') {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (!loadedComments[postId]) {
    section.innerHTML = '<p class="text-secondary">加载中...</p>';
    try {
      const comments = await apiGet(`/api/courses/posts/${postId}/comments`);
      loadedComments[postId] = comments;
      renderComments(section, postId, comments);
    } catch {
      section.innerHTML = '<p class="text-secondary">加载失败</p>';
    }
  } else {
    renderComments(section, postId, loadedComments[postId]);
  }
}

function renderComments(section, postId, comments) {
  section.innerHTML = `
    ${comments.length === 0 ? '<p class="text-secondary">暂无回复</p>' : comments.map(c => `
      <div style="padding:10px 0;border-bottom:1px solid var(--md-outline-variant)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <button class="user-profile-link" onclick="navigateTo('profile-user', ${c.author_id})">${escHtml(c.author_name)}</button>
          <span style="font-size:12px;color:var(--md-on-surface-variant)">${formatTime(c.created_at)}</span>
        </div>
        <p style="font-size:var(--text-sm);white-space:pre-wrap">${escHtml(c.content)}</p>
      </div>
    `).join('')}
    ${isLoggedIn() ? `
      <form onsubmit="handleAddComment(event, ${postId})" style="display:flex;gap:8px;margin-top:12px;align-items:flex-start">
        ${createMdInput({
          label: '写回复',
          required: true,
          style: 'flex:1;margin-bottom:0',
          placeholder: ' '
        })}
        <button type="submit" class="btn btn-primary" style="padding:12px 16px;height:56px">
          <span class="mi">send</span>
        </button>
      </form>
    ` : '<p class="text-secondary" style="margin-top:12px;font-size:var(--text-sm)"><a href="#" onclick="navigateTo(\'profile\')" style="color:var(--md-primary)">登录</a> 后参与讨论</p>'}
  `;
}

export async function handleAddComment(e, postId) {
  e.preventDefault();
  const input = e.target.content;
  const content = input.value.trim();
  if (!content) return;

  const result = await apiPost(`/api/courses/posts/${postId}/comments`, { content });

  if (result.error) {
    showToast(result.error);
    return;
  }

  input.value = '';
  loadedComments[postId] = null;
  toggleComments(postId);
  setTimeout(() => toggleComments(postId), 50);
  showToast('回复成功');
}
