// 拾色管家 - 核心逻辑测试
// 运行：node test/test.js

'use strict';

const assert = require('assert');
const colorUtils = require('../src/core/color-utils');
const storage = require('../src/core/storage');
const paletteExport = require('../src/core/palette-export');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log('\n=== 颜色转换 ===');

test('hexToRgb: 标准 6 位', () => {
  const r = colorUtils.hexToRgb('#007AFF');
  assert.deepStrictEqual(r, { r: 0, g: 122, b: 255 });
});

test('hexToRgb: 不带 #', () => {
  const r = colorUtils.hexToRgb('007aff');
  assert.deepStrictEqual(r, { r: 0, g: 122, b: 255 });
});

test('hexToRgb: 3 位简写', () => {
  const r = colorUtils.hexToRgb('#fff');
  assert.deepStrictEqual(r, { r: 255, g: 255, b: 255 });
});

test('hexToRgb: 大写', () => {
  const r = colorUtils.hexToRgb('#FF9500');
  assert.deepStrictEqual(r, { r: 255, g: 149, b: 0 });
});

test('hexToRgb: 非法输入返回 null', () => {
  assert.strictEqual(colorUtils.hexToRgb('#xyz'), null);
  assert.strictEqual(colorUtils.hexToRgb('12345'), null);
  assert.strictEqual(colorUtils.hexToRgb(null), null);
  assert.strictEqual(colorUtils.hexToRgb(123), null);
});

test('rgbToHex: 标准转换', () => {
  assert.strictEqual(colorUtils.rgbToHex(0, 122, 255), '#007aff');
  assert.strictEqual(colorUtils.rgbToHex(255, 255, 255), '#ffffff');
  assert.strictEqual(colorUtils.rgbToHex(0, 0, 0), '#000000');
});

test('rgbToHex: 越界自动裁剪', () => {
  assert.strictEqual(colorUtils.rgbToHex(-10, 300, 128), '#00ff80');
});

test('rgbToHex: 四舍五入', () => {
  assert.strictEqual(colorUtils.rgbToHex(0.4, 0.6, 122.4), '#00017a');
});

test('rgbToHsl: 蓝色 #007AFF', () => {
  const h = colorUtils.rgbToHsl(0, 122, 255);
  assert.strictEqual(h.h, 211);
  assert.strictEqual(h.s, 100);
  assert.strictEqual(h.l, 50);
});

test('rgbToHsl: 纯白', () => {
  const h = colorUtils.rgbToHsl(255, 255, 255);
  assert.strictEqual(h.s, 0);
  assert.strictEqual(h.l, 100);
});

test('rgbToHsl: 纯黑', () => {
  const h = colorUtils.rgbToHsl(0, 0, 0);
  assert.strictEqual(h.s, 0);
  assert.strictEqual(h.l, 0);
});

test('rgbToHsl: 纯红', () => {
  const h = colorUtils.rgbToHsl(255, 0, 0);
  assert.strictEqual(h.h, 0);
  assert.strictEqual(h.s, 100);
  assert.strictEqual(h.l, 50);
});

test('hslToRgb: 蓝色 hsl(211,100%,50%)', () => {
  // HSL 整数化存在 ±1 误差，验证主要分量且允许小误差
  const r = colorUtils.hslToRgb(211, 100, 50);
  assert.strictEqual(r.r, 0);
  assert.strictEqual(r.b, 255);
  assert.ok(Math.abs(r.g - 122) <= 1, `G 应接近 122，实际 ${r.g}`);
});

test('hslToRgb: 角度回环', () => {
  // h=360 应等价于 h=0
  const a = colorUtils.hslToRgb(360, 100, 50);
  const b = colorUtils.hslToRgb(0, 100, 50);
  assert.deepStrictEqual(a, b);
});

test('hslToRgb: 负角度', () => {
  const a = colorUtils.hslToRgb(-60, 100, 50);
  const b = colorUtils.hslToRgb(300, 100, 50);
  assert.deepStrictEqual(a, b);
});

