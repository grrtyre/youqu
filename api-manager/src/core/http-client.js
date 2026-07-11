'use strict';

// API管家 · HTTP 客户端核心
// 纯 Node 实现，不依赖 Electron，便于测试与复用
// 支持：GET/POST/PUT/DELETE/PATCH/HEAD/OPTIONS、查询参数、请求头、请求体（JSON/Form/Text）、
//       Basic/Bearer 认证、超时、重定向、计时、响应大小、环境变量替换

const http = require('http');
const https = require('https');
const { URL } = require('url');

const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/**
 * 将环境变量（{{var}}）替换到字符串中
 * @param {string} str 原始字符串
 * @param {Object} env 环境变量键值表
 * @returns {string}
 */
function applyEnv(str, env) {
  if (typeof str !== 'string') return str;
  if (!env || typeof env !== 'object') return str;
  return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(env, key) ? String(env[key]) : match;
  });
}

/**
 * 深度替换对象中所有字符串值里的环境变量
 */
function applyEnvDeep(obj, env) {
  if (typeof obj === 'string') return applyEnv(obj, env);
  if (Array.isArray(obj)) return obj.map((v) => applyEnvDeep(v, env));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = applyEnvDeep(obj[k], env);
    return out;
  }
  return obj;
}

/**
 * 构建最终请求配置（合并参数、认证、环境变量）
 * @param {Object} req 请求定义
 *   { method, url, params:[{key,value,enabled}], headers:[{key,value,enabled}],
 *     body:{type:'none|json|form|text', raw, form:[{key,value,enabled}]},
 *     auth:{type:'none|basic|bearer', username, password, token} }
 * @param {Object} env 环境变量
 * @returns {Object} { method, url, headers, body }
 */
function buildRequest(req, env) {
  req = req || {};
  env = env || {};
  let method = (req.method || 'GET').toUpperCase();
  if (!SUPPORTED_METHODS.includes(method)) method = 'GET';

  // URL + 查询参数
  let urlStr = applyEnv(req.url || '', env);
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = 'http://' + urlStr;
  }
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch (e) {
    throw new Error('URL 无效：' + (req.url || ''));
  }

  // 合并查询参数
  const params = applyEnvDeep(req.params || [], env);
  for (const p of params) {
    if (p && p.enabled !== false && p.key) {
      parsed.searchParams.append(p.key, p.value == null ? '' : String(p.value));
    }
  }

  // 请求头
  const headers = {};
  const headerList = applyEnvDeep(req.headers || [], env);
  for (const h of headerList) {
    if (h && h.enabled !== false && h.key) {
      headers[h.key] = h.value == null ? '' : String(h.value);
    }
  }

  // 认证
  const auth = req.auth || { type: 'none' };
  if (auth.type === 'basic') {
    const u = applyEnv(auth.username || '', env);
    const p = applyEnv(auth.password || '', env);
    headers['Authorization'] = 'Basic ' + Buffer.from(u + ':' + p).toString('base64');
  } else if (auth.type === 'bearer') {
    const t = applyEnv(auth.token || '', env);
    headers['Authorization'] = 'Bearer ' + t;
  }

  // 请求体
  let bodyData = null;
  const body = req.body || { type: 'none' };
  if (body.type === 'json') {
    if (body.raw && body.raw.trim()) {
      // 先做环境变量替换，再校验 JSON 合法性
      const replaced = applyEnv(body.raw, env);
      try {
        JSON.parse(replaced);
        bodyData = replaced;
      } catch (e) {
        bodyData = replaced;
      }
      if (!headers['Content-Type'] && !hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }
    }
  } else if (body.type === 'form') {
    const formList = applyEnvDeep(body.form || [], env);
    const pairs = [];
    for (const f of formList) {
      if (f && f.enabled !== false && f.key) {
        pairs.push(encodeURIComponent(f.key) + '=' + encodeURIComponent(f.value == null ? '' : String(f.value)));
      }
    }
    if (pairs.length) {
      bodyData = pairs.join('&');
      if (!hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
      }
    }
  } else if (body.type === 'text') {
    if (body.raw) {
      bodyData = applyEnv(body.raw, env);
      if (!hasHeader(headers, 'content-type')) {
        headers['Content-Type'] = 'text/plain; charset=utf-8';
      }
    }
  }

  return { method, url: parsed.toString(), headers, body: bodyData };
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
}

