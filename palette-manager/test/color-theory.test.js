// color-theory.test.js
// 调色板核心逻辑单元测试，纯 Node 运行，无需依赖

const CT = require('../src/renderer/color-theory');

let passed = 0;
let failed = 0;

function assert(name, cond) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    console.error('  ✗ ' + name);
  }
}

function approx(a, b, eps) {
  eps = eps || 1;
  return Math.abs(a - b) <= eps;
}

console.log('--- 颜色空间转换 ---');
assert('hexToRgb 解析 6 位', CT.hexToRgb('#ff8800').g === 136);
assert('hexToRgb 解析 3 位', CT.hexToRgb('#f80').r === 255);
assert('hexToRgb 非法输入返回 null', CT.hexToRgb('xyz') === null);
assert('rgbToHex 标准输出', CT.rgbToHex(255, 136, 0) === '#ff8800');
assert('rgbToHex 越界自动夹取', CT.rgbToHex(300, -10, 0) === '#ff0000');

const hslRed = CT.rgbToHsl(255, 0, 0);
assert('rgbToHsl 红色色相为 0', approx(hslRed.h, 0));
assert('rgbToHsl 红色饱和度 100', approx(hslRed.s, 100));

const hslGreen = CT.rgbToHsl(0, 255, 0);
assert('rgbToHsl 绿色色相 120', approx(hslGreen.h, 120));

const backToRgb = CT.hslToRgb(0, 100, 50);
assert('hslToRgb 还原红色', backToRgb.r === 255 && backToRgb.g === 0);

assert('hexToHsl 与 rgbToHsl 一致', approx(CT.hexToHsl('#ff0000').h, 0));
assert('hslToHex 往返一致', CT.hslToHex(0, 100, 50) === '#ff0000');

console.log('\n--- 对比度计算 (WCAG) ---');
const cr = CT.contrastRatio('#ffffff', '#000000');
assert('黑白对比度为 21', approx(cr, 21, 0.5));
assert('相同颜色对比度为 1', approx(CT.contrastRatio('#123456', '#123456'), 1));
assert('白底文字深色更易读', CT.readableTextColor('#ffffff') === '#1d1d1f');
assert('黑底文字浅色更易读', CT.readableTextColor('#000000') === '#ffffff');

console.log('\n--- 色彩理论生成 ---');
const palTri = CT.generatePalette('#3498db', 'triadic');
assert('三元色生成 3 个颜色', palTri.length === 3);
assert('三元色首项为基础色相', approx(palTri[0].h, CT.hexToHsl('#3498db').h, 0.1));

const palComp = CT.generatePalette('#e74c3c', 'complementary');
assert('互补色生成 2 个颜色', palComp.length === 2);
assert('互补色第二项色相差 180', approx(palComp[1].h - palComp[0].h, 180) || approx(palComp[1].h - palComp[0].h + 360, 180) || approx(palComp[1].h - palComp[0].h - 360, 180));

const palAna = CT.generatePalette('#9b59b6', 'analogous');
assert('类比色生成 5 个颜色', palAna.length === 5);

const palMono = CT.generatePalette('#1abc9c', 'monochromatic');
assert('同色系生成 5 个颜色', palMono.length === 5);
assert('同色系色相不变', palMono.every((c) => approx(c.h, palMono[0].h)));

const palTetra = CT.generatePalette('#f39c12', 'tetradic');
assert('四元色生成 4 个颜色', palTetra.length === 4);

console.log('\n--- 锁定与重新生成 ---');
const base = ['#3498db', '#1abc9c', '#e74c3c', '#f1c40f', '#9b59b6'];
const locks = [true, false, false, false, false];
const regen = CT.regenerateWithLocks(base, locks, 'analogous');
assert('锁定项保持不变', regen[0] === base[0]);
assert('非锁定项被重新生成', regen[1] !== base[1] || regen[2] !== base[2]);
assert('返回数量与输入一致', regen.length === base.length);

const allLocked = CT.regenerateWithLocks(base, [true, true, true, true, true], 'analogous');
assert('全锁定时全部保持', allLocked.every((c, i) => c === base[i]));

console.log('\n--- 随机基础色 ---');
const rand1 = CT.randomBaseHex();
const rand2 = CT.randomBaseHex();
assert('随机色为合法 HEX', /^#[0-9a-f]{6}$/.test(rand1));
assert('两次随机大概率不同', rand1 !== rand2);

console.log('\n--- 图片取色 (K-means) ---');
// 构造一张 4x2 像素的合成图像数据
const imageData = {
  data: new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
  ]),
  width: 4,
  height: 2,
};
const extracted = CT.extractPaletteFromImageData(imageData, 3);
assert('取色返回非空数组', extracted.length > 0);
assert('取色结果为合法 HEX', extracted.every((c) => /^#[0-9a-f]{6}$/.test(c)));

console.log('\n--- 亮度排序 ---');
const sorted = CT.sortByLightness(['#000000', '#ffffff', '#888888']);
assert('亮度排序降序', sorted[0] === '#ffffff' && sorted[2] === '#000000');

console.log('\n=========================');
console.log('通过: ' + passed + '  失败: ' + failed);
console.log('=========================');
if (failed > 0) {
  process.exit(1);
} else {
  console.log('全部测试通过 ✓');
}
