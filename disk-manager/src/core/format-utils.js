// 格式化工具：字节/数字/百分比/时间等显示
'use strict';

// 字节转人类可读（1024 进制，保留 1 位小数）
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let val = bytes / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return val.toFixed(val < 10 ? 2 : (val < 100 ? 1 : 0)) + ' ' + units[idx];
}

// 数字千分位
function formatNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

// 百分比（0-1 转 xx.x%）
function formatPercent(ratio, total) {
  if (!total || total <= 0) return '0.0%';
  if (!ratio || ratio <= 0) return '0.0%';
  const p = (ratio / total) * 100;
  if (p < 0.01) return '<0.01%';
  return p.toFixed(p < 1 ? 2 : 1) + '%';
}

// 文件扩展名归类（小写）
function getExt(name) {
  if (!name || typeof name !== 'string') return '';
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

// 扩展名 → 大类
function classifyExt(ext) {
  const map = {
    // 视频
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', 'ts', 'rmvb', 'rm'],
    // 音频
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'ape', 'opus', 'aiff'],
    // 图片
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg', 'heic', 'raw', 'psd', 'ico'],
    // 文档
    doc: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'rtf', 'odt', 'csv', 'epub'],
    // 压缩
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'cab'],
    // 代码
    code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'json', 'xml', 'html', 'css', 'scss', 'less', 'vue', 'sh', 'bat', 'ps1', 'sql'],
    // 程序
    exe: ['exe', 'msi', 'dll', 'app', 'deb', 'rpm', 'dmg', 'apk', 'ipa'],
    // 数据库
    db: ['db', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'sql'],
  };
  for (const cat of Object.keys(map)) {
    if (map[cat].indexOf(ext) >= 0) return cat;
  }
  return 'other';
}

// 大类 → 颜色（苹果白配色下的柔和色板）
const CATEGORY_COLORS = {
  video:   '#FF9E8A',
  audio:   '#FFC078',
  image:   '#8CE99A',
  doc:     '#74C0FC',
  archive: '#D0BFFF',
  code:    '#99E9F2',
  exe:     '#ADB5BD',
  db:      '#FCC2D7',
  other:   '#DEE2E6',
};

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
}

// 时间格式化（ms 时间戳 → yyyy-mm-dd hh:mm）
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

module.exports = {
  formatBytes,
  formatNumber,
  formatPercent,
  getExt,
  classifyExt,
  categoryColor,
  CATEGORY_COLORS,
  formatTime,
};
