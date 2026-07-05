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

console.log('\n=== 1. 解析 parse ===');
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
ok('6字段报错', !C.parse('0 0 0 0 0 0').ok);
ok('4字段报错', !C.parse('0 0 0 0').ok);
ok('分钟越界(60)报错', !C.parse('60 * * * *').ok);
ok('小时越界(24)报错', !C.parse('* 24 * * *').ok);
ok('非法字符报错', !C.parse('a * * * *').ok);
ok('步长0报错', !C.parse('*/0 * * * *').ok);

// dow 7 规范化为 0
var p5 = C.parse('* * * * 7');
eq('dow 7 规范化为 0', p5.fields.dow, [0]);

console.log('\n=== 2. 中文描述 describe ===');
console.log('  "0 9 * * 1-5" -> ' + C.describe('0 9 * * 1-5'));
console.log('  "0 0 * * *"   -> ' + C.describe('0 0 * * *'));
console.log('  "*/5 * * * *" -> ' + C.describe('*/5 * * * *'));
console.log('  "0 0 1 1 *"   -> ' + C.describe('0 0 1 1 *'));
console.log('  "30 8 * * 1"  -> ' + C.describe('30 8 * * 1'));
ok('描述非空', C.describe('0 9 * * 1-5').length > 0);
ok('无效表达式描述', C.describe('bad expr').indexOf('无效') !== -1);

console.log('\n=== 3. 下次执行 nextRun ===');

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

console.log('\n=========================');
console.log('通过: ' + pass + ' / 失败: ' + fail);
console.log('=========================');
process.exit(fail > 0 ? 1 : 0);
