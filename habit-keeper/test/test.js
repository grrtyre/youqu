// 习惯管家 - 核心逻辑单元测试
const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { HabitStore } = require('../src/core/habit-store');
const U = require('../src/core/habit-utils');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

// ============ habit-utils ============
console.log('\n[habit-utils]');

test('toDateKey 输出 YYYY-MM-DD', () => {
  assert.strictEqual(U.toDateKey(new Date(2026, 6, 7)), '2026-07-07');
  assert.strictEqual(U.toDateKey(new Date(2026, 0, 1)), '2026-01-01');
});

test('fromDateKey 还原本地日期', () => {
  const d = U.fromDateKey('2026-07-07');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 6);
  assert.strictEqual(d.getDate(), 7);
});

test('shiftDays 加减天数', () => {
  const d = new Date(2026, 6, 7);
  const next = U.shiftDays(d, 1);
  assert.strictEqual(next.getDate(), 8);
  const prev = U.shiftDays(d, -1);
  assert.strictEqual(prev.getDate(), 6);
});

test('diffDays 相差天数（正负）', () => {
  assert.strictEqual(U.diffDays('2026-07-08', '2026-07-07'), 1);
  assert.strictEqual(U.diffDays('2026-07-07', '2026-07-08'), -1);
  assert.strictEqual(U.diffDays('2026-07-01', '2026-07-31'), -30);
});

test('currentStreak 今天已打卡从今天往前数', () => {
  const today = new Date(2026, 6, 7);
  const records = ['2026-07-05', '2026-07-06', '2026-07-07'];
  assert.strictEqual(U.currentStreak(records, today), 3);
});

test('currentStreak 今天没打则从昨天数', () => {
  const today = new Date(2026, 6, 7);
  const records = ['2026-07-05', '2026-07-06'];
  assert.strictEqual(U.currentStreak(records, today), 2);
});

test('currentStreak 中间断档止于断点', () => {
  const today = new Date(2026, 6, 7);
  const records = ['2026-07-03', '2026-07-04', '2026-07-06'];
  assert.strictEqual(U.currentStreak(records, today), 1);
});

test('currentStreak 空记录为 0', () => {
  assert.strictEqual(U.currentStreak([], new Date()), 0);
  assert.strictEqual(U.currentStreak(null, new Date()), 0);
});

test('longestStreak 历史最长', () => {
  const records = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05', '2026-07-06'];
  assert.strictEqual(U.longestStreak(records), 3);
});

test('longestStreak 单条记录为 1', () => {
  assert.strictEqual(U.longestStreak(['2026-07-07']), 1);
});

test('monthGrid 返回正确周数与格子数', () => {
  // 2026-07：7月1日是周三
  const weeks = U.monthGrid(2026, 6, ['2026-07-07'], new Date(2026, 6, 7));
  assert.ok(weeks.length === 5 || weeks.length === 6);
  const flat = weeks.flat();
  // 第一周前 3 个为 null（周日开始）
  assert.strictEqual(flat[0], null);
  assert.strictEqual(flat[1], null);
  assert.strictEqual(flat[2], null);
  // 7/1 是周三 = 第 4 个
  assert.strictEqual(flat[3].day, 1);
  assert.strictEqual(flat[3].inMonth, true);
  // 7/7 标记为 today + done
  const cell7 = flat.find((c) => c && c.day === 7);
  assert.ok(cell7);
  assert.strictEqual(cell7.isToday, true);
  assert.strictEqual(cell7.done, true);
});

test('monthGrid 总格子是 7 的倍数', () => {
  const weeks = U.monthGrid(2026, 6, []);
  assert.strictEqual(weeks.flat().length % 7, 0);
});

test('weekStats 本周完成统计', () => {
  // 2026-07-07 是周二 → 本周日为 7/5
  const records = ['2026-07-05', '2026-07-06', '2026-07-07'];
  const s = U.weekStats(records, new Date(2026, 6, 7));
  assert.strictEqual(s.done, 3);
  assert.strictEqual(s.total, 7);
  assert.ok(Math.abs(s.rate - 3 / 7) < 1e-9);
});

test('monthStats 本月完成率', () => {
  const records = ['2026-07-01', '2026-07-02', '2026-07-03'];
  const s = U.monthStats(records, new Date(2026, 6, 15));
  assert.strictEqual(s.done, 3);
  assert.strictEqual(s.total, 31);
});

// ============ HabitStore ============
console.log('\n[HabitStore]');

function makeTmpStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-test-'));
  const file = path.join(dir, 'habits.json');
  return { store: new HabitStore(file), file, dir };
}

