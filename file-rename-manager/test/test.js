// test.js —— 核心重命名引擎测试
// 运行: node test/test.js
// 不依赖 Electron，纯逻辑测试

const path = require('path');
const assert = require('assert');
const {
  applyRule,
  generatePreview,
  executeRename,
  undoRename,
  formatDate,
  validateFileName,
  escapeRegex,
  createFileItem
} = require('../src/core/rename-engine');
const { loadPresets, addPreset, deletePreset } = require('../src/core/preset-store');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

// 模拟文件项
function mockItem(name, opts = {}) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  return {
    id: Math.random().toString(36).slice(2),
    dir: 'C:/test',
    name,
    base,
    ext,
    size: 1024,
    mtime: new Date('2026-07-04T10:30:00').getTime(),
    ctime: new Date('2026-07-01T08:00:00').getTime(),
    birthtime: new Date('2026-06-15T12:00:00').getTime(),
    exifDate: opts.exifDate || null,
    index: opts.index || 0
  };
}

console.log('\n=== 重命名管家 - 核心引擎测试 ===\n');

// ---------- 文本替换 ----------
console.log('[文本替换]');
test('基本替换', () => {
  const result = applyRule('photo_001', '', mockItem('photo_001'), {
    type: 'replace', find: 'photo', replaceWith: 'img'
  }, { counter: 0 });
  assert.strictEqual(result, 'img_001');
});

test('替换全部匹配', () => {
  const result = applyRule('foo_bar_foo', '', mockItem('foo_bar_foo'), {
    type: 'replace', find: 'foo', replaceWith: 'x'
  }, { counter: 0 });
  assert.strictEqual(result, 'x_bar_x');
});

test('不区分大小写替换', () => {
  const result = applyRule('Photo_PHOTO', '', mockItem('Photo_PHOTO'), {
    type: 'replace', find: 'photo', replaceWith: 'img', caseSensitive: false
  }, { counter: 0 });
  assert.strictEqual(result, 'img_img');
});

test('全词匹配', () => {
  const result = applyRule('photograph_photo', '', mockItem('photograph_photo'), {
    type: 'replace', find: 'photo', replaceWith: 'img', wholeWord: true
  }, { counter: 0 });
  assert.strictEqual(result, 'photograph_img');
});

test('删除文本（替换为空）', () => {
  const result = applyRule('photo_final_v2', '', mockItem('photo_final_v2'), {
    type: 'replace', find: '_final', replaceWith: ''
  }, { counter: 0 });
  assert.strictEqual(result, 'photo_v2');
});

// ---------- 正则替换 ----------
console.log('[正则替换]');
test('正则捕获组重排', () => {
  const result = applyRule('2026-07-04_report', '', mockItem('2026-07-04_report'), {
    type: 'regex', pattern: '(\\d{4})-(\\d{2})-(\\d{2})_(.+)', replacement: '$4_$1$2$3'
  }, { counter: 0 });
  assert.strictEqual(result, 'report_20260704');
});

test('无效正则保持原样', () => {
  const result = applyRule('test', '', mockItem('test'), {
    type: 'regex', pattern: '(invalid', replacement: 'x'
  }, { counter: 0 });
  assert.strictEqual(result, 'test');
});

test('正则删除所有数字', () => {
  const result = applyRule('file123_v456', '', mockItem('file123_v456'), {
    type: 'regex', pattern: '\\d+', replacement: ''
  }, { counter: 0 });
  assert.strictEqual(result, 'file_v');
});

// ---------- 序号命名 ----------
console.log('[序号命名]');
test('序号替换模式', () => {
  const items = [mockItem('a.txt', { index: 0 }), mockItem('b.txt', { index: 1 }), mockItem('c.txt', { index: 2 })];
  const ctx = { counter: 0 };
  const results = items.map(it => applyRule(it.base, it.ext, it, {
    type: 'sequence', prefix: 'img_', start: 1, step: 1, pad: 3, position: 'replace'
  }, ctx));
  assert.deepStrictEqual(results, ['img_001', 'img_002', 'img_003']);
});

test('序号前缀模式', () => {
  const ctx = { counter: 0 };
  const result = applyRule('photo', '', mockItem('photo'), {
    type: 'sequence', prefix: '(', start: 1, step: 1, pad: 0, suffix: ')', position: 'prefix'
  }, ctx);
  assert.strictEqual(result, '(1)photo');
});

test('序号自定义步长', () => {
  const items = [mockItem('a'), mockItem('b'), mockItem('c')];
  const ctx = { counter: 0 };
  const results = items.map(it => applyRule(it.base, '', it, {
    type: 'sequence', start: 10, step: 5, pad: 2
  }, ctx));
  assert.deepStrictEqual(results, ['10', '15', '20']);
});

