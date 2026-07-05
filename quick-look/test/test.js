// 速览管家 - 核心逻辑单元测试
// 运行：node test/test.js
// 不依赖 Electron，测试纯 Node 模块 quick-look-core.js

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');
const core = require('../src/quick-look-core');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

console.log('\n=== 速览管家 核心测试 ===\n');

// ===== 1. 文件分类 =====
console.log('[1] 文件分类 categorize');
test('jpg 应分类为 image', () => {
  assert.strictEqual(core.categorize('/a/b/photo.jpg').category, 'image');
});
test('mp4 应分类为 video', () => {
  assert.strictEqual(core.categorize('movie.mp4').category, 'video');
});
test('mp3 应分类为 audio', () => {
  assert.strictEqual(core.categorize('song.mp3').category, 'audio');
});
test('pdf 应分类为 pdf', () => {
  assert.strictEqual(core.categorize('doc.pdf').category, 'pdf');
});
test('js 应分类为 code', () => {
  assert.strictEqual(core.categorize('app.js').category, 'code');
});
test('md 应分类为 markdown', () => {
  assert.strictEqual(core.categorize('readme.md').category, 'markdown');
});
test('json 应分类为 json', () => {
  assert.strictEqual(core.categorize('pkg.json').category, 'json');
});
test('zip 应分类为 archive', () => {
  assert.strictEqual(core.categorize('archive.zip').category, 'archive');
});
test('docx 应分类为 office', () => {
  assert.strictEqual(core.categorize('paper.docx').category, 'office');
});
test('ttf 应分类为 font', () => {
  assert.strictEqual(core.categorize('font.ttf').category, 'font');
});
test('未知扩展名应分类为 unknown', () => {
  assert.strictEqual(core.categorize('file.unknownext').category, 'unknown');
});
test('大写扩展名应正确分类', () => {
  assert.strictEqual(core.categorize('IMG.PNG').category, 'image');
});
test('无扩展名应分类为 unknown', () => {
  assert.strictEqual(core.categorize('README').category, 'unknown');
});

// ===== 2. 可预览判断 =====
console.log('\n[2] 可预览判断 isPreviewable');
test('png 文件可预览', () => {
  assert.strictEqual(core.isPreviewable('a.png'), true);
});
test('unknown 扩展名不可预览', () => {
  assert.strictEqual(core.isPreviewable('a.zzz'), false);
});

// ===== 3. 代码高亮语言映射 =====
console.log('\n[3] 代码语言映射 getHighlightLanguage');
test('js → javascript', () => {
  assert.strictEqual(core.getHighlightLanguage('js'), 'javascript');
});
test('ts → typescript', () => {
  assert.strictEqual(core.getHighlightLanguage('ts'), 'typescript');
});
test('py → python', () => {
  assert.strictEqual(core.getHighlightLanguage('py'), 'python');
});
test('未知扩展名返回 null', () => {
  assert.strictEqual(core.getHighlightLanguage('zzz'), null);
});

// ===== 4. 体积格式化 =====
console.log('\n[4] 体积格式化 formatSize');
test('500 B', () => {
  assert.strictEqual(core.formatSize(500), '500 B');
});
test('1.5 KB', () => {
  assert.strictEqual(core.formatSize(1536), '1.5 KB');
});
test('2.00 MB', () => {
  assert.strictEqual(core.formatSize(2 * 1024 * 1024), '2.00 MB');
});
test('3.50 GB', () => {
  assert.strictEqual(core.formatSize(3.5 * 1024 * 1024 * 1024), '3.50 GB');
});

// ===== 5. 元信息提取 =====
console.log('\n[5] 元信息提取 getMeta');
{
  const tmp = path.join(os.tmpdir(), 'ql_test_file.txt');
  fs.writeFileSync(tmp, 'hello world');
  const meta = core.getMeta(tmp);
  test('meta.name 正确', () => {
    assert.strictEqual(meta.name, 'ql_test_file.txt');
  });
  test('meta.ext 正确', () => {
    assert.strictEqual(meta.ext, 'txt');
  });
  test('meta.size 正确', () => {
    assert.strictEqual(meta.size, 11);
  });
  test('meta.sizeText 正确', () => {
    assert.strictEqual(meta.sizeText, '11 B');
  });
  test('meta.isFile 为 true', () => {
    assert.strictEqual(meta.isFile, true);
  });
  test('meta.isDirectory 为 false', () => {
    assert.strictEqual(meta.isDirectory, false);
  });
  test('meta.mtime 是 ISO 字符串', () => {
    assert.ok(typeof meta.mtime === 'string' && meta.mtime.includes('T'));
  });
  fs.unlinkSync(tmp);
}
test('不存在的文件返回 null', () => {
  assert.strictEqual(core.getMeta('Z:\\\\nonexistent\\\\file.txt'), null);
});

