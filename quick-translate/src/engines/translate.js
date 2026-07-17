// 翻译引擎模块 —— 暴露纯函数便于单元测试，translate() 为异步主入口
// 默认引擎：Google gtx（免费、无需 key、支持自动检测）；备用：MyMemory（免费、需显式源语言）

'use strict';

// 支持的语言列表（code -> 中文名）。'auto' 表示自动检测
const LANGUAGES = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'ko', name: '韩语' },
  { code: 'fr', name: '法语' },
  { code: 'de', name: '德语' },
  { code: 'es', name: '西班牙语' },
  { code: 'it', name: '意大利语' },
  { code: 'ru', name: '俄语' },
  { code: 'pt', name: '葡萄牙语' },
  { code: 'ar', name: '阿拉伯语' },
  { code: 'th', name: '泰语' },
  { code: 'vi', name: '越南语' },
  { code: 'id', name: '印尼语' },
  { code: 'ms', name: '马来语' },
  { code: 'tr', name: '土耳其语' },
  { code: 'nl', name: '荷兰语' },
  { code: 'pl', name: '波兰语' },
  { code: 'hi', name: '印地语' }
];

// 纯函数：构造 Google gtx 请求 URL
function buildGoogleUrl(sl, tl, q) {
  const slParam = sl || 'auto';
  return 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
    encodeURIComponent(slParam) + '&tl=' + encodeURIComponent(tl) +
    '&dt=t&q=' + encodeURIComponent(q);
}

// 纯函数：解析 Google gtx 返回的 JSON 字符串
// 返回 { text, detectedSource }；解析失败返回 null
function parseGoogleResponse(raw) {
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  let text = '';
  for (const seg of data[0]) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') text += seg[0];
  }
  const detectedSource = typeof data[2] === 'string' ? data[2] : null;
  if (!text) return null;
  return { text, detectedSource };
}

// 纯函数：构造 MyMemory 请求 URL（要求显式源语言）
function buildMyMemoryUrl(sl, tl, q) {
  return 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(q) +
    '&langpair=' + encodeURIComponent(sl + '|' + tl);
}

// 纯函数：解析 MyMemory 返回
function parseMyMemoryResponse(raw) {
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return null;
  }
  const text = data && data.responseData && data.responseData.translatedText;
  if (typeof text !== 'string' || !text) return null;
  // MyMemory 偶尔返回大写错误信息，过滤
  if (/^(MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID)/i.test(text)) return null;
  return { text, detectedSource: null };
}

// 通过 https 发起 GET 请求，返回字符串
function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const req = https.get(url, { headers: { 'User-Agent': 'quick-translate/1.0' } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs || 8000, () => {
      req.destroy(new Error('timeout'));
    });
  });
}

// 浏览器环境下的 fetch 封装（用于 Edge headless 截图时直接在 renderer 内调用）
async function fetchGet(url, timeoutMs) {
  if (typeof fetch === 'function') {
    const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 8000) : null;
    try {
      const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined });
      return await res.text();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  // 回退到 Node https
  return httpGet(url, timeoutMs);
}

// 主翻译入口
// options: { text, from, to, engine }
// engine: 'google' | 'mymemory' | 'auto'（默认 auto：先用 google，失败用 mymemory）
async function translate(options) {
  const { text, from = 'auto', to = 'zh', engine = 'auto' } = options || {};
  if (!text || !text.trim()) return { text: '', detectedSource: null, engine: null };
  const tryGoogle = async () => {
    const raw = await fetchGet(buildGoogleUrl(from, to, text));
    const r = parseGoogleResponse(raw);
    return r ? { text: r.text, detectedSource: r.detectedSource, engine: 'google' } : null;
  };
  const tryMyMemory = async () => {
    // MyMemory 需要显式源语言，若 from=auto 则先尝试用 google 检测的结果
    let sl = from;
    if (sl === 'auto') {
      // 尝试常见启发式：含 CJK 视为 zh，否则视为 en
      sl = /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
    }
    const raw = await fetchGet(buildMyMemoryUrl(sl, to, text));
    const r = parseMyMemoryResponse(raw);
    return r ? { text: r.text, detectedSource: r.detectedSource, engine: 'mymemory' } : null;
  };

  if (engine === 'google') {
    const r = await tryGoogle();
    if (r) return r;
    throw new Error('Google 翻译失败');
  }
  if (engine === 'mymemory') {
    const r = await tryMyMemory();
    if (r) return r;
    throw new Error('MyMemory 翻译失败');
  }
  // auto：先 google，失败回退 mymemory
  let lastErr;
  try {
    const r = await tryGoogle();
    if (r) return r;
  } catch (e) { lastErr = e; }
  try {
    const r = await tryMyMemory();
    if (r) return r;
  } catch (e) { lastErr = e; }
  throw lastErr || new Error('所有翻译引擎均失败');
}

// 双环境导出：Node/Electron 走 module.exports，浏览器挂到 window.qtTranslator
const __qtExports = {
  LANGUAGES,
  buildGoogleUrl,
  parseGoogleResponse,
  buildMyMemoryUrl,
  parseMyMemoryResponse,
  translate
};
if (typeof module !== 'undefined' && module.exports) module.exports = __qtExports;
if (typeof window !== 'undefined') window.qtTranslator = __qtExports;
