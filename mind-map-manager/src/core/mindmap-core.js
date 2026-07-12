'use strict';

// 思维导图核心逻辑（纯函数 + 数据模型，可在 Node 环境测试）

// ---------- ID 生成 ----------
let _idCounter = 0;
function generateId() {
  _idCounter += 1;
  return 'n' + Date.now().toString(36) + '_' + _idCounter.toString(36);
}
function resetIdCounter() { _idCounter = 0; }

// ---------- 节点工厂 ----------
function createNode(text = '', opts = {}) {
  return {
    id: generateId(),
    text: text,
    children: [],
    collapsed: false,
    color: opts.color || null,
    note: opts.note || '',
    // 布局缓存（由 layout 填充）
    _x: 0,
    _y: 0,
    _w: 0,
    _h: 0
  };
}

// ---------- 文档工厂 ----------
function createDoc(title = '新建思维导图') {
  const now = Date.now();
  return {
    id: generateId(),
    title: title,
    root: createNode('中心主题'),
    createdAt: now,
    updatedAt: now
  };
}

// ---------- 树查找 ----------
// 深度优先查找节点
function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// 查找父节点
function findParent(root, id) {
  if (!root || root.id === id) return null;
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

// 获取从根到节点的路径（返回节点数组，含根和目标）
function getPath(root, id) {
  if (!root) return [];
  if (root.id === id) return [root];
  for (const child of root.children) {
    const subPath = getPath(child, id);
    if (subPath.length > 0) return [root, ...subPath];
  }
  return [];
}

// 节点深度（根为 0）
function getDepth(root, id) {
  const path = getPath(root, id);
  return path.length - 1;
}

// ---------- 树操作 ----------
// 添加子节点
function addChild(doc, parentId, text = '新节点') {
  const parent = findNode(doc.root, parentId);
  if (!parent) return null;
  const node = createNode(text);
  parent.children.push(node);
  doc.updatedAt = Date.now();
  return node;
}

// 添加兄弟节点（根节点不能添加兄弟）
function addSibling(doc, nodeId, text = '新节点') {
  const parent = findParent(doc.root, nodeId);
  if (!parent) return null; // 根节点无父，不能添加兄弟
  const node = createNode(text);
  const idx = parent.children.findIndex(c => c.id === nodeId);
  if (idx < 0) return null;
  parent.children.splice(idx + 1, 0, node);
  doc.updatedAt = Date.now();
  return node;
}

// 删除节点（根节点不能删除）
function removeNode(doc, nodeId) {
  const parent = findParent(doc.root, nodeId);
  if (!parent) return false; // 根节点不可删
  const idx = parent.children.findIndex(c => c.id === nodeId);
  if (idx < 0) return false;
  parent.children.splice(idx, 1);
  doc.updatedAt = Date.now();
  return true;
}

// 更新节点文本
function updateNodeText(doc, nodeId, text) {
  const node = findNode(doc.root, nodeId);
  if (!node) return false;
  node.text = String(text == null ? '' : text);
  doc.updatedAt = Date.now();
  return true;
}

// 更新节点备注
function updateNodeNote(doc, nodeId, note) {
  const node = findNode(doc.root, nodeId);
  if (!node) return false;
  node.note = String(note == null ? '' : note);
  doc.updatedAt = Date.now();
  return true;
}

// 设置节点颜色
function setNodeColor(doc, nodeId, color) {
  const node = findNode(doc.root, nodeId);
  if (!node) return false;
  node.color = color || null;
  doc.updatedAt = Date.now();
  return true;
}

// 折叠/展开切换
function toggleCollapse(doc, nodeId) {
  const node = findNode(doc.root, nodeId);
  if (!node) return false;
  node.collapsed = !node.collapsed;
  doc.updatedAt = Date.now();
  return node.collapsed;
}

// 移动节点（将 node 移到 newParent 下，作为第 index 个子节点）
function moveNode(doc, nodeId, newParentId, index = -1) {
  if (nodeId === newParentId) return false;
  // 不能将节点移到自己的子树里（会造成环）
  const node = findNode(doc.root, nodeId);
  if (!node) return false;
  if (findNode(node, newParentId)) return false; // 目标是自己的后代
  const oldParent = findParent(doc.root, nodeId);
  if (!oldParent) return false; // 根不可移动
  const newParent = findNode(doc.root, newParentId);
  if (!newParent) return false;
  // 从旧父移除
  const oldIdx = oldParent.children.findIndex(c => c.id === nodeId);
  if (oldIdx < 0) return false;
  oldParent.children.splice(oldIdx, 1);
  // 插入新父
  if (index < 0 || index > newParent.children.length) index = newParent.children.length;
  newParent.children.splice(index, 0, node);
  doc.updatedAt = Date.now();
  return true;
}

// 上移节点（在兄弟中排序靠前）
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

// 下移节点
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

// ---------- 统计 ----------
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

// ---------- 文本测量（用于布局） ----------
// 估算节点文本宽高（中文按 2 个字符宽度算，字号 14px）
function estimateNodeSize(text, opts) {
  opts = opts || {};
  const fontSize = opts.fontSize || 14;
  const padX = opts.padX || 16;
  const padY = opts.padY || 10;
  const minW = opts.minW || 60;
  const charW = fontSize * 0.6; // 英文字符宽
  // 计算等价字符数（中文算 2）
  let count = 0;
  for (const ch of String(text || '')) {
    count += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1;
  }
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

// ---------- 树形布局算法 ----------
// 右展开树形布局：根在左，子树向右展开
// 返回每个节点的 { id, x, y, w, h }，以及总边界
function layoutTree(root, opts) {
  opts = opts || {};
  const hGap = opts.hGap || 78;   // 水平层间距
  const vGap = opts.vGap || 22;   // 兄弟节点垂直间距
  const startX = opts.startX || 80;
  const startY = opts.startY || 60;

  const result = []; // { id, x, y, w, h }

  function getVisibleChildren(node) {
    if (!node || node.collapsed) return [];
    return node.children || [];
  }

  // 计算子树高度（叶子节点高度 + 间距）
  function subtreeHeight(node) {
    const size = estimateNodeSize(node.text, opts);
    const visible = getVisibleChildren(node);
    if (visible.length === 0) {
      return size.h;
    }
    let total = 0;
    for (const child of visible) {
      total += subtreeHeight(child);
    }
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

  // 计算边界
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

// ---------- 序列化 ----------
function serialize(doc) {
  // 移除布局缓存后序列化
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
    note: n.note || '',
    _x: 0, _y: 0, _w: 0, _h: 0
  };
}

// 深拷贝文档（用于撤销栈）
function cloneDoc(doc) {
  return deserialize(serialize(doc));
}

// ---------- 导出为纯文本大纲 ----------
function toOutline(doc, indent = '  ') {
  const lines = [];
  function walk(node, depth) {
    lines.push(indent.repeat(depth) + '- ' + (node.text || ''));
    for (const child of (node.children || [])) walk(child, depth + 1);
  }
  walk(doc.root, 0);
  return lines.join('\n');
}

// ---------- 导出为 Markdown ----------
function toMarkdown(doc) {
  return '# ' + (doc.title || '思维导图') + '\n\n' + toOutline(doc, '  ');
}

module.exports = {
  generateId,
  resetIdCounter,
  createNode,
  createDoc,
  findNode,
  findParent,
  getPath,
  getDepth,
  addChild,
  addSibling,
  removeNode,
  updateNodeText,
  updateNodeNote,
  setNodeColor,
  toggleCollapse,
  moveNode,
  shiftUp,
  shiftDown,
  countNodes,
  countLeaves,
  maxDepth,
  estimateNodeSize,
  layoutTree,
  serialize,
  deserialize,
  cloneDoc,
  toOutline,
  toMarkdown
};
