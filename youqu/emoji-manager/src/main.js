// src/main.js — 表情管家主进程
const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { getAllCategories, getAllEmojis } = require('./core/emoji-data');
const store = require('./core/store');

let main = null;
let tray = null;

function createWindow() {
  main = new BrowserWindow({
    width: 1080, height: 720, minWidth: 820, minHeight: 560,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'hiddenInset',
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  main.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  main.on('closed', () => { main = null; });
  // 自动截图模式：不显示窗口，后台 capturePage
  if (process.env.EMOJI_AUTOSHOT === '1') {
    // ready-to-show 不调用 show()，保持窗口隐藏
  } else {
    main.once('ready-to-show', () => { main.show(); });
  }

  // 自动截图（仅测试用：EMOJI_AUTOSHOT=1 时加载完成后截图并退出）
  if (process.env.EMOJI_AUTOSHOT === '1') {
    main.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await main.webContents.capturePage();
          const dir = 'D:\\Ai\\mimo\\screenshots';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'emoji-manager.png'), img.toPNG());
          console.log('SHOT_OK');
        } catch (e) { console.error('SHOT_ERR', e); }
        app.quit();
      }, 3000);
    });
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let img;
  if (fs.existsSync(iconPath)) {
    img = nativeImage.createFromPath(iconPath);
  } else {
    img = nativeImage.createEmpty();
  }
  tray = new Tray(img);
  const menu = Menu.buildFromTemplate([
    { label: '显示表情管家', click: () => { if (main) { main.show(); main.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('表情管家');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (main) { if (main.isVisible()) main.hide(); else { main.show(); main.focus(); } }
    else createWindow();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  // 全局快捷键：Ctrl+Shift+E 显示/隐藏
  globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (main) {
      if (main.isVisible()) { main.hide(); }
      else { main.show(); main.focus(); }
    } else {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 关闭窗口时隐藏到托盘而非退出（macOS 行为）
  if (process.platform !== 'darwin') {
    // Windows 下也保留托盘，由托盘菜单退出
  }
});

app.on('activate', () => { if (!main) createWindow(); });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ============ IPC：数据 ============
ipcMain.handle('emoji-get-categories', () => {
  return getAllCategories();
});

ipcMain.handle('emoji-get-all', () => {
  return getAllEmojis();
});

ipcMain.handle('emoji-search', (_e, keyword) => {
  if (!keyword || !keyword.trim()) return [];
  const kw = keyword.trim().toLowerCase();
  const all = getAllEmojis();
  return all.filter(e => {
    if (e.n && e.n.toLowerCase().includes(kw)) return true;
    if (e.k && e.k.toLowerCase().includes(kw)) return true;
    if (e.c && e.c.includes(keyword.trim())) return true;
    return false;
  });
});

// ============ IPC：复制 ============
ipcMain.handle('emoji-copy', (_e, char) => {
  try {
    clipboard.writeText(char);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============ IPC：收藏 ============
ipcMain.handle('emoji-get-favorites', () => store.getFavorites());
ipcMain.handle('emoji-toggle-favorite', (_e, item) => store.toggleFavorite(item));
ipcMain.handle('emoji-is-favorite', (_e, char) => store.isFavorite(char));

// ============ IPC：历史 ============
ipcMain.handle('emoji-get-history', () => store.getHistory());
ipcMain.handle('emoji-add-history', (_e, item) => {
  store.addHistory(item);
  return store.getHistory();
});
ipcMain.handle('emoji-clear-history', () => store.clearHistory());

// ============ IPC：窗口控制 ============
ipcMain.handle('window-min', () => { if (main) main.minimize(); return true; });
ipcMain.handle('window-max', () => {
  if (!main) return false;
  if (main.isMaximized()) { main.unmaximize(); return false; }
  main.maximize(); return true;
});
ipcMain.handle('window-close', () => { if (main) { main.hide(); } return true; });
