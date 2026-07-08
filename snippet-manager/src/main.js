// Electron 主进程
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu, nativeImage, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { SnippetStore } = require('./core/snippet-store');

function storePath() {
  return path.join(app.getPath('userData'), 'snippets.json');
}

let store;
let mainWindow;
let tray;

function ensureStore() {
  if (!store) store = new SnippetStore(storePath());
  return store;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '代码片段管家',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.env.SM_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：环境变量 SM_AUTO_SCREENSHOT 指定输出路径
  if (process.env.SM_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await new Promise((r) => setTimeout(r, 2500));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.SM_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.SM_AUTO_SCREENSHOT, buf.length, 'bytes');
          app.quit();
        } catch (e) {
          console.error('[screenshot] error:', e.message);
          app.quit();
        }
      }, 600);
    });
  }
}

function createTray() {
  let iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    // 降级：用 1x1 透明图
    const img = nativeImage.createEmpty();
    tray = new Tray(img);
  } else {
    tray = new Tray(iconPath);
  }
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '新建片段', accelerator: 'CmdOrCtrl+N', click: () => { showMainWindow(); mainWindow.webContents.send('menu:new'); } },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]);
  tray.setToolTip('代码片段管家');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
}

app.whenReady().then(() => {
  // 截图模式：清空旧数据，确保首次启动注入示例
  if (process.env.SM_AUTO_SCREENSHOT) {
    try {
      const p = storePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('[test] failed to clear data:', e.message);
    }
  }
  ensureStore();
  store.seedIfEmpty();
  createWindow();
  createTray();

  // 全局快捷键：Ctrl+Shift+S 唤起
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    showMainWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', (e) => {
  // 截图/测试模式：允许正常退出
  if (process.env.SM_AUTO_SCREENSHOT) return;
  // 关闭窗口时不退出，保留托盘
  if (process.platform !== 'darwin') {
    e.preventDefault();
  }
});

// 退出时注销快捷键
app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});

// ===== IPC =====
ipcMain.handle('snippet:list', () => ensureStore().list());
ipcMain.handle('snippet:get', (e, id) => ensureStore().get(id));
ipcMain.handle('snippet:create', (e, data) => ensureStore().create(data || {}));
ipcMain.handle('snippet:update', (e, id, patch) => ensureStore().update(id, patch || {}));
ipcMain.handle('snippet:remove', (e, id) => ensureStore().remove(id));
ipcMain.handle('snippet:toggleFav', (e, id) => ensureStore().toggleFavorite(id));
ipcMain.handle('snippet:togglePin', (e, id) => ensureStore().togglePin(id));
ipcMain.handle('snippet:search', (e, q) => ensureStore().search(q));
ipcMain.handle('snippet:languages', () => ensureStore().languages());
ipcMain.handle('snippet:tags', () => ensureStore().tags());
ipcMain.handle('snippet:favorites', () => ensureStore().favorites());
ipcMain.handle('snippet:count', () => ensureStore().count());

ipcMain.handle('snippet:export', () => ensureStore().exportJSON());

ipcMain.handle('snippet:import', async (e, jsonStr, mode) => {
  try {
    return { ok: true, ...ensureStore().importJSON(jsonStr, mode) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('dialog:saveExport', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出片段数据',
    defaultPath: `snippets-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, ensureStore().exportJSON(), 'utf-8');
  return res.filePath;
});

ipcMain.handle('dialog:pickImport', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择导入文件',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const txt = fs.readFileSync(res.filePaths[0], 'utf-8');
  const r = ensureStore().importJSON(txt, 'merge');
  return { ok: true, count: r.count };
});

// 复制到剪贴板
ipcMain.handle('clipboard:write', (e, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});
