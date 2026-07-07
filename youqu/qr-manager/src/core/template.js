// src/core/template.js — 二维码内容模板拼装（WiFi/名片/邮箱/短信/电话/URL/文本）
// 所有函数返回纯字符串，可直接传给生成器

/**
 * WiFi 二维码
 * 标准格式：WIFI:T:<加密>;S:<SSID>;P:<密码>;H:<隐藏>;;
 * @param {{ssid:string, password?:string, encryption:'WPA'|'WEP'|'nopass', hidden?:boolean}} p
 */
function buildWiFi({ ssid, password = '', encryption = 'WPA', hidden = false }) {
  if (!ssid) return null;
  if (!['WPA', 'WEP', 'nopass'].includes(encryption)) {
    const e = new Error('加密方式应为 WPA/WEP/nopass'); e.code = 'BAD_WIFI'; throw e;
  }
  // 转义特殊字符：反斜杠、分号、逗号、冒号、引号需用反斜杠转义
  const esc = (s) => String(s).replace(/([\\;,:"'])/g, '\\$1');
  const pwd = encryption === 'nopass' ? '' : esc(password);
  const ssidE = esc(ssid);
  return `WIFI:T:${encryption};S:${ssidE};P:${pwd};H:${hidden ? 'true' : 'false'};;`;
}

/**
 * vCard 名片（3.0）
 * @param {{firstName?:string, lastName?:string, phone?:string, email?:string, org?:string, title?:string, url?:string, address?:string}} p
 */
function buildVCard({ firstName = '', lastName = '', phone = '', email = '', org = '', title = '', url = '', address = '' }) {
  const name = `${lastName};${firstName};;`;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${name}`,
    `FN:${[firstName, lastName].filter(Boolean).join(' ')}`,
    org ? `ORG:${org}` : null,
    title ? `TITLE:${title}` : null,
    phone ? `TEL;TYPE=CELL:${phone}` : null,
    email ? `EMAIL:${email}` : null,
    url ? `URL:${url}` : null,
    address ? `ADR:;;${address}` : null,
    'END:VCARD'
  ].filter(Boolean);
  return lines.join('\n');
}

/**
 * 邮件
 * @param {{to:string, subject?:string, body?:string}} p
 */
function buildEmail({ to, subject = '', body = '' }) {
  if (!to) return null;
  // MATMSG 格式部分扫描器支持有限，统一用 mailto 更通用
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to}${params.length ? '?' + params.join('&') : ''}`;
}

/**
 * 短信
 * @param {{phone:string, message?:string}} p
 */
function buildSMS({ phone, message = '' }) {
  if (!phone) return null;
  return message ? `SMSTO:${phone}:${message}` : `SMSTO:${phone}`;
}

/**
 * 电话
 */
function buildPhone({ phone }) {
  if (!phone) return null;
  return `tel:${phone}`;
}

/**
 * URL（自动补协议）
 */
function buildURL({ url }) {
  if (!url) return null;
  const u = String(url).trim();
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) return u; // 已含协议
  return `https://${u}`;
}

/**
 * 纯文本
 */
function buildText({ text }) {
  if (!text) return null;
  return String(text);
}

/**
 * 根据类型与字段构建内容
 * @param {string} type 'text'|'url'|'wifi'|'vcard'|'email'|'sms'|'phone'
 * @param {object} fields 各类型对应字段
 */
function buildContent(type, fields) {
  switch (type) {
    case 'text': return buildText(fields);
    case 'url': return buildURL(fields);
    case 'wifi': return buildWiFi(fields);
    case 'vcard': return buildVCard(fields);
    case 'email': return buildEmail(fields);
    case 'sms': return buildSMS(fields);
    case 'phone': return buildPhone(fields);
    default: { const e = new Error(`未知类型: ${type}`); e.code = 'BAD_TYPE'; throw e; }
  }
}

/**
 * 识别二维码内容后，尝试解析类型（用于友好展示）
 * @param {string} raw
 * @returns {{type:string, fields:object, raw:string}}
 */
function parseContent(raw) {
  const r = String(raw);
  if (r.startsWith('WIFI:')) {
    const m = r.match(/^WIFI:T:([^;]*);S:([^;]*);P:([^;]*);H:([^;]*);;/);
    if (m) return { type: 'wifi', fields: { ssid: m[2], password: m[3], encryption: m[1] || 'WPA', hidden: m[4] === 'true' }, raw: r };
  }
  if (r.startsWith('BEGIN:VCARD')) return { type: 'vcard', fields: { raw: r }, raw: r };
  if (r.startsWith('mailto:')) {
    const u = new URL(r); const f = { to: u.pathname };
    u.searchParams.forEach((v, k) => { f[k] = v; });
    return { type: 'email', fields: f, raw: r };
  }
  if (r.startsWith('SMSTO:')) {
    const [, phone, message = ''] = r.slice(6).split(':');
    return { type: 'sms', fields: { phone, message }, raw: r };
  }
  if (r.startsWith('tel:')) return { type: 'phone', fields: { phone: r.slice(4) }, raw: r };
  if (/^https?:\/\//i.test(r)) return { type: 'url', fields: { url: r }, raw: r };
  return { type: 'text', fields: { text: r }, raw: r };
}

module.exports = {
  buildWiFi, buildVCard, buildEmail, buildSMS, buildPhone, buildURL, buildText,
  buildContent, parseContent
};
