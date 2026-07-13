// Electron 主进程
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { AnniversaryStore } = require('./core/store');
const { computeEventInfo } = require('./core/anniversary-core');

function storePath() {
  return path.join(app.getPath('userData'), 'anniversaries.json');
}

let store;
let mainWindow;

function ensureStore() {
  if (!store) store = new AnniversaryStore(storePath());
  return store;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 980,
    minWidth: 940,
    minHeight: 640,
    title: '纪念日管家',
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

  if (process.env.AM_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：环境变量指定输出路径
  if (process.env.AM_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await new Promise((r) => setTimeout(r, 2500));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.AM_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.AM_AUTO_SCREENSHOT, buf.length, 'bytes');
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 600);
    });
  }
}

app.whenReady().then(() => {
  // 测试/截图模式：清空旧数据，确保 seedDemo 会创建示例
  if (process.env.AM_DEMO || process.env.AM_AUTO_SCREENSHOT) {
    try {
      const p = storePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('[test] failed to clear data:', e.message);
    }
  }
  ensureStore();
  ensureStore().seedDemo();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====
ipcMain.handle('anniv:list', () => {
  const today = todayStr();
  return ensureStore().list().map((e) => computeEventInfo(e, today));
});

ipcMain.handle('anniv:get', (e, id) => {
  const evt = ensureStore().get(id);
  return evt ? { ...evt } : null;
});

ipcMain.handle('anniv:create', (e, data) => {
  const evt = ensureStore().create(data || {});
  return computeEventInfo(evt, todayStr());
});

ipcMain.handle('anniv:update', (e, id, patch) => {
  const evt = ensureStore().update(id, patch || {});
  return computeEventInfo(evt, todayStr());
});

ipcMain.handle('anniv:remove', (e, id) => ensureStore().remove(id));

ipcMain.handle('anniv:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出纪念日数据',
    defaultPath: `anniversaries-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  fs.writeFileSync(res.filePath, ensureStore().exportJSON(), 'utf-8');
  return res.filePath;
});

ipcMain.handle('anniv:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: '选择导入文件',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  const txt = fs.readFileSync(res.filePaths[0], 'utf-8');
  const r = ensureStore().importJSON(txt);
  return r;
});

ipcMain.handle('anniv:today', () => todayStr());
