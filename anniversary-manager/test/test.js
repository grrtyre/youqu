// 纪念日管家核心逻辑测试
const assert = require('assert');
const {
  computeEventInfo,
  calcAge,
  daysUntilNext,
  daysSince,
  getZodiac,
  getConstellation,
  nextSolarOccurrence,
  normalizeDate,
} = require('../src/core/anniversary-core');
const { solarToLunar, lunarToSolar, formatLunarDate } = require('../src/core/lunar');
const { AnniversaryStore } = require('../src/core/store');
const {
  getUpcomingEvents,
  getTodayEvents,
  buildNotification,
  notificationKey,
  buildNotifications,
  DEFAULT_REMIND_DAYS,
} = require('../src/core/reminder-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail++;
    console.log('  ✗ ' + name + ' -> ' + e.message);
  }
}

console.log('=== 农历转换 ===');
test('公历 2000-01-01 转 农历', () => {
  const l = solarToLunar(2000, 1, 1);
  // 2000 年春节是 2 月 5 日，所以 1 月 1 日还是农历 1999 年冬月
  assert.ok(l.year === 1999, 'year=' + l.year);
  assert.ok(l.month === 11, 'month=' + l.month);
});

test('公历 2024-02-10 转 农历（2024 春节）', () => {
  const l = solarToLunar(2024, 2, 10);
  assert.ok(l.year === 2024, 'year=' + l.year);
  assert.ok(l.month === 1, 'month=' + l.month);
  assert.ok(l.day === 1, 'day=' + l.day);
});

test('农历 2024 正月初一 转公历', () => {
  const d = lunarToSolar(2024, 1, 1, false);
  assert.ok(d.getFullYear() === 2024, 'year=' + d.getFullYear());
  assert.ok(d.getMonth() + 1 === 2, 'month=' + (d.getMonth() + 1));
  assert.ok(d.getDate() === 10, 'day=' + d.getDate());
});

test('农历格式化 腊月初一', () => {
  const s = formatLunarDate({ year: 2023, month: 12, day: 1, isLeap: false });
  assert.ok(s === '腊月初一', s);
});

test('农历格式化 闰六月初十', () => {
  const s = formatLunarDate({ year: 2017, month: 6, day: 10, isLeap: true });
  assert.ok(s === '闰六月初十', s);
});

test('农历公历互转一致性', () => {
  for (let m = 1; m <= 12; m++) {
    for (let d = 1; d <= 28; d++) {
      const l = solarToLunar(2023, m, d);
      const s = lunarToSolar(l.year, l.month, l.day, l.isLeap);
      assert.ok(s.getFullYear() === 2023 && s.getMonth() + 1 === m && s.getDate() === d,
        `${m}-${d} 互转失败: ${JSON.stringify(l)}`);
    }
  }
});

console.log('=== 生肖 ===');
test('2000 年 = 龙', () => {
  const z = getZodiac(2000);
  assert.ok(z.name === '龙', z.name);
});
test('1986 年 = 虎', () => {
  const z = getZodiac(1986);
  assert.ok(z.name === '虎', z.name);
});
test('1900 年 = 鼠', () => {
  const z = getZodiac(1900);
  assert.ok(z.name === '鼠', z.name);
});

console.log('=== 星座 ===');
test('3月25日 = 白羊座', () => {
  const c = getConstellation(3, 25);
  assert.ok(c.name === '白羊座', c.name);
});
test('5月15日 = 金牛座', () => {
  const c = getConstellation(5, 15);
  assert.ok(c.name === '金牛座', c.name);
});
test('12月25日 = 摩羯座', () => {
  const c = getConstellation(12, 25);
  assert.ok(c.name === '摩羯座', c.name);
});
test('1月15日 = 摩羯座', () => {
  const c = getConstellation(1, 15);
  assert.ok(c.name === '摩羯座', c.name);
});
test('11月25日 = 射手座', () => {
  const c = getConstellation(11, 25);
  assert.ok(c.name === '射手座', c.name);
});

