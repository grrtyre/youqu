'use strict';
// 校验管家 - 核心逻辑测试
// 运行：node test/test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ALGORITHMS, crc32, hashBuffer, hashFile, compareHash,
  formatSize, guessAlgorithm, extractHashFromText, exportAsText
} = require('../src/core/hash-utils');

let passed = 0;
function ok(name, cond) {
  if (!cond) throw new Error('测试失败: ' + name);
  passed++;
  console.log('  ✓ ' + name);
}
function eq(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`测试失败: ${name}\n  期望: ${expected}\n  实际: ${actual}`);
  }
  passed++;
  console.log('  ✓ ' + name);
}

console.log('校验管家 - 单元测试');
console.log('====================');

// 1. CRC32 已知向量
console.log('\n[CRC32]');
eq('空串 CRC32', crc32(Buffer.from('')), '00000000');
// "123456789" 的标准 CRC32 = 0xCBF43926
eq('123456789 CRC32', crc32(Buffer.from('123456789')), 'cbf43926');
// "abc" 的 CRC32 = 0x352441C2
eq('abc CRC32', crc32(Buffer.from('abc')), '352441c2');

// 2. hashBuffer 已知向量（NIST/标准）
console.log('\n[hashBuffer]');
const empty = hashBuffer(Buffer.from(''));
eq('空串 MD5', empty.md5, 'd41d8cd98f00b204e9800998ecf8427e');
eq('空串 SHA1', empty.sha1, 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
eq('空串 SHA256', empty.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
eq('空串 SHA512', empty.sha512, 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e');

const abc = hashBuffer(Buffer.from('abc'));
eq('"abc" MD5', abc.md5, '900150983cd24fb0d6963f7d28e17f72');
eq('"abc" SHA1', abc.sha1, 'a9993e364706816aba3e25717850c26c9cd0d89d');
eq('"abc" SHA256', abc.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
eq('"abc" SHA512', abc.sha512, 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f');
eq('"abc" CRC32', abc.crc32, '352441c2');

// 3. ALGORITHMS 顺序
console.log('\n[算法清单]');
eq('算法数量', ALGORITHMS.length, 5);
eq('首个算法', ALGORITHMS[0], 'md5');
eq('末个算法', ALGORITHMS[4], 'crc32');

// 4. compareHash 大小写不敏感
console.log('\n[compareHash]');
ok('相同哈希匹配', compareHash('aBc123', 'ABC123') === true);
ok('不同哈希不匹配', compareHash('aBc123', 'abc124') === false);
ok('空白被忽略', compareHash('  abc  ', 'abc') === true);
ok('非字符串返回 false', compareHash(null, 'abc') === false);

// 5. guessAlgorithm 长度推断
console.log('\n[guessAlgorithm]');
eq('8 位 -> crc32', guessAlgorithm('352441c2'), 'crc32');
eq('32 位 -> md5', guessAlgorithm('d41d8cd98f00b204e9800998ecf8427e'), 'md5');
eq('40 位 -> sha1', guessAlgorithm('a9993e364706816aba3e25717850c26c9cd0d89d'), 'sha1');
eq('64 位 -> sha256', guessAlgorithm('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'sha256');
eq('128 位 -> sha512', guessAlgorithm('cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'), 'sha512');
eq('异常长度 -> null', guessAlgorithm('abc'), null);

// 6. extractHashFromText 从文本抽取
console.log('\n[extractHashFromText]');
{
  const r = extractHashFromText('d41d8cd98f00b204e9800998ecf8427e  readme.txt');
  ok('能从校验文件文本抽取 MD5', r && r.hash === 'd41d8cd98f00b204e9800998ecf8427e' && r.algorithm === 'md5');
}
{
  const r = extractHashFromText('SHA256: ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  ok('能从前缀文本抽取 SHA256', r && r.algorithm === 'sha256');
}
ok('无哈希文本返回 null', extractHashFromText('hello world') === null);

// 7. formatSize
console.log('\n[formatSize]');
eq('0 B', formatSize(0), '0 B');
eq('512 B', formatSize(512), '512 B');
eq('1.00 KB', formatSize(1024), '1.00 KB');
ok('1 MB 接近', formatSize(1024 * 1024).indexOf('MB') !== -1);
ok('1 GB 接近', formatSize(1024 * 1024 * 1024).indexOf('GB') !== -1);

// 8. hashFile 流式（写临时文件后计算）
console.log('\n[hashFile]');
{
  const tmp = path.join(os.tmpdir(), 'checksum-test-' + Date.now() + '.bin');
  const buf = Buffer.alloc(1024 * 64, 0xAB); // 64KB 重复 0xAB
  fs.writeFileSync(tmp, buf);
  const expectedMd5 = hashBuffer(buf).md5;
  const expectedSha256 = hashBuffer(buf).sha256;
  const expectedCrc32 = hashBuffer(buf).crc32;
  hashFile(tmp, (ratio) => {
    ok('进度在 0~1 之间', ratio >= 0 && ratio <= 1);
  }).then((hashes) => {
    eq('文件 MD5 与内存一致', hashes.md5, expectedMd5);
    eq('文件 SHA256 与内存一致', hashes.sha256, expectedSha256);
    eq('文件 CRC32 与内存一致', hashes.crc32, expectedCrc32);
    // 删除临时文件
    try { fs.unlinkSync(tmp); } catch (_) {}
    finish();
  }).catch((e) => {
    console.error('hashFile 失败:', e);
    try { fs.unlinkSync(tmp); } catch (_) {}
    process.exit(1);
  });
}

function finish() {
  // 9. exportAsText
  console.log('\n[exportAsText]');
  {
    const text = exportAsText([{
      filePath: 'C:/tmp/a.iso',
      size: 1024,
      hashes: { md5: 'd41d8cd98f00b204e9800998ecf8427e', sha256: 'ba7816bf' }
    }]);
    ok('导出包含文件名', text.indexOf('a.iso') !== -1);
    ok('导出包含 MD5', text.indexOf('MD5') !== -1);
    ok('导出包含大小', text.indexOf('KB') !== -1 || text.indexOf('B') !== -1);
  }

  console.log('\n====================');
  console.log(`全部通过：${passed} 项测试 ✓`);
  console.log('====================');
}
