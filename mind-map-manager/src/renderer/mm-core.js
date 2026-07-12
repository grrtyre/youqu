'use strict';

// 思维导图核心逻辑 - 浏览器版（挂到 window.MMCore）
// 与 src/core/mindmap-core.js 保持逻辑一致

(function () {
  let _idCounter = 0;
  function generateId() {
    _idCounter += 1;
    return 'n' + Date.now().toString(36) + '_' + _idCounter.toString(36);
  }
  function resetIdCounter() { _idCounter = 0; }

  function createNode(text, opts) {
    text = text == null ? '' : text;
    opts = opts || {};
    return {
      id: generateId(),
      text: text,
      children: [],
      collapsed: false,
      color: opts.color || null,
      note: opts.note || ''
    };
  }

  function createDoc(title) {
    const now = Date.now();
    return {
      id: generateId(),
      title: title || '新建思维导图',
      root: createNode('中心主题'),
      createdAt: now,
      updatedAt: now
    };
  }

  function findNode(root, id) {
    if (!root) return null;
    if (root.id === id) return root;
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  function findParent(root, id) {
    if (!root || root.id === id) return null;
    for (const child of root.children) {
      if (child.id === id) return root;
      const found = findParent(child, id);
      if (found) return found;
    }
    return null;
  }

  function getPath(root, id) {
    if (!root) return [];
    if (root.id === id) return [root];
    for (const child of root.children) {
      const subPath = getPath(child, id);
      if (subPath.length > 0) return [root, ...subPath];
    }
    return [];
  }

  function getDepth(root, id) {
    const path = getPath(root, id);
    return path.length - 1;
  }

  function addChild(doc, parentId, text) {
    const parent = findNode(doc.root, parentId);
    if (!parent) return null;
    const node = createNode(text == null ? '新节点' : text);
    parent.children.push(node);
    doc.updatedAt = Date.now();
    return node;
  }

  function addSibling(doc, nodeId, text) {
    const parent = findParent(doc.root, nodeId);
    if (!parent) return null;
    const node = createNode(text == null ? '新节点' : text);
    const idx = parent.children.findIndex(c => c.id === nodeId);
    if (idx < 0) return null;
    parent.children.splice(idx + 1, 0, node);
    doc.updatedAt = Date.now();
    return node;
  }

  function removeNode(doc, nodeId) {
    const parent = findParent(doc.root, nodeId);
    if (!parent) return false;
    const idx = parent.children.findIndex(c => c.id === nodeId);
    if (idx < 0) return false;
    parent.children.splice(idx, 1);
    doc.updatedAt = Date.now();
    return true;
  }

  function updateNodeText(doc, nodeId, text) {
    const node = findNode(doc.root, nodeId);
    if (!node) return false;
    node.text = String(text == null ? '' : text);
    doc.updatedAt = Date.now();
    return true;
  }

  function updateNodeNote(doc, nodeId, note) {
    const node = findNode(doc.root, nodeId);
    if (!node) return false;
    node.note = String(note == null ? '' : note);
    doc.updatedAt = Date.now();
    return true;
  }

  function setNodeColor(doc, nodeId, color) {
    const node = findNode(doc.root, nodeId);
    if (!node) return false;
    node.color = color || null;
    doc.updatedAt = Date.now();
    return true;
  }

  function toggleCollapse(doc, nodeId) {
    const node = findNode(doc.root, nodeId);
    if (!node) return false;
    node.collapsed = !node.collapsed;
    doc.updatedAt = Date.now();
    return node.collapsed;
  }

  function moveNode(doc, nodeId, newParentId, index) {
    if (nodeId === newParentId) return false;
    const node = findNode(doc.root, nodeId);
    if (!node) return false;
    if (findNode(node, newParentId)) return false;
    const oldParent = findParent(doc.root, nodeId);
    if (!oldParent) return false;
    const newParent = findNode(doc.root, newParentId);
    if (!newParent) return false;
    const oldIdx = oldParent.children.findIndex(c => c.id === nodeId);
    if (oldIdx < 0) return false;
    oldParent.children.splice(oldIdx, 1);
    if (index == null || index < 0 || index > newParent.children.length) index = newParent.children.length;
    newParent.children.splice(index, 0, node);
    doc.updatedAt = Date.now();
    return true;
  }

  function shiftUp(doc, nodeId) {
    const parent = findParent(doc.root, nodeId);
    if (!parent) return false;
    const idx = parent.children.findIndex(c => c.id === nodeId);
    if (idx <= 0) return false;
    const tmp = parent.children[idx - 1];
    parent.children[idx - 1] = parent.children[idx];
    parent.children[idx] = tmp;
    doc.updatedAt = Date.now();
    return true;
  }

  function shiftDown(doc, nodeId) {
    const parent = findParent(doc.root, nodeId);
    if (!parent) return false;
    const idx = parent.children.findIndex(c => c.id === nodeId);
    if (idx < 0 || idx >= parent.children.length - 1) return false;
    const tmp = parent.children[idx + 1];
    parent.children[idx + 1] = parent.children[idx];
    parent.children[idx] = tmp;
    doc.updatedAt = Date.now();
    return true;
  }

  function countNodes(root) {
    if (!root) return 0;
    let n = 1;
    for (const child of root.children) n += countNodes(child);
    return n;
  }

  function countLeaves(root) {
    if (!root) return 0;
    if (!root.children || root.children.length === 0) return 1;
    let n = 0;
    for (const child of root.children) n += countLeaves(child);
    return n;
  }

  function maxDepth(root) {
    if (!root) return 0;
    if (!root.children || root.children.length === 0) return 1;
    let d = 0;
    for (const child of root.children) d = Math.max(d, maxDepth(child));
    return d + 1;
  }

  function estimateNodeSize(text, opts) {
    opts = opts || {};
    const fontSize = opts.fontSize || 14;
    const padX = opts.padX || 18;
    const padY = opts.padY || 10;
    const minW = opts.minW || 64;
    const charW = fontSize * 0.6;
    const lines = String(text || '').split('\n');
    let maxLineCount = 0;
    for (const line of lines) {
      let c = 0;
      for (const ch of line) c += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
      if (c > maxLineCount) maxLineCount = c;
    }
    const w = Math.max(minW, maxLineCount * charW + padX * 2);
    const h = fontSize * 1.5 * Math.max(1, lines.length) + padY * 2;
    return { w: Math.ceil(w), h: Math.ceil(h) };
  }

  function layoutTree(root, opts) {
    opts = opts || {};
    const hGap = opts.hGap || 78;
    const vGap = opts.vGap || 22;
    const startX = opts.startX || 100;
    const startY = opts.startY || 80;
    const result = [];

    function getVisibleChildren(node) {
      if (!node || node.collapsed) return [];
      return node.children || [];
    }

    function subtreeHeight(node) {
      const size = estimateNodeSize(node.text, opts);
      const visible = getVisibleChildren(node);
      if (visible.length === 0) return size.h;
      let total = 0;
      for (const child of visible) total += subtreeHeight(child);
      total += vGap * (visible.length - 1);
      return Math.max(size.h, total);
    }

    function place(node, x, yCenter) {
      const size = estimateNodeSize(node.text, opts);
      const visible = getVisibleChildren(node);
      const w = size.w;
      const h = size.h;
      const nodeY = yCenter - h / 2;
      result.push({ id: node.id, x: x, y: nodeY, w: w, h: h });
      if (visible.length === 0) return;
      const totalH = subtreeHeight(node);
      let curY = yCenter - totalH / 2;
      for (const child of visible) {
        const childH = subtreeHeight(child);
        const childCenterY = curY + childH / 2;
        place(child, x + w + hGap, childCenterY);
        curY += childH + vGap;
      }
    }

    place(root, startX, startY + subtreeHeight(root) / 2);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of result) {
      if (r.x < minX) minX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.x + r.w > maxX) maxX = r.x + r.w;
      if (r.y + r.h > maxY) maxY = r.y + r.h;
    }
    return {
      nodes: result,
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    };
  }

  function serialize(doc) {
    function clean(node) {
      return {
        id: node.id,
        text: node.text,
        children: (node.children || []).map(clean),
        collapsed: !!node.collapsed,
        color: node.color || null,
        note: node.note || ''
      };
    }
    return JSON.stringify({
      id: doc.id,
      title: doc.title,
      root: clean(doc.root),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }, null, 2);
  }

  function deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return {
      id: data.id || generateId(),
      title: data.title || '思维导图',
      root: data.root ? restoreNode(data.root) : createNode('中心主题'),
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  function restoreNode(n) {
    return {
      id: n.id || generateId(),
      text: n.text || '',
      children: (n.children || []).map(restoreNode),
      collapsed: !!n.collapsed,
      color: n.color || null,
      note: n.note || ''
    };
  }

  function cloneDoc(doc) {
    return deserialize(serialize(doc));
  }

  function toOutline(doc, indent) {
    indent = indent || '  ';
    const lines = [];
    function walk(node, depth) {
      lines.push(indent.repeat(depth) + '- ' + (node.text || ''));
      for (const child of (node.children || [])) walk(child, depth + 1);
    }
    walk(doc.root, 0);
    return lines.join('\n');
  }

  function toMarkdown(doc) {
    return '# ' + (doc.title || '思维导图') + '\n\n' + toOutline(doc, '  ');
  }

  window.MMCore = {
    generateId, resetIdCounter, createNode, createDoc,
    findNode, findParent, getPath, getDepth,
    addChild, addSibling, removeNode, updateNodeText, updateNodeNote,
    setNodeColor, toggleCollapse, moveNode, shiftUp, shiftDown,
    countNodes, countLeaves, maxDepth, estimateNodeSize, layoutTree,
    serialize, deserialize, cloneDoc, toOutline, toMarkdown
  };
})();
