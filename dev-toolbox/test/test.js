/* ==================== dev-toolbox 核心逻辑测试 ==================== */
var core = require('../toolbox-core.js');

var pass = 0, fail = 0;
var errors = [];

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; errors.push(msg); console.log('  ✗ ' + msg); }
}

function assertEqual(actual, expected, msg) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  assert(ok, (msg || '值不符') + ' 期望=' + JSON.stringify(expected) + ' 实际=' + JSON.stringify(actual));
}

function group(name) { console.log('\n=== ' + name + ' ==='); }

// ========== 颜色转换 ==========
group('颜色转换');
(function () {
  var r = core.colorConvert('#007aff');
  assertEqual(r.rgb, { r: 0, g: 122, b: 255, a: 1 }, '#007aff RGB');
  assertEqual(r.hex, '#007aff', '#007aff HEX 输出');
  assertEqual(r.hsl.h, 211, '#007aff HSL.h 范围合理');
  assert(r.hsl.s >= 0 && r.hsl.s <= 100, 'HSL.s 范围 0-100');
  assert(r.hsl.l >= 0 && r.hsl.l <= 100, 'HSL.l 范围 0-100');

  // 简写
  var r2 = core.colorConvert('#fff');
  assertEqual(r2.rgb, { r: 255, g: 255, b: 255, a: 1 }, '#fff 简写');

  // rgba 含透明度
  var r3 = core.colorConvert('rgba(0,122,255,0.5)');
  assertEqual(r3.rgb.a, 0.5, 'rgba 透明度解析');
  assertEqual(r3.hex, '#007aff80', 'rgba 转 8 位 hex');

  // 8 位 hex
  var r4 = core.colorConvert('#007aff80');
  assert(Math.abs(r4.rgb.a - 0.502) < 0.01, '8 位 hex 透明度');

  // HSL 数学验证：纯红 #ff0000 -> hsl(0,100%,50%)
  var r5 = core.colorConvert('#ff0000');
  assertEqual(r5.hsl, { h: 0, s: 100, l: 50 }, '纯红 HSL');

  // 纯绿 #00ff00 -> hsl(120,100%,50%)
  var r6 = core.colorConvert('#00ff00');
  assertEqual(r6.hsl, { h: 120, s: 100, l: 50 }, '纯绿 HSL');

  // 纯蓝
  var r7 = core.colorConvert('#0000ff');
  assertEqual(r7.hsl, { h: 240, s: 100, l: 50 }, '纯蓝 HSL');

  // 灰色
  var r8 = core.colorConvert('#808080');
  assertEqual(r8.hsl.s, 0, '灰色饱和度为 0');

  // 非法格式抛异常
  var threw = false;
  try { core.colorConvert('notacolor'); } catch (e) { threw = true; }
  assert(threw, '非法颜色格式应抛异常');
})();

// ========== JSON 格式化 ==========
group('JSON 格式化');
(function () {
  var r = core.jsonFormat('{"a":1,"b":2}', 2);
  assert(r.ok, '合法 JSON ok=true');
  assertEqual(r.result, '{\n  "a": 1,\n  "b": 2\n}', '缩进 2 格式化');

  var r2 = core.jsonFormat('{"a":1,"b":2}', 0);
  assert(r2.ok, '压缩 ok');
  assertEqual(r2.result, '{"a":1,"b":2}', '压缩结果');

  var r3 = core.jsonFormat('{"a":1,"b":2}', 4);
  assert(r3.result.indexOf('    "a"') !== -1, '缩进 4 含 4 空格');

  var r4 = core.jsonFormat('{invalid}', 2);
  assert(!r4.ok, '非法 JSON ok=false');
  assert(r4.error.indexOf('JSON 解析失败') !== -1, '错误信息含中文');

  // 嵌套
  var r5 = core.jsonFormat('{"a":{"b":[1,2]}}', 2);
  assert(r5.ok && r5.result.indexOf('"b": [') !== -1, '嵌套对象格式化');

  // 默认 indent
  var r6 = core.jsonFormat('[1,2,3]');
  assert(r6.ok && r6.result === '[\n  1,\n  2,\n  3\n]', '默认 indent=2');
})();

