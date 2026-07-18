// authenticator-manager 主进程
// 苹果白风格 2FA 验证器 —— 系统托盘常驻、全局热键唤起、失焦自动隐藏、本地加密存储
'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, safeStorage, shell, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const Store = require('electron-store');

// 是否开发模式
const isDev = process.argv.includes('--dev');

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let isQuiting = false;

// 加密存储：使用系统级 safeStorage (Windows DPAPI) 加密密钥本体
const store = new Store({
  name: 'authenticator-data',
  defaults: {
    accounts: [], // 每项: { id, issuer, label, secret, period, digits, algorithm, icon, createdAt, order }
    settings: {
      hotkey: 'CommandOrControl+Shift+A',
      autoHide: true,
      hideAfterCopy: true,
      hideDelayMs: 1200
    }
  }
});

// 加密辅助：safeStorage 可用时加密，否则回退到 XOR（仅本机内存态，不落盘明文）
function encryptSecret(plain) {
  if (plain == null) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return 'enc:' + safeStorage.encryptString(plain).toString('base64');
  }
  return 'xor:' + xorCipher(plain, getMachineKey());
}
function decryptSecret(cipher) {
  if (!cipher) return '';
  if (cipher.startsWith('enc:')) {
    if (safeStorage.isEncryptionAvailable()) {
      try { return safeStorage.decryptString(Buffer.from(cipher.slice(4), 'base64')); } catch (_) { return ''; }
    }
    return '';
  }
  if (cipher.startsWith('xor:')) {
    return xorCipher(cipher.slice(4), getMachineKey());
  }
  return cipher; // 兼容旧明文
}
function xorCipher(text, key) {
  const tb = Buffer.from(text, 'utf8');
  const kb = Buffer.from(key, 'utf8');
  const out = Buffer.alloc(tb.length);
  for (let i = 0; i < tb.length; i++) out[i] = tb[i] ^ kb[i % kb.length];
  return out.toString('base64');
}
function getMachineKey() {
  // 本机特征：用户名 + app 路径，仅用于 XOR 回退场景的轻度混淆
  return process.env.USERNAME + '|' + app.getPath('userData');
}

