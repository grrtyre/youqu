// 颜色转换与采样工具函数（纯逻辑，可被 Node 测试）
// 苹果白风格调色板默认色：#007AFF

'use strict';

/** 限制数值到 [min, max] */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** #RRGGBB / #RGB → { r, g, b }，解析失败返回 null */
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** { r, g, b } → #RRGGBB（小写） */
function rgbToHex(r, g, b) {
  const to2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** { r, g, b } → { h, s, l }，h ∈ [0,360), s/l ∈ [0,100] */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** { h, s, l } → { r, g, b } */
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** 计算两个 RGB 颜色的欧氏距离，0 表示完全相同 */
function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 从 ImageData / RGBA 像素缓冲指定坐标采样一个像素。
 * @param {Uint8ClampedArray|number[]} data RGBA 数据
 * @param {number} width 图像宽度
 * @param {number} x 横坐标
 * @param {number} y 纵坐标
 * @returns {{r,g,b}|null}
 */
function samplePixel(data, width, x, y) {
  if (!data || width <= 0) return null;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const idx = (yi * width + xi) * 4;
  if (idx < 0 || idx + 2 >= data.length) return null;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

/**
 * 给定一个 RGB 颜色，返回在白底/黑底上的最佳前景色（黑或白）。
 * 使用 W3C 感知亮度公式。
 */
function bestForeground(r, g, b) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1d1d1f' : '#ffffff';
}

/** 生成颜色的所有格式字符串 */
function formatColor(rgb) {
  const { r, g, b } = rgb;
  const hsl = rgbToHsl(r, g, b);
  return {
    hex: rgbToHex(r, g, b),
    hexUpper: rgbToHex(r, g, b).toUpperCase(),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    rgbObj: { r, g, b },
    hslObj: hsl,
  };
}

/* ── WCAG 2.1 对比度 ── */

/**
 * WCAG 相对亮度（relative luminance）
 * 见 https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * 返回 0-1
 */
function relativeLuminance(r, g, b) {
  const toLinear = (c) => {
    const s = clamp(c, 0, 255) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * 两个颜色之间的对比度比值，范围 1 ~ 21
 * 公式: (L1 + 0.05) / (L2 + 0.05)，L1 为较亮者
 */
function contrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 给定对比度比值，返回 WCAG 2.1 等级评估
 * AA 普通文本 ≥ 4.5 / AA 大字 ≥ 3 / AAA 普通文本 ≥ 7 / AAA 大字 ≥ 4.5
 */
function wcagGrade(ratio) {
  const r = Math.max(0, Number(ratio) || 0);
  return {
    ratio: Math.round(r * 100) / 100,
    aaNormal: r >= 4.5,
    aaLarge: r >= 3,
    aaaNormal: r >= 7,
    aaaLarge: r >= 4.5,
  };
}

module.exports = {
  clamp,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  colorDistance,
  samplePixel,
  bestForeground,
  formatColor,
  relativeLuminance,
  contrastRatio,
  wcagGrade,
};
