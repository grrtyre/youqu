// 壁纸管理器 - 核心逻辑测试
// 运行：node test/logic.test.js
// 不依赖 Electron，仅测试纯函数逻辑

'use strict';

const assert = require('assert');
const utils = require('../src/utils');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('\n[wallpaper-manager] 核心逻辑测试\n');

// === formatSize ===
console.log('formatSize:');
test('字节数 < 1KB 显示 B', () => {
  assert.strictEqual(utils.formatSize(512), '512 B');
});
test('1024 显示为 1.0 KB', () => {
  assert.strictEqual(utils.formatSize(1024), '1.0 KB');
});
test('1MB 显示为 1.0 MB', () => {
  assert.strictEqual(utils.formatSize(1024 * 1024), '1.0 MB');
});
test('1.5MB 显示为 1.5 MB', () => {
  assert.strictEqual(utils.formatSize(1024 * 1024 * 1.5), '1.5 MB');
});
test('0 或负数返回空字符串', () => {
  assert.strictEqual(utils.formatSize(0), '');
  assert.strictEqual(utils.formatSize(-1), '');
});

// === basename ===
console.log('\nbasename:');
test('Windows 路径取末段', () => {
  assert.strictEqual(utils.basename('D:\\wallpapers\\a.jpg'), 'a.jpg');
});
test('Unix 路径取末段', () => {
  assert.strictEqual(utils.basename('/usr/share/wp.png'), 'wp.png');
});
test('空路径返回空', () => {
  assert.strictEqual(utils.basename(''), '');
});

// === extname / isImageFile ===
console.log('\nextname / isImageFile:');
test('小写 jpg 是图片', () => {
  assert.strictEqual(utils.isImageFile('a.jpg'), true);
});
test('大写 JPG 是图片', () => {
  assert.strictEqual(utils.isImageFile('A.JPG'), true);
});
test('webp 是图片', () => {
  assert.strictEqual(utils.isImageFile('x.webp'), true);
});
test('txt 不是图片', () => {
  assert.strictEqual(utils.isImageFile('readme.txt'), false);
});
test('无扩展名不是图片', () => {
  assert.strictEqual(utils.isImageFile('noext'), false);
});

// === defaultConfig ===
console.log('\ndefaultConfig:');
test('默认配置含必填字段', () => {
  const cfg = utils.defaultConfig();
  assert.ok(Array.isArray(cfg.sources));
  assert.ok(Array.isArray(cfg.favorites));
  assert.strictEqual(cfg.autoChange, false);
  assert.strictEqual(cfg.intervalHours, 6);
  assert.strictEqual(cfg.bingDaily, false);
});
test('每次返回新对象', () => {
  const a = utils.defaultConfig();
  const b = utils.defaultConfig();
  a.sources.push('x');
  assert.strictEqual(b.sources.length, 0);
});

// === sortWallpapers ===
console.log('\nsortWallpapers:');
test('收藏项排前面', () => {
  const list = [
    { path: '/a.png', name: 'a', mtime: 100 },
    { path: '/b.png', name: 'b', mtime: 200 },
    { path: '/c.png', name: 'c', mtime: 50 }
  ];
  const sorted = utils.sortWallpapers(list, ['/b.png']);
  assert.strictEqual(sorted[0].path, '/b.png');
});
test('非收藏按 mtime 倒序', () => {
  const list = [
    { path: '/a.png', name: 'a', mtime: 100 },
    { path: '/b.png', name: 'b', mtime: 300 },
    { path: '/c.png', name: 'c', mtime: 200 }
  ];
  const sorted = utils.sortWallpapers(list, []);
  assert.strictEqual(sorted[0].path, '/b.png');
  assert.strictEqual(sorted[1].path, '/c.png');
  assert.strictEqual(sorted[2].path, '/a.png');
});
test('不修改原数组', () => {
  const list = [{ path: '/a', name: 'a', mtime: 1 }];
  utils.sortWallpapers(list, []);
  assert.strictEqual(list.length, 1);
});

// === filterByView ===
console.log('\nfilterByView:');
test('favorites 视图只返回收藏', () => {
  const list = [
    { path: '/a', name: 'a' },
    { path: '/b', name: 'b' }
  ];
  const r = utils.filterByView(list, 'favorites', ['/b'], '');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].path, '/b');
});
test('current 视图返回当前壁纸', () => {
  const list = [{ path: '/a', name: 'a' }];
  const r = utils.filterByView(list, 'current', [], '/a');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].path, '/a');
});
test('current 视图无当前壁纸返回空', () => {
  const list = [{ path: '/a', name: 'a' }];
  const r = utils.filterByView(list, 'current', [], '');
  assert.strictEqual(r.length, 0);
});
test('all 视图返回全部', () => {
  const list = [{ path: '/a', name: 'a' }, { path: '/b', name: 'b' }];
  const r = utils.filterByView(list, 'all', [], '');
  assert.strictEqual(r.length, 2);
});

// === filterByQuery ===
console.log('\nfilterByQuery:');
test('按名称模糊匹配', () => {
  const list = [{ name: 'beach.jpg' }, { name: 'mountain.png' }, { name: 'Beach2.jpg' }];
  const r = utils.filterByQuery(list, 'beach');
  assert.strictEqual(r.length, 2);
});
test('空查询返回原列表', () => {
  const list = [{ name: 'a' }];
  const r = utils.filterByQuery(list, '');
  assert.strictEqual(r.length, 1);
});

// === escapeHtml ===
console.log('\nescapeHtml:');
test('转义特殊字符', () => {
  assert.strictEqual(utils.escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
});
test('普通字符串不变', () => {
  assert.strictEqual(utils.escapeHtml('hello world'), 'hello world');
});

// === nextChangeTime / isTimeToChange ===
console.log('\nnextChangeTime / isTimeToChange:');
test('下次切换时间 = 上次 + 间隔', () => {
  const last = 1000;
  assert.strictEqual(utils.nextChangeTime(last, 1), 1000 + 3600 * 1000);
});
test('到点应返回 true', () => {
  const last = 0;
  const now = last + 6 * 3600 * 1000 + 1;
  assert.strictEqual(utils.isTimeToChange(last, 6, now), true);
});
test('未到点应返回 false', () => {
  const last = 0;
  const now = last + 6 * 3600 * 1000 - 1;
  assert.strictEqual(utils.isTimeToChange(last, 6, now), false);
});
test('间隔最小 1 小时', () => {
  assert.strictEqual(utils.nextChangeTime(0, 0), 3600 * 1000);
});

console.log(`\n==== 测试完成: ${pass} 通过, ${fail} 失败 ====\n`);
if (fail > 0) process.exit(1);
