// Electron 主进程
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { AccountStore } = require('./core/transaction-store');

// 用户数据目录：userData/accounting.json（保持本地、与配置分离）
function storePath() {
  return path.join(app.getPath('userData'), 'accounting.json');
}

let store;
let mainWindow;

function ensureStore() {
  if (!store) store = new AccountStore(storePath());
  return store;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: '记账管家',
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

  // 自动截图：环境变量 AM_AUTO_SCREENSHOT 指定输出路径，应用启动后自动截屏
  if (process.env.AM_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await new Promise((r) => setTimeout(r, 1500));
          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.AM_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.AM_AUTO_SCREENSHOT, buf.length, 'bytes');
          // 可选：截取"清空数据"确认对话框状态
          if (process.env.AM_SCREENSHOT_CONFIRM) {
            await mainWindow.webContents.executeJavaScript('document.getElementById("btnClear").click()');
            await new Promise((r) => setTimeout(r, 700));
            const img2 = await mainWindow.webContents.capturePage();
            const buf2 = img2.toPNG();
            fs.writeFileSync(process.env.AM_SCREENSHOT_CONFIRM, buf2);
            console.log('[screenshot] confirm saved:', process.env.AM_SCREENSHOT_CONFIRM, buf2.length, 'bytes');
          }
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 600);
    });
  }
}

app.whenReady().then(() => {
  // 测试模式：清空旧数据，确保 init() 会创建示例数据
  if (process.env.AM_AUTO_SCREENSHOT || process.env.AM_SEED === '1') {
    try {
      const p = storePath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (e) {
      console.warn('[test] failed to clear data:', e.message);
    }
  }
  ensureStore();
  // 首次启动写入示例数据
  if (process.env.AM_AUTO_SCREENSHOT || process.env.AM_SEED === '1') {
    ensureStore().seedSampleData();
  } else {
    ensureStore().seedSampleData();
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====
ipcMain.handle('tx:list', (e, filter) => ensureStore().listTransactions(filter || {}));
ipcMain.handle('tx:get', (e, id) => ensureStore().getTransaction(id));
ipcMain.handle('tx:create', (e, data) => ensureStore().createTransaction(data || {}));
ipcMain.handle('tx:update', (e, id, patch) => ensureStore().updateTransaction(id, patch || {}));
ipcMain.handle('tx:remove', (e, id) => ensureStore().removeTransaction(id));

ipcMain.handle('cat:list', (e, type) => ensureStore().listCategories(type));
ipcMain.handle('cat:add', (e, type, data) => ensureStore().addCategory(type, data || {}));
ipcMain.handle('cat:remove', (e, id) => ensureStore().removeCategory(id));

ipcMain.handle('acc:list', () => ensureStore().listAccounts());

ipcMain.handle('budget:get', (e, mk) => ensureStore().getBudget(mk));
ipcMain.handle('budget:set', (e, mk, amt) => ensureStore().setBudget(mk, amt));
ipcMain.handle('budget:list', () => ensureStore().listBudgets());

ipcMain.handle('data:exportJSON', () => ensureStore().exportJSON());
ipcMain.handle('data:exportCSV', () => ensureStore().exportCSV());
ipcMain.handle('data:importJSON', (e, json) => {
  try {
    ensureStore().importJSON(json);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('data:clearAll', () => {
  ensureStore().clearAll();
  return { ok: true };
});

ipcMain.handle('dialog:saveExport', async (e, format) => {
  const ext = format === 'csv' ? 'csv' : 'json';
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出记账数据',
    defaultPath: `accounting-${Date.now()}.${ext}`,
    filters: [{ name: format === 'csv' ? 'CSV' : 'JSON', extensions: [ext] }],
  });
  if (res.canceled || !res.filePath) return null;
  const content = format === 'csv' ? ensureStore().exportCSV() : ensureStore().exportJSON();
  // CSV 加 BOM 以便 Excel 正确识别中文
  if (format === 'csv') {
    fs.writeFileSync(res.filePath, '\ufeff' + content, 'utf-8');
  } else {
    fs.writeFileSync(res.filePath, content, 'utf-8');
  }
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
  try {
    ensureStore().importJSON(txt);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
