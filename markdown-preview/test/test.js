/**
 * MarkdownParser 测试套件
 * 覆盖所有语法功能、中文排版优化、XSS 防护、边界情况
 * 用法：node test/test.js
 */
var assert = require('assert');
var MarkdownParser = require('../markdown-parser');

var parse = MarkdownParser.parseMarkdown;
var escapeHtml = MarkdownParser.escapeHtml;
var addChineseSpaces = MarkdownParser.addChineseSpaces;

var total = 0;
var passed = 0;
var failed = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name);
    console.log('    错误: ' + e.message);
  }
}

function contains(str, sub, msg) {
  assert.ok(str.indexOf(sub) !== -1, msg || '应包含 "' + sub + '"');
}

console.log('--- MarkdownParser 测试 ---\n');

// ======================== 标题 ========================

test('h1 标题', function () {
  assert.strictEqual(parse('# Hello'), '<h1>Hello</h1>');
});

test('h2 标题', function () {
  assert.strictEqual(parse('## World'), '<h2>World</h2>');
});

test('h3-h6 标题', function () {
  assert.strictEqual(parse('### Third'), '<h3>Third</h3>');
  assert.strictEqual(parse('###### Sixth'), '<h6>Sixth</h6>');
});

test('标题去掉末尾 #', function () {
  assert.strictEqual(parse('## Title ##'), '<h2>Title</h2>');
});

test('标题内容中的行内格式', function () {
  assert.strictEqual(parse('# **Bold** and *Italic*'), '<h1><strong>Bold</strong> and <em>Italic</em></h1>');
});

// ======================== 段落与换行 ========================

test('普通段落', function () {
  assert.strictEqual(parse('Hello World'), '<p>Hello World</p>');
});

test('段落间空行分隔', function () {
  assert.strictEqual(parse('Para 1\n\nPara 2'), '<p>Para 1</p>\n<p>Para 2</p>');
});

test('两空格换行转为 br', function () {
  var result = parse('Line 1  \nLine 2');
  assert.strictEqual(result, '<p>Line 1<br> Line 2</p>');
});

// ======================== 行内格式 ========================

test('粗体 **text**', function () {
  assert.strictEqual(parse('**bold**'), '<p><strong>bold</strong></p>');
});

test('斜体 *text*', function () {
  assert.strictEqual(parse('*italic*'), '<p><em>italic</em></p>');
});

test('粗斜体 ***text***', function () {
  assert.strictEqual(parse('***both***'), '<p><strong><em>both</em></strong></p>');
});

test('删除线 ~~text~~', function () {
  assert.strictEqual(parse('~~deleted~~'), '<p><del>deleted</del></p>');
});

test('行内代码 `code`', function () {
  assert.strictEqual(parse('Use `console.log`'), '<p>Use <code>console.log</code></p>');
});

test('行内代码不解析内部格式', function () {
  assert.strictEqual(parse('`**not bold**`'), '<p><code>**not bold**</code></p>');
});

// ======================== 链接与图片 ========================

test('链接 [text](url)', function () {
  assert.strictEqual(parse('[Google](https://google.com)'), '<p><a href="https://google.com">Google</a></p>');
});

test('图片 ![alt](url)', function () {
  assert.strictEqual(parse('![Logo](logo.png)'), '<p><img src="logo.png" alt="Logo"></p>');
});

test('自动链接 <url>', function () {
  assert.strictEqual(parse('<https://example.com>'), '<p><a href="https://example.com">https://example.com</a></p>');
});

test('自动链接不识别非 http URL', function () {
  assert.strictEqual(parse('<ftp://file.txt>'), '<p>&lt;ftp://file.txt&gt;</p>');
});

// ======================== 代码块 ========================

test('代码块保留语言标记', function () {
  var md = '```javascript\nvar x = 1;\n```';
  var expected = '<pre><code class="language-javascript">var x = 1;</code></pre>';
  assert.strictEqual(parse(md), expected);
});

test('无语言代码块', function () {
  var md = '```\ncode\n```';
  var expected = '<pre><code>code</code></pre>';
  assert.strictEqual(parse(md), expected);
});

test('代码块内 HTML 转义', function () {
  var md = '```\n<div>&</div>\n```';
  var expected = '<pre><code>&lt;div&gt;&amp;&lt;/div&gt;</code></pre>';
  assert.strictEqual(parse(md), expected);
});

// ======================== 引用块 ========================

