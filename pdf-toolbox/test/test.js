// PDF管家 核心模块单元测试
// 运行：node test/test.js
// 测试前需先 npm install pdf-lib

const fs = require('fs');
const path = require('path');
const os = require('os');
const pdf = require('../src/core/pdf-ops.js');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-toolbox-test-'));
console.log('测试目录:', tmpDir);
console.log('');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log('  ✓ ' + msg);
    passed++;
  } else {
    console.log('  ✗ ' + msg);
    failed++;
  }
}

// 串行执行测试：test() 把 thunk 推入队列，最后统一串行 await
const testQueue = [];
function test(name, fn) {
  testQueue.push({ name, fn });
}

// 工具函数：创建测试用 PDF 文件
const { PDFDocument, StandardFonts, rgb } = require('@cantoo/pdf-lib');

async function createTestPDF(filePath, text, pages = 1) {
  // 注: pdf-lib 内置 Helvetica 仅支持 WinAnsi/ASCII, 测试文字用英文避免编码错误
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${text} - Page ${i + 1}`, { x: 50, y: 750, size: 24, font, color: rgb(0, 0, 0) });
  }
  const out = await doc.save();
  fs.writeFileSync(filePath, Buffer.from(out));
  return filePath;
}

// 简单创建一张 PNG 测试图片（1x1 红色 PNG）
function createTestPNG(filePath) {
  // 最小化的 1x1 红色 PNG
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x9D, 0xE7, 0x50,
    0x5B, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(filePath, pngBytes);
  return filePath;
}

// 工具函数测试
test('parsePageRanges 工具函数', () => {
  const r1 = pdf.parsePageRanges('1-3,5,7-9', 10);
  assert(JSON.stringify(r1) === JSON.stringify([1, 2, 3, 5, 7, 8, 9]), '混合范围解析正确');

  const r2 = pdf.parsePageRanges('*', 5);
  assert(r2.length === 5, '* 通配符返回全部');

  const r3 = pdf.parsePageRanges('', 3);
  assert(r3.length === 3, '空字符串返回全部');

  let threw = false;
  try { pdf.parsePageRanges('99', 5); } catch (e) { threw = true; }
  assert(threw, '超出范围抛出异常');

  threw = false;
  try { pdf.parsePageRanges('5-3', 10); } catch (e) { threw = true; }
  assert(threw, '范围反转抛出异常');
});

test('formatSize 工具函数', () => {
  assert(pdf.formatSize(0) === '0 B', '0 B 正确');
  assert(pdf.formatSize(1023) === '1023 B', '字节单位正确');
  assert(pdf.formatSize(1024) === '1.0 KB', 'KB 单位正确');
  assert(pdf.formatSize(1024 * 1024) === '1.00 MB', 'MB 单位正确');
});

// 主功能测试（异步）
test('1. 合并 PDF', async () => {
  const f1 = path.join(tmpDir, 'a.pdf');
  const f2 = path.join(tmpDir, 'b.pdf');
  await createTestPDF(f1, 'DocA', 2);
  await createTestPDF(f2, 'DocB', 3);
  const out = path.join(tmpDir, 'merged.pdf');
  const result = await pdf.mergePDFs([f1, f2], out);
  assert(fs.existsSync(out), '输出文件已生成');
  assert(result.pages === 5, '总页数=2+3=5');
  assert(result.size > 0, '文件大小>0');
});

test('2. 拆分 PDF (每页一份)', async () => {
  const src = path.join(tmpDir, 'split-src.pdf');
  await createTestPDF(src, 'SplitEach', 3);
  const outDir = path.join(tmpDir, 'split-each');
  const result = await pdf.splitPDF(src, outDir, { mode: 'each' });
  assert(result.total === 3, '源 PDF 3 页');
  assert(result.outFiles.length === 3, '拆分出 3 个文件');
  for (const f of result.outFiles) {
    assert(fs.existsSync(f), '文件存在: ' + path.basename(f));
  }
});

test('3. 拆分 PDF (按范围拆分)', async () => {
  const src = path.join(tmpDir, 'split-src2.pdf');
  await createTestPDF(src, 'SplitRanges', 10);
  const outDir = path.join(tmpDir, 'split-ranges');
  const result = await pdf.splitPDF(src, outDir, { mode: 'ranges', ranges: '1-3,5-6,9' });
  assert(result.outFiles.length === 3, '按范围拆出 3 个文件');
});

test('4. 拆分 PDF (抽取指定页)', async () => {
  const src = path.join(tmpDir, 'split-src3.pdf');
  await createTestPDF(src, 'SplitExtract', 10);
  const outDir = path.join(tmpDir, 'split-extract');
  const result = await pdf.splitPDF(src, outDir, { mode: 'extract', ranges: '1,3,5' });
  assert(result.outFiles.length === 1, '抽取生成 1 个文件');
  // 验证页数：通过重新加载验证
  const { PDFDocument } = require('@cantoo/pdf-lib');
  const bytes = fs.readFileSync(result.outFiles[0]);
  const doc = await PDFDocument.load(bytes);
  assert(doc.getPageCount() === 3, '抽取文件包含 3 页');
});

test('5. 压缩 PDF', async () => {
  const src = path.join(tmpDir, 'compress-src.pdf');
  await createTestPDF(src, 'Compress', 5);
  const out = path.join(tmpDir, 'compressed.pdf');
  const result = await pdf.compressPDF(src, out);
  assert(fs.existsSync(out), '压缩后文件已生成');
  assert(result.newSize > 0, '新文件大小>0');
  assert(typeof result.ratio === 'number', '压缩率是数字');
});

test('6. 加密 PDF', async () => {
  const src = path.join(tmpDir, 'encrypt-src.pdf');
  await createTestPDF(src, 'Encrypt', 2);
  const out = path.join(tmpDir, 'encrypted.pdf');
  const result = await pdf.encryptPDF(src, out, {
    userPassword: 'test123',
    permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false }
  });
  assert(fs.existsSync(out), '加密后文件已生成');
  assert(result.pages === 2, '页数=2');
  // 验证：加密后的 PDF 字节流包含 /Encrypt 字典（加密标志）
  // 注: pdf-lib 读取时不强制验证密码(库限制), 但写入加密是有效的, 第三方阅读器会要求密码
  const raw = fs.readFileSync(out);
  const hasEncrypt = /\/Encrypt\b/.test(raw.toString('latin1'));
  assert(hasEncrypt, '加密后包含 /Encrypt 标志');
});

test('7. 解密 PDF', async () => {
  const enc = path.join(tmpDir, 'encrypted.pdf');
  const out = path.join(tmpDir, 'decrypted.pdf');
  const result = await pdf.decryptPDF(enc, out, 'test123');
  assert(fs.existsSync(out), '解密后文件已生成');
  assert(result.pages === 2, '页数=2');
  // 验证：解密后无 /Encrypt 标志（即去除密码保护）
  const raw = fs.readFileSync(out);
  const hasEncrypt = /\/Encrypt\b/.test(raw.toString('latin1'));
  assert(!hasEncrypt, '解密后无 /Encrypt 标志');
});

test('8. 解密 PDF - 错误密码', async () => {
  const enc = path.join(tmpDir, 'encrypted.pdf');
  const out = path.join(tmpDir, 'decrypt-wrong.pdf');
  // @cantoo/pdf-lib 会验证密码, 错误密码应抛异常
  let threw = false;
  try {
    await pdf.decryptPDF(enc, out, 'wrong-pwd');
  } catch (e) {
    threw = true;
    assert(/密码错误/.test(e.message), '错误信息包含"密码错误"');
  }
  assert(threw, '错误密码抛出异常');
});

test('9. 加水印', async () => {
  const src = path.join(tmpDir, 'wm-src.pdf');
  await createTestPDF(src, 'Watermark', 3);
  const out = path.join(tmpDir, 'watermarked.pdf');
  const result = await pdf.addWatermark(src, out, {
    text: 'CONFIDENTIAL',
    fontSize: 60,
    opacity: 0.2,
    color: [1, 0, 0],
    density: 'medium'
  });
  assert(fs.existsSync(out), '加水印后文件已生成');
  assert(result.pages === 3, '页数=3');
  // 输出文件应该比原文件大（多了水印内容）
  const origSize = fs.statSync(src).size;
  const newSize = fs.statSync(out).size;
  assert(newSize > origSize, '加水印后文件变大');
});

test('10. 图片转 PDF', async () => {
  const img1 = path.join(tmpDir, 'img1.png');
  const img2 = path.join(tmpDir, 'img2.png');
  createTestPNG(img1);
  createTestPNG(img2);
  const out = path.join(tmpDir, 'images.pdf');
  const result = await pdf.imagesToPDF([img1, img2], out, { pageSize: 'A4', orientation: 'auto' });
  assert(fs.existsSync(out), 'PDF 已生成');
  assert(result.pages === 2, '页数=2');
});

test('11. 合并 PDF - 空数组应报错', async () => {
  let threw = false;
  try {
    await pdf.mergePDFs([], path.join(tmpDir, 'x.pdf'));
  } catch (e) { threw = true; }
  assert(threw, '空数组抛出异常');
});

test('12. 加水印 - 空文字应报错', async () => {
  const src = path.join(tmpDir, 'wm-src.pdf');
  let threw = false;
  try {
    await pdf.addWatermark(src, path.join(tmpDir, 'x.pdf'), { text: '' });
  } catch (e) { threw = true; }
  assert(threw, '空文字抛出异常');
});

// 串行等待所有测试完成
(async () => {
  for (const t of testQueue) {
    console.log('▶ ' + t.name);
    try {
      await t.fn();
    } catch (e) {
      console.log('  ✗ 异常: ' + e.message);
      console.log(e.stack);
      failed++;
    }
    console.log('');
  }
  console.log('========================================');
  console.log(`通过: ${passed}  失败: ${failed}`);
  console.log('========================================');
  // 清理临时目录（可选，调试时保留）
  // try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  process.exit(failed > 0 ? 1 : 0);
})();
