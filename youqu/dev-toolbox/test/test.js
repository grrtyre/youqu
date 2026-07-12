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

// ========== JWT 解码 ==========
group('JWT 解码');
(function () {
  // UTF-8 安全的 base64url 编码辅助（仅测试用）
  function b64urlUtf8(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else { bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    var bin = '';
    for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function makeJwt(header, payload) {
    return b64urlUtf8(JSON.stringify(header)) + '.' + b64urlUtf8(JSON.stringify(payload)) + '.sig-part';
  }

  // 标准三段解码
  var token = makeJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '123', name: 'dev-toolbox' });
  var r = core.jwtDecode(token);
  assert(r.ok, '标准 JWT ok=true');
  assertEqual(r.header.alg, 'HS256', 'header.alg');
  assertEqual(r.header.typ, 'JWT', 'header.typ');
  assertEqual(r.payload.sub, '123', 'payload.sub');
  assertEqual(r.payload.name, 'dev-toolbox', 'payload.name');
  assertEqual(r.signature, 'sig-part', 'signature 段');

  // 中文 payload
  var tokenZh = makeJwt({ alg: 'HS256' }, { name: '开发者工具箱', role: '管理员' });
  var rZh = core.jwtDecode(tokenZh);
  assert(rZh.ok, '中文 payload ok');
  assertEqual(rZh.payload.name, '开发者工具箱', '中文 payload 解码');
  assertEqual(rZh.payload.role, '管理员', '中文 role 解码');

  // exp 未来 → 有效
  var futureExp = Math.floor(Date.now() / 1000) + 86400; // 明天
  var tokenValid = makeJwt({ alg: 'HS256' }, { iat: 1700000000, exp: futureExp });
  var rValid = core.jwtDecode(tokenValid);
  assertEqual(rValid.claims.status, 'valid', 'exp 未来状态 valid');
  assertEqual(rValid.claims.statusText, '有效', '状态文案 有效');
  assert(rValid.claims.remaining.indexOf('还有') !== -1, '剩余时间含"还有"');

  // exp 过去 → 已过期
  var pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 小时前
  var tokenExpired = makeJwt({ alg: 'HS256' }, { exp: pastExp });
  var rExp = core.jwtDecode(tokenExpired);
  assertEqual(rExp.claims.status, 'expired', 'exp 过去状态 expired');
  assertEqual(rExp.claims.statusText, '已过期', '状态文案 已过期');
  assert(rExp.claims.remaining.indexOf('已过期') !== -1, '逾期含"已过期"');

  // nbf 未来 → 尚未生效
  var futureNbf = Math.floor(Date.now() / 1000) + 7200;
  var tokenNbf = makeJwt({ alg: 'HS256' }, { nbf: futureNbf, exp: futureExp });
  var rNbf = core.jwtDecode(tokenNbf);
  assertEqual(rNbf.claims.status, 'notbefore', 'nbf 未来状态 notbefore');
  assertEqual(rNbf.claims.statusText, '尚未生效', '状态文案 尚未生效');

  // 无 exp → 无过期声明
  var tokenNoExp = makeJwt({ alg: 'none' }, { sub: 'x' });
  var rNoExp = core.jwtDecode(tokenNoExp);
  assertEqual(rNoExp.claims.status, 'unknown', '无 exp 状态 unknown');
  assertEqual(rNoExp.claims.statusText, '无过期声明', '状态文案 无过期声明');
  assertEqual(rNoExp.claims.exp, null, '无 exp 字段 null');

  // iat 日期格式化
  var tokenIat = makeJwt({ alg: 'HS256' }, { iat: 1700000000 });
  var rIat = core.jwtDecode(tokenIat);
  assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rIat.claims.iatDate), 'iat 日期格式 YYYY-MM-DD HH:mm:ss');

  // 两段 JWT（无签名）也支持
  var tokenTwo = b64urlUtf8('{"alg":"none"}') + '.' + b64urlUtf8('{"sub":"ab"}');
  var rTwo = core.jwtDecode(tokenTwo);
  assert(rTwo.ok, '两段 JWT ok=true');
  assertEqual(rTwo.signature, '', '两段 JWT signature 为空');
  assertEqual(rTwo.payload.sub, 'ab', '两段 JWT payload');

  // 空输入
  var rEmpty = core.jwtDecode('');
  assert(!rEmpty.ok, '空输入 ok=false');
  assert(rEmpty.error.indexOf('请输入') !== -1, '空输入提示');

  // 无点分隔
  var rNoDot = core.jwtDecode('notajwt');
  assert(!rNoDot.ok, '无点分隔 ok=false');
  assert(rNoDot.error.indexOf('格式错误') !== -1, '格式错误提示含中文');

  // 段数过多（4 段）
  var rFour = core.jwtDecode('a.b.c.d');
  assert(!rFour.ok, '四段 JWT ok=false');

  // 非法 base64url payload
  var rBad = core.jwtDecode('eyJhbGciOiJub25lIn0.!!!invalid!!!.sig');
  assert(!rBad.ok, '非法 payload ok=false');
  assert(rBad.error.indexOf('解析失败') !== -1, '解析失败提示');

  // jwt.io 标准示例 token（base64url 含 - 和 _）
  var stdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  var rStd = core.jwtDecode(stdToken);
  assert(rStd.ok, 'jwt.io 标准 token ok');
  assertEqual(rStd.payload.sub, '1234567890', '标准 token sub');
  assertEqual(rStd.payload.name, 'John Doe', '标准 token name');
  assertEqual(rStd.payload.iat, 1516239022, '标准 token iat');

  // 签名含 base64url 特殊字符（- 和 _）能正确取出
  assert(rStd.signature.indexOf('_') !== -1 || rStd.signature.indexOf('-') !== -1 || rStd.signature === 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', '签名段保留原始字符');
})();

