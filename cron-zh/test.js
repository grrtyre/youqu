// 功能测试：mock 浏览器环境，加载 cron-utils.js，验证解析/描述/下次执行的正确性
global.window = {};
require('./cron-utils.js');
var C = global.window.CronUtils;

var pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function eq(name, actual, expected) {
  var cond = JSON.stringify(actual) === JSON.stringify(expected);
  ok(name + ' (得到: ' + JSON.stringify(actual) + ', 期望: ' + JSON.stringify(expected) + ')', cond);
}

console.log('\n=== 1. 解析 parse（5 字段） ===');
var p1 = C.parse('0 9 * * 1-5');
ok('工作日表达式有效', p1.ok === true);
eq('minute', p1.fields.minute, [0]);
eq('hour', p1.fields.hour, [9]);
eq('dow 1-5', p1.fields.dow, [1,2,3,4,5]);

var p2 = C.parse('*/5 * * * *');
ok('*/5 步长有效', p2.ok && p2.fields.minute.length === 12);
eq('*/5 第一个值', p2.fields.minute[0], 0);
eq('*/5 最后值', p2.fields.minute[11], 55);

var p3 = C.parse('0,30 * * * *');
eq('逗号列表', p3.fields.minute, [0,30]);

var p4 = C.parse('0 0 1 1 *');
eq('元旦 dom', p4.fields.dom, [1]);
eq('元旦 month', p4.fields.month, [1]);

// 错误处理
ok('7字段报错', !C.parse('0 0 0 0 0 0 0').ok);
ok('4字段报错', !C.parse('0 0 0 0').ok);
ok('分钟越界(60)报错', !C.parse('60 * * * *').ok);
ok('小时越界(24)报错', !C.parse('* 24 * * *').ok);
ok('非法字符报错', !C.parse('a * * * *').ok);
ok('步长0报错', !C.parse('*/0 * * * *').ok);

// dow 7 规范化为 0
var p5 = C.parse('* * * * 7');
eq('dow 7 规范化为 0', p5.fields.dow, [0]);

console.log('\n=== 2. 中文描述 describe（5 字段） ===');
console.log('  "0 9 * * 1-5" -> ' + C.describe('0 9 * * 1-5'));
console.log('  "0 0 * * *"   -> ' + C.describe('0 0 * * *'));
console.log('  "*/5 * * * *" -> ' + C.describe('*/5 * * * *'));
console.log('  "0 0 1 1 *"   -> ' + C.describe('0 0 1 1 *'));
console.log('  "30 8 * * 1"  -> ' + C.describe('30 8 * * 1'));
ok('描述非空', C.describe('0 9 * * 1-5').length > 0);
ok('无效表达式描述', C.describe('bad expr').indexOf('无效') !== -1);

console.log('\n=== 3. 下次执行 nextRun（5 字段） ===');

// 测试1: 每分钟，应有5个结果
var r1 = C.nextRun('*/1 * * * *', new Date('2026-07-04T10:00:00'), 5);
eq('每分钟返回5个', r1.length, 5);
eq('第一个是10:01', r1[0].getMinutes(), 1);

// 测试2: 每小时整点，从10:30开始
var r2 = C.nextRun('0 * * * *', new Date('2026-07-04T10:30:00'), 3);
eq('整点第一个11:00', r2[0].getHours(), 11);
eq('整点第一个分00', r2[0].getMinutes(), 0);
eq('整点第二个12:00', r2[1].getHours(), 12);

// 测试3: 每天0点
var r3 = C.nextRun('0 0 * * *', new Date('2026-07-04T15:00:00'), 2);
eq('每天0点第一个是次日', r3[0].getDate(), 5);
eq('每天0点时=0', r3[0].getHours(), 0);

// 测试4: 工作日（周一到周五），从周五算
var r4 = C.nextRun('0 9 * * 1-5', new Date('2026-07-03T10:00:00'), 3); // 2026-07-03是周五
ok('工作日跳过周末(第一个是下周一)', r4[0].getDay() === 1);

// 测试5: 每月1号
var r5 = C.nextRun('0 0 1 * *', new Date('2026-07-15T00:00:00'), 2);
eq('每月1号第一个是8月1日', r5[0].getMonth(), 7); // 8月 = index 7
eq('每月1号日期', r5[0].getDate(), 1);

// 测试6: dom 和 dow 的 OR 逻辑
// 表达式 "0 0 15 * 1" = 每月15号 OR 每周一，从7月4日（周六）算
var r6 = C.nextRun('0 0 15 * 1', new Date('2026-07-04T12:00:00'), 5);
var r6Ok = r6.some(function(d){ return d.getDate() === 15; }) &&
           r6.some(function(d){ return d.getDay() === 1; });
ok('dom/dow OR 逻辑正确', r6Ok);

