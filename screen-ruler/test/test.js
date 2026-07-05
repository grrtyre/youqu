// test/test.js — 核心几何逻辑测试 + HiDPI / 多屏匹配 / UMD 加载
const assert = require('assert');
const {
  distance, rectSize, angle, rgbToHex, rgbToHsl, pixelAt, formatMeasure,
  physicalPixels, matchDisplaySource
} = require('../src/core/ruler-core');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}

console.log('屏幕尺管家 - 核心逻辑测试\n');

console.log('距离计算');
t('水平距离', () => assert.strictEqual(distance({x:0,y:0}, {x:3,y:0}), 3));
t('垂直距离', () => assert.strictEqual(distance({x:0,y:0}, {x:0,y:4}), 4));
t('3-4-5 斜边', () => assert.strictEqual(distance({x:0,y:0}, {x:3,y:4}), 5));
t('同点距离为 0', () => assert.strictEqual(distance({x:5,y:5}, {x:5,y:5}), 0));

console.log('矩形尺寸');
t('正向矩形', () => {
  const r = rectSize({x:0,y:0}, {x:100,y:50});
  assert.strictEqual(r.width, 100);
  assert.strictEqual(r.height, 50);
});
t('反向矩形（负方向）', () => {
  const r = rectSize({x:100,y:50}, {x:0,y:0});
  assert.strictEqual(r.width, 100);
  assert.strictEqual(r.height, 50);
});

console.log('角度计算');
t('正东为 0°', () => assert.strictEqual(angle({x:0,y:0}, {x:10,y:0}), 0));
t('正南为 90°', () => assert.strictEqual(angle({x:0,y:0}, {x:0,y:10}), 90));
t('正西为 180°', () => assert.strictEqual(angle({x:0,y:0}, {x:-10,y:0}), 180));
t('正北为 270°', () => assert.strictEqual(angle({x:0,y:0}, {x:0,y:-10}), 270));
t('45° 方向', () => {
  const a = angle({x:0,y:0}, {x:1,y:1});
  assert.ok(Math.abs(a - 45) < 0.001, `期望 45, 实得 ${a}`);
});

console.log('颜色转换');
t('RGB → HEX 黑', () => assert.strictEqual(rgbToHex(0,0,0), '#000000'));
t('RGB → HEX 白', () => assert.strictEqual(rgbToHex(255,255,255), '#FFFFFF'));
t('RGB → HEX 红', () => assert.strictEqual(rgbToHex(255,0,0), '#FF0000'));
t('RGB → HEX 蓝', () => assert.strictEqual(rgbToHex(0,0,255), '#0000FF'));
t('RGB → HEX 蓝(007aff)', () => assert.strictEqual(rgbToHex(0,122,255), '#007AFF'));

console.log('HSL');
t('纯灰 HSL', () => {
  const h = rgbToHsl(128, 128, 128);
  assert.strictEqual(h.s, 0);
  assert.ok(Math.abs(h.l - 50) <= 1);
});
t('纯红 H=0', () => {
  const h = rgbToHsl(255, 0, 0);
  assert.strictEqual(h.h, 0);
  assert.strictEqual(h.s, 100);
  assert.strictEqual(h.l, 50);
});

console.log('像素采样');
t('ImageData 像素读取', () => {
  const fake = { width: 2, height: 1, data: [10, 20, 30, 255, 40, 50, 60, 255] };
  const p0 = pixelAt(fake, 0, 0);
  const p1 = pixelAt(fake, 1, 0);
  assert.deepStrictEqual(p0, { r:10, g:20, b:30, a:255 });
  assert.deepStrictEqual(p1, { r:40, g:50, b:60, a:255 });
});
t('越界返回边界像素', () => {
  const fake = { width: 1, height: 1, data: [9, 8, 7, 255] };
  const p = pixelAt(fake, 99, 99);
  assert.deepStrictEqual(p, { r:9, g:8, b:7, a:255 });
});

console.log('测量结果格式化');
t('矩形测量 label/detail', () => {
  const m = formatMeasure('rect', {x:0,y:0}, {x:100,y:50});
  assert.strictEqual(m.label, '100 × 50 px');
  assert.ok(m.detail.includes('宽 100') && m.detail.includes('高 50') && m.detail.includes('面积 5000'));
  assert.strictEqual(m.area, 5000);
});
t('直线测量 label/detail', () => {
  const m = formatMeasure('line', {x:0,y:0}, {x:3,y:4});
  assert.strictEqual(m.label, '5 px');
  assert.ok(m.detail.includes('距离 5') && m.detail.includes('角度'));
});
t('未知 mode 返回 null', () => {
  assert.strictEqual(formatMeasure('unknown', {x:0,y:0}, {x:1,y:1}), null);
});

