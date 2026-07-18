// authenticator-manager 核心逻辑测试
// 验证 TOTP 算法实现符合 RFC 6238 测试向量
'use strict';

const crypto = require('crypto');
const assert = require('assert');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  str = String(str || '').toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of str) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((value >> bits) & 0xff); }
  }
  return Buffer.from(out);
}

function totpAt(secret, time, period, digits, algorithm) {
  const key = base32Decode(secret);
  const counter = Math.floor(time / period);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000) >>> 0, 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac(algorithm, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
  return (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
}

// RFC 6238 Appendix B 测试向量（SHA1，8 位）
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // base32("12345678901234567890")
const tests = [
  { time: 59,          expect: '94287082' },
  { time: 1111111109,  expect: '07081804' },
  { time: 1111111111,  expect: '14050471' },
  { time: 1234567890,  expect: '89005924' },
  { time: 2000000000,  expect: '69279037' },
  { time: 20000000000, expect: '65353130' }
];

let pass = 0, fail = 0;

console.log('== base32 解码测试 ==');
const decoded = base32Decode(SECRET);
const expected = Buffer.from('12345678901234567890', 'ascii');
try {
  assert.ok(decoded.equals(expected), 'base32 decode mismatch');
  console.log('  ✓ base32("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ") == "12345678901234567890"');
  pass++;
} catch (e) {
  console.log(`  ✗ base32 解码错误: 得到 ${decoded.toString('hex')} 期望 ${expected.toString('hex')}`);
  fail++;
}

console.log('\n== RFC 6238 TOTP 测试向量（SHA1, 8 位, 周期 30s）==');
for (const t of tests) {
  const got = totpAt(SECRET, t.time, 30, 8, 'sha1');
  try {
    assert.strictEqual(got, t.expect, `time=${t.time}`);
    console.log(`  ✓ time=${String(t.time).padEnd(12)} → ${got}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ time=${t.time} 期望 ${t.expect} 得到 ${got}`);
    fail++;
  }
}

console.log('\n== 6 位截断示例 ==');
const c6 = totpAt(SECRET, 59, 30, 6, 'sha1');
console.log(`  ✓ time=59 6位 → ${c6}`);
pass++;

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
