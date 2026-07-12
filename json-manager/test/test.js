'use strict';
// JSON管家 - 单元测试（Node 直接运行）
// 覆盖：json-ops / jq-lite / converters

const assert = require('assert');
const ops = require('../src/core/json-ops');
const jq = require('../src/core/jq-lite');
const conv = require('../src/core/converters');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (err) { fail++; console.log('  ✗ ' + name + '\n    ' + err.message); }
}

console.log('\n[1] json-ops 基础');

test('parse 解析合法 JSON', () => {
  const r = ops.parse('{"a":1,"b":[2,3]}');
  assert.ok(r.ok);
  assert.strictEqual(r.value.a, 1);
  assert.deepStrictEqual(r.value.b, [2, 3]);
});

test('parse 解析错误返回位置', () => {
  const r = ops.parse('{"a":}');
  assert.ok(!r.ok);
  assert.ok(r.error);
});

test('parse 空内容报错', () => {
  const r = ops.parse('');
  assert.ok(!r.ok);
});

test('beautify 默认 2 空格缩进', () => {
  const text = ops.beautify({ a: 1, b: { c: 2 } });
  assert.ok(text.indexOf('  "a"') >= 0);
  assert.ok(text.indexOf('    "c"') >= 0);
});

test('beautify 4 空格缩进', () => {
  const text = ops.beautify({ a: 1 }, 4);
  assert.ok(text.indexOf('    "a"') >= 0);
});

test('minify 压缩为一行', () => {
  const text = ops.minify({ a: 1, b: [2, 3] });
  assert.strictEqual(text, '{"a":1,"b":[2,3]}');
});

test('stats 统计键数与深度', () => {
  const s = ops.stats({ a: 1, b: { c: { d: 4 } }, arr: [1, 2] });
  assert.strictEqual(s.keys, 5); // a,b,arr + c + d = 5
  assert.strictEqual(s.depth, 3);
  assert.ok(s.bytes > 0);
});

test('typeOf 类型判定', () => {
  assert.strictEqual(ops.typeOf(null), 'null');
  assert.strictEqual(ops.typeOf([1]), 'array');
  assert.strictEqual(ops.typeOf(1), 'number');
  assert.strictEqual(ops.typeOf('x'), 'string');
  assert.strictEqual(ops.typeOf(true), 'boolean');
  assert.strictEqual(ops.typeOf({}), 'object');
});

test('pathToString 路径转字符串', () => {
  assert.strictEqual(ops.pathToString([]), '$');
  assert.strictEqual(ops.pathToString(['users', 0, 'name']), '$.users[0].name');
  assert.strictEqual(ops.pathToString(['a b', 'c']), '$["a b"].c');
});

test('escapeHtml HTML 转义', () => {
  assert.strictEqual(ops.escapeHtml('<a>&"\''), '&lt;a&gt;&amp;&quot;&#39;');
});

console.log('\n[2] jq-lite 查询');

test('jq 根查询', () => {
  const r = jq.query({ a: 1 }, '.');
  assert.strictEqual(JSON.parse(r).a, 1);
});

test('jq 字段查询', () => {
  const r = jq.query({ a: { b: 5 } }, '.a.b');
  assert.strictEqual(JSON.parse(r), 5);
});

test('jq 数组索引', () => {
  const r = jq.query([10, 20, 30], '.[1]');
  assert.strictEqual(JSON.parse(r), 20);
});

test('jq 负索引', () => {
  const r = jq.query([10, 20, 30], '.[-1]');
  assert.strictEqual(JSON.parse(r), 30);
});

test('jq 数组切片', () => {
  const r = jq.query([10, 20, 30, 40], '.[1:3]');
  assert.deepStrictEqual(JSON.parse(r), [20, 30]);
});

test('jq 遍历数组', () => {
  const r = jq.query([1, 2, 3], '.[]');
  assert.deepStrictEqual(JSON.parse(r), [1, 2, 3]);
});

test('jq 字段后遍历', () => {
  const r = jq.query({ users: [{ name: 'a' }, { name: 'b' }] }, '.users[].name');
  assert.deepStrictEqual(JSON.parse(r), ['a', 'b']);
});

