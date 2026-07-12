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

  // ==================== JWT 解码 ====================

  /**
   * JWT（JSON Web Token）解码
   * 仅解码 header 与 payload，不验证签名（本地调试用途）
   * @param {string} token - JWT 字符串，形如 header.payload.signature
   * @returns {{ok:boolean, header:object|null, payload:object|null, signature:string, claims:object|null, error:string}}
   *   claims: {status, statusText, iat, iatDate, exp, expDate, nbf, nbfDate, remaining}
   */
  function jwtDecode(token) {
    var s = String(token).trim();
    if (!s) {
      return { ok: false, header: null, payload: null, signature: '', claims: null, error: '请输入 JWT' };
    }
    var parts = s.split('.');
    if (parts.length < 2 || parts.length > 3) {
      return {
        ok: false, header: null, payload: null, signature: '', claims: null,
        error: 'JWT 格式错误：应为 header.payload.signature 三段（或 header.payload 两段）'
      };
    }
    if (!parts[0] || !parts[1]) {
      return {
        ok: false, header: null, payload: null, signature: '', claims: null,
        error: 'JWT 格式错误：header 或 payload 段为空'
      };
    }
    try {
      var header = JSON.parse(base64urlDecode(parts[0]));
      var payload = JSON.parse(base64urlDecode(parts[1]));
      var signature = parts[2] || '';
      var claims = analyzeClaims(payload);
      return { ok: true, header: header, payload: payload, signature: signature, claims: claims, error: '' };
    } catch (e) {
      return { ok: false, header: null, payload: null, signature: '', claims: null, error: 'JWT 解析失败: ' + e.message };
    }
  }

  /** Base64URL 解码为 UTF-8 字符串（JWT header/payload 专用） */
  function base64urlDecode(str) {
    // base64url 字符替换为标准 base64
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    // 补齐 padding
    var pad = s.length % 4;
    if (pad === 2) s += '==';
    else if (pad === 3) s += '=';
    else if (pad === 1) throw new Error('Base64URL 长度非法');
    var binary = atob(s);
    var bytes = [];
    for (var i = 0; i < binary.length; i++) bytes.push(binary.charCodeAt(i));
    return utf8Decode(bytes);
  }

  /** 分析 JWT 标准时间声明（iat/exp/nbf），返回可读状态 */
  function analyzeClaims(payload) {
    var now = Math.floor(Date.now() / 1000);
    var iat = typeof payload.iat === 'number' ? payload.iat : null;
    var exp = typeof payload.exp === 'number' ? payload.exp : null;
    var nbf = typeof payload.nbf === 'number' ? payload.nbf : null;

    var status, statusText;
    if (nbf !== null && now < nbf) {
      status = 'notbefore';
      statusText = '尚未生效';
    } else if (exp !== null && now >= exp) {
      status = 'expired';
      statusText = '已过期';
    } else if (exp !== null) {
      status = 'valid';
      statusText = '有效';
    } else {
      status = 'unknown';
      statusText = '无过期声明';
    }

    // 剩余 / 逾期时间描述
    var remaining = '';
    if (exp !== null) {
      var diff = exp - now;
      remaining = diff >= 0 ? '还有 ' + humanDuration(diff) + ' 过期' : '已过期 ' + humanDuration(-diff);
    }

    return {
      status: status,
      statusText: statusText,
      iat: iat,
      iatDate: iat !== null ? fmtClaim(iat) : null,
      exp: exp,
      expDate: exp !== null ? fmtClaim(exp) : null,
      nbf: nbf,
      nbfDate: nbf !== null ? fmtClaim(nbf) : null,
      remaining: remaining
    };
  }

  /** Unix 秒戳格式化为本地时间字符串 */
  function fmtClaim(ts) {
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  /** 秒数转为中文可读时长（天/小时/分/秒） */
  function humanDuration(sec) {
    if (sec < 60) return sec + ' 秒';
    if (sec < 3600) return Math.floor(sec / 60) + ' 分';
    if (sec < 86400) return Math.floor(sec / 3600) + ' 小时';
    if (sec < 2592000) return Math.floor(sec / 86400) + ' 天';
    if (sec < 31536000) return Math.floor(sec / 2592000) + ' 个月';
    return Math.floor(sec / 31536000) + ' 年';
  }

  // ==================== 生成器（UUID + 密码）====================

  /** 获取安全随机字节数组（浏览器 Web Crypto / Node crypto / 回退） */
  function secureRandomBytes(count) {
    var bytes = new Array(count);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
      var arr = new Uint8Array(count);
      globalThis.crypto.getRandomValues(arr);
      for (var i = 0; i < count; i++) bytes[i] = arr[i];
      return bytes;
    }
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        var buf = nodeCrypto.randomBytes(count);
        for (var j = 0; j < count; j++) bytes[j] = buf[j];
        return bytes;
      } catch (e) {}
    }
    for (var k = 0; k < count; k++) bytes[k] = Math.floor(Math.random() * 256);
    return bytes;
  }

  /**
   * 生成 RFC 4122 v4 UUID
   * @param {string} [format='lower'] - 'lower' | 'upper' | 'nohyphen' | 'braces'
   * @returns {string}
   */
  function generateUUID(format) {
    if (!format) format = 'lower';
    var b = secureRandomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = '';
    for (var i = 0; i < 16; i++) {
      hex += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    }
    var uuid = hex.substr(0, 8) + '-' + hex.substr(8, 4) + '-' +
               hex.substr(12, 4) + '-' + hex.substr(16, 4) + '-' + hex.substr(20, 12);
    switch (format) {
      case 'upper': return uuid.toUpperCase();
      case 'nohyphen': return uuid.replace(/-/g, '');
      case 'braces': return '{' + uuid + '}';
      default: return uuid;
    }
  }

  /**
   * 生成随机密码
   * @param {number} length - 长度 1-128
   * @param {object} [options] - { lower, upper, digits, symbols, excludeAmbiguous }
   * @returns {{ok:boolean, password:string, strength:string, entropy:number, error:string}}
   */
  function generatePassword(length, options) {
    if (!length || length < 1) length = 16;
    if (length > 128) length = 128;
    options = options || {};
    var lower = options.lower !== false;
    var upper = options.upper !== false;
    var digits = options.digits !== false;
    var symbols = options.symbols !== false;
    var excludeAmbiguous = !!options.excludeAmbiguous;

    var sets = [];
    if (lower) sets.push('abcdefghijklmnopqrstuvwxyz');
    if (upper) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (digits) sets.push('0123456789');
    if (symbols) sets.push('!@#$%^&*()_+-=[]{}|;:,.<>?');

    if (sets.length === 0) {
      return { ok: false, password: '', strength: 'none', entropy: 0, error: '请至少选择一种字符集' };
    }

    if (excludeAmbiguous) {
      var amb = '0O1lI|`';
      sets = sets.map(function (s) {
        return s.split('').filter(function (c) { return amb.indexOf(c) === -1; }).join('');
      }).filter(function (s) { return s.length > 0; });
      if (sets.length === 0) {
        return { ok: false, password: '', strength: 'none', entropy: 0, error: '字符集为空' };
      }
    }

    var charset = sets.join('');
    var bytes = secureRandomBytes(length + sets.length);
    var chars = [];
    for (var i = 0; i < length; i++) {
      chars.push(charset[bytes[i] % charset.length]);
    }
    // 保证每种选中字符集至少出现一个（长度足够时）
    if (length >= sets.length) {
      for (var s = 0; s < sets.length; s++) {
        var pos = bytes[length + s] % length;
        chars[pos] = sets[s][bytes[s] % sets[s].length];
      }
    }

    var password = chars.join('');
    var entropy = Math.round(length * Math.log2(charset.length));
    var strength;
    if (entropy < 40) strength = 'weak';
    else if (entropy < 70) strength = 'medium';
    else strength = 'strong';

    return { ok: true, password: password, strength: strength, entropy: entropy, error: '' };
  }

  // ==================== 导出 ====================

  var core = {
    colorConvert: colorConvert,
    jsonFormat: jsonFormat,
    timestampConvert: timestampConvert,
    regexTest: regexTest,
    textDiff: textDiff,
    base64Code: base64Code,
    urlCode: urlCode,
    jwtDecode: jwtDecode,
    generateUUID: generateUUID,
    generatePassword: generatePassword
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = core;
  } else {
    window.ToolboxCore = core;
  }
})();
