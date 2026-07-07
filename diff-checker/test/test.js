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

// ========== v1.1 新增：实时对比场景回归 ==========
group('live-compare regressions');
(function () {
  // 实时对比模式开启时，输入变化会触发 compare；引擎层应保持稳定
  // 场景1：一侱乐园空 → 有内容
  var r1 = Diff.compare('', 'hello\nworld');
  assertEqual(r1.stats.added, 2, '空→2行 新增2');
  assertEqual(r1.stats.deleted, 0, '空→2行 无删除');

  // 场景2：两侧都空（实时模式刚清空时）
  var r2 = Diff.compare('', '');
  assertEqual(r2.stats.added, 0, '空→空 新增0');
  assertEqual(r2.stats.deleted, 0, '空→空 删除0');
  assertEqual(r2.stats.unchanged, 0, '空→空 相同0');

  // 场景3：快速连续输入时引擎稳定性（同行修改：a → ab）
  var r3 = Diff.compare('a', 'ab');
  // 引擎按行 diff 处理：单行内容变化算作 modify（del 1 + add 1）
  assertEqual(r3.stats.added, 1, 'a→ab 新增1');
  assertEqual(r3.stats.deleted, 1, 'a→ab 删除1（按行计为 modify）');

  // 场景4：仅大小写差异 + ignoreCase（实时切换选项）
  var r4 = Diff.compare('Hello', 'hello', { ignoreCase: true });
  assertEqual(r4.stats.unchanged, 1, 'Hello vs hello ignoreCase 相同1');
  assertEqual(r4.stats.added + r4.stats.deleted, 0, 'Hello vs hello ignoreCase 无增删');

  // 场景5：仅首尾空白差异 + trimWhitespace
  var r5 = Diff.compare('  hello  ', 'hello', { trimWhitespace: true });
  assertEqual(r5.stats.unchanged, 1, '空白差异 trimWhitespace 相同1');
  assertEqual(r5.stats.added + r5.stats.deleted, 0, '空白差异 trimWhitespace 无增删');
})();

// ========== v1.1 新增：unified diff 在实时模式下的稳定性 ==========
group('unified diff live mode');
(function () {
  // 实时模式下可能频繁生成 unified diff，验证多次调用结果一致
  var a = 'line1\nline2\nline3';
  var b = 'line1\nchanged\nline3';
  var u1 = Diff.toUnifiedDiff(a, b, { headerA: '原文本', headerB: '新文本', context: 3 });
  var u2 = Diff.toUnifiedDiff(a, b, { headerA: '原文本', headerB: '新文本', context: 3 });
  assertEqual(u1, u2, '相同输入 unified diff 幂等');

  // 空输入的 unified diff 不应抛错
  var uEmpty = Diff.toUnifiedDiff('', '', { headerA: '原文本', headerB: '新文本', context: 3 });
  assertEqual(typeof uEmpty, 'string', '空输入 unified 返回字符串');
})();

// ========== v1.1 修复：charDiff emoji 代理对 ==========
group('charDiff emoji 代理对');
(function () {
  // 此前用 charAt 按 UTF-16 code unit 切分，会把 emoji 拆成两个代理半位
  var d = Diff.charDiff('a😀b', 'a😀c');
  var eqText = d.filter(function (s) { return s.type === 'equal'; }).map(function (s) { return s.text; }).join('');
  var delText = d.filter(function (s) { return s.type === 'del'; }).map(function (s) { return s.text; }).join('');
  var addText = d.filter(function (s) { return s.type === 'add'; }).map(function (s) { return s.text; }).join('');
  // 'a😀' 应作为一个整体出现在 equal 段（emoji 未被拆分）
  assertEqual(eqText, 'a😀', 'emoji 等同部分完整保留');
  assertEqual(delText, 'b', 'emoji 行删除部分=b');
  assertEqual(addText, 'c', 'emoji 行新增部分=c');

  // 多个 emoji 连续
  var d2 = Diff.charDiff('🎉🎊', '🎉🎈');
  var eq2 = d2.filter(function (s) { return s.type === 'equal'; }).map(function (s) { return s.text; }).join('');
  assertEqual(eq2, '🎉', '多 emoji 公共部分=🎉');
})();

// ========== v1.1 修复：charDiff 大小保护 ==========
group('charDiff 大小保护');
(function () {
  // 3000×3000 = 900万 cell > 500万上限，应退化为整体替换，不崩溃
  var big1 = '';
  var big2 = '';
  for (var i = 0; i < 3000; i++) { big1 += 'a'; big2 += 'b'; }
  var d = Diff.charDiff(big1, big2);
  assertEqual(d.length, 2, '超长输入退化为 2 段（del+add）');
  assertEqual(d[0].type, 'del', '第一段为 del');
  assertEqual(d[1].type, 'add', '第二段为 add');
  assertEqual(d[0].text, big1, 'del 段文本完整');
  assertEqual(d[1].text, big2, 'add 段文本完整');
})();

