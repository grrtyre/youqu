// test/test.js - 环境变量管家核心逻辑测试
// 运行：node test/test.js

'use strict';

const assert = require('assert');
const path = require('path');
const utils = require(path.join(__dirname, '..', 'src', 'core', 'env-utils.js'));

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail++;
    console.error('  ✗ ' + name + '\n    ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e));
  }
}

console.log('\n=== 环境变量管家 · 核心逻辑测试 ===\n');

// ---- parseRegOutput ----
console.log('[parseRegOutput]');
test('解析标准 reg query 输出', () => {
  const out = [
    '',
    'HKEY_CURRENT_USER\\Environment',
    '    Path    REG_EXPAND_SZ    C:\\Windows\\System32;C:\\Windows',
    '    TEMP    REG_SZ    %USERPROFILE%\\AppData\\Local\\Temp',
    ''
  ].join('\r\n');
  const r = utils.parseRegOutput(out);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].name, 'Path');
  assert.strictEqual(r[0].type, 'REG_EXPAND_SZ');
  assert.strictEqual(r[0].value, 'C:\\Windows\\System32;C:\\Windows');
  assert.strictEqual(r[1].name, 'TEMP');
  assert.strictEqual(r[1].type, 'REG_SZ');
  assert.strictEqual(r[1].value, '%USERPROFILE%\\AppData\\Local\\Temp');
});

test('空输入返回空数组', () => {
  assert.strictEqual(utils.parseRegOutput('').length, 0);
  assert.strictEqual(utils.parseRegOutput(null).length, 0);
});

test('仅表头无数据返回空数组', () => {
  const out = '\r\nHKEY_CURRENT_USER\\Environment\r\n';
  assert.strictEqual(utils.parseRegOutput(out).length, 0);
});

test('表头出现前的数据行被忽略', () => {
  const out = '    bogus    REG_SZ    value\r\nHKEY_CURRENT_USER\\Environment\r\n    Real    REG_SZ    ok\r\n';
  const r = utils.parseRegOutput(out);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'Real');
});

test('值含多个空格也能正确解析', () => {
  const out = 'HKEY_CURRENT_USER\\Environment\n    MSG    REG_SZ    hello   world   here\n';
  const r = utils.parseRegOutput(out);
  assert.strictEqual(r[0].value, 'hello   world   here');
});

// ---- parsePathValue / serializePathValue ----
console.log('[parsePathValue / serializePathValue]');
test('PATH 拆分为数组', () => {
  const r = utils.parsePathValue('C:\\A;C:\\B;C:\\C');
  assert.deepStrictEqual(r, ['C:\\A', 'C:\\B', 'C:\\C']);
});

test('空 PATH 返回空数组', () => {
  assert.deepStrictEqual(utils.parsePathValue(''), []);
  assert.deepStrictEqual(utils.parsePathValue(null), []);
});

test('保留空段（便于发现拼写错误）', () => {
  const r = utils.parsePathValue('C:\\A;;C:\\B');
  assert.deepStrictEqual(r, ['C:\\A', '', 'C:\\B']);
});

test('PATH 序列化无末尾分隔符', () => {
  assert.strictEqual(utils.serializePathValue(['C:\\A', 'C:\\B']), 'C:\\A;C:\\B');
});

test('空数组序列化为空字符串', () => {
  assert.strictEqual(utils.serializePathValue([]), '');
  assert.strictEqual(utils.serializePathValue(null), '');
});

test('序列化过滤 undefined/null 项', () => {
  assert.strictEqual(utils.serializePathValue(['A', null, 'B', undefined, 'C']), 'A;B;C');
});

test('拆分再序列化保持一致（无空段）', () => {
  const v = 'C:\\Windows;C:\\Program Files;D:\\Tools';
  assert.strictEqual(utils.serializePathValue(utils.parsePathValue(v)), v);
});

// ---- filterEnvVars ----
console.log('[filterEnvVars]');
test('按名称过滤（不区分大小写）', () => {
  const vars = [
    { name: 'PATH', value: 'a' },
    { name: 'Path', value: 'b' },
    { name: 'JAVA_HOME', value: 'c' }
  ];
  const r = utils.filterEnvVars(vars, 'path');
  assert.strictEqual(r.length, 2);
});

test('按值过滤', () => {
  const vars = [
    { name: 'A', value: 'C:\\Windows' },
    { name: 'B', value: 'D:\\Tools' }
  ];
  const r = utils.filterEnvVars(vars, 'windows');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].name, 'A');
});

test('空查询返回全部副本', () => {
  const vars = [{ name: 'A', value: '1' }];
  const r = utils.filterEnvVars(vars, '');
  assert.strictEqual(r.length, 1);
  assert.notStrictEqual(r, vars); // 是副本
});

// ---- validateVarName ----
console.log('[validateVarName]');
test('合法名称通过', () => {
  assert.strictEqual(utils.validateVarName('JAVA_HOME').valid, true);
  assert.strictEqual(utils.validateVarName('Path').valid, true);
  assert.strictEqual(utils.validateVarName('PROGRAMFILES(X86)').valid, true);
  assert.strictEqual(utils.validateVarName('My.Var-1').valid, true);
});

test('空名称拒绝', () => {
  assert.strictEqual(utils.validateVarName('').valid, false);
  assert.strictEqual(utils.validateVarName(null).valid, false);
});

test('数字开头拒绝', () => {
  assert.strictEqual(utils.validateVarName('1VAR').valid, false);
});

