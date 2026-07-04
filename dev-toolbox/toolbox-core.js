/**
 * youqu/dev-toolbox 核心逻辑
 * 纯前端开发者工具箱，零依赖原生 JS
 */

(function () {
  'use strict';

  // ==================== 颜色转换 ====================

  /**
   * 颜色格式转换
   * @param {string} hex - 支持 #fff / #ffffff / rgba(r,g,b,a) 格式，含透明度
   * @returns {{hex:string, rgb:{r:number,g:number,b:number,a:number}, hsl:{h:number,s:number,l:number}, cssRgba:string}}
   */
  function colorConvert(hex) {
    var r = 0, g = 0, b = 0, a = 1;
    var input = String(hex).trim();

    // 解析 rgba(...) 格式
    var rgbaMatch = input.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+))?\s*\)$/i
    );
    if (rgbaMatch) {
      r = clamp(parseInt(rgbaMatch[1], 10));
      g = clamp(parseInt(rgbaMatch[2], 10));
      b = clamp(parseInt(rgbaMatch[3], 10));
      a = rgbaMatch[4] != null ? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) : 1;
    } else {
      // 去掉前缀 #
      var hexStr = input.replace(/^#/, '');
      // 3位简写 -> 展开为6位
      if (hexStr.length === 3) {
        hexStr = hexStr[0] + hexStr[0] + hexStr[1] + hexStr[1] + hexStr[2] + hexStr[2];
      }
      // 8位含透明度
      if (hexStr.length === 8) {
        a = parseInt(hexStr.substring(6, 8), 16) / 255;
        hexStr = hexStr.substring(0, 6);
      }
      if (hexStr.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hexStr)) {
        throw new Error('不支持的颜色格式: ' + input);
      }
      r = parseInt(hexStr.substring(0, 2), 16);
      g = parseInt(hexStr.substring(2, 4), 16);
      b = parseInt(hexStr.substring(4, 6), 16);
    }

    var rgb = { r: r, g: g, b: b, a: a };

    // RGB 转 HSL
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn);
    var min = Math.min(rn, gn, bn);
    var h = 0, s = 0;
    var l = (max + min) / 2;

    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
        case gn: h = ((bn - rn) / d + 2) / 6; break;
        case bn: h = ((rn - gn) / d + 4) / 6; break;
      }
    }

    var hsl = {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };

    // 十六进制输出（含透明度时带8位）
    var hexOut = '#' +
      padHex(r) + padHex(g) + padHex(b) +
      (a < 1 ? padHex(Math.round(a * 255)) : '');

    // CSS rgba 字符串
    var cssRgba = a < 1
      ? 'rgba(' + r + ', ' + g + ', ' + b + ', ' + round4(a) + ')'
      : 'rgb(' + r + ', ' + g + ', ' + b + ')';

    return { hex: hexOut, rgb: rgb, hsl: hsl, cssRgba: cssRgba };
  }

  /** 值限制在 0-255 */
  function clamp(v) { return Math.max(0, Math.min(255, v)); }

  /** 数字补零为两位十六进制 */
  function padHex(n) { var s = n.toString(16); return s.length === 1 ? '0' + s : s; }

  /** 保留4位小数 */
  function round4(n) { return Math.round(n * 10000) / 10000; }

  // ==================== JSON 格式化 ====================

  /**
   * JSON 美化或压缩
   * @param {string} str - JSON 字符串
   * @param {number} [indent=2] - 缩进空格数，0 表示压缩
   * @returns {{ok:boolean, result:string, error:string}}
   */
  function jsonFormat(str, indent) {
    if (indent == null) indent = 2;
    try {
      var obj = JSON.parse(str);
      if (indent === 0) {
        return { ok: true, result: JSON.stringify(obj), error: '' };
      }
      return { ok: true, result: JSON.stringify(obj, null, indent), error: '' };
    } catch (e) {
      return { ok: false, result: '', error: 'JSON 解析失败: ' + e.message };
    }
  }

  // ==================== 时间戳转换 ====================

  /**
   * 时间戳与日期互转
   * @param {string|number} input - Unix 秒戳 / 毫秒戳 / 日期字符串 / 'now'
   * @returns {{unix:number, ms:number, date:string, iso:string, local:string, relative:string}}
   */
  function timestampConvert(input) {
    var ts;
    var now = Date.now();
    var s = String(input).trim();

    if (s === 'now') {
      ts = now;
    } else if (/^\d+$/.test(s)) {
      var num = parseInt(s, 10);
      // 大于 1e12 视为毫秒，否则视为秒
      ts = num > 1e12 ? num : num * 1000;
    } else {
      var parsed = Date.parse(s);
      if (isNaN(parsed)) throw new Error('无法识别的日期格式: ' + s);
      ts = parsed;
    }

    var d = new Date(ts);
    var diff = now - ts;
    var absDiff = Math.abs(diff);
    var relative;
    if (absDiff < 60000) relative = '刚刚';
    else if (absDiff < 3600000) relative = Math.floor(absDiff / 60000) + '分钟' + (diff > 0 ? '前' : '后');
    else if (absDiff < 86400000) relative = Math.floor(absDiff / 3600000) + '小时' + (diff > 0 ? '前' : '后');
    else if (absDiff < 2592000000) relative = Math.floor(absDiff / 86400000) + '天' + (diff > 0 ? '前' : '后');
    else if (absDiff < 31536000000) relative = Math.floor(absDiff / 2592000000) + '个月' + (diff > 0 ? '前' : '后');
    else relative = Math.floor(absDiff / 31536000000) + '年' + (diff > 0 ? '前' : '后');

    return {
      unix: Math.floor(ts / 1000),
      ms: ts,
      date: d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
        ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()),
      iso: d.toISOString(),
      local: d.toLocaleString('zh-CN'),
      relative: relative
    };
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // ==================== 正则测试 ====================

  /**
   * 正则匹配测试
   * @param {string} pattern - 正则表达式字符串
   * @param {string} flags - 正则标志 如 'gi'
   * @param {string} text - 待匹配文本
   * @returns {{ok:boolean, matches:Array<{match:string, index:number, groups:string[]}>, error:string}}
   */
  function regexTest(pattern, flags, text) {
    try {
      var re = new RegExp(pattern, flags || '');
      var matches = [];
      var m;
      // 非全局模式只匹配一次
      if (flags && flags.indexOf('g') !== -1) {
        while ((m = re.exec(text)) !== null) {
          matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
          // 防止零宽匹配死循环
          if (m[0].length === 0) re.lastIndex++;
        }
      } else {
        m = re.exec(text);
        if (m) {
          matches.push({ match: m[0], index: m.index, groups: m.slice(1) });
        }
      }
      return { ok: true, matches: matches, error: '' };
    } catch (e) {
      return { ok: false, matches: [], error: '正则表达式错误: ' + e.message };
    }
  }

  // ==================== 文本 Diff ====================

  /**
   * 逐行文本差异比较（LCS 动态规划）
   * @param {string} a - 原始文本
   * @param {string} b - 对比文本
   * @returns {{same:string[], added:string[], removed:string[], changes:number}}
   */
  function textDiff(a, b) {
    var linesA = a.split('\n');
    var linesB = b.split('\n');
    var m = linesA.length;
    var n = linesB.length;

    // 构建 LCS 长度表
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = [];
      for (var j = 0; j <= n; j++) {
        if (i === 0 || j === 0) {
          dp[i][j] = 0;
        } else if (linesA[i - 1] === linesB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // 回溯构建 diff
    var same = [];
    var added = [];
    var removed = [];
    var idxA = m, idxB = n;

    while (idxA > 0 || idxB > 0) {
      if (idxA > 0 && idxB > 0 && linesA[idxA - 1] === linesB[idxB - 1]) {
        same.unshift(linesA[idxA - 1]);
        idxA--;
        idxB--;
      } else if (idxB > 0 && (idxA === 0 || dp[idxA][idxB - 1] >= dp[idxA - 1][idxB])) {
        added.unshift(linesB[idxB - 1]);
        idxB--;
      } else {
        removed.unshift(linesA[idxA - 1]);
        idxA--;
      }
    }

    return {
      same: same,
      added: added,
      removed: removed,
      changes: added.length + removed.length
    };
  }

  // ==================== Base64 编解码 ====================

  /**
   * Base64 编码与解码（支持 UTF-8）
   * @param {string} str - 输入字符串
   * @param {string} [mode='encode'] - 'encode' 编码 / 'decode' 解码
   * @returns {{ok:boolean, result:string, error:string}}
   */
  function base64Code(str, mode) {
    if (!mode) mode = 'encode';
    try {
      if (mode === 'encode') {
        // UTF-8 编码：先转为字节数组再 btoa
        var bytes = utf8Encode(str);
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return { ok: true, result: btoa(binary), error: '' };
      } else if (mode === 'decode') {
        var binary2 = atob(str);
        var bytes2 = [];
        for (var j = 0; j < binary2.length; j++) {
          bytes2.push(binary2.charCodeAt(j));
        }
        return { ok: true, result: utf8Decode(bytes2), error: '' };
      } else {
        return { ok: false, result: '', error: '不支持的模式: ' + mode + '，请使用 encode 或 decode' };
      }
    } catch (e) {
      return { ok: false, result: '', error: 'Base64 操作失败: ' + e.message };
    }
  }

  /** 字符串转 UTF-8 字节数组 */
  function utf8Encode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6));
        bytes.push(0x80 | (code & 0x3f));
      } else if (code >= 0xd800 && code <= 0xdbff) {
        // 代理对处理
        var hi = code;
        var lo = str.charCodeAt(++i);
        code = ((hi - 0xd800) << 10) + (lo - 0xdc00) + 0x10000;
        bytes.push(0xf0 | (code >> 18));
        bytes.push(0x80 | ((code >> 12) & 0x3f));
        bytes.push(0x80 | ((code >> 6) & 0x3f));
        bytes.push(0x80 | (code & 0x3f));
      } else {
        bytes.push(0xe0 | (code >> 12));
        bytes.push(0x80 | ((code >> 6) & 0x3f));
        bytes.push(0x80 | (code & 0x3f));
      }
    }
    return bytes;
  }

  /** UTF-8 字节数组转字符串 */
  function utf8Decode(bytes) {
    var str = '';
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      if (b < 0x80) {
        str += String.fromCharCode(b);
        i++;
      } else if ((b & 0xe0) === 0xc0) {
        str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if ((b & 0xf0) === 0xe0) {
        str += String.fromCharCode(
          ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
        );
        i += 3;
      } else if ((b & 0xf8) === 0xf0) {
        var code = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        // 转为代理对
        str += String.fromCharCode(
          0xd800 + ((code - 0x10000) >> 10),
          0xdc00 + ((code - 0x10000) & 0x3ff)
        );
        i += 4;
      } else {
        i++;
      }
    }
    return str;
  }

  // ==================== URL 编解码 ====================

  /**
   * URL 编码与解码
   * @param {string} str - 输入字符串
   * @param {string} [mode='encode'] - 'encode' 编码 / 'decode' 解码
   * @returns {{ok:boolean, result:string, error:string}}
   */
  function urlCode(str, mode) {
    if (!mode) mode = 'encode';
    try {
      if (mode === 'encode') {
        return { ok: true, result: encodeURIComponent(str), error: '' };
      } else if (mode === 'decode') {
        return { ok: true, result: decodeURIComponent(str), error: '' };
      } else {
        return { ok: false, result: '', error: '不支持的模式: ' + mode + '，请使用 encode 或 decode' };
      }
    } catch (e) {
      return { ok: false, result: '', error: 'URL 操作失败: ' + e.message };
    }
  }

  // ==================== 导出 ====================

  var core = {
    colorConvert: colorConvert,
    jsonFormat: jsonFormat,
    timestampConvert: timestampConvert,
    regexTest: regexTest,
    textDiff: textDiff,
    base64Code: base64Code,
    urlCode: urlCode
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  } else {
    window.ToolboxCore = core;
  }
})();