// ===== 6. 预览策略 =====
console.log('\n[6] 预览策略 decidePreview');
test('小图片 → image 策略', () => {
  const d = core.decidePreview('a.png', 1024);
  assert.strictEqual(d.kind, 'image');
  assert.strictEqual(d.supported, true);
});
test('小文本 → text 策略', () => {
  const d = core.decidePreview('a.txt', 100);
  assert.strictEqual(d.kind, 'text');
  assert.strictEqual(d.supported, true);
});
test('过大文本不支持', () => {
  const d = core.decidePreview('big.txt', core.MAX_TEXT_SIZE + 1);
  assert.strictEqual(d.supported, false);
});
test('过大视频不支持', () => {
  const d = core.decidePreview('big.mp4', core.MAX_MEDIA_SIZE + 1);
  assert.strictEqual(d.supported, false);
});
test('js 文件含 language 字段', () => {
  const d = core.decidePreview('app.js', 100);
  assert.strictEqual(d.kind, 'code');
  assert.strictEqual(d.language, 'javascript');
});
test('未知格式 kind=unknown supported=false', () => {
  const d = core.decidePreview('a.zzz', 100);
  assert.strictEqual(d.kind, 'unknown');
  assert.strictEqual(d.supported, false);
});

// ===== 7. 历史记录 =====
console.log('\n[7] 历史记录 History');
test('新增记录置顶', () => {
  const h = new core.History(3);
  h.add('a.txt');
  h.add('b.txt');
  assert.deepStrictEqual(h.list().map(i => i.path), ['b.txt', 'a.txt']);
});
test('重复添加去重并置顶', () => {
  const h = new core.History(3);
  h.add('a.txt');
  h.add('b.txt');
  h.add('a.txt');
  assert.deepStrictEqual(h.list().map(i => i.path), ['a.txt', 'b.txt']);
});
test('超过上限截断', () => {
  const h = new core.History(2);
  h.add('a'); h.add('b'); h.add('c');
  assert.strictEqual(h.list().length, 2);
  assert.strictEqual(h.list()[0].path, 'c');
});
test('clear 清空', () => {
  const h = new core.History();
  h.add('a'); h.clear();
  assert.strictEqual(h.list().length, 0);
});
test('toJSON / fromJSON 往返', () => {
  const h = new core.History(5);
  h.add('x'); h.add('y');
  const json = JSON.stringify(h.toJSON());
  const h2 = core.History.fromJSON(JSON.parse(json));
  assert.deepStrictEqual(h2.list().map(i => i.path), ['y', 'x']);
  assert.strictEqual(h2.maxSize, 5);
});
test('空路径不添加', () => {
  const h = new core.History();
  h.add('');
  assert.strictEqual(h.list().length, 0);
});

// ===== 8. 配置合并 =====
console.log('\n[8] 配置合并 mergeConfig');
test('空配置返回默认值', () => {
  const cfg = core.mergeConfig();
  assert.strictEqual(cfg.hotkey, 'Alt+Q');
  assert.strictEqual(cfg.theme, 'light');
  assert.strictEqual(cfg.windowWidth, 960);
});
test('部分覆盖保留其他默认', () => {
  const cfg = core.mergeConfig({ hotkey: 'Ctrl+Space' });
  assert.strictEqual(cfg.hotkey, 'Ctrl+Space');
  assert.strictEqual(cfg.windowWidth, 960);
});
test('字体配置存在', () => {
  const cfg = core.mergeConfig();
  assert.ok(cfg.fontFamily.includes('PingFang SC'));
});

// ===== 9. TYPE_CATEGORIES 完整性 =====
console.log('\n[9] 类型表完整性');
test('所有分类都有数组', () => {
  for (const [k, v] of Object.entries(core.TYPE_CATEGORIES)) {
    assert.ok(Array.isArray(v) && v.length > 0, `分类 ${k} 必须是非空数组`);
  }
});

// ===== 总结 =====
console.log(`\n=== 测试结果：通过 ${passed} 项，失败 ${failed} 项 ===\n`);
if (failed > 0) {
  process.exit(1);
}
