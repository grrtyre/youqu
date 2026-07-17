// 翻译引擎纯函数单元测试（不依赖网络）
// 运行：node test/translate.test.js

'use strict';
const assert = require('assert');
const {
  LANGUAGES,
  buildGoogleUrl,
  parseGoogleResponse,
  buildMyMemoryUrl,
  parseMyMemoryResponse
} = require('../src/engines/translate');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + ' -> ' + e.message); }
}

console.log('=== quick-translate 引擎单元测试 ===');

test('LANGUAGES 包含 auto 与常见语言', () => {
  assert.ok(Array.isArray(LANGUAGES) && LANGUAGES.length >= 15);
  assert.strictEqual(LANGUAGES[0].code, 'auto');
  const codes = LANGUAGES.map(l => l.code);
  assert.ok(codes.includes('zh'));
  assert.ok(codes.includes('en'));
  assert.ok(codes.includes('ja'));
});

test('buildGoogleUrl 正确编码参数', () => {
  const url = buildGoogleUrl('auto', 'zh', 'hello world');
  assert.ok(url.startsWith('https://translate.googleapis.com/translate_a/single?client=gtx'));
  assert.ok(url.includes('sl=auto'));
  assert.ok(url.includes('tl=zh'));
  assert.ok(url.includes('q=hello%20world'));
});

test('buildGoogleUrl 对中文进行编码', () => {
  const url = buildGoogleUrl('zh', 'en', '你好');
  assert.ok(url.includes('q=' + encodeURIComponent('你好')));
  assert.ok(!url.includes('你好')); // 原文不应裸露在 URL 中
});

test('parseGoogleResponse 正确解析多段译文', () => {
  // 模拟 Google 返回结构：[[["译文1","src1",null,null,1],["译文2","src2",null,null,1]],null,"en",...]
  const raw = JSON.stringify([
    [['你好，', 'Hello, ', null, null, 1], ['世界。', 'world.', null, null, 1]],
    null,
    'en'
  ]);
  const r = parseGoogleResponse(raw);
  assert.ok(r);
  assert.strictEqual(r.text, '你好，世界。');
  assert.strictEqual(r.detectedSource, 'en');
});

test('parseGoogleResponse 检测语言为 null 时不报错', () => {
  const raw = JSON.stringify([[['你好', 'hello', null, null, 1]], null, null]);
  const r = parseGoogleResponse(raw);
  assert.strictEqual(r.text, '你好');
  assert.strictEqual(r.detectedSource, null);
});

test('parseGoogleResponse 对非法 JSON 返回 null', () => {
  assert.strictEqual(parseGoogleResponse('not json'), null);
  assert.strictEqual(parseGoogleResponse(''), null);
  assert.strictEqual(parseGoogleResponse(null), null);
});

test('parseGoogleResponse 对结构异常返回 null', () => {
  assert.strictEqual(parseGoogleResponse(JSON.stringify({ foo: 1 })), null);
  assert.strictEqual(parseGoogleResponse(JSON.stringify([[]])), null);
});

test('buildMyMemoryUrl 正确拼接 langpair', () => {
  const url = buildMyMemoryUrl('en', 'zh', 'hi there');
  assert.ok(url.startsWith('https://api.mymemory.translated.net/get?'));
  assert.ok(url.includes('langpair=en%7Czh')); // '|' 编码为 %7C
  assert.ok(url.includes('q=hi%20there'));
});

test('parseMyMemoryResponse 正确解析', () => {
  const raw = JSON.stringify({ responseData: { translatedText: '你好' }, matches: [] });
  const r = parseMyMemoryResponse(raw);
  assert.ok(r);
  assert.strictEqual(r.text, '你好');
});

test('parseMyMemoryResponse 过滤警告信息', () => {
  const raw = JSON.stringify({ responseData: { translatedText: 'MYMEMORY WARNING: query length limit' } });
  assert.strictEqual(parseMyMemoryResponse(raw), null);
});

test('parseMyMemoryResponse 对异常结构返回 null', () => {
  assert.strictEqual(parseMyMemoryResponse(JSON.stringify({ responseData: {} })), null);
  assert.strictEqual(parseMyMemoryResponse('bad'), null);
  assert.strictEqual(parseMyMemoryResponse(null), null);
});

console.log('=== 结果: ' + passed + ' 通过, ' + failed + ' 失败 ===');
process.exit(failed === 0 ? 0 : 1);