test('单层引用', function () {
  assert.strictEqual(parse('> Quote'), '<blockquote><p>Quote</p></blockquote>');
});

test('多行引用', function () {
  var md = '> Line 1\n> Line 2';
  var result = parse(md);
  contains(result, '<blockquote>');
});

// ======================== 列表 ========================

test('无序列表', function () {
  var md = '- item 1\n- item 2\n- item 3';
  assert.strictEqual(parse(md), '<ul>\n<li>item 1</li>\n<li>item 2</li>\n<li>item 3</li>\n</ul>');
});

test('有序列表', function () {
  var md = '1. first\n2. second\n3. third';
  assert.strictEqual(parse(md), '<ol>\n<li>first</li>\n<li>second</li>\n<li>third</li>\n</ol>');
});

test('任务列表（未完成）', function () {
  assert.strictEqual(parse('- [ ] todo'), '<ul>\n<li><input type="checkbox" disabled> todo</li>\n</ul>');
});

test('任务列表（已完成）', function () {
  assert.strictEqual(parse('- [x] done'), '<ul>\n<li class="task-checked"><input type="checkbox" checked disabled> done</li>\n</ul>');
});

// ======================== 分隔线 ========================

test('分隔线 ---', function () {
  assert.strictEqual(parse('---'), '<hr>');
});

test('分隔线 ***', function () {
  assert.strictEqual(parse('***'), '<hr>');
});

test('分隔线 ___', function () {
  assert.strictEqual(parse('___'), '<hr>');
});

// ======================== 表格 ========================

test('基本表格', function () {
  var md = '| A | B |\n|---|---|\n| 1 | 2 |';
  var result = parse(md);
  contains(result, '<table>');
  contains(result, '>A</th>');
  contains(result, '>B</th>');
  contains(result, '>1</td>');
  contains(result, '>2</td>');
});

test('表格对齐', function () {
  var md = '| Left | Center | Right |\n|:-----|:------:|------:|\n| a | b | c |';
  var result = parse(md);
  contains(result, 'text-align:left');
  contains(result, 'text-align:center');
  contains(result, 'text-align:right');
});

// ======================== 中文排版优化 ========================

test('中英文之间自动加空格', function () {
  assert.strictEqual(addChineseSpaces('你好World'), '你好 World');
  assert.strictEqual(addChineseSpaces('Hello你好'), 'Hello 你好');
  assert.strictEqual(addChineseSpaces('版本1.0已发布'), '版本 1.0 已发布');
});

test('中文和英文混合解析', function () {
  var result = parse('这是JavaScript代码');
  contains(result, 'JavaScript');
  contains(result, '这是');
});

// ======================== XSS 转义 ========================

test('HTML 特殊字符转义', function () {
  assert.strictEqual(escapeHtml('<script>'), '&lt;script&gt;');
  assert.strictEqual(escapeHtml('a & b'), 'a &amp; b');
  assert.strictEqual(escapeHtml('"quoted"'), '&quot;quoted&quot;');
  assert.strictEqual(escapeHtml("it's"), 'it&#39;s');
});

test('段落中的 XSS 防护', function () {
  var result = parse('<img src=x onerror=alert(1)>');
  assert.ok(result.indexOf('<img') === -1, '不应包含原始 img 标签');
  contains(result, '&lt;img');
});

// ======================== 边界情况 ========================

test('空字符串', function () {
  assert.strictEqual(parse(''), '');
});

test('null/undefined 输入', function () {
  assert.strictEqual(parse(null), '');
  assert.strictEqual(parse(undefined), '');
});

test('纯换行', function () {
  assert.strictEqual(parse('\n\n\n'), '');
});

test('多语法混合', function () {
  var md = '# Title\n\n**Bold** and `code`\n\n- list\n\n> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |';
  var result = parse(md);
  contains(result, '<h1>Title</h1>');
  contains(result, '<strong>Bold</strong>');
  contains(result, '<code>code</code>');
  contains(result, '<ul>');
  contains(result, '<blockquote>');
  contains(result, '<table>');
});

test('链接中的中文文字', function () {
  assert.strictEqual(parse('[百度](https://baidu.com)'), '<p><a href="https://baidu.com">百度</a></p>');
});

// ======================== 测试结果汇总 ========================

console.log('\n--- 结果 ---');
if (failed === 0) {
  console.log('全部通过 ' + passed + '/' + total);
} else {
  console.log('失败 ' + failed + '/' + total);
  process.exit(1);
}
