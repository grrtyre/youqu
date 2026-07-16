// color-theory.js
// 调色板核心色彩理论计算模块
// 既可在浏览器中作为渲染器逻辑使用，也可在 Node.js 中通过 require 引入做单元测试

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ColorTheory = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 颜色空间转换 ----------
  // HEX <-> RGB <-> HSL，全部为纯函数

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '');
    if (h.length === 3) {
      h = h.split('').map((c) => c + c).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const toStr = (v) => clamp(v).toString(16).padStart(2, '0');
    return '#' + toStr(r) + toStr(g) + toStr(b);
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  }

  function hslToHex(h, s, l) {
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  // 依据 HSL 计算相对亮度（用于 WCAG 对比度）
  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const channel = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  // WCAG 对比度比，返回 1~21
  function contrastRatio(hex1, hex2) {
    const l1 = relativeLuminance(hex1);
    const l2 = relativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // 判断文字应该用深色还是浅色，以保证可读
  function readableTextColor(hex) {
    return relativeLuminance(hex) > 0.4 ? '#1d1d1f' : '#ffffff';
  }

  // ---------- 色彩理论模式 ----------
  // 基于一个基础色相，生成不同和谐关系
  const MODES = {
    analogous: { steps: 5, label: '类比色' },
    monochromatic: { steps: 5, label: '同色系' },
    triadic: { steps: 3, label: '三元色' },
    complementary: { steps: 2, label: '互补色' },
    splitComplementary: { steps: 3, label: '分裂互补' },
    tetradic: { steps: 4, label: '四元色' },
  };

  // 根据模式和基础色相生成色相序列
  function hueOffsetsForMode(mode) {
    switch (mode) {
      case 'analogous': return [-40, -20, 0, 20, 40];
      case 'monochromatic': return [0, 0, 0, 0, 0];
      case 'triadic': return [0, 120, 240];
      case 'complementary': return [0, 180];
      case 'splitComplementary': return [0, 150, 210];
      case 'tetradic': return [0, 90, 180, 270];
      default: return [0, 0, 0, 0, 0];
    }
  }

  // 单色系模式：基础色相不变，调整亮度
  function generateMonochromatic(baseHsl) {
    const lightnesses = [20, 40, 55, 70, 88];
    return lightnesses.map((l) => ({
      h: baseHsl.h,
      s: baseHsl.s,
      l,
    }));
  }

  // 由基础色和模式生成完整调色板 HSL 数组
  function generatePalette(baseHex, mode) {
    const base = hexToHsl(baseHex) || { h: 210, s: 60, l: 55 };
    if (mode === 'monochromatic') {
      return generateMonochromatic(base);
    }
    const offsets = hueOffsetsForMode(mode);
    return offsets.map((offset) => ({
      h: base.h + offset,
      s: base.s,
      l: base.l,
    }));
  }

  // 生成一个视觉上和谐的随机基础色（限制饱和度与亮度区间，避免刺眼）
  function randomBaseHex() {
    const h = Math.floor(Math.random() * 360);
    const s = 55 + Math.floor(Math.random() * 30); // 55~85
    const l = 45 + Math.floor(Math.random() * 20); // 45~65
    return hslToHex(h, s, l);
  }

  // 根据锁定位重新生成调色板：锁定项保持，其余项随机重算
  function regenerateWithLocks(currentHexes, locks, mode) {
    // 若全部锁定则直接返回
    if (locks.every(Boolean)) return currentHexes.slice();
    const baseHex = currentHexes.find((c, i) => locks[i]) || currentHexes[0] || randomBaseHex();
    const palette = generatePalette(baseHex, mode);
    return currentHexes.map((hex, i) => (locks[i] ? hex : hslToHex(palette[i % palette.length].h, palette[i % palette.length].s, palette[i % palette.length].l)));
  }

  // ---------- 图片取色（K-means 简化：像素采样 + 量化） ----------
  // imageData: { data: [r,g,b,a,...], width, height }
  function extractPaletteFromImageData(imageData, k) {
    k = k || 5;
    const samples = [];
    const data = imageData.data;
    const step = Math.max(1, Math.floor(data.length / 4 / 5000)); // 控制采样数量，提高性能
    for (let i = 0; i < data.length; i += 4 * step) {
      const a = data[i + 3];
      if (a < 125) continue; // 跳过过于透明的像素
      samples.push([data[i], data[i + 1], data[i + 2]]);
    }
    if (samples.length === 0) return [];
    // 简化 K-means 聚类
    const centroids = samples
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, k)
      .map((c) => c.slice());
    for (let iter = 0; iter < 8; iter++) {
      const buckets = centroids.map(() => []);
      for (const s of samples) {
        let best = 0;
        let bestDist = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const dr = s[0] - centroids[c][0];
          const dg = s[1] - centroids[c][1];
          const db = s[2] - centroids[c][2];
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) { bestDist = dist; best = c; }
        }
        buckets[best].push(s);
      }
      for (let c = 0; c < centroids.length; c++) {
        if (buckets[c].length === 0) continue;
        const sum = buckets[c].reduce((acc, s) => [acc[0] + s[0], acc[1] + s[1], acc[2] + s[2]], [0, 0, 0]);
        centroids[c] = sum.map((v) => v / buckets[c].length);
      }
    }
    // 按亮度排序，便于呈现为渐变调色板
    const hexes = centroids.map((c) => rgbToHex(c[0], c[1], c[2]));
    return sortByLightness(hexes);
  }

  // 按亮度排序
  function sortByLightness(hexes) {
    return hexes.slice().sort((a, b) => {
      const la = hexToHsl(a).l;
      const lb = hexToHsl(b).l;
      return lb - la;
    });
  }

  // ---------- 导出 ----------
  return {
    MODES,
    hexToRgb,
    rgbToHex,
    rgbToHsl,
    hslToRgb,
    hexToHsl,
    hslToHex,
    relativeLuminance,
    contrastRatio,
    readableTextColor,
    hueOffsetsForMode,
    generateMonochromatic,
    generatePalette,
    randomBaseHex,
    regenerateWithLocks,
    extractPaletteFromImageData,
    sortByLightness,
  };
});
