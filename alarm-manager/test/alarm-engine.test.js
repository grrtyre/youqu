// 闹钟管家 - alarm-engine 单元测试
const { test, describe } = require('node:test');
const assert = require('node:assert');
const engine = require('../src/alarm-engine.js');

describe('nextTrigger - 一次性闹钟', () => {
  test('今天时刻未到，返回今天', () => {
    const now = new Date(2026, 6, 14, 7, 0, 0).getTime();  // 2026-07-14 07:00
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'once' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 6, 14, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('今天时刻已过，返回 null', () => {
    const now = new Date(2026, 6, 14, 10, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'once' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    assert.strictEqual(alarm.nextTrigger, null);
  });

  test('禁用的闹钟永远返回 null', () => {
    const now = new Date(2026, 6, 14, 7, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, enabled: false, repeat: { type: 'once' } });
    assert.strictEqual(alarm.nextTrigger, null);
  });
});

describe('nextTrigger - 每天', () => {
  test('今天时刻未到，返回今天', () => {
    const now = new Date(2026, 6, 14, 7, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'daily' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 6, 14, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('今天时刻已过，返回明天', () => {
    const now = new Date(2026, 6, 14, 10, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'daily' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 6, 15, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });
});

describe('nextTrigger - 工作日', () => {
  test('周五 10 点设 8:30，下个工作日是周一', () => {
    // 2026-07-17 是周五
    const now = new Date(2026, 6, 17, 10, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'weekdays' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    // 下周一 2026-07-20 08:30
    const expected = new Date(2026, 6, 20, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('周一 7:00 设 8:30，今天还会响', () => {
    // 2026-07-13 是周一
    const now = new Date(2026, 6, 13, 7, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'weekdays' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 6, 13, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('周六 7:00 设 8:30（周末模式），今天还会响', () => {
    // 2026-07-18 是周六
    const now = new Date(2026, 6, 18, 7, 0, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'weekend' } });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 6, 18, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });
});

describe('nextTrigger - 自定义周几', () => {
  test('每周一三五 8:30', () => {
    // 2026-07-14 是周二 10:00，下次应该是周三 8:30
    const now = new Date(2026, 6, 14, 10, 0, 0).getTime();
    const alarm = engine.createAlarm({
      hour: 8, minute: 30,
      repeat: { type: 'custom', weekdays: [1, 3, 5] }
    });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    // 2026-07-15 周三
    const expected = new Date(2026, 6, 15, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('空 weekdays 返回 null', () => {
    const now = Date.now();
    const alarm = engine.createAlarm({
      hour: 8, minute: 30,
      repeat: { type: 'custom', weekdays: [] }
    });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    assert.strictEqual(alarm.nextTrigger, null);
  });
});

describe('nextTrigger - 农历年度', () => {
  test('2026 年中秋（农历八月十五）应在 2026-09-25', () => {
    // 已知 2026 年中秋公历日期为 9 月 25 日
    // 在 2026-01-01 之后查找，应该命中 2026 年的中秋
    const now = new Date(2026, 0, 1).getTime();
    const alarm = engine.createAlarm({
      hour: 12, minute: 0,
      repeat: { type: 'lunar-annual', lunarMonth: 8, lunarDay: 15, isLeap: false }
    });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 8, 25, 12, 0, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });

  test('2026 年春节（农历正月初一）应在 2026-02-17', () => {
    // 已知 2026 年春节公历为 2 月 17 日
    const now = new Date(2026, 0, 1).getTime();
    const alarm = engine.createAlarm({
      hour: 0, minute: 0,
      repeat: { type: 'lunar-annual', lunarMonth: 1, lunarDay: 1, isLeap: false }
    });
    alarm.nextTrigger = engine.nextTrigger(alarm, now);
    const expected = new Date(2026, 1, 17, 0, 0, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });
});

describe('shouldFire', () => {
  test('nextTrigger 在 [lastCheck, now] 内 → true', () => {
    const now = 1000000;
    const alarm = { enabled: true, nextTrigger: 999999, lastTriggered: 990000 };
    assert.strictEqual(engine.shouldFire(alarm, now, 990000), true);
  });

  test('nextTrigger > now → false', () => {
    const now = 1000000;
    const alarm = { enabled: true, nextTrigger: 1100000, lastTriggered: 990000 };
    assert.strictEqual(engine.shouldFire(alarm, now, 990000), false);
  });

  test('nextTrigger < lastCheck → false（防重复触发）', () => {
    const now = 1000000;
    const alarm = { enabled: true, nextTrigger: 980000, lastTriggered: 990000 };
    assert.strictEqual(engine.shouldFire(alarm, now, 990000), false);
  });

  test('禁用 → false', () => {
    const now = 1000000;
    const alarm = { enabled: false, nextTrigger: 999999 };
    assert.strictEqual(engine.shouldFire(alarm, now), false);
  });
});

describe('afterFired', () => {
  test('once 类型触发后 enabled=false', () => {
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'once' } });
    engine.afterFired(alarm, Date.now());
    assert.strictEqual(alarm.enabled, false);
    assert.strictEqual(alarm.nextTrigger, null);
  });

  test('daily 类型触发后 nextTrigger 更新到明天', () => {
    // 2026-07-14 08:30 触发
    const firedAt = new Date(2026, 6, 14, 8, 30, 0).getTime();
    const alarm = engine.createAlarm({ hour: 8, minute: 30, repeat: { type: 'daily' } });
    engine.afterFired(alarm, firedAt);
    assert.strictEqual(alarm.enabled, true);
    // 下一次 = 2026-07-15 08:30
    const expected = new Date(2026, 6, 15, 8, 30, 0).getTime();
    assert.strictEqual(alarm.nextTrigger, expected);
  });
});

describe('snooze', () => {
  test('贪睡成功，nextTrigger 推后', () => {
    const now = 1000000;
    const alarm = { snoozeCount: 0, maxSnoozeCount: 3, snoozeMinutes: 5 };
    const ok = engine.snooze(alarm, now);
    assert.strictEqual(ok, true);
    assert.strictEqual(alarm.snoozeCount, 1);
    assert.strictEqual(alarm.nextTrigger, now + 5 * 60 * 1000);
  });

  test('贪睡次数用尽返回 false', () => {
    const alarm = { snoozeCount: 3, maxSnoozeCount: 3, snoozeMinutes: 5 };
    const ok = engine.snooze(alarm, Date.now());
    assert.strictEqual(ok, false);
  });
});

describe('describeRepeat', () => {
  test('once → 一次性', () => {
    assert.strictEqual(engine.describeRepeat({ type: 'once' }), '一次性');
  });
  test('daily → 每天', () => {
    assert.strictEqual(engine.describeRepeat({ type: 'daily' }), '每天');
  });
  test('weekdays → 工作日', () => {
    assert.strictEqual(engine.describeRepeat({ type: 'weekdays' }), '工作日');
  });
  test('weekend → 周末', () => {
    assert.strictEqual(engine.describeRepeat({ type: 'weekend' }), '周末');
  });
  test('custom', () => {
    const r = engine.describeRepeat({ type: 'custom', weekdays: [1, 3, 5] });
    assert.ok(r.indexOf('一') >= 0 && r.indexOf('三') >= 0 && r.indexOf('五') >= 0);
  });
  test('lunar-annual', () => {
    const r = engine.describeRepeat({ type: 'lunar-annual', lunarMonth: 8, lunarDay: 15, isLeap: false });
    assert.ok(r.indexOf('8月') >= 0);
    assert.ok(r.indexOf('十五') >= 0);
  });
});

describe('describeCountdown', () => {
  test('未来 1 小时 → "1 时 0 分"', () => {
    const now = Date.now();
    const next = now + 3600000;
    const r = engine.describeCountdown(next, now);
    assert.ok(r.indexOf('1') >= 0);
    assert.ok(r.indexOf('时') >= 0);
  });

  test('null → "已停用"', () => {
    assert.strictEqual(engine.describeCountdown(null), '已停用');
  });
});
