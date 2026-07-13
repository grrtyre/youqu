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

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===');
if (fail > 0) process.exit(1);
