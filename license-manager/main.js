const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow = null;
let sessionKey = null; // 当前会话的加密密钥（明文密码派生）
let lockTimer = null;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟无操作自动锁定

function getDataFilePath() {
  const dir = path.join(app.getPath('userData'), 'license-manager');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'data.enc');
}

function getMetaFilePath() {
  const dir = path.join(app.getPath('userData'), 'license-manager');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'meta.json');
}

// 写入元数据（盐值、验证值，用于校验密码）
function writeMeta(salt, verifyTag) {
  const meta = {
    salt: salt.toString('hex'),
    verify: verifyTag.toString('hex'),
    createdAt: Date.now()
  };
  fs.writeFileSync(getMetaFilePath(), JSON.stringify(meta, null, 2), 'utf8');
}

function readMeta() {
  const p = getMetaFilePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

// 由密码派生密钥（PBKDF2）
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

// AES-256-GCM 加密
function encryptData(plainObj, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decryptData(buf, key) {
  if (buf.length < 28) throw new Error('数据格式错误');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

// 生成验证 tag（用于密码校验，不存储明文）
function makeVerifyTag(key) {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, crypto.randomBytes(12));
  cipher.update('VERIFY');
  cipher.final();
  return cipher.getAuthTag();
}

function verifyKey(key, verifyTag) {
  // 通过尝试解密一小段数据验证密码是否正确
  // 这里简单实现：再生成一次 verify tag 进行比对（实际更安全的方式见下）
  // 用 PBKDF2 输出做一次 HMAC 作为指纹
  const hmac = crypto.createHmac('sha256', key).update('LICENSE_MANAGER_VERIFY').digest();
  return crypto.timingSafeEqual(hmac.subarray(0, 16), verifyTag.subarray(0, 16));
}

function makeVerifyTagSecure(key) {
  return crypto.createHmac('sha256', key).update('LICENSE_MANAGER_VERIFY').digest();
}

function seedDemoData() {
  // 重置已有数据
  const metaPath = getMetaFilePath();
  const dataPath = getDataFilePath();
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);

  // 用固定密码初始化
  const password = 'demo123456';
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const verify = makeVerifyTagSecure(key);
  writeMeta(salt, verify);
  sessionKey = key;

  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const isoDate = (offset) => new Date(now + offset * day).toISOString().slice(0, 10);

  const demoLicenses = [
    { id: 'L-demo1', name: 'JetBrains IDEA', vendor: 'JetBrains', licenseKey: 'ABCD-EFGH-IJKL-MNOP-1234-5678', category: 'development', purchaseDate: '2025-03-15', expiryDate: isoDate(15), perpetual: false, price: 1499, maxActivations: 3, usedActivations: 2, notes: '个人订阅，续费邮箱：me@example.com', createdAt: now, updatedAt: now },
    { id: 'L-demo2', name: 'Microsoft 365', vendor: 'Microsoft', licenseKey: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', category: 'productivity', purchaseDate: '2024-11-01', expiryDate: isoDate(8), perpetual: false, price: 799, maxActivations: 5, usedActivations: 4, notes: '家庭版，6 人共享', createdAt: now, updatedAt: now },
    { id: 'L-demo3', name: 'Figma Professional', vendor: 'Figma Inc.', licenseKey: 'figma-pro-2026-annual-abc123', category: 'design', purchaseDate: '2026-01-10', expiryDate: isoDate(180), perpetual: false, price: 1200, maxActivations: 1, usedActivations: 1, notes: '设计团队主力工具', createdAt: now, updatedAt: now },
    { id: 'L-demo4', name: 'Sublime Text 4', vendor: 'Sublime HQ', licenseKey: 'SUBLIME-4-PERPETUAL-XYZ789', category: 'development', purchaseDate: '2023-06-20', expiryDate: null, perpetual: true, price: 600, maxActivations: 1, usedActivations: 1, notes: '永久授权，3 年内可免费升级', createdAt: now, updatedAt: now },
    { id: 'L-demo5', name: 'Bartender 5', vendor: 'MacPaw', licenseKey: 'BT5-MAC-2024-001', category: 'system', purchaseDate: '2024-09-01', expiryDate: isoDate(-12), perpetual: false, price: 99, maxActivations: 1, usedActivations: 1, notes: '已过期，需续费', createdAt: now, updatedAt: now },
    { id: 'L-demo6', name: '1Password Families', vendor: 'AgileBits', licenseKey: '1PW-FAM-2026-ANNUAL', category: 'security', purchaseDate: '2026-02-14', expiryDate: isoDate(200), perpetual: false, price: 286, maxActivations: 5, usedActivations: 3, notes: '5 人家庭版，年付', createdAt: now, updatedAt: now }
  ];
  saveLicenses(demoLicenses);
}

function createWindow() {
  const isScreenshot = process.argv.includes('--screenshot');
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f5f7',
    title: '许可证管理器',
    show: false,
    paintWhenInitiallyHidden: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // 截图模式：用 showInactive 显示窗口但不抢焦点
  // 窗口在屏幕内可见以保证 Chromium 正常渲染，但不打断用户工作
  if (isScreenshot) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.showInactive();
    });
  } else {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  // --demo: 初始化演示数据并自动解锁
  if (process.argv.includes('--demo')) {
    seedDemoData();
  }

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();

  // demo 模式下自动解锁进入主界面
  if (process.argv.includes('--demo')) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('demo-ready');
    });
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // 自动锁定计时
  resetLockTimer();
}

