'use strict';

// 思维导图核心逻辑自动化测试
const assert = require('assert');
const core = require('../src/core/mindmap-core');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.error('  ✗ ' + name + '\n    ' + e.message);
  }
}

console.log('=== 思维导图核心逻辑测试 ===\n');

// ---------- 节点 / 文档工厂 ----------
test('createNode 默认文本与字段', () => {
  core.resetIdCounter();
  const n = core.createNode('主题');
  assert.strictEqual(n.text, '主题');
  assert.ok(Array.isArray(n.children));
  assert.strictEqual(n.children.length, 0);
  assert.strictEqual(n.collapsed, false);
  assert.strictEqual(n.color, null);
  assert.strictEqual(n.note, '');
});

test('createDoc 初始化根节点', () => {
  const doc = core.createDoc('我的导图');
  assert.strictEqual(doc.title, '我的导图');
  assert.ok(doc.root);
  assert.strictEqual(doc.root.text, '中心主题');
  assert.strictEqual(doc.createdAt, doc.updatedAt);
});

// ---------- 树查找 ----------
test('findNode 能找到根和子节点', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, c1.id, '孙1');
  assert.strictEqual(core.findNode(doc.root, doc.root.id), doc.root);
  assert.strictEqual(core.findNode(doc.root, c1.id), c1);
  assert.strictEqual(core.findNode(doc.root, c2.id), c2);
  assert.strictEqual(core.findNode(doc.root, 'notexist'), null);
});

test('findParent 正确返回父节点', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, c1.id, '孙1');
  assert.strictEqual(core.findParent(doc.root, c1.id), doc.root);
  assert.strictEqual(core.findParent(doc.root, c2.id), c1);
  assert.strictEqual(core.findParent(doc.root, doc.root.id), null);
});

test('getPath 返回从根到节点的路径', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, c1.id, '孙1');
  const path = core.getPath(doc.root, c2.id);
  assert.strictEqual(path.length, 3);
  assert.strictEqual(path[0], doc.root);
  assert.strictEqual(path[1], c1);
  assert.strictEqual(path[2], c2);
});

test('getDepth 根为 0，子为 1', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, c1.id, '孙1');
  assert.strictEqual(core.getDepth(doc.root, doc.root.id), 0);
  assert.strictEqual(core.getDepth(doc.root, c1.id), 1);
  assert.strictEqual(core.getDepth(doc.root, c2.id), 2);
});

// ---------- 树操作 ----------
test('addChild 在父节点末尾追加', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, doc.root.id, '子2');
  assert.strictEqual(doc.root.children.length, 2);
  assert.strictEqual(doc.root.children[0], c1);
  assert.strictEqual(doc.root.children[1], c2);
});

test('addSibling 在节点后插入兄弟', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const sib = core.addSibling(doc, c1.id, '兄弟');
  assert.strictEqual(doc.root.children.length, 2);
  assert.strictEqual(doc.root.children[1], sib);
});

test('addSibling 对根节点返回 null', () => {
  const doc = core.createDoc();
  const r = core.addSibling(doc, doc.root.id, '兄弟');
  assert.strictEqual(r, null);
});

test('removeNode 删除子节点及其子树', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  core.addChild(doc, c1.id, '孙1');
  assert.strictEqual(doc.root.children.length, 1);
  const ok = core.removeNode(doc, c1.id);
  assert.strictEqual(ok, true);
  assert.strictEqual(doc.root.children.length, 0);
});

test('removeNode 根节点不可删除', () => {
  const doc = core.createDoc();
  const ok = core.removeNode(doc, doc.root.id);
  assert.strictEqual(ok, false);
});

test('updateNodeText 修改文本', () => {
  const doc = core.createDoc();
  core.updateNodeText(doc, doc.root.id, '新主题');
  assert.strictEqual(doc.root.text, '新主题');
});

test('updateNodeNote 修改备注', () => {
  const doc = core.createDoc();
  core.updateNodeNote(doc, doc.root.id, '这是一个备注');
  assert.strictEqual(doc.root.note, '这是一个备注');
});

