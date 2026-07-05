// 调色板导出模块 - 纯函数,可被 Node 测试
// 支持: CSS 变量 / GPL (GIMP) / ASE (Adobe Swatch Exchange 二进制)
// 设计师与前端可拿到色卡直接用于 PS / Figma / GIMP / Web 项目

'use strict';

const colorUtils = require('./color-utils');

/** 把 hex 转为安全的变量名片段 */
function varName(hex, index) {
  const clean = String(hex || '').replace('#', '').toLowerCase();
  return `color-${index + 1}-${clean}`;
}

/**
 * 导出为 CSS 自定义属性（CSS Variables）
 * 示例: :root { --color-1-007aff: #007aff; }
 */
function exportCSS(palette) {
  if (!palette || !Array.isArray(palette.colors)) return ':root {}';
  const lines = ['/* 调色板: ' + (palette.name || '未命名') + ' */', ':root {'];
  palette.colors.forEach((hex, i) => {
    lines.push(`  --${varName(hex, i)}: ${hex};`);
  });
  lines.push('}');
  return lines.join('\n');
}

/**
 * 导出为 SCSS 变量（一行一变量，便于 @import）
 */
function exportSCSS(palette) {
  if (!palette || !Array.isArray(palette.colors)) return '';
  const lines = [`// 调色板: ${palette.name || '未命名'}`];
  palette.colors.forEach((hex, i) => {
    lines.push(`$${varName(hex, i)}: ${hex};`);
  });
  return lines.join('\n');
}

/**
 * 导出为 JSON 数组（前端 / Node 通用）
 */
function exportJSON(palette) {
  if (!palette || !Array.isArray(palette.colors)) return '[]';
  const obj = {
    name: palette.name || '未命名',
    exportedAt: new Date().toISOString(),
    colors: palette.colors.map((hex, i) => {
      const rgb = colorUtils.hexToRgb(hex);
      const hsl = rgb ? colorUtils.rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
      return {
        name: `color-${i + 1}`,
        hex: hex.toLowerCase(),
        rgb: rgb,
        hsl: hsl,
      };
    }),
  };
  return JSON.stringify(obj, null, 2);
}

/**
 * 导出为 GPL (GIMP Palette) 文本格式
 * 兼容 GIMP / Inkscape / Krita
 */
function exportGPL(palette) {
  if (!palette || !Array.isArray(palette.colors)) return 'GIMP Palette\n';
  const lines = [
    'GIMP Palette',
    `Name: ${palette.name || '未命名'}`,
    'Columns: 6',
    '# 由拾色管家导出',
    '',
  ];
  palette.colors.forEach((hex) => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return;
    const r = String(rgb.r).padStart(3, ' ');
    const g = String(rgb.g).padStart(3, ' ');
    const b = String(rgb.b).padStart(3, ' ');
    lines.push(`${r} ${g} ${b}\t${hex.toUpperCase()}`);
  });
  return lines.join('\n');
}

/**
 * 导出为 ASE (Adobe Swatch Exchange) 二进制格式
 * 可导入 Photoshop / Illustrator / Figma(经插件)
 * 返回 Buffer
 */
function exportASE(palette) {
  const colors = (palette && Array.isArray(palette.colors) ? palette.colors : [])
    .map((hex) => ({ hex, rgb: colorUtils.hexToRgb(hex) }))
    .filter((c) => c.rgb);

  const blocks = [];

  colors.forEach((c) => {
    // 颜色名用 hex 大写（避免重名歧义）
    const name = c.hex.toUpperCase();
    // 名称缓冲: UTF-16BE 编码 + 2 字节 null 终止符
    const nameBuf = Buffer.alloc((name.length + 1) * 2, 0);
    for (let j = 0; j < name.length; j++) {
      nameBuf.writeUInt16BE(name.charCodeAt(j), j * 2);
    }
    // 名称长度（含 null 终止符，单位为 UTF-16 码元数）
    const nameLenBuf = Buffer.alloc(2);
    nameLenBuf.writeUInt16BE(name.length + 1, 0);
    // 颜色模型: "RGB "
    const modelBuf = Buffer.from('RGB ', 'ascii');
    // 颜色值: 3 个 0-1 浮点（大端）
    const colorBuf = Buffer.alloc(12);
    colorBuf.writeFloatBE(c.rgb.r / 255, 0);
    colorBuf.writeFloatBE(c.rgb.g / 255, 4);
    colorBuf.writeFloatBE(c.rgb.b / 255, 8);
    // 颜色类型: 2 = normal
    const typeBuf = Buffer.alloc(2);
    typeBuf.writeUInt16BE(2, 0);

    const blockData = Buffer.concat([nameLenBuf, nameBuf, modelBuf, colorBuf, typeBuf]);

    const blockTypeBuf = Buffer.alloc(2);
    blockTypeBuf.writeUInt16BE(1, 0); // 1 = color entry
    const blockLenBuf = Buffer.alloc(4);
    blockLenBuf.writeInt32BE(blockData.length, 0);

    blocks.push(Buffer.concat([blockTypeBuf, blockLenBuf, blockData]));
  });

  // 文件头: "ASEF" + 版本 1.0 + 块数
  const header = Buffer.alloc(12);
  header.write('ASEF', 0, 'ascii');
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(0, 6);
  header.writeInt32BE(colors.length, 8);

  return Buffer.concat([header, ...blocks]);
}

/** 各格式的保存对话框过滤器 */
const FILTERS = {
  css: [{ name: 'CSS 文件', extensions: ['css'] }],
  scss: [{ name: 'SCSS 文件', extensions: ['scss'] }],
  json: [{ name: 'JSON 文件', extensions: ['json'] }],
  gpl: [{ name: 'GIMP 调色板', extensions: ['gpl'] }],
  ase: [{ name: 'Adobe 色板', extensions: ['ase'] }],
};

/** 各格式对应的文件扩展名 */
const EXT = {
  css: 'css',
  scss: 'scss',
  json: 'json',
  gpl: 'gpl',
  ase: 'ase',
};

/**
 * 按格式导出，统一返回 { content, ext, filters }
 * content 可能是 string 或 Buffer
 */
function exportByFormat(palette, format) {
  switch (format) {
    case 'css': return { content: exportCSS(palette), ext: EXT.css, filters: FILTERS.css };
    case 'scss': return { content: exportSCSS(palette), ext: EXT.scss, filters: FILTERS.scss };
    case 'json': return { content: exportJSON(palette), ext: EXT.json, filters: FILTERS.json };
    case 'gpl': return { content: exportGPL(palette), ext: EXT.gpl, filters: FILTERS.gpl };
    case 'ase': return { content: exportASE(palette), ext: EXT.ase, filters: FILTERS.ase };
    default: throw new Error(`不支持的导出格式: ${format}`);
  }
}

module.exports = {
  varName,
  exportCSS,
  exportSCSS,
  exportJSON,
  exportGPL,
  exportASE,
  exportByFormat,
  FILTERS,
  EXT,
};
