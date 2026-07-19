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

console.log('\n=== 12. buildToken：值数组还原为 cron 字段 token ===');
// 空数组 -> '*'
eq('空数组 -> *', C.buildToken([], 0, 59), '*');
// 全选 -> '*'
var all60 = []; for (var b1 = 0; b1 < 60; b1++) all60.push(b1);
eq('全选60 -> *', C.buildToken(all60, 0, 59), '*');
// 单值
eq('单值0 -> 0', C.buildToken([0], 0, 59), '0');
eq('单值9 -> 9', C.buildToken([9], 0, 59), '9');
// 连续范围
eq('连续范围1-5 -> 1-5', C.buildToken([1,2,3,4,5], 0, 59), '1-5');
// 注意：0-23 在 min=0/max=23 范围内为全选，应输出 '*'（更简洁）
eq('全选0-23 -> *', C.buildToken([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23], 0, 23), '*');
// 等差数列：从 min 开始 -> */step
eq('等差从0步长5 -> */5', C.buildToken([0,5,10,15,20,25,30,35,40,45,50,55], 0, 59), '*/5');
eq('等差从0步长10 -> */10', C.buildToken([0,10,20,30,40,50], 0, 59), '*/10');
// 等差数列：不从 min 开始 -> first/step
eq('等差从5步长10 -> 5/10', C.buildToken([5,15,25,35,45,55], 0, 59), '5/10');
// 等差从 min 开始精确填满 -> */step（比列表更简洁）
eq('等差从0步长15 -> */15', C.buildToken([0,15,30,45], 0, 59), '*/15');
// 真正无规则的列表
eq('无规则列表2 -> 1,3,5,7', C.buildToken([1,3,5,7], 0, 59), '1,3,5,7');
// 去重 + 排序
eq('去重排序 -> 0,5,10', C.buildToken([10,5,0,5,10], 0, 59), '0,5,10');
// 单元素不视为等差
eq('单元素 -> 3', C.buildToken([3], 0, 59), '3');
// 两元素等差从 min 开始 -> */step
eq('两元素等差从0 -> */30', C.buildToken([0,30], 0, 59), '*/30');
// 两元素连续 -> 范围
eq('两元素连续 -> 5-6', C.buildToken([5,6], 0, 59), '5-6');
// dow 字段（0-6）全选 -> *
var all7 = []; for (var b2 = 0; b2 < 7; b2++) all7.push(b2);
eq('dow全选 -> *', C.buildToken(all7, 0, 6), '*');
// dow 字段单值
eq('dow单值1 -> 1', C.buildToken([1], 0, 6), '1');
// dom 字段（1-31）连续范围
eq('dom连续1-7 -> 1-7', C.buildToken([1,2,3,4,5,6,7], 1, 31), '1-7');
// 等差不精确填满末尾 -> 列表（不是 step）
// 例如 [0,5,10,15,20] 在 0-59 范围内，最后值+step=25 不大于 59，所以不是精确等差 -> 列表
eq('不完整等差 -> 列表', C.buildToken([0,5,10,15,20], 0, 59), '0,5,10,15,20');

console.log('\n=== 13. buildToken 与 parse 互逆验证 ===');
// parse 一个表达式，再 buildToken 各字段，应该得到等价（或更简洁）的 token
function roundtrip(expr) {
  var p = C.parse(expr);
  if (!p.ok) return null;
  var tokens = expr.trim().split(/\s+/);
  var idx = 0;
  var result = [];
  if (p.hasSeconds) {
    result.push(C.buildToken(p.fields.second, 0, 59));
    idx = 1;
  }
  result.push(C.buildToken(p.fields.minute, 0, 59));
  result.push(C.buildToken(p.fields.hour, 0, 23));
  result.push(C.buildToken(p.fields.dom, 1, 31));
  result.push(C.buildToken(p.fields.month, 1, 12));
  result.push(C.buildToken(p.fields.dow, 0, 6));
  return result.join(' ');
}
// 这些表达式的字段都是"满"或"单值"或"连续范围"，buildToken 应得到等价
eq('roundtrip */5 * * * *', roundtrip('*/5 * * * *'), '*/5 * * * *');
eq('roundtrip 0 9 * * 1-5', roundtrip('0 9 * * 1-5'), '0 9 * * 1-5');
eq('roundtrip 0 0 1 * *', roundtrip('0 0 1 * *'), '0 0 1 * *');
eq('roundtrip 0 0 * * 0', roundtrip('0 0 * * 0'), '0 0 * * 0');
// 6 字段
eq('roundtrip 0 */5 * * * ?', roundtrip('0 */5 * * * ?'), '0 */5 * * * *');

console.log('\n=== 14. runsInRange：区间内执行统计 ===');

// 每分钟，1 小时区间内应有 60 次
var rr1 = C.runsInRange('*/1 * * * *', new Date('2026-07-04T10:00:00'), new Date('2026-07-04T11:00:00'), 5000);
eq('每分钟1小时共60次', rr1.count, 60);
ok('每分钟未触发上限', rr1.capped === false);