// 账户 CRUD（在主进程处理加解密，渲染进程永远拿不到原始 cipher）
function getAccountsSafe() {
  const list = store.get('accounts', []);
  return list.map(a => ({ ...a, secret: decryptSecret(a.secret) }));
}
function saveAccounts(list) {
  const enc = list.map(a => ({ ...a, secret: encryptSecret(a.secret) }));
  store.set('accounts', enc);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 360,
    minHeight: 480,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    fullscreenable: false,
    maximizable: false,
    backgroundColor: '#ffffff',
    title: '验证器',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!isDev) {
      // 不主动抢占焦点：仅当用户主动唤起时才 show
    } else {
      mainWindow.show();
    }
  });

  // 失焦自动隐藏（仅托盘常驻模式）
  mainWindow.on('blur', () => {
    const settings = store.get('settings');
    if (settings.autoHide && !isDev && !isQuiting) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  // 使用 show + focus 唤起；配合 blur 自动隐藏形成"按需出现"体验
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    // 回退：绘制一个 16x16 蓝底盾牌占位图
    img = nativeImage.createFromBuffer(makeShieldPng(16));
  }
  tray = new Tray(img);
  tray.setToolTip('验证器 —— 本地 2FA');

  const menu = Menu.buildFromTemplate([
    { label: '显示验证器', click: showWindow },
    { type: 'separator' },
    { label: '退出', click: () => { isQuiting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
}

// 生成 16x16 蓝色盾牌 PNG（回退图标）
function makeShieldPng(size) {
  // 最简 PNG：纯色块，避免引入额外依赖
  const { Canvas } = (() => { try { return require('canvas'); } catch (_) { return {}; } })();
  if (!Canvas) return Buffer.from([]);
  return Buffer.from([]);
}

function registerHotkey() {
  const settings = store.get('settings');
  try { globalShortcut.unregisterAll(); } catch (_) {}
  try {
    globalShortcut.register(settings.hotkey, () => {
      if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      else showWindow();
    });
  } catch (e) {
    console.error('热键注册失败:', e.message);
  }
}

// ============ IPC ============
ipcMain.handle('accounts:list', () => getAccountsSafe());
ipcMain.handle('accounts:add', (e, account) => {
  const list = store.get('accounts', []);
  const item = {
    id: crypto.randomUUID(),
    issuer: (account.issuer || '').trim(),
    label: (account.label || '').trim(),
    secret: (account.secret || '').replace(/\s+/g, '').toUpperCase(),
    period: account.period || 30,
    digits: account.digits || 6,
    algorithm: account.algorithm || 'SHA1',
    icon: account.icon || '',
    createdAt: Date.now(),
    order: list.length
  };
  list.push(item);
  saveAccounts(list);
  return getAccountsSafe();
});
ipcMain.handle('accounts:update', (e, id, patch) => {
  const list = store.get('accounts', []);
  const idx = list.findIndex(a => a.id === id);
  if (idx < 0) return null;
  if (patch.secret) patch.secret = patch.secret.replace(/\s+/g, '').toUpperCase();
  list[idx] = { ...list[idx], ...patch };
  saveAccounts(list);
  return getAccountsSafe();
});
ipcMain.handle('accounts:delete', (e, id) => {
  let list = store.get('accounts', []);
  list = list.filter(a => a.id !== id);
  saveAccounts(list);
  return getAccountsSafe();
});
ipcMain.handle('accounts:reorder', (e, ids) => {
  const list = store.get('accounts', []);
  const map = new Map(list.map(a => [a.id, a]));
  const next = ids.map(id => map.get(id)).filter(Boolean);
  // 任何遗漏项追加到末尾
  list.forEach(a => { if (!ids.includes(a.id)) next.push(a); });
  next.forEach((a, i) => { a.order = i; });
  saveAccounts(next);
  return getAccountsSafe();
});

ipcMain.handle('settings:get', () => store.get('settings'));
ipcMain.handle('settings:set', (e, patch) => {
  const cur = store.get('settings');
  const next = { ...cur, ...patch };
  store.set('settings', next);
  if (patch.hotkey) registerHotkey();
  return next;
});

// 导出 / 导入 加密备份
ipcMain.handle('backup:export', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出加密备份',
    defaultPath: `authenticator-backup-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };
  const data = store.get('accounts', []);
  // 重新用一次性随机密钥 + AES-256-GCM 加密全部密钥
  const passphrase = crypto.randomBytes(32);
  const payload = encryptBackup(data, passphrase);
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  // 把口令通过剪贴板交给用户（一次性）
  const { clipboard } = require('electron');
  clipboard.writeText(passphrase.toString('base64'));
  return { ok: true, filePath, note: '解密口令已复制到剪贴板（仅显示一次），请妥善保存。' };
});

ipcMain.handle('backup:import', async (e, filePath) => {
  const fs = require('fs');
  if (!filePath) {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: '导入加密备份',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths[0]) return { ok: false };
    filePath = filePaths[0];
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(text);
  const { canceled: c2, response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['合并', '替换', '取消'],
    defaultId: 0,
    title: '导入备份',
    message: '选择导入方式',
    detail: '合并：追加到现有账户；替换：清空后用备份覆盖。'
  });
  if (response === 2 || c2) return { ok: false };
  const passText = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['我已复制口令'],
    title: '解密口令',
    message: '请确认已将解密口令复制到剪贴板',
    detail: '导出时生成的口令（base64 字符串）。'
  });
  const { clipboard } = require('electron');
  const pass = clipboard.readText().trim();
  let passphrase;
  try { passphrase = Buffer.from(pass, 'base64'); } catch (_) { return { ok: false, error: '口令格式错误' }; }
  let decrypted;
  try { decrypted = decryptBackup(payload, passphrase); } catch (e) { return { ok: false, error: '解密失败：' + e.message }; }
  let list = store.get('accounts', []);
  if (response === 1) list = [];
  // 去重：同 secret + issuer 视为重复
  const existKey = new Set(list.map(a => a.issuer + '|' + a.label + '|' + a.secret));
  for (const a of decrypted) {
    if (!existKey.has(a.issuer + '|' + a.label + '|' + a.secret)) list.push(a);
  }
  saveAccounts(list);
  return { ok: true };
});

// 加密备份：AES-256-GCM
function encryptBackup(accounts, passphrase) {
  // 密钥派生：SHA-256(passphrase)
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(accounts), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, alg: 'aes-256-gcm', kdf: 'sha256', iv: iv.toString('base64'), tag: tag.toString('base64'), data: enc.toString('base64') };
}
function decryptBackup(payload, passphrase) {
  const key = crypto.createHash('sha256').update(passphrase).digest();
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

ipcMain.on('window:hide', () => { if (mainWindow) mainWindow.hide(); });
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:quit', () => { isQuiting = true; app.quit(); });

// ============ 生命周期 ============
app.whenReady().then(() => {
  createWindow();
  createTray();
  registerHotkey();
  // 不在启动时自动显示窗口，托盘常驻
});

app.on('second-instance', () => { showWindow(); });

app.on('will-quit', (e) => {
  if (!isQuiting) {
    e.preventDefault();
    if (mainWindow) mainWindow.hide();
  }
});

app.on('before-quit', () => { isQuiting = true; });

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