test('HSL 与 RGB 互转一致性', () => {
  const samples = [
    { r: 12, g: 34, b: 56 },
    { r: 200, g: 100, b: 50 },
    { r: 128, g: 128, b: 128 },
    { r: 250, g: 240, b: 230 },
  ];
  samples.forEach((s) => {
    const hsl = colorUtils.rgbToHsl(s.r, s.g, s.b);
    const back = colorUtils.hslToRgb(hsl.h, hsl.s, hsl.l);
    // 因四舍五入允许 ±2 误差
    assert.ok(Math.abs(back.r - s.r) <= 2, `R 误差过大 ${s.r} -> ${back.r}`);
    assert.ok(Math.abs(back.g - s.g) <= 2, `G 误差过大 ${s.g} -> ${back.g}`);
    assert.ok(Math.abs(back.b - s.b) <= 2, `B 误差过大 ${s.b} -> ${back.b}`);
  });
});

console.log('\n=== 颜色工具 ===');

test('colorDistance: 相同颜色距离为 0', () => {
  assert.strictEqual(colorUtils.colorDistance({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 }), 0);
});

test('colorDistance: 黑白距离 √(3*255²)', () => {
  const d = colorUtils.colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(d - Math.sqrt(3 * 255 * 255)) < 0.001);
});

test('samplePixel: 取中心像素', () => {
  const data = [10, 20, 30, 255, 40, 50, 60, 255];
  const p = colorUtils.samplePixel(data, 2, 1, 0);
  assert.deepStrictEqual(p, { r: 40, g: 50, b: 60 });
});

test('samplePixel: 越界返回 null', () => {
  const data = [10, 20, 30, 255];
  assert.strictEqual(colorUtils.samplePixel(data, 1, 5, 5), null);
  assert.strictEqual(colorUtils.samplePixel(null, 1, 0, 0), null);
});

test('bestForeground: 浅色背景用深色字', () => {
  assert.strictEqual(colorUtils.bestForeground(255, 255, 255), '#1d1d1f');
});

test('bestForeground: 深色背景用白字', () => {
  assert.strictEqual(colorUtils.bestForeground(0, 0, 0), '#ffffff');
  assert.strictEqual(colorUtils.bestForeground(0, 122, 255), '#ffffff');
});

test('formatColor: 同时输出多种格式', () => {
  const f = colorUtils.formatColor({ r: 0, g: 122, b: 255 });
  assert.strictEqual(f.hex, '#007aff');
  assert.strictEqual(f.hexUpper, '#007AFF');
  assert.strictEqual(f.rgb, 'rgb(0, 122, 255)');
  assert.strictEqual(f.hsl, 'hsl(211, 100%, 50%)');
});

console.log('\n=== 存储与调色板 ===');

// 模拟 app 对象
const fakeApp = {
  _data: null,
  getPath() { return require('os').tmpdir(); },
};

function freshData() {
  return storage.defaultData();
}

test('defaultData: 包含默认调色板', () => {
  const d = freshData();
  assert.strictEqual(d.palettes.length, 1);
  assert.strictEqual(d.palettes[0].name, '我的调色板');
  assert.strictEqual(d.palettes[0].colors.length, 5);
  assert.strictEqual(d.history.length, 0);
});

test('pushHistory: 新颜色置顶', () => {
  const d = freshData();
  storage.pushHistory(d, '#007aff', { r: 0, g: 122, b: 255 });
  storage.pushHistory(d, '#ff3b30', { r: 255, g: 59, b: 48 });
  assert.strictEqual(d.history.length, 2);
  assert.strictEqual(d.history[0].hex, '#ff3b30');
});

test('pushHistory: 去重', () => {
  const d = freshData();
  storage.pushHistory(d, '#007aff', { r: 0, g: 122, b: 255 });
  storage.pushHistory(d, '#007aff', { r: 0, g: 122, b: 255 });
  assert.strictEqual(d.history.length, 1);
});