// 每小时整点，24 小时内应有 24 次
var rr2 = C.runsInRange('0 * * * *', new Date('2026-07-04T00:00:00'), new Date('2026-07-05T00:00:00'), 5000);
eq('整点24小时共24次', rr2.count, 24);

// 每天 0 点，7 天内应有 7 次
var rr3 = C.runsInRange('0 0 * * *', new Date('2026-07-04T00:00:00'), new Date('2026-07-11T00:00:00'), 5000);
eq('每天0点7天共7次', rr3.count, 7);

// 工作日 9 点，一周内应有 5 次（周一到周五）
// 2026-07-06 是周一
var rr4 = C.runsInRange('0 9 * * 1-5', new Date('2026-07-06T00:00:00'), new Date('2026-07-13T00:00:00'), 5000);
eq('工作日9点一周5次', rr4.count, 5);

// 区间内 0 次：每天 0 点，1 小时内（10:00-11:00）应 0 次
var rr5 = C.runsInRange('0 0 * * *', new Date('2026-07-04T10:00:00'), new Date('2026-07-04T11:00:00'), 5000);
eq('每天0点非0点区间0次', rr5.count, 0);

// maxCount 上限触发
var rr6 = C.runsInRange('*/1 * * * *', new Date('2026-07-04T00:00:00'), new Date('2026-07-05T00:00:00'), 100);
ok('每分钟一天触发100上限', rr6.capped === true);
eq('上限触发后count=100', rr6.count, 100);

// 无效表达式：返回 count=0
var rr7 = C.runsInRange('bad expr', new Date('2026-07-04T00:00:00'), new Date('2026-07-05T00:00:00'), 100);
eq('无效表达式count=0', rr7.count, 0);

// 6 字段（带秒）：每 10 秒，1 分钟内应有 6 次
var rr8 = C.runsInRange('*/10 * * * * ?', new Date('2026-07-04T10:00:00'), new Date('2026-07-04T10:01:00'), 5000);
eq('每10秒1分钟共6次', rr8.count, 6);

// start 等于 end：应返回 0（半开区间）
var rr9 = C.runsInRange('*/1 * * * *', new Date('2026-07-04T10:00:00'), new Date('2026-07-04T10:00:00'), 5000);
eq('start==end 返回0', rr9.count, 0);

console.log('\n=== 15. 宏表达式 expandMacro / parse ===');

// expandMacro 单元测试
var m1 = C.expandMacro('@yearly');
ok('@yearly 展开成功', m1.ok === true);
eq('@yearly 展开', m1.expanded, '0 0 1 1 *');
eq('@yearly macro', m1.macro, '@yearly');

var m2 = C.expandMacro('@annually');
eq('@annually 展开', m2.expanded, '0 0 1 1 *');
eq('@annually macro', m2.macro, '@annually');

eq('@monthly 展开', C.expandMacro('@monthly').expanded, '0 0 1 * *');
eq('@weekly 展开',  C.expandMacro('@weekly').expanded,  '0 0 * * 0');
eq('@daily 展开',   C.expandMacro('@daily').expanded,   '0 0 * * *');
eq('@midnight 展开', C.expandMacro('@midnight').expanded, '0 0 * * *');
eq('@hourly 展开',  C.expandMacro('@hourly').expanded,  '0 * * * *');

// 大小写不敏感
eq('@Yearly 大小写不敏感', C.expandMacro('@Yearly').expanded, '0 0 1 1 *');
eq('@DAILY 大写不敏感', C.expandMacro('@DAILY').expanded, '0 0 * * *');

// 中文别名
var mzh = C.expandMacro('@每年');
ok('@每年 中文别名成功', mzh.ok === true);
eq('@每年 展开为 0 0 1 1 *', mzh.expanded, '0 0 1 1 *');
eq('@每年 macro 标识', mzh.macro, '@yearly');
eq('@每月 展开', C.expandMacro('@每月').expanded, '0 0 1 * *');
eq('@每周 展开', C.expandMacro('@每周').expanded, '0 0 * * 0');
eq('@每天 展开', C.expandMacro('@每天').expanded, '0 0 * * *');
eq('@每时 展开', C.expandMacro('@每时').expanded, '0 * * * *');

// 不支持的宏
ok('@reboot 报错', !C.expandMacro('@reboot').ok);
ok('@every 5m 报错', !C.expandMacro('@every 5m').ok);
ok('@未知 报错', !C.expandMacro('@未知').ok);

// 非宏表达式（普通 cron）
var notMacro = C.expandMacro('0 9 * * 1-5');
ok('普通 cron 不视为宏', notMacro.ok === true && notMacro.macro === null);
eq('普通 cron 透传', notMacro.expanded, '0 9 * * 1-5');

console.log('\n=== 16. 宏表达式 parse ===');

// @yearly → 0 0 1 1 *
var py = C.parse('@yearly');
ok('@yearly parse ok', py.ok === true);
eq('@yearly macro 字段', py.macro, '@yearly');
eq('@yearly expanded', py.expanded, '0 0 1 1 *');
eq('@yearly minute=0', py.fields.minute, [0]);
eq('@yearly hour=0', py.fields.hour, [0]);
eq('@yearly dom=1', py.fields.dom, [1]);
eq('@yearly month=1', py.fields.month, [1]);

