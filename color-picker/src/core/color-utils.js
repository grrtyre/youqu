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

/* ── 颜色名称识别 ── */

/**
 * 内置颜色字典：中文名 + hex
 * 涵盖常见色名，参考中国传统色 + 现代设计常用色
 * 每条 [hex, 中文名]
 */
const COLOR_DICTIONARY = [
  ['#ffffff', '纯白'],
  ['#f5f5f7', '苹果灰白'],
  ['#e8e8ed', '浅银灰'],
  ['#d1d1d6', '银灰'],
  ['#a8a8ad', '中灰'],
  ['#8e8e93', '系统灰'],
  ['#6e6e73', '深灰'],
  ['#3a3a3c', '炭灰'],
  ['#1d1d1f', '墨黑'],
  ['#000000', '纯黑'],

  ['#fff5f5', '樱粉白'],
  ['#ffe3e3', '浅珊瑚'],
  ['#ffd1d1', '薄红'],
  ['#ffcccb', '婴儿粉'],
  ['#ff7eb6', '蜜桃粉'],
  ['#ff5ba7', '玫红'],
  ['#ff375f', '玫粉'],
  ['#ff2d55', '苹果红'],
  ['#ff3b30', '系统红'],
  ['#d70015', '正红'],
  ['#c8232c', '胭脂红'],
  ['#a8201a', '酒红'],
  ['#8b0000', '暗红'],
  ['#5c0a0a', '枣红'],

  ['#fff8e1', '象牙白'],
  ['#ffecb3', '浅米黄'],
  ['#ffe4b5', '莫卡辛'],
  ['#ffd60a', '明黄'],
  ['#ffcc00', '金黄'],
  ['#ff9500', '苹果橙'],
  ['#ff8c00', '深橙'],
  ['#ff6b00', '南瓜橙'],
  ['#e8590c', '焦橙'],
  ['#c94f00', '砖橙'],

  ['#fff9c4', '柠檬白'],
  ['#fff59d', '浅黄'],
  ['#ffee58', '亮黄'],
  ['#ffeb3b', '正黄'],
  ['#fbc02d', '芥末黄'],
  ['#f9a825', '金黄'],
  ['#b8860b', '暗金'],

  ['#f0fff0', '薄荷白'],
  ['#c8e6c9', '浅绿'],
  ['#a5d6a7', '嫩绿'],
  ['#81c784', '春绿'],
  ['#66bb6a', '草绿'],
  ['#43a047', '正绿'],
  ['#2e7d32', '森林绿'],
  ['#1b5e20', '墨绿'],
  ['#34c759', '苹果绿'],
  ['#30b0c7', '青绿'],
  ['#00897b', '鸭青'],
  ['#00695c', '松绿'],

  ['#e0f7fa', '浅水蓝'],
  ['#b2ebf2', '冰蓝'],
  ['#80deea', '青蓝'],
  ['#4dd0e1', '湖蓝'],
  ['#00bcd4', '青色'],
  ['#00acc1', '深青'],
  ['#0097a7', '孔雀蓝'],
  ['#006064', '深海蓝'],

  ['#e3f2fd', '浅天蓝'],
  ['#bbdefb', '晨蓝'],
  ['#90caf9', '霜蓝'],
  ['#64b5f6', '天蓝'],
  ['#42a5f5', '亮蓝'],
  ['#2196f3', '材料蓝'],
  ['#1e88e5', '正蓝'],
  ['#1976d2', '强蓝'],
  ['#1565c0', '深蓝'],
  ['#0d47a1', '海军蓝'],
  ['#007aff', '苹果蓝'],
  ['#0a84ff', 'iOS 蓝'],

  ['#ede7f6', '浅紫白'],
  ['#d1c4e9', '薰衣草'],
  ['#b39ddb', '浅紫'],
  ['#9575cd', '中紫'],
  ['#7e57c2', '葡萄紫'],
  ['#673ab7', '深紫'],
  ['#5e35b1', '深紫罗兰'],
  ['#4527a0', '暗紫'],
  ['#af52de', '苹果紫'],
  ['#bf5af2', '亮紫'],

  ['#fbe9e7', '浅粉橙'],
  ['#ffccbc', '浅鲑鱼'],
  ['#ffab91', '鲑鱼粉'],
  ['#ff8a65', '深鲑鱼'],
  ['#ff7043', '橙红'],
  ['#f4511e', '番茄红'],

  ['#fce4ec', '浅粉白'],
  ['#f8bbd0', '樱粉'],
  ['#f48fb1', '浅玫粉'],
  ['#ec407a', '玫粉'],
  ['#d81b60', '深玫红'],
  ['#ad1457', '暗玫红'],
  ['#880e4f', '酒紫红'],

  ['#efebe9', '米白'],
  ['#d7ccc8', '浅棕'],
  ['#bcaaa4', '灰棕'],
  ['#a1887f', '咖啡'],
  ['#8d6e63', '驼色'],
  ['#6d4c41', '棕色'],
  ['#4e342e', '深棕'],
  ['#3e2723', '巧克力'],

  ['#efe5b8', '米色'],
  ['#e6c200', '麦穗黄'],
  ['#a67c00', '橄榄'],
  ['#735400', '深橄榄'],
  ['#585800', '橄榄绿'],

  ['#80c0ff', '天空蓝'],
  ['#aedff0', '婴儿蓝'],
  ['#c2d3e6', '雾蓝'],
  ['#a9b7d6', '钢蓝'],
  ['#7d8ba6', '灰蓝'],
  ['#4b6584', '岩灰蓝'],

  ['#ddbbdd', '丁香紫'],
  ['#aa88aa', '紫罗兰'],
  ['#885588', '深紫罗兰'],
  ['#553355', '暗梅'],

  ['#d0e8a0', '黄绿'],
  ['#9ab040', '橄榄黄绿'],
  ['#6b8e23', '橄榄褐'],

  ['#cd853f', '秘鲁色'],
  ['#daa520', '金菊黄'],
  ['#b8860b', '暗金菊'],
  ['#bdb76b', '卡其'],

  ['#1abc9c', '绿松石'],
  ['#16a085', '深绿松石'],
  ['#008b8b', '暗青'],

  ['#ff69b4', '热粉'],
  ['#ff1493', '深粉'],
  ['#c71585', '中紫红'],

  ['#4b0082', '靛蓝'],
  ['#483d8b', '暗靛'],
  ['#6a5acd', '板岩蓝'],
];