// ========== 时间戳转换 ==========
group('时间戳转换');
(function () {
  // 秒戳
  var r = core.timestampConvert('1700000000');
  assertEqual(r.unix, 1700000000, '秒戳 unix');
  assertEqual(r.ms, 1700000000000, '秒戳转毫秒');

  // 毫秒戳
  var r2 = core.timestampConvert('1700000000000');
  assertEqual(r2.unix, 1700000000, '毫秒戳 unix');
  assertEqual(r2.ms, 1700000000000, '毫秒戳 ms');

  // now
  var r3 = core.timestampConvert('now');
  var now = Date.now();
  assert(Math.abs(r3.ms - now) < 2000, 'now 接近当前时间');

  // 日期字符串
  var r4 = core.timestampConvert('2024-01-01');
  assertEqual(r4.unix, 1704067200, '2024-01-01 unix（UTC）');

  // iso 字段
  assert(r4.iso.indexOf('2024-01-01') !== -1, 'ISO 含日期');

  // relative 字段存在
  assert(typeof r4.relative === 'string' && r4.relative.length > 0, 'relative 非空');

  // 非法
  var threw = false;
  try { core.timestampConvert('notadate'); } catch (e) { threw = true; }
  assert(threw, '非法日期抛异常');

  // date 字段格式
  assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.date), 'date 字段格式 YYYY-MM-DD HH:mm:ss');
})();

// ========== 正则测试 ==========
group('正则测试');
(function () {
  var r = core.regexTest('\\d+', 'g', 'abc123def456');
  assert(r.ok, '正则 ok');
  assertEqual(r.matches.length, 2, '全局匹配数 2');
  assertEqual(r.matches[0].match, '123', '第一匹配');
  assertEqual(r.matches[0].index, 3, '第一匹配位置');
  assertEqual(r.matches[1].match, '456', '第二匹配');

  // 非全局
  var r2 = core.regexTest('\\d+', '', 'abc123def456');
  assertEqual(r2.matches.length, 1, '非全局只匹配 1 次');

  // 捕获组（用 [a-z]+ 避免与 \d 贪婪歧义）
  var r3 = core.regexTest('([a-z]+)(\\d+)', '', 'abc123');
  assertEqual(r3.matches[0].groups, ['abc', '123'], '捕获组');

  // 零宽匹配不死循环
  var r4 = core.regexTest('', 'g', 'abc');
  assert(r4.ok && r4.matches.length >= 3, '零宽匹配不死循环');

  // 无匹配
  var r5 = core.regexTest('xyz', 'g', 'abc');
  assertEqual(r5.matches.length, 0, '无匹配');

  // 错误正则
  var r6 = core.regexTest('[', '', 'abc');
  assert(!r6.ok, '错误正则 ok=false');
  assert(r6.error.indexOf('正则表达式错误') !== -1, '错误信息含中文');
})();

// ========== 文本 Diff ==========
group('文本 Diff');
(function () {
  var r = core.textDiff('a\nb\nc', 'a\nb\nc');
  assertEqual(r.changes, 0, '相同文本 changes=0');
  assertEqual(r.same.length, 3, '相同行 3');

  var r2 = core.textDiff('a\nb\nc', 'a\nx\nc');
  assertEqual(r2.removed, ['b'], '删除 b');
  assertEqual(r2.added, ['x'], '新增 x');
  assertEqual(r2.changes, 2, 'changes=2');

  var r3 = core.textDiff('a\nb', 'a\nb\nc\nd');
  assertEqual(r3.added, ['c', 'd'], '尾部新增 2 行');
  assertEqual(r3.removed, [], '无删除');

  var r4 = core.textDiff('a\nb\nc\nd', 'a\nb');
  assertEqual(r4.removed, ['c', 'd'], '尾部删除 2 行');

  var r5 = core.textDiff('', 'a\nb');
  assertEqual(r5.added, ['a', 'b'], '空 -> 2 行新增');

  var r6 = core.textDiff('a\nb', '');
  assertEqual(r6.removed, ['a', 'b'], '2 行 -> 空 删除');

  // 单行
  var r7 = core.textDiff('hello', 'world');
  assertEqual(r7.removed, ['hello'], '单行删除');
  assertEqual(r7.added, ['world'], '单行新增');
})();

