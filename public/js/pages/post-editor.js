/**
 * pages/post-editor.js — 左右分栏流式编辑器
 *
 * 左栏：contentEditable 编辑区，文字和卡片混合排列
 * 右栏：卡片模板列表，拖拽/点击插入
 *
 * 卡片插入后直接渲染，点击弹出 modal 编辑字段
 */

import { registerPage, navigateTo, animIn, bindRipples, renderMarkdown } from '../core/router.js';
import { apiGet, apiPost, isLoggedIn, getToken } from '../core/api.js';
import { showToast, openModal, closeModal, createMdInput } from '../components/ui.js';
import { renderModule } from '../components/card-renderer.js';

/* =============================================
   状态
   ============================================= */

let _templates = [];
let _draggedTemplate = null;   // 正在拖拽的模板对象
let _draggedCardEl = null;     // 正在拖拽的已插入卡片元素
let _editingPostId = null;     // 编辑模式下的帖子 ID，null = 创建模式

/* =============================================
   使用教程弹窗
   ============================================= */

function showEditorTutorial() {
  return new Promise((resolve) => {
    const tutorialMd = `## 发布指南

### 基本操作
- **输入文字**：在左侧编辑区直接打字，回车换行
- **插入卡片**：从右侧模板列表拖拽到编辑区，或点击模板上的 **+** 按钮
- **编辑卡片**：点击已插入的卡片，在弹窗中填写各字段
- **删除卡片**：鼠标悬停卡片，点击右上角 **×** 按钮
- **移动卡片**：拖拽卡片到目标位置

### 排版规范
- 文字和卡片可以自由交替排列
- 一张帖子可以包含多张卡片
- 粘贴内容会自动清除格式

### 使用规范
- 内容真实有效，禁止虚假信息
- 尊重他人，禁止恶意内容
- 联系方式请填写在卡片对应字段中`;

    openModal('发布指南', `
      <div class="editor-tutorial-content">${renderMarkdown(tutorialMd)}</div>
      <div class="card-edit-actions">
        <button class="btn btn-primary" id="tutorial-agree">我知道了</button>
      </div>
    `);

    document.getElementById('tutorial-agree')?.addEventListener('click', () => {
      closeModal();
      resolve();
    });
  });
}

/* =============================================
   入口
   ============================================= */

async function renderPostEditor(container, postId) {
  if (!isLoggedIn()) { showToast('请先登录'); navigateTo('explore'); return; }

  _editingPostId = postId || null;
  const isEdit = !!_editingPostId;

  // 加载模板
  try {
    _templates = await apiGet('/api/card-templates');
    if (_templates.error) _templates = [];
  } catch (e) { _templates = []; }

  // 编辑模式：加载已有帖子数据
  let existingPost = null;
  if (isEdit) {
    try {
      existingPost = await apiGet(`/api/explore/posts/${postId}`);
    } catch (e) { /* fallback to create mode */ }
  }

  // 首次进入弹出使用教程（创建模式）
  if (!isEdit) await showEditorTutorial();

  container.innerHTML = `
    <div class="page-header">
      <button class="btn btn-secondary btn-compact" id="editor-back-btn">
        <i class="ri-arrow-left-line"></i> 返回
      </button>
      <h1 class="page-title" style="margin:0">${isEdit ? '编辑帖子' : '发布'}</h1>
      <button class="btn btn-primary btn-compact" id="editor-submit-btn">${isEdit ? '保存' : '发布'}</button>
    </div>

    <div id="editor-title-input"></div>

    <div class="editor-split">
      <div class="editor-left">
        <div class="editor-toolbar">
          <button class="editor-toolbar-btn" data-cmd="bold" title="加粗"><i class="ri-bold"></i></button>
          <button class="editor-toolbar-btn" data-cmd="italic" title="斜体"><i class="ri-italic"></i></button>
          <button class="editor-toolbar-btn" data-cmd="underline" title="下划线"><i class="ri-underline"></i></button>
          <div class="editor-toolbar-sep"></div>
          <button class="editor-toolbar-btn" id="toolbar-insert-card" title="插入卡片"><i class="ri-layout-grid-line"></i> 卡片</button>
        </div>
        <div class="editor-canvas" id="editor-canvas" contenteditable="true"></div>
      </div>
      <div class="editor-right">
        <div class="editor-right-header">卡片模板</div>
        <div class="editor-template-list" id="editor-template-list"></div>
      </div>
    </div>
  `;

  bindRipples(container);
  animIn(container.querySelector('.page-header'), { y: 16, dur: 380 });

  // 渲染标题输入
  container.querySelector('#editor-title-input').innerHTML = createMdInput({
    id: 'post-title', label: '帖子标题', placeholder: ' ', required: true,
    value: existingPost?.title || ''
  });

  // 渲染模板列表
  renderTemplateList(container.querySelector('#editor-template-list'));

  // 编辑模式：还原已有内容到编辑区
  if (isEdit && existingPost) {
    const canvas = container.querySelector('#editor-canvas');
    restoreBlocksToCanvas(canvas, existingPost.blocks || []);
  }

  // 绑定事件
  bindEditorEvents(container);
}