// ---------- 日期命名 ----------
console.log('[日期命名]');
test('日期格式 YYYYMMDD', () => {
  const result = applyRule('old', '', mockItem('old'), {
    type: 'date', source: 'mtime', format: 'YYYYMMDD'
  }, { counter: 0 });
  assert.strictEqual(result, '20260704');
});

test('日期格式 YYYY-MM-DD', () => {
  const result = applyRule('old', '', mockItem('old'), {
    type: 'date', source: 'birthtime', format: 'YYYY-MM-DD'
  }, { counter: 0 });
  assert.strictEqual(result, '2026-06-15');
});

test('EXIF 日期回退到 mtime', () => {
  const result = applyRule('old', '', mockItem('old'), {
    type: 'date', source: 'exif', format: 'YYYYMMDD'
  }, { counter: 0 });
  assert.strictEqual(result, '20260704');
});

test('EXIF 日期优先使用 EXIF', () => {
  // exif-reader 返回本地时间 ISO（无 Z 后缀），new Date 按本地时间解析
  const result = applyRule('old', '', mockItem('old', { exifDate: '2025-12-25T18:30:00' }), {
    type: 'date', source: 'exif', format: 'YYYY-MM-DD'
  }, { counter: 0 });
  assert.strictEqual(result, '2025-12-25');
});

// ---------- 大小写转换 ----------
console.log('[大小写转换]');
test('转大写', () => {
  assert.strictEqual(applyRule('hello', '', mockItem('hello'), { type: 'case', mode: 'upper' }, { counter: 0 }), 'HELLO');
});
test('转小写', () => {
  assert.strictEqual(applyRule('HELLO', '', mockItem('HELLO'), { type: 'case', mode: 'lower' }, { counter: 0 }), 'hello');
});
test('标题大小写', () => {
  assert.strictEqual(applyRule('hello world', '', mockItem('hello world'), { type: 'case', mode: 'title' }, { counter: 0 }), 'Hello World');
});
test('驼峰命名', () => {
  assert.strictEqual(applyRule('hello world foo', '', mockItem('hello world foo'), { type: 'case', mode: 'camel' }, { counter: 0 }), 'helloWorldFoo');
});
test('蛇形命名', () => {
  assert.strictEqual(applyRule('helloWorld foo-bar', '', mockItem('helloWorld foo-bar'), { type: 'case', mode: 'snake' }, { counter: 0 }), 'hello_world_foo_bar');
});

// ---------- 插入/删除 ----------
console.log('[插入/删除]');
test('插入文本到开头', () => {
  assert.strictEqual(applyRule('photo', '', mockItem('photo'), { type: 'insert', text: 'IMG_', position: 0 }, { counter: 0 }), 'IMG_photo');
});
test('插入文本到末尾', () => {
  assert.strictEqual(applyRule('photo', '', mockItem('photo'), { type: 'insert', text: '_v2', position: 5 }, { counter: 0 }), 'photo_v2');
});
test('删除指定字符集', () => {
  // chars=' -' 只删空格和短横线，下划线不在删除集中
  assert.strictEqual(applyRule('ph o-t_o', '', mockItem('ph o-t_o'), { type: 'remove', chars: ' -' }, { counter: 0 }), 'phot_o');
});

// ---------- 组合规则 ----------
console.log('[组合规则]');
test('多规则顺序应用', () => {
  const item = mockItem('photo_001.jpg');
  const rules = [
    { type: 'replace', find: 'photo', replaceWith: 'IMG' },
    { type: 'case', mode: 'lower' }
  ];
  const ctx = { counter: 0 };
  let base = item.base;
  for (const rule of rules) {
    base = applyRule(base, item.ext, item, rule, ctx);
  }
  assert.strictEqual(base, 'img_001');
});

// ---------- 预览生成 ----------
console.log('[预览生成]');
test('预览正确生成新名', () => {
  const items = [mockItem('a.txt'), mockItem('b.txt')];
  const rules = [{ type: 'sequence', prefix: 'file_', start: 1, pad: 3 }];
  const preview = generatePreview(items, rules);
  assert.strictEqual(preview[0].newName, 'file_001.txt');
  assert.strictEqual(preview[1].newName, 'file_002.txt');
  assert.strictEqual(preview[0].willChange, true);
});

test('检测冲突', () => {
  const items = [mockItem('a.txt'), mockItem('b.txt')];
  // 两个文件都改为 'same.txt'
  const rules = [{ type: 'replace', find: /a|b/, replaceWith: 'same' }];
  // 注意：这里用 regex 才能匹配 a 或 b
  rules[0] = { type: 'regex', pattern: '^[ab]$', replacement: 'same' };
  const preview = generatePreview(items, rules);
  assert.strictEqual(preview[0].hasConflict, true);
  assert.strictEqual(preview[1].hasConflict, true);
});

test('无变化时 willChange 为 false', () => {
  const items = [mockItem('a.txt')];
  const rules = [{ type: 'replace', find: 'xyz', replaceWith: 'abc' }];
  const preview = generatePreview(items, rules);
  assert.strictEqual(preview[0].willChange, false);
});

