// PDF 核心操作模块 - 基于 @cantoo/pdf-lib (pdf-lib fork, 支持加密)，纯本地处理，零外发
// 功能：合并 / 拆分 / 压缩 / 加密 / 解密 / 加水印 / 图片转PDF

const fs = require('fs');
const path = require('path');
const {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees
} = require('@cantoo/pdf-lib');

// ---------- CJK 字体支持 ----------
// pdf-lib 内置 StandardFonts 仅支持 WinAnsi/ASCII，无法渲染中文。
// 当水印文字含非 ASCII 字符时，需嵌入系统 CJK 字体（黑体 simhei.ttf 优先）。
// @cantoo/pdf-lib 嵌入自定义字体前必须注册 fontkit。

let _fontkitMod = null;   // 懒加载，避免 ASCII 场景的无谓依赖
let _fontkitRegistered = new WeakSet();   // 记录已注册 fontkit 的 doc

// Windows 常见 CJK 字体，按优先级尝试（simhei.ttf 为纯 TTF，最可靠）
const CJK_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\simhei.ttf',    // 黑体
  'C:\\Windows\\Fonts\\msyh.ttc',      // 微软雅黑
  'C:\\Windows\\Fonts\\simsun.ttc',    // 宋体
  'C:\\Windows\\Fonts\\msyhbd.ttc',    // 微软雅黑 Bold
  '/System/Library/Fonts/PingFang.ttc', // macOS 苹方
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'  // Linux 文泉驿
];

// 检测文本是否含非 ASCII 字符（CJK / 全角符号 / Emoji 等）
function hasNonAscii(text) {
  if (typeof text !== 'string') return false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return true;
  }
  return false;
}

// 为文档嵌入合适字体：ASCII 用 HelveticaBold（轻量），含非 ASCII 则嵌入系统 CJK 字体
async function embedFontForText(doc, text) {
  if (!hasNonAscii(text)) {
    return await doc.embedFont(StandardFonts.HelveticaBold);
  }
  // 需要 CJK 字体：注册 fontkit（仅一次）
  if (!_fontkitMod) {
    try {
      _fontkitMod = require('@pdf-lib/fontkit');
    } catch (e) {
      throw new Error('水印含中文等非 ASCII 字符，但 fontkit 未安装。请联系开发者或仅使用英文水印。');
    }
  }
  if (!_fontkitRegistered.has(doc)) {
    doc.registerFontkit(_fontkitMod);
    _fontkitRegistered.add(doc);
  }
  // 依次尝试候选字体
  for (const fp of CJK_FONT_CANDIDATES) {
    try {
      if (!fs.existsSync(fp)) continue;
      const bytes = await fs.promises.readFile(fp);
      // subset:true 仅嵌入实际使用的字形，避免 simhei.ttf 9.7MB 全量打包
      return await doc.embedFont(bytes, { subset: true });
    } catch (e) {
      // TTC 集合可能需要指定 subfont，继续尝试下一个候选
      continue;
    }
  }
  throw new Error('水印含中文等非 ASCII 字符，但未找到可用的系统 CJK 字体（simhei.ttf / msyh.ttc 等）。请确认系统已安装中文字体，或改用英文水印。');
}

// ---------- 通用工具 ----------

// 读取文件为 Uint8Array（pdf-lib 接受的格式）
async function readBytes(filePath) {
  const buf = await fs.promises.readFile(filePath);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

async function writeBytes(filePath, bytes) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  // 兼容 Uint8Array / ArrayBuffer
  const data = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes);
  await fs.promises.writeFile(filePath, data);
  return data.length;
}

// 简单分页解析：支持 "1-3,5,7-9" 这种表达式，返回页码数组（1-based）
function parsePageRanges(expr, totalPages) {
  if (!expr || typeof expr !== 'string') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const trimmed = expr.trim();
  if (trimmed === '' || trimmed === '*') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const result = [];
  const parts = trimmed.split(/[,，\s]+/).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (start > end) throw new Error(`范围无效: ${part}（起始大于结束）`);
      for (let i = start; i <= end; i++) {
        if (i < 1 || i > totalPages) {
          throw new Error(`页码超出范围: ${i}（共 ${totalPages} 页）`);
        }
        result.push(i);
      }
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p < 1 || p > totalPages) {
        throw new Error(`页码超出范围: ${p}（共 ${totalPages} 页）`);
      }
      result.push(p);
    } else {
      throw new Error(`无法解析的页码表达式: ${part}`);
    }
  }
  if (result.length === 0) throw new Error('解析后页码为空');
  return result;
}

