// 计算器管家 · 核心逻辑测试
// 运行：node test/test.js

'use strict';

const path = require('path');
const Module = require('module');

// 直接 require 项目内的 calc-engine
const calc = require('../src/core/calc-engine.js');

let pass = 0;
let fail = 0;
const failures = [];

function assertApprox(actual, expected, eps, msg) {
  eps = eps != null ? eps : 1e-10;
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Math.abs(actual - expected) < eps || (isNaN(actual) && isNaN(expected))) {
      pass++;
      return;
    }
  } else if (actual === expected) {
    pass++;
    return;
  }
  fail++;
  failures.push(`[FAIL] ${msg}\n  期望: ${expected}\n  实际: ${actual}`);
}

function assertThrows(fn, msgFragment, msg) {
  try {
    fn();
    fail++;
    failures.push(`[FAIL] ${msg}\n  期望抛错包含: "${msgFragment}"\n  实际: 未抛错`);
  } catch (err) {
    if (msgFragment && !String(err.message).includes(msgFragment)) {
      fail++;
      failures.push(`[FAIL] ${msg}\n  期望错误信息包含: "${msgFragment}"\n  实际错误: ${err.message}`);
    } else {
      pass++;
    }
  }
}

function eval_(expr, vars) {
  return calc.evaluate(expr, vars || {});
}

// ============ 测试用例 ============

console.log('▶ 基础四则运算');
assertApprox(eval_('2+3'), 5, 1e-10, '2+3=5');
assertApprox(eval_('10-4'), 6, 1e-10, '10-4=6');
assertApprox(eval_('3*4'), 12, 1e-10, '3*4=12');
assertApprox(eval_('15/4'), 3.75, 1e-10, '15/4=3.75');
assertApprox(eval_('2+3*4'), 14, 1e-10, '运算优先级 2+3*4=14');
assertApprox(eval_('(2+3)*4'), 20, 1e-10, '括号 (2+3)*4=20');
assertApprox(eval_('2^3'), 8, 1e-10, '幂 2^3=8');
assertApprox(eval_('2^3^2'), 512, 1e-10, '幂右结合 2^3^2=512');
assertApprox(eval_('10%3'), 1, 1e-10, '取模 10%3=1');
assertApprox(eval_('-5'), -5, 1e-10, '一元负 -5');
assertApprox(eval_('--5'), 5, 1e-10, '双重负 --5=5');
assertApprox(eval_('3 + 4 * 2 / (1 - 5) ^ 2'), 3.5, 1e-10, '复杂表达式 3+4*2/(1-5)^2=3.5');

console.log('▶ 小数与科学计数法');
assertApprox(eval_('1.5+2.5'), 4, 1e-10, '1.5+2.5=4');
assertApprox(eval_('0.1+0.2'), 0.3, 1e-10, '0.1+0.2=0.3');
assertApprox(eval_('1e3'), 1000, 1e-10, '1e3=1000');
assertApprox(eval_('1.5e2'), 150, 1e-10, '1.5e2=150');
assertApprox(eval_('2.5e-2'), 0.025, 1e-10, '2.5e-2=0.025');

console.log('▶ 三角函数');
assertApprox(eval_('sin(0)'), 0, 1e-10, 'sin(0)=0');
assertApprox(eval_('cos(0)'), 1, 1e-10, 'cos(0)=1');
assertApprox(eval_('sin(pi/2)'), 1, 1e-10, 'sin(pi/2)=1');
assertApprox(eval_('sin(pi/4)^2 + cos(pi/4)^2'), 1, 1e-10, '勾股 sin²+cos²=1');
assertApprox(eval_('tan(pi/4)'), 1, 1e-10, 'tan(pi/4)=1');

console.log('▶ 对数与指数');
assertApprox(eval_('log(1000)'), 3, 1e-10, 'log(1000)=3');
assertApprox(eval_('log(100)'), 2, 1e-10, 'log(100)=2');
assertApprox(eval_('ln(e)'), 1, 1e-10, 'ln(e)=1');
assertApprox(eval_('ln(e^2)'), 2, 1e-10, 'ln(e^2)=2');
assertApprox(eval_('exp(0)'), 1, 1e-10, 'exp(0)=1');
assertApprox(eval_('exp(1)'), Math.E, 1e-10, 'exp(1)=e');
assertApprox(eval_('log2(8)'), 3, 1e-10, 'log2(8)=3');

console.log('▶ 根号与绝对值');
assertApprox(eval_('sqrt(16)'), 4, 1e-10, 'sqrt(16)=4');
assertApprox(eval_('sqrt(2)'), Math.SQRT2, 1e-10, 'sqrt(2)=√2');
assertApprox(eval_('cbrt(27)'), 3, 1e-10, 'cbrt(27)=3');
assertApprox(eval_('abs(-5)'), 5, 1e-10, 'abs(-5)=5');
assertApprox(eval_('abs(5)'), 5, 1e-10, 'abs(5)=5');