// ========== 总结 ==========
// ========== 生成器：UUID ==========
group('生成器: UUID');
(function () {
  // 默认格式：小写带连字符
  var uuid = core.generateUUID();
  assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid), '默认 UUID 格式 8-4-4-4-12');
  assertEqual(uuid.length, 36, '默认 UUID 长度 36');

  // 版本位 = 4
  assertEqual(uuid[14], '4', '版本位为 4');

  // 变体位 = 8/9/a/b
  assert('89ab'.indexOf(uuid[19]) !== -1, '变体位为 8/9/a/b');

  // 大写格式
  var upper = core.generateUUID('upper');
  assert(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(upper), '大写 UUID 格式');
  assertEqual(upper.length, 36, '大写 UUID 长度 36');

  // 无连字符
  var noHyphen = core.generateUUID('nohyphen');
  assert(/^[0-9a-f]{32}$/.test(noHyphen), '无连字符 UUID 32 位 hex');
  assertEqual(noHyphen.length, 32, '无连字符 UUID 长度 32');
  assert(noHyphen.indexOf('-') === -1, '无连字符 UUID 不含 -');

  // 花括号
  var braces = core.generateUUID('braces');
  assert(/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/.test(braces), '花括号 UUID 格式');
  assertEqual(braces[0], '{', '花括号 UUID 以 { 开头');
  assertEqual(braces[braces.length - 1], '}', '花括号 UUID 以 } 结尾');

  // 唯一性：生成 200 个，全部不同
  var seen = {};
  var unique = true;
  for (var i = 0; i < 200; i++) {
    var u = core.generateUUID();
    if (seen[u]) { unique = false; break; }
    seen[u] = true;
  }
  assert(unique, '200 个 UUID 全部唯一');
})();

