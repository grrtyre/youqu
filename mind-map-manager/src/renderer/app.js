'use strict';

// ===== 思维导图管家 - 渲染层应用逻辑 =====
(function () {
  const C = window.MMCore;

  // ===== 状态 =====
  let state = {
    doc: null,            // 当前文档
    selectedId: null,     // 选中节点 id
    editingId: null,      // 编辑中节点 id
    zoom: 1,
    panX: 0,
    panY: 0,
    undoStack: [],
    redoStack: [],
    dirty: false,
    docList: [],
    searchKeyword: ''
  };

  // ===== DOM 引用 =====
  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const canvasGroup = $('canvasGroup');
  const nodesLayer = $('nodesLayer');
  const linksLayer = $('linksLayer');
  const canvasWrap = $('canvasWrap');
  const emptyState = $('emptyState');
  const nodeEditor = $('nodeEditor');
  const colorPanel = $('colorPanel');
  const toastEl = $('toast');

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // ===== Toast =====
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 1800);
  }

  // ===== 撤销/重做 =====
  function pushUndo() {
    if (!state.doc) return;
    state.undoStack.push(C.cloneDoc(state.doc));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoBtns();
  }
  function undo() {
    if (!state.doc || state.undoStack.length === 0) return;
    state.redoStack.push(C.cloneDoc(state.doc));
    state.doc = state.undoStack.pop();
    state.dirty = true;
    state.selectedId = state.doc.root.id;
    render();
    updateUndoRedoBtns();
    scheduleAutoSave();
  }
  function redo() {
    if (!state.doc || state.redoStack.length === 0) return;
    state.undoStack.push(C.cloneDoc(state.doc));
    state.doc = state.redoStack.pop();
    state.dirty = true;
    state.selectedId = state.doc.root.id;
    render();
    updateUndoRedoBtns();
    scheduleAutoSave();
  }
  function updateUndoRedoBtns() {
    $('btnUndo').disabled = state.undoStack.length === 0;
    $('btnRedo').disabled = state.redoStack.length === 0;
  }

  // ===== 文档列表 =====
  async function refreshDocList() {
    const list = await window.mm.listDocs();
    state.docList = list || [];
    renderDocList();
  }

  function renderDocList() {
    const container = $('docList');
    container.innerHTML = '';
    const kw = state.searchKeyword.trim().toLowerCase();
    const filtered = kw ? state.docList.filter(d => (d.title || '').toLowerCase().includes(kw)) : state.docList;
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:20px 10px;text-align:center;color:var(--text-tertiary);font-size:12px;';
      empty.textContent = kw ? '没有匹配的文档' : '暂无文档，点击 + 新建';
      container.appendChild(empty);
      return;
    }
    for (const d of filtered) {
      const item = document.createElement('div');
      item.className = 'doc-item' + (state.doc && state.doc.id === d.id ? ' active' : '');
      const row = document.createElement('div');
      row.className = 'doc-item-row';
      const title = document.createElement('div');
      title.style.flex = '1';
      title.style.minWidth = '0';
      const titleEl = document.createElement('div');
      titleEl.className = 'doc-item-title';
      titleEl.textContent = d.title || '未命名';
      const metaEl = document.createElement('div');
      metaEl.className = 'doc-item-meta';
      metaEl.textContent = (d.nodeCount || 0) + ' 节点 · ' + formatDate(d.updatedAt);
      title.appendChild(titleEl);
      title.appendChild(metaEl);
      row.appendChild(title);
      const del = document.createElement('button');
      del.className = 'doc-item-del';
      del.innerHTML = '&times;';
      del.title = '删除';
      del.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteDoc(d); });
      row.appendChild(del);
      item.appendChild(row);
      item.addEventListener('click', () => loadDocById(d.id));
      container.appendChild(item);
    }
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  async function loadDocById(id) {
    const res = await window.mm.loadDoc(id);
    if (!res.ok) { toast('加载失败：' + (res.error || '')); return; }
    state.doc = res.doc;
    state.selectedId = state.doc.root.id;
    state.undoStack = [];
    state.redoStack = [];
    state.dirty = false;
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    cancelEdit();
    render();
    renderDocList();
    updateMeta();
    // 延迟 fitView 确保 DOM 已完全渲染（多重保障：rAF + setTimeout）
    requestAnimationFrame(() => { requestAnimationFrame(() => fitView()); });
    setTimeout(() => fitView(), 500);
    setTimeout(() => fitView(), 1200);
  }

  async function createNewDoc() {
    const doc = C.createDoc('新建思维导图 ' + new Date().toLocaleDateString('zh-CN'));
    const res = await window.mm.saveDoc(doc);
    if (!res.ok) { toast('创建失败'); return; }
    toast('已新建文档');
    await refreshDocList();
    await loadDocById(doc.id);
    // 自动进入根节点编辑
    setTimeout(() => startEdit(doc.root.id), 100);
  }

  function confirmDeleteDoc(d) {
    if (!confirm('确定删除文档「' + (d.title || '未命名') + '」吗？此操作不可撤销。')) return;
    window.mm.deleteDoc(d.id).then(() => {
      if (state.doc && state.doc.id === d.id) {
        state.doc = null;
        state.selectedId = null;
        render();
      }
      refreshDocList();
      toast('已删除');
    });
  }

  // ===== 保存 =====
  let saveTimer = null;
  function scheduleAutoSave() {
    state.dirty = true;
    updateMeta();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 1500);
  }
  async function doSave() {
    if (!state.doc) return;
    const res = await window.mm.saveDoc(state.doc);
    if (res.ok) {
      state.dirty = false;
      updateMeta();
      // 更新列表中的节点数
      const item = state.docList.find(d => d.id === state.doc.id);
      if (item) {
        item.updatedAt = Date.now();
        item.nodeCount = res.nodeCount;
        renderDocList();
      }
    }
  }

  // ===== 渲染 =====
  function render() {
    if (!state.doc) {
      emptyState.style.display = 'flex';
      canvas.style.display = 'none';
      $('statusNodes').textContent = '0';
      $('statusDepth').textContent = '0';
      $('statusSaved').textContent = '未保存';
      $('statusSaved').classList.remove('saved');
      return;
    }
    emptyState.style.display = 'none';
    canvas.style.display = 'block';

    const layout = C.layoutTree(state.doc.root, {});
    const posMap = new Map();
    for (const n of layout.nodes) posMap.set(n.id, n);

    // 清空
    nodesLayer.innerHTML = '';
    linksLayer.innerHTML = '';

    // 绘制连线（平滑贝塞尔曲线，统一蓝色系，层级越深越浅）
    function drawLinks(node, depth, inheritedColor) {
      if (node.collapsed || !node.children) return;
      const p = posMap.get(node.id);
      if (!p) return;
      for (const child of node.children) {
        const cp = posMap.get(child.id);
        if (!cp) continue;
        const x1 = p.x + p.w;
        const y1 = p.y + p.h / 2;
        const x2 = cp.x;
        const y2 = cp.y + cp.h / 2;
        const dx = x2 - x1;
        const offset = Math.max(20, dx * 0.55);
        const path = document.createElementNS(SVG_NS, 'path');
        let linkClass = 'node-link';
        if (depth === 0) linkClass += ' link-main';
        else if (depth === 1) linkClass += ' link-branch';
        else linkClass += ' link-leaf';
        path.setAttribute('class', linkClass);
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + offset) + ' ' + y1 + ', ' + (x2 - offset) + ' ' + y2 + ', ' + x2 + ' ' + y2);
        linksLayer.appendChild(path);
        drawLinks(child, depth + 1, inheritedColor);
      }
    }
    drawLinks(state.doc.root, 0, null);

    // 绘制节点（区分视觉层级：根/分支/叶子，叶子继承父级色彩）
    function drawNode(node, depth, inheritedColor) {
      const p = posMap.get(node.id);
      if (!p) return;
      const g = document.createElementNS(SVG_NS, 'g');
      let cls = 'node-group';
      if (node.id === state.selectedId) cls += ' selected';
      if (depth === 0) cls += ' root';
      else if (depth === 1) cls += ' branch';
      else cls += ' leaf';
      g.setAttribute('class', cls);
      g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      g.dataset.id = node.id;

      // 当前节点传递给子代的颜色（分支用自身颜色，叶子继承父级）
      const passColor = depth === 1 ? (node.color || inheritedColor) : inheritedColor;

      // 节点背景
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'node-rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', p.w);
      rect.setAttribute('height', p.h);
      rect.setAttribute('rx', 10);
      rect.setAttribute('ry', 10);
      // 分支节点用自定义颜色作为边框
      if (depth === 1 && node.color) {
        rect.setAttribute('stroke', node.color);
        rect.setAttribute('stroke-width', '1.6');
      }
      g.appendChild(rect);

      // 分支节点左侧色条（视觉标识）
      if (depth === 1 && node.color) {
        const bar = document.createElementNS(SVG_NS, 'rect');
        bar.setAttribute('x', 0);
        bar.setAttribute('y', 0);
        bar.setAttribute('width', 4);
        bar.setAttribute('height', p.h);
        bar.setAttribute('rx', 2);
        bar.setAttribute('ry', 2);
        bar.setAttribute('fill', node.color);
        bar.setAttribute('class', 'node-bar');
        g.appendChild(bar);
      }

      // 叶子节点左侧细色条（继承父级颜色，统一视觉语言）
      if (depth >= 2 && inheritedColor) {
        const bar = document.createElementNS(SVG_NS, 'rect');
        bar.setAttribute('x', 0);
        bar.setAttribute('y', 0);
        bar.setAttribute('width', 4);
        bar.setAttribute('height', p.h);
        bar.setAttribute('rx', 2);
        bar.setAttribute('ry', 2);
        bar.setAttribute('fill', inheritedColor);
        bar.setAttribute('opacity', '0.7');
        bar.setAttribute('class', 'node-bar');
        g.appendChild(bar);
      }

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'node-text');
      // 叶子节点有左侧色条，文字水平中心向右偏移 1.5px 保持视觉平衡
      const textX = depth >= 2 ? (p.w / 2 + 1.5) : (p.w / 2);
      text.setAttribute('x', textX);
      text.setAttribute('y', p.h / 2);
      // 多行文本处理
      const lines = String(node.text || '').split('\n');
      if (lines.length === 1) {
        text.textContent = truncate(lines[0], p.w);
      } else {
        const firstLine = truncate(lines[0], p.w);
        text.textContent = firstLine + (lines.length > 1 ? ' …' : '');
      }
      g.appendChild(text);

      // 折叠按钮（有子节点时显示，半悬浮在节点右侧）
      if (node.children && node.children.length > 0) {
        const btnR = 6.5;
        const btnX = p.w + 4;
        const btnY = p.h / 2;
        const btn = document.createElementNS(SVG_NS, 'circle');
        btn.setAttribute('class', 'node-collapse-btn');
        btn.setAttribute('cx', btnX);
        btn.setAttribute('cy', btnY);
        btn.setAttribute('r', btnR);
        btn.dataset.id = node.id;
        g.appendChild(btn);
        const btnText = document.createElementNS(SVG_NS, 'text');
        btnText.setAttribute('class', 'node-collapse-text');
        btnText.setAttribute('x', btnX);
        btnText.setAttribute('y', btnY + 0.5);
        btnText.textContent = node.collapsed ? '+' : '−';
        g.appendChild(btnText);
      }

      nodesLayer.appendChild(g);
      if (!node.collapsed && node.children) {
        for (const child of node.children) drawNode(child, depth + 1, passColor);
      }
    }
    drawNode(state.doc.root, 0, null);

    // 应用缩放/平移
    applyTransform();

    // 更新状态栏
    $('statusNodes').textContent = C.countNodes(state.doc.root);
    $('statusDepth').textContent = C.maxDepth(state.doc.root);
    $('btnToggleCollapse').disabled = !state.selectedId;
    $('btnAddChild').disabled = !state.selectedId;
    $('btnAddSibling').disabled = !state.selectedId;
    $('btnRemoveNode').disabled = !state.selectedId || state.selectedId === state.doc.root.id;
    $('btnColor').disabled = !state.selectedId;
  }

  function truncate(s, maxW) {
    if (!s) return '';
    const charW = 14 * 0.6;
    const maxChars = Math.floor((maxW - 36) / charW);
    if (s.length > maxChars) return s.slice(0, Math.max(1, maxChars - 1)) + '…';
    return s;
  }

  // 将 hex 颜色转为 rgba 字符串
  function hexToRgba(hex, alpha) {
    if (!hex) return null;
    const m = hex.replace('#', '');
    if (m.length !== 6) return null;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function isLightColor(hex) {
    if (!hex) return false;
    const m = hex.replace('#', '');
    if (m.length !== 6) return false;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    // 亮度公式
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.55; // 深色背景用白字
  }

  function applyTransform() {
    canvasGroup.setAttribute('transform', 'translate(' + state.panX + ',' + state.panY + ') scale(' + state.zoom + ')');
    const zText = Math.round(state.zoom * 100) + '%';
    $('zoomLabel').textContent = zText;
    const sz = $('statusZoom'); if (sz) sz.textContent = zText;
  }

  function updateMeta() {
    if (!state.doc) { $('metaInfo').textContent = ''; return; }
    const count = C.countNodes(state.doc.root);
    const depth = C.maxDepth(state.doc.root);
    $('metaInfo').textContent = count + ' 节点 · 深度 ' + depth + (state.dirty ? ' · 未保存' : ' · 已保存');
    $('statusSaved').textContent = state.dirty ? '未保存' : '已保存';
    if (state.dirty) { $('statusSaved').classList.remove('saved'); }
    else { $('statusSaved').classList.add('saved'); }
  }

  // ===== 节点操作 =====
  function selectNode(id) {
    state.selectedId = id;
    cancelEdit();
    render();
  }

  function addChildAction() {
    if (!state.doc || !state.selectedId) return;
    pushUndo();
    const node = C.addChild(state.doc, state.selectedId, '新节点');
    if (node) {
      state.selectedId = node.id;
      render();
      scheduleAutoSave();
      setTimeout(() => startEdit(node.id), 50);
    }
  }

  function addSiblingAction() {
    if (!state.doc || !state.selectedId) return;
    if (state.selectedId === state.doc.root.id) { toast('根节点不能添加兄弟'); return; }
    pushUndo();
    const node = C.addSibling(state.doc, state.selectedId, '新节点');
    if (node) {
      state.selectedId = node.id;
      render();
      scheduleAutoSave();
      setTimeout(() => startEdit(node.id), 50);
    }
  }

  function removeNodeAction() {
    if (!state.doc || !state.selectedId) return;
    if (state.selectedId === state.doc.root.id) { toast('根节点不能删除'); return; }
    pushUndo();
    // 找到下一个选中（兄弟或父）
    const parent = C.findParent(state.doc.root, state.selectedId);
    const siblings = parent ? parent.children : [];
    const idx = siblings.findIndex(c => c.id === state.selectedId);
    C.removeNode(state.doc, state.selectedId);
    if (idx > 0 && siblings[idx - 1]) state.selectedId = siblings[idx - 1].id;
    else if (parent) state.selectedId = parent.id;
    else state.selectedId = state.doc.root.id;
    render();
    scheduleAutoSave();
    toast('已删除');
  }

  function toggleCollapseAction() {
    if (!state.doc || !state.selectedId) return;
    pushUndo();
    C.toggleCollapse(state.doc, state.selectedId);
    render();
    scheduleAutoSave();
  }

  function setNodeColorAction(color) {
    if (!state.doc || !state.selectedId) return;
    pushUndo();
    C.setNodeColor(state.doc, state.selectedId, color);
    render();
    scheduleAutoSave();
  }

  // ===== 编辑节点文本 =====
  function startEdit(id) {
    if (!state.doc) return;
    const node = C.findNode(state.doc.root, id);
    if (!node) return;
    state.editingId = id;
    state.selectedId = id;
    // 定位编辑框
    const layout = C.layoutTree(state.doc.root, {});
    const pos = layout.nodes.find(n => n.id === id);
    if (!pos) return;
    const rect = canvasWrap.getBoundingClientRect();
    const screenX = pos.x * state.zoom + state.panX;
    const screenY = pos.y * state.zoom + state.panY;
    const w = pos.w * state.zoom;
    const h = pos.h * state.zoom;
    nodeEditor.style.display = 'block';
    nodeEditor.style.left = (rect.left + screenX) + 'px';
    nodeEditor.style.top = (rect.top + screenY) + 'px';
    nodeEditor.style.width = Math.max(80, w) + 'px';
    nodeEditor.style.height = Math.max(28, h) + 'px';
    nodeEditor.value = node.text;
    nodeEditor.focus();
    nodeEditor.select();
    render();
  }

  function commitEdit() {
    if (!state.editingId || !state.doc) { cancelEdit(); return; }
    const newText = nodeEditor.value;
    const node = C.findNode(state.doc.root, state.editingId);
    if (node && node.text !== newText) {
      pushUndo();
      C.updateNodeText(state.doc, state.editingId, newText);
      scheduleAutoSave();
    }
    state.editingId = null;
    nodeEditor.style.display = 'none';
    render();
  }

  function cancelEdit() {
    state.editingId = null;
    nodeEditor.style.display = 'none';
  }

  // ===== 缩放与平移 =====
  function setZoom(z, cx, cy) {
    const old = state.zoom;
    state.zoom = Math.max(0.3, Math.min(3, z));
    if (cx != null && cy != null) {
      // 以鼠标位置为中心缩放
      const rect = canvasWrap.getBoundingClientRect();
      const mx = cx - rect.left;
      const my = cy - rect.top;
      state.panX = mx - (mx - state.panX) * (state.zoom / old);
      state.panY = my - (my - state.panY) * (state.zoom / old);
    }
    applyTransform();
    $('zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
  }

  function fitView() {
    if (!state.doc) return;
    const layout = C.layoutTree(state.doc.root, {});
    const b = layout.bounds;
    if (!b || b.width <= 0 || b.height <= 0) return;
    const rect = canvasWrap.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const padding = 40;
    const scaleX = (rect.width - padding * 2) / b.width;
    const scaleY = (rect.height - padding * 2) / b.height;
    const z = Math.min(scaleX, scaleY, 1.4);
    state.zoom = Math.max(0.3, z);
    // 右展开树：垂直居中，根节点放在左侧 25% 位置
    const rootPos = layout.nodes[0];
    const treeCenterY = b.y + b.height / 2;
    const targetRootX = rect.width * 0.12;
    const targetCenterY = rect.height / 2;
    state.panX = targetRootX - rootPos.x * state.zoom;
    state.panY = targetCenterY - treeCenterY * state.zoom;
    // 确保根节点不被裁切
    const rootScreenX = state.panX + rootPos.x * state.zoom;
    if (rootScreenX < 20) {
      state.panX = 20 - rootPos.x * state.zoom;
    }
    applyTransform();
  }

  // ===== 导出 =====
  async function exportDoc() {
    if (!state.doc) { toast('请先打开文档'); return; }
    const choice = prompt('导出格式：输入 png（图片）/ json（数据）/ md（Markdown）/ txt（大纲）', 'png');
    if (!choice) return;
    const fmt = choice.trim().toLowerCase();
    if (fmt === 'json') {
      const content = C.serialize(state.doc);
      const res = await window.mm.exportDoc({ content, suggestedName: (state.doc.title || '思维导图') + '.json', filterType: 'json' });
      if (!res.canceled) toast(res.error ? '导出失败' : '已导出');
    } else if (fmt === 'md') {
      const content = C.toMarkdown(state.doc);
      const res = await window.mm.exportDoc({ content, suggestedName: (state.doc.title || '思维导图') + '.md', filterType: 'md' });
      if (!res.canceled) toast(res.error ? '导出失败' : '已导出');
    } else if (fmt === 'txt') {
      const content = C.toOutline(state.doc);
      const res = await window.mm.exportDoc({ content, suggestedName: (state.doc.title || '思维导图') + '.txt', filterType: 'txt' });
      if (!res.canceled) toast(res.error ? '导出失败' : '已导出');
    } else if (fmt === 'png') {
      exportPNG();
    } else {
      toast('不支持的格式');
    }
  }

  function exportPNG() {
    if (!state.doc) return;
    const layout = C.layoutTree(state.doc.root, {});
    const b = layout.bounds;
    const padding = 40;
    const w = Math.ceil(b.width + padding * 2);
    const h = Math.ceil(b.height + padding * 2);
    // 创建临时 SVG
    const tmpSvg = document.createElementNS(SVG_NS, 'svg');
    tmpSvg.setAttribute('xmlns', SVG_NS);
    tmpSvg.setAttribute('width', w);
    tmpSvg.setAttribute('height', h);
    tmpSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    // 白底
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', 0); bg.setAttribute('y', 0);
    bg.setAttribute('width', w); bg.setAttribute('height', h);
    bg.setAttribute('fill', '#ffffff');
    tmpSvg.appendChild(bg);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', 'translate(' + (-b.x + padding) + ',' + (-b.y + padding) + ')');
    tmpSvg.appendChild(g);
    // 复制连线
    const linksG = document.createElementNS(SVG_NS, 'g');
    function drawLinks(node) {
      if (node.collapsed || !node.children) return;
      const p = layout.nodes.find(n => n.id === node.id);
      if (!p) return;
      for (const child of node.children) {
        const cp = layout.nodes.find(n => n.id === child.id);
        if (!cp) continue;
        const x1 = p.x + p.w, y1 = p.y + p.h / 2;
        const x2 = cp.x, y2 = cp.y + cp.h / 2;
        const mx = (x1 + x2) / 2;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#d1d1d6');
        path.setAttribute('stroke-width', '1.5');
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + x2 + ' ' + y2);
        linksG.appendChild(path);
        drawLinks(child);
      }
    }
    drawLinks(state.doc.root);
    g.appendChild(linksG);
    // 复制节点
    const nodesG = document.createElementNS(SVG_NS, 'g');
    function drawNode(node, depth) {
      const p = layout.nodes.find(n => n.id === node.id);
      if (!p) return;
      const ng = document.createElementNS(SVG_NS, 'g');
      ng.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', 0); rect.setAttribute('y', 0);
      rect.setAttribute('width', p.w); rect.setAttribute('height', p.h);
      rect.setAttribute('rx', 8); rect.setAttribute('ry', 8);
      if (depth === 0) {
        rect.setAttribute('fill', '#007aff'); rect.setAttribute('stroke', '#007aff');
      } else if (node.color) {
        rect.setAttribute('fill', node.color); rect.setAttribute('stroke', node.color);
      } else {
        rect.setAttribute('fill', '#ffffff'); rect.setAttribute('stroke', '#e5e5ea');
      }
      rect.setAttribute('stroke-width', '1.2');
      ng.appendChild(rect);
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', p.w / 2);
      text.setAttribute('y', p.h / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-family', '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif');
      text.setAttribute('font-size', '14');
      if (depth === 0 || (node.color && isLightColor(node.color))) {
        text.setAttribute('fill', '#ffffff');
        if (depth === 0) text.setAttribute('font-weight', '600');
      } else {
        text.setAttribute('fill', '#1d1d1f');
      }
      text.textContent = node.text || '';
      ng.appendChild(text);
      nodesG.appendChild(ng);
      if (!node.collapsed && node.children) for (const c of node.children) drawNode(c, depth + 1);
    }
    drawNode(state.doc.root, 0);
    g.appendChild(nodesG);
    // 序列化
    const svgStr = new XMLSerializer().serializeToString(tmpSvg);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = async function () {
      const scale = 2; // 2倍清晰度
      const cv = document.createElement('canvas');
      cv.width = w * scale; cv.height = h * scale;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      const dataUrl = cv.toDataURL('image/png');
      const res = await window.mm.exportDoc({ content: dataUrl, suggestedName: (state.doc.title || '思维导图') + '.png', filterType: 'png' });
      if (!res.canceled) toast(res.error ? '导出失败' : '已导出 PNG');
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('导出失败：图片渲染错误'); };
    img.src = url;
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 标题栏按钮
    $('btnClose').addEventListener('click', () => window.mm.winClose());
    $('btnMin').addEventListener('click', () => window.mm.winMinimize());
    $('btnMax').addEventListener('click', () => window.mm.winToggleMaximize());

    // 文档操作
    $('btnNewDoc').addEventListener('click', createNewDoc);
    $('btnNewDocEmpty').addEventListener('click', createNewDoc);
    $('btnImport').addEventListener('click', async () => {
      const res = await window.mm.importDoc();
      if (res.canceled) return;
      if (res.error) { toast('导入失败：' + res.error); return; }
      if (res.doc) {
        // 重新生成 id 避免冲突
        res.doc.id = C.generateId();
        await window.mm.saveDoc(res.doc);
        await refreshDocList();
        await loadDocById(res.doc.id);
        toast('已导入');
      }
    });

    // 搜索
    $('searchInput').addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      renderDocList();
    });

    // 工具栏
    $('btnSave').addEventListener('click', () => { doSave(); toast('已保存'); });
    $('btnExport').addEventListener('click', exportDoc);
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnAddChild').addEventListener('click', addChildAction);
    $('btnAddSibling').addEventListener('click', addSiblingAction);
    $('btnRemoveNode').addEventListener('click', removeNodeAction);
    $('btnToggleCollapse').addEventListener('click', toggleCollapseAction);
    $('btnColor').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.selectedId) return;
      const rect = $('btnColor').getBoundingClientRect();
      colorPanel.style.left = rect.left + 'px';
      colorPanel.style.top = (rect.bottom + 6) + 'px';
      colorPanel.style.display = 'block';
    });
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = sw.dataset.color;
        setNodeColorAction(color);
        colorPanel.style.display = 'none';
      });
    });
    document.addEventListener('click', (e) => {
      if (!colorPanel.contains(e.target) && e.target !== $('btnColor')) {
        colorPanel.style.display = 'none';
      }
    });

    // 缩放
    $('btnZoomIn').addEventListener('click', () => setZoom(state.zoom * 1.2));
    $('btnZoomOut').addEventListener('click', () => setZoom(state.zoom / 1.2));
    $('btnFit').addEventListener('click', fitView);

    // 画布平移（鼠标拖拽背景）
    let panning = false, panStart = { x: 0, y: 0, panX: 0, panY: 0 };
    canvasWrap.addEventListener('mousedown', (e) => {
      // 点击节点或编辑框时不平移
      if (e.target.closest('.node-group') || e.target === nodeEditor) return;
      if (e.target.classList.contains('node-collapse-btn')) return;
      panning = true;
      panStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
      canvasWrap.classList.add('panning');
      cancelEdit();
      // 点击空白取消选中
      if (state.doc) {
        state.selectedId = null;
        render();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      state.panX = panStart.panX + (e.clientX - panStart.x);
      state.panY = panStart.panY + (e.clientY - panStart.y);
      applyTransform();
    });
    window.addEventListener('mouseup', () => {
      if (panning) { panning = false; canvasWrap.classList.remove('panning'); }
    });

    // 滚轮缩放
    canvasWrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(state.zoom * delta, e.clientX, e.clientY);
    }, { passive: false });

    // 节点点击（事件委托）
    nodesLayer.addEventListener('click', (e) => {
      const g = e.target.closest('.node-group');
      if (!g) return;
      const id = g.dataset.id;
      // 折叠按钮
      if (e.target.classList.contains('node-collapse-btn')) {
        pushUndo();
        C.toggleCollapse(state.doc, id);
        render();
        scheduleAutoSave();
        return;
      }
      selectNode(id);
    });
    nodesLayer.addEventListener('dblclick', (e) => {
      const g = e.target.closest('.node-group');
      if (!g) return;
      startEdit(g.dataset.id);
    });

    // 编辑框
    nodeEditor.addEventListener('blur', commitEdit);
    nodeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); render(); }
      e.stopPropagation();
    });

    // 全局快捷键
    document.addEventListener('keydown', (e) => {
      // 编辑中不触发全局快捷键
      if (state.editingId) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === 's') { e.preventDefault(); doSave(); toast('已保存'); return; }
      if (!state.doc || !state.selectedId) return;
      if (e.key === 'Tab') { e.preventDefault(); addChildAction(); }
      else if (e.key === 'Enter') { e.preventDefault(); addSiblingAction(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeNodeAction(); }
      else if (e.key === ' ') { e.preventDefault(); toggleCollapseAction(); }
      else if (e.key === 'F2') { e.preventDefault(); startEdit(state.selectedId); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (C.shiftUp(state.doc, state.selectedId)) { pushUndo(); render(); scheduleAutoSave(); } }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (C.shiftDown(state.doc, state.selectedId)) { pushUndo(); render(); scheduleAutoSave(); } }
    });

    // 关于弹窗
    window.mm.onShowAbout(() => { $('aboutModal').style.display = 'flex'; });
    $('aboutClose').addEventListener('click', () => { $('aboutModal').style.display = 'none'; });
    $('aboutAfdian').addEventListener('click', (e) => { e.preventDefault(); window.mm.openExternal('https://www.ifdian.net/a/giquwei'); });

    // 窗口最大化状态
    window.mm.onMaximizeChange((v) => { /* 可扩展视觉反馈 */ });
  }

  // ===== 初始化 =====
  async function init() {
    bindEvents();
    await refreshDocList();
    // 显示空状态
    if (state.docList.length === 0) {
      render();
    } else {
      // 自动加载第一个文档
      await loadDocById(state.docList[0].id);
    }
    // 应用信息
    const info = await window.mm.appInfo();
    $('aboutVersion').textContent = '版本 ' + (info.version || '1.0.0');
  }

  init();
})();