/**
 * 将 blocks 还原到 contentEditable 编辑区
 */
function restoreBlocksToCanvas(canvas, blocks) {
  if (!blocks || blocks.length === 0) return;
  for (const block of blocks) {
    if (block.type === 'text' && block.data) {
      canvas.appendChild(document.createTextNode(block.data));
      canvas.appendChild(document.createElement('br'));
    } else if (block.type === 'card' && block.card) {
      const cardEl = createCardElement(block.card);
      canvas.appendChild(cardEl);
      canvas.appendChild(document.createTextNode('\n'));
    }
  }
}

/* =============================================
   模板列表（右栏）
   ============================================= */

function renderTemplateList(el) {
  if (!el) return;
  if (_templates.length === 0) {
    el.innerHTML = '<p class="text-secondary" style="padding:16px;font-size:13px">暂无模板</p>';
    return;
  }

  el.innerHTML = _templates.map(t => `
    <div class="editor-template-item" draggable="true" data-template-id="${t.id}">
      <div class="editor-template-icon"><i class="${t.icon || 'ri-layout-grid-line'}"></i></div>
      <div class="editor-template-info">
        <div class="editor-template-name">${escHtml(t.name)}</div>
        <div class="editor-template-desc">${escHtml(t.description || '')}</div>
      </div>
      <button class="editor-template-insert" data-template-id="${t.id}" title="插入">
        <i class="ri-add-line"></i>
      </button>
    </div>
  `).join('');

  // 拖拽开始
  el.querySelectorAll('.editor-template-item[draggable]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      const tid = item.dataset.templateId;
      _draggedTemplate = _templates.find(t => t.id === tid) || null;
      _draggedCardEl = null;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', tid);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      _draggedTemplate = null;
      removeDropIndicator();
    });
  });

  // 点击插入
  el.querySelectorAll('.editor-template-insert').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.templateId;
      const template = _templates.find(t => t.id === tid);
      if (!template) return;
      insertCardAtCursor(template);
    });
  });
}

/* =============================================
   编辑器事件绑定
   ============================================= */

