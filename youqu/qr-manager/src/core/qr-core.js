// src/core/qr-core.js — 二维码生成与识别核心逻辑（纯函数，不依赖 Electron，便于测试）
// 生成：基于 qrcode 库；识别：基于 jsQR + pngjs
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

/**
 * 生成二维码 DataURL
 * @param {string} text 二维码内容
 * @param {object} opts 选项
 *   - errorCorrectionLevel: 'L'|'M'|'Q'|'H'，默认 M
 *   - margin: 边距（模块数），默认 4
 *   - width: 像素宽度，默认 480
 *   - dark: 暗色模块颜色（hex），默认 #000000
 *   - light: 亮色模块颜色（hex），默认 #ffffff（传 'transparent' 可透明）
 * @returns {Promise<{dataURL: string, width: number}>}
 */
async function generateDataURL(text, opts = {}) {
  if (!text || typeof text !== 'string') {
    const err = new Error('内容不能为空');
    err.code = 'EMPTY_TEXT';
    throw err;
  }
  const options = {
    errorCorrectionLevel: opts.errorCorrectionLevel || 'M',
    margin: typeof opts.margin === 'number' ? opts.margin : 4,
    width: opts.width || 480,
    color: {
      dark: opts.dark || '#000000',
      light: opts.light || '#ffffff'
    }
  };
  // 校验颜色格式（#RRGGBB 或 transparent）
  const colorRe = /^#([0-9a-fA-F]{6})$/;
  if (options.color.dark !== 'transparent' && !colorRe.test(options.color.dark)) {
    const err = new Error('暗色颜色格式应为 #RRGGBB'); err.code = 'BAD_COLOR'; throw err;
  }
  if (options.color.light !== 'transparent' && !colorRe.test(options.color.light)) {
    const err = new Error('亮色颜色格式应为 #RRGGBB'); err.code = 'BAD_COLOR'; throw err;
  }
  // 校验容错级别
  if (!['L', 'M', 'Q', 'H'].includes(options.errorCorrectionLevel)) {
    const err = new Error('容错级别应为 L/M/Q/H'); err.code = 'BAD_ECL'; throw err;
  }
  // qrcode 库在 transparent 时空字符串表示透明
  if (options.color.light === 'transparent') options.color.light = '#00000000';
  const dataURL = await QRCode.toDataURL(text, options);
  return { dataURL, width: options.width };
}

/**
 * 生成二维码 SVG 字符串
 * @returns {Promise<string>}
 */
async function generateSVG(text, opts = {}) {
  if (!text) { const e = new Error('内容不能为空'); e.code = 'EMPTY_TEXT'; throw e; }
  const options = {
    errorCorrectionLevel: opts.errorCorrectionLevel || 'M',
    margin: typeof opts.margin === 'number' ? opts.margin : 4,
    color: { dark: opts.dark || '#000000', light: opts.light || '#ffffff' }
  };
  return QRCode.toString(text, { type: 'svg', ...options });
}

/**
 * 从 PNG/JPEG 等图片 Buffer 解码二维码
 * 目前仅支持 PNG（pngjs）。JPEG 等需主进程用 nativeImage 转换后传入 RGBA。
 * @param {Buffer} pngBuffer PNG 图片 buffer
 * @returns {{data: string, location?: object}|null}
 */
function decodeFromPNGBuffer(pngBuffer) {
  if (!pngBuffer || !Buffer.isBuffer(pngBuffer)) {
    return null;
  }
  let png;
  try {
    png = PNG.sync.read(pngBuffer);
  } catch (e) {
    return null;
  }
  return decodeFromImageData(png.data, png.width, png.height);
}

/**
 * 从 ImageData（Uint8ClampedArray RGBA）解码二维码
 * @param {Uint8ClampedArray|Uint8Array} data RGBA 像素数据
 * @param {number} width
 * @param {number} height
 * @returns {{data: string, location?: object}|null}
 */
function decodeFromImageData(data, width, height) {
  if (!data || !width || !height) return null;
  const code = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  if (!code) return null;
  return { data: code.data, location: code.location };
}

module.exports = { generateDataURL, generateSVG, decodeFromPNGBuffer, decodeFromImageData };