// ---------- 1. 合并 PDF ----------

async function mergePDFs(filePaths, outputPath, onProgress) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error('未选择任何文件');
  }
  const merged = await PDFDocument.create();
  // 删除元数据，减小体积
  merged.setTitle('');
  merged.setAuthor('');
  merged.setSubject('');
  merged.setKeywords([]);
  merged.setProducer('PDF管家');
  merged.setCreator('PDF管家');

  for (let i = 0; i < filePaths.length; i++) {
    const fp = filePaths[i];
    if (!fs.existsSync(fp)) throw new Error(`文件不存在: ${fp}`);
    const bytes = await readBytes(fp);
    let src;
    try {
      src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch (e) {
      throw new Error(`加载失败 ${path.basename(fp)}: ${e.message}`);
    }
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    copied.forEach(p => merged.addPage(p));
    if (typeof onProgress === 'function') {
      onProgress({ index: i, total: filePaths.length, file: path.basename(fp) });
    }
  }
  const out = await merged.save({ useObjectStreams: true });
  const size = await writeBytes(outputPath, out);
  return { pages: merged.getPageCount(), size, outputPath };
}

// ---------- 2. 拆分 PDF ----------

/**
 * 拆分 PDF
 * @param {string} inputPath
 * @param {string} outputDir 输出目录
 * @param {object} opts
 *   - mode: 'each' 每页一份 | 'ranges' 按范围拆成一份 | 'extract' 抽取指定页
 *   - ranges: 当 mode='ranges'/'extract' 时的页码表达式 "1-3,5,7-9"
 */
async function splitPDF(inputPath, outputDir, opts) {
  const { mode = 'each', ranges = '' } = opts || {};
  if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
  const bytes = await readBytes(inputPath);
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  if (total === 0) throw new Error('源 PDF 没有页面');
  await fs.promises.mkdir(outputDir, { recursive: true });
  const baseName = path.basename(inputPath, '.pdf');
  const outFiles = [];

  if (mode === 'each') {
    for (let i = 0; i < total; i++) {
      const out = await PDFDocument.create();
      const [p] = await out.copyPages(src, [i]);
      out.addPage(p);
      const data = await out.save({ useObjectStreams: true });
      const seq = String(i + 1).padStart(String(total).length, '0');
      const fp = path.join(outputDir, `${baseName}_${seq}.pdf`);
      await writeBytes(fp, data);
      outFiles.push(fp);
    }
  } else if (mode === 'ranges') {
    // 按逗号分割的每段范围作为一份
    const parts = ranges.split(/[,，]/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new Error('范围表达式为空');
    let idx = 1;
    for (const part of parts) {
      const pages = parsePageRanges(part, total);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pages.map(p => p - 1));
      copied.forEach(p => out.addPage(p));
      const data = await out.save({ useObjectStreams: true });
      const fp = path.join(outputDir, `${baseName}_part${idx}.pdf`);
      await writeBytes(fp, data);
      outFiles.push(fp);
      idx++;
    }
  } else if (mode === 'extract') {
    const pages = parsePageRanges(ranges, total);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pages.map(p => p - 1));
    copied.forEach(p => out.addPage(p));
    const data = await out.save({ useObjectStreams: true });
    const fp = path.join(outputDir, `${baseName}_extract.pdf`);
    await writeBytes(fp, data);
    outFiles.push(fp);
  } else {
    throw new Error(`未知拆分模式: ${mode}`);
  }
  return { total, outFiles };
}

// ---------- 3. 压缩 PDF ----------

/**
 * 压缩 PDF（轻度）
 * 策略：重新加载 + 清理元数据 + 用对象流保存
 * 注：pdf-lib 无法重新压缩已有 JPEG，所以压缩率取决于原文件结构
 */