function bindEditorEvents(container) {
  const canvas = container.querySelector('#editor-canvas');
  const toolbar = container.querySelector('.editor-toolbar');

  // 工具栏格式化
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    document.execCommand(cmd, false, null);
    canvas.focus();
  });

  // 工具栏插入卡片按钮
  toolbar.querySelector('#toolbar-insert-card')?.addEventListener('click', () => {
    // 打开模板选择 modal
    openTemplatePickerModal(canvas);
  });

  // 编辑区内拖拽
  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = _draggedCardEl ? 'move' : 'copy';
    showDropIndicatorAt(canvas, e.clientY);
  });

  canvas.addEventListener('dragleave', (e) => {
    // 只在真正离开编辑区时移除指示线
    if (!canvas.contains(e.relatedTarget)) {
      removeDropIndicator();
    }
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    removeDropIndicator();

    const insertBefore = getInsertPoint(canvas, e.clientY);

    if (_draggedCardEl) {
      // 移动已有卡片
      if (insertBefore !== _draggedCardEl) {
        canvas.insertBefore(_draggedCardEl, insertBefore);
      }
      _draggedCardEl = null;
    } else if (_draggedTemplate) {
      // 从模板插入新卡片
      insertCardAtPosition(canvas, _draggedTemplate, insertBefore);
      _draggedTemplate = null;
    }
  });

  // 卡片点击 → 编辑 modal
  canvas.addEventListener('click', (e) => {
    const cardEl = e.target.closest('.editor-card-embed');
    if (!cardEl) return;
    e.preventDefault();
    openCardEditModal(cardEl);
  });

  // 卡片拖拽（编辑区内移动）
  canvas.addEventListener('dragstart', (e) => {
    const cardEl = e.target.closest('.editor-card-embed');
    if (!cardEl) return;
    _draggedCardEl = cardEl;
    _draggedTemplate = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'card');
    cardEl.classList.add('dragging');
  });

  canvas.addEventListener('dragend', () => {
    if (_draggedCardEl) {
      _draggedCardEl.classList.remove('dragging');
      _draggedCardEl = null;
    }
    removeDropIndicator();
  });

  // Delete 键删除选中的卡片
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const node = sel.anchorNode;
      // 检查选区是否在卡片上
      const cardEl = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest?.('.editor-card-embed');
      if (cardEl && canvas.contains(cardEl)) {
        e.preventDefault();
        cardEl.remove();
      }
    }
  });

  // 提交
  container.querySelector('#editor-submit-btn')?.addEventListener('click', () => {
    handleSubmit(canvas);
  });

  // 返回
  container.querySelector('#editor-back-btn')?.addEventListener('click', () => {
    if (_editingPostId) {
      navigateTo('explore-post-detail', _editingPostId);
    } else {
      navigateTo('explore');
    }
  });

  // 粘贴时清除格式
  canvas.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
}

/* =============================================
   插入卡片
   ============================================= */

/**
 * 在光标位置插入卡片
 */
function insertCardAtCursor(template) {
  const canvas = document.getElementById('editor-canvas');
  if (!canvas) return;

  const sel = window.getSelection();
  let insertBefore = null;

  if (sel.rangeCount > 0 && canvas.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    // 如果光标在文本节点中间，先分割
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const after = range.startContainer.splitText(range.startOffset);
      insertBefore = after;
    } else {
      insertBefore = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer.childNodes[range.startOffset] || null
        : range.startContainer.nextSibling;
    }
  }

  insertCardAtPosition(canvas, template, insertBefore);
}

/**
 * 在指定位置插入卡片
 */
function insertCardAtPosition(canvas, template, insertBefore) {
  // 构建卡片数据
  const cardData = {
    title: template.name || '',
    template_id: template.id || null,
    components: (template.components_schema || []).map(comp => ({
      type: comp.type,
      icon: comp.icon || '',
      label: comp.label || '',
      value: comp.value || ''
    }))
  };

  const cardEl = createCardElement(cardData);

  // 插入
  if (insertBefore && canvas.contains(insertBefore)) {
    canvas.insertBefore(cardEl, insertBefore);
  } else {
    canvas.appendChild(cardEl);
  }

  // 插入后在卡片后面加一个空文本节点，方便继续打字
  const textNode = document.createTextNode('\n');
  canvas.insertBefore(textNode, cardEl.nextSibling);

  // 滚动到卡片位置
  cardEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * 创建卡片 DOM 元素
 */
function createCardElement(cardData) {
  const div = document.createElement('div');
  div.className = 'editor-card-embed';
  div.contentEditable = 'false';
  div.draggable = true;
  div.dataset.cardJson = JSON.stringify(cardData);
  if (cardData.template_id) div.dataset.template = cardData.template_id;
  renderCardDom(div, cardData);
  return div;
}

/**
 * 渲染卡片 DOM 内容
 */
function renderCardDom(cardEl, cardData) {
  const icon = getTemplateIcon(cardData.template_id);
  const componentsHtml = (cardData.components || []).map((comp, i) =>
    renderModule(comp, i, null, {})
  ).join('');

  cardEl.innerHTML = `
    <button class="editor-card-close" title="删除卡片"><i class="ri-close-line"></i></button>
    <div class="editor-card-inner">
      <div class="editor-card-head">
        <i class="${icon}"></i>
        <span>${escHtml(cardData.title || '卡片')}</span>
      </div>
      <div class="editor-card-body">${componentsHtml || '<span class="text-secondary" style="font-size:12px">空卡片</span>'}</div>
    </div>
  `;

  // × 删除按钮（阻止冒泡，不触发卡片编辑）
  cardEl.querySelector('.editor-card-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cardEl.remove();
  });
}

