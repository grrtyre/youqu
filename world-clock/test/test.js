// test/test.js
// 世界时钟核心逻辑测试 —— Node 运行：node test/test.js
// 用断言验证时区偏移、格式化、工作时段重叠等关键函数

const assert = require('assert');
const core = require('../timezone-core.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('\n=== 世界时钟核心逻辑测试 ===\n');

// 固定一个测试时刻：UTC 2026-07-05 04:00:00（北京 12:00，伦敦 05:00 后夏令时=UTC+1→06:00，纽约夏令时=UTC-4→00:00）
const T = new Date(Date.UTC(2026, 6, 5, 4, 0, 0));

test('北京时区偏移为 +480 分钟（UTC+8）', () => {
  const off = core.getOffsetMinutes('Asia/Shanghai', T);
  assert.strictEqual(off, 480, '北京应为 UTC+8，实际 ' + off);
});

test('东京时区偏移为 +540 分钟（UTC+9）', () => {
  const off = core.getOffsetMinutes('Asia/Tokyo', T);
  assert.strictEqual(off, 540, '东京应为 UTC+9，实际 ' + off);
});

test('伦敦 7 月夏令时偏移为 +60 分钟（UTC+1）', () => {
  const off = core.getOffsetMinutes('Europe/London', T);
  assert.strictEqual(off, 60, '伦敦 7 月应 UTC+1，实际 ' + off);
});

test('纽约 7 月夏令时偏移为 -240 分钟（UTC-4）', () => {
  const off = core.getOffsetMinutes('America/New_York', T);
  assert.strictEqual(off, -240, '纽约 7 月应 UTC-4，实际 ' + off);
});

test('伦敦 1 月非夏令时偏移为 0 分钟（UTC+0）', () => {
  const winter = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
  const off = core.getOffsetMinutes('Europe/London', winter);
  assert.strictEqual(off, 0, '伦敦 1 月应 UTC+0，实际 ' + off);
});

test('formatOffset 把 480 转成 "UTC+8"', () => {
  assert.strictEqual(core.formatOffset(480), 'UTC+8');
});

test('formatOffset 把 -240 转成 "UTC-4"', () => {
  assert.strictEqual(core.formatOffset(-240), 'UTC-4');
});

test('formatOffset 把 330 转成 "UTC+5:30"（印度半时区）', () => {
  assert.strictEqual(core.formatOffset(330), 'UTC+5:30');
});

test('北京在测试时刻的小时为 12', () => {
  const h = core.getHoursInZone('Asia/Shanghai', T);
  assert.strictEqual(h, 12, '北京应为 12:00，实际小时 ' + h);
});

test('纽约在测试时刻的小时为 0（午夜）', () => {
  const h = core.getHoursInZone('America/New_York', T);
  assert.strictEqual(h, 0, '纽约应为 00:00，实际小时 ' + h);
});

test('formatInZone 北京测试时刻格式化为 "12:00"', () => {
  assert.strictEqual(core.formatInZone('Asia/Shanghai', T, 'HH:mm'), '12:00');
});

test('formatInZone 北京测试时刻格式化为 "2026-07-05 12:00:00"', () => {
  assert.strictEqual(core.formatInZone('Asia/Shanghai', T, 'YYYY-MM-DD HH:mm:ss'), '2026-07-05 12:00:00');
});

test('北京 12:00 为白天', () => {
  assert.strictEqual(core.isDaytime('Asia/Shanghai', T), true);
});

test('纽约 00:00 为夜晚', () => {
  assert.strictEqual(core.isDaytime('America/New_York', T), false);
});

test('北京比纽约快 12 小时（夏令时）', () => {
  const diff = core.getHourDiff('Asia/Shanghai', 'America/New_York', T);
  assert.strictEqual(diff, 12, '北京-纽约应差 12 小时（夏令时），实际 ' + diff);
});

test('北京比东京慢 1 小时', () => {
  const diff = core.getHourDiff('Asia/Shanghai', 'Asia/Tokyo', T);
  assert.strictEqual(diff, -1, '北京-东京应 -1，实际 ' + diff);
});

// 工作时段转 UTC：北京 9-18 (UTC+8) → UTC 1-10
test('北京 9-18 工作时段转 UTC 为 1:00-10:00', () => {
  const r = core.workHoursToUTC('Asia/Shanghai', { start: 9, end: 18 }, T);
  assert.strictEqual(r.startUTC, 60, 'startUTC 应 60，实际 ' + r.startUTC);
  assert.strictEqual(r.endUTC, 600, 'endUTC 应 600，实际 ' + r.endUTC);
});

// 纽约 9-18 (UTC-4 夏令时) → UTC 13-22
test('纽约 9-18 工作时段转 UTC 为 13:00-22:00（夏令时）', () => {
  const r = core.workHoursToUTC('America/New_York', { start: 9, end: 18 }, T);
  assert.strictEqual(r.startUTC, 13 * 60, 'startUTC 应 780，实际 ' + r.startUTC);
  assert.strictEqual(r.endUTC, 22 * 60, 'endUTC 应 1320，实际 ' + r.endUTC);
});

// 北京和纽约 9-18 无重叠（北京 UTC1-10，纽约 UTC13-22）
test('北京+纽约 9-18 工作时段无重叠', () => {
  const zones = [
    { city: '北京', tz: 'Asia/Shanghai' },
    { city: '纽约', tz: 'America/New_York' },
  ];
  const overlap = core.computeOverlap(zones, { start: 9, end: 18 }, T);
  assert.strictEqual(overlap.length, 0, '应无重叠，实际 ' + JSON.stringify(overlap));
});

// 北京和伦敦 9-18：北京 UTC1-10，伦敦夏令时 UTC8-17 → 重叠 UTC8-10（即北京16-18，伦敦9-11）
test('北京+伦敦 9-18 工作时段重叠为 UTC 8:00-10:00', () => {
  const zones = [
    { city: '北京', tz: 'Asia/Shanghai' },
    { city: '伦敦', tz: 'Europe/London' },
  ];
  const overlap = core.computeOverlap(zones, { start: 9, end: 18 }, T);
  assert.strictEqual(overlap.length, 1, '应有 1 段重叠，实际 ' + overlap.length);
  assert.strictEqual(overlap[0].startUTC, 8 * 60, 'startUTC 应 480，实际 ' + overlap[0].startUTC);
  assert.strictEqual(overlap[0].endUTC, 10 * 60, 'endUTC 应 600，实际 ' + overlap[0].endUTC);
});

// 三个同半小时区应全天重叠
test('北京+上海+深圳（同时区）9-18 重叠为 UTC 1:00-10:00', () => {
  const zones = [
    { city: '北京', tz: 'Asia/Shanghai' },
    { city: '上海', tz: 'Asia/Shanghai' },
    { city: '深圳', tz: 'Asia/Shanghai' },
  ];
  const overlap = core.computeOverlap(zones, { start: 9, end: 18 }, T);
  assert.strictEqual(overlap.length, 1, '应有 1 段重叠');
  assert.strictEqual(overlap[0].startUTC, 60);
  assert.strictEqual(overlap[0].endUTC, 600);
});

// UTC 分钟 → 北京墙上时间：UTC 8:00 → 北京 16:00
test('UTC 8:00 转北京时间为 16:00', () => {
  assert.strictEqual(core.utcMinutesToZoneTime(8 * 60, 'Asia/Shanghai', T), '16:00');
});

// UTC 分钟 → 纽约墙上时间：UTC 8:00 → 纽约 04:00（夏令时 UTC-4）
test('UTC 8:00 转纽约时间为 04:00（夏令时）', () => {
  assert.strictEqual(core.utcMinutesToZoneTime(8 * 60, 'America/New_York', T), '04:00');
});

// 时间戳转换：用 Date.UTC 计算正确时间戳，避免硬编码错误
// UTC 2026-07-05 12:00:00 → 北京 2026-07-05 20:00:00
const TS_SEC = Math.floor(Date.UTC(2026, 6, 5, 12, 0, 0) / 1000);
const TS_MS = TS_SEC * 1000;

test('时间戳 ' + TS_SEC + '（UTC 2026-07-05 12:00）转北京为 2026-07-05 20:00:00', () => {
  assert.strictEqual(core.convertTimestamp(TS_SEC, 'Asia/Shanghai', 'YYYY-MM-DD HH:mm:ss'), '2026-07-05 20:00:00');
});

test('时间戳秒/毫秒自动识别（同结果）', () => {
  const a = core.convertTimestamp(TS_SEC, 'Asia/Shanghai', 'HH:mm');
  const b = core.convertTimestamp(TS_MS, 'Asia/Shanghai', 'HH:mm');
  assert.strictEqual(a, b);
  assert.strictEqual(a, '20:00');
});

// ISO 转换
test('ISO 字符串 "2026-07-05T12:00:00Z" 转北京为 20:00', () => {
  assert.strictEqual(core.convertISO('2026-07-05T12:00:00Z', 'Asia/Shanghai', 'HH:mm'), '20:00');
});

test('非法 ISO 返回空串', () => {
  assert.strictEqual(core.convertISO('not-a-date', 'Asia/Shanghai', 'HH:mm'), '');
});

// parseLocalInput：北京墙上 2026-07-05 14:30 → UTC 06:30
test('parseLocalInput 北京 14:30 → UTC 06:30:00', () => {
  const d = core.parseLocalInput('2026-07-05T14:30', 'Asia/Shanghai');
  assert.ok(d instanceof Date, '应返回 Date');
  // UTC 应为 06:30
  assert.strictEqual(d.getUTCMinutes(), 30);
  assert.strictEqual(d.getUTCHours(), 6);
});

test('parseLocalInput 非法输入返回 null', () => {
  assert.strictEqual(core.parseLocalInput('abc', 'Asia/Shanghai'), null);
});

// 时区清单完整性
test('常用时区清单不少于 40 个城市', () => {
  assert.ok(core.COMMON_TIMEZONES.length >= 40, '时区数 ' + core.COMMON_TIMEZONES.length);
});

test('默认选中时区为 5 个', () => {
  assert.strictEqual(core.DEFAULT_ZONES.length, 5);
});

test('默认工作时段为 9-18', () => {
  assert.strictEqual(core.DEFAULT_WORK_HOURS.start, 9);
  assert.strictEqual(core.DEFAULT_WORK_HOURS.end, 18);
});

console.log('\n----------------------------------------');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('----------------------------------------\n');
process.exit(fail > 0 ? 1 : 0);