function resetLockTimer() {
  if (lockTimer) clearTimeout(lockTimer);
  lockTimer = setTimeout(() => {
    if (sessionKey) {
      sessionKey = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-locked');
      }
    }
  }, LOCK_TIMEOUT_MS);
}

function requireUnlock() {
  if (!sessionKey) {
    throw new Error('VAULT_LOCKED');
  }
}

// ============ IPC ============

// 是否已初始化（设置过主密码）
ipcMain.handle('vault:status', () => {
  const meta = readMeta();
  return { initialized: !!meta, unlocked: !!sessionKey };
});

// 设置主密码（首次）
ipcMain.handle('vault:setup', (e, password) => {
  if (password.length < 6) throw new Error('密码至少 6 位');
  const salt = crypto.randomBytes(16);
  const key = deriveKey(password, salt);
  const verify = makeVerifyTagSecure(key);
  writeMeta(salt, verify);
  sessionKey = key;
  // 写入空数据
  saveLicenses([]);
  resetLockTimer();
  return { ok: true };
});

// 解锁
ipcMain.handle('vault:unlock', (e, password) => {
  const meta = readMeta();
  if (!meta) throw new Error('未初始化');
  const salt = Buffer.from(meta.salt, 'hex');
  const verify = Buffer.from(meta.verify, 'hex');
  const key = deriveKey(password, salt);
  if (!verifyKey(key, verify)) {
    throw new Error('密码错误');
  }
  sessionKey = key;
  resetLockTimer();
  return { ok: true };
});

// 锁定
ipcMain.handle('vault:lock', () => {
  sessionKey = null;
  return { ok: true };
});

// 修改密码
ipcMain.handle('vault:changePassword', (e, oldPwd, newPwd) => {
  const meta = readMeta();
  if (!meta) throw new Error('未初始化');
  const salt = Buffer.from(meta.salt, 'hex');
  const verify = Buffer.from(meta.verify, 'hex');
  const oldKey = deriveKey(oldPwd, salt);
  if (!verifyKey(oldKey, verify)) throw new Error('原密码错误');
  // 解密现有数据
  const dataPath = getDataFilePath();
  let licenses = [];
  if (fs.existsSync(dataPath)) {
    licenses = decryptData(fs.readFileSync(dataPath), oldKey);
  }
  // 用新密码重新加密
  const newSalt = crypto.randomBytes(16);
  const newKey = deriveKey(newPwd, newSalt);
  const newVerify = makeVerifyTagSecure(newKey);
  writeMeta(newSalt, newVerify);
  sessionKey = newKey;
  saveLicenses(licenses);
  resetLockTimer();
  return { ok: true };
});

// 读取全部许可证
ipcMain.handle('licenses:list', () => {
  requireUnlock();
  return loadLicenses();
});

// 保存全部许可证（覆盖）
ipcMain.handle('licenses:save', (e, list) => {
  requireUnlock();
  saveLicenses(list);
  resetLockTimer();
  return { ok: true };
});

// 导出加密备份
ipcMain.handle('vault:export', async () => {
  requireUnlock();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出加密备份',
    defaultPath: `license-backup-${Date.now()}.lmenc`,
    filters: [{ name: 'License Manager Backup', extensions: ['lmenc'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  const dataPath = getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(result.filePath, encryptData([], sessionKey));
  } else {
    fs.copyFileSync(dataPath, result.filePath);
  }
  return { ok: true, path: result.filePath };
});

// 导入加密备份（需输入原密码）
ipcMain.handle('vault:import', async (e, importPassword) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入加密备份',
    filters: [{ name: 'License Manager Backup', extensions: ['lmenc'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false, reason: 'canceled' };
  const buf = fs.readFileSync(result.filePaths[0]);
  // 备份文件自带 salt + verify + 数据，格式：salt(16) + verify(32) + iv(12) + tag(16) + enc(...)
  if (buf.length < 16 + 32 + 28) throw new Error('备份文件损坏');
  const salt = buf.subarray(0, 16);
  const verify = buf.subarray(16, 48);
  const rest = buf.subarray(48);
  const key = deriveKey(importPassword, salt);
  if (!verifyKey(key, verify)) throw new Error('备份密码错误');
  const licenses = decryptData(rest, key);
  // 合并到当前库（按 id 去重）
  const current = loadLicenses();
  const map = new Map(current.map(l => [l.id, l]));
  let added = 0;
  for (const l of licenses) {
    if (!map.has(l.id)) { map.set(l.id, l); added++; }
  }
  const merged = Array.from(map.values());
  saveLicenses(merged);
  resetLockTimer();
  return { ok: true, added, total: merged.length };
});

ipcMain.handle('app:openExternal', (e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('app:resetActivity', () => {
  resetLockTimer();
  return { ok: true };
});

function loadLicenses() {
  const dataPath = getDataFilePath();
  if (!fs.existsSync(dataPath)) return [];
  try {
    return decryptData(fs.readFileSync(dataPath), sessionKey);
  } catch (e) {
    console.error('解密失败：', e);
    return [];
  }
}

function saveLicenses(list) {
  const buf = encryptData(list, sessionKey);
  fs.writeFileSync(getDataFilePath(), buf);
}

// 单例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
