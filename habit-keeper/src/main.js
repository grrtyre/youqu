// Electron 主进程
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { HabitStore } = require('./core/habit-store');

// 用户数据目录：userData/habits.json（保持本地、与配置分离）
function storePath() {
  return path.join(app.getPath('userData'), 'habits.json');
}

let store;
let mainWindow;

function ensureStore() {
  if (!store) store = new HabitStore(storePath());
  return store;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 920,
    minWidth: 880,
    minHeight: 620,
    title: '习惯管家',
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

  // 开发模式 devtools
  if (process.env.HK_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：环境变量 HK_AUTO_SCREENSHOT 指定输出路径，应用启动后自动截屏
  if (process.env.HK_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          // 等渲染完成（首次启动会创建示例习惯+历史记录，耗时较长）
          await new Promise((r) => setTimeout(r, 3500));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.HK_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.HK_AUTO_SCREENSHOT, buf.length, 'bytes');
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 800);
    });
  }
}

app.whenReady().then(() => {
  // 测试模式：清空旧数据，确保 init() 会创建示例习惯+历史记录
  if (process.env.HK_AUTO_SCREENSHOT) {
    try {
      const p = storePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('[test] failed to clear data:', e.message);
    }
  }
  ensureStore();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====
ipcMain.handle('habit:list', () => ensureStore().list());
ipcMain.handle('habit:get', (e, id) => ensureStore().get(id));
ipcMain.handle('habit:create', (e, data) => ensureStore().create(data || {}));
ipcMain.handle('habit:update', (e, id, patch) => ensureStore().update(id, patch || {}));
ipcMain.handle('habit:remove', (e, id) => ensureStore().remove(id));
ipcMain.handle('habit:toggle', (e, id, dateKey) => {
  const date = dateKey ? new Date(dateKey) : new Date();
  return ensureStore().toggle(id, date);
});
ipcMain.handle('habit:export', () => ensureStore().exportJSON());

ipcMain.handle('habit:import', async (e, jsonStr) => {
  try {
    ensureStore().importJSON(jsonStr);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('dialog:saveExport', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出习惯数据',
    defaultPath: `habits-${Date.now()}.json`,
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
  const r = ensureStore().importJSON(txt);
  return { ok: true, count: r.habits.length };
});
