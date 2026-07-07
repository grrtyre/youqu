// test.js — 倒计时管家核心逻辑测试
// 运行：node test/test.js

const path = require('path');
const fs = require('fs');
const os = require('os');

// 引用源码（相对 test/ 目录）
const SRC = path.join(__dirname, '..', 'src', 'core');
const {
  solarToLunar, lunarToSolar, daysBetween, formatDate, parseDate, parseFlexible, relativeText
} = require(path.join(SRC, 'date-utils.js'));
const { nextOccurrence } = require(path.join(SRC, 'recurrence.js'));
const store = require(path.join(SRC, 'event-store.js'));

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function approx(a, b, eps) { eps = eps || 0; return Math.abs(a - b) <= eps; }

console.log('\n[1] 日期基础');
{
  const a = new Date(2026, 6, 7);
  const b = new Date(2026, 11, 25);
  assert(daysBetween(a, b) === -171, '2026-07-07 到 2026-12-25 相差 171 天');
  assert(daysBetween(a, a) === 0, '同一天相差 0 天');
  assert(formatDate(a) === '2026-07-07', 'formatDate 格式化正确');
}

console.log('\n[2] 日期解析');
{
  assert(parseFlexible('2026-07-07') !== null, '解析 YYYY-MM-DD');
  assert(parseFlexible('2026/7/7') !== null, '解析 YYYY/M/D');
  assert(parseFlexible('2026年7月7日') !== null, '解析 YYYY年M月D日');
  assert(parseFlexible('hello') === null, '非法输入返回 null');
}

console.log('\n[3] 农历转换');
{
  // 2026 春节（农历正月初一）应是 2026-02-17
  const spring2026 = lunarToSolar(2026, 1, 1, false);
  assert(spring2026 !== null, '农历 2026 正月初一 转换成功');
  assert(formatDate(spring2026) === '2026-02-17', '2026 春节为 2026-02-17');
  // 反向：公历 2026-02-17 应是农历正月初一
  const lunar = solarToLunar(new Date(2026, 1, 17));
  assert(lunar.month === 1 && lunar.day === 1, '公历 2026-02-17 反查为农历正月初一');
  // 2025 中秋（农历八月十五）应是 2025-10-06
  const midAutumn2025 = lunarToSolar(2025, 8, 15, false);
  assert(formatDate(midAutumn2025) === '2025-10-06', '2025 中秋为 2025-10-06');
  // 生肖：2026 是马年（2026-4=2022, 2022%12=6 → 马）
  const zodiac2026 = solarToLunar(new Date(2026, 5, 1));
  assert(zodiac2026.zodiac === '马', '2026 农历年为马年');
}

console.log('\n[4] 重复规则');
{
  // 公历年度重复：生日 1990-08-15，从 2026-07-07 看，下次应是 2026-08-15
  const evt = { date: '1990-08-15', repeat: 'yearly', calendar: 'solar' };
  const next = nextOccurrence(evt, new Date(2026, 6, 7));
  assert(formatDate(next) === '2026-08-15', '公历生日年度重复：2026-08-15');
  // 从 2026-12-01 看，下次应是 2027-08-15
  const next2 = nextOccurrence(evt, new Date(2026, 11, 1));
  assert(formatDate(next2) === '2027-08-15', '跨年：下次为 2027-08-15');
  // 农历年度重复：春节
  const evtLunar = { date: '2026-02-17', repeat: 'yearly', calendar: 'lunar' };
  const nextL = nextOccurrence(evtLunar, new Date(2026, 6, 7));
  assert(formatDate(nextL) === '2027-02-06', '农历春节重复：2027-02-06');
  // 不重复
  const evtNone = { date: '2026-07-07', repeat: 'none', calendar: 'solar' };
  const nextN = nextOccurrence(evtNone, new Date(2026, 6, 7));
  assert(formatDate(nextN) === '2026-07-07', '不重复返回原日期');
}

console.log('\n[5] 事件存储 CRUD');
{
  const tmp = path.join(os.tmpdir(), 'cd-test-' + Date.now() + '.json');
  let events = [];
  const e1 = store.add(events, { title: '考试', date: '2026-12-25', repeat: 'none' });
  assert(events.length === 1, '新增事件成功');
  assert(e1.id && e1.title === '考试', '事件字段正确');
  store.add(events, { title: '生日', date: '1990-08-15', repeat: 'yearly' });
  assert(events.length === 2, '新增第二个事件');
  const updated = store.update(events, e1.id, { title: '期末考试' });
  assert(updated.title === '期末考试', '更新事件成功');
  assert(store.remove(events, e1.id) === true, '删除事件成功');
  assert(events.length === 1, '删除后剩 1 个事件');
  // 持久化
  store.save(events, tmp);
  const loaded = store.load(tmp);
  assert(loaded.length === 1, '保存后重新加载成功');
  assert(loaded[0].title === '生日', '加载字段正确');
  fs.unlinkSync(tmp);
}

console.log('\n[6] 排序与状态计算');
{
  const today = new Date(2026, 6, 7);
  const events = [
    store.normalizeEvent({ title: '过去', date: '2020-01-01', repeat: 'none' }),
    store.normalizeEvent({ title: '未来B', date: '2026-12-31', repeat: 'none' }),
    store.normalizeEvent({ title: '未来A', date: '2026-07-10', repeat: 'none' }),
    store.normalizeEvent({ title: '置顶', date: '2030-01-01', repeat: 'none', pinned: true }),
  ];
  const sorted = store.sortEvents(events, today);
  assert(sorted[0].event.title === '置顶', '置顶事件排第一');
  assert(sorted[1].event.title === '未来A', '未来最近事件排第二');
  assert(sorted[2].event.title === '未来B', '未来较远事件排第三');
  assert(sorted[3].event.title === '过去', '过去事件排最后');
}

console.log('\n[7] 导入导出');
{
  const events = [store.normalizeEvent({ title: '测试', date: '2026-07-07' })];
  const json = store.exportJSON(events);
  const merged = store.importJSON([], json);
  assert(merged.length === 1, '导入成功');
  assert(merged[0].title === '测试', '导入字段正确');
  // 去重
  const merged2 = store.importJSON(events, json);
  assert(merged2.length === 1, '相同 id 去重');
}

console.log('\n[8] 相对描述');
{
  assert(relativeText(0) === '就是今天', '今天描述');
  assert(relativeText(1) === '还有 1 天', '明天描述');
  assert(relativeText(-1) === '已过 1 天', '昨天描述');
}

console.log(`\n========== 测试结果：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail === 0 ? 0 : 1);