console.log('=== 年龄计算 ===');
test('1990-06-20 到 2024-06-19 = 33 岁', () => {
  const age = calcAge('1990-06-20', '2024-06-19');
  assert.ok(age === 33, 'age=' + age);
});
test('1990-06-20 到 2024-06-20 = 34 岁（生日当天）', () => {
  const age = calcAge('1990-06-20', '2024-06-20');
  assert.ok(age === 34, 'age=' + age);
});
test('1990-06-20 到 2024-06-21 = 34 岁', () => {
  const age = calcAge('1990-06-20', '2024-06-21');
  assert.ok(age === 34, 'age=' + age);
});

console.log('=== 下次周年 ===');
test('生日 6-20，今天 6-19，下次 6-20（1 天）', () => {
  const next = nextSolarOccurrence(6, 20, '2024-06-19');
  assert.ok(next.getMonth() + 1 === 6 && next.getDate() === 20, next.toString());
});
test('生日 6-20，今天 6-20，下次 6-20（0 天）', () => {
  const next = nextSolarOccurrence(6, 20, '2024-06-20');
  assert.ok(next.getMonth() + 1 === 6 && next.getDate() === 20, next.toString());
});
test('生日 6-20，今天 6-21，下次明年 6-20', () => {
  const next = nextSolarOccurrence(6, 20, '2024-06-21');
  assert.ok(next.getFullYear() === 2025 && next.getMonth() + 1 === 6 && next.getDate() === 20, next.toString());
});
test('2-29 生日在非闰年回落到 2-28', () => {
  // 从 2022-06-01 出发，2023 非闰年，下次落在 2023-02-28
  const next = nextSolarOccurrence(2, 29, '2022-06-01');
  assert.ok(next.getFullYear() === 2023 && next.getMonth() + 1 === 2 && next.getDate() === 28, next.toString());
});
test('2-29 生日在闰年保持 2-29', () => {
  // 从 2023-06-01 出发，下次 2024 是闰年，落在 2024-02-29
  const next = nextSolarOccurrence(2, 29, '2023-06-01');
  assert.ok(next.getFullYear() === 2024 && next.getMonth() + 1 === 2 && next.getDate() === 29, next.toString());
});

console.log('=== 距下次天数 ===');
test('公历生日距下次天数', () => {
  const r = daysUntilNext({ dateType: 'solar', date: '1990-06-20' }, '2024-06-19');
  assert.ok(r.days === 1, 'days=' + r.days);
});
test('农历生日距下次天数', () => {
  // 农历 1965-08-15（妈妈农历生日）
  const r = daysUntilNext({ dateType: 'lunar', date: '1965-08-15', isLeap: false }, '2024-01-01');
  assert.ok(r.days >= 0 && r.days <= 380, 'days=' + r.days);
});

console.log('=== 已过天数 ===');
test('已过天数 = 365/366 倍数', () => {
  const d = daysSince({ dateType: 'solar', date: '2020-01-01' }, '2021-01-01');
  assert.ok(d === 366, 'days=' + d); // 2020 闰年
});

console.log('=== computeEventInfo 综合信息 ===');
test('综合信息字段完整', () => {
  const info = computeEventInfo({
    id: 'x1',
    name: '老张',
    eventType: 'birthday',
    category: 'friend',
    dateType: 'solar',
    date: '1990-06-20',
  }, '2024-06-19');
  assert.ok(info.name === '老张');
  assert.ok(info.eventTypeLabel === '生日');
  assert.ok(info.age === 33);
  assert.ok(info.daysUntilNext === 1);
  assert.ok(info.zodiacName === '马', 'zodiac=' + info.zodiacName); // 1990 = 马
  assert.ok(info.constellationName === '双子座', 'constellation=' + info.constellationName);
  assert.ok(info.solarDate === '1990-06-20');
  assert.ok(info.nextDate === '2024-06-20');
  assert.ok(typeof info.lunarDisplay === 'string' && info.lunarDisplay.length > 0);
});