async function compressPDF(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
  const origSize = fs.statSync(inputPath).size;
  const bytes = await readBytes(inputPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  // 清理元数据
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setProducer('PDF管家');
  doc.setCreator('PDF管家');
  // 清理自定义元数据
  try {
    const info = doc.getInfoDict();
    const keys = Object.keys(info);
    for (const k of keys) {
      if (!['Title', 'Author', 'Subject', 'Keywords', 'Producer', 'Creator', 'CreationDate', 'ModDate'].includes(k)) {
        doc.setCustomMetadata(k, '');
      }
    }
  } catch (e) {
    // 元数据清理失败不影响主流程
  }
  const out = await doc.save({
    useObjectStreams: true,
    addDefaultPage: false
  });
  const newSize = await writeBytes(outputPath, out);
  return {
    origSize,
    newSize,
    saved: Math.max(0, origSize - newSize),
    ratio: origSize > 0 ? (1 - newSize / origSize) : 0
  };
}

// ---------- 4. 加密 PDF ----------

/**
 * 加密 PDF
 * 使用 @cantoo/pdf-lib 的 doc.encrypt() 方法 (RC4/AES, 真正加密)
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {object} opts
 *   - userPassword: 用户密码（打开需要）
 *   - ownerPassword: 所有者密码（修改权限需要），不填则同 userPassword
 *   - permissions: 权限对象 { printing, modifying, copying, annotating } true=允许
 */
async function encryptPDF(inputPath, outputPath, opts) {
  const {
    userPassword = '',
    ownerPassword = '',
    permissions = {}
  } = opts || {};
  if (!userPassword) throw new Error('未填写用户密码');
  if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
  const bytes = await readBytes(inputPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  // 调用 @cantoo/pdf-lib 的 encrypt 方法设置加密
  doc.encrypt({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: permissions.printing !== undefined ? permissions.printing : 'highResolution',
      modifying: permissions.modifying !== undefined ? permissions.modifying : false,
      copying: permissions.copying !== undefined ? permissions.copying : false,
      annotating: permissions.annotating !== undefined ? permissions.annotating : false
    }
  });
  const out = await doc.save({ useObjectStreams: true });
  const size = await writeBytes(outputPath, out);
  return { pages: doc.getPageCount(), size, outputPath };
}

// ---------- 5. 解密 PDF ----------

/**
 * 解密 PDF：去掉密码保护
 * 通过复制所有页面到新文档的方式彻底清除 /Encrypt 字典
 * （@cantoo/pdf-lib 直接 save 会保留旧 Encrypt 引用，故用此法）
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} password 用户密码或所有者密码
 */
async function decryptPDF(inputPath, outputPath, password) {
  if (!password) throw new Error('未填写密码');
  if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
  const bytes = await readBytes(inputPath);
  let src;
  try {
    src = await PDFDocument.load(bytes, { password });
  } catch (e) {
    throw new Error('密码错误或文件已损坏');
  }
  // 复制所有页面到全新文档，确保不带 Encrypt
  const out = await PDFDocument.create();
  out.setTitle('');
  out.setProducer('PDF管家');
  out.setCreator('PDF管家');
  const indices = src.getPageIndices();
  const copied = await out.copyPages(src, indices);
  copied.forEach(p => out.addPage(p));
  const data = await out.save({ useObjectStreams: true });
  const size = await writeBytes(outputPath, data);
  return { pages: out.getPageCount(), size, outputPath };
}

// ---------- 6. 加水印 ----------

/**
 * 加文字水印
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {object} opts
 *   - text: 水印文字（必填）
 *   - fontSize: 字号，默认 60
 *   - opacity: 不透明度 0-1，默认 0.15
 *   - color: 颜色 [r,g,b] 0-1，默认 [0,0,0]
 *   - rotation: 旋转角度，默认 -45
 *   - density: 密度 'low' | 'medium' | 'high'，默认 'medium'
 */
async function addWatermark(inputPath, outputPath, opts) {
  const {
    text = '',
    fontSize = 60,
    opacity = 0.15,
    color = [0, 0, 0],
    rotation = -45,
    density = 'medium'
  } = opts || {};
  if (!text) throw new Error('未填写水印文字');
  if (!fs.existsSync(inputPath)) throw new Error(`文件不存在: ${inputPath}`);
  const bytes = await readBytes(inputPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  // 按文字内容选字体：ASCII 用 HelveticaBold，含中文等非 ASCII 字符则嵌入系统 CJK 字体
  // 修复前固定用 HelveticaBold，中文水印会渲染成缺失字形（UI 占位符却写着"例: 机密"）
  const font = await embedFontForText(doc, text);
  const pages = doc.getPages();
  const colorRgb = rgb(color[0], color[1], color[2]);

  // 根据密度决定每页水印数量
  // low: 中心 1 个；medium: 中心 + 四角 5 个；high: 网格 9 个
  const positionsByDensity = {
    low: [{ x: 0.5, y: 0.5 }],
    medium: [
      { x: 0.25, y: 0.7 },
      { x: 0.75, y: 0.5 },
      { x: 0.25, y: 0.3 },
      { x: 0.75, y: 0.85 },
      { x: 0.5, y: 0.15 }
    ],
    high: [
      { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 },
      { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.2 }
    ]
  };
  const positions = positionsByDensity[density] || positionsByDensity.medium;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    for (const pos of positions) {
      const cx = width * pos.x;
      const cy = height * pos.y;
      // 中心定位
      const x = cx - textWidth / 2;
      const y = cy - fontSize / 2;
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: colorRgb,
        opacity,
        rotate: degrees(rotation)
      });
    }
  }
  const out = await doc.save({ useObjectStreams: true });
  const size = await writeBytes(outputPath, out);
  return { pages: pages.length, size, outputPath };
}