test('pushHistory: 上限 50 条', () => {
  const d = freshData();
  for (let i = 0; i < 60; i++) {
    storage.pushHistory(d, `#${i.toString(16).padStart(6, '0')}`, { r: i, g: 0, b: 0 });
  }
  assert.strictEqual(d.history.length, storage.MAX_HISTORY);
});

test('createPalette: 新建带 id', () => {
  const d = freshData();
  const p = storage.createPalette(d, '我的色卡');
  assert.ok(p.id);
  assert.strictEqual(p.name, '我的色卡');
  assert.strictEqual(d.palettes.length, 2);
});

test('addColorToPalette: 去重', () => {
  const d = freshData();
  const ok1 = storage.addColorToPalette(d, 'default', '#abcdef');
  const ok2 = storage.addColorToPalette(d, 'default', '#abcdef');
  assert.strictEqual(ok1, true);
  assert.strictEqual(ok2, false);
});

test('removeColorFromPalette', () => {
  const d = freshData();
  storage.removeColorFromPalette(d, 'default', '#007aff');
  const p = d.palettes.find((x) => x.id === 'default');
  assert.ok(!p.colors.includes('#007aff'));
});

test('deletePalette: 至少保留一个', () => {
  const d = freshData();
  assert.strictEqual(storage.deletePalette(d, 'default'), false);
  storage.createPalette(d, 'second');
  assert.strictEqual(storage.deletePalette(d, 'default'), true);
  assert.strictEqual(d.palettes.length, 1);
});

test('save & load: 往返一致', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(require('os').tmpdir(), 'color-picker-data.json');
  try { fs.unlinkSync(file); } catch (e) {}
  const d = freshData();
  storage.pushHistory(d, '#123456', { r: 0x12, g: 0x34, b: 0x56 });
  storage.save(fakeApp, d);
  const loaded = storage.load(fakeApp);
  assert.strictEqual(loaded.history.length, 1);
  assert.strictEqual(loaded.history[0].hex, '#123456');
});

console.log('\n=== WCAG 对比度 ===');

test('relativeLuminance: 纯黑为 0', () => {
  assert.strictEqual(colorUtils.relativeLuminance(0, 0, 0), 0);
});

test('relativeLuminance: 纯白为 1', () => {
  assert.strictEqual(colorUtils.relativeLuminance(255, 255, 255), 1);
});

test('contrastRatio: 相同颜色为 1', () => {
  const r = colorUtils.contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
  assert.ok(Math.abs(r - 1) < 0.001, `相同颜色比值应为 1，实际 ${r}`);
});

test('contrastRatio: 黑白比值 21', () => {
  const r = colorUtils.contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(r - 21) < 0.01, `黑白比值应为 21，实际 ${r}`);
});

test('contrastRatio: 与参数顺序无关', () => {
  const a = colorUtils.contrastRatio({ r: 0, g: 122, b: 255 }, { r: 255, g: 255, b: 255 });
  const b = colorUtils.contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 122, b: 255 });
  assert.ok(Math.abs(a - b) < 0.0001, `比值应与顺序无关，${a} vs ${b}`);
});

test('wcagGrade: 比值 1 全不通过', () => {
  const g = colorUtils.wcagGrade(1);
  assert.strictEqual(g.aaNormal, false);
  assert.strictEqual(g.aaLarge, false);
  assert.strictEqual(g.aaaNormal, false);
  assert.strictEqual(g.aaaLarge, false);
});

test('wcagGrade: 比值 4.5 通过 AA 普通', () => {
  const g = colorUtils.wcagGrade(4.5);
  assert.strictEqual(g.aaNormal, true);
  assert.strictEqual(g.aaLarge, true);
  assert.strictEqual(g.aaaNormal, false);
  assert.strictEqual(g.aaaLarge, true);
});

test('wcagGrade: 比值 7 通过 AAA 普通', () => {
  const g = colorUtils.wcagGrade(7);
  assert.strictEqual(g.aaaNormal, true);
  assert.strictEqual(g.aaNormal, true);
});

