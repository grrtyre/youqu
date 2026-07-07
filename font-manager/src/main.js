// src/main.js — 字体管家主进程
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const fontList = require('font-list');

const store = new Store({ name: 'font-manager-config' });

let main = null;

function createWindow() {
  main = new BrowserWindow({
    width: 1180, height: 760, minWidth: 960, minHeight: 640,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  main.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  main.on('closed', () => { main = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!main) createWindow(); });

// ============ IPC ============
// 枚举系统字体（去重 + 排序）
ipcMain.handle('list-fonts', async () => {
  try {
    const fonts = await fontList.getFonts();
    const unique = Array.from(new Set(fonts.map(f => typeof f === 'string' ? f : f.family)));
    return unique.sort((a, b) => a.localeCompare(b, 'zh-Hans'));
  } catch (e) {
    return { error: String(e) };
  }
});

// 持久化标签数据 { family: [tag1, tag2, ...] }
ipcMain.handle('get-tags', () => store.get('tags', {}));
ipcMain.handle('set-tags', (_e, tags) => { store.set('tags', tags); return true; });

// 收藏列表
ipcMain.handle('get-favorites', () => store.get('favorites', []));
ipcMain.handle('set-favorites', (_e, list) => { store.set('favorites', list); return true; });

// 自定义预览文本
ipcMain.handle('get-settings', () => store.get('settings', { previewText: '永和九年岁在癸丑暮春之初会于会稽山阴之兰亭修禊事也', fontSize: 36, sampleEn: 'The quick brown fox jumps over the lazy dog 0123456789' }));
ipcMain.handle('set-settings', (_e, s) => { store.set('settings', s); return true; });

// 窗口控制（最小化）
ipcMain.handle('window-min', () => { if (main) main.minimize(); return true; });
