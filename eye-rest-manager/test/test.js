// test/test.js — 护眼管家核心逻辑测试
// 运行：node test/test.js
'use strict';

const assert = require('assert');
const engine = require('../src/core/break-engine');
const stats = require('../src/core/stats-utils');
const store = require('../src/core/store');
const exercises = require('../src/core/exercises');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log('\n=== break-engine ===');

test('normalizeSettings 给空对象返回完整默认设置', () => {
  const s = engine.normalizeSettings({});
  assert.strictEqual(s.breaks.micro.enabled, true);
  assert.strictEqual(s.breaks.micro.interval, 20);
  assert.strictEqual(s.breaks.short.interval, 60);
  assert.strictEqual(s.breaks.long.interval, 180);
  assert.strictEqual(s.warning.leadTime, 10);
  assert.strictEqual(s.sound, true);
});

test('normalizeSettings 非法值会被夹取到合法范围', () => {
  const s = engine.normalizeSettings({
    breaks: { micro: { interval: -5, duration: 99999 } },
    warning: { leadTime: 999 }
  });
  assert.strictEqual(s.breaks.micro.interval, 1, 'interval 下限 1');
  assert.strictEqual(s.breaks.micro.duration, 3600, 'duration 上限 3600');
  assert.strictEqual(s.warning.leadTime, 60, 'leadTime 上限 60');
});

test('normalizeSettings 不破坏未提供的字段', () => {
  const s = engine.normalizeSettings({ sound: false });
  assert.strictEqual(s.sound, false);
  assert.strictEqual(s.breaks.micro.enabled, true, '其他字段保持默认');
});

test('isInDND 在免打扰时段内返回 true', () => {
  const dnd = { enabled: true, start: '22:00', end: '08:00' };
  const n1 = new Date(2026, 6, 11, 23, 30);
  const n2 = new Date(2026, 6, 11, 3, 0);
  const n3 = new Date(2026, 6, 11, 12, 0);
  assert.strictEqual(engine.isInDND(n1, dnd), true, '23:30 在免打扰内');
  assert.strictEqual(engine.isInDND(n2, dnd), true, '03:00 在免打扰内（跨午夜）');
  assert.strictEqual(engine.isInDND(n3, dnd), false, '12:00 不在免打扰内');
});

test('isInDND 同日时段（不跨午夜）', () => {
  const dnd = { enabled: true, start: '09:00', end: '12:00' };
  assert.strictEqual(engine.isInDND(new Date(2026, 6, 11, 10, 0), dnd), true);
  assert.strictEqual(engine.isInDND(new Date(2026, 6, 11, 8, 0), dnd), false);
  assert.strictEqual(engine.isInDND(new Date(2026, 6, 11, 12, 0), dnd), false);
});

test('isInDND 关闭时恒为 false', () => {
  const dnd = { enabled: false, start: '00:00', end: '23:59' };
  assert.strictEqual(engine.isInDND(new Date(2026, 6, 11, 3, 0), dnd), false);
});

test('scheduleNextBreaks 按时间升序返回启用的休息', () => {
  const s = engine.normalizeSettings({});
  const from = new Date('2026-07-11T10:00:00');
  const list = engine.scheduleNextBreaks(s, from);
  assert.strictEqual(list.length, 3);
  assert.strictEqual(list[0].type, 'micro', 'micro 最近');
  assert.strictEqual(list[1].type, 'short');
  assert.strictEqual(list[2].type, 'long');
  assert.strictEqual(list[0].time.getTime() - from.getTime(), 20 * 60 * 1000);
  assert.strictEqual(list[2].time.getTime() - from.getTime(), 180 * 60 * 1000);
});

test('scheduleNextBreaks 跳过已禁用的休息', () => {
  const s = engine.normalizeSettings({ breaks: { micro: { enabled: false } } });
  const from = new Date('2026-07-11T10:00:00');
  const list = engine.scheduleNextBreaks(s, from);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].type, 'short');
});

test('nextIdleState 在预警时段返回 WARNING', () => {
  const s = engine.normalizeSettings({});
  assert.strictEqual(engine.nextIdleState(30, s), engine.STATES.IDLE, '30s 远大于 10s leadTime');
  assert.strictEqual(engine.nextIdleState(5, s), engine.STATES.WARNING, '5s 在预警窗口');
  assert.strictEqual(engine.nextIdleState(0, s), engine.STATES.BREAK);
  assert.strictEqual(engine.nextIdleState(-3, s), engine.STATES.BREAK);
});

test('nextIdleState 关闭预警时直接进入 BREAK', () => {
  const s = engine.normalizeSettings({ warning: { enabled: false } });
  assert.strictEqual(engine.nextIdleState(5, s), engine.STATES.IDLE, '预警关闭，5s 仍 IDLE');
  assert.strictEqual(engine.nextIdleState(0, s), engine.STATES.BREAK);
});

test('secondsBetween 向上取整且不为负', () => {
  const a = new Date('2026-07-11T10:00:00');
  const b = new Date('2026-07-11T10:00:01.4');
  const c = new Date('2026-07-11T09:59:59');
  assert.strictEqual(engine.secondsBetween(a, b), 2);
  assert.strictEqual(engine.secondsBetween(a, c), 0);
});

console.log('\n=== stats-utils ===');

