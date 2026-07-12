'use strict';
// 启动项管家 - 核心逻辑测试
const assert = require('assert');
const core = require('../src/core/startup-core');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message); fail++; }
}

console.log('\n启动项管家 - 核心逻辑测试\n');

test('parseRegQueryOutput 解析标准 reg 输出', () => {
  const out = [
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    '    OneDrive    REG_SZ    "C:\\Users\\x\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe"',
    '    SecurityHealth    REG_SZ    %windir%\\system32\\SecurityHealthSystray.exe',
    ''
  ].join('\r\n');
  const items = core.parseRegQueryOutput(out);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].name, 'OneDrive');
  assert.strictEqual(items[0].type, 'REG_SZ');
  assert.ok(items[0].value.includes('OneDrive.exe'));
  assert.strictEqual(items[1].name, 'SecurityHealth');
});

test('parseRegQueryOutput 跳过空与表头行', () => {
  const items = core.parseRegQueryOutput('\r\nHKEY_LOCAL_MACHINE\\Software\\Run\r\n\r\n');
  assert.strictEqual(items.length, 0);
});

test('parseRegQueryOutput 空输入', () => {
  assert.strictEqual(core.parseRegQueryOutput('').length, 0);
  assert.strictEqual(core.parseRegQueryOutput(null).length, 0);
});

test('extractExePath 带引号路径', () => {
  const cmd = '"C:\\Program Files\\App\\app.exe" /min --arg';
  assert.strictEqual(core.extractExePath(cmd), 'C:\\Program Files\\App\\app.exe');
});

test('extractExePath 无引号带参数', () => {
  const cmd = 'C:\\Windows\\system32\\notepad.exe arg1';
  assert.strictEqual(core.extractExePath(cmd), 'C:\\Windows\\system32\\notepad.exe');
});

test('extractExePath 环境变量路径', () => {
  const cmd = '%windir%\\system32\\SecurityHealthSystray.exe';
  assert.strictEqual(core.extractExePath(cmd), '%windir%\\system32\\SecurityHealthSystray.exe');
});

test('extractExePath rundll32 形式', () => {
  const cmd = 'rundll32.exe dllname,EntryPoint';
  assert.strictEqual(core.extractExePath(cmd), 'rundll32.exe');
});

test('extractExePath 空输入', () => {
  assert.strictEqual(core.extractExePath(''), '');
  assert.strictEqual(core.extractExePath(null), '');
});

test('exeBaseName 提取文件名去后缀', () => {
  assert.strictEqual(core.exeBaseName('C:\\Apps\\tool.exe'), 'tool');
  assert.strictEqual(core.exeBaseName('D:\\Program Files\\My App\\run.exe'), 'run');
  assert.strictEqual(core.exeBaseName(''), '');
});

test('parseStartupApprovedHex 禁用状态', () => {
  assert.strictEqual(core.parseStartupApprovedHex('03000000000000000000000000000000'), 'disabled');
});

test('parseStartupApprovedHex 启用状态', () => {
  assert.strictEqual(core.parseStartupApprovedHex('02000000000000000000000000000000'), 'enabled');
});