// ========== Base64 ==========
group('Base64');
(function () {
  var r = core.base64Code('Hello', 'encode');
  assert(r.ok, '编码 ok');
  assertEqual(r.result, 'SGVsbG8=', 'ASCII 编码');

  var r2 = core.base64Code('SGVsbG8=', 'decode');
  assert(r2.ok, '解码 ok');
  assertEqual(r2.result, 'Hello', 'ASCII 解码');

  // UTF-8 中文
  var r3 = core.base64Code('你好', 'encode');
  assert(r3.ok, '中文编码 ok');
  assertEqual(r3.result, '5L2g5aW9', 'UTF-8 中文编码');

  var r4 = core.base64Code('5L2g5aW9', 'decode');
  assertEqual(r4.result, '你好', 'UTF-8 中文解码');

  // Emoji（代理对）
  var r5 = core.base64Code('🎉', 'encode');
  assert(r5.ok, 'Emoji 编码 ok');
  var r6 = core.base64Code(r5.result, 'decode');
  assertEqual(r6.result, '🎉', 'Emoji 解码还原');

  // 非法 mode
  var r7 = core.base64Code('x', 'invalid');
  assert(!r7.ok, '非法 mode ok=false');

  // 非法 base64
  var r8 = core.base64Code('!!!notbase64!!!', 'decode');
  // 注意：atob 对某些字符可能不抛错，但要 ok 字段存在
  assert(typeof r8.ok === 'boolean', 'decode 返回 ok 字段');

  // 默认 mode
  var r9 = core.base64Code('A');
  assert(r9.ok, '默认 encode');
})();

// ========== URL 编解码 ==========
group('URL 编解码');
(function () {
  var r = core.urlCode('hello world', 'encode');
  assert(r.ok, '编码 ok');
  assertEqual(r.result, 'hello%20world', '空格编码');

  var r2 = core.urlCode('hello%20world', 'decode');
  assertEqual(r2.result, 'hello world', '空格解码');

  // 中文
  var r3 = core.urlCode('开发者', 'encode');
  assertEqual(r3.result, '%E5%BC%80%E5%8F%91%E8%80%85', '中文编码');

  var r4 = core.urlCode('%E5%BC%80%E5%8F%91%E8%80%85', 'decode');
  assertEqual(r4.result, '开发者', '中文解码');

  // URL 含特殊字符
  var r5 = core.urlCode('https://example.com/?a=1&b=2', 'encode');
  assert(r5.ok && r5.result.indexOf('://') === -1, 'URL 特殊字符编码');

  var r6 = core.urlCode(r5.result, 'decode');
  assertEqual(r6.result, 'https://example.com/?a=1&b=2', 'URL 往返还原');

  // 非法 mode
  var r7 = core.urlCode('x', 'invalid');
  assert(!r7.ok, '非法 mode ok=false');

  // 默认 mode
  var r8 = core.urlCode('A');
  assert(r8.ok, '默认 encode');
})();

// ========== 总结 ==========
console.log('\n========================');
console.log('通过: ' + pass + '  失败: ' + fail);
console.log('========================');
if (fail > 0) {
  console.log('\n失败用例:');
  errors.forEach(function (e) { console.log('  - ' + e); });
  process.exit(1);
} else {
  console.log('✓ 全部通过');
  process.exit(0);
}
