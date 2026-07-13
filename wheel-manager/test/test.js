// 抽签转盘管家 - 核心逻辑测试
// 测试 src/core/store.js 的纯函数：名单/条目/历史/设置/加权随机/扇区计算
const assert = require('assert');
const store = require('../src/core/store.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.error('  ✗ ' + name + '\n    ' + (e && e.stack || e)); }
}

console.log('== 抽签转盘管家 核心逻辑测试 ==');

test('createEmptyState 返回结构完整且带默认设置', () => {
  const s = store.createEmptyState();
  assert.deepStrictEqual(s.lists, []);
  assert.deepStrictEqual(s.history, []);
  assert.strictEqual(s.activeListId, null);
  assert.strictEqual(s.settings.spinDuration, 4500);
  assert.strictEqual(s.settings.soundEnabled, true);
  assert.strictEqual(s.settings.excludeWinner, false);
});

test('genId 生成唯一 id', () => {
  const a = store.genId();
  const b = store.genId();
  assert.notStrictEqual(a, b);
  assert.ok(a.startsWith('id_'));
});

test('createList 添加名单并自动激活首个', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, '今天吃什么');
  assert.strictEqual(s.lists.length, 1);
  assert.strictEqual(s.activeListId, l.id);
  assert.strictEqual(l.name, '今天吃什么');
  assert.deepStrictEqual(l.entries, []);
});

test('createList 空名/纯空格回退为默认名', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, '   ');
  assert.strictEqual(l.name, '未命名名单');
});

test('setActiveList 切换激活名单，非法 id 返回 false', () => {
  const s = store.createEmptyState();
  const a = store.createList(s, 'A');
  const b = store.createList(s, 'B');
  assert.strictEqual(store.setActiveList(s, b.id), true);
  assert.strictEqual(s.activeListId, b.id);
  assert.strictEqual(store.setActiveList(s, 'nope'), false);
});

test('renameList 重命名，空名保留原名', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, '旧名');
  assert.strictEqual(store.renameList(s, l.id, '新名'), true);
  assert.strictEqual(l.name, '新名');
  assert.strictEqual(store.renameList(s, l.id, '   '), true);
  assert.strictEqual(l.name, '新名'); // 不变
  assert.strictEqual(store.renameList(s, 'x', 'y'), false);
});

test('deleteList 删除并处理激活态切换', () => {
  const s = store.createEmptyState();
  const a = store.createList(s, 'A');
  const b = store.createList(s, 'B');
  s.activeListId = a.id;
  assert.strictEqual(store.deleteList(s, a.id), true);
  assert.strictEqual(s.lists.length, 1);
  // 删除激活的名单后自动切到第一个
  assert.strictEqual(s.activeListId, b.id);
  assert.strictEqual(store.deleteList(s, 'x'), false);
});

test('addEntry 添加条目，空文本返回 null', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  const e = store.addEntry(s, l.id, '张三', 2);
  assert.ok(e && e.id);
  assert.strictEqual(e.text, '张三');
  assert.strictEqual(e.weight, 2);
  assert.strictEqual(e.enabled, true);
  assert.strictEqual(store.addEntry(s, l.id, '   '), null);
  assert.strictEqual(store.addEntry(s, 'nope', 'x'), null);
});

test('addEntry 权重非数字回退为 1', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  const e = store.addEntry(s, l.id, 'x', 'abc');
  assert.strictEqual(e.weight, 1);
});

test('addEntriesBulk 批量添加去空行', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  const added = store.addEntriesBulk(s, l.id, '  火锅\n\n  麻辣烫  \r\n拉面');
  assert.strictEqual(added.length, 3);
  assert.deepStrictEqual(added.map(e => e.text), ['火锅', '麻辣烫', '拉面']);
  assert.strictEqual(l.entries.length, 3);
});

test('updateEntry 更新文本/权重/启用', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  const e = store.addEntry(s, l.id, 'x', 1);
  assert.strictEqual(store.updateEntry(s, l.id, e.id, { text: 'y', weight: 5, enabled: false }), true);
  assert.strictEqual(e.text, 'y');
  assert.strictEqual(e.weight, 5);
  assert.strictEqual(e.enabled, false);
  assert.strictEqual(store.updateEntry(s, l.id, 'nope', { text: 'z' }), false);
});

test('deleteEntry 与 clearEntries', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.addEntriesBulk(s, l.id, 'a\nb\nc');
  assert.strictEqual(l.entries.length, 3);
  const id = l.entries[1].id;
  assert.strictEqual(store.deleteEntry(s, l.id, id), true);
  assert.strictEqual(l.entries.length, 2);
  assert.deepStrictEqual(l.entries.map(e => e.text), ['a', 'c']);
  assert.strictEqual(store.clearEntries(s, l.id), true);
  assert.strictEqual(l.entries.length, 0);
});

