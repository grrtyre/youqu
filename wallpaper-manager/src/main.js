// Electron 主进程 - 壁纸管理器
// 苹果白高端风格：白色背景、细腻阴影、系统字体、蓝色强调 #007aff

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');

// 配置文件路径
const USER_DATA = app.getPath('userData');
const CONFIG_FILE = path.join(USER_DATA, 'config.json');
const WALLPAPER_CACHE = path.join(USER_DATA, 'wallpapers');
const THUMB_CACHE = path.join(USER_DATA, 'thumbnails');

// 确保缓存目录存在
function ensureDirs() {
  if (!fs.existsSync(WALLPAPER_CACHE)) fs.mkdirSync(WALLPAPER_CACHE, { recursive: true });
  if (!fs.existsSync(THUMB_CACHE)) fs.mkdirSync(THUMB_CACHE, { recursive: true });
}

// 默认配置
function defaultConfig() {
  return {
    sources: [],          // 壁纸来源文件夹列表
    favorites: [],        // 收藏壁纸路径
    currentWallpaper: '', // 当前壁纸
    autoChange: false,    // 是否启用自动切换
    intervalHours: 6,     // 切换间隔（小时）
    lastChange: 0,        // 上次切换时间戳
    bingDaily: false,     // 启用必应每日壁纸
    bingLastDate: '',     // 必应壁纸最后下载日期 YYYY-MM-DD
    favorites_only: false  // 仅显示收藏
  };
}

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return Object.assign(defaultConfig(), cfg);
    }
  } catch (e) {
    console.error('加载配置失败:', e.message);
  }
  return defaultConfig();
}

// 保存配置
function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存配置失败:', e.message);
  }
}

let config = null;
let mainWindow = null;
let tray = null;
let autoChangeTimer = null;

// 支持的图片扩展名
const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.gif'];

// 扫描文件夹内所有图片
function scanFolder(dir, recursive = true) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = path.join(dir, item.name);
      if (item.isDirectory() && recursive) {
        results.push(...scanFolder(full, true));
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (IMG_EXTS.includes(ext)) {
          const stat = fs.statSync(full);
          results.push({
            path: full,
            name: item.name,
            size: stat.size,
            mtime: stat.mtimeMs
          });
        }
      }
    }
  } catch (e) {
    console.error('扫描目录失败:', dir, e.message);
  }
  return results;
}

// 设置 Windows 壁纸
function setWindowsWallpaper(imgPath) {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('当前仅支持 Windows 系统'));
    }
    // 转换为绝对路径并使用正斜杠
    const abs = path.resolve(imgPath).replace(/\\/g, '\\\\');
    // 通过 PowerShell 修改注册表并刷新
    const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class WP{[DllImport("user32.dll",CharSet=CharSet.Auto)]public static extern int SystemParametersInfo(int uAction,int uParam,string lpvParam,int fuWinIni);}';[WP]::SystemParametersInfo(0x0014,0,'${abs}',3)`;
    exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('设置壁纸失败:', err.message, stderr);
        return reject(new Error('设置壁纸失败: ' + err.message));
      }
      resolve(stdout.trim());
    });
  });
}

// 下载文件
function downloadFile(url, dest, useHttps = true) {
  return new Promise((resolve, reject) => {
    const lib = useHttps ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(url, { timeout: 15000 }, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        // 跟随重定向
        file.close();
        fs.unlinkSync(dest);
        return resolve(downloadFile(resp.headers.location, dest, resp.headers.location.startsWith('https')));
      }
      if (resp.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error('下载失败 HTTP ' + resp.statusCode));
      }
      resp.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', (e) => {
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(e);
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('下载超时'));
    });
  });
}

