// 测量核心逻辑单元测试
'use strict';

const M = require('../src/core/measure.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function approx(a, b, eps = 0.001) { return Math.abs(a - b) < eps; }

console.log('\n[1] distance');
assert(approx(M.distance({x:0,y:0}, {x:3,y:4}), 5), '3-4-5 直角三角形斜边=5');
assert(approx(M.distance({x:1,y:1}, {x:1,y:1}), 0), '同点距离=0');
assert(approx(M.distance({x:0,y:0}, {x:-3,y:-4}), 5), '负方向距离=5');

console.log('\n[2] angleOfLine');
assert(approx(M.angleOfLine({x:0,y:0}, {x:10,y:0}), 0), '水平向右=0°');
assert(approx(M.angleOfLine({x:0,y:0}, {x:0,y:-10}), 90), '屏幕向上=90°');
// 水平向左：atan2(-0, -10) 在 JS 中返回 -π（-0 怪异行为），-180 与 180 等价
assert(approx(M.angleOfLine({x:0,y:0}, {x:-10,y:0}), 180) || approx(M.angleOfLine({x:0,y:0}, {x:-10,y:0}), -180), '水平向左=±180°');
assert(approx(M.angleOfLine({x:0,y:0}, {x:0,y:10}), -90), '屏幕向下=-90°');

console.log('\n[3] angleBetween');
// 顶点在原点，两条边分别向右和向上（屏幕向上=正Y反转后），夹角应为 90°
assert(approx(M.angleBetween({x:0,y:0}, {x:10,y:0}, {x:0,y:-10}), 90), '直角=90°');
// 平角
assert(approx(M.angleBetween({x:0,y:0}, {x:10,y:0}, {x:-10,y:0}), 180), '平角=180°');
// 0°（同向）
assert(approx(M.angleBetween({x:0,y:0}, {x:10,y:0}, {x:20,y:0}), 0), '同向=0°');
// 45°
assert(approx(M.angleBetween({x:0,y:0}, {x:10,y:0}, {x:10,y:-10}), 45), '45°');

console.log('\n[4] rulerTicks');
const ticks = M.rulerTicks(150, 50);
assert(ticks.length === 16, '0~150 每10一格=16个刻度');
assert(ticks[0].pos === 0 && ticks[0].major, '起点=0且主刻度');
assert(ticks[5].pos === 50 && ticks[5].major, '50处为主刻度');
assert(ticks[1].major === false, '10处为次刻度');
assert(ticks[0].label === '0' && ticks[5].label === '50', '主刻度有标签');

console.log('\n[5] pxToPhysical');
const p = M.pxToPhysical(96, 96);
assert(approx(p.mm, 25.4, 0.01), '96px@96DPI=25.4mm');
assert(approx(p.cm, 2.54, 0.01), '96px=2.54cm');
assert(approx(p.in, 1, 0.01), '96px=1in');
const p2 = M.pxToPhysical(192, 96);
assert(approx(p2.mm, 50.8, 0.01), '192px=50.8mm');

console.log('\n[6] normalizeRect');
const r1 = M.normalizeRect({x:100,y:200}, {x:50,y:80});
assert(r1.x === 50 && r1.y === 80, '左上角取最小值');
assert(r1.w === 50 && r1.h === 120, '宽高为正');
const r2 = M.normalizeRect({x:10,y:10}, {x:110,y:60});
assert(r2.w === 100 && r2.h === 50, '正向拖拽宽高正确');

console.log('\n[7] pointInRect');
assert(M.pointInRect({x:55,y:85}, r1) === true, '点在矩形内');
assert(M.pointInRect({x:49,y:85}, r1) === false, '点在矩形左外');
assert(M.pointInRect({x:55,y:250}, r1) === false, '点在矩形下外');

console.log('\n[8] formatMeasure');
assert(M.formatMeasure('rect', {w:100,h:50}) === '100 × 50 px', 'rect 格式化');
assert(M.formatMeasure('line', {len:123.4, angle:45.6}).includes('123 px'), 'line 格式化包含长度');
assert(M.formatMeasure('angle', {deg:90.5}) === '90.5°', 'angle 格式化');

console.log('\n========================');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
console.log('========================\n');
process.exit(fail === 0 ? 0 : 1);