test('create 创建习惯并返回完整对象', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: '读书', icon: '📚', color: '#007aff' });
  assert.ok(h.id);
  assert.strictEqual(h.name, '读书');
  assert.strictEqual(h.icon, '📚');
  assert.strictEqual(h.records.length, 0);
  assert.strictEqual(h.archived, false);
});

test('create 默认值', () => {
  const { store } = makeTmpStore();
  const h = store.create({});
  assert.strictEqual(h.name, '新习惯');
  assert.strictEqual(h.icon, '✅');
  assert.strictEqual(h.color, '#007aff');
  assert.strictEqual(h.target, 1);
});

test('list 不返回 archived', () => {
  const { store } = makeTmpStore();
  const a = store.create({ name: 'A' });
  store.create({ name: 'B' });
  store.update(a.id, { archived: true });
  const list = store.list();
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].name, 'B');
});

test('toggle 切换今日打卡状态', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: '跑步' });
  const r1 = store.toggle(h.id, new Date(2026, 6, 7));
  assert.strictEqual(r1.done, true);
  assert.strictEqual(store.isDone(h.id, new Date(2026, 6, 7)), true);
  const r2 = store.toggle(h.id, new Date(2026, 6, 7));
  assert.strictEqual(r2.done, false);
  assert.strictEqual(store.isDone(h.id, new Date(2026, 6, 7)), false);
});

test('setDone 设置指定日期完成', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: '冥想' });
  store.setDone(h.id, new Date(2026, 6, 5), true);
  store.setDone(h.id, new Date(2026, 6, 6), true);
  assert.strictEqual(store.isDone(h.id, new Date(2026, 6, 5)), true);
  assert.strictEqual(store.isDone(h.id, new Date(2026, 6, 6)), true);
  assert.strictEqual(store.isDone(h.id, new Date(2026, 6, 7)), false);
  // 再次 setDone(true) 不重复
  store.setDone(h.id, new Date(2026, 6, 5), true);
  assert.strictEqual(h.records.filter((k) => k === '2026-07-05').length, 1);
});

test('update 更新名称/图标/颜色', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: 'A' });
  store.update(h.id, { name: 'B', icon: '🏃', color: '#34c759' });
  const got = store.get(h.id);
  assert.strictEqual(got.name, 'B');
  assert.strictEqual(got.icon, '🏃');
  assert.strictEqual(got.color, '#34c759');
});

test('update 空名称保留原名', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: '原名' });
  store.update(h.id, { name: '   ' });
  assert.strictEqual(store.get(h.id).name, '原名');
});

test('remove 删除习惯', () => {
  const { store } = makeTmpStore();
  const h = store.create({ name: 'A' });
  const removed = store.remove(h.id);
  assert.ok(removed);
  assert.strictEqual(store.get(h.id), undefined);
  assert.strictEqual(store.list().length, 0);
});

test('数据持久化到磁盘并可重新加载', () => {
  const { store, file } = makeTmpStore();
  const h = store.create({ name: '持久测试' });
  store.setDone(h.id, new Date(2026, 6, 7), true);
  const store2 = new HabitStore(file);
  const reloaded = store2.get(h.id);
  assert.ok(reloaded);
  assert.strictEqual(reloaded.name, '持久测试');
  assert.strictEqual(reloaded.records.length, 1);
  assert.strictEqual(reloaded.records[0], '2026-07-07');
});

test('exportJSON / importJSON 往返', () => {
  const { store } = makeTmpStore();
  store.create({ name: '导出测试' });
  const json = store.exportJSON();
  const parsed = JSON.parse(json);
  assert.ok(Array.isArray(parsed.habits));
  assert.strictEqual(parsed.habits.length, 1);

  const { store: store2 } = makeTmpStore();
  store2.importJSON(json);
  assert.strictEqual(store2.list().length, 1);
  assert.strictEqual(store2.list()[0].name, '导出测试');
});

test('importJSON 拒绝无效数据', () => {
  const { store } = makeTmpStore();
  let threw = false;
  try { store.importJSON('{"foo":"bar"}'); }
  catch (e) { threw = true; }
  assert.ok(threw, '应抛出异常');
});

test('数据损坏时降级重置且备份原文件', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-corrupt-'));
  const file = path.join(dir, 'habits.json');
  fs.writeFileSync(file, '{not valid json', 'utf-8');
  const store = new HabitStore(file);
  assert.strictEqual(store.list().length, 0);
  // 备份文件应存在
  const baks = fs.readdirSync(dir).filter((n) => n.startsWith('habits.json.bak'));
  assert.ok(baks.length >= 1);
});

// ============ 结果 ============
console.log(`\n——————————————`);
console.log(`通过 ${passed} · 失败 ${failed}`);
if (failed > 0) process.exit(1);
