'use strict';

// 文本管家核心逻辑测试
// 运行：node test/test.js

const ops = require('../src/core/text-ops');
let pass = 0;
let fail = 0;

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    // console.log('  ✓ ' + msg);
  } else {
    fail++;
    console.log('  ✗ ' + msg);
    console.log('    期望: ' + e);
    console.log('    实际: ' + a);
  }
}

function assertThrowsNo(fn, msg) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    console.log('  ✗ ' + msg + ' 不应抛出异常，但抛出: ' + e.message);
  }
}

console.log('\n=== 文本管家核心测试 ===\n');

// ---------- 替换 ----------
console.log('[替换 replaceText]');
assertEqual(ops.replaceText('hello world', { find: 'world', replace: 'mimo' }), 'hello mimo', '基本替换');
assertEqual(ops.replaceText('Hello World', { find: 'world', replace: 'X', caseSensitive: true }), 'Hello World', '区分大小写不匹配');
assertEqual(ops.replaceText('Hello World', { find: 'world', replace: 'X' }), 'Hello X', '不区分大小写匹配');
assertEqual(ops.replaceText('aaa', { find: 'a', replace: 'b', global: false }), 'baa', '非全局只替换第一个');
assertEqual(ops.replaceText('cat dog cat', { find: 'cat', replace: 'X', wholeWord: true }), 'X dog X', '全字匹配');
assertEqual(ops.replaceText('cat category cat', { find: 'cat', replace: 'X', wholeWord: true }), 'X category X', '全字匹配不替换 category');
assertEqual(ops.replaceText('hello 2026', { find: '\\d+', replace: 'YEAR', useRegex: true }), 'hello YEAR', '正则替换数字');
assertEqual(ops.replaceText('John Smith', { find: '(\\w+) (\\w+)', replace: '$2, $1', useRegex: true }), 'Smith, John', '正则捕获组替换');
assertEqual(ops.replaceText('test', { find: '[invalid', replace: 'X', useRegex: true }), 'test', '非法正则容错不崩');
assertEqual(ops.replaceText('', { find: 'x', replace: 'y' }), '', '空文本替换');
assertEqual(ops.replaceText('abc', { find: '', replace: 'y' }), 'abc', '空查找返回原文');

// ---------- 分割 ----------
console.log('[分割 splitText]');
assertEqual(ops.splitText('a,b,c', { mode: 'separator', separator: ',' }), ['a', 'b', 'c'], '按逗号分割');
assertEqual(ops.splitText('a,b,c', { mode: 'separator', separator: ',', limit: 2 }), ['a', 'b'], 'limit 限制段数');
assertEqual(ops.splitText('a,,b', { mode: 'separator', separator: ',', keepEmpty: false }), ['a', 'b'], '去掉空段');
assertEqual(ops.splitText('abcdef', { mode: 'length', length: 2 }), ['ab', 'cd', 'ef'], '按长度分割');
assertEqual(ops.splitText('abcdefg', { mode: 'length', length: 3 }), ['abc', 'def', 'g'], '按长度分割(不能整除)');
assertEqual(ops.splitText('a\nb\nc', { mode: 'lines' }), ['a', 'b', 'c'], '按行分割');
assertEqual(ops.splitText('a1b2c3', { mode: 'regex', separator: '\\d' }), ['a', 'b', 'c', ''], '按正则分割');
assertEqual(ops.splitText('', { mode: 'separator', separator: ',' }), [''], '空文本分割');

// ---------- 提取 ----------
console.log('[提取 extractText]');
assertEqual(ops.extractText('电话: 13800138000, 备份: 13900139000', { pattern: '\\d{11}' }), ['13800138000', '13900139000'], '提取手机号');
assertEqual(ops.extractText('邮箱 a@b.com 和 c@d.com', { pattern: '\\w+@(\\w+\\.\\w+)', group: 1 }), ['b.com', 'd.com'], '提取捕获组');
assertEqual(ops.extractText('a@b.com a@b.com c@d.com', { pattern: '\\w+@\\w+\\.\\w+', unique: true }), ['a@b.com', 'c@d.com'], '提取并去重');
assertEqual(ops.extractText('abc', { pattern: '' }), [], '空模式返回空');
assertEqual(ops.extractText('abc', { pattern: '[invalid' }), [], '非法正则容错');
assertEqual(ops.extractText('Hello hello HELLO', { pattern: 'hello', caseSensitive: true }), ['hello'], '区分大小写提取');