/**
 * 发起 HTTP 请求
 * @param {Object} reqConfig buildRequest 的返回值
 * @param {Object} options { timeout:Number=30000, maxRedirects:Number=5 }
 * @returns {Promise<Object>} { status, statusText, headers, body, size, time, redirects }
 */
function sendRequest(reqConfig, options) {
  options = options || {};
  const timeout = options.timeout || 30000;
  const maxRedirects = options.maxRedirects == null ? 5 : options.maxRedirects;

  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(reqConfig.url);
    } catch (e) {
      reject(new Error('URL 无效：' + reqConfig.url));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;
    const method = reqConfig.method;
    const headers = Object.assign({}, reqConfig.headers);
    let bodyBuf = null;
    if (reqConfig.body != null) {
      bodyBuf = Buffer.isBuffer(reqConfig.body) ? reqConfig.body : Buffer.from(String(reqConfig.body), 'utf-8');
      headers['Content-Length'] = bodyBuf.length;
    }

    const redirects = [];
    const start = Date.now();

    function doRequest(currentUrl, remaining) {
      let cur;
      try {
        cur = new URL(currentUrl);
      } catch (e) {
        reject(new Error('重定向 URL 无效：' + currentUrl));
        return;
      }
      const lib2 = cur.protocol === 'https:' ? https : http;
      const reqOpts = {
        method: method,
        hostname: cur.hostname,
        port: cur.port || (cur.protocol === 'https:' ? 443 : 80),
        path: cur.pathname + cur.search,
        headers: Object.assign({}, headers),
        timeout: timeout
      };

      const req = lib2.request(reqOpts, (res) => {
        // 处理重定向
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && remaining > 0) {
          redirects.push({ status: res.statusCode, location: res.headers.location });
          // 303 转 GET；307/308 保持方法；301/302 历史上转 GET
          let nextUrl;
          try {
            nextUrl = new URL(res.headers.location, cur).toString();
          } catch (e) {
            reject(new Error('重定向地址无效'));
            return;
          }
          // 消费掉当前响应体
          res.resume();
          const nextRemaining = remaining - 1;
          // 303 / 302 / 301 → GET 且清空 body（兼容历史行为）；307/308 保持方法与 body
          if (res.statusCode === 303 || res.statusCode === 302 || res.statusCode === 301) {
            // 清空 body 与内容长度头
            // 但保留 307/308 的 body
            if (res.statusCode === 303) {
              delete headers['Content-Length'];
              doRequest(nextUrl, nextRemaining);
              return;
            }
          }
          doRequest(nextUrl, nextRemaining);
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const time = Date.now() - start;
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: normalizeHeaders(res.headers),
            body: buf,
            size: buf.length,
            time: time,
            redirects: redirects
          });
        });
        res.on('error', (e) => reject(e));
      });

      req.on('timeout', () => {
        req.destroy(new Error('请求超时（' + timeout + 'ms）'));
      });
      req.on('error', (e) => reject(e));

      if (bodyBuf && method !== 'GET' && method !== 'HEAD') {
        req.write(bodyBuf);
      }
      req.end();
    }

    doRequest(parsed.toString(), maxRedirects);
  });
}

function normalizeHeaders(raw) {
  const out = {};
  if (!raw) return out;
  for (const k of Object.keys(raw)) {
    out[k] = Array.isArray(raw[k]) ? raw[k].join(', ') : raw[k];
  }
  return out;
}

/**
 * 将响应体 Buffer 转为可显示的字符串；若为 JSON 则解析
 */
function formatBody(buf, headers) {
  const ct = headers && (headers['content-type'] || headers['Content-Type']) || '';
  const text = buf.toString('utf-8');
  if (/json/i.test(ct) || (text.trim().startsWith('{') || text.trim().startsWith('['))) {
    try {
      return { type: 'json', text: JSON.stringify(JSON.parse(text), null, 2), raw: text };
    } catch (e) {
      return { type: 'text', text: text, raw: text };
    }
  }
  return { type: 'text', text: text, raw: text };
}

module.exports = {
  SUPPORTED_METHODS,
  applyEnv,
  applyEnvDeep,
  buildRequest,
  sendRequest,
  formatBody,
  normalizeHeaders
};