test('wcagGrade: 比值 3 仅通过 AA 大字', () => {
  const g = colorUtils.wcagGrade(3);
  assert.strictEqual(g.aaLarge, true);
  assert.strictEqual(g.aaNormal, false);
});

test('wcagGrade: 非法输入兜底为 0', () => {
  const g = colorUtils.wcagGrade(NaN);
  assert.strictEqual(g.ratio, 0);
  assert.strictEqual(g.aaNormal, false);
});

test('wcagGrade: ratio 四舍五入两位', () => {
  const g = colorUtils.wcagGrade(4.567);
  assert.strictEqual(g.ratio, 4.57);
});

console.log('\n=== 快捷键校验 ===');

test('validateShortcut: 合法快捷键', () => {
  assert.strictEqual(storage.validateShortcut('CommandOrControl+Shift+C'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+Alt+P'), true);
  assert.strictEqual(storage.validateShortcut('Shift+A'), true);
  assert.strictEqual(storage.validateShortcut('Alt+F1'), true);
});

test('validateShortcut: 缺少修饰键', () => {
  assert.strictEqual(storage.validateShortcut('A'), false);
  assert.strictEqual(storage.validateShortcut('C'), false);
});

test('validateShortcut: 非法按键', () => {
  assert.strictEqual(storage.validateShortcut('Ctrl+!'), false);
  assert.strictEqual(storage.validateShortcut('Shift+??'), false);
});

test('validateShortcut: 非法修饰键', () => {
  assert.strictEqual(storage.validateShortcut('Foo+C'), false);
  assert.strictEqual(storage.validateShortcut('Win+C'), false);
});

test('validateShortcut: 非字符串', () => {
  assert.strictEqual(storage.validateShortcut(null), false);
  assert.strictEqual(storage.validateShortcut(123), false);
  assert.strictEqual(storage.validateShortcut(''), false);
});

test('validateShortcut: 多修饰键组合', () => {
  assert.strictEqual(storage.validateShortcut('CommandOrControl+Alt+Shift+P'), true);
});

test('validateShortcut: 功能键 F1-F24', () => {
  assert.strictEqual(storage.validateShortcut('Ctrl+F1'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+F24'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+F25'), false);
});

test('validateShortcut: 特殊按键', () => {
  assert.strictEqual(storage.validateShortcut('Ctrl+Space'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+Enter'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+Tab'), true);
  assert.strictEqual(storage.validateShortcut('Ctrl+ArrowLeft'), true);
});

console.log('\n=== 调色板导出 ===');

const samplePalette = {
  id: 'test',
  name: '测试色板',
  colors: ['#007aff', '#34c759', '#ff3b30'],
  createdAt: Date.now(),
};

test('exportCSS: 生成 :root 变量', () => {
  const css = paletteExport.exportCSS(samplePalette);
  assert.ok(css.includes(':root'));
  assert.ok(css.includes('--color-1-007aff: #007aff;'));
  assert.ok(css.includes('--color-2-34c759: #34c759;'));
  assert.ok(css.includes('}'));
  assert.ok(css.includes('测试色板'));
});

test('exportCSS: 空调色板', () => {
  const css = paletteExport.exportCSS({ name: '空', colors: [] });
  // 空调色板应含 :root { } 但不含任何变量
  assert.ok(css.includes(':root'));
  assert.ok(!css.includes('--color'), '空调色板不应含变量');
});

test('exportSCSS: 生成 $ 变量', () => {
  const scss = paletteExport.exportSCSS(samplePalette);
  assert.ok(scss.includes('$color-1-007aff: #007aff;'));
  assert.ok(scss.includes('// 调色板: 测试色板'));
});

test('exportJSON: 可被 JSON.parse 还原', () => {
  const json = paletteExport.exportJSON(samplePalette);
  const obj = JSON.parse(json);
  assert.strictEqual(obj.name, '测试色板');
  assert.strictEqual(obj.colors.length, 3);
  assert.strictEqual(obj.colors[0].hex, '#007aff');
  assert.strictEqual(obj.colors[0].rgb.r, 0);
  assert.strictEqual(obj.colors[0].rgb.g, 122);
  assert.strictEqual(obj.colors[0].rgb.b, 255);
});

test('exportJSON: 包含 HSL 信息', () => {
  const json = paletteExport.exportJSON(samplePalette);
  const obj = JSON.parse(json);
  assert.strictEqual(obj.colors[0].hsl.h, 211);
});

test('exportGPL: GIMP 头部格式', () => {
  const gpl = paletteExport.exportGPL(samplePalette);
  assert.ok(gpl.startsWith('GIMP Palette'));
  assert.ok(gpl.includes('Name: 测试色板'));
  assert.ok(gpl.includes('Columns: 6'));
});

test('exportGPL: 每行包含 RGB + hex', () => {
  const gpl = paletteExport.exportGPL(samplePalette);
  const lines = gpl.split('\n').filter((l) => /^\s*\d/.test(l));
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].includes('#007AFF'));
  assert.ok(lines[0].includes('0'));
  assert.ok(lines[0].includes('122'));
  assert.ok(lines[0].includes('255'));
});

