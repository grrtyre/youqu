// main.js - Electron 主进程
// 密码生成器 - 苹果白风格桌面应用
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const crypto = require('crypto');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 820,
    minHeight: 580,
    show: false,
    title: 'Password Generator',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============ 核心密码生成逻辑（使用 Node crypto，密码学安全） ============

// 安全随机整数 [0, max)
function secureRandomInt(max) {
  // 拒绝采样避免模偏差
  const range = 256 - (256 % max);
  const buf = crypto.randomBytes(1);
  let val = buf[0];
  while (val >= range) {
    val = crypto.randomBytes(1)[0];
  }
  return val % max;
}

function secureShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 字符集
const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
  ambiguous: 'il1Lo0O'
};

// 钳制整数到 [min, max]（兜底防御：渲染层数字输入框可能被绕过）
function clampInt(v, dft, min, max) {
  let n = parseInt(v);
  if (Number.isNaN(n)) n = dft;
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

// 生成密码
function generatePassword(opts) {
  const length = clampInt(opts && opts.length, 16, 4, 64);
  const {
    lower = true,
    upper = true,
    digits = true,
    symbols = true,
    excludeAmbiguous = false
  } = opts || {};

  let pool = '';
  const required = [];
  if (lower) {
    let s = CHARSETS.lower;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (upper) {
    let s = CHARSETS.upper;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (digits) {
    let s = CHARSETS.digits;
    if (excludeAmbiguous) s = s.split('').filter(c => !CHARSETS.ambiguous.includes(c)).join('');
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }
  if (symbols) {
    const s = CHARSETS.symbols;
    pool += s;
    required.push(s[secureRandomInt(s.length)]);
  }

  if (!pool) return '';

  const chars = [];
  for (const r of required) chars.push(r);
  for (let i = chars.length; i < length; i++) {
    chars.push(pool[secureRandomInt(pool.length)]);
  }
  return secureShuffle(chars).slice(0, length).join('');
}

// 口令生成（基于英文常用词，便于记忆）
const WORD_LIST = [
  'apple', 'river', 'stone', 'cloud', 'light', 'moon', 'star', 'tree',
  'wind', 'rain', 'snow', 'fire', 'mountain', 'ocean', 'forest', 'desert',
  'tiger', 'eagle', 'whale', 'wolf', 'fox', 'bear', 'lion', 'deer',
  'happy', 'brave', 'calm', 'wise', 'quick', 'soft', 'warm', 'cool',
  'silver', 'golden', 'crystal', 'amber', 'ivory', 'jade', 'pearl', 'coral',
  'dance', 'sing', 'fly', 'run', 'jump', 'swim', 'climb', 'dream',
  'spring', 'summer', 'autumn', 'winter', 'morning', 'evening', 'night', 'dawn',
  'garden', 'castle', 'bridge', 'tower', 'harbor', 'meadow', 'valley', 'peak',
  'silent', 'gentle', 'bright', 'clever', 'noble', 'honest', 'kind', 'loyal',
  'violet', 'rose', 'lily', 'lotus', 'jasmine', 'daisy', 'iris', 'orchid',
  'thunder', 'frost', 'mist', 'shadow', 'glow', 'spark', 'flame', 'wave'
];

function generatePassphrase(opts) {
  const words = clampInt(opts && opts.words, 4, 3, 8);
  const separator = (opts && typeof opts.separator === 'string') ? opts.separator.slice(0, 3) : '-';
  const {
    capitalize = true,
    includeNumber = true
  } = opts || {};
  const picked = [];
  for (let i = 0; i < words; i++) {
    let w = WORD_LIST[secureRandomInt(WORD_LIST.length)];
    if (capitalize) w = w.charAt(0).toUpperCase() + w.slice(1);
    picked.push(w);
  }
  if (includeNumber) {
    picked.push(String(secureRandomInt(100)));
  }
  return picked.join(separator);
}

// 评估密码强度（基于熵 + 启发式）
function evaluateStrength(password) {
  if (!password) return { score: 0, label: '无', entropy: 0, suggestions: [] };

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 26;

  const entropy = password.length * Math.log2(poolSize || 1);
  const suggestions = [];

  if (password.length < 8) suggestions.push('建议至少 8 位长度');
  if (password.length < 12) suggestions.push('建议增加到 12 位以上');
  if (!/[A-Z]/.test(password)) suggestions.push('加入大写字母');
  if (!/[0-9]/.test(password)) suggestions.push('加入数字');
  if (!/[^a-zA-Z0-9]/.test(password)) suggestions.push('加入特殊符号');

  if (/^(123|abc|password|qwerty|admin|letmein)/i.test(password)) {
    suggestions.push('避免使用常见弱密码开头');
  }
  if (/(.)\1{2,}/.test(password)) suggestions.push('避免重复字符');

  let score;
  if (entropy < 28) score = 1;
  else if (entropy < 36) score = 2;
  else if (entropy < 60) score = 3;
  else if (entropy < 80) score = 4;
  else if (entropy < 120) score = 5;
  else score = 6;

  const labels = ['无', '极弱', '弱', '一般', '强', '很强', '极强'];

  return {
    score,
    label: labels[score],
    entropy: Math.round(entropy * 10) / 10,
    suggestions
  };
}

// ============ IPC 通道 ============
ipcMain.handle('pg:generate', (event, opts) => generatePassword(opts || {}));
ipcMain.handle('pg:passphrase', (event, opts) => generatePassphrase(opts || {}));
ipcMain.handle('pg:evaluate', (event, password) => evaluateStrength(password));
ipcMain.handle('pg:batch', (event, opts) => {
  const count = clampInt(opts && opts.count, 10, 1, 200);
  const rest = Object.assign({}, opts || {});
  delete rest.count;
  const results = [];
  for (let i = 0; i < count; i++) results.push(generatePassword(rest));
  return results;
});
ipcMain.handle('pg:copy', (event, text) => { clipboard.writeText(text); return true; });
ipcMain.handle('pg:evaluate-batch', (event, passwords) => (passwords || []).map(p => evaluateStrength(p)));
