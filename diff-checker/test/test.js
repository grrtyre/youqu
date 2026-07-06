/* ==================== 文本对比管家 · 核心引擎测试 ==================== */
var Diff = require('../diff-engine.js');

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

// ========== splitLines ==========
group('splitLines');
(function () {
  assertEqual(Diff.splitLines('a\nb\nc'), ['a', 'b', 'c'], '基本切分');
  assertEqual(Diff.splitLines('a\r\nb\r\nc'), ['a', 'b', 'c'], 'CRLF 统一');
  assertEqual(Diff.splitLines('a\rb'), ['a', 'b'], 'CR 统一');
  assertEqual(Diff.splitLines(''), [], '空字符串');
  assertEqual(Diff.splitLines(null), [], 'null');
  assertEqual(Diff.splitLines('a\n'), ['a'], '末尾换行不产生空行');
  assertEqual(Diff.splitLines('a\n\nb'), ['a', '', 'b'], '保留中间空行');
})();

// ========== charDiff ==========
group('charDiff');
(function () {
  var d1 = Diff.charDiff('abc', 'abc');
  assertEqual(d1, [{ type: 'equal', text: 'abc' }], '完全相同');

  var d2 = Diff.charDiff('', 'abc');
  assertEqual(d2, [{ type: 'add', text: 'abc' }], '空 → abc');

  var d3 = Diff.charDiff('abc', '');
  assertEqual(d3, [{ type: 'del', text: 'abc' }], 'abc → 空');

  var d4 = Diff.charDiff('abc', 'axc');
  // 期望：equal 'a' + del 'b' + add 'x' + equal 'c' （合并后）
  assertEqual(d4.length >= 2, true, 'abc vs axc 有多段');
  var delText = d4.filter(function (s) { return s.type === 'del'; }).map(function (s) { return s.text; }).join('');
  var addText = d4.filter(function (s) { return s.type === 'add'; }).map(function (s) { return s.text; }).join('');
  var eqText = d4.filter(function (s) { return s.type === 'equal'; }).map(function (s) { return s.text; }).join('');
  assertEqual(delText, 'b', 'abc vs axc 删除部分=b');
  assertEqual(addText, 'x', 'abc vs axc 新增部分=x');
  assertEqual(eqText, 'ac', 'abc vs axc 公共部分=ac');
})();

// ========== lineDiff ==========
group('lineDiff');
(function () {
  var ops = Diff.lineDiff(['a', 'b', 'c'], ['a', 'b', 'c']);
  assertEqual(ops.length, 1, '完全相同=1段');
  assertEqual(ops[0].type, 'equal', '类型=equal');
  assertEqual(ops[0].lines, ['a', 'b', 'c'], '行内容一致');

  var ops2 = Diff.lineDiff(['a', 'b', 'c'], ['a', 'X', 'c']);
  // 期望：equal [a], del [b], add [X], equal [c]
  assertEqual(ops2.length, 4, '单行替换=4段');
  assertEqual(ops2[0], { type: 'equal', lines: ['a'] }, '第一段 equal a');
  assertEqual(ops2[1], { type: 'del', lines: ['b'] }, '第二段 del b');
  assertEqual(ops2[2], { type: 'add', lines: ['X'] }, '第三段 add X');
  assertEqual(ops2[3], { type: 'equal', lines: ['c'] }, '第四段 equal c');

  var ops3 = Diff.lineDiff([], ['a', 'b']);
  assertEqual(ops3.length, 1, '空→2行=1段');
  assertEqual(ops3[0].type, 'add', '类型=add');

  var ops4 = Diff.lineDiff(['a', 'b'], []);
  assertEqual(ops4.length, 1, '2行→空=1段');
  assertEqual(ops4[0].type, 'del', '类型=del');
})();

// ========== compare 主入口 ==========
group('compare');
(function () {
  var r1 = Diff.compare('hello\nworld', 'hello\nworld');
  assertEqual(r1.stats.added, 0, '相同文本 added=0');
  assertEqual(r1.stats.deleted, 0, '相同文本 deleted=0');
  assertEqual(r1.stats.unchanged, 2, '相同文本 unchanged=2');

  var r2 = Diff.compare('a\nb\nc', 'a\nB\nc');
  assertEqual(r2.stats.added, 1, '大小写不同 added=1');
  assertEqual(r2.stats.deleted, 1, '大小写不同 deleted=1');

  // 忽略大小写
  var r3 = Diff.compare('a\nb\nc', 'a\nB\nc', { ignoreCase: true });
  assertEqual(r3.stats.added, 0, '忽略大小写 added=0');
  assertEqual(r3.stats.deleted, 0, '忽略大小写 deleted=0');
  assertEqual(r3.stats.unchanged, 3, '忽略大小写 unchanged=3');

  // 忽略空白
  var r4 = Diff.compare('  hello  ', 'hello', { trimWhitespace: true });
  assertEqual(r4.stats.added, 0, '忽略空白 added=0');
  assertEqual(r4.stats.deleted, 0, '忽略空白 deleted=0');

  var r5 = Diff.compare('  hello  ', 'hello');
  assert(r5.stats.deleted >= 1 && r5.stats.added >= 1, '不忽略空白时有差异');
})();

