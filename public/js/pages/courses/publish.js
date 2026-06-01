/**
 * pages/courses/publish.js — 合并通用发布表单
 * registerPage: publish
 *
 * 挂载路由 /course/:id/posts
 * 强制固定分类下拉 · 文件上传20MB限制
 * 资料分享或有附件时 → 同步开关强制开启且置灰
 */

import { apiGet, apiPost, getToken, isLoggedIn } from '../../core/api.js';
import { registerPage, navigateTo, animIn, bindRipples } from '../../core/router.js';
import { showToast, createMdSelect, escHtml } from '../../components/ui.js';

/* =============================================
   分类配置
   ============================================= */

const POST_CATEGORIES = [
  { text: '讨论', value: '讨论' },
  { text: '资料分享', value: '资料分享' },
  { text: '水贴', value: '水贴' },
  { text: '求助', value: '求助' },
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/* =============================================
   Page: 统一发布表单
   ============================================= */

registerPage('publish', async (container, courseId) => {
  if (!isLoggedIn()) {
    showToast('请先登录');
    navigateTo('profile');
    return;
  }

  container.innerHTML = `<div class="card"><p class="text-secondary">加载中...</p></div>`;

  let course;
  try {
    course = await apiGet(`/api/courses/${courseId}`);
    if (course.error) {
      container.innerHTML = `<div class="card"><p class="text-secondary">${course.error}</p></div>`;
      return;
    }
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="text-secondary">加载失败</p></div>`;
    return;
  }

  const backPage = window._myCourseSpace?.courseId === courseId ? 'mycourse-detail' : 'plaza-course';

  container.innerHTML = `
    <div class="create-post-page">
      <div class="create-post-header">
        <button class="btn btn-icon" onclick="navigateTo('${backPage}', ${courseId})" title="返回">
          <span class="mi">arrow_back</span>
        </button>
        <div class="create-post-breadcrumb">
          <span class="text-secondary">${escHtml(course.title)}</span>
          <span class="mi" style="font-size:18px;color:var(--md-outline)">chevron_right</span>
          <span style="font-weight:600">发帖</span>
        </div>
      </div>

      <div class="md-input-group" style="--md-field-bg: var(--md-surface)">
        <input class="md-input" type="text" id="publish-title" placeholder=" " required>
        <label class="md-label">标题</label>
        <fieldset class="md-border" aria-hidden="true"><legend><span>标题</span></legend></fieldset>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:var(--text-sm);font-weight:600;color:var(--md-on-surface);display:block;margin-bottom:8px">分类</label>
        ${createMdSelect({
          id: 'publish-category',
          label: '选择分类',
          options: POST_CATEGORIES,
          selected: '讨论',
        })}
      </div>

      <div class="rte-toolbar" role="toolbar" aria-label="文本格式化">
        <button type="button" class="rte-btn" data-cmd="bold" title="加粗 (Ctrl+B)">
          <span class="mi">format_bold</span>
        </button>
        <button type="button" class="rte-btn" data-cmd="italic" title="斜体 (Ctrl+I)">
          <span class="mi">format_italic</span>
        </button>
        <button type="button" class="rte-btn" data-cmd="underline" title="下划线 (Ctrl+U)">
          <span class="mi">format_underlined</span>
        </button>
      </div>

      <div class="rte-wrapper">
        <div class="rte-editor" contenteditable="true" id="publish-content" role="textbox" aria-multiline="true" aria-label="帖子内容"></div>
        <label class="rte-label">内容</label>
        <fieldset class="rte-border" aria-hidden="true"><legend><span>内容</span></legend></fieldset>
      </div>

      <div class="publish-attach-section">
        <label style="font-size:var(--text-sm);font-weight:600;color:var(--md-on-surface);display:block;margin-bottom:8px">
          <span class="mi" style="font-size:16px;vertical-align:-3px">attach_file</span> 附件（可选，最大 20MB）
        </label>
        <div id="publish-drop-zone" class="upload-drop-zone">
          <span class="mi" style="font-size:36px;color:var(--md-outline-variant)">cloud_upload</span>
          <p style="margin-top:8px;color:var(--md-on-surface-variant);font-size:14px">点击选择文件或拖拽到此处</p>
          <input type="file" id="publish-file-input" style="display:none" onchange="onPublishFileSelected(this)">
          <p id="publish-file-name" style="display:none;font-size:14px;font-weight:500;color:var(--md-primary);margin-top:8px"></p>
        </div>
      </div>

      <div class="publish-sync-row" id="publish-sync-row">
        <div style="flex:1">
          <div style="font-size:var(--text-sm);font-weight:600;color:var(--md-on-surface)">同步发送到课程广场</div>
          <div style="font-size:var(--text-xs);color:var(--md-on-surface-variant);margin-top:2px">勾选后帖子将在大课广场公开可见</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="publish-sync-toggle">
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="form-error" id="publish-error" style="display:none"></div>

      <button class="btn btn-primary" id="publish-submit-btn" style="width:100%;justify-content:center">
        <span class="mi">send</span> 发布
      </button>
    </div>
  `;

  // ---- 绑定事件 ----

  const editor = container.querySelector('#publish-content');
  const toolbar = container.querySelector('.rte-toolbar');

  toolbar.addEventListener('mousedown', (e) => e.preventDefault());

  editor.addEventListener('focus', () => {
    toolbar.style.borderColor = 'var(--md-primary)';
    toolbar.style.transition = 'border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)';
  });
  editor.addEventListener('blur', () => {
    toolbar.style.borderColor = '';
  });

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.rte-btn');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    document.execCommand(cmd, false, null);
    editor.focus();
    syncToolbarState();
  });

  function syncToolbarState() {
    toolbar.querySelectorAll('.rte-btn').forEach(btn => {
      const cmd = btn.dataset.cmd;
      btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  editor.addEventListener('keyup', syncToolbarState);
  editor.addEventListener('mouseup', syncToolbarState);

  const editorWrapper = container.querySelector('.rte-wrapper');
  function syncEditorContent() {
    editorWrapper.classList.toggle('has-content', editor.textContent.trim().length > 0);
  }
  editor.addEventListener('input', syncEditorContent);
  editor.addEventListener('blur', syncEditorContent);

  // ---- 附件上传 ----

  const dropZone = document.getElementById('publish-drop-zone');
  const fileInput = document.getElementById('publish-file-input');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.size > MAX_FILE_SIZE) {
        showToast('文件大小超过 20MB 限制');
        return;
      }
      fileInput.files = e.dataTransfer.files;
      onPublishFileSelected(fileInput);
    }
  });

  // ---- 同步开关联动状态机 ----

  const syncToggle = document.getElementById('publish-sync-toggle');
  const syncRow = document.getElementById('publish-sync-row');
  const categoryContainer = document.getElementById('publish-category-container');

  function checkSyncForceState() {
    const selectedCategory = categoryContainer?.querySelector('.md-select-value')?.textContent?.trim() || '';
    const hasFile = fileInput.files.length > 0;
    const shouldForce = (selectedCategory === '资料分享') || hasFile;

    if (shouldForce) {
      syncToggle.checked = true;
      syncToggle.disabled = true;
      syncRow.classList.add('forced');
    } else {
      syncToggle.disabled = false;
      syncRow.classList.remove('forced');
    }
  }

  // 分类变更监听
  if (categoryContainer) {
    categoryContainer.addEventListener('md-select-change', () => {
      checkSyncForceState();
    });
  }

  // 文件变更时检查
  fileInput.addEventListener('change', () => {
    checkSyncForceState();
  });

  // ---- 提交 ----

  container.querySelector('#publish-submit-btn').addEventListener('click', async () => {
    const title = container.querySelector('#publish-title').value.trim();
    const content = editor.innerHTML.trim();
    const errEl = container.querySelector('#publish-error');
    errEl.style.display = 'none';

    if (!title) {
      errEl.textContent = '请输入标题';
      errEl.style.display = 'block';
      return;
    }
    const textContent = editor.textContent.trim();
    if (!textContent) {
      errEl.textContent = '请输入内容';
      errEl.style.display = 'block';
      return;
    }

    const category = categoryContainer?.querySelector('.md-select-value')?.textContent?.trim() || '讨论';
    const syncToPlaza = syncToggle.checked;
    const hasFile = fileInput.files.length > 0;

    const btn = container.querySelector('#publish-submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mi">hourglass_empty</span> 发布中...';

    try {
      let result;

      if (hasFile) {
        // 有附件 → FormData 提交
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        formData.append('category', category);
        formData.append('sync_to_plaza', syncToPlaza ? '1' : '0');
        formData.append('file', fileInput.files[0]);

        const token = getToken();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/courses/${courseId}/posts`, {
          method: 'POST',
          headers,
          body: formData,
        });
        result = await res.json();
      } else {
        // 纯文本 → JSON 提交
        result = await apiPost(`/api/courses/${courseId}/posts`, {
          title,
          content,
          category,
          sync_to_plaza: syncToPlaza,
        });
      }

      if (result.error) {
        errEl.textContent = result.error;
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<span class="mi">send</span> 发布';
        return;
      }

      showToast('发帖成功');
      // 返回来源页面
      if (window._myCourseSpace?.courseId === courseId) {
        navigateTo('mycourse-detail', courseId);
      } else {
        navigateTo('plaza-course', courseId);
      }
    } catch (err) {
      errEl.textContent = '发布失败，请检查网络';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = '<span class="mi">send</span> 发布';
    }
  });

  bindRipples(container);
  animIn(container.querySelector('.create-post-header'), { y: 16, dur: 380 });
});

/* =============================================
   文件选择回调（供内联 onchange 使用）
   ============================================= */

export function onPublishFileSelected(input) {
  const nameEl = document.getElementById('publish-file-name');
  if (input.files.length && nameEl) {
    const file = input.files[0];
    if (file.size > MAX_FILE_SIZE) {
      showToast('文件大小超过 20MB 限制');
      input.value = '';
      nameEl.style.display = 'none';
      return;
    }
    nameEl.textContent = '📎 ' + file.name;
    nameEl.style.display = 'block';
  }

  // 触发联动检查
  const syncToggle = document.getElementById('publish-sync-toggle');
  const syncRow = document.getElementById('publish-sync-row');
  const categoryContainer = document.getElementById('publish-category-container');
  const selectedCategory = categoryContainer?.querySelector('.md-select-value')?.textContent?.trim() || '';
  const hasFile = input.files.length > 0;
  const shouldForce = (selectedCategory === '资料分享') || hasFile;

  if (shouldForce) {
    syncToggle.checked = true;
    syncToggle.disabled = true;
    syncRow.classList.add('forced');
  } else {
    syncToggle.disabled = false;
    syncRow.classList.remove('forced');
  }
}