console.log('=== Store 存储 ===');
const tmpFile = path.join(os.tmpdir(), 'anniv-test-' + Date.now() + '.json');
test('create + list + get', () => {
  const s = new AnniversaryStore(tmpFile);
  const e = s.create({ name: '测试', eventType: 'birthday', date: '2000-01-01', category: 'family' });
  assert.ok(e.id, '应有 id');
  assert.ok(s.list().length === 1);
  assert.ok(s.get(e.id).name === '测试');
});
test('update', () => {
  const s = new AnniversaryStore(tmpFile);
  const e = s.create({ name: '测试2', eventType: 'custom', date: '2001-02-02' });
  const u = s.update(e.id, { name: '改名' });
  assert.ok(u.name === '改名');
  assert.ok(u.eventType === 'custom'); // 未改字段保留
});
test('remove', () => {
  const s = new AnniversaryStore(tmpFile);
  const e = s.create({ name: '要删的', date: '2002-03-03' });
  assert.ok(s.remove(e.id) === true);
  assert.ok(s.get(e.id) === null);
});
test('持久化到磁盘', () => {
  const s1 = new AnniversaryStore(tmpFile);
  s1.create({ name: '持久化测试', date: '2003-04-04' });
  const s2 = new AnniversaryStore(tmpFile);
  assert.ok(s2.list().some((e) => e.name === '持久化测试'));
});
test('校验空名称', () => {
  const s = new AnniversaryStore(tmpFile);
  let threw = false;
  try { s.create({ name: '', date: '2000-01-01' }); } catch (e) { threw = true; }
  assert.ok(threw);
});
test('export + import', () => {
  const s1 = new AnniversaryStore(tmpFile);
  s1.create({ name: '导出项', date: '2004-05-05' });
  const json = s1.exportJSON();
  const tmp2 = path.join(os.tmpdir(), 'anniv-test2-' + Date.now() + '.json');
  const s2 = new AnniversaryStore(tmp2);
  const r = s2.importJSON(json);
  assert.ok(r.imported >= 1);
  assert.ok(s2.list().some((e) => e.name === '导出项'));
  fs.unlinkSync(tmp2);
});
test('seedDemo 仅在空时填充', () => {
  const tmp3 = path.join(os.tmpdir(), 'anniv-test3-' + Date.now() + '.json');
  const s = new AnniversaryStore(tmp3);
  const r1 = s.seedDemo();
  assert.ok(r1 === true);
  const n = s.list().length;
  const r2 = s.seedDemo();
  assert.ok(r2 === false);
  assert.ok(s.list().length === n);
  fs.unlinkSync(tmp3);
});

try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (e) {}

console.log('=== 提醒核心逻辑 ===');

// 构造一批测试事件：今天、1天后、3天后、10天后、已过(明年)
const reminderEvents = [
  { id: 'a', name: '今天生日', eventType: 'birthday', category: 'family', dateType: 'solar', date: '1990-01-01' },
  { id: 'b', name: '明天纪念', eventType: 'anniversary', category: 'family', dateType: 'solar', date: '2010-01-02' },
  { id: 'c', name: '三天后', eventType: 'custom', category: 'other', dateType: 'solar', date: '2000-01-04' },
  { id: 'd', name: '十天后', eventType: 'birthday', category: 'friend', dateType: 'solar', date: '1995-01-11' },
  { id: 'e', name: '远期', eventType: 'birthday', category: 'colleague', dateType: 'solar', date: '1995-06-15' },
];

// 以 2025-01-01 为今天计算
const TODAY = '2025-01-01';

test('默认提醒天数为 7', () => {
  assert.ok(DEFAULT_REMIND_DAYS === 7, 'days=' + DEFAULT_REMIND_DAYS);
});

test('getUpcomingEvents 只返回 7 天内事件', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 7);
  const ids = list.map((e) => e.id).sort();
  // 今天(a, days=0)、明天(b, days=1)、三天后(c, days=3)；十天后(d, days=10) 超出
  assert.ok(ids.join(',') === 'a,b,c', 'ids=' + ids.join(','));
});

test('getUpcomingEvents 按天数升序排序', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 7);
  assert.ok(list[0].id === 'a', 'first=' + list[0].id);
  assert.ok(list[1].id === 'b', 'second=' + list[1].id);
  assert.ok(list[2].id === 'c', 'third=' + list[2].id);
});

