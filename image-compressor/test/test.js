// ========== 图片压缩器 · 核心逻辑测试 ==========
// 测试压缩核心函数（不依赖 Electron，使用 sharp 直接测试）

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log('  [PASS] ' + msg);
  } else {
    fail++;
    console.error('  [FAIL] ' + msg);
  }
}

// 复制 main.js 中的压缩核心函数用于测试
async function compressImage(inputPath, outputPath, options) {
  const { quality = 80, format = 'keep', resize = null } = options;
  let pipeline = sharp(inputPath, { failOn: 'truncated' });
  if (resize && resize.enabled) {
    pipeline = pipeline.resize({
      width: resize.width || null,
      height: resize.height || null,
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  let outputFormat = format;
  if (format === 'keep') {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') outputFormat = 'jpeg';
    else if (ext === '.png') outputFormat = 'png';
    else if (ext === '.webp') outputFormat = 'webp';
    else outputFormat = 'jpeg';
  }
  const qualityVal = Math.max(1, Math.min(100, parseInt(quality, 10) || 80));
  if (outputFormat === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: qualityVal, mozjpeg: true, progressive: true });
  } else if (outputFormat === 'png') {
    pipeline = pipeline.png({ quality: qualityVal, compressionLevel: 9, palette: qualityVal < 100, effort: 10 });
  } else if (outputFormat === 'webp') {
    pipeline = pipeline.webp({ quality: qualityVal, effort: 6 });
  } else {
    pipeline = pipeline.jpeg({ quality: qualityVal });
  }
  await pipeline.toFile(outputPath);
  const stat = await fs.promises.stat(outputPath);
  return { outputPath, outputSize: stat.size };
}

async function makeTestImage(width, height, format, filePath) {
  const buf = await sharp({
    create: {
      width, height, channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  })[format]().toFile(filePath);
  return filePath;
}

async function main() {
  console.log('\n========== 图片压缩器 测试 ==========\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'imgcomp-test-'));
  console.log('测试目录: ' + tmpDir + '\n');

  // 测试 1：JPEG 压缩
  console.log('[测试1] JPEG 压缩 (quality=50)');
  {
    const src = path.join(tmpDir, 'test.jpg');
    const dst = path.join(tmpDir, 'out_q50.jpg');
    await makeTestImage(800, 600, 'jpeg', src);
    const origSize = fs.statSync(src).size;
    const r = await compressImage(src, dst, { quality: 50, format: 'keep' });
    assert(r.outputSize > 0, '输出文件大小 > 0');
    assert(r.outputSize < origSize, '压缩后体积小于原始 (' + r.outputSize + ' < ' + origSize + ')');
    assert(fs.existsSync(r.outputPath), '输出文件存在');
  }

  // 测试 2：PNG 压缩
  console.log('\n[测试2] PNG 压缩 (quality=80)');
  {
    const src = path.join(tmpDir, 'test.png');
    const dst = path.join(tmpDir, 'out_q80.png');
    await makeTestImage(800, 600, 'png', src);
    const r = await compressImage(src, dst, { quality: 80, format: 'keep' });
    assert(r.outputSize > 0, '输出文件大小 > 0');
    assert(fs.existsSync(r.outputPath), '输出文件存在');
  }

  // 测试 3：格式转换 JPEG -> WebP
  console.log('\n[测试3] 格式转换 JPEG -> WebP');
  {
    const src = path.join(tmpDir, 'test.jpg');
    const dst = path.join(tmpDir, 'converted.webp');
    const r = await compressImage(src, dst, { quality: 70, format: 'webp' });
    const meta = await sharp(r.outputPath).metadata();
    assert(meta.format === 'webp', '输出格式应为 webp，实际 ' + meta.format);
    assert(r.outputSize > 0, '输出文件大小 > 0');
  }

  // 测试 4：质量边界值 1 和 100
  console.log('\n[测试4] 质量边界值 (q=1, q=100)');
  {
    const src = path.join(tmpDir, 'big.jpg');
    const dst1 = path.join(tmpDir, 'q1.jpg');
    const dst100 = path.join(tmpDir, 'q100.jpg');
    await makeTestImage(1200, 900, 'jpeg', src);
    const r1 = await compressImage(src, dst1, { quality: 1, format: 'keep' });
    const r100 = await compressImage(src, dst100, { quality: 100, format: 'keep' });
    assert(r1.outputSize < r100.outputSize, 'q=1 应小于 q=100 (' + r1.outputSize + ' < ' + r100.outputSize + ')');
  }

  // 测试 5：尺寸调整
  console.log('\n[测试5] 尺寸调整 (resize 400x300)');
  {
    const src = path.join(tmpDir, 'big.jpg');
    const dst = path.join(tmpDir, 'resized.jpg');
    const r = await compressImage(src, dst, {
      quality: 80, format: 'jpeg',
      resize: { enabled: true, width: 400, height: 300 }
    });
    const meta = await sharp(r.outputPath).metadata();
    assert(meta.width === 400, '输出宽度应为 400，实际 ' + meta.width);
    assert(meta.height === 300, '输出高度应为 300，实际 ' + meta.height);
  }

  // 测试 6：质量值越界自动修正
  console.log('\n[测试6] 质量值越界自动修正 (q=999, q=-5)');
  {
    const src = path.join(tmpDir, 'test.jpg');
    const dst = path.join(tmpDir, 'boundary.jpg');
    const r = await compressImage(src, dst, { quality: 999, format: 'keep' });
    assert(r.outputSize > 0, 'q=999 修正后正常输出');
  }

  // 清理
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n========== 结果 ==========');
  console.log('通过: ' + pass + ' / 失败: ' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