test('pickWeighted 忽略禁用条目', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.addEntriesBulk(s, l.id, 'a\nb\nc');
  // 禁用 b、c，只剩 a
  store.updateEntry(s, l.id, l.entries[1].id, { enabled: false });
  store.updateEntry(s, l.id, l.entries[2].id, { enabled: false });
  const r = store.pickWeighted(s, l.id);
  assert.ok(r);
  assert.strictEqual(r.entry.text, 'a');
});

test('pickWeighted 无可用条目返回 null', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  assert.strictEqual(store.pickWeighted(s, l.id), null);
  store.addEntry(s, l.id, 'x');
  store.updateEntry(s, l.id, l.entries[0].id, { enabled: false });
  assert.strictEqual(store.pickWeighted(s, l.id), null);
});

test('pickWeighted 权重分布近似正确', () => {
  // 固定一个种子化检验：权重 9:1 时高权重应占大多数
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.addEntry(s, l.id, '高', 9);
  store.addEntry(s, l.id, '低', 1);
  let high = 0;
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const r = store.pickWeighted(s, l.id);
    if (r.entry.text === '高') high++;
  }
  const ratio = high / N;
  // 允许较大容差
  assert.ok(ratio > 0.82 && ratio < 0.98, `权重分布异常: ${ratio}`);
});

test('computeSegments 扇区角度总和为 2π', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.addEntriesBulk(s, l.id, 'a\nb\nc');
  const segs = store.computeSegments(s, l.id);
  assert.strictEqual(segs.length, 3);
  const total = segs.reduce((sum, x) => sum + (x.end - x.start), 0);
  assert.ok(Math.abs(total - Math.PI * 2) < 1e-9);
  // mid 落在区间内
  segs.forEach(seg => {
    assert.ok(seg.mid >= seg.start && seg.mid <= seg.end);
  });
  // 起点 0
  assert.ok(Math.abs(segs[0].start) < 1e-9);
});

test('computeSegments 按权重分配角度', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.addEntry(s, l.id, 'a', 1);
  store.addEntry(s, l.id, 'b', 3);
  const segs = store.computeSegments(s, l.id);
  // b 应占 3/4
  const spanB = segs[1].end - segs[1].start;
  assert.ok(Math.abs(spanB - Math.PI * 1.5) < 1e-9);
});

test('recordHistory 记录并限制最多 100 条', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  for (let i = 0; i < 105; i++) {
    store.recordHistory(s, l.id, 'w' + i, 'normal');
  }
  assert.strictEqual(s.history.length, 100);
  // 最新在前
  assert.strictEqual(s.history[0].winner, 'w104');
});

test('recordHistory 记录名单名（即使名单已删）', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, '某名单');
  store.recordHistory(s, l.id, '中奖', 'normal');
  assert.strictEqual(s.history[0].listName, '某名单');
});

test('clearHistory 与 deleteHistory', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, 'L');
  store.recordHistory(s, l.id, 'a', 'normal');
  store.recordHistory(s, l.id, 'b', 'normal');
  const id0 = s.history[0].id;
  assert.strictEqual(store.deleteHistory(s, id0), true);
  assert.strictEqual(s.history.length, 1);
  assert.strictEqual(store.deleteHistory(s, 'nope'), false);
  assert.strictEqual(store.clearHistory(s), true);
  assert.strictEqual(s.history.length, 0);
});

test('updateSettings 钳制 spinDuration 范围', () => {
  const s = store.createEmptyState();
  assert.strictEqual(store.updateSettings(s, { spinDuration: 100 }), true);
  assert.strictEqual(s.settings.spinDuration, 2000); // 下限
  assert.strictEqual(store.updateSettings(s, { spinDuration: 999999 }), true);
  assert.strictEqual(s.settings.spinDuration, 10000); // 上限
  assert.strictEqual(store.updateSettings(s, { soundEnabled: false, excludeWinner: true }), true);
  assert.strictEqual(s.settings.soundEnabled, false);
  assert.strictEqual(s.settings.excludeWinner, true);
  assert.strictEqual(store.updateSettings(s, null), false);
});

test('端到端：完整抽签流程', () => {
  const s = store.createEmptyState();
  const l = store.createList(s, '午餐');
  store.addEntriesBulk(s, l.id, '火锅\n炒饭\n拉面');
  // 禁用炒饭
  store.updateEntry(s, l.id, l.entries[1].id, { enabled: false });
  const segs = store.computeSegments(s, l.id);
  assert.strictEqual(segs.length, 2); // 只剩 2 个启用
  const r = store.pickWeighted(s, l.id);
  assert.ok(r);
  assert.ok(['火锅', '拉面'].includes(r.entry.text));
  store.recordHistory(s, l.id, r.entry.text, 'normal');
  assert.strictEqual(s.history.length, 1);
});

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