// ========== toSideBySideBlocks ==========
group('toSideBySideBlocks');
(function () {
  // modify 块应包含字符级 diff
  var r = Diff.compare('hello world', 'hello Earth');
  var modifyBlocks = r.blocks.filter(function (b) { return b.type === 'modify'; });
  assert(modifyBlocks.length >= 1, '存在 modify 块');
  if (modifyBlocks.length > 0) {
    var mb = modifyBlocks[0];
    assert(mb.left[0].charDiffs != null, 'modify 块左侧有 charDiffs');
    assert(mb.right[0].charDiffs != null, 'modify 块右侧有 charDiffs');
  }

  // 纯新增：右侧有内容，左侧空
  var r2 = Diff.compare('a', 'a\nb');
  var addBlocks = r2.blocks.filter(function (b) { return b.type === 'add'; });
  assert(addBlocks.length >= 1, '存在 add 块');
  if (addBlocks.length > 0) {
    assertEqual(addBlocks[0].left[0].text, '', 'add 块左侧为空');
    assertEqual(addBlocks[0].right[0].text, 'b', 'add 块右侧为新行');
  }

  // 纯删除：左侧有内容，右侧空
  var r3 = Diff.compare('a\nb', 'a');
  var delBlocks = r3.blocks.filter(function (b) { return b.type === 'del'; });
  assert(delBlocks.length >= 1, '存在 del 块');
  if (delBlocks.length > 0) {
    assertEqual(delBlocks[0].left[0].text, 'b', 'del 块左侧为删除行');
    assertEqual(delBlocks[0].right[0].text, '', 'del 块右侧为空');
  }
})();

// ========== toInlineBlocks ==========
group('toInlineBlocks');
(function () {
  var r = Diff.compare('a\nb\nc', 'a\nX\nc');
  assertEqual(r.inline.length, 4, '内联视图 4 行');
  assertEqual(r.inline[0], { type: 'equal', text: 'a' }, '行1 equal');
  assertEqual(r.inline[1], { type: 'del', text: 'b' }, '行2 del b');
  assertEqual(r.inline[2], { type: 'add', text: 'X' }, '行3 add X');
  assertEqual(r.inline[3], { type: 'equal', text: 'c' }, '行4 equal');
})();

// ========== toUnifiedDiff ==========
group('toUnifiedDiff');
(function () {
  var u = Diff.toUnifiedDiff('a\nb\nc', 'a\nX\nc', { headerA: '原.txt', headerB: '新.txt' });
  var lines = u.split('\n');
  assertEqual(lines[0], '--- 原.txt', 'unified 头1');
  assertEqual(lines[1], '+++ 新.txt', 'unified 头2');
  assert(lines[2].indexOf('@@') === 0, 'unified 有 hunk 头');
  // 检查 +/- 行
  var hasPlus = lines.some(function (l) { return l.charAt(0) === '+'; });
  var hasMinus = lines.some(function (l) { return l.charAt(0) === '-'; });
  assert(hasPlus, 'unified 有 + 行');
  assert(hasMinus, 'unified 有 - 行');
})();

// ========== summaryText ==========
group('summaryText');
(function () {
  var r = Diff.compare('a\nb', 'a\nB');
  var s = Diff.summaryText(r);
  assert(s.indexOf('新增行：1') >= 0, '摘要包含新增行');
  assert(s.indexOf('删除行：1') >= 0, '摘要包含删除行');
  assert(s.indexOf('未变化：1') >= 0, '摘要包含未变化');
})();

// ========== 大输入保护 ==========
group('大输入保护');
(function () {
  // 超大输入应退化为整体替换，不崩溃
  var big = '';
  for (var i = 0; i < 3000; i++) big += 'line' + i + '\n';
  var big2 = big + 'extra';
  var r = Diff.compare(big, big2);
  assert(r.stats != null, '大输入返回结果有 stats');
  assert(r.ops.length >= 1, '大输入有 ops');
})();

// ========== 真实场景：JSON 配置对比 ==========
group('真实场景 JSON');
(function () {
  var a = JSON.stringify({ name: 'app', version: '1.0.0', port: 3000 }, null, 2);
  var b = JSON.stringify({ name: 'app', version: '1.1.0', port: 3000, debug: true }, null, 2);
  var r = Diff.compare(a, b);
  assert(r.stats.added >= 1, 'JSON 新增行');
  assert(r.stats.deleted >= 1, 'JSON 删除行');
})();

// ========== 真实场景：代码对比 ==========
group('真实场景 代码');
(function () {
  var a = [
    'function add(a, b) {',
    '  return a + b;',
    '}',
    ''
  ].join('\n');
  var b = [
    'function add(a, b) {',
    '  return a + b;',
    '}',
    '',
    'function sub(a, b) {',
    '  return a - b;',
    '}'
  ].join('\n');
  var r = Diff.compare(a, b);
  assertEqual(r.stats.added, 4, '代码新增 4 行');
  assertEqual(r.stats.deleted, 0, '代码无删除');
})();

// ========== 结果 ==========
console.log('\n========================');
console.log('通过：' + pass + ' · 失败：' + fail);
console.log('========================');
if (fail > 0) {
  console.log('\n失败用例：');
  errors.forEach(function (e) { console.log('  ✗ ' + e); });
  process.exit(1);
} else {
  console.log('\n✓ 全部通过');
  process.exit(0);
}
