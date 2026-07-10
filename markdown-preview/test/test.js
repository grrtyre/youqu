/**
 * MarkdownParser 测试套件
 * 覆盖所有语法功能、中文排版优化、XSS 防护、边界情况
 * 用法：node test/test.js
 */
var assert = require('assert');
var MarkdownParser = require('../markdown-parser');

var parse = MarkdownParser.parseMarkdown;
var escapeHtml = MarkdownParser.escapeHtml;
var escapeAttr = MarkdownParser.escapeAttr;
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

test('addChineseSpaces 不破坏 HTML 标签', function () {
  // 标签内的属性不应被插入空格
  assert.strictEqual(addChineseSpaces('<a href="./中文doc.html">文档</a>'), '<a href="./中文doc.html">文档</a>');
  assert.strictEqual(addChineseSpaces('<img src="assets/中文img.png" alt="图">'), '<img src="assets/中文img.png" alt="图">');
  // 标签外的文本节点仍应被处理
  assert.strictEqual(addChineseSpaces('<p>你好World</p>'), '<p>你好 World</p>');
  // 空字符串与无标签文本
  assert.strictEqual(addChineseSpaces(''), '');
  assert.strictEqual(addChineseSpaces('中文abc'), '中文 abc');
});

test('链接 URL 含中文不被破坏', function () {
  // 链接的 href 含中文字符时不应被插入空格
  var result = parse('[文档](./中文doc.html)');
  contains(result, 'href="./中文doc.html"');
  assert.ok(result.indexOf('中文 doc.html') === -1, 'URL 中不应被插入空格');
});

