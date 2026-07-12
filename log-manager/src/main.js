'use strict';

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

// 最近文件存储路径
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-files.json');
// 最大读取文件大小（30MB），超过则只读末尾
const MAX_READ_SIZE = 30 * 1024 * 1024;
// 大文件截断后读取的末尾大小
const TAIL_SIZE = 20 * 1024 * 1024;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '日志管家',
    backgroundColor: '#f5f5f7',
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 演示模式：自动加载指定日志文件（用于截图测试）
  const demoFile = process.env.LM_DEMO_FILE;
  if (demoFile) {
    mainWindow.webContents.once('did-finish-load', () => {
      try {
        const data = readLogFile(demoFile);
        startWatching(demoFile);
        mainWindow.webContents.send('demo:load', { data });
      } catch (e) {
        // 忽略
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximize', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximize', false));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// ---------- 应用菜单 ----------

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '打开日志文件', accelerator: 'CmdOrCtrl+O', click: () => mainWindow && mainWindow.webContents.send('menu:open') },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'copy', label: '复制' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '搜索', accelerator: 'CmdOrCtrl+F', click: () => mainWindow && mainWindow.webContents.send('menu:search') }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '打开爱发电', click: () => shell.openExternal(AFDIAN_URL) },
        { label: '关于日志管家', click: () => mainWindow && mainWindow.webContents.send('show-about') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- 文件读取（支持编码检测与大文件截断） ----------

function readLogFile(filePath) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  let truncated = false;
  let offset = 0;
  if (size > MAX_READ_SIZE) {
    truncated = true;
    offset = size - TAIL_SIZE;
  }
  // 读取字节
  const fd = fs.openSync(filePath, 'r');
  let buf;
  try {
    buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
  } finally {
    fs.closeSync(fd);
  }
  // 大文件截断时跳过首行（可能不完整）
  if (truncated) {
    const firstNl = buf.indexOf(10); // \n
    if (firstNl >= 0) {
      buf = buf.slice(firstNl + 1);
    }
  }
  // 编码检测
  const encoding = detectEncodingLocal(buf);
  let content;
  if (encoding === 'utf-8-bom') {
    content = buf.slice(3).toString('utf-8');
  } else if (encoding === 'utf-8') {
    content = buf.toString('utf-8');
  } else if (encoding === 'utf-16le') {
    content = buf.slice(2).toString('utf16le');
  } else if (encoding === 'utf-16be') {
    content = buf.slice(2).swap16().toString('utf16le');
  } else {
    // GBK 解码：用 TextDecoder 若支持，否则 fallback
    try {
      const td = new TextDecoder('gbk');
      content = td.decode(buf);
    } catch (e) {
      content = buf.toString('latin1');
    }
  }
  return {
    path: filePath,
    name: path.basename(filePath),
    size,
    encoding,
    content,
    truncated,
    truncatedOffset: offset
  };
}

// 复用核心模块的编码检测
function detectEncodingLocal(buf) {
  // 内联实现以避免 require 路径问题
  if (!buf || buf.length === 0) return 'utf-8';
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) return 'utf-8-bom';
  if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) return 'utf-16le';
  if (buf.length >= 2 && buf[0] === 0xFE && buf[1] === 0xFF) return 'utf-16be';
  // UTF-8 校验
  let i = 0;
  let valid = true;
  while (i < buf.length) {
    const b = buf[i];
    if (b <= 0x7F) { i++; continue; }
    let need;
    if ((b & 0xE0) === 0xC0) need = 1;
    else if ((b & 0xF0) === 0xE0) need = 2;
    else if ((b & 0xF8) === 0xF0) need = 3;
    else { valid = false; break; }
    for (let j = 1; j <= need; j++) {
      if (i + j >= buf.length || (buf[i + j] & 0xC0) !== 0x80) { valid = false; break; }
    }
    if (!valid) break;
    i += 1 + need;
  }
  return valid ? 'utf-8' : 'gbk';
}

// ---------- 文件监听（实时跟踪） ----------

const watchers = new Map(); // filePath -> { watcher, size, lastContent }