// ============ 新增：HiDPI 物理像素换算 ============
console.log('HiDPI 物理像素换算');
t('scaleFactor=1 时等于逻辑像素', () => {
  const p = physicalPixels(1920, 1080, 1);
  assert.deepStrictEqual(p, { width: 1920, height: 1080 });
});
t('scaleFactor=1.5 时正确放大', () => {
  const p = physicalPixels(1920, 1080, 1.5);
  assert.deepStrictEqual(p, { width: 2880, height: 1620 });
});
t('scaleFactor=2 时正确放大（200% 缩放屏）', () => {
  const p = physicalPixels(1920, 1080, 2);
  assert.deepStrictEqual(p, { width: 3840, height: 2160 });
});
t('scaleFactor 缺省按 1 处理', () => {
  const p = physicalPixels(1920, 1080);
  assert.deepStrictEqual(p, { width: 1920, height: 1080 });
});
t('scaleFactor=0 按 1 处理（防御非法值）', () => {
  const p = physicalPixels(1920, 1080, 0);
  assert.deepStrictEqual(p, { width: 1920, height: 1080 });
});
t('逻辑像素为 0 时返回 1（避免 0×sf=0 导致截图失败）', () => {
  const p = physicalPixels(0, 0, 2);
  assert.deepStrictEqual(p, { width: 1, height: 1 });
});

// ============ 新增：多屏源匹配 ============
console.log('多屏源匹配');
t('按 display_id 字符串严格匹配', () => {
  const sources = [
    { display_id: '123', name: '屏A' },
    { display_id: '456', name: '屏B' }
  ];
  const m = matchDisplaySource(sources, 456);
  assert.ok(m);
  assert.strictEqual(m.name, '屏B');
});
t('数字 id 自动转字符串匹配', () => {
  const sources = [{ display_id: '789', name: '屏C' }];
  const m = matchDisplaySource(sources, 789);
  assert.ok(m);
  assert.strictEqual(m.name, '屏C');
});
t('找不到时返回 null（不再兜底取 sources[0]）', () => {
  const sources = [{ display_id: '123', name: '屏A' }];
  const m = matchDisplaySource(sources, 999);
  assert.strictEqual(m, null);
});
t('空数组返回 null', () => {
  assert.strictEqual(matchDisplaySource([], 123), null);
});
t('非数组入参返回 null', () => {
  assert.strictEqual(matchDisplaySource(null, 123), null);
  assert.strictEqual(matchDisplaySource(undefined, 123), null);
});
t('源对象 display_id 为 undefined 不会误匹配', () => {
  const sources = [{ name: '没id的源' }, { display_id: '456', name: '有id的源' }];
  const m = matchDisplaySource(sources, 456);
  assert.ok(m);
  assert.strictEqual(m.name, '有id的源');
});

// ============ 新增：UMD 加载验证（浏览器侧 <script> 引入能否挂到全局） ============
console.log('UMD 加载（浏览器侧兼容性）');
t('在浏览器环境应挂到 self.RulerCore', () => {
  // 模拟浏览器环境：self 存在，module 不存在
  const sandbox = { self: {} };
  const vm = require('vm');
  const fs = require('fs');
  const code = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'core', 'ruler-core.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.ok(sandbox.self.RulerCore, 'self.RulerCore 应被挂载');
  assert.strictEqual(typeof sandbox.self.RulerCore.distance, 'function');
  assert.strictEqual(typeof sandbox.self.RulerCore.physicalPixels, 'function');
  assert.strictEqual(typeof sandbox.self.RulerCore.matchDisplaySource, 'function');
});
t('UMD 全局下的函数与 require 版本行为一致', () => {
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const sandbox = { self: {} };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'ruler-core.js'), 'utf8');
  vm.runInContext(code, sandbox);
  const R = sandbox.self.RulerCore;
  assert.strictEqual(R.rgbToHex(0, 122, 255), '#007AFF');
  assert.strictEqual(R.distance({x:0,y:0},{x:3,y:4}), 5);
  // VM 沙箱对象原型链与主上下文不同，用属性级断言而非 deepStrictEqual
  const p = R.physicalPixels(100, 50, 2);
  assert.strictEqual(p.width, 200);
  assert.strictEqual(p.height, 100);
});

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