// ========== 生成器：密码 ==========
group('生成器: 密码');
(function () {
  // 默认生成
  var r = core.generatePassword(16);
  assert(r.ok, '默认生成 ok=true');
  assertEqual(r.password.length, 16, '默认密码长度 16');
  assert(r.strength === 'weak' || r.strength === 'medium' || r.strength === 'strong', '强度值合法');
  assert(r.entropy > 0, '熵 > 0');

  // 自定义长度
  var r2 = core.generatePassword(32);
  assertEqual(r2.password.length, 32, '32 位密码长度');
  assert(r2.entropy > r.entropy, '更长密码熵更高');

  // 仅小写字母
  var r3 = core.generatePassword(20, { lower: true, upper: false, digits: false, symbols: false });
  assert(r3.ok, '仅小写 ok');
  assertEqual(r3.password.length, 20, '仅小写长度 20');
  assert(/^[a-z]+$/.test(r3.password), '仅小写字母字符');

  // 仅数字
  var r4 = core.generatePassword(10, { lower: false, upper: false, digits: true, symbols: false });
  assert(r4.ok, '仅数字 ok');
  assert(/^[0-9]+$/.test(r4.password), '仅数字字符');

  // 仅符号
  var r5 = core.generatePassword(15, { lower: false, upper: false, digits: false, symbols: true });
  assert(r5.ok, '仅符号 ok');
  assert(/^[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]+$/.test(r5.password), '仅符号字符');

  // 无字符集 → 失败
  var r6 = core.generatePassword(16, { lower: false, upper: false, digits: false, symbols: false });
  assert(!r6.ok, '无字符集 ok=false');
  assert(r6.error.indexOf('至少') !== -1, '无字符集错误提示含"至少"');

  // 排除易混字符
  var r7 = core.generatePassword(50, { lower: true, upper: true, digits: true, symbols: false, excludeAmbiguous: true });
  assert(r7.ok, '排除易混 ok');
  assert(r7.password.indexOf('0') === -1, '排除 0');
  assert(r7.password.indexOf('O') === -1, '排除 O');
  assert(r7.password.indexOf('1') === -1, '排除 1');
  assert(r7.password.indexOf('l') === -1, '排除 l');
  assert(r7.password.indexOf('I') === -1, '排除 I');

  // 强度：短密码 + 仅小写 = 弱
  var r8 = core.generatePassword(4, { lower: true, upper: false, digits: false, symbols: false });
  assertEqual(r8.strength, 'weak', '4位仅小写 = 弱');

  // 强度：长密码 + 全字符集 = 强
  var r9 = core.generatePassword(32, { lower: true, upper: true, digits: true, symbols: true });
  assertEqual(r9.strength, 'strong', '32位全字符集 = 强');

  // 字符集覆盖：全选时密码含每种字符（长度足够）
  var r10 = core.generatePassword(50, { lower: true, upper: true, digits: true, symbols: true });
  assert(r10.ok, '全字符集 ok');
  assert(/[a-z]/.test(r10.password), '含小写字母');
  assert(/[A-Z]/.test(r10.password), '含大写字母');
  assert(/[0-9]/.test(r10.password), '含数字');
  assert(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(r10.password), '含符号');

  // 长度边界
  var r11 = core.generatePassword(1);
  assertEqual(r11.password.length, 1, '长度 1');
  var r12 = core.generatePassword(128);
  assertEqual(r12.password.length, 128, '长度 128');
  var r13 = core.generatePassword(200);
  assertEqual(r13.password.length, 128, '长度超限截断 128');

  // 唯一性：生成 50 个密码全不同
  var pwdSeen = {};
  var pwdUnique = true;
  for (var i = 0; i < 50; i++) {
    var p = core.generatePassword(16).password;
    if (pwdSeen[p]) { pwdUnique = false; break; }
    pwdSeen[p] = true;
  }
  assert(pwdUnique, '50 个密码全部唯一');

  // 熵值合理性：仅小写 16 位 ≈ 75 bit
  var r14 = core.generatePassword(16, { lower: true, upper: false, digits: false, symbols: false });
  assert(Math.abs(r14.entropy - 75) <= 1, '仅小写16位熵≈75 实际=' + r14.entropy);
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