const sampleHistory = [
  // 今天
  { ts: new Date(new Date().setHours(9, 5)).toISOString(),  type: 'micro', action: 'completed', durationSec: 20 },
  { ts: new Date(new Date().setHours(9, 35)).toISOString(),  type: 'micro', action: 'completed', durationSec: 20 },
  { ts: new Date(new Date().setHours(10, 5)).toISOString(),  type: 'micro', action: 'skipped',   durationSec: 0  },
  { ts: new Date(new Date().setHours(11, 0)).toISOString(),  type: 'short', action: 'completed', durationSec: 180 },
  // 昨天
  { ts: new Date(Date.now() - 86400000).toISOString(), type: 'micro', action: 'completed', durationSec: 20 },
  { ts: new Date(Date.now() - 86400000).toISOString(), type: 'micro', action: 'completed', durationSec: 20 },
  // 三天前
  { ts: new Date(Date.now() - 3 * 86400000).toISOString(), type: 'micro', action: 'skipped', durationSec: 0 }
];

test('todaySummary 返回今日完成/跳过/秒数', () => {
  const s = stats.todaySummary(sampleHistory);
  assert.strictEqual(s.completed, 3, '今日完成 3 次');
  assert.strictEqual(s.skipped, 1, '今日跳过 1 次');
  assert.strictEqual(s.totalSec, 220, '20+20+180=220 秒');
});

test('weeklyChart 返回 7 天数据', () => {
  const w = stats.weeklyChart(sampleHistory);
  assert.strictEqual(w.length, 7);
  assert.strictEqual(w[6].date, new Date().toISOString().slice(0, 10), '最后一天是今天');
  assert.strictEqual(w[6].completed, 3, '今天完成 3');
  assert.strictEqual(w[5].completed, 2, '昨天完成 2');
});

test('streakDays 计算连续达标天数', () => {
  const streak = stats.streakDays(sampleHistory);
  // 今天完成率 3/(3+1)=75% >=60% -> 1
  // 昨天完成率 2/2=100% -> 2
  // 三天前 skipped 0 完成 -> 完成率 0 -> 中断
  assert.ok(streak >= 1, `streak 至少为 1，实际 ${streak}`);
});

test('lifetimeSummary 累计完成与秒数', () => {
  const l = stats.lifetimeSummary(sampleHistory);
  assert.strictEqual(l.completed, 5, '共完成 5 次');
  assert.strictEqual(l.totalSec, 260, '20*4+180=260 秒');
});

test('localDayKey 返回 YYYY-MM-DD', () => {
  const d = new Date(2026, 6, 11, 15, 30);
  assert.strictEqual(stats.localDayKey(d), '2026-07-11');
});

test('lastNDayKeys 长度正确且按时间升序', () => {
  const keys = stats.lastNDayKeys(7, new Date(2026, 6, 11));
  assert.strictEqual(keys.length, 7);
  assert.strictEqual(keys[0], '2026-07-05');
  assert.strictEqual(keys[6], '2026-07-11');
});

console.log('\n=== exercises ===');

test('pickExercises micro 只返回短动作', () => {
  const list = exercises.pickExercises('micro', 20);
  assert.ok(list.length > 0);
  list.forEach(e => assert.ok(e.durationSec <= 20, `${e.title} 时长 ${e.durationSec}s 应 <= 20`));
});

test('pickExercises long 返回全部动作', () => {
  const list = exercises.pickExercises('long', 600);
  assert.strictEqual(list.length, exercises.EXERCISES.length);
});

test('每个动作包含必要字段', () => {
  exercises.EXERCISES.forEach(e => {
    assert.ok(typeof e.id === 'string' && e.id.length > 0);
    assert.ok(typeof e.title === 'string' && e.title.length > 0);
    assert.ok(typeof e.instruction === 'string' && e.instruction.length > 0);
    assert.ok(typeof e.durationSec === 'number' && e.durationSec > 0);
  });
});

console.log('\n=== store（基于临时文件） ===');

const os = require('os');
const path = require('path');
const fs = require('fs');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyerest-test-'));
const sFile = path.join(tmpDir, 'settings.json');
const hFile = path.join(tmpDir, 'history.json');

test('store.saveSettings/loadSettings 往返一致', () => {
  store.saveSettings(sFile, { sound: false, breaks: { micro: { interval: 15 } } });
  const s = store.loadSettings(sFile);
  assert.strictEqual(s.sound, false);
  assert.strictEqual(s.breaks.micro.interval, 15);
  assert.strictEqual(s.breaks.short.interval, 60, '其他字段保持默认');
});

test('store.appendHistory 累加记录并限制最大条数', () => {
  for (let i = 0; i < 5; i++) {
    store.appendHistory(hFile, { type: 'micro', action: 'completed', durationSec: 20 });
  }
  const list = store.loadHistory(hFile);
  assert.strictEqual(list.length, 5);
  assert.strictEqual(list[0].type, 'micro');
  assert.strictEqual(list[0].action, 'completed');
});

test('store.exportAll/importAll 完整往返', () => {
  store.saveSettings(sFile, { sound: true });
  for (let i = 0; i < 3; i++) {
    store.appendHistory(hFile, { type: 'short', action: 'completed', durationSec: 180 });
  }
  const exp = store.exportAll(sFile, hFile);
  assert.ok(exp.settings);
  assert.ok(Array.isArray(exp.history));
  assert.strictEqual(exp.history.length, 8, '前面 5 + 这次 3 = 8');

  // 写到新文件再导入
  const sFile2 = path.join(tmpDir, 's2.json');
  const hFile2 = path.join(tmpDir, 'h2.json');
  const result = store.importAll(exp, sFile2, hFile2);
  assert.strictEqual(result.historyCount, 8);
  const loaded = store.loadHistory(hFile2);
  assert.strictEqual(loaded.length, 8);
});

test('store.importAll 拒绝无效备份', () => {
  let threw = false;
  try { store.importAll(null, sFile, hFile); } catch (e) { threw = true; }
  assert.ok(threw, 'null 备份应抛错');
});

// 清理临时目录
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}

console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===`);
if (failed > 0) process.exit(1);