test('exportGPL: 跳过非法 hex', () => {
  const gpl = paletteExport.exportGPL({ name: 'x', colors: ['#007aff', 'not-a-color', '#fff'] });
  const lines = gpl.split('\n').filter((l) => /^\s*\d/.test(l));
  // #fff 是 3 位会被 hexToRgb 接受，'not-a-color' 被跳过
  assert.strictEqual(lines.length, 2);
});

test('exportASE: 返回 Buffer 且含 ASEF 头', () => {
  const buf = paletteExport.exportASE(samplePalette);
  assert.ok(Buffer.isBuffer(buf));
  assert.strictEqual(buf.slice(0, 4).toString('ascii'), 'ASEF');
});

test('exportASE: 块数与颜色数一致', () => {
  const buf = paletteExport.exportASE(samplePalette);
  const count = buf.readInt32BE(8);
  assert.strictEqual(count, 3);
});

test('exportASE: 版本 1.0', () => {
  const buf = paletteExport.exportASE(samplePalette);
  const major = buf.readUInt16BE(4);
  const minor = buf.readUInt16BE(6);
  assert.strictEqual(major, 1);
  assert.strictEqual(minor, 0);
});

test('exportASE: 第一个块类型为 color (1)', () => {
  const buf = paletteExport.exportASE(samplePalette);
  const blockType = buf.readUInt16BE(12);
  assert.strictEqual(blockType, 1);
});

test('exportASE: 空调色板也能生成头部', () => {
  const buf = paletteExport.exportASE({ name: '空', colors: [] });
  assert.strictEqual(buf.slice(0, 4).toString('ascii'), 'ASEF');
  assert.strictEqual(buf.readInt32BE(8), 0);
  assert.strictEqual(buf.length, 12);
});

test('exportByFormat: 未知格式抛错', () => {
  assert.throws(() => paletteExport.exportByFormat(samplePalette, 'pdf'), /不支持的导出格式/);
});

test('exportByFormat: 各格式返回 content + ext + filters', () => {
  ['css', 'scss', 'json', 'gpl', 'ase'].forEach((fmt) => {
    const r = paletteExport.exportByFormat(samplePalette, fmt);
    assert.ok(r.content !== undefined, `${fmt} 缺少 content`);
    assert.ok(r.ext, `${fmt} 缺少 ext`);
    assert.ok(Array.isArray(r.filters), `${fmt} 缺少 filters`);
  });
});

test('varName: 不带 # 的小写 hex', () => {
  assert.strictEqual(paletteExport.varName('#007AFF', 0), 'color-1-007aff');
  assert.strictEqual(paletteExport.varName('#34C759', 1), 'color-2-34c759');
});

console.log(`\n总计：${passed} 通过 / ${failed} 失败\n`);
process.exit(failed === 0 ? 0 : 1);