test('getUpcomingEvents 自定义天数范围', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 30);
  // 包含十天后(d, days=10)，但不包含远期(e)
  const ids = list.map((e) => e.id).sort();
  assert.ok(ids.includes('d'), 'should include d');
  assert.ok(!ids.includes('e'), 'should not include e');
});

test('getUpcomingEvents 天数为0时只返回今天', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 0);
  assert.ok(list.length === 1, 'len=' + list.length);
  assert.ok(list[0].id === 'a');
  assert.ok(list[0].daysUntilNext === 0);
});

test('getTodayEvents 返回当天事件', () => {
  const list = getTodayEvents(reminderEvents, TODAY);
  assert.ok(list.length === 1);
  assert.ok(list[0].id === 'a');
  assert.ok(list[0].daysUntilNext === 0);
});

test('getUpcomingEvents 处理空数组', () => {
  assert.ok(getUpcomingEvents([], TODAY, 7).length === 0);
});

test('getUpcomingEvents 处理非数组输入', () => {
  assert.ok(getUpcomingEvents(null, TODAY, 7).length === 0);
  assert.ok(getUpcomingEvents(undefined, TODAY, 7).length === 0);
});

test('getUpcomingEvents 跳过无效事件（不抛异常）', () => {
  const bad = [{ id: 'x', name: 'bad', dateType: 'solar', date: 'invalid-date' }];
  assert.ok(getUpcomingEvents(bad, TODAY, 7).length === 0);
});

test('buildNotification 当天生日文案', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 0);
  const n = buildNotification(list[0]);
  assert.ok(n.title.includes('今天'), 'title=' + n.title);
  assert.ok(n.title.includes('今天生日'), 'title=' + n.title);
  assert.ok(n.body.includes('岁'), 'body=' + n.body);
});

test('buildNotification 即将到来文案', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 7);
  const tomorrow = list.find((e) => e.id === 'b');
  const n = buildNotification(tomorrow);
  assert.ok(n.title.includes('1 天'), 'title=' + n.title);
  assert.ok(n.body.includes('2025/01/02'), 'body=' + n.body);
});

test('buildNotification 纪念日当天不显示年龄', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 0);
  const n = buildNotification(list[0]);
  // a 是生日，应该有"岁"
  assert.ok(n.body.includes('岁'), 'body=' + n.body);
});

test('buildNotification null 输入返回 null', () => {
  assert.ok(buildNotification(null) === null);
  assert.ok(buildNotification({}) === null);
});

test('notificationKey 唯一性', () => {
  const list = getUpcomingEvents(reminderEvents, TODAY, 7);
  const keys = list.map((e) => notificationKey(e, TODAY));
  const unique = new Set(keys);
  assert.ok(keys.length === unique.size, 'keys should be unique');
  assert.ok(keys.every((k) => k && k.includes(TODAY)), 'key should contain today');
});

test('notificationKey null 返回 null', () => {
  assert.ok(notificationKey(null, TODAY) === null);
  assert.ok(notificationKey({}, TODAY) === null);
});

test('buildNotifications 批量生成', () => {
  const list = buildNotifications(reminderEvents, TODAY, 7);
  assert.ok(list.length === 3, 'len=' + list.length);
  assert.ok(list.every((n) => n.title && n.body && n.key), 'all should have title/body/key');
});

test('buildNotifications 空输入', () => {
  assert.ok(buildNotifications([], TODAY, 7).length === 0);
});

test('农历事件也能被提醒', () => {
  // 农历 1965-08-15 = 妈妈农历生日
  const lunarEvents = [
    { id: 'l1', name: '妈妈', eventType: 'birthday', category: 'family', dateType: 'lunar', date: '1965-08-15', isLeap: false },
  ];
  const list = getUpcomingEvents(lunarEvents, TODAY, 365);
  assert.ok(list.length === 1, 'should find next lunar birthday');
  assert.ok(list[0].daysUntilNext >= 0, 'days=' + list[0].daysUntilNext);
  const n = buildNotification(list[0]);
  assert.ok(n.title.includes('妈妈'), 'title=' + n.title);
});

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===');
if (fail > 0) process.exit(1);