/**
 * RGB → XYZ（D65 标准白光）
 * 用于进一步转换到 Lab 颜色空间
 */
function rgbToXyz(r, g, b) {
  const toLinear = (c) => {
    const s = clamp(c, 0, 255) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  // sRGB → XYZ（D65）矩阵
  return {
    x: R * 0.4124564 + G * 0.3575761 + B * 0.1804375,
    y: R * 0.2126729 + G * 0.7151522 + B * 0.0721750,
    z: R * 0.0193339 + G * 0.1191920 + B * 0.9503041,
  };
}

/**
 * XYZ → Lab（D65 白点）
 * Lab 颜色空间更接近人眼感知，用于颜色名称最近邻匹配
 */
function xyzToLab(x, y, z) {
  // D65 参考白点
  const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116));
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** RGB → Lab */
function rgbToLab(r, g, b) {
  const xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

/** 两个 Lab 颜色之间的感知距离（CIE76 ΔE） */
function labDistance(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// 预计算字典的 Lab 值（性能优化）
const _DICT_LAB = COLOR_DICTIONARY.map(([hex, name]) => {
  const rgb = hexToRgb(hex);
  return { hex, name, lab: rgbToLab(rgb.r, rgb.g, rgb.b) };
});

/**
 * 识别 RGB 颜色的中文名称（基于 Lab 空间最近邻匹配）
 * @param {{r,g,b}|{r,g,b,hex}} rgb
 * @returns {{name, hex, distance}} 最近的颜色名 + 字典 hex + 距离（0 表示完全匹配）
 */
function nameColor(rgb) {
  if (!rgb || typeof rgb.r !== 'number') return { name: '未知颜色', hex: '#000000', distance: Infinity };
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  let best = _DICT_LAB[0];
  let bestDist = Infinity;
  for (let i = 0; i < _DICT_LAB.length; i++) {
    const d = labDistance(lab, _DICT_LAB[i].lab);
    if (d < bestDist) {
      bestDist = d;
      best = _DICT_LAB[i];
    }
  }
  return { name: best.name, hex: best.hex, distance: bestDist };
}

/* ── 配色推荐（色彩和谐方案） ── */

/**
 * 基于当前 RGB 生成配色和谐方案。
 * 通过 HSL 色相旋转实现：
 *  - 互补色（180°）
 *  - 类似色（±30°）
 *  - 三元色（±120°）
 *  - 四元色（90°, 180°, 270°）
 *  - 分裂互补（150°, 210°）
 * @param {{r,g,b}} rgb
 * @returns {{
 *   complementary: {hex, r,g,b},
 *   analogous: [{hex,r,g,b}, {hex,r,g,b}],
 *   triadic: [{hex,r,g,b}, {hex,r,g,b}],
 *   tetradic: [{hex,r,g,b}*3],
 *   splitComplementary: [{hex,r,g,b}*2]
 * }}
 */
function harmonies(rgb) {
  if (!rgb || typeof rgb.r !== 'number') {
    return { complementary: null, analogous: [], triadic: [], tetradic: [], splitComplementary: [] };
  }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // 色相旋转并保持原饱和度与亮度，返回 RGB+HEX
  const rotate = (deg) => {
    const newH = ((hsl.h + deg) % 360 + 360) % 360;
    const c = hslToRgb(newH, hsl.s, hsl.l);
    return { r: c.r, g: c.g, b: c.b, hex: rgbToHex(c.r, c.g, c.b) };
  };

  return {
    complementary: rotate(180),
    analogous: [rotate(-30), rotate(30)],
    triadic: [rotate(120), rotate(240)],
    tetradic: [rotate(90), rotate(180), rotate(270)],
    splitComplementary: [rotate(150), rotate(210)],
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
  // 新增：颜色识别与配色推荐
  rgbToLab,
  labDistance,
  nameColor,
  harmonies,
  COLOR_DICTIONARY,
};