// 测试7: 2月29日（闰年），从2026算下一个是2028
var r7 = C.nextRun('0 0 29 2 *', new Date('2026-07-04T00:00:00'), 1);
ok('2月29日跳到闰年2028', r7[0].getFullYear() === 2028 && r7[0].getMonth() === 1 && r7[0].getDate() === 29);

console.log('\n=== 4. 边界与健壮性 ===');
ok('空字符串报错', !C.parse('').ok);
ok('null 报错', !C.parse(null).ok);
try { C.nextRun('bad', new Date(), 1); ok('nextRun 无效表达式抛异常', false); }
catch(e){ ok('nextRun 无效表达式抛异常', true); }
ok('nextRun 默认count=5', C.nextRun('* * * * *', new Date()).length === 5);

console.log('\n=== 5. 6 字段（带秒）解析 ===');

// 基本 6 字段解析
var s1 = C.parse('0 */5 * * * ?');
ok('6字段有效', s1.ok === true);
ok('6字段 hasSeconds 标记', s1.hasSeconds === true);
eq('秒字段=0', s1.fields.second, [0]);
eq('分钟步长5', s1.fields.minute, [0,5,10,15,20,25,30,35,40,45,50,55]);

// 秒字段为单值
var s2 = C.parse('30 0 9 * * ?');
eq('秒=30', s2.fields.second, [30]);
eq('时=9', s2.fields.hour, [9]);

// 秒字段为步长
var s3 = C.parse('*/10 * * * * ?');
eq('秒步长10', s3.fields.second, [0,10,20,30,40,50]);

// 秒字段为列表
var s4 = C.parse('0,15,30,45 0 * * * ?');
eq('秒列表', s4.fields.second, [0,15,30,45]);

// 秒越界
ok('秒越界(60)报错', !C.parse('60 * * * * ?').ok);

// 6 字段 dom 越界（0 非法）
ok('6字段 dom=0 报错', !C.parse('0 0 0 0 0 ?').ok);

console.log('\n=== 6. Quartz ? 标记 ===');

// ? 在 dom 合法，标记为 unspecified
var q1 = C.parse('0 0 9 ? * 1');
ok('? 在 dom 合法', q1.ok === true);
ok('dom unspecified 标记', q1.unspecified.dom === true);
ok('dow 仍为具体值', q1.unspecified.dow === false);
eq('dow=1', q1.fields.dow, [1]);

// ? 在 dow 合法
var q2 = C.parse('0 0 0 1 * ?');
ok('? 在 dow 合法', q2.ok === true);
ok('dow unspecified 标记', q2.unspecified.dow === true);

// ? 在非 dom/dow 字段非法（6 字段顺序：秒 分 时 日 月 周）
ok('? 在秒非法', !C.parse('? * * * * *').ok);
ok('? 在分钟非法', !C.parse('0 ? * * * *').ok);
ok('? 在小时非法', !C.parse('0 0 ? * * *').ok);
ok('? 在月非法', !C.parse('0 0 * * ? *').ok);

console.log('\n=== 7. L / # 特殊字符明确报错 ===');
ok('L 单独报错', !C.parse('0 0 L * *').ok);
ok('L 后缀报错', !C.parse('0 0 15L * *').ok);
ok('# 报错', !C.parse('0 0 * * 1#3').ok);
// 确认错误信息提示
ok('L 报错信息含提示', C.parse('0 0 L * *').error.indexOf('暂不支持') !== -1);

console.log('\n=== 8. 6 字段 describe（带秒描述） ===');
console.log('  "0 0 9 * * ?"        -> ' + C.describe('0 0 9 * * ?'));
console.log('  "30 0 9 * * ?"       -> ' + C.describe('30 0 9 * * ?'));
console.log('  "*/10 * * * * ?"     -> ' + C.describe('*/10 * * * * ?'));
console.log('  "0,15,30,45 0 * * * ?" -> ' + C.describe('0,15,30,45 0 * * * ?'));
console.log('  "5,10,30 0 * * * ?"    -> ' + C.describe('5,10,30 0 * * * ?'));

// 单秒值扩展为 HH:MM:SS
ok('单秒值扩展为 HH:MM:SS', C.describe('30 0 9 * * ?').indexOf('09:00:30') !== -1);
// 步长秒描述为 "每N秒"
ok('步长秒描述为每10秒', C.describe('*/10 * * * * ?').indexOf('每10秒') !== -1);
// 等差列表 0,15,30,45 也识别为步长 → 每15秒
ok('等差列表识别为每15秒', C.describe('0,15,30,45 0 * * * ?').indexOf('每15秒') !== -1);
// 非等差列表描述为 "第X秒"
ok('非等差列表描述为第N秒', C.describe('5,10,30 0 * * * ?').indexOf('第') !== -1);

console.log('\n=== 9. 6 字段 nextRun（带秒计算） ===');

