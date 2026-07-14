'use strict';
// 闪卡记忆管家 - 核心逻辑单元测试（不依赖 Electron）
// 运行：node test/test.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const sm2 = require('../src/core/sm2');
const store = require('../src/core/store');
const srs = require('../src/core/srs');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + (e.message || e)); }
}

console.log('\n[SM-2 算法]');
test('新卡首次答对(q=4)：interval=1, reps=1', () => {
  const r = sm2.schedule({ ef: 2.5, interval: 0, reps: 0 }, 4, 1000);
  assert.strictEqual(r.interval, 1);
  assert.strictEqual(r.reps, 1);
  assert.strictEqual(r.due, 1000 + 1 * 86400000);
});

test('第二次答对(q=4)：interval=6, reps=2', () => {
  const r = sm2.schedule({ ef: 2.5, interval: 1, reps: 1 }, 4, 1000);
  assert.strictEqual(r.interval, 6);
  assert.strictEqual(r.reps, 2);
});

test('第三次答对(q=4)：interval=round(6*ef)', () => {
  const r = sm2.schedule({ ef: 2.5, interval: 6, reps: 2 }, 4, 1000);
  assert.strictEqual(r.interval, Math.round(6 * 2.5)); // 15
  assert.strictEqual(r.reps, 3);
});

test('答错(q=1)：reps 归零，interval=1', () => {
  const r = sm2.schedule({ ef: 2.6, interval: 20, reps: 5 }, 1, 1000);
  assert.strictEqual(r.reps, 0);
  assert.strictEqual(r.interval, 1);
});

test('答错后 EF 下降', () => {
  const r = sm2.schedule({ ef: 2.5, interval: 6, reps: 2 }, 1, 1000);
  assert.ok(r.ef < 2.5, 'ef should decrease, got ' + r.ef);
});

test('EF 不低于 1.3', () => {
  let card = { ef: 1.3, interval: 6, reps: 2 };
  for (let i = 0; i < 20; i++) card = sm2.schedule(card, 0, 1000);
  assert.ok(card.ef >= 1.3, 'ef should not go below 1.3, got ' + card.ef);
});

test('答简单(q=5)：EF 上升', () => {
  const r = sm2.schedule({ ef: 2.5, interval: 1, reps: 1 }, 5, 1000);
  assert.ok(r.ef > 2.5, 'ef should increase, got ' + r.ef);
});

test('初始调度：due=now, reps=0, ef=2.5', () => {
  const s = sm2.initialSchedule(5000);
  assert.strictEqual(s.reps, 0);
  assert.strictEqual(s.ef, 2.5);
  assert.strictEqual(s.due, 5000);
});

test('非法 q 抛错', () => {
  assert.throws(() => sm2.schedule({}, 6), /0..5/);
  assert.throws(() => sm2.schedule({}, -1), /0..5/);
});

console.log('\n[存储层]');
function tmpFile() {
  return path.join(os.tmpdir(), 'fc-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
}

test('空状态 load 返回空结构', () => {
  store.setDataFile(tmpFile());
  const s = store.load();
  assert.ok(s.decks && typeof s.decks === 'object');
  assert.ok(Array.isArray(s.order));
  assert.strictEqual(s.order.length, 0);
});

test('创建卡组后出现在 listDecks', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const d = store.createDeck(s, '英语');
  assert.ok(d.id);
  assert.strictEqual(store.listDecks(s).length, 1);
  assert.strictEqual(store.listDecks(s)[0].name, '英语');
});

test('添加卡片并持久化', () => {
  const f = tmpFile();
  store.setDataFile(f);
  let s = store.load();
  const d = store.createDeck(s, '词');
  store.addCard(s, d.id, { front: 'a', back: 'b', tags: ['t'] });
  store.save(s);
  // 重新加载
  s = store.load();
  const cards = store.listCards(s, d.id);
  assert.strictEqual(cards.length, 1);
  assert.strictEqual(cards[0].front, 'a');
  assert.strictEqual(cards[0].tags[0], 't');
  assert.strictEqual(cards[0].ef, 2.5);
});

