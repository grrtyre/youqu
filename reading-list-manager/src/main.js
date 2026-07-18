// Electron 主进程 - 窗口管理、系统托盘、全局热键、本地存储

'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const logic = require('./logic');

let mainWindow = null;
let tray = null;
let isQuiting = false;

// 数据存储路径
function getDataFilePath() {
  return path.join(app.getPath('userData'), 'reading-list.json');
}

// 读取所有文章
function loadArticles() {
  const filePath = getDataFilePath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return logic.deserializeArticles(content);
  } catch (err) {
    console.error('读取文章失败:', err);
    return [];
  }
}

// 保存所有文章
function saveArticles(articles) {
  const filePath = getDataFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, logic.serializeArticles(articles), 'utf-8');
    return true;
  } catch (err) {
    console.error('保存文章失败:', err);
    return false;
  }
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '稍后阅读管理器',
    backgroundColor: '#fafafa',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 关闭时最小化到托盘（而不是退出）
  mainWindow.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 失焦时自动隐藏到托盘（小工具风格，可在设置中关闭，此处默认开启）
  // mainWindow.on('blur', () => mainWindow.hide());  // 暂不启用避免开发期困扰
}

// 获取图标路径（不存在则返回 null）
function getIconPath() {
  const candidates = [
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, 'assets', 'icon.ico')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// 创建托盘
function createTray() {
  const iconPath = getIconPath();
  const trayIcon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  // Windows 托盘图标建议 16x16
  if (!iconPath) {
    // 没有图标文件时使用一个 1x1 透明占位（避免崩溃）
    tray = new Tray(trayIcon);
  } else {
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: '稍后阅读管理器', enabled: false },
    { type: 'separator' },
    {
      label: '从剪贴板快速添加',
      accelerator: 'Ctrl+Shift+L',
      click: () => quickAddFromClipboard()
    },
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('稍后阅读管理器');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 从剪贴板快速添加 URL
function quickAddFromClipboard() {
  const clipboard = require('electron').clipboard;
  const text = clipboard.readText().trim();
  if (logic.isValidUrl(text)) {
    const articles = loadArticles();
    const normalized = logic.normalizeUrl(text);
    // 防止重复添加
    if (articles.some(a => a.url === normalized)) {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('article:already-exists', normalized);
      }
      return;
    }
    const article = logic.createArticle({
      url: text,
      title: logic.getDomain(text),
      tags: []
    });
    article.id = logic.generateId();
    articles.unshift(article);
    saveArticles(articles);
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('article:added-from-clipboard', article);
    }
  } else {
    // 剪贴板不是 URL，显示主窗口让用户手动添加
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('clipboard:not-url');
    }
  }
}

// 单实例锁
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // 注册全局热键 Ctrl+Shift+L
    globalShortcut.register('CommandOrControl+Shift+L', quickAddFromClipboard);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else if (mainWindow) mainWindow.show();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux 关闭所有窗口时不退出，保持托盘常驻
    // 用户通过托盘菜单退出
  }
});

app.on('before-quit', () => {
  isQuiting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ===== IPC 处理 =====

ipcMain.handle('articles:list', async () => {
  return loadArticles();
});

ipcMain.handle('articles:add', async (_event, data) => {
  try {
    const articles = loadArticles();
    const article = logic.createArticle(data);
    article.id = logic.generateId();
    // 防止重复 URL
    if (articles.some(a => a.url === article.url)) {
      return { ok: false, error: '该 URL 已存在' };
    }
    articles.unshift(article);
    saveArticles(articles);
    return { ok: true, article };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('articles:update', async (_event, id, data) => {
  try {
    const articles = loadArticles();
    const idx = articles.findIndex(a => a.id === id);
    if (idx === -1) return { ok: false, error: '文章不存在' };
    const original = articles[idx];
    // 如果 URL 变更，需要重新校验和规范化
    let newUrl = original.url;
    if (data.url && data.url !== original.url) {
      const normalized = logic.normalizeUrl(data.url);
      if (!normalized) return { ok: false, error: 'URL 不合法' };
      newUrl = normalized;
    }
    const updated = {
      ...original,
      url: newUrl,
      title: data.title !== undefined ? String(data.title).trim() : original.title,
      notes: data.notes !== undefined ? String(data.notes).trim() : original.notes,
      tags: data.tags !== undefined ? logic.parseTags(data.tags) : original.tags,
      status: logic.transitionStatus(original.status, data.status || original.status),
      updatedAt: Date.now()
    };
    // 状态变为已读时记录时间
    if (data.status === logic.STATUS.READ && original.status !== logic.STATUS.READ) {
      updated.readAt = Date.now();
    }
    articles[idx] = updated;
    saveArticles(articles);
    return { ok: true, article: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('articles:delete', async (_event, id) => {
  try {
    const articles = loadArticles();
    const filtered = articles.filter(a => a.id !== id);
    if (filtered.length === articles.length) {
      return { ok: false, error: '文章不存在' };
    }
    saveArticles(filtered);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('articles:stats', async () => {
  return logic.getStats(loadArticles());
});

ipcMain.handle('articles:tags', async () => {
  return logic.getAllTags(loadArticles());
});

ipcMain.handle('articles:export', async () => {
  return logic.serializeArticles(loadArticles());
});

ipcMain.handle('articles:import', async (_event, jsonString) => {
  try {
    const imported = logic.deserializeArticles(jsonString);
    const existing = loadArticles();
    const existingUrls = new Set(existing.map(a => a.url));
    let added = 0;
    for (const article of imported) {
      if (!existingUrls.has(article.url)) {
        article.id = logic.generateId();
        existing.push(article);
        existingUrls.add(article.url);
        added++;
      }
    }
    saveArticles(existing);
    return { ok: true, added, total: existing.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('open:external', async (_event, url) => {
  if (!logic.isValidUrl(url)) return { ok: false, error: 'URL 不合法' };
  await shell.openExternal(url);
  return { ok: true };
});
