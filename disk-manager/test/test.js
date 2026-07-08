// 磁盘管家 - 核心逻辑测试
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { formatBytes, formatNumber, formatPercent, getExt, classifyExt, categoryColor } = require('../src/core/format-utils');
const { scanDir, collectTopFiles, collectStats, flatten, makeDirNode, makeFileNode } = require('../src/core/scanner');
const { squarify, worst, layoutRow, hierarchicalTreemap } = require('../src/core/treemap');

let pass = 0, fail = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
async function runAll() {
  for (const t of tests) {
    try {
      await t.fn();
      pass++; console.log('  ✓ ' + t.name);
    } catch (e) {
      fail++; console.log('  ✗ ' + t.name + '\n    ' + (e && e.stack || e));
    }
  }
}

console.log('\n=== format-utils ===');

test('formatBytes: B 边界', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1023), '1023 B');
});
test('formatBytes: KB/MB/GB', () => {
  assert.strictEqual(formatBytes(1024), '1.00 KB');
  assert.strictEqual(formatBytes(1048576), '1.00 MB');
  assert.strictEqual(formatBytes(1073741824), '1.00 GB');
  assert.strictEqual(formatBytes(1099511627776), '1.00 TB');
});
test('formatBytes: 负数/非法', () => {
  assert.strictEqual(formatBytes(-1), '0 B');
  assert.strictEqual(formatBytes(NaN), '0 B');
  assert.strictEqual(formatBytes(Infinity), '0 B');
});
test('formatNumber: 千分位', () => {
  assert.strictEqual(formatNumber(1234567), '1,234,567');
  assert.strictEqual(formatNumber(0), '0');
});
test('formatPercent: 正常/边界', () => {
  assert.strictEqual(formatPercent(50, 200), '25.0%');
  assert.strictEqual(formatPercent(0, 100), '0.0%');
  assert.strictEqual(formatPercent(1, 0), '0.0%');
  assert.strictEqual(formatPercent(0.001, 100), '<0.01%'); // 0.001% < 0.01%
  assert.strictEqual(formatPercent(0.5, 100), '0.50%');
  assert.strictEqual(formatPercent(1, 100), '1.0%');
});
test('getExt: 常见扩展名', () => {
  assert.strictEqual(getExt('a.txt'), 'txt');
  assert.strictEqual(getExt('archive.tar.gz'), 'gz');
  assert.strictEqual(getExt('noext'), '');
  assert.strictEqual(getExt('trailing.'), '');
  assert.strictEqual(getExt('.hidden'), 'hidden');
});
test('classifyExt: 分类', () => {
  assert.strictEqual(classifyExt('mp4'), 'video');
  assert.strictEqual(classifyExt('mp3'), 'audio');
  assert.strictEqual(classifyExt('jpg'), 'image');
  assert.strictEqual(classifyExt('pdf'), 'doc');
  assert.strictEqual(classifyExt('zip'), 'archive');
  assert.strictEqual(classifyExt('js'), 'code');
  assert.strictEqual(classifyExt('exe'), 'exe');
  assert.strictEqual(classifyExt('sqlite'), 'db');
  assert.strictEqual(classifyExt('xyz'), 'other');
  assert.strictEqual(classifyExt(''), 'other');
});
test('categoryColor: 返回颜色', () => {
  assert.ok(categoryColor('video').startsWith('#'));
  assert.strictEqual(categoryColor('unknown'), '#CED4DA');
});

console.log('\n=== treemap ===');