console.log('▶ 取整与符号');
assertApprox(eval_('floor(3.7)'), 3, 1e-10, 'floor(3.7)=3');
assertApprox(eval_('ceil(3.2)'), 4, 1e-10, 'ceil(3.2)=4');
assertApprox(eval_('round(3.5)'), 4, 1e-10, 'round(3.5)=4');
assertApprox(eval_('round(3.4)'), 3, 1e-10, 'round(3.4)=3');
assertApprox(eval_('sign(-5)'), -1, 1e-10, 'sign(-5)=-1');
assertApprox(eval_('sign(5)'), 1, 1e-10, 'sign(5)=1');

console.log('▶ 阶乘');
assertApprox(eval_('0!'), 1, 1e-10, '0!=1');
assertApprox(eval_('5!'), 120, 1e-10, '5!=120');
assertApprox(eval_('10!'), 3628800, 1e-10, '10!=3628800');
assertApprox(eval_('3.5!'), 11.631728396567448, 1e-6, '3.5! 用 Gamma');

console.log('▶ 多参数函数');
assertApprox(eval_('pow(2,10)'), 1024, 1e-10, 'pow(2,10)=1024');
assertApprox(eval_('max(3,7)'), 7, 1e-10, 'max(3,7)=7');
assertApprox(eval_('min(3,7)'), 3, 1e-10, 'min(3,7)=3');
assertApprox(eval_('gcd(12,18)'), 6, 1e-10, 'gcd(12,18)=6');
assertApprox(eval_('lcm(4,6)'), 12, 1e-10, 'lcm(4,6)=12');
assertApprox(eval_('atan2(1,1)'), Math.PI/4, 1e-10, 'atan2(1,1)=π/4');

console.log('▶ 常量');
assertApprox(eval_('pi'), Math.PI, 1e-10, 'pi');
assertApprox(eval_('e'), Math.E, 1e-10, 'e');
assertApprox(eval_('tau'), Math.PI*2, 1e-10, 'tau=2π');
assertApprox(eval_('phi'), (1+Math.sqrt(5))/2, 1e-10, 'phi=黄金比例');

console.log('▶ 变量');
assertApprox(eval_('x+5', {x: 10}), 15, 1e-10, '变量 x+5, x=10');
assertApprox(eval_('x*y', {x: 3, y: 4}), 12, 1e-10, '变量 x*y, x=3 y=4');
assertApprox(eval_('x^2 + 2*x + 1', {x: 5}), 36, 1e-10, '多项式 x²+2x+1, x=5');

console.log('▶ 赋值表达式');
{
  const r = calc.tryParseAssignment('x = 5', {});
  if (r && r.name === 'x' && r.value === 5) pass++;
  else { fail++; failures.push(`[FAIL] x=5 赋值失败: ${JSON.stringify(r)}`); }
}
{
  const r = calc.tryParseAssignment('y = 2+3*4', {});
  if (r && r.name === 'y' && r.value === 14) pass++;
  else { fail++; failures.push(`[FAIL] y=2+3*4 赋值失败: ${JSON.stringify(r)}`); }
}
{
  // 变量引用既有变量
  const r = calc.tryParseAssignment('z = x + 1', {x: 10});
  if (r && r.name === 'z' && r.value === 11) pass++;
  else { fail++; failures.push(`[FAIL] z=x+1 赋值失败: ${JSON.stringify(r)}`); }
}
{
  // 不是赋值
  const r = calc.tryParseAssignment('2+3', {});
  if (r === null) pass++;
  else { fail++; failures.push(`[FAIL] 2+3 不应被识别为赋值`); }
}
assertThrows(() => calc.tryParseAssignment('pi = 5', {}), '常量', '不能给常量赋值');
assertThrows(() => calc.tryParseAssignment('sin = 5', {}), '函数', '不能给函数赋值');

console.log('▶ 错误处理');
assertThrows(() => eval_(''), '为空', '空表达式');
assertThrows(() => eval_('  '), '为空', '纯空白');
assertThrows(() => eval_('2+'), '不完整', '不完整表达式');
assertThrows(() => eval_('(2+3'), '括号不匹配', '括号不匹配');
assertThrows(() => eval_('2+3)'), '括号', '多余右括号');
assertThrows(() => eval_('1/0'), '除零', '除零错误');
assertThrows(() => eval_('5%0'), '模零', '模零错误');
assertThrows(() => eval_('foo'), '未知标识符', '未知标识符');
assertThrows(() => eval_('sin()'), '参数不足', '函数参数不足');
assertThrows(() => eval_('2**3'), '不完整', '不合法表达式 2**3');
assertThrows(() => eval_('2 3'), '不完整', '两个数字相连');

