'use strict';
// 校验管家 - 核心哈希计算工具
// 提供 MD5 / SHA1 / SHA256 / SHA512 / CRC32 计算、比较与格式化能力

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 支持的算法清单（展示顺序）
const ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512', 'crc32'];

/**
 * 计算给定 Buffer 的 CRC32（IEEE 802.3 多项式，与 zip 一致）
 * @param {Buffer} buffer
 * @returns {string} 8 位小写十六进制
 */
function crc32(buffer) {
  // 预计算多项式表（反射型）
  const table = crc32._table || (crc32._table = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[i] = c >>> 0;
    }
    return t;
  })());

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = (table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

/**
 * 对单个 Buffer 计算所有算法的哈希
 * @param {Buffer} buffer
 * @returns {{md5:string, sha1:string, sha256:string, sha512:string, crc32:string}}
 */
function hashBuffer(buffer) {
  const result = {};
  for (const alg of ALGORITHMS) {
    if (alg === 'crc32') {
      result.crc32 = crc32(buffer);
    } else {
      result[alg] = crypto.createHash(alg).update(buffer).digest('hex');
    }
  }
  return result;
}

/**
 * 流式计算大文件的哈希（避免一次性读入内存）
 * @param {string} filePath 文件绝对路径
 * @param {function} [onProgress] (ratio 0~1) => void 可选进度回调
 * @param {Array<string>} [algorithms] 指定算法子集，默认全部
 * @returns {Promise<object>} 各算法哈希值
 */
function hashFile(filePath, onProgress, algorithms) {
  return new Promise((resolve, reject) => {
    const algs = (algorithms && algorithms.length ? algorithms : ALGORITHMS).slice();
    const useCrypto = algs.filter(a => a !== 'crc32');
    const useCrc32 = algs.indexOf('crc32') !== -1;

    const hashes = {};
    const hashers = useCrypto.map(a => ({ alg: a, h: crypto.createHash(a) }));
    let crcState = 0xFFFFFFFF;
    const crcTable = crc32._table || (crc32._table = (function () {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c >>> 0;
      }
      return t;
    })());

    const CHUNK = 1024 * 1024 * 4; // 4MB
    let total = 0;
    let done = 0;

    fs.stat(filePath, (statErr, stat) => {
      if (statErr) return reject(statErr);
      total = stat.size || 0;
      const input = fs.createReadStream(filePath, { highWaterMark: CHUNK });

      input.on('data', (chunk) => {
        for (const item of hashers) item.h.update(chunk);
        if (useCrc32) {
          for (let i = 0; i < chunk.length; i++) {
            crcState = (crcTable[(crcState ^ chunk[i]) & 0xFF] ^ (crcState >>> 8)) >>> 0;
          }
        }
        done += chunk.length;
        if (typeof onProgress === 'function') {
          try { onProgress(total > 0 ? done / total : 0); } catch (_) { /* 忽略回调错误 */ }
        }
      });

      input.on('end', () => {
        for (const item of hashers) hashes[item.alg] = item.h.digest('hex');
        if (useCrc32) hashes.crc32 = ((crcState ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
        // 保证输出顺序与 ALGORITHMS 一致
        const ordered = {};
        for (const a of algs) ordered[a] = hashes[a];
        resolve(ordered);
      });

      input.on('error', (err) => reject(err));
    });
  });
}

/**
 * 大小写不敏感比较两个哈希字符串
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function compareHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * 把字节数格式化为易读字符串
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : (v >= 10 ? 1 : 2))} ${units[i]}`;
}

/**
 * 根据 hash 字符串长度推断算法名
 * @param {string} hash
 * @returns {string|null}
 */
function guessAlgorithm(hash) {
  if (typeof hash !== 'string') return null;
  const len = hash.trim().length;
  switch (len) {
    case 8: return 'crc32';
    case 32: return 'md5';
    case 40: return 'sha1';
    case 64: return 'sha256';
    case 128: return 'sha512';
    default: return null;
  }
}

/**
 * 从一段文本里抽取第一个有效的 hash 字符串
 * 常见场景：粘贴 "abc123  filename.iso" 这类校验文件
 * @param {string} text
 * @returns {{hash:string, algorithm:string|null}|null}
 */
function extractHashFromText(text) {
  if (typeof text !== 'string') return null;
  const re = /\b([0-9a-fA-F]{8}|[0-9a-fA-F]{32}|[0-9a-fA-F]{40}|[0-9a-fA-F]{64}|[0-9a-fA-F]{128})\b/;
  const m = text.match(re);
  if (!m) return null;
  return { hash: m[1], algorithm: guessAlgorithm(m[1]) };
}

/**
 * 导出结果为可读文本
 * @param {Array<object>} items [{filePath, size, hashes}]
 * @returns {string}
 */
function exportAsText(items) {
  const lines = [];
  for (const it of items) {
    lines.push('----------------------------------------------');
    lines.push(`文件: ${path.basename(it.filePath)}`);
    lines.push(`路径: ${it.filePath}`);
    lines.push(`大小: ${formatSize(it.size)}`);
    for (const alg of ALGORITHMS) {
      if (it.hashes[alg]) lines.push(`${alg.toUpperCase()}: ${it.hashes[alg]}`);
    }
    if (it.expected && it.algorithm) {
      const ok = compareHash(it.expected, it.hashes[it.algorithm]);
      lines.push(`校验(${it.algorithm.toUpperCase()}): ${ok ? '✓ 通过' : '✗ 不匹配'}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  ALGORITHMS,
  crc32,
  hashBuffer,
  hashFile,
  compareHash,
  formatSize,
  guessAlgorithm,
  extractHashFromText,
  exportAsText
};