function startWatching(filePath) {
  stopWatching(filePath);
  let currentSize;
  try {
    currentSize = fs.statSync(filePath).size;
  } catch (e) {
    currentSize = 0;
  }
  // Windows 上 fs.watch 对大文件较不稳定，使用轮询兜底
  let pollTimer = null;
  const poll = () => {
    fs.stat(filePath, (err, stat) => {
      if (err) {
        // 文件被删除或重命名
        if (mainWindow) mainWindow.webContents.send('file:removed', { path: filePath });
        return;
      }
      if (stat.size > currentSize) {
        // 文件增长，读取新增部分
        try {
          const fd = fs.openSync(filePath, 'r');
          const len = stat.size - currentSize;
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, currentSize);
          fs.closeSync(fd);
          let encoding = detectEncodingLocal(buf);
          let text;
          if (encoding === 'utf-8-bom') text = buf.slice(3).toString('utf-8');
          else if (encoding === 'gbk') {
            try { text = new TextDecoder('gbk').decode(buf); }
            catch (e) { text = buf.toString('latin1'); }
          } else text = buf.toString('utf-8');
          currentSize = stat.size;
          if (mainWindow) mainWindow.webContents.send('file:appended', { path: filePath, text });
        } catch (e) {
          // 忽略瞬时错误
        }
      } else if (stat.size < currentSize) {
        // 文件被截断/轮转，重新读取整个文件
        currentSize = stat.size;
        try {
          const data = readLogFile(filePath);
          if (mainWindow) mainWindow.webContents.send('file:rotated', { path: filePath, data });
        } catch (e) {
          // 忽略
        }
      }
    });
  };
  pollTimer = setInterval(poll, 1000);
  // 同时使用 fs.watch 以更快响应
  let fsWatcher;
  try {
    fsWatcher = fs.watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === 'change') poll();
    });
    fsWatcher.on('error', () => {});
  } catch (e) {
    // 忽略，轮询兜底
  }
  watchers.set(filePath, { watcher: fsWatcher, size: currentSize, pollTimer });
}

function stopWatching(filePath) {
  const w = watchers.get(filePath);
  if (!w) return;
  if (w.pollTimer) clearInterval(w.pollTimer);
  if (w.watcher) {
    try { w.watcher.close(); } catch (e) {}
  }
  watchers.delete(filePath);
}

function stopAllWatching() {
  for (const p of Array.from(watchers.keys())) stopWatching(p);
}

// ---------- 最近文件管理 ----------

function loadRecent() {
  try {
    const raw = fs.readFileSync(RECENT_FILE, 'utf-8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveRecent(list) {
  try {
    fs.writeFileSync(RECENT_FILE, JSON.stringify(list.slice(0, 12)), 'utf-8');
  } catch (e) {
    // 忽略写入错误
  }
}

function addRecent(filePath) {
  let list = loadRecent().filter(p => p !== filePath);
  list.unshift(filePath);
  list = list.slice(0, 12);
  saveRecent(list);
  return list;
}

// ---------- IPC ----------

ipcMain.handle('log:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开日志文件',
    filters: [
      { name: '日志文件', extensions: ['log', 'txt', 'out', 'err'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = result.filePaths[0];
  try {
    const data = readLogFile(filePath);
    addRecent(filePath);
    startWatching(filePath);
    return { canceled: false, data, recent: loadRecent() };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('log:openPath', async (event, filePath) => {
  if (typeof filePath !== 'string') return { error: '路径无效' };
  try {
    const data = readLogFile(filePath);
    addRecent(filePath);
    startWatching(filePath);
    return { data, recent: loadRecent() };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('log:watch', async (event, filePath) => {
  if (typeof filePath === 'string') {
    startWatching(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('log:unwatch', async (event, filePath) => {
  if (typeof filePath === 'string') stopWatching(filePath);
  return true;
});

ipcMain.handle('log:recent', async () => {
  // 过滤掉已不存在的文件
  const list = loadRecent();
  const exists = list.filter(p => {
    try { return fs.existsSync(p); } catch (e) { return false; }
  });
  if (exists.length !== list.length) saveRecent(exists);
  return exists;
});

ipcMain.handle('log:clearRecent', async () => {
  saveRecent([]);
  return [];
});

ipcMain.handle('log:export', async (event, data) => {
  if (!data || !data.content) return { canceled: true };
  const defaultName = (data.suggestedName || '日志导出') + '.txt';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出筛选结果',
    defaultPath: defaultName,
    filters: [
      { name: '文本文件', extensions: ['txt'] },
      { name: '日志文件', extensions: ['log'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (result.canceled) return { canceled: true };
  try {
    fs.writeFileSync(result.filePath, data.content, 'utf-8');
    return { canceled: false, path: result.filePath };
  } catch (e) {
    return { canceled: false, error: e.message };
  }
});

ipcMain.handle('shell:openExternal', (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
  return true;
});

ipcMain.handle('shell:showItem', (event, p) => {
  if (typeof p === 'string') shell.showItemInFolder(p);
  return true;
});

ipcMain.handle('app:info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    afdian: AFDIAN_URL,
    platform: process.platform
  };
});

// ---------- 窗口控制 ----------

ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('window:isMaximized', () => !!(mainWindow && mainWindow.isMaximized()));

// ---------- 生命周期 ----------

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopAllWatching();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAllWatching();
});
