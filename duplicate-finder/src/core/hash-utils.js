// hash-utils.js — 文件哈希工具
// 三段式哈希策略，兼顾速度与精度：
//   1) sizeKey：仅按文件大小分组（零 IO 读内容，最快）
//   2) partialHash：读首部 + 尾部 + 大小组合（一次小读，过滤掉大部分）
//   3) fullHash：SHA-256 全文（最终定论）
const fs = require('fs');
const crypto = require('crypto');

const PARTIAL_HEAD = 4 * 1024;   // 头部 4KB
const PARTIAL_TAIL = 4 * 1024;   // 尾部 4KB
const READ_CHUNK = 64 * 1024;    // 全文哈希读取块大小

// 安全读取文件一段区间
function readRange(fd, start, length) {
  const buf = Buffer.allocUnsafe(length);
  const n = fs.readSync(fd, buf, 0, length, start);
  return buf.slice(0, n);
}

// 部分哈希：头部 + 尾部 + 大小 → 一段 sha256 摘要
// 仅对 < 16KB 的小文件直接整体读
function partialHash(filePath, size) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    if (size <= PARTIAL_HEAD + PARTIAL_TAIL) {
      const buf = readRange(fd, 0, size);
      return crypto.createHash('sha256').update(buf).digest('hex');
    }
    const head = readRange(fd, 0, PARTIAL_HEAD);
    const tail = readRange(fd, size - PARTIAL_TAIL, PARTIAL_TAIL);
    const h = crypto.createHash('sha256');
    h.update(head);
    h.update(tail);
    h.update(Buffer.from(`:${size}`));
    return h.digest('hex');
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) { /* ignore */ }
    }
  }
}

// 完整 SHA-256，流式读取避免大文件爆内存
function fullHash(filePath, size, onProgress) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    let read = 0;
    const stream = fs.createReadStream(filePath, { highWaterMark: READ_CHUNK });
    stream.on('data', (chunk) => {
      h.update(chunk);
      read += chunk.length;
      if (typeof onProgress === 'function') {
        try { onProgress(read, size); } catch (_) { /* ignore */ }
      }
    });
    stream.on('end', () => resolve(h.digest('hex')));
    stream.on('error', reject);
  });
}

module.exports = { partialHash, fullHash, PARTIAL_HEAD, PARTIAL_TAIL };