// ---------- 7. 图片转 PDF ----------

/**
 * 多张图片合成 PDF
 * @param {string[]} imagePaths JPG/PNG 路径数组
 * @param {string} outputPath
 * @param {object} opts
 *   - pageSize: 'A4' | 'fit' (适应图片) | 'letter'
 *   - margin: 页边距（pt），默认 0
 *   - orientation: 'auto' | 'landscape' | 'portrait'
 */
async function imagesToPDF(imagePaths, outputPath, opts) {
  const {
    pageSize = 'A4',
    margin = 0,
    orientation = 'auto'
  } = opts || {};
  if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
    throw new Error('未选择任何图片');
  }
  const doc = await PDFDocument.create();
  doc.setTitle('由 PDF管家 生成');
  doc.setCreator('PDF管家');
  doc.setProducer('PDF管家');

  // A4 = 595 x 842 pt, Letter = 612 x 792 pt
  const PAGE_SIZES = {
    A4: { w: 595.28, h: 841.89 },
    letter: { w: 612, h: 792 }
  };

  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) throw new Error(`图片不存在: ${imgPath}`);
    const ext = path.extname(imgPath).toLowerCase();
    let img;
    if (ext === '.jpg' || ext === '.jpeg') {
      img = await doc.embedJpg(await readBytes(imgPath));
    } else if (ext === '.png') {
      img = await doc.embedPng(await readBytes(imgPath));
    } else {
      throw new Error(`不支持的图片格式: ${ext}（仅支持 JPG/PNG）`);
    }
    const imgW = img.width;
    const imgH = img.height;
    const isLandscape = imgW > imgH;

    let pageW, pageH;
    if (pageSize === 'fit') {
      // 适应图片大小 + margin
      pageW = imgW + margin * 2;
      pageH = imgH + margin * 2;
    } else {
      const sz = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;
      let landscape = isLandscape;
      if (orientation === 'landscape') landscape = true;
      else if (orientation === 'portrait') landscape = false;
      if (landscape) {
        pageW = sz.h;
        pageH = sz.w;
      } else {
        pageW = sz.w;
        pageH = sz.h;
      }
    }
    const page = doc.addPage([pageW, pageH]);

    // 等比缩放图片填入可用区域（保留边距）
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    page.drawImage(img, { x, y, width: drawW, height: drawH });
  }

  const out = await doc.save({ useObjectStreams: true });
  const size = await writeBytes(outputPath, out);
  return { pages: imagePaths.length, size, outputPath };
}

// ---------- 工具：格式化字节 ----------
function formatSize(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes)) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// ---------- 导出 ----------
module.exports = {
  // 操作函数
  mergePDFs,
  splitPDF,
  compressPDF,
  encryptPDF,
  decryptPDF,
  addWatermark,
  imagesToPDF,
  // 工具
  parsePageRanges,
  formatSize,
  readBytes,
  writeBytes,
  // CJK 字体支持（水印中文修复）
  hasNonAscii,
  embedFontForText
};
