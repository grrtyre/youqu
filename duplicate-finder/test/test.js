// test/test.js — 清重管家 核心逻辑测试
// 测试 scanner 三阶段算法：扫描 → 部分哈希 → 完整哈希
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanDirectory, classifyExt, formatBytes } = require('../src/core/scanner');

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    pass++;
  } else {
    console.error(`  ✗ ${name} ${extra || ''}`);
    fail++;
  }
}

async function main() {
  console.log('清重管家 核心逻辑测试');
  console.log('========================');

  // --- 工具函数 ---
  console.log('\n[1] 工具函数');
  assert('classifyExt 图片', classifyExt('.png') === 'image');
  assert('classifyExt 视频', classifyExt('.mp4') === 'video');
  assert('classifyExt 代码', classifyExt('.js') === 'code');
  assert('classifyExt 其他', classifyExt('.unknown') === 'other');
  assert('formatBytes B', formatBytes(500) === '500 B');
  assert('formatBytes KB', formatBytes(1024) === '1.0 KB');
  assert('formatBytes MB', formatBytes(1024 * 1024) === '1.0 MB');
  assert('formatBytes GB', /GB$/.test(formatBytes(1024 * 1024 * 1024)));

  // --- 创建测试目录 ---
  console.log('\n[2] 构造测试目录');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dup-test-'));
  console.log('  临时目录:', tmp);

  // 第一组：3 个内容完全相同的文本文件（不同名）
  const content1 = 'Hello Duplicate World!\n这是测试内容 line 2\nline 3';
  fs.writeFileSync(path.join(tmp, 'a.txt'), content1);
  fs.writeFileSync(path.join(tmp, 'b.txt'), content1);
  fs.writeFileSync(path.join(tmp, 'c.txt'), content1);

  // 第二组：2 个相同的图片（用极简 PNG）
  // 1x1 红色 PNG
  const png1x1 = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0xE2, 0x21, 0xBC,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(path.join(tmp, 'p1.png'), png1x1);
  fs.writeFileSync(path.join(tmp, 'p2.png'), png1x1);

  // 第三组：内容不同的文件（同名但内容不同，应被识别为非重复）
  fs.writeFileSync(path.join(tmp, 'x.txt'), '内容A 12345');
  fs.writeFileSync(path.join(tmp, 'y.txt'), '内容B 67890');

  // 第四组：空文件（minSize=1 应被排除）
  fs.writeFileSync(path.join(tmp, 'empty1.txt'), '');
  fs.writeFileSync(path.join(tmp, 'empty2.txt'), '');

  console.log('  测试文件已就绪');

  // --- 扫描 ---
  console.log('\n[3] 扫描测试目录');
  const events = [];
  const result = await scanDirectory(tmp, { minSize: 1 }, (p) => events.push(p));
  console.log('  扫描事件数:', events.length);
  assert('产生了进度事件', events.length > 0);
  assert('最终事件为 done', events[events.length - 1].phase === 'done');

  console.log('\n[4] 结果断言');
  console.log('  统计:', JSON.stringify(result.stats, null, 2));
  assert('扫描文件数 >= 7', result.stats.scanned >= 7);
  assert('重复组数 = 2', result.stats.duplicateGroups === 2,
    `实际: ${result.stats.duplicateGroups}`);
  assert('重复文件数 = 5', result.stats.duplicateFiles === 5,
    `实际: ${result.stats.duplicateFiles}`);

  // 第一组：3 个 txt，每个 1 份内容，浪费 = size * 2
  const txtGroup = result.groups.find(g => g.files[0].ext === '.txt' && g.files.length === 3);
  assert('存在 3 个一组的 txt', !!txtGroup);
  if (txtGroup) {
    assert('txt 组浪费 = size * 2', txtGroup.waste === txtGroup.size * 2,
      `实际: ${txtGroup.waste}, 期望: ${txtGroup.size * 2}`);
    const names = txtGroup.files.map(f => f.name).sort();
    assert('txt 组包含 a/b/c.txt', names.join(',') === 'a.txt,b.txt,c.txt');
  }

  // 第二组：2 个 png
  const pngGroup = result.groups.find(g => g.files[0].ext === '.png' && g.files.length === 2);
  assert('存在 2 个一组的 png', !!pngGroup);
  if (pngGroup) {
    assert('png 组浪费 = size * 1', pngGroup.waste === pngGroup.size);
    const names = pngGroup.files.map(f => f.name).sort();
    assert('png 组包含 p1/p2.png', names.join(',') === 'p1.png,p2.png');
  }

  // 排序检查：浪费多的组在前
  if (txtGroup && pngGroup) {
    const idxT = result.groups.indexOf(txtGroup);
    const idxP = result.groups.indexOf(pngGroup);
    const expectedOrder = txtGroup.waste >= pngGroup.waste;
    assert('组按浪费空间降序', expectedOrder ? idxT < idxP : idxP < idxT);
  }

  // --- 清理 ---
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('\n[5] 清理临时目录 ✓');
  } catch (e) {
    console.warn('\n[5] 清理失败（不影响测试结果）:', e.message);
  }

  // --- 结果 ---
  console.log('\n========================');
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('测试异常:', e);
  process.exit(1);
});