test('含空格拒绝', () => {
  assert.strictEqual(utils.validateVarName('MY VAR').valid, false);
});

test('含非法字符拒绝', () => {
  assert.strictEqual(utils.validateVarName('A;B').valid, false);
  assert.strictEqual(utils.validateVarName('A&B').valid, false);
});

// ---- diffEnvVars ----
console.log('[diffEnvVars]');
test('计算增删改', () => {
  const before = [
    { name: 'A', value: '1' },
    { name: 'B', value: '2' },
    { name: 'C', value: '3' }
  ];
  const after = [
    { name: 'A', value: '1' },     // 不变
    { name: 'B', value: '20' },    // 修改
    { name: 'D', value: '4' }      // 新增
    // C 被删除
  ];
  const d = utils.diffEnvVars(before, after);
  assert.deepStrictEqual(d.added, ['D']);
  assert.deepStrictEqual(d.removed, ['C']);
  assert.deepStrictEqual(d.modified, ['B']);
});

test('空输入安全', () => {
  const d = utils.diffEnvVars(null, null);
  assert.deepStrictEqual(d.added, []);
  assert.deepStrictEqual(d.removed, []);
  assert.deepStrictEqual(d.modified, []);
});

// ---- shouldUseExpandType ----
console.log('[shouldUseExpandType]');
test('含 %VAR% 引用返回 true', () => {
  assert.strictEqual(utils.shouldUseExpandType('%USERPROFILE%\\AppData'), true);
  assert.strictEqual(utils.shouldUseExpandType('C:\\Windows;%SystemRoot%\\System32'), true);
});

test('纯路径返回 false', () => {
  assert.strictEqual(utils.shouldUseExpandType('C:\\Windows\\System32'), false);
  assert.strictEqual(utils.shouldUseExpandType('hello world'), false);
});

// ---- buildBackupJson / parseBackupJson ----
console.log('[buildBackupJson / parseBackupJson]');
test('备份 JSON 往返一致', () => {
  const data = {
    user: [{ name: 'TEMP', type: 'REG_SZ', value: '%USERPROFILE%\\Temp' }],
    system: [{ name: 'Path', type: 'REG_EXPAND_SZ', value: 'C:\\Windows' }]
  };
  const json = utils.buildBackupJson(data);
  const parsed = utils.parseBackupJson(json);
  assert.strictEqual(parsed.user[0].name, 'TEMP');
  assert.strictEqual(parsed.user[0].value, '%USERPROFILE%\\Temp');
  assert.strictEqual(parsed.system[0].name, 'Path');
  assert.strictEqual(parsed.system[0].type, 'REG_EXPAND_SZ');
});

test('备份 JSON 含 app 标记和时间戳', () => {
  const json = utils.buildBackupJson({ user: [], system: [] });
  const obj = JSON.parse(json);
  assert.strictEqual(obj.app, 'env-manager');
  assert.strictEqual(obj.version, 1);
  assert.ok(typeof obj.exportedAt === 'string');
});

test('parseBackupJson 容错非法类型', () => {
  const parsed = utils.parseBackupJson('{"user":[{"name":"X","type":"REG_NONE","value":"v"}],"system":[]}');
  assert.strictEqual(parsed.user[0].type, 'REG_SZ'); // 非法类型归一为 REG_SZ
});

test('parseBackupJson 抛出无效 JSON', () => {
  assert.throws(() => utils.parseBackupJson('not json'), /Error/);
});

// ---- sortEnvVars ----
console.log('[sortEnvVars]');
test('按名称不区分大小写排序', () => {
  const vars = [
    { name: 'banana', value: 'b' },
    { name: 'Apple', value: 'a' },
    { name: 'Cherry', value: 'c' }
  ];
  const r = utils.sortEnvVars(vars);
  assert.deepStrictEqual(r.map((v) => v.name), ['Apple', 'banana', 'Cherry']);
});

test('排序不修改原数组', () => {
  const vars = [{ name: 'B' }, { name: 'A' }];
  utils.sortEnvVars(vars);
  assert.strictEqual(vars[0].name, 'B'); // 原数组不变
});

// ---- truncateValue ----
console.log('[truncateValue]');
test('短值原样返回', () => {
  assert.strictEqual(utils.truncateValue('hello', 10), 'hello');
});

test('长值截断加省略号', () => {
  const v = 'A'.repeat(100);
  const r = utils.truncateValue(v, 10);
  assert.strictEqual(r.length, 11);
  assert.ok(r.endsWith('…'));
});

// ---- 综合场景 ----
console.log('[综合场景]');
test('PATH 编辑后差异检测', () => {
  const before = [{ name: 'Path', value: 'C:\\A;C:\\B;C:\\C' }];
  const after = [{ name: 'Path', value: 'C:\\A;C:\\B;C:\\D' }]; // C 改 D
  const d = utils.diffEnvVars(before, after);
  assert.deepStrictEqual(d.modified, ['Path']);
});

test('新增 PATH 条目后序列化', () => {
  const v = 'C:\\A;C:\\B';
  const paths = utils.parsePathValue(v);
  paths.push('C:\\NEW');
  const newV = utils.serializePathValue(paths);
  assert.strictEqual(newV, 'C:\\A;C:\\B;C:\\NEW');
});

console.log('\n----------------------------------');
console.log('通过: ' + pass + '  失败: ' + fail);
console.log('----------------------------------\n');

if (fail > 0) {
  process.exit(1);
}