test('setNodeColor 设置颜色', () => {
  const doc = core.createDoc();
  core.setNodeColor(doc, doc.root.id, '#ff0000');
  assert.strictEqual(doc.root.color, '#ff0000');
  core.setNodeColor(doc, doc.root.id, null);
  assert.strictEqual(doc.root.color, null);
});

test('toggleCollapse 切换折叠状态', () => {
  const doc = core.createDoc();
  assert.strictEqual(doc.root.collapsed, false);
  const s1 = core.toggleCollapse(doc, doc.root.id);
  assert.strictEqual(s1, true);
  assert.strictEqual(doc.root.collapsed, true);
  const s2 = core.toggleCollapse(doc, doc.root.id);
  assert.strictEqual(s2, false);
});

test('moveNode 移动节点到新父', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const c2 = core.addChild(doc, doc.root.id, '子2');
  const g1 = core.addChild(doc, c1.id, '孙1');
  // 把 g1 移到 c2 下
  const ok = core.moveNode(doc, g1.id, c2.id);
  assert.strictEqual(ok, true);
  assert.strictEqual(c1.children.length, 0);
  assert.strictEqual(c2.children.length, 1);
  assert.strictEqual(c2.children[0], g1);
});

test('moveNode 不能移到自己的子树（防环）', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const g1 = core.addChild(doc, c1.id, '孙1');
  // 把 c1 移到 g1（c1 的孙子）下 —— 应失败
  const ok = core.moveNode(doc, c1.id, g1.id);
  assert.strictEqual(ok, false);
});

test('moveNode 根节点不可移动', () => {
  const doc = core.createDoc();
  const c1 = core.addChild(doc, doc.root.id, '子1');
  const ok = core.moveNode(doc, doc.root.id, c1.id);
  assert.strictEqual(ok, false);
});

test('shiftUp / shiftDown 调整兄弟顺序', () => {
  const doc = core.createDoc();
  const a = core.addChild(doc, doc.root.id, 'A');
  const b = core.addChild(doc, doc.root.id, 'B');
  const c = core.addChild(doc, doc.root.id, 'C');
  // 上移 B（已在第 1 位）失败
  assert.strictEqual(core.shiftUp(doc, a.id), false);
  // 下移 A 成功
  assert.strictEqual(core.shiftDown(doc, a.id), true);
  assert.strictEqual(doc.root.children[0], b);
  assert.strictEqual(doc.root.children[1], a);
  assert.strictEqual(doc.root.children[2], c);
  // 上移 A 成功回到原位
  assert.strictEqual(core.shiftUp(doc, a.id), true);
  assert.strictEqual(doc.root.children[0], a);
});

// ---------- 统计 ----------
test('countNodes / countLeaves / maxDepth', () => {
  const doc = core.createDoc();
  // 结构：root -> a, b; a -> a1, a2; b -> b1
  const a = core.addChild(doc, doc.root.id, 'A');
  const b = core.addChild(doc, doc.root.id, 'B');
  core.addChild(doc, a.id, 'A1');
  core.addChild(doc, a.id, 'A2');
  core.addChild(doc, b.id, 'B1');
  // 节点数：root + a + b + a1 + a2 + b1 = 6
  assert.strictEqual(core.countNodes(doc.root), 6);
  // 叶子：a1, a2, b1 = 3
  assert.strictEqual(core.countLeaves(doc.root), 3);
  // 深度：root -> a -> a1 = 3 层
  assert.strictEqual(core.maxDepth(doc.root), 3);
});

// ---------- 布局 ----------
test('estimateNodeSize 中文文本宽度更大', () => {
  const en = core.estimateNodeSize('hello', { fontSize: 14 });
  const zh = core.estimateNodeSize('你好世界', { fontSize: 14 });
  assert.ok(zh.w > en.w, '中文应比同长度英文更宽');
  assert.ok(en.w >= 60);
});