console.log('▶ 进制前缀');
assertApprox(eval_('0xFF'), 255, 1e-10, '0xFF=255');
assertApprox(eval_('0x10'), 16, 1e-10, '0x10=16');
assertApprox(eval_('0b1010'), 10, 1e-10, '0b1010=10');
assertApprox(eval_('0o17'), 15, 1e-10, '0o17=15');
assertApprox(eval_('0xFF + 0x01'), 256, 1e-10, '0xFF+0x01=256');

console.log('▶ 程序员模式 · 位运算');
assertApprox(eval_('5 and 3'), 1, 1e-10, '5 and 3 = 1');
assertApprox(eval_('5 or 2'), 7, 1e-10, '5 or 2 = 7');
assertApprox(eval_('5 xor 3'), 6, 1e-10, '5 xor 3 = 6');
assertApprox(eval_('not 0'), -1, 1e-10, 'not 0 = -1');
assertApprox(eval_('1 shl 4'), 16, 1e-10, '1 shl 4 = 16');
assertApprox(eval_('256 shr 4'), 16, 1e-10, '256 shr 4 = 16');
assertApprox(eval_('0xFF and 0x0F'), 15, 1e-10, '0xFF and 0x0F = 15');
assertApprox(eval_('0xF0 or 0x0F'), 255, 1e-10, '0xF0 or 0x0F = 255');
assertApprox(eval_('not 0xFF'), -256, 1e-10, 'not 0xFF = -256');

console.log('▶ 进制转换 API');
{
  const r = calc.toBase(255, 16);
  if (r === 'FF') pass++;
  else { fail++; failures.push(`[FAIL] toBase(255, 16) 期望 FF 实际 ${r}`); }
}
{
  const r = calc.toBase(10, 2);
  if (r === '1010') pass++;
  else { fail++; failures.push(`[FAIL] toBase(10, 2) 期望 1010 实际 ${r}`); }
}
{
  const r = calc.toBase(15, 8);
  if (r === '17') pass++;
  else { fail++; failures.push(`[FAIL] toBase(15, 8) 期望 17 实际 ${r}`); }
}
{
  const r = calc.toBase(123456, 10);
  if (r === '123456') pass++;
  else { fail++; failures.push(`[FAIL] toBase(123456, 10) 期望 123456 实际 ${r}`); }
}

console.log('▶ 格式化');
{
  const r = calc.formatResult(3.14);
  if (r === '3.14') pass++;
  else { fail++; failures.push(`[FAIL] formatResult(3.14) 期望 3.14 实际 ${r}`); }
}
{
  const r = calc.formatResult(1000000);
  if (r === '1,000,000') pass++;
  else { fail++; failures.push(`[FAIL] formatResult(1000000) 期望 1,000,000 实际 ${r}`); }
}
{
  const r = calc.formatResult(1/3);
  if (r === '0.333333333333') pass++;
  else { fail++; failures.push(`[FAIL] formatResult(1/3) 期望 0.333333333333 实际 ${r}`); }
}
{
  const r = calc.formatResult(NaN);
  if (r === 'NaN') pass++;
  else { fail++; failures.push(`[FAIL] formatResult(NaN) 期望 NaN 实际 ${r}`); }
}
{
  const r = calc.formatResult(Infinity);
  if (r === '∞') pass++;
  else { fail++; failures.push(`[FAIL] formatResult(Infinity) 期望 ∞ 实际 ${r}`); }
}

console.log('▶ 边界情况');
assertApprox(eval_('2^10'), 1024, 1e-10, '2^10=1024');
assertApprox(eval_('2^0.5'), Math.SQRT2, 1e-10, '2^0.5=√2');
assertApprox(eval_('-(2+3)'), -5, 1e-10, '-(2+3)=-5');
assertApprox(eval_('-2^2'), -4, 1e-10, '-2^2=-4 (一元负优先级低于^)');
assertApprox(eval_('(-2)^2'), 4, 1e-10, '(-2)^2=4');
assertApprox(eval_('3! / 2'), 3, 1e-10, '3!/2=3');
assertApprox(eval_('2 * 3!'), 12, 1e-10, '2*3!=12');
assertApprox(eval_('sqrt(-1)'), NaN, 1e-10, 'sqrt(-1)=NaN');

// ============ 结果汇总 ============

console.log('\n────────────────────────');
console.log(`✓ 通过: ${pass}`);
console.log(`✗ 失败: ${fail}`);
console.log('────────────────────────');

if (fail > 0) {
  console.log('\n失败详情:');
  failures.forEach(f => console.log('\n' + f));
  process.exit(1);
} else {
  console.log('\n🎉 全部测试通过');
  process.exit(0);
}