function getTemplateIcon(templateId) {
  const t = _templates.find(t => t.id === templateId);
  return t?.icon || 'ri-layout-grid-line';
}

/* =============================================
   卡片编辑 Modal
   ============================================= */

function openCardEditModal(cardEl) {
  const cardData = JSON.parse(cardEl.dataset.cardJson || '{}');
  const components = cardData.components || [];

  const fieldsHtml = components.map((comp, i) => {
    const inputId = `card-edit-field-${i}`;
    const val = escAttr(comp.value || '');
    return `
      <div class="card-edit-field">
        <label class="card-edit-label">
          <i class="${comp.icon || 'ri-text'}"></i> ${escHtml(comp.label || `字段${i + 1}`)}
        </label>
        <input class="card-edit-input" id="${inputId}" value="${val}" placeholder=" " data-field-index="${i}">
      </div>
    `;
  }).join('');

  openModal(escHtml(cardData.title || '编辑卡片'), `
    <div class="card-edit-form">${fieldsHtml || '<p class="text-secondary">此卡片没有可编辑的字段</p>'}</div>
    <div class="card-edit-actions">
      <button class="btn btn-secondary" id="card-edit-cancel">取消</button>
      <button class="btn btn-primary" id="card-edit-confirm">确定</button>
    </div>
  `);

  // 聚焦第一个输入框
  const firstInput = document.querySelector('.card-edit-input');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);

  // 确定
  document.getElementById('card-edit-confirm')?.addEventListener('click', () => {
    // 读取各字段值
    document.querySelectorAll('.card-edit-input').forEach(input => {
      const idx = parseInt(input.dataset.fieldIndex);
      if (components[idx] !== undefined) {
        components[idx].value = input.value;
      }
    });

    cardData.components = components;
    cardEl.dataset.cardJson = JSON.stringify(cardData);
    renderCardDom(cardEl, cardData);
    closeModal();
    showToast('卡片已更新');
  });

  // 取消
  document.getElementById('card-edit-cancel')?.addEventListener('click', () => {
    closeModal();
  });
}

/**
 * 打开模板选择 modal（工具栏插入卡片时）
 */
function openTemplatePickerModal(canvas) {
  const itemsHtml = _templates.map(t => `
    <div class="editor-modal-template" data-template-id="${t.id}">
      <i class="${t.icon || 'ri-layout-grid-line'}"></i>
      <span>${escHtml(t.name)}</span>
    </div>
  `).join('');

  openModal('选择卡片模板', `
    <div class="editor-modal-template-list">${itemsHtml || '<p class="text-secondary">暂无模板</p>'}</div>
  `);

  document.querySelectorAll('.editor-modal-template').forEach(el => {
    el.addEventListener('click', () => {
      const tid = el.dataset.templateId;
      const template = _templates.find(t => t.id === tid);
      if (!template) return;
      closeModal();
      insertCardAtCursor(template);
    });
  });
}

/* =============================================
   拖拽指示线
   ============================================= */

let _dropIndicator = null;