// ---------- 实际文件操作 ----------
console.log('[实际文件重命名]');
test('重命名并撤销', async () => {
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-test-'));
  try {
    // 创建测试文件
    const file1 = path.join(tmpDir, 'old1.txt');
    const file2 = path.join(tmpDir, 'old2.txt');
    fs.writeFileSync(file1, 'content1');
    fs.writeFileSync(file2, 'content2');

    const items = [
      { id: '1', dir: tmpDir, name: 'old1.txt', base: 'old1', ext: '.txt', index: 0 },
      { id: '2', dir: tmpDir, name: 'old2.txt', base: 'old2', ext: '.txt', index: 1 }
    ];
    const rules = [{ type: 'sequence', prefix: 'new_', start: 1, pad: 2 }];
    const preview = generatePreview(items, rules);

    const result = await executeRename(preview);
    assert.strictEqual(result.success, 2);
    assert.strictEqual(result.failed, 0);
    assert.ok(fs.existsSync(path.join(tmpDir, 'new_01.txt')));
    assert.ok(fs.existsSync(path.join(tmpDir, 'new_02.txt')));

    // 撤销
    const undoResult = await undoRename(result.history);
    assert.strictEqual(undoResult.success, 2);
    assert.ok(fs.existsSync(file1));
    assert.ok(fs.existsSync(file2));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('交换冲突自动处理', async () => {
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rename-swap-'));
  try {
    const fileA = path.join(tmpDir, 'a.txt');
    const fileB = path.join(tmpDir, 'b.txt');
    fs.writeFileSync(fileA, 'A');
    fs.writeFileSync(fileB, 'B');

    const items = [
      { id: '1', dir: tmpDir, name: 'a.txt', base: 'a', ext: '.txt', index: 0 },
      { id: '2', dir: tmpDir, name: 'b.txt', base: 'b', ext: '.txt', index: 1 }
    ];
    // a → b, b → a (交换)
    const rules = [{ type: 'regex', pattern: 'a', replacement: 'b' }];
    // 第二个文件的 b 替换为 a
    // 这里需要两个不同的规则集，但我们的 generatePreview 是统一的规则
    // 改用 sequence 来避免交换测试的复杂性
    const preview = [
      { id: '1', oldName: 'a.txt', newName: 'b.txt', oldPath: fileA, newPath: fileB, willChange: true, hasConflict: false },
      { id: '2', oldName: 'b.txt', newName: 'a.txt', oldPath: fileB, newPath: fileA, willChange: true, hasConflict: false }
    ];
    const result = await executeRename(preview);
    assert.strictEqual(result.success, 2);
    // 验证内容交换了
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'b.txt'), 'utf-8'), 'A');
    assert.strictEqual(fs.readFileSync(path.join(tmpDir, 'a.txt'), 'utf-8'), 'B');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------- 校验 ----------
console.log('[文件名校验]');
test('合法文件名', () => {
  assert.strictEqual(validateFileName('hello.txt'), null);
});
test('非法字符', () => {
  assert.ok(validateFileName('hello<world.txt') !== null);
});
test('空名', () => {
  assert.ok(validateFileName('') !== null);
});
test('保留名', () => {
  assert.ok(validateFileName('CON.txt') !== null);
});

// ---------- 日期格式化工具 ----------
console.log('[工具函数]');
test('formatDate 基本格式', () => {
  const ts = new Date('2026-07-04T15:30:45').getTime();
  assert.strictEqual(formatDate(ts, 'YYYY-MM-DD HH:mm:ss'), '2026-07-04 15:30:45');
});
test('formatDate YY 短年', () => {
  const ts = new Date('2026-01-05T09:00:00').getTime();
  assert.strictEqual(formatDate(ts, 'YYMMDD'), '260105');
});
test('escapeRegex 转义特殊字符', () => {
  assert.strictEqual(escapeRegex('a.b*c'), 'a\\.b\\*c');
});

// ---------- 预设存储 ----------
console.log('[预设存储]');
test('预设增删查', () => {
  const fs = require('fs');
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-test-'));
  const presetFile = path.join(tmpDir, 'presets.json');
  try {
    const preset = addPreset(presetFile, '出图预设', [
      { type: 'date', source: 'exif', format: 'YYYYMMDD' },
      { type: 'sequence', prefix: '_', start: 1, pad: 3 }
    ]);
    assert.ok(preset.id);

    const presets = loadPresets(presetFile);
    assert.strictEqual(presets.length, 1);
    assert.strictEqual(presets[0].name, '出图预设');

    assert.ok(deletePreset(presetFile, preset.id));
    assert.strictEqual(loadPresets(presetFile).length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------- 总结 ----------
console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===\n`);
if (failed > 0) {
  process.exit(1);
}
