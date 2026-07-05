// src/core/ruler-core.js — 几何计算 + 像素采样 + HiDPI/多屏辅助（纯函数，可独立测试）
// UMD 包装：既能被 Node require，也能在浏览器里 <script> 引入挂到 window.RulerCore

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RulerCore = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // 两点距离
  function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 矩形宽高（从两点）
  function rectSize(a, b) {
    return {
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y)
    };
  }

  // 直线角度（度，0-360，以正东为 0，顺时针）
  function angle(a, b) {
    const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    return (deg + 360) % 360;
  }

  // 颜色值转 HEX
  function rgbToHex(r, g, b) {
    const h = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  // RGB → HSL
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = 0; s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  // 从 ImageData.data 取指定像素的 RGBA（越界自动钳制到边界）
  function pixelAt(imageData, x, y) {
    x = Math.max(0, Math.min(imageData.width - 1, Math.floor(x)));
    y = Math.max(0, Math.min(imageData.height - 1, Math.floor(y)));
    const i = (y * imageData.width + x) * 4;
    return {
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
      a: imageData.data[i + 3]
    };
  }

  // 格式化测量结果
  function formatMeasure(mode, start, end) {
    if (mode === 'rect') {
      const { width, height } = rectSize(start, end);
      return {
        mode, width: Math.round(width), height: Math.round(height),
        area: Math.round(width * height),
        label: `${Math.round(width)} × ${Math.round(height)} px`,
        detail: `宽 ${Math.round(width)} px · 高 ${Math.round(height)} px · 面积 ${Math.round(width * height)} px²`
      };
    }
    if (mode === 'line') {
      const d = distance(start, end);
      const ang = angle(start, end);
      return {
        mode, distance: Math.round(d), angle: Math.round(ang),
        label: `${Math.round(d)} px`,
        detail: `距离 ${Math.round(d)} px · 角度 ${Math.round(ang)}°`
      };
    }
    return null;
  }

  // ============ HiDPI 辅助 ============
  // 把逻辑像素换算成物理像素，避免高 DPI 屏截图模糊
  // scaleFactor 缺省为 1（兼容老逻辑）
  function physicalPixels(logicalW, logicalH, scaleFactor) {
    const sf = scaleFactor || 1;
    return {
      width: Math.max(1, Math.round(logicalW * sf)),
      height: Math.max(1, Math.round(logicalH * sf))
    };
  }

  // ============ 多屏匹配辅助 ============
  // 严格按 display.id 字符串匹配桌面源；找不到返回 null（让调用方决定如何报错）
  // 比之前"取 sources[0] 兜底"更可靠：多屏环境下不会拿错屏
  function matchDisplaySource(sources, displayId) {
    if (!Array.isArray(sources) || sources.length === 0) return null;
    const id = String(displayId);
    return sources.find(s => s && s.display_id === id) || null;
  }

  return {
    distance, rectSize, angle, rgbToHex, rgbToHsl, pixelAt, formatMeasure,
    physicalPixels, matchDisplaySource
  };
}));
