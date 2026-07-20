// 许可证管理器 - 核心逻辑测试（不依赖 Electron）
// 运行：node test/test.js
const crypto = require('crypto');
const assert = require('assert');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.error('  FAIL  ' + name + '\n        ' + e.message); }
}

// ============ 复刻 main.js 的加密逻辑 ============
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}
function encryptData(plainObj, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}
function decryptData(buf, key) {
  if (buf.length < 28) throw new Error('数据格式错误');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}
function makeVerifyTagSecure(key) {
  return crypto.createHmac('sha256', key).update('LICENSE_MANAGER_VERIFY').digest();
}
function verifyKey(key, verifyTag) {
  const hmac = crypto.createHmac('sha256', key).update('LICENSE_MANAGER_VERIFY').digest();
  return crypto.timingSafeEqual(hmac.subarray(0, 16), verifyTag.subarray(0, 16));
}

// ============ 复刻 renderer.js 的状态判断逻辑 ============
function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}
function getStatus(license) {
  if (license.perpetual) return 'perpetual';
  if (!license.expiryDate) return 'active';
  const exp = new Date(license.expiryDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = daysBetween(now, exp);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'active';
}

// ============ 测试用例 ============

console.log('\n[加密/解密]');

test('AES-256-GCM 加密-解密往返一致', () => {
  const salt = crypto.randomBytes(16);
  const key = deriveKey('myPassword123', salt);
  const data = [{ id: 'L1', name: '测试', licenseKey: 'ABCD-1234-EFGH-5678' }];
  const enc = encryptData(data, key);
  const dec = decryptData(enc, key);
  assert.deepStrictEqual(dec, data);
});

test('错误密码无法解密（验证 tag 不匹配）', () => {
  const salt = crypto.randomBytes(16);
  const key1 = deriveKey('correctPassword', salt);
  const key2 = deriveKey('wrongPassword', salt);
  const enc = encryptData([{ a: 1 }], key1);
  assert.throws(() => decryptData(enc, key2), /Unsupported state|unable to authenticate|auth tag/i);
});

test('不同密码派生出不同密钥', () => {
  const salt = crypto.randomBytes(16);
  const k1 = deriveKey('pwd1', salt);
  const k2 = deriveKey('pwd2', salt);
  assert.ok(!k1.equals(k2));
});

test('相同密码 + 不同盐 → 不同密钥', () => {
  const s1 = crypto.randomBytes(16);
  const s2 = crypto.randomBytes(16);
  const k1 = deriveKey('pwd', s1);
  const k2 = deriveKey('pwd', s2);
  assert.ok(!k1.equals(k2));
});

test('verify tag 可正确验证密码', () => {
  const salt = crypto.randomBytes(16);
  const key = deriveKey('mypwd', salt);
  const tag = makeVerifyTagSecure(key);
  assert.strictEqual(verifyKey(key, tag), true);
  const wrongKey = deriveKey('wrong', salt);
  assert.strictEqual(verifyKey(wrongKey, tag), false);
});

test('支持中文许可证数据加密往返', () => {
  const salt = crypto.randomBytes(16);
  const key = deriveKey('中文密码', salt);
  const data = [
    { id: 'L-中文', name: '软件许可证', vendor: '厂商', licenseKey: '密钥-1234', notes: '这是备注' }
  ];
  const enc = encryptData(data, key);
  const dec = decryptData(enc, key);
  assert.deepStrictEqual(dec, data);
  assert.strictEqual(dec[0].name, '软件许可证');
});

test('大数据量（1000 条许可证）加密往返', () => {
  const salt = crypto.randomBytes(16);
  const key = deriveKey('test', salt);
  const data = [];
  for (let i = 0; i < 1000; i++) {
    data.push({
      id: 'L-' + i,
      name: 'License ' + i,
      licenseKey: 'KEY-' + i,
      expiryDate: '2027-01-01'
    });
  }
  const enc = encryptData(data, key);
  const dec = decryptData(enc, key);
  assert.strictEqual(dec.length, 1000);
  assert.strictEqual(dec[999].id, 'L-999');
});

console.log('\n[状态判断]');

test('永久授权返回 perpetual', () => {
  assert.strictEqual(getStatus({ perpetual: true }), 'perpetual');
});

test('无到期日返回 active', () => {
  assert.strictEqual(getStatus({}), 'active');
});

test('未来 60 天到期 → active', () => {
  const future = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  assert.strictEqual(getStatus({ expiryDate: future }), 'active');
});

test('未来 15 天到期 → expiring', () => {
  const future = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  assert.strictEqual(getStatus({ expiryDate: future }), 'expiring');
});

test('过去 5 天到期 → expired', () => {
  const past = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  assert.strictEqual(getStatus({ expiryDate: past }), 'expired');
});

test('今天到期 → expiring', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.strictEqual(getStatus({ expiryDate: today }), 'expiring');
});

test('永久授权优先级高于 expiryDate', () => {
  const past = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  assert.strictEqual(getStatus({ perpetual: true, expiryDate: past }), 'perpetual');
});

console.log('\n[日期计算]');

test('daysBetween 计算正确', () => {
  const a = new Date('2026-01-01');
  const b = new Date('2026-02-01');
  assert.strictEqual(daysBetween(a, b), 31);
});

test('daysBetween 处理负数', () => {
  const a = new Date('2026-02-01');
  const b = new Date('2026-01-01');
  assert.strictEqual(daysBetween(a, b), -31);
});

console.log('\n[过滤逻辑]');

test('关键词搜索匹配名称/厂商/密钥/备注', () => {
  const list = [
    { id: '1', name: 'JetBrains IDEA', vendor: 'JetBrains', licenseKey: 'XXX', notes: '' },
    { id: '2', name: 'Office', vendor: 'Microsoft', licenseKey: 'ABC-JET-123', notes: '' },
    { id: '3', name: 'Notepad', vendor: 'Unknown', licenseKey: 'XYZ', notes: 'jetbrains 续费' }
  ];
  const kw = 'jet';
  const matched = list.filter(l => {
    const haystack = [l.name, l.vendor, l.licenseKey, l.notes].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(kw);
  });
  assert.strictEqual(matched.length, 3);
});

test('分类过滤', () => {
  const list = [
    { id: '1', category: 'development' },
    { id: '2', category: 'design' },
    { id: '3', category: 'development' }
  ];
  const filtered = list.filter(l => l.category === 'development');
  assert.strictEqual(filtered.length, 2);
});

console.log('\n[排序逻辑]');

test('按到期日期升序排列（永久授权排后）', () => {
  const list = [
    { id: '1', name: 'A', perpetual: false, expiryDate: '2026-12-01' },
    { id: '2', name: 'B', perpetual: true, expiryDate: null },
    { id: '3', name: 'C', perpetual: false, expiryDate: '2026-06-01' }
  ];
  list.sort((a, b) => {
    if (a.perpetual && b.perpetual) return (a.name || '').localeCompare(b.name || '');
    if (a.perpetual) return 1;
    if (b.perpetual) return -1;
    return new Date(a.expiryDate || '9999-12-31') - new Date(b.expiryDate || '9999-12-31');
  });
  assert.strictEqual(list[0].id, '3');
  assert.strictEqual(list[1].id, '1');
  assert.strictEqual(list[2].id, '2');
});

// ============ 结果 ============
console.log('\n────────────────');
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
console.log('────────────────');
if (failed > 0) process.exit(1);
