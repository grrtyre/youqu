// 正则管家 - 核心逻辑测试
// 运行：node test/test.js

'use strict';

const assert = require('assert');
const { executeRegex, executeReplace, buildHighlightSegments, escapeHtml, escapeRegExp, parseFlags } = require('../src/core/regex-engine');
const { PATTERNS } = require('../src/core/pattern-library');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    ' + e.message);
  }
}

console.log('\n========== 正则管家 测试 ==========\n');

// ========== executeRegex 测试 ==========
console.log('【executeRegex 匹配测试】');

test('简单数字匹配', () => {
  const r = executeRegex('\\d+', 'g', 'abc123def456');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 2);
  assert.strictEqual(r.matches[0].value, '123');
  assert.strictEqual(r.matches[1].value, '456');
});

test('非全局模式只匹配第一个', () => {
  const r = executeRegex('\\d+', '', 'abc123def456');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].value, '123');
  assert.strictEqual(r.matches[0].index, 3);
});

test('捕获组提取', () => {
  const r = executeRegex('(\\d+)-(\\d+)', 'g', '12-34 56-78');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 2);
  assert.strictEqual(r.matches[0].groups[0], '12');
  assert.strictEqual(r.matches[0].groups[1], '34');
  assert.strictEqual(r.matches[1].groups[0], '56');
  assert.strictEqual(r.matches[1].groups[1], '78');
});

test('命名捕获组', () => {
  const r = executeRegex('(?<year>\\d{4})-(?<month>\\d{2})', '', '2026-07');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].namedGroups.year, '2026');
  assert.strictEqual(r.matches[0].namedGroups.month, '07');
});

test('忽略大小写标志', () => {
  const r = executeRegex('hello', 'gi', 'Hello HELLO hello');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 3);
});

test('空正则返回错误', () => {
  const r = executeRegex('', 'g', 'test');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.matches.length, 0);
});

test('语法错误返回错误', () => {
  const r = executeRegex('[invalid', 'g', 'test');
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes('语法错误'));
});

test('零宽匹配不死循环', () => {
  const r = executeRegex('(?=\\d)', 'g', 'abc123');
  assert.strictEqual(r.ok, true);
  assert.ok(r.matches.length <= 10);
});

test('无匹配时返回空数组', () => {
  const r = executeRegex('xyz', 'g', 'abc123');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.matches.length, 0);
});

test('匹配索引和结束位置正确', () => {
  const r = executeRegex('world', 'g', 'hello world');
  assert.strictEqual(r.matches[0].index, 6);
  assert.strictEqual(r.matches[0].end, 11);
});

test('groupCount 正确统计', () => {
  const r = executeRegex('(a)(b)(c)', '', 'abc');
  assert.strictEqual(r.groupCount, 3);
});

// ========== executeReplace 测试 ==========
console.log('\n【executeReplace 替换测试】');

test('简单替换', () => {
  const r = executeReplace('\\d+', 'g', 'abc123def456', 'NUM');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.result, 'abcNUMdefNUM');
  assert.strictEqual(r.replacements, 2);
});

test('捕获组替换 $1 $2', () => {
  const r = executeReplace('(\\d+)-(\\d+)', 'g', '12-34', '$2-$1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.replacements, 1);
  // 注意：$2-$1 在 JS replace 中是原生处理的
  assert.strictEqual(r.result, '34-12');
});

test('非全局标志自动补全为全局替换', () => {
  const r = executeReplace('a', '', 'aaa', 'b');
  assert.strictEqual(r.replacements, 3);
  assert.strictEqual(r.result, 'bbb');
});

test('无匹配时替换数 为 0', () => {
  const r = executeReplace('xyz', 'g', 'abc', 'Q');
  assert.strictEqual(r.replacements, 0);
  assert.strictEqual(r.result, 'abc');
});

test('空正则返回错误', () => {
  const r = executeReplace('', 'g', 'abc', 'X');
  assert.strictEqual(r.ok, false);
});

// ========== buildHighlightSegments 测试 ==========
console.log('\n【buildHighlightSegments 高亮分段测试】');

test('正确分段匹配文本', () => {
  const r = executeRegex('\\d+', 'g', 'a1b2c3');
  const segs = buildHighlightSegments('a1b2c3', r.matches);
  assert.strictEqual(segs.length, 6);
  assert.strictEqual(segs[0].text, 'a');
  assert.strictEqual(segs[0].isMatch, false);
  assert.strictEqual(segs[1].text, '1');
  assert.strictEqual(segs[1].isMatch, true);
  assert.strictEqual(segs[2].text, 'b');
  assert.strictEqual(segs[2].isMatch, false);
});

test('无匹配时返回整段', () => {
  const segs = buildHighlightSegments('hello', []);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].text, 'hello');
  assert.strictEqual(segs[0].isMatch, false);
});