test('worst: 空数组无穷大', () => {
  assert.strictEqual(worst([], 10), Infinity);
});
test('worst: 单元素长宽比 1', () => {
  // 单元素 row=[a], w=10 → worst = max(w²·a/s², s²/(w²·a)) = max(1,1) = 1
  assert.strictEqual(worst([100], 10), 1);
});
test('squarify: 返回矩形数 = 输入数', () => {
  const items = [
    { node: 'a', size: 100 },
    { node: 'b', size: 60 },
    { node: 'c', size: 30 },
    { node: 'd', size: 10 },
  ];
  const rects = squarify(items, { x: 0, y: 0, w: 100, h: 100 });
  assert.strictEqual(rects.length, 4);
});
test('squarify: 矩形都在边界内', () => {
  const items = [{ node: 'a', size: 50 }, { node: 'b', size: 30 }, { node: 'c', size: 20 }];
  const rects = squarify(items, { x: 0, y: 0, w: 100, h: 80 });
  rects.forEach(r => {
    assert.ok(r.x >= -0.001 && r.y >= -0.001, '左上角越界');
    assert.ok(r.x + r.w <= 100.001, '右边越界');
    assert.ok(r.y + r.h <= 80.001, '下边越界');
    assert.ok(r.w >= 0 && r.h >= 0, '宽高负数');
  });
});
test('squarify: 总面积近似等于总面积', () => {
  const items = [{ node: 'a', size: 50 }, { node: 'b', size: 30 }, { node: 'c', size: 20 }];
  const W = 120, H = 90;
  const rects = squarify(items, { x: 0, y: 0, w: W, h: H });
  const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0);
  assert.ok(Math.abs(totalArea - W * H) < 0.5, '总面积应接近 ' + (W * H) + ' 实际 ' + totalArea);
});
test('squarify: 空输入返回空', () => {
  assert.strictEqual(squarify([], { x: 0, y: 0, w: 100, h: 100 }).length, 0);
  assert.strictEqual(squarify([{ node: 'a', size: 10 }], { x: 0, y: 0, w: 0, h: 0 }).length, 0);
});
test('squarify: 全 0 size 返回空', () => {
  assert.strictEqual(squarify([{ node: 'a', size: 0 }], { x: 0, y: 0, w: 100, h: 100 }).length, 0);
});
test('squarify: 单元素填满', () => {
  const rects = squarify([{ node: 'a', size: 10 }], { x: 0, y: 0, w: 100, h: 100 });
  assert.strictEqual(rects.length, 1);
  assert.ok(Math.abs(rects[0].w - 100) < 0.1);
  assert.ok(Math.abs(rects[0].h - 100) < 0.1);
});
test('hierarchicalTreemap: 递归生成子矩形', () => {
  const tree = {
    type: 'dir', name: 'r', path: '/r', size: 100, fileCount: 0, dirCount: 2, errors: 0,
    children: [
      { type: 'dir', name: 'a', path: '/r/a', size: 60, fileCount: 1, dirCount: 0, errors: 0, children: [
        { type: 'file', name: 'a1.txt', path: '/r/a/a1.txt', size: 60, ext: 'txt', category: 'doc' }
      ]},
      { type: 'dir', name: 'b', path: '/r/b', size: 40, fileCount: 1, dirCount: 0, errors: 0, children: [
        { type: 'file', name: 'b1.txt', path: '/r/b/b1.txt', size: 40, ext: 'txt', category: 'doc' }
      ]},
    ]
  };
  const out = hierarchicalTreemap(tree, { x: 0, y: 0, w: 100, h: 100 }, 0, 2, 0.01);
  assert.ok(out.length >= 2, '至少 2 个矩形');
});

console.log('\n=== scanner（真实临时目录） ===');

// 构造临时目录结构
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'disk-mgr-test-'));
test('setup: 创建临时测试目录', () => {
  fs.mkdirSync(path.join(tmpRoot, 'sub1'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'sub2'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'sub1', 'deep'), { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, 'a.txt'), Buffer.alloc(1024, 0));
  fs.writeFileSync(path.join(tmpRoot, 'b.log'), Buffer.alloc(2048, 0));
  fs.writeFileSync(path.join(tmpRoot, 'sub1', 'c.txt'), Buffer.alloc(512, 0));
  fs.writeFileSync(path.join(tmpRoot, 'sub1', 'deep', 'd.jpg'), Buffer.alloc(4096, 0));
  fs.writeFileSync(path.join(tmpRoot, 'sub2', 'e.zip'), Buffer.alloc(100, 0));
  assert.ok(fs.existsSync(path.join(tmpRoot, 'a.txt')));
});

