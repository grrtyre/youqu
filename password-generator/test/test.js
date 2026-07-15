// test/test.js - 核心密码逻辑单元测试
const assert = require('assert');
const crypto = require('crypto');

function secureRandomInt(max) {
  const range = 256 - (256 % max);
  const buf = crypto.randomBytes(1);
  let val = buf[0];
  while (val >= range) val = crypto.randomBytes(1)[0];
  return val % max;
}

function secureShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
  ambiguous: 'il1Lo0O'
};

function generatePassword(opts) {
  const { length = 16, lower = true, upper = true, digits = true, symbols = true, excludeAmbiguous = false } = opts;
  let pool = '';
  const required = [];
  if (lower) {
    let s = CHARSETS.lower;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (upper) {
    let s = CHARSETS.upper;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (digits) {
    let s = CHARSETS.digits;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (symbols) {
    const s = CHARSETS.symbols;
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (!pool) return '';
  const chars = [];
  for (const r of required) chars.push(r);
  for (let i = chars.length; i < length; i++) chars.push(pool[secureRandomInt(pool.length)]);
  return secureShuffle(chars).slice(0, length).join('');
}

function evaluateStrength(password) {
  if (!password) return { score: 0, label: '无', entropy: 0, suggestions: [] };
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 26;
  const entropy = password.length * Math.log2(poolSize || 1);
  const suggestions = [];
  if (password.length < 8) suggestions.push('建议至少 8 位长度');
  if (password.length < 12) suggestions.push('建议增加到 12 位以上');
  if (!/[A-Z]/.test(password)) suggestions.push('加入大写字母');
  if (!/[0-9]/.test(password)) suggestions.push('加入数字');
  if (!/[^a-zA-Z0-9]/.test(password)) suggestions.push('加入特殊符号');
  if (/^(123|abc|password|qwerty|admin|letmein)/i.test(password)) suggestions.push('避免使用常见弱密码开头');
  if (/(.)\1{2,}/.test(password)) suggestions.push('避免重复字符');
  let score;
  if (entropy < 28) score = 1;
  else if (entropy < 36) score = 2;
  else if (entropy < 60) score = 3;
  else if (entropy < 80) score = 4;
  else if (entropy < 120) score = 5;
  else score = 6;
  const labels = ['无', '极弱', '弱', '一般', '强', '很强', '极强'];
  return { score, label: labels[score], entropy: Math.round(entropy * 10) / 10, suggestions };
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  + ${name}`); passed++; }
  catch (e) { console.error(`  X ${name}: ${e.message}`); failed++; }
}

console.log('\n=== 密码生成器核心逻辑测试 ===\n');

test('生成密码长度正确', () => {
  assert.strictEqual(generatePassword({ length: 20 }).length, 20);
});
test('默认参数生成 16 位', () => {
  assert.strictEqual(generatePassword({}).length, 16);
});
test('包含所有字符类型', () => {
  const pwd = generatePassword({ length: 32, lower: true, upper: true, digits: true, symbols: true });
  assert.ok(/[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd));
});
test('仅小写字母', () => {
  assert.ok(/^[a-z]+$/.test(generatePassword({ length: 20, lower: true, upper: false, digits: false, symbols: false })));
});
test('排除易混字符', () => {
  for (let i = 0; i < 50; i++) {
    const pwd = generatePassword({ length: 20, excludeAmbiguous: true });
    assert.ok(!/[il1Lo0O]/.test(pwd), `不应包含易混字符: ${pwd}`);
  }
});
test('两次生成不同密码', () => {
  assert.notStrictEqual(generatePassword({ length: 32 }), generatePassword({ length: 32 }));
});
test('空字符集返回空字符串', () => {
  assert.strictEqual(generatePassword({ length: 10, lower: false, upper: false, digits: false, symbols: false }), '');
});
test('短长度仍包含必选字符', () => {
  for (let i = 0; i < 20; i++) {
    const pwd = generatePassword({ length: 4, lower: true, upper: true, digits: true, symbols: true });
    assert.ok(/[a-z]/.test(pwd) && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd));
  }
});
test('强度评估: 空密码', () => assert.strictEqual(evaluateStrength('').score, 0));
test('强度评估: 极弱密码', () => assert.ok(evaluateStrength('abc').score <= 2));
test('强度评估: 强密码', () => assert.ok(evaluateStrength('Xk9#mP2$vL7!nQ4^').score >= 4));
test('强度评估: 极强密码', () => assert.strictEqual(evaluateStrength('aB3$xFp7@kLm9#Qv2^Yz1!wR5&tU8*Nc4').score, 6));
test('强度评估给出建议', () => assert.ok(evaluateStrength('abc').suggestions.length > 0));
test('熵值计算合理', () => {
  assert.ok(evaluateStrength('Abcdefg1').entropy > evaluateStrength('abcdefgh').entropy);
});
test('secureRandomInt 范围正确', () => {
  for (let i = 0; i < 1000; i++) {
    const n = secureRandomInt(10);
    assert.ok(n >= 0 && n < 10);
  }
});
test('批量生成数量正确', () => {
  const results = [];
  for (let i = 0; i < 25; i++) results.push(generatePassword({ length: 16 }));
  assert.strictEqual(results.length, 25);
  assert.strictEqual(new Set(results).size, 25);
});

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败 ===\n`);
process.exit(failed > 0 ? 1 : 0);