test('parseStartupApprovedHex Buffer 输入', () => {
  const buf = Buffer.from([0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.strictEqual(core.parseStartupApprovedHex(buf), 'disabled');
  const buf2 = Buffer.from([0x02, 0, 0, 0]);
  assert.strictEqual(core.parseStartupApprovedHex(buf2), 'enabled');
});

test('parseStartupApprovedHex reg query 逗号格式', () => {
  assert.strictEqual(core.parseStartupApprovedHex('03,00,00,00,00,00,00,00,00,00,00,00,00,00,00,00'), 'disabled');
});

test('parseStartupApprovedHex 未知/空', () => {
  assert.strictEqual(core.parseStartupApprovedHex(''), 'unknown');
  assert.strictEqual(core.parseStartupApprovedHex(null), 'unknown');
  assert.strictEqual(core.parseStartupApprovedHex('xyz'), 'unknown');
});

test('decorateEntry 补全 exe/baseName/source', () => {
  const e = core.decorateEntry({
    name: 'OneDrive',
    value: '"C:\\App\\OneDrive.exe" /bg',
    label: '注册表·当前用户'
  });
  assert.strictEqual(e.exe, 'C:\\App\\OneDrive.exe');
  assert.strictEqual(e.baseName, 'OneDrive');
  assert.strictEqual(e.source, '注册表·当前用户');
});

test('mergeStatus 按名称合并状态', () => {
  const entries = [
    { name: 'A', hive: 'HKCU', value: 'x' },
    { name: 'B', hive: 'HKCU', value: 'y' }
  ];
  const approved = [
    { hive: 'HKCU', name: 'A', status: 'disabled' }
  ];
  const merged = core.mergeStatus(entries, approved);
  assert.strictEqual(merged[0].status, 'disabled');
  assert.strictEqual(merged[1].status, 'enabled');
});

test('mergeStatus 无 approved 列表默认启用', () => {
  const entries = [{ name: 'A', hive: 'HKCU' }];
  const merged = core.mergeStatus(entries, []);
  assert.strictEqual(merged[0].status, 'enabled');
});

test('mergeStatus 同名跨 hive 优先同 hive', () => {
  const entries = [{ name: 'A', hive: 'HKLM' }];
  const approved = [
    { hive: 'HKCU', name: 'A', status: 'disabled' },
    { hive: 'HKLM', name: 'A', status: 'enabled' }
  ];
  const merged = core.mergeStatus(entries, approved);
  assert.strictEqual(merged[0].status, 'enabled');
});

test('computeStats 统计正确', () => {
  const entries = [
    { name: 'A', status: 'enabled', source: '注册表·当前用户' },
    { name: 'B', status: 'disabled', source: '注册表·当前用户' },
    { name: 'C', status: 'enabled', source: '启动文件夹·当前用户' }
  ];
  const s = core.computeStats(entries);
  assert.strictEqual(s.total, 3);
  assert.strictEqual(s.enabled, 2);
  assert.strictEqual(s.disabled, 1);
  assert.strictEqual(Object.keys(s.bySource).length, 2);
  assert.strictEqual(s.bySource['注册表·当前用户'], 2);
});

test('filterEntries 关键字过滤', () => {
  const entries = [
    { name: 'OneDrive', value: 'onedrive.exe', source: '注册表·当前用户' },
    { name: 'Notepad', value: 'notepad.exe', source: '启动文件夹' }
  ];
  assert.strictEqual(core.filterEntries(entries, 'one').length, 1);
  assert.strictEqual(core.filterEntries(entries, 'EXE').length, 2);
  assert.strictEqual(core.filterEntries(entries, '').length, 2);
});

test('makeFolderEntry 生成文件夹项', () => {
  const e = core.makeFolderEntry('C:\\Users\\x\\AppData\\...\\Startup\\tool.lnk', false);
  assert.strictEqual(e.hive, 'HKCU');
  assert.strictEqual(e.source, '启动文件夹·当前用户');
  assert.strictEqual(e.status, 'enabled');
});

test('validateNewEntry 合法输入', () => {
  const r = core.validateNewEntry({ name: 'MyTool', command: 'C:\\tool.exe' });
  assert.ok(r.ok);
});

test('validateNewEntry 缺名称', () => {
  const r = core.validateNewEntry({ name: '', command: 'C:\\tool.exe' });
  assert.ok(!r.ok);
  assert.ok(r.error);
});

test('validateNewEntry 缺命令', () => {
  const r = core.validateNewEntry({ name: 'X', command: '' });
  assert.ok(!r.ok);
});

test('validateNewEntry 名称含反斜杠', () => {
  const r = core.validateNewEntry({ name: 'a\\b', command: 'x' });
  assert.ok(!r.ok);
});

test('validateNewEntry 空输入', () => {
  const r = core.validateNewEntry(null);
  assert.ok(!r.ok);
});

test('parseRegKeyHeader 解析根键', () => {
  const r = core.parseRegKeyHeader('HKEY_CURRENT_USER\\Software\\Run');
  assert.strictEqual(r.hive, 'HKCU');
  const r2 = core.parseRegKeyHeader('HKEY_LOCAL_MACHINE\\Software\\Run');
  assert.strictEqual(r2.hive, 'HKLM');
  assert.strictEqual(core.parseRegKeyHeader(''), null);
});

test('REG_RUN_KEYS 包含 4 个位置', () => {
  assert.ok(core.REG_RUN_KEYS.length >= 4);
});

console.log('\n--------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
console.log('--------------------------------\n');
if (fail > 0) process.exit(1);