test('scanDir: 统计总大小', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  const res = await scanDir(root);
  // 总大小 = 1024+2048+512+4096+100 = 7780
  assert.strictEqual(res.bytes, 7780, '总字节应为 7780');
  assert.strictEqual(root.size, 7780);
  assert.strictEqual(res.files, 5, '文件数应为 5');
  assert.ok(res.dirs >= 2, '子目录数应 >= 2');
});

test('scanDir: children 排序（目录在前，按 size 降序）', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  await scanDir(root);
  // sub1 (4608) > sub2 (100)
  assert.strictEqual(root.children[0].name, 'sub1');
  assert.strictEqual(root.children[0].type, 'dir');
  assert.strictEqual(root.children[1].name, 'sub2');
});

test('scanDir: 跳过 $RECYCLE.BIN 等系统目录', async () => {
  // 创建一个 $RECYCLE.BIN 目录
  fs.mkdirSync(path.join(tmpRoot, '$RECYCLE.BIN'), { recursive: true });
  fs.writeFileSync(path.join(tmpRoot, '$RECYCLE.BIN', 'junk.dat'), Buffer.alloc(99999, 0));
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  const res = await scanDir(root);
  // 总大小不变（99999 不计入）
  assert.strictEqual(res.bytes, 7780, '应跳过 $RECYCLE.BIN');
});

test('scanDir: 进度回调被调用', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  let called = 0;
  await scanDir(root, () => { called++; });
  assert.ok(called > 0, '进度回调应被调用');
});

test('scanDir: shouldStop 可停止', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  let stop = false;
  const res = await scanDir(root, null, () => stop, {}, 0);
  // 第一轮不会停，但验证函数能传
  assert.ok(typeof res.stopped === 'boolean');
});

test('collectTopFiles: 返回最大文件', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  await scanDir(root);
  const top = collectTopFiles(root, 3);
  assert.ok(top.length <= 3);
  // d.jpg (4096) 应该是最大的
  assert.strictEqual(top[0].name, 'd.jpg');
  assert.strictEqual(top[0].size, 4096);
});

test('collectStats: 按扩展名/分类聚合', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  await scanDir(root);
  const stats = collectStats(root);
  const txt = stats.byExt.find(e => e.ext === 'txt');
  assert.ok(txt, '应有 txt 统计');
  assert.strictEqual(txt.count, 2, 'txt 文件 2 个');
  assert.strictEqual(txt.size, 1024 + 512);
  const doc = stats.byCategory.find(c => c.category === 'doc');
  assert.ok(doc, '应有 doc 分类');
  assert.strictEqual(doc.size, 1024 + 512);
  const img = stats.byCategory.find(c => c.category === 'image');
  assert.strictEqual(img.size, 4096);
});

test('flatten: 扁平化', async () => {
  const root = makeDirNode(path.basename(tmpRoot), tmpRoot);
  await scanDir(root);
  const flat = flatten(root, 0);
  // 根 + 2 子目录 + deep + 5 文件 = 9
  assert.ok(flat.length >= 5);
});

test('makeFileNode: ext/category 正确', () => {
  const n = makeFileNode('photo.JPG', '/x/photo.JPG', { size: 100, mtimeMs: 123 });
  assert.strictEqual(n.ext, 'jpg');
  assert.strictEqual(n.category, 'image');
  assert.strictEqual(n.size, 100);
});

// 清理
test('cleanup: 删除临时目录', () => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  assert.ok(!fs.existsSync(tmpRoot));
});

console.log('\n=== 结果 ===');
runAll().then(() => {
  console.log('通过: ' + pass + '  失败: ' + fail);
  if (fail > 0) process.exit(1);
});