// @daily → 0 0 * * *
var pd = C.parse('@daily');
ok('@daily parse ok', pd.ok === true);
eq('@daily macro', pd.macro, '@daily');
eq('@daily expanded', pd.expanded, '0 0 * * *');
ok('@daily dom 全选', pd.fields.dom.length === 31);

// @hourly → 0 * * * *
var ph = C.parse('@hourly');
eq('@hourly expanded', ph.expanded, '0 * * * *');
eq('@hourly minute=0', ph.fields.minute, [0]);

// 宏在 parse 中识别 hasSeconds = false
ok('@yearly 非秒模式', py.hasSeconds === false);

// 中文别名 parse
var pzh = C.parse('@每月');
ok('@每月 parse ok', pzh.ok === true);
eq('@每月 macro', pzh.macro, '@monthly');
eq('@每月 expanded', pzh.expanded, '0 0 1 * *');

// @reboot 不能 parse
ok('@reboot parse 失败', !C.parse('@reboot').ok);

console.log('\n=== 17. 宏表达式 describe ===');

eq('@yearly 描述', C.describe('@yearly'), '每年 1 月 1 日 00:00');
eq('@annually 描述', C.describe('@annually'), '每年 1 月 1 日 00:00');
eq('@monthly 描述', C.describe('@monthly'), '每月 1 日 00:00');
eq('@weekly 描述', C.describe('@weekly'), '每周日 00:00');
eq('@daily 描述', C.describe('@daily'), '每天 00:00');
eq('@midnight 描述', C.describe('@midnight'), '每天 00:00（午夜）');
eq('@hourly 描述', C.describe('@hourly'), '每小时整点');

// 中文别名描述（也走 macro 路径）
ok('@每年 描述非空', C.describe('@每年').length > 0);
eq('@每年 描述', C.describe('@每年'), '每年 1 月 1 日 00:00');

console.log('\n=== 18. 宏表达式 nextRun（与等价 cron 表达式一致） ===');

// @yearly 从 2026-07-04 → 下次应是 2027-01-01 0:00
var ry1 = C.nextRun('@yearly', new Date('2026-07-04T10:00:00'), 1);
eq('@yearly 下一个年份', ry1[0].getFullYear(), 2027);
eq('@yearly 下一个月份', ry1[0].getMonth(), 0); // 1月 = index 0
eq('@yearly 下一个日期', ry1[0].getDate(), 1);

// @daily 从 2026-07-04T10:00 → 下次 2026-07-05 0:00
var ry2 = C.nextRun('@daily', new Date('2026-07-04T10:00:00'), 1);
eq('@daily 下一个日期', ry2[0].getDate(), 5);
eq('@daily 下一个时', ry2[0].getHours(), 0);
eq('@daily 下一个分', ry2[0].getMinutes(), 0);

// @hourly 从 2026-07-04T10:30 → 下次 2026-07-04 11:00
var ry3 = C.nextRun('@hourly', new Date('2026-07-04T10:30:00'), 1);
eq('@hourly 下一个时', ry3[0].getHours(), 11);
eq('@hourly 下一个分', ry3[0].getMinutes(), 0);

// @yearly 与等价 cron 0 0 1 1 * 的 nextRun 结果应该相等
var ryEq1 = C.nextRun('@yearly', new Date('2026-07-04T10:00:00'), 3);
var ryEq2 = C.nextRun('0 0 1 1 *', new Date('2026-07-04T10:00:00'), 3);
eq('@yearly 与 0 0 1 1 * 等价 (count)', ryEq1.length, ryEq2.length);
eq('@yearly 与 0 0 1 1 * 等价 (first)', ryEq1[0].getTime(), ryEq2[0].getTime());

console.log('\n=== 19. 宏表达式 runsInRange（与等价 cron 一致） ===');

// @daily 7 天区间内应有 7 次
var rrM1 = C.runsInRange('@daily', new Date('2026-07-04T00:00:00'), new Date('2026-07-11T00:00:00'), 5000);
eq('@daily 7天7次', rrM1.count, 7);
ok('@daily 7天未触发上限', rrM1.capped === false);

// @hourly 24 小时内应有 24 次
var rrM2 = C.runsInRange('@hourly', new Date('2026-07-04T00:00:00'), new Date('2026-07-05T00:00:00'), 5000);
eq('@hourly 24小时24次', rrM2.count, 24);

// @monthly 一个月内（2026-07-04 到 2026-08-04）应有 1 次（8月1日）
var rrM3 = C.runsInRange('@monthly', new Date('2026-07-04T00:00:00'), new Date('2026-08-04T00:00:00'), 5000);
eq('@monthly 1个月1次', rrM3.count, 1);

// 无效宏
var rrM4 = C.runsInRange('@reboot', new Date('2026-07-04T00:00:00'), new Date('2026-07-05T00:00:00'), 100);
eq('@reboot 无效 → count=0', rrM4.count, 0);

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