test('空字符串返回空数组', () => {
  const segs = buildHighlightSegments('', []);
  assert.strictEqual(segs.length, 0);
});

test('首尾匹配分段正确', () => {
  const r = executeRegex('\\w+', 'g', 'hello');
  const segs = buildHighlightSegments('hello', r.matches);
  assert.strictEqual(segs.length, 1);
  assert.strictEqual(segs[0].isMatch, true);
});

// ========== escapeHtml 测试 ==========
console.log('\n【escapeHtml 转义测试】');

test('转义 HTML 特殊字符', () => {
  assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
  assert.strictEqual(escapeHtml('"quote"'), '&quot;quote&quot;');
  assert.strictEqual(escapeHtml("'apostrophe'"), '&#39;apostrophe&#39;');
  assert.strictEqual(escapeHtml('&amp;'), '&amp;amp;');
});

test('null/undefined 返回空字符串', () => {
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
});

// ========== escapeRegExp 测试 ==========
console.log('\n【escapeRegExp 正则转义测试】');

test('转义正则元字符', () => {
  assert.strictEqual(escapeRegExp('a.b*c'), 'a\\.b\\*c');
  assert.strictEqual(escapeRegExp('[test]'), '\\[test\\]');
  assert.strictEqual(escapeRegExp('$100'), '\\$100');
});

test('空字符串返回空', () => {
  assert.strictEqual(escapeRegExp(''), '');
  assert.strictEqual(escapeRegExp(null), '');
});

// ========== parseFlags 测试 ==========
console.log('\n【parseFlags 标志解析测试】');

test('正确解析标志', () => {
  const f = parseFlags('gim');
  assert.strictEqual(f.global, true);
  assert.strictEqual(f.ignoreCase, true);
  assert.strictEqual(f.multiline, true);
  assert.strictEqual(f.dotAll, false);
  assert.strictEqual(f.unicode, false);
  assert.strictEqual(f.sticky, false);
});

test('空标志全部为 false', () => {
  const f = parseFlags('');
  assert.strictEqual(f.global, false);
  assert.strictEqual(f.ignoreCase, false);
});

// ========== pattern-library 测试 ==========
console.log('\n【pattern-library 模式库测试】');

test('模式库不为空', () => {
  assert.ok(PATTERNS.length > 0);
});

test('每个模式都有必需字段', () => {
  PATTERNS.forEach(cat => {
    assert.ok(cat.category, '分类名缺失');
    assert.ok(cat.items.length > 0, '分类 ' + cat.category + ' 无条目');
    cat.items.forEach(item => {
      assert.ok(item.name, '名称缺失');
      assert.ok(item.pattern, '正则缺失: ' + item.name);
      assert.ok(item.description, '描述缺失: ' + item.name);
    });
  });
});

test('模式库中的正则都能编译', () => {
  PATTERNS.forEach(cat => {
    cat.items.forEach(item => {
      try {
        new RegExp(item.pattern, item.flags);
      } catch (e) {
        assert.fail('模式编译失败 ' + item.name + ': ' + e.message);
      }
    });
  });
});

test('邮箱模式能匹配邮箱', () => {
  const emailPattern = PATTERNS.find(c => c.category === '邮箱与网址').items.find(i => i.name === '邮箱地址');
  const r = executeRegex(emailPattern.pattern, emailPattern.flags, 'test@example.com');
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].value, 'test@example.com');
});

test('IPv4 模式能匹配 IP', () => {
  const ipPattern = PATTERNS.find(c => c.category === '网络与 IP').items.find(i => i.name === 'IPv4 地址');
  const r = executeRegex(ipPattern.pattern, ipPattern.flags, '192.168.1.1');
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].value, '192.168.1.1');
});

test('手机号模式能匹配手机号', () => {
  const phonePattern = PATTERNS.find(c => c.category === '手机与证件').items.find(i => i.name === '手机号（中国大陆）');
  const r = executeRegex(phonePattern.pattern, phonePattern.flags, '13812345678');
  assert.strictEqual(r.matches.length, 1);
  assert.strictEqual(r.matches[0].value, '13812345678');
});

// ========== 结果 ==========
console.log('\n========== 测试结果 ==========');
console.log(`  通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`);
console.log('');

if (failed > 0) {
  console.log('❌ 测试未通过！');
  process.exit(1);
} else {
  console.log('✅ 全部测试通过！');
  process.exit(0);
}
