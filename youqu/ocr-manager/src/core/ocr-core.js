// src/core/ocr-core.js — 识字管家核心逻辑（纯函数，可脱离 Electron 测试）
// 仅包含与 OCR 文本处理、语言、历史、统计相关的纯逻辑，不依赖 tesseract.js / electron。

'use strict';

// 支持的语言选项（value 为 tesseract.js lang 代码）
const SUPPORTED_LANGS = [
  { code: 'chi_sim+eng', label: '中文 + 英文' },
  { code: 'chi_sim', label: '简体中文' },
  { code: 'eng', label: '英文' },
  { code: 'chi_tra+eng', label: '繁体 + 英文' },
  { code: 'jpn', label: '日文' },
  { code: 'kor', label: '韩文' }
];

// 校验并归一化语言代码字符串
// 输入 '中文 + 英文' / 'chi_sim+eng' / 'chi_sim' 等均返回合法 tesseract lang 串
function parseLangs(input) {
  if (typeof input !== 'string' || !input.trim()) return 'chi_sim+eng';
  const trimmed = input.trim();
  // 若直接是支持的 code
  const hit = SUPPORTED_LANGS.find(l => l.code === trimmed);
  if (hit) return hit.code;
  // 若是 label
  const byLabel = SUPPORTED_LANGS.find(l => l.label === trimmed);
  if (byLabel) return byLabel.code;
  // 自定义：仅允许小写字母/数字/+，且每段在已知集合内
  if (/^[a-z_0-9]+(\+[a-z_0-9]+)*$/.test(trimmed)) {
    const parts = trimmed.split('+');
    const known = ['chi_sim', 'chi_tra', 'eng', 'jpn', 'kor', 'math', 'osd'];
    if (parts.every(p => known.includes(p))) return trimmed;
  }
  return 'chi_sim+eng';
}

// 清洗识别结果文本：
// - 去除每行尾随空白
// - 折叠 3 个及以上连续换行为 2 个
// - 去除整体首尾空白
// - 不破坏中文之间应有的空格（保留原始空格语义）
function cleanText(raw) {
  if (raw == null) return '';
  let text = String(raw);
  // 统一换行符
  text = text.replace(/\r\n?/g, '\n');
  // 行尾空白
  text = text.replace(/[ \t]+$/gm, '');
  // 折叠多余空行（>=3 换行 -> 2 换行）
  text = text.replace(/\n{3,}/g, '\n\n');
  // 首尾空白
  text = text.replace(/^\s+|\s+$/g, '');
  return text;
}

// 格式化置信度为百分比字符串
function formatConfidence(n) {
  const num = Number(n);
  if (!isFinite(num)) return '--';
  return num.toFixed(1) + '%';
}

// 统计文本信息
function summarize(text) {
  const t = typeof text === 'string' ? text : '';
  const lines = t === '' ? 0 : t.split('\n').length;
  // 字符数（不含换行）
  const chars = t.replace(/\n/g, '').length;
  // 中文汉字数
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  // 英文单词数（按空白切分，仅含拉丁字符的段计为词）
  const words = (t.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []).length;
  return { chars, lines, cjk, words };
}

// 生成预览文本（取前若干字符，单行）
function previewText(text, max) {
  const limit = typeof max === 'number' && max > 0 ? max : 40;
  const t = cleanText(text).replace(/\n+/g, ' ');
  if (t.length <= limit) return t;
  return t.slice(0, limit) + '…';
}

// 构造一条历史记录
function buildHistoryEntry(text, source, confidence) {
  const id = 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  return {
    id,
    time: new Date().toISOString(),
    source: typeof source === 'string' ? source : 'image',
    preview: previewText(text, 40),
    text: cleanText(text),
    confidence: typeof confidence === 'number' ? Math.round(confidence * 10) / 10 : null
  };
}

// 将新条目插入历史（限制最大长度， newest 在前）
function appendHistory(history, entry, maxLen) {
  const limit = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 50;
  const list = Array.isArray(history) ? history.slice() : [];
  list.unshift(entry);
  while (list.length > limit) list.pop();
  return list;
}

// 删除指定 id 的历史条目
function removeHistory(history, id) {
  if (!Array.isArray(history)) return [];
  return history.filter(h => h.id !== id);
}

// 导出文本为可下载内容（返回 { filename, content } 供主进程写盘）
function buildExport(text, baseName) {
  const name = (typeof baseName === 'string' && baseName.trim()) ? baseName : '识字结果';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    filename: `${name}_${stamp}.txt`,
    content: cleanText(text)
  };
}

module.exports = {
  SUPPORTED_LANGS,
  parseLangs,
  cleanText,
  formatConfidence,
  summarize,
  previewText,
  buildHistoryEntry,
  appendHistory,
  removeHistory,
  buildExport
};