test('jq length 函数', () => {
  const r = jq.query([1, 2, 3], 'length');
  assert.strictEqual(JSON.parse(r), 3);
});

test('jq keys 函数', () => {
  const r = jq.query({ a: 1, b: 2 }, 'keys');
  assert.deepStrictEqual(JSON.parse(r), ['a', 'b']);
});

test('jq values 函数', () => {
  const r = jq.query({ a: 1, b: 2 }, 'values');
  assert.deepStrictEqual(JSON.parse(r), [1, 2]);
});

test('jq type 函数', () => {
  assert.strictEqual(JSON.parse(jq.query([1], 'type')), 'array');
  assert.strictEqual(JSON.parse(jq.query('x', 'type')), 'string');
  assert.strictEqual(JSON.parse(jq.query(null, 'type')), 'null');
});

test('jq 管道', () => {
  const r = jq.query({ a: { b: [1, 2, 3] } }, '.a | .b | length');
  assert.strictEqual(JSON.parse(r), 3);
});

test('jq map 函数', () => {
  const r = jq.query([{ x: 1 }, { x: 2 }], 'map(.x)');
  assert.deepStrictEqual(JSON.parse(r), [1, 2]);
});

test('jq select 过滤', () => {
  const r = jq.query([{ n: 5 }, { n: 10 }, { n: 15 }], '.[] | select(.n > 8)');
  assert.deepStrictEqual(JSON.parse(r), [{ n: 10 }, { n: 15 }]);
});

test('jq 逗号多选', () => {
  const r = jq.query({ a: 1, b: 2 }, '.a, .b');
  assert.deepStrictEqual(JSON.parse(r), [1, 2]);
});

test('jq 无匹配返回空', () => {
  const r = jq.query({ a: 1 }, '.notExist');
  assert.strictEqual(r, '');
});

console.log('\n[3] converters 转换');

test('toCSV 对象数组', () => {
  const csv = conv.toCSV([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
  assert.strictEqual(csv, 'a,b\n1,2\n3,4');
});

test('toCSV 含逗号转义', () => {
  const csv = conv.toCSV([{ name: 'a,b', v: 1 }]);
  assert.ok(csv.indexOf('"a,b"') >= 0);
});

test('toCSV 二维数组', () => {
  const csv = conv.toCSV([[1, 2], [3, 4]]);
  assert.strictEqual(csv, '1,2\n3,4');
});

test('toCSV 单对象', () => {
  const csv = conv.toCSV({ a: 1, b: 2 });
  assert.strictEqual(csv, 'a,b\n1,2');
});

test('toYAML 基础', () => {
  const y = conv.toYAML({ a: 1, b: 'hello' });
  assert.ok(y.indexOf('a: 1') >= 0);
  assert.ok(y.indexOf('b: hello') >= 0);
});

test('toYAML 嵌套对象', () => {
  const y = conv.toYAML({ a: { b: 2 } });
  assert.ok(y.indexOf('a:') >= 0);
  assert.ok(y.indexOf('b: 2') >= 0);
});

test('toYAML 数组', () => {
  const y = conv.toYAML([1, 2, 3]);
  assert.ok(y.indexOf('- 1') >= 0);
  assert.ok(y.indexOf('- 2') >= 0);
});

test('toYAML 特殊字符加引号', () => {
  const y = conv.toYAML({ k: 'a:b' });
  assert.ok(y.indexOf('"a:b"') >= 0);
});

test('toXML 基础结构', () => {
  const xml = conv.toXML({ name: 'test', age: 18 });
  assert.ok(xml.indexOf('<?xml') >= 0);
  assert.ok(xml.indexOf('<name>test</name>') >= 0);
  assert.ok(xml.indexOf('<age>18</age>') >= 0);
});

test('toXML 数组项', () => {
  const xml = conv.toXML({ items: [1, 2] });
  assert.ok(xml.indexOf('<item>') >= 0);
});

test('toXML 空对象自闭合', () => {
  const xml = conv.toXML({ empty: {} });
  assert.ok(xml.indexOf('<empty />') >= 0 || xml.indexOf('<empty/>') >= 0);
});

test('toProperties 扁平化', () => {
  const p = conv.toProperties({ a: { b: { c: 1 } } });
  assert.ok(p.indexOf('a.b.c=1') >= 0);
});

test('toProperties 数组索引', () => {
  const p = conv.toProperties({ arr: [10, 20] });
  assert.ok(p.indexOf('arr[0]=10') >= 0);
  assert.ok(p.indexOf('arr[1]=20') >= 0);
});

console.log('\n[4] diff 对比');

test('diff 相同对象无差异', () => {
  const d = conv.diff({ a: 1 }, { a: 1 });
  assert.strictEqual(d.length, 0);
});

test('diff 新增字段', () => {
  const d = conv.diff({ a: 1 }, { a: 1, b: 2 });
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, 'added');
  assert.ok(d[0].path.indexOf('b') >= 0);
});

test('diff 删除字段', () => {
  const d = conv.diff({ a: 1, b: 2 }, { a: 1 });
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, 'removed');
});