// 每10秒，从 10:00:00 开始，应有 5 个：10:00:10, 10:00:20, 10:00:30, 10:00:40, 10:00:50
var sr1 = C.nextRun('*/10 * * * * ?', new Date('2026-07-04T10:00:00'), 5);
eq('每10秒返回5个', sr1.length, 5);
eq('第一个10:00:10', sr1[0].getSeconds(), 10);
eq('第二个10:00:20', sr1[1].getSeconds(), 20);

// 每分钟0秒，从 10:00:30 开始，下一个是 10:01:00（秒=0，跨分钟）
var sr2 = C.nextRun('0 * * * * ?', new Date('2026-07-04T10:00:30'), 1);
eq('单秒值跨分钟', sr2[0].getMinutes(), 1);
eq('单秒值秒=0', sr2[0].getSeconds(), 0);

// 从 10:00:29.5 开始，秒=0，下一个是 10:00:30（秒=30，因为表达式秒=0... 等等 0 0 9 是秒0）
// 0 0 9 * * ? = 每天 09:00:00，从 10:00:29.5 算，下一个是次日 09:00:00
var sr3 = C.nextRun('0 0 9 * * ?', new Date('2026-07-04T10:00:29'), 1);
eq('单秒值跨天-日', sr3[0].getDate(), 5);
eq('单秒值跨天-时', sr3[0].getHours(), 9);
eq('单秒值跨天-秒', sr3[0].getSeconds(), 0);

// 秒列表 0,30，从 10:00:00 开始：10:00:00 已过(从下一秒), 10:00:30, 10:01:00, 10:01:30
var sr4 = C.nextRun('0,30 * * * * ?', new Date('2026-07-04T10:00:00'), 4);
eq('秒列表返回4个', sr4.length, 4);
eq('秒列表第一个30秒', sr4[0].getSeconds(), 30);
eq('秒列表第二个下一分0秒', sr4[1].getSeconds(), 0);
eq('秒列表第二个下一分', sr4[1].getMinutes(), 1);

// 同一分钟内多个匹配秒
var sr5 = C.nextRun('*/20 * * * * ?', new Date('2026-07-04T10:00:05'), 3);
eq('同分钟多秒-第一个20', sr5[0].getSeconds(), 20);
eq('同分钟多秒-第二个40', sr5[1].getSeconds(), 40);
eq('同分钟多秒-第三个下一分0', sr5[2].getSeconds(), 0);
eq('同分钟多秒-第三个下一分', sr5[2].getMinutes(), 1);

console.log('\n=== 10. 5/6 字段兼容性 ===');
// 5 字段无 hasSeconds
ok('5字段无 hasSeconds', C.parse('0 9 * * 1-5').hasSeconds === false);
ok('5字段无 second 字段', C.parse('0 9 * * 1-5').fields.second === undefined);
// 5 字段 nextRun 仍精确到分钟（秒=0）
var cr = C.nextRun('0 9 * * 1-5', new Date('2026-07-04T10:00:00'), 1);
eq('5字段结果秒=0', cr[0].getSeconds(), 0);

console.log('\n=== 11. 最近使用历史逻辑（mock localStorage） ===');
// 模拟 app.js 中的历史管理逻辑
var mockStore = {};
var mockLocalStorage = {
  getItem: function (k) { return mockStore[k] || null; },
  setItem: function (k, v) { mockStore[k] = v; },
  removeItem: function (k) { delete mockStore[k]; }
};
var HKEY = 'cron-history';
var HMAX = 8;

function hLoad() {
  var raw = mockLocalStorage.getItem(HKEY);
  if (!raw) return [];
  var arr = JSON.parse(raw);
  return Array.isArray(arr) ? arr : [];
}
function hSave(list) { mockLocalStorage.setItem(HKEY, JSON.stringify(list)); }
function hAdd(expr) {
  if (!expr) return;
  var list = hLoad();
  var idx = list.indexOf(expr);
  if (idx !== -1) list.splice(idx, 1);
  list.unshift(expr);
  if (list.length > HMAX) list = list.slice(0, HMAX);
  hSave(list);
}

// 空历史
eq('初始为空', hLoad(), []);
// 添加一条
hAdd('0 9 * * 1-5');
eq('添加一条后长度1', hLoad(), ['0 9 * * 1-5']);
// 添加第二条
hAdd('*/5 * * * *');
eq('添加两条后顺序', hLoad(), ['*/5 * * * *', '0 9 * * 1-5']);
// 去重：重复添加移到首位
hAdd('0 9 * * 1-5');
eq('去重后移到首位', hLoad(), ['0 9 * * 1-5', '*/5 * * * *']);
// 超过上限截断
for (var hi = 0; hi < 10; hi++) { hAdd('expr-' + hi); }
ok('超过上限截断为8条', hLoad().length === HMAX);
eq('最新的在首位', hLoad()[0], 'expr-9');
// 空值不添加
hAdd('');
ok('空值不添加', hLoad().length === HMAX);
// 清空
hSave([]);
eq('清空后为空', hLoad(), []);

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