test('图片 src 含中文不被破坏', function () {
  var result = parse('![图](assets/中文img.png)');
  contains(result, 'src="assets/中文img.png"');
  assert.ok(result.indexOf('中文 img.png') === -1, 'src 中不应被插入空格');
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

// ======================== slugify ========================

var slugify = MarkdownParser.slugify;

test('slugify 纯英文', function () {
  assert.strictEqual(slugify('Hello World'), 'hello-world');
});

test('slugify 中文保留', function () {
  assert.strictEqual(slugify('欢迎使用 Markdown'), '欢迎使用-markdown');
});

test('slugify 标点替换为连字符', function () {
  assert.strictEqual(slugify('A, B; C!'), 'a-b-c');
});

test('slugify 去掉行内 markdown 标记', function () {
  assert.strictEqual(slugify('**Bold** and *Italic*'), 'bold-and-italic');
});

test('slugify 去掉链接语法保留文本', function () {
  assert.strictEqual(slugify('[链接](https://example.com)'), '链接');
});

test('slugify 合并连续连字符', function () {
  assert.strictEqual(slugify('A---B'), 'a-b');
});

test('slugify 去首尾连字符', function () {
  assert.strictEqual(slugify('!!!Hello!!!'), 'hello');
});

test('slugify 空输入', function () {
  assert.strictEqual(slugify(''), '');
  assert.strictEqual(slugify(null), '');
  assert.strictEqual(slugify(undefined), '');
});

test('slugify 纯数字', function () {
  assert.strictEqual(slugify('2026 年总结'), '2026-年总结');
});

// ======================== extractToc ========================

var extractToc = MarkdownParser.extractToc;

test('extractToc 提取多级标题', function () {
  var md = '# Title\n\n## Section A\n\n### Subsection\n\n## Section B';
  var toc = extractToc(md);
  assert.strictEqual(toc.length, 4);
  assert.strictEqual(toc[0].level, 1);
  assert.strictEqual(toc[0].text, 'Title');
  assert.strictEqual(toc[1].level, 2);
  assert.strictEqual(toc[1].text, 'Section A');
  assert.strictEqual(toc[2].level, 3);
  assert.strictEqual(toc[3].text, 'Section B');
});

test('extractToc 跳过代码块内的 # 行', function () {
  var md = '# Title\n\n```\n# not a heading\nfoo\n```\n\n## Real';
  var toc = extractToc(md);
  assert.strictEqual(toc.length, 2);
  assert.strictEqual(toc[0].text, 'Title');
  assert.strictEqual(toc[1].text, 'Real');
});

test('extractToc 去掉行内格式后输出纯文本', function () {
  var md = '# **Bold** Title\n## `Code` Heading';
  var toc = extractToc(md);
  assert.strictEqual(toc[0].text, 'Bold Title');
  assert.strictEqual(toc[1].text, 'Code Heading');
});

test('extractToc 生成 slug 用于锚点', function () {
  var toc = extractToc('# 欢迎使用');
  assert.strictEqual(toc[0].slug, '欢迎使用');
});

test('extractToc 忽略 Setext 风格标题', function () {
  var md = 'Title\n=====\n\nParagraph';
  var toc = extractToc(md);
  assert.strictEqual(toc.length, 0);
});

test('extractToc 空输入', function () {
  assert.strictEqual(extractToc('').length, 0);
  assert.strictEqual(extractToc(null).length, 0);
  assert.strictEqual(extractToc('无标题的纯文本').length, 0);
});

test('extractToc 处理末尾 # 标记', function () {
  var toc = extractToc('## Section ##');
  assert.strictEqual(toc[0].text, 'Section');
});

// ======================== highlightCode ========================

var highlightCode = MarkdownParser.highlightCode;

test('highlightCode 无语言时返回纯 escape', function () {
  var out = highlightCode('var x = 1;', '');
  assert.strictEqual(out, 'var x = 1;');
});

test('highlightCode 未识别语言返回纯 escape', function () {
  var out = highlightCode('foo bar', 'klingon');
  assert.strictEqual(out, 'foo bar');
});

test('highlightCode HTML 字符正确转义', function () {
  var out = highlightCode('<div>text</div>', 'html');
  contains(out, '<span class="tok-tag">&lt;div</span>');
  contains(out, '<span class="tok-tag">&lt;/div</span>');
  contains(out, 'text');
});

test('highlightCode JS 关键字高亮', function () {
  var out = highlightCode('function hello() { return 1; }', 'js');
  contains(out, '<span class="tok-keyword">function</span>');
  contains(out, '<span class="tok-keyword">return</span>');
  contains(out, '<span class="tok-number">1</span>');
});

test('highlightCode JS 字符串高亮', function () {
  var out = highlightCode('var s = "hello";', 'javascript');
  contains(out, '<span class="tok-string">&quot;hello&quot;</span>');
});

test('highlightCode JS 注释高亮', function () {
  var out = highlightCode('// comment\nvar x;', 'js');
  contains(out, '<span class="tok-comment">// comment</span>');
});

test('highlightCode Python 注释高亮', function () {
  var out = highlightCode('# python comment\nx = 1', 'python');
  contains(out, '<span class="tok-comment"># python comment</span>');
});

test('highlightCode JSON key 着色', function () {
  var out = highlightCode('{"name": "value"}', 'json');
  contains(out, 'tok-key');
  contains(out, 'tok-string');
});

test('highlightCode CSS 数字带单位', function () {
  var out = highlightCode('width: 100px;', 'css');
  contains(out, 'tok-attr');
});

test('highlightCode SQL 大小写不敏感关键字', function () {
  var out = highlightCode('select * from users', 'sql');
  contains(out, 'tok-keyword');
});

test('highlightCode 别名 js 等价 javascript', function () {
  var a = highlightCode('var x = 1;', 'js');
  var b = highlightCode('var x = 1;', 'javascript');
  assert.strictEqual(a, b);
});

test('highlightCode 别名 py 等价 python', function () {
  var a = highlightCode('x = 1', 'py');
  var b = highlightCode('x = 1', 'python');
  assert.strictEqual(a, b);
});

test('highlightCode language- 前缀剥离', function () {
  var a = highlightCode('var x = 1;', 'language-js');
  var b = highlightCode('var x = 1;', 'js');
  assert.strictEqual(a, b);
});

test('highlightCode 空输入', function () {
  assert.strictEqual(highlightCode('', 'js'), '');
  assert.strictEqual(highlightCode(null, 'js'), '');
});

test('highlightCode 字符串中的关键字不被错误着色', function () {
  // "function" 在字符串里不应被 tok-keyword 包裹
  var out = highlightCode('var s = "function foo";', 'js');
  // 字符串整体应被 tok-string 包裹
  contains(out, 'tok-string');
  // 不应出现嵌套的 tok-keyword（粗略验证：keyword span 数量应为 1，即 var）
  var keywordCount = (out.match(/tok-keyword/g) || []).length;
  assert.strictEqual(keywordCount, 1);
});

// ======================== parseMarkdown 高亮选项 ========================

test('parseMarkdown 默认不高亮代码块', function () {
  var md = '```js\nvar x = 1;\n```';
  var out = parse(md);
  assert.strictEqual(out, '<pre><code class="language-js">var x = 1;</code></pre>');
});

test('parseMarkdown options.highlight 启用高亮', function () {
  var md = '```js\nvar x = 1;\n```';
  var out = parse(md, { highlight: true });
  contains(out, '<span class="tok-keyword">var</span>');
  contains(out, '<span class="tok-number">1</span>');
  contains(out, 'class="language-js"');
});

test('parseMarkdown options.highlight 无语言代码块不高亮', function () {
  var md = '```\nplain text\n```';
  var out = parse(md, { highlight: true });
  assert.strictEqual(out, '<pre><code>plain text</code></pre>');
});

test('parseMarkdown options.highlight 引用块内代码块也高亮', function () {
  var md = '> ```js\n> var x = 1;\n> ```';
  var out = parse(md, { highlight: true });
  contains(out, 'tok-keyword');
});

// ======================== escapeAttr（属性值转义） ========================

test('escapeAttr 普通文本不变', function () {
  assert.strictEqual(escapeAttr('Hello 世界'), 'Hello 世界');
});

test('escapeAttr 转义 & 符号', function () {
  assert.strictEqual(escapeAttr('A & B'), 'A &amp; B');
});

test('escapeAttr 转义双引号', function () {
  assert.strictEqual(escapeAttr('say "hi"'), 'say &quot;hi&quot;');
});

test('escapeAttr 同时含 & 和 " 不二次转义', function () {
  // 旧 bug：先替换 " 为 &quot;，再替换 & 为 &amp;，导致 &amp;quot;
  // 修复后：先替换 & 再替换 "，结果正确
  assert.strictEqual(escapeAttr('A & "B"'), 'A &amp; &quot;B&quot;');
});

test('escapeAttr 转义 < 和 >', function () {
  assert.strictEqual(escapeAttr('<tag>'), '&lt;tag&gt;');
});

test('escapeAttr 不转义单引号', function () {
  assert.strictEqual(escapeAttr("it's"), "it's");
});

test('escapeAttr null/undefined 输入', function () {
  assert.strictEqual(escapeAttr(null), 'null');
  assert.strictEqual(escapeAttr(undefined), 'undefined');
});

test('escapeAttr 数字输入', function () {
  assert.strictEqual(escapeAttr(42), '42');
});

// ======================== 测试结果汇总 ========================

console.log('\n--- 结果 ---');
if (failed === 0) {
  console.log('全部通过 ' + passed + '/' + total);
} else {
  console.log('失败 ' + failed + '/' + total);
  process.exit(1);
}
