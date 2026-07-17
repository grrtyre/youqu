// 模糊搜索算法单元测试
const { fuzzySearch, matchScore } = require('../src/lib/fuzzySearch');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { console.log('  ✓ ' + msg); passed++; }
  else { console.error('  ✗ ' + msg); failed++; }
}

console.log('\n=== matchScore 基础测试 ===');
assert(matchScore('chrome', 'chrome').score === 1000, '完全匹配得分=1000');
assert(matchScore('chrome', 'chr').score >= 500, '开头匹配得分≥500');
assert(matchScore('google chrome', 'chrome').score >= 200, '包含匹配得分≥200');
assert(matchScore('notepad', 'xyz').score === -1, '完全不匹配返回-1');

console.log('\n=== 子序列匹配测试 ===');
const sub = matchScore('calculator', 'clc');
assert(sub.score > 0, '子序列 c-l-c 在 calculator 中匹配成功');
assert(sub.positions.length === 3, '子序列匹配返回3个位置');
assert(matchScore('abc', 'abcd').score === -1, '查询比文本长返回-1');

console.log('\n=== 模糊搜索排序测试 ===');
const items = [
  { name: 'Google Chrome' },
  { name: 'Chromium' },
  { name: 'Visual Studio Code' },
  { name: 'Code Blocks' },
  { name: 'Notepad++' },
  { name: 'Chrome Remote Desktop' },
];

const results = fuzzySearch(items, 'chrome', { key: 'name', limit: 3 });
assert(results.length === 2, '返回结果数=2（Chromium 无 e 不匹配）');
assert(results[0].item.name === 'Google Chrome', 'Chrome 搜索第一项=Google Chrome（短者优先）');

const results2 = fuzzySearch(items, 'code', { key: 'name', limit: 3 });
assert(results2[0].item.name === 'Code Blocks' || results2[0].item.name === 'Visual Studio Code',
  'code 搜索首项含 Code');

console.log('\n=== 首字母/边界加分测试 ===');
const m1 = matchScore('calc', 'c');
const m2 = matchScore('abc', 'c');
assert(m1.score > m2.score, '首字母匹配(c in calc) 优于中间匹配(c in abc)');
const m3 = matchScore('visual-studio', 's');
assert(m3.score > 50, '连字符后字符匹配得分较高');

console.log('\n=== 空查询测试 ===');
const empty = fuzzySearch(items, '', { key: 'name', limit: 2 });
assert(empty.length === 2, '空查询返回前2项');

console.log('\n=== limit 测试 ===');
const limited = fuzzySearch(items, 'e', { key: 'name', limit: 2 });
assert(limited.length <= 2, '结果数不超过limit');

console.log('\n=========================');
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('=========================\n');
process.exit(failed > 0 ? 1 : 0);