function showDropIndicatorAt(canvas, clientY) {
  if (!_dropIndicator) {
    _dropIndicator = document.createElement('div');
    _dropIndicator.className = 'editor-drop-indicator';
  }

  const insertBefore = getInsertPoint(canvas, clientY);
  if (insertBefore) {
    canvas.insertBefore(_dropIndicator, insertBefore);
  } else {
    canvas.appendChild(_dropIndicator);
  }
}

function removeDropIndicator() {
  if (_dropIndicator && _dropIndicator.parentNode) {
    _dropIndicator.parentNode.removeChild(_dropIndicator);
  }
}

/**
 * 根据鼠标 Y 坐标计算插入位置（应该插入到哪个节点之前）
 */
function getInsertPoint(canvas, clientY) {
  const children = Array.from(canvas.childNodes).filter(n => {
    // 只考虑元素节点和有意义的文本节点
    if (n.nodeType === Node.ELEMENT_NODE) return true;
    if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) return true;
    return false;
  });

  for (const child of children) {
    if (child === _dropIndicator) continue;
    const rect = (child.nodeType === Node.ELEMENT_NODE ? child : child.parentElement)?.getBoundingClientRect?.();
    if (!rect) continue;
    if (clientY < rect.top + rect.height / 2) {
      return child;
    }
  }
  return null; // 插入到末尾
}

/* =============================================
   序列化编辑器内容
   ============================================= */

function serializeEditor(editorEl) {
  const blocks = [];
  let pendingText = '';

  function flushText() {
    const trimmed = pendingText.trim();
    if (trimmed) {
      blocks.push({ type: 'text', data: trimmed });
    }
    pendingText = '';
  }

  for (const node of editorEl.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      pendingText += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('editor-card-embed')) {
        flushText();
        const json = node.dataset.cardJson;
        if (json) {
          try {
            blocks.push({ type: 'card', card: JSON.parse(json) });
          } catch (e) { /* skip invalid card */ }
        }
      } else if (node.classList.contains('editor-drop-indicator')) {
        // 忽略拖拽指示线
      } else if (node.tagName === 'DIV') {
        // contentEditable 生成的段落 div
        pendingText += node.textContent + '\n';
      } else if (node.tagName === 'BR') {
        pendingText += '\n';
      } else {
        // 其他元素（b, i, u, span 等）
        pendingText += node.textContent;
      }
    }
  }

  flushText();
  return blocks;
}

/* =============================================
   提交
   ============================================= */

async function handleSubmit(canvas) {
  const titleInput = document.getElementById('post-title');
  const title = titleInput?.value?.trim() || '';
  if (!title) { showToast('请输入帖子标题'); return; }

  const blocks = serializeEditor(canvas);

  if (blocks.length === 0) { showToast('请输入内容'); return; }

  const btn = document.getElementById('editor-submit-btn');
  const isEdit = !!_editingPostId;
  btn.disabled = true;
  btn.textContent = isEdit ? '保存中...' : '发布中...';

  try {
    let res;

    if (isEdit) {
      // 编辑模式 → PUT 请求
      const token = getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const fetchRes = await fetch(`/api/explore/posts/${_editingPostId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ title, content: JSON.stringify(blocks) })
      });
      res = await fetchRes.json();
    } else {
      // 创建模式 → POST 请求
      res = await apiPost('/api/explore/posts', {
        title,
        content: JSON.stringify(blocks)
      });
    }

    if (res.error) { showToast(res.error); return; }
    showToast(isEdit ? '已保存' : '发布成功');

    if (isEdit) {
      navigateTo('explore-post-detail', _editingPostId);
    } else {
      navigateTo('explore');
    }
  } catch (e) {
    showToast(isEdit ? '保存失败' : '发布失败');
  } finally {
    btn.disabled = false;
    btn.textContent = isEdit ? '保存' : '发布';
  }
}

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

/* =============================================
   页面注册
   ============================================= */

registerPage('explore-post-editor', (container, postId) => renderPostEditor(container, postId));