// ========== v1.1 修复：toUnifiedDiff 前导/后继上下文 + 行号 ==========
group('toUnifiedDiff 上下文与行号');
(function () {
  // 改动在中间，前后各 3 行上下文
  var a = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10';
  var b = 'l1\nl2\nl3\nl4\nCHANGED\nl6\nl7\nl8\nl9\nl10';
  var u = Diff.toUnifiedDiff(a, b, { context: 3 });
  var lines = u.split('\n');
  // 头两行是 --- / +++
  assertEqual(lines[0].indexOf('--- '), 0, 'unified 头 ---');
  assertEqual(lines[1].indexOf('+++ '), 0, 'unified 头 +++');
  // 第3行是 hunk header：@@ -2,9 +2,9 @@
  // 前导3行(l2,l3,l4) + 改动1行(l5/CHANGED) + 后继5行(l6-l10，因 5<=2*ctx 全部并入) = 9
  var header = lines[2];
  assert(header.indexOf('@@') === 0, '第3行是 hunk header');
  assert(header.indexOf('-2,9') >= 0, 'hunk header A 侧行号=2,9  实际=' + header);
  assert(header.indexOf('+2,9') >= 0, 'hunk header B 侧行号=2,9  实际=' + header);
  // hunk 第1行应是前导上下文 ' l2'（空格前缀）
  assertEqual(lines[3], ' l2', 'hunk 首行为前导上下文 l2');
  // hunk 应包含 -l5 和 +CHANGED
  var hasDelL5 = lines.indexOf('-l5') >= 0;
  var hasAddChanged = lines.indexOf('+CHANGED') >= 0;
  assert(hasDelL5, 'hunk 包含 -l5');
  assert(hasAddChanged, 'hunk 包含 +CHANGED');
  // hunk 最后一行应是后继上下文 ' l10'
  var lastContentLine = lines[lines.length - 1];
  assertEqual(lastContentLine, ' l10', 'hunk 末行为后继上下文 l10');
})();

// ========== v1.1 修复：toUnifiedDiff 多 hunk 分割 ==========
group('toUnifiedDiff 多 hunk');
(function () {
  // 两个相距很远的改动（中间 12 行 equal > 2*ctx=6），应分割为 2 个 hunk
  var a = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15';
  var b = '1\nX\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\nY';
  var u = Diff.toUnifiedDiff(a, b, { context: 3 });
  var headerLines = u.split('\n').filter(function (l) { return l.indexOf('@@') === 0; });
  assertEqual(headerLines.length, 2, '两个相距远的改动产生 2 个 hunk');
  // 第一个 hunk：改动在第2行，前导1行(1)，后继3行(3,4,5) → @@ -1,5 +1,5 @@
  assert(headerLines[0].indexOf('-1,5') >= 0, 'hunk1 A 侧行号=1,5  实际=' + headerLines[0]);
  // 第二个 hunk：改动在第15行，前导3行(12,13,14)，后继0行 → @@ -12,4 +12,4 @@
  assert(headerLines[1].indexOf('-12,4') >= 0, 'hunk2 A 侧行号=12,4  实际=' + headerLines[1]);
})();

// ========== v1.1 修复：toSideBySideBlocks 空行配对 ==========
group('toSideBySideBlocks 空行配对');
(function () {
  // 删除一个空行 + 新增非空行：此前会被误判为纯 add 块，空行删除丢失
  var r = Diff.compare('\nhello', 'world');
  var modifyBlocks = r.blocks.filter(function (b) { return b.type === 'modify'; });
  var delBlocks = r.blocks.filter(function (b) { return b.type === 'del'; });
  // 应存在 modify 块：左侧空字符串 vs 右侧 'world'
  assert(modifyBlocks.length >= 1, '空行 vs 非空行 配对为 modify 块');
  if (modifyBlocks.length > 0) {
    assertEqual(modifyBlocks[0].left[0].text, '', 'modify 块左侧为空字符串');
    assertEqual(modifyBlocks[0].right[0].text, 'world', 'modify 块右侧为 world');
  }
  // 'hello' 行应作为 del 块显示
  assert(delBlocks.length >= 1, '剩余 hello 行作为 del 块');
  if (delBlocks.length > 0) {
    assertEqual(delBlocks[0].left[0].text, 'hello', 'del 块左侧为 hello');
  }
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
