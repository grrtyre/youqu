// 看板管家 - 核心逻辑测试
const assert = require('assert');
const Store = require('../src/scripts/store.js');

let pass = 0, fail = 0;

function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.error('  ✗ ' + name + ' -> ' + e.message); }
}

console.log('看板管家核心逻辑测试\n');

test('createBoard 默认包含三个列表', () => {
  const b = Store.createBoard();
  assert.strictEqual(b.lists.length, 3);
  assert.deepStrictEqual(b.lists.map(l => l.name), ['待办', '进行中', '已完成']);
  assert.ok(b.id && b.id.startsWith('b_'));
});

test('createCard 字段完整', () => {
  const c = Store.createCard('买菜', { priority: 'high', labels: ['生活'], due: '2026-12-31T00:00:00.000Z' });
  assert.strictEqual(c.title, '买菜');
  assert.strictEqual(c.priority, 'high');
  assert.deepStrictEqual(c.labels, ['生活']);
  assert.strictEqual(c.completed, false);
  assert.ok(c.id.startsWith('c_'));
});

test('addCardToList 添加到指定列表', () => {
  const b = Store.createBoard();
  const card = Store.createCard('任务A');
  assert.strictEqual(Store.addCardToList(b, b.lists[0].id, card), true);
  assert.strictEqual(b.lists[0].cards.length, 1);
  assert.strictEqual(Store.addCardToList(b, 'invalid', card), false);
});

test('updateCard 修改字段', () => {
  const b = Store.createBoard();
  const card = Store.createCard('A');
  Store.addCardToList(b, b.lists[0].id, card);
  Store.updateCard(b, card.id, { title: 'B', priority: 'high' });
  assert.strictEqual(b.lists[0].cards[0].title, 'B');
  assert.strictEqual(b.lists[0].cards[0].priority, 'high');
});

test('deleteCard 删除卡片', () => {
  const b = Store.createBoard();
  const card = Store.createCard('A');
  Store.addCardToList(b, b.lists[0].id, card);
  assert.strictEqual(Store.deleteCard(b, card.id), true);
  assert.strictEqual(b.lists[0].cards.length, 0);
  assert.strictEqual(Store.deleteCard(b, card.id), false);
});

test('moveCard 跨列表移动', () => {
  const b = Store.createBoard();
  const card = Store.createCard('A');
  Store.addCardToList(b, b.lists[0].id, card);
  assert.strictEqual(Store.moveCard(b, card.id, b.lists[1].id), true);
  assert.strictEqual(b.lists[0].cards.length, 0);
  assert.strictEqual(b.lists[1].cards.length, 1);
});

test('moveCard 移到完成列表自动标记完成', () => {
  const b = Store.createBoard();
  const card = Store.createCard('A');
  Store.addCardToList(b, b.lists[0].id, card);
  Store.moveCard(b, card.id, b.lists[2].id); // 已完成
  assert.strictEqual(b.lists[2].cards[0].completed, true);
});

test('moveCard 指定位置插入', () => {
  const b = Store.createBoard();
  ['A', 'B', 'C'].forEach(t => Store.addCardToList(b, b.lists[0].id, Store.createCard(t)));
  const cardA = b.lists[0].cards[0];
  Store.moveCard(b, cardA.id, b.lists[0].id, 2); // 移到末尾
  assert.strictEqual(b.lists[0].cards[2].title, 'A');
});

test('reorderCard 列表内重排', () => {
  const b = Store.createBoard();
  ['A', 'B', 'C'].forEach(t => Store.addCardToList(b, b.lists[0].id, Store.createCard(t)));
  const cardC = b.lists[0].cards[2];
  Store.reorderCard(b, cardC.id, 0);
  assert.strictEqual(b.lists[0].cards[0].title, 'C');
});

test('addList/renameList/deleteList', () => {
  const b = Store.createBoard();
  const list = Store.addList(b, '待审核');
  assert.strictEqual(b.lists.length, 4);
  Store.renameList(b, list.id, '审核中');
  assert.strictEqual(b.lists[3].name, '审核中');
  Store.deleteList(b, list.id);
  assert.strictEqual(b.lists.length, 3);
});

test('stats 统计正确', () => {
  const b = Store.createBoard();
  Store.addCardToList(b, b.lists[0].id, Store.createCard('A'));
  Store.addCardToList(b, b.lists[0].id, Store.createCard('B'));
  const done = Store.createCard('C', { completed: true });
  Store.addCardToList(b, b.lists[2].id, done);
  const s = Store.stats(b);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.completed, 1);
  assert.strictEqual(s.pending, 2);
});

test('stats 逾期统计', () => {
  const b = Store.createBoard();
  const overdue = Store.createCard('逾期', { due: '2020-01-01T00:00:00.000Z' });
  Store.addCardToList(b, b.lists[0].id, overdue);
  const s = Store.stats(b);
  assert.strictEqual(s.overdue, 1);
});

test('searchCards 关键词匹配', () => {
  const b = Store.createBoard();
  Store.addCardToList(b, b.lists[0].id, Store.createCard('买牛奶', { labels: ['生活'] }));
  Store.addCardToList(b, b.lists[0].id, Store.createCard('写代码'));
  const r1 = Store.searchCards(b, '牛奶');
  assert.strictEqual(r1.length, 1);
  const r2 = Store.searchCards(b, '生活');
  assert.strictEqual(r2.length, 1);
  assert.strictEqual(r2[0].card.title, '买牛奶');
  const r3 = Store.searchCards(b, '');
  assert.strictEqual(r3.length, 0);
});

test('archiveCompleted 归档已完成', () => {
  const b = Store.createBoard();
  Store.addCardToList(b, b.lists[0].id, Store.createCard('A', { completed: true }));
  Store.addCardToList(b, b.lists[0].id, Store.createCard('B', { completed: false }));
  const n = Store.archiveCompleted(b);
  assert.strictEqual(n, 1);
  assert.strictEqual(b.lists[0].cards.length, 1);
  assert.strictEqual(b.lists[0].cards[0].title, 'B');
});

test('validate 数据校验', () => {
  const good = { boards: [Store.createBoard()], settings: { theme: 'light' } };
  assert.strictEqual(Store.validate(good).length, 0);
  const bad = { boards: 'not array' };
  const errs = Store.validate(bad);
  assert.ok(errs.length > 0);
});

test('uid 唯一性', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) ids.add(Store.uid());
  assert.strictEqual(ids.size, 1000);
});

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