// 获取必应每日壁纸
async function fetchBingDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (config.bingLastDate === today) {
    // 已下载过今天的，返回缓存
    const cached = path.join(WALLPAPER_CACHE, `bing-${today}.jpg`);
    if (fs.existsSync(cached)) return cached;
  }
  // HPImageArchive 接口
  const apiUrl = 'https://bing.img.run/api/1920/1080';
  // 备用：直接用必应官方接口
  const bingApi = 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&m=zh-CN';
  const dest = path.join(WALLPAPER_CACHE, `bing-${today}.jpg`);
  try {
    const data = await new Promise((resolve, reject) => {
      https.get(bingApi, { timeout: 15000 }, (resp) => {
        let body = '';
        resp.on('data', (c) => body += c);
        resp.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    const imgUrl = 'https://www.bing.com' + data.images[0].url;
    await downloadFile(imgUrl, dest, true);
    config.bingLastDate = today;
    saveConfig(config);
    return dest;
  } catch (e) {
    console.error('必应每日壁纸失败:', e.message);
    return null;
  }
}

// 执行自动切换
async function performAutoChange() {
  try {
    let pool = [];
    for (const src of config.sources) {
      pool.push(...scanFolder(src));
    }
    if (config.favorites.length > 0) {
      // 优先从收藏中切换
      pool = config.favorites.map(p => ({ path: p, name: path.basename(p), size: 0, mtime: 0 })).concat(pool);
    }
    if (pool.length === 0) return;
    const next = pool[Math.floor(Math.random() * pool.length)];
    await setWindowsWallpaper(next.path);
    config.currentWallpaper = next.path;
    config.lastChange = Date.now();
    saveConfig(config);
    if (Notification.isSupported()) {
      new Notification({
        title: '壁纸已切换',
        body: path.basename(next.path),
        silent: true
      }).show();
    }
  } catch (e) {
    console.error('自动切换失败:', e.message);
  }
}

// 启动自动切换定时器
function startAutoChangeTimer() {
  if (autoChangeTimer) {
    clearInterval(autoChangeTimer);
    autoChangeTimer = null;
  }
  if (!config.autoChange) return;
  const intervalMs = Math.max(1, config.intervalHours) * 60 * 60 * 1000;
  // 检查间隔（每 5 分钟检查是否到点）
  autoChangeTimer = setInterval(async () => {
    const elapsed = Date.now() - (config.lastChange || 0);
    if (elapsed >= intervalMs) {
      await performAutoChange();
    }
  }, 5 * 60 * 1000);
  // 启动时如果已到点立即执行一次
  const elapsed = Date.now() - (config.lastChange || 0);
  if (elapsed >= intervalMs) {
    performAutoChange();
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: '壁纸管理器',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform === 'darwin',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 关闭时最小化到托盘
  mainWindow.on('close', (e) => {
    if (app.isQuiting) return;
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// 创建系统托盘
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    // 临时使用 16x16 蓝色方块
    icon = nativeImage.createFromBuffer(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVR4nO3OQQ0AIAwEMP7d3xkBQy4QYAcT/W8QkC3rl0m92u1Wp9NpPB6Px+PxeDweD5fL5XK5XC6Xy+VyuVwul8vl8vkDCnUFEj8bR1UAAAAASUVORK5CYII=',
      'base64'
    ));
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: '切换壁纸', click: () => performAutoChange() },
    { label: '必应每日壁纸', click: async () => {
      const f = await fetchBingDaily();
      if (f) { await setWindowsWallpaper(f); config.currentWallpaper = f; saveConfig(config); }
    }},
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuiting = true; app.quit(); } }
  ]);
  tray.setToolTip('壁纸管理器');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) { if (mainWindow.isVisible()) mainWindow.hide(); else { mainWindow.show(); mainWindow.focus(); } }
  });
}

// 单例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    ensureDirs();
    config = loadConfig();
    createWindow();
    createTray();
    startAutoChangeTimer();
    // 启动时若启用必应每日，自动下载
    if (config.bingDaily) fetchBingDaily().then((f) => {
      if (f && mainWindow) mainWindow.webContents.send('bing-updated', f);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // 不退出，保持托盘运行
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });

  app.on('before-quit', () => { app.isQuiting = true; });
}

// ===== IPC 处理 =====
ipcMain.handle('config:get', () => config);

ipcMain.handle('config:set', (e, patch) => {
  Object.assign(config, patch);
  saveConfig(config);
  if ('autoChange' in patch || 'intervalHours' in patch) {
    startAutoChangeTimer();
  }
  return config;
});

ipcMain.handle('sources:add', async (e) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择壁纸文件夹',
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  for (const dir of result.filePaths) {
    if (!config.sources.includes(dir)) config.sources.push(dir);
  }
  saveConfig(config);
  return result.filePaths;
});

ipcMain.handle('sources:remove', (e, dir) => {
  config.sources = config.sources.filter(s => s !== dir);
  saveConfig(config);
  return config.sources;
});

ipcMain.handle('wallpapers:list', async (e) => {
  let pool = [];
  for (const src of config.sources) {
    pool.push(...scanFolder(src));
  }
  // 去重
  const seen = new Set();
  pool = pool.filter(w => {
    if (seen.has(w.path)) return false;
    seen.add(w.path); return true;
  });
  // 排序：收藏优先
  pool.sort((a, b) => {
    const af = config.favorites.includes(a.path) ? 0 : 1;
    const bf = config.favorites.includes(b.path) ? 0 : 1;
    if (af !== bf) return af - bf;
    return b.mtime - a.mtime;
  });
  return pool;
});

ipcMain.handle('wallpaper:set', async (e, imgPath) => {
  await setWindowsWallpaper(imgPath);
  config.currentWallpaper = imgPath;
  config.lastChange = Date.now();
  saveConfig(config);
  return true;
});

ipcMain.handle('favorite:toggle', (e, imgPath) => {
  const i = config.favorites.indexOf(imgPath);
  if (i >= 0) config.favorites.splice(i, 1);
  else config.favorites.push(imgPath);
  saveConfig(config);
  return config.favorites.includes(imgPath);
});

ipcMain.handle('bing:fetch', async (e) => {
  const f = await fetchBingDaily();
  return f;
});

ipcMain.handle('wallpaper:open-folder', (e, imgPath) => {
  shell.showItemInFolder(imgPath);
  return true;
});

ipcMain.handle('app:quit', () => {
  app.isQuiting = true;
  app.quit();
});