// ---------- 大小写转换 ----------
console.log('[大小写 caseConvert]');
assertEqual(ops.caseConvert('hello world', 'upper'), 'HELLO WORLD', '转大写');
assertEqual(ops.caseConvert('HELLO WORLD', 'lower'), 'hello world', '转小写');
assertEqual(ops.caseConvert('hello world', 'title'), 'Hello World', '标题式');
assertEqual(ops.caseConvert('HELLO WORLD', 'capitalize'), 'Hello World', '单词首字母大写其余小写');
assertEqual(ops.caseConvert('hello world. foo bar.', 'sentence'), 'Hello world. Foo bar.', '句首大写');
assertEqual(ops.caseConvert('hello world foo', 'camel'), 'helloWorldFoo', '驼峰');
assertEqual(ops.caseConvert('hello world foo', 'pascal'), 'HelloWorldFoo', '帕斯卡');
assertEqual(ops.caseConvert('HelloWorldFoo', 'snake'), 'hello_world_foo', '下划线');
assertEqual(ops.caseConvert('HelloWorldFoo', 'kebab'), 'hello-world-foo', '短横线');
assertEqual(ops.caseConvert('Hello World', 'invert'), 'hELLO wORLD', '大小写互换');
assertEqual(ops.caseConvert('hello', 'alternating'), 'hElLo', '交替大小写');
assertEqual(ops.caseConvert('hello-world test_func', 'pascal'), 'HelloWorldTestFunc', '混合分隔符转帕斯卡');

// ---------- 去重 ----------
console.log('[去重 dedupe]');
assertEqual(ops.dedupeLines('a\nb\na\nc\nb'), 'a\nb\nc', '按行去重保序');
assertEqual(ops.dedupeLines('A\na\nB'), 'A\na\nB', '默认区分大小写');
assertEqual(ops.dedupeLines('A\na\nB', { caseSensitive: false }), 'A\nB', '不区分大小写去重');
assertEqual(ops.dedupeLines('a\n  a  \nb', { trim: true }), 'a\nb', 'trim 比较 key 后者被去重');
assertEqual(ops.dedupeLines('a\n\n\nb', { keepEmpty: false }), 'a\nb', '去掉空行');
assertEqual(ops.dedupeLines('a\n\n\nb'), 'a\n\n\nb', '默认保留空行');
assertEqual(ops.dedupeBySimilarity('你好世界\n你好世界\n你好大家', 0.9), '你好世界\n你好大家', '相似度去重');

// ---------- 行处理 ----------
console.log('[行处理]');
assertEqual(ops.trimLines('  a  \n  b  '), 'a\nb', '去除行首尾空白');
assertEqual(ops.removeEmptyLines('a\n\nb\n  \nc'), 'a\nb\nc', '删除空行');
assertEqual(ops.sortLines('banana\napple\ncherry'), 'apple\nbanana\ncherry', '行排序');
assertEqual(ops.sortLines('banana\napple\ncherry', { descending: true }), 'cherry\nbanana\napple', '行倒序');
assertEqual(ops.sortLines('Banana\napple', { ignoreCase: true }), 'apple\nBanana', '忽略大小写排序');
assertEqual(ops.sortLines('file1\nfile10\nfile2\nfile3', { natural: true }), 'file1\nfile2\nfile3\nfile10', '自然排序 file10 在 file2 之后');
assertEqual(ops.sortLines('file10\nfile2\nfile1', { natural: true }), 'file1\nfile2\nfile10', '自然排序乱序输入');
assertEqual(ops.sortLines('file1\nfile10\nfile2', { natural: true, descending: true }), 'file10\nfile2\nfile1', '自然倒序');
assertEqual(ops.sortLines('v1.2\nv1.10\nv1.1', { natural: true }), 'v1.1\nv1.2\nv1.10', '版本号自然排序');
assertEqual(ops.sortLines('File10\nfile2', { natural: true, ignoreCase: true }), 'file2\nFile10', '自然排序忽略大小写');
assertEqual(ops.reverseLines('a\nb\nc'), 'c\nb\na', '行反转');
assertEqual(ops.addLineNumber('a\nb\nc'), '1. a\n2. b\n3. c', '添加行号');
assertEqual(ops.addLineNumber('a\nb\nc', { separator: ') ' }), '1) a\n2) b\n3) c', '自定义行号分隔符');
assertEqual(ops.addPrefixSuffix('a\nb', { prefix: '> ', suffix: '。' }), '> a。\\n> b。'.replace('\\n', '\n'), '添加前后缀');

// ---------- 统计 ----------
console.log('[统计 countStats]');
const stats = ops.countStats('hello world\n你好世界');
assertEqual(stats.chars, 16, '字符数（含换行）');
assertEqual(stats.lines, 2, '行数');
assertEqual(stats.englishWords, 2, '英文单词数');
assertEqual(stats.chineseChars, 4, '中文字符数');
assertEqual(stats.words, 6, '总词数');
assertEqual(ops.countStats('').lines, 0, '空文本行数为 0');