test('diff 修改值', () => {
  const d = conv.diff({ a: 1 }, { a: 2 });
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, 'changed');
});

test('diff 类型不同', () => {
  const d = conv.diff({ a: 1 }, { a: '1' });
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, 'changed');
});

test('diff 嵌套路径', () => {
  const d = conv.diff({ a: { b: 1 } }, { a: { b: 2 } });
  assert.strictEqual(d.length, 1);
  assert.ok(d[0].path.indexOf('a') >= 0 && d[0].path.indexOf('b') >= 0);
});

test('diff 数组长度变化', () => {
  const d = conv.diff([1, 2], [1, 2, 3]);
  assert.strictEqual(d.length, 1);
  assert.strictEqual(d[0].type, 'added');
});

console.log('\n[5] Schema 校验');

test('validateSchema 类型正确', () => {
  const errs = conv.validateSchema({ a: 1 }, { type: 'object', properties: { a: { type: 'number' } } });
  assert.strictEqual(errs.length, 0);
});

test('validateSchema 类型错误', () => {
  const errs = conv.validateSchema({ a: 'x' }, { type: 'object', properties: { a: { type: 'number' } } });
  assert.ok(errs.length > 0);
});

test('validateSchema required 缺失', () => {
  const errs = conv.validateSchema({ a: 1 }, { type: 'object', required: ['a', 'b'] });
  assert.ok(errs.length > 0);
  assert.ok(errs.some((e) => e.msg.indexOf('b') >= 0));
});

test('validateSchema minimum/maximum', () => {
  const errs = conv.validateSchema(5, { type: 'number', minimum: 0, maximum: 10 });
  assert.strictEqual(errs.length, 0);
  const errs2 = conv.validateSchema(15, { type: 'number', maximum: 10 });
  assert.ok(errs2.length > 0);
});

test('validateSchema enum', () => {
  const errs = conv.validateSchema('a', { enum: ['a', 'b', 'c'] });
  assert.strictEqual(errs.length, 0);
  const errs2 = conv.validateSchema('d', { enum: ['a', 'b', 'c'] });
  assert.ok(errs2.length > 0);
});

test('validateSchema 数组 items', () => {
  const errs = conv.validateSchema([1, 2, 3], { type: 'array', items: { type: 'number' } });
  assert.strictEqual(errs.length, 0);
  const errs2 = conv.validateSchema([1, 'x', 3], { type: 'array', items: { type: 'number' } });
  assert.ok(errs2.length > 0);
});

test('validateSchema 字符串 pattern', () => {
  const errs = conv.validateSchema('abc123', { type: 'string', pattern: '^[a-z0-9]+$' });
  assert.strictEqual(errs.length, 0);
  const errs2 = conv.validateSchema('ABC', { type: 'string', pattern: '^[a-z0-9]+$' });
  assert.ok(errs2.length > 0);
});

test('validateSchema minLength/maxLength', () => {
  const errs = conv.validateSchema('abc', { type: 'string', minLength: 2, maxLength: 5 });
  assert.strictEqual(errs.length, 0);
  const errs2 = conv.validateSchema('a', { type: 'string', minLength: 2 });
  assert.ok(errs2.length > 0);
});

// ===== 总结 =====
console.log('\n─────────────────────────');
console.log('通过 ' + pass + ' · 失败 ' + fail);
console.log('─────────────────────────\n');
if (fail > 0) process.exit(1);