test('layoutTree 返回所有可见节点坐标', () => {
  const doc = core.createDoc();
  const a = core.addChild(doc, doc.root.id, 'A');
  const b = core.addChild(doc, doc.root.id, 'B');
  core.addChild(doc, a.id, 'A1');
  const layout = core.layoutTree(doc.root, {});
  // 根 + A + B + A1 = 4 个节点
  assert.strictEqual(layout.nodes.length, 4);
  assert.ok(layout.bounds.width > 0);
  assert.ok(layout.bounds.height > 0);
  // 根节点 x 应小于子节点 x
  const rootPos = layout.nodes.find(n => n.id === doc.root.id);
  const aPos = layout.nodes.find(n => n.id === a.id);
  assert.ok(rootPos.x < aPos.x, '子节点应在父节点右侧');
});

test('layoutTree 折叠后不返回后代节点', () => {
  const doc = core.createDoc();
  const a = core.addChild(doc, doc.root.id, 'A');
  core.addChild(doc, a.id, 'A1');
  core.addChild(doc, a.id, 'A2');
  // 折叠 A
  core.toggleCollapse(doc, a.id);
  const layout = core.layoutTree(doc.root, {});
  // 根 + A = 2 个节点（A1/A2 被折叠）
  assert.strictEqual(layout.nodes.length, 2);
});

// ---------- 序列化 ----------
test('serialize / deserialize 往返一致', () => {
  const doc = core.createDoc('测试导图');
  core.updateNodeText(doc, doc.root.id, '根主题');
  const a = core.addChild(doc, doc.root.id, 'A');
  core.addChild(doc, a.id, 'A1');
  core.setNodeColor(doc, a.id, '#007aff');
  core.updateNodeNote(doc, a.id, '备注内容');

  const json = core.serialize(doc);
  const restored = core.deserialize(json);
  assert.strictEqual(restored.title, '测试导图');
  assert.strictEqual(restored.root.text, '根主题');
  assert.strictEqual(restored.root.children.length, 1);
  assert.strictEqual(restored.root.children[0].text, 'A');
  assert.strictEqual(restored.root.children[0].color, '#007aff');
  assert.strictEqual(restored.root.children[0].note, '备注内容');
  assert.strictEqual(restored.root.children[0].children[0].text, 'A1');
});

test('cloneDoc 深拷贝互不影响', () => {
  const doc = core.createDoc();
  core.addChild(doc, doc.root.id, 'A');
  const copy = core.cloneDoc(doc);
  core.addChild(copy, copy.root.id, 'B');
  assert.strictEqual(doc.root.children.length, 1);
  assert.strictEqual(copy.root.children.length, 2);
});

// ---------- 导出 ----------
test('toOutline 输出缩进大纲', () => {
  const doc = core.createDoc();
  core.addChild(doc, doc.root.id, 'A');
  core.addChild(doc, doc.root.id, 'B');
  const outline = core.toOutline(doc);
  assert.ok(outline.includes('- 中心主题'));
  assert.ok(outline.includes('  - A'));
  assert.ok(outline.includes('  - B'));
});

test('toMarkdown 包含标题', () => {
  const doc = core.createDoc('我的导图');
  const md = core.toMarkdown(doc);
  assert.ok(md.startsWith('# 我的导图'));
  assert.ok(md.includes('- 中心主题'));
});

// ---------- 边界情况 ----------
test('updateNodeText 对不存在的节点返回 false', () => {
  const doc = core.createDoc();
  assert.strictEqual(core.updateNodeText(doc, 'notexist', 'x'), false);
});

test('addChild 对不存在的父节点返回 null', () => {
  const doc = core.createDoc();
  assert.strictEqual(core.addChild(doc, 'notexist', 'x'), null);
});

test('ID 唯一性', () => {
  core.resetIdCounter();
  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    ids.add(core.generateId());
  }
  assert.strictEqual(ids.size, 100);
});

console.log('\n=== 测试结果 ===');
console.log('通过: ' + passed + ' / 失败: ' + failed);
if (failed > 0) process.exit(1);