// ---------- 编码转换 ----------
console.log('[编码转换 encode/decode]');
// Base64（含中文，验证 UTF-8 安全）
assertEqual(ops.encodeText('hello', 'base64'), 'aGVsbG8=', 'Base64 编码英文');
assertEqual(ops.decodeText('aGVsbG8=', 'base64'), 'hello', 'Base64 解码英文');
assertEqual(ops.decodeText(ops.encodeText('你好世界', 'base64'), 'base64'), '你好世界', 'Base64 中文往返');
assertEqual(ops.decodeText(ops.encodeText('Hello, 世界！', 'base64'), 'base64'), 'Hello, 世界！', 'Base64 中英混合往返');
assertEqual(ops.decodeText('a G V s b G 8=', 'base64'), 'hello', 'Base64 解码忽略空白');
assertThrowsNo(() => ops.decodeText('!!!invalid', 'base64'), 'Base64 非法输入不抛异常');

// URL
assertEqual(ops.encodeText('a b&c=你好', 'url'), 'a%20b%26c%3D%E4%BD%A0%E5%A5%BD', 'URL 编码');
assertEqual(ops.decodeText('a%20b%26c%3D%E4%BD%A0%E5%A5%BD', 'url'), 'a b&c=你好', 'URL 解码');
assertEqual(ops.decodeText(ops.encodeText('特殊字符 <>&#%', 'url'), 'url'), '特殊字符 <>&#%', 'URL 往返');
assertEqual(ops.decodeText('a+b', 'url'), 'a b', 'URL 解码 + 转空格');

// HTML
assertEqual(ops.encodeText('<div class="x">a&b</div>', 'html'), '&lt;div class=&quot;x&quot;&gt;a&amp;b&lt;/div&gt;', 'HTML 转义');
assertEqual(ops.decodeText('&lt;div class=&quot;x&quot;&gt;a&amp;b&lt;/div&gt;', 'html'), '<div class="x">a&b</div>', 'HTML 反转义');
assertEqual(ops.decodeText('&#65;&#x4e2d;', 'html'), 'A中', 'HTML 数字实体反转义');
assertEqual(ops.decodeText(ops.encodeText("a'b<c>", 'html'), 'html'), "a'b<c>", 'HTML 往返含单引号');

// Unicode
assertEqual(ops.encodeText('hello', 'unicode'), 'hello', 'Unicode 编码 ASCII 不变');
assertEqual(ops.encodeText('你好', 'unicode'), '\\u4f60\\u597d', 'Unicode 编码中文');
assertEqual(ops.decodeText('\\u4f60\\u597d', 'unicode'), '你好', 'Unicode 解码中文');
assertEqual(ops.decodeText(ops.encodeText('Hello 世界', 'unicode'), 'unicode'), 'Hello 世界', 'Unicode 往返');

// Hex
assertEqual(ops.encodeText('Hi', 'hex'), '4869', 'Hex 编码英文');
assertEqual(ops.decodeText('4869', 'hex'), 'Hi', 'Hex 解码英文');
assertEqual(ops.decodeText(ops.encodeText('你好', 'hex'), 'hex'), '你好', 'Hex 中文往返');
assertEqual(ops.decodeText('0x480x69', 'hex'), 'Hi', 'Hex 解码忽略 0x 前缀');

// 统一接口与默认值
assertEqual(ops.encodeText('x', 'unknown'), 'x', '未知编码方式返回原文');
assertEqual(ops.ENCODE_MODES.indexOf('base64') >= 0, true, 'ENCODE_MODES 包含 base64');

// ---------- 容错测试 ----------
console.log('[容错]');
assertThrowsNo(() => ops.replaceText(null, { find: 'a' }), 'replaceText(null)');
assertThrowsNo(() => ops.caseConvert(null, 'upper'), 'caseConvert(null)');
assertThrowsNo(() => ops.splitText(undefined, {}), 'splitText(undefined)');
assertThrowsNo(() => ops.dedupeLines(null), 'dedupeLines(null)');
assertThrowsNo(() => ops.countStats(null), 'countStats(null)');
assertThrowsNo(() => ops.encodeText(null, 'base64'), 'encodeText(null)');
assertThrowsNo(() => ops.decodeText(null, 'base64'), 'decodeText(null)');
assertThrowsNo(() => ops.sortLines(null, { natural: true }), 'sortLines(null, natural)');

// ---------- 相似度内部 ----------
console.log('[内部函数]');
assertEqual(ops._similarity('abc', 'abc'), 1, '完全相同相似度 1');
assertEqual(ops._similarity('', ''), 1, '空字符串相似度 1');
assertEqual(ops._splitToWords('helloWorld foo-bar').length, 4, '混合分隔符切词');

console.log('\n=== 测试结果 ===');
console.log('通过: ' + pass + ' / 失败: ' + fail);
if (fail > 0) {
  console.log('❌ 测试未通过');
  process.exit(1);
} else {
  console.log('✅ 全部通过');
  process.exit(0);
}
