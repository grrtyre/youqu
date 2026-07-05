// exif-reader.js
// 极简 JPEG EXIF 日期读取器 —— 无第三方依赖
// 仅提取 DateTimeOriginal(0x9003) / DateTimeDigitized(0x9004) / DateTime(0x0132)
// 失败时返回 null，调用方回退到文件 mtime

const fs = require('fs');

/**
 * 从 JPEG 文件读取 EXIF 拍摄日期
 * @param {string} filePath - JPEG 文件路径
 * @returns {Promise<string|null>} ISO 字符串，或 null
 */
function readExifDate(filePath) {
  return new Promise((resolve) => {
    fs.open(filePath, 'r', (err, fd) => {
      if (err) return resolve(null);
      // 先读前 4 字节判断是否 JPEG
      const header = Buffer.alloc(4);
      fs.read(fd, header, 0, 4, 0, (e1) => {
        if (e1 || header[0] !== 0xff || header[1] !== 0xd8) {
          fs.close(fd, () => resolve(null));
          return;
        }
        // 读 APP1 区域（最多 64KB 足够覆盖 EXIF）
        const exifBuf = Buffer.alloc(65536);
        fs.read(fd, exifBuf, 0, 65536, 2, (e2, bytesRead) => {
          fs.close(fd, () => {});
          if (e2) return resolve(null);
          const date = parseExifDateFromBuffer(exifBuf.slice(0, bytesRead));
          resolve(date);
        });
      });
    });
  });
}

function parseExifDateFromBuffer(buf) {
  // 找到 APP1 标记 0xFFE1
  let offset = 0;
  while (offset < buf.length - 4) {
    if (buf[offset] === 0xff && buf[offset + 1] === 0xe1) break;
    offset++;
  }
  if (offset >= buf.length - 4) return null;

  const app1Start = offset + 4; // 跳过 marker + length
  // 检查 "Exif\0\0" 标识
  if (buf.toString('ascii', app1Start, app1Start + 6) !== 'Exif\0\0') return null;

  const tiffStart = app1Start + 6;
  // TIFF 字节序
  const bigEndian = buf.readUInt16BE(tiffStart) === 0x4d4d;
  const read16 = bigEndian
    ? (b, o) => b.readUInt16BE(o)
    : (b, o) => b.readUInt16LE(o);
  const read32 = bigEndian
    ? (b, o) => b.readUInt32BE(o)
    : (b, o) => b.readUInt32LE(o);

  // TIFF magic 0x002A
  if (read16(buf, tiffStart + 2) !== 0x002a) return null;

  const ifd0Offset = tiffStart + read32(buf, tiffStart + 4);
  const ifd0Entries = read16(buf, ifd0Offset);

  // 遍历 IFD0 找到 ExifIFD 指针 (0x8769)
  let exifIfdOffset = 0;
  for (let i = 0; i < ifd0Entries; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12;
    const tag = read16(buf, entryOffset);
    if (tag === 0x8769) {
      exifIfdOffset = tiffStart + read32(buf, entryOffset + 8);
      break;
    }
  }

  // 优先在 ExifIFD 中找 DateTimeOriginal(0x9003)，再找 DateTimeDigitized(0x9004)
  // 最后在 IFD0 中找 DateTime(0x0132)
  const dateStr = findDateString(buf, exifIfdOffset, read16, read32, tiffStart)
    || findDateString(buf, ifd0Offset, read16, read32, tiffStart, [0x0132]);
  if (!dateStr) return null;

  // EXIF 日期格式: "YYYY:MM:DD HH:MM:SS" —— 这是相机本地时间
  // 返回无 Z 后缀的 ISO 字符串，new Date() 会按本地时间解析，避免跨日时区偏移
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dateStr);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  const d = new Date(iso); // 按本地时间解析
  return isNaN(d.getTime()) ? null : iso;
}

function findDateString(buf, ifdOffset, read16, read32, tiffStart, tags = [0x9003, 0x9004]) {
  if (!ifdOffset || ifdOffset >= buf.length) return null;
  const entries = read16(buf, ifdOffset);
  for (let i = 0; i < entries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > buf.length) break;
    const tag = read16(buf, entryOffset);
    if (tags.includes(tag)) {
      // type=2 (ASCII), count 通常 20
      const count = read32(buf, entryOffset + 4);
      // 值偏移：count<=4 内联，否则指针
      let valueOffset;
      if (count <= 4) {
        valueOffset = entryOffset + 8;
      } else {
        valueOffset = tiffStart + read32(buf, entryOffset + 8);
      }
      if (valueOffset + count > buf.length) return null;
      return buf.toString('ascii', valueOffset, valueOffset + count).replace(/\0+$/, '').trim();
    }
  }
  return null;
}

module.exports = { readExifDate };