test('更新与删除卡片', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const d = store.createDeck(s, 'x');
  const c = store.addCard(s, d.id, { front: 'f', back: 'b' });
  store.updateCard(s, d.id, c.id, { front: 'f2' });
  assert.strictEqual(store.getCard(s, d.id, c.id).front, 'f2');
  assert.strictEqual(store.deleteCard(s, d.id, c.id), true);
  assert.strictEqual(store.getCard(s, d.id, c.id), null);
});

test('删除卡组', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const d = store.createDeck(s, 'del');
  store.deleteDeck(s, d.id);
  assert.strictEqual(store.listDecks(s).length, 0);
});

test('setCardSchedule 更新调度字段', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const d = store.createDeck(s, 'sch');
  const c = store.addCard(s, d.id, { front: 'a', back: 'b' });
  store.setCardSchedule(s, d.id, c.id, { ef: 2.2, interval: 6, reps: 2, due: 9999, lastReview: 123 });
  const got = store.getCard(s, d.id, c.id);
  assert.strictEqual(got.ef, 2.2);
  assert.strictEqual(got.interval, 6);
  assert.strictEqual(got.reps, 2);
  assert.strictEqual(got.due, 9999);
});

test('导入导出往返一致', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const d = store.createDeck(s, '导出');
  store.addCard(s, d.id, { front: 'a', back: 'b' });
  const exported = store.exportAll(s);
  const imported = store.importAll(s, JSON.parse(JSON.stringify(exported)));
  assert.strictEqual(store.listDecks(imported).length, 1);
  assert.strictEqual(store.listCards(imported, d.id).length, 1);
});

test('导入校验补默认调度字段', () => {
  store.setDataFile(tmpFile());
  let s = store.load();
  const bad = { decks: { d1: { id: 'd1', name: 'n', cards: { c1: { id: 'c1', front: 'a', back: 'b' } } } }, order: ['d1'] };
  const imported = store.importAll(s, bad);
  const c = store.listCards(imported, 'd1')[0];
  assert.strictEqual(c.ef, 2.5);
  assert.strictEqual(c.reps, 0);
});

console.log('\n[复习调度]');
test('isDue 判断到期', () => {
  assert.strictEqual(srs.isDue({ due: 100 }, 200), true);
  assert.strictEqual(srs.isDue({ due: 300 }, 200), false);
});

test('dueCards 按到期升序', () => {
  const cards = [{ due: 300 }, { due: 100 }, { due: 200 }];
  const d = srs.dueCards(cards, 500);
  assert.strictEqual(d.length, 3);
  assert.strictEqual(d[0].due, 100);
  assert.strictEqual(d[2].due, 300);
});

test('stats 统计正确', () => {
  const now = 1000;
  const cards = [
    { reps: 0, due: 500 },   // 新卡 + 到期
    { reps: 0, due: 2000 },  // 新卡 + 未到期
    { reps: 3, due: 800 },   // 已学 + 到期
    { reps: 2, due: 3000 }   // 已学 + 未到期
  ];
  const st = srs.stats(cards, now);
  assert.strictEqual(st.total, 4);
  assert.strictEqual(st.fresh, 2);
  assert.strictEqual(st.learned, 2);
  assert.strictEqual(st.due, 2); // due=500 与 due=800 到期，其余未到期
});

test('buildQueue 包含到期卡 + 新卡上限', () => {
  const now = 1000;
  const cards = [];
  for (let i = 0; i < 30; i++) cards.push({ reps: 0, due: 2000 + i, createdAt: i }); // 新卡未到期
  for (let i = 0; i < 5; i++) cards.push({ reps: 2, due: 500, createdAt: 100 + i });  // 到期
  const q = srs.buildQueue(cards, { newPerSession: 10 }, now);
  // 到期5 + 新卡10
  const dueCount = q.filter((c) => c.due <= now).length;
  const freshCount = q.filter((c) => c.reps === 0 && c.due > now).length;
  assert.strictEqual(dueCount, 5);
  assert.strictEqual(freshCount, 10);
});

console.log('\n==============================');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('==============================\n');
process.exit(fail > 0 ? 1 : 0);
