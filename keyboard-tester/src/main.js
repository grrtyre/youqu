// Electron 主进程 - 键鼠管家
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./core/store');

// 统一 userData 目录为 keyboard-tester（不依赖 productName）
// 避免 screenshot 脚本写入的 demo 数据路径不匹配
app.setPath('userData', path.join(app.getPath('appData'), 'keyboard-tester'));

// 用户数据目录：userData/keyboard-tester.json
function storePath() {
  return path.join(app.getPath('userData'), 'keyboard-tester.json');
}

let store;
let mainWindow;

function ensureStore() {
  if (!store) store = new Store(storePath());
  return store;
}

function createWindow() {
  const isScreenshot = !!process.env.KT_AUTO_SCREENSHOT;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: isScreenshot ? 1200 : 960,
    minWidth: 960,
    minHeight: 680,
    title: '键鼠管家',
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
  if (process.env.KT_DEV === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 自动截图：环境变量 KT_AUTO_SCREENSHOT 指定输出路径
  if (process.env.KT_AUTO_SCREENSHOT) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          // 注入 demo 数据到渲染进程（确保截图有内容，不依赖文件加载时序）
          const demoData = {
            keyCount: {
              KeyA: 128, KeyS: 96, KeyD: 102, KeyF: 88, KeyG: 45, KeyH: 67, KeyJ: 79, KeyK: 54, KeyL: 48,
              KeyQ: 22, KeyW: 58, KeyE: 71, KeyR: 63, KeyT: 49, KeyY: 38, KeyU: 33, KeyI: 88, KeyO: 41, KeyP: 19,
              KeyZ: 12, KeyX: 15, KeyC: 28, KeyV: 22, KeyB: 18, KeyN: 31, KeyM: 17,
              Space: 356, Enter: 89, Backspace: 67, Tab: 34, ShiftLeft: 78, ShiftRight: 12,
              ControlLeft: 14, AltLeft: 8, CapsLock: 3,
              Digit1: 19, Digit2: 14, Digit3: 9, Digit4: 7, Digit5: 5,
              Semicolon: 16, Quote: 12, Comma: 24, Period: 28, Slash: 14,
              BracketLeft: 6, BracketRight: 5, Backslash: 3, Minus: 8, Equal: 6, Backquote: 4,
              ArrowUp: 8, ArrowDown: 12, ArrowLeft: 9, ArrowRight: 7,
              Escape: 11, F1: 2, F5: 4,
            },
            mouseClick: { left: 284, right: 42, middle: 8, back: 3, forward: 1 },
            wheel: { up: 156, down: 189 },
            distance: 18432,
            totalKeys: 2847,
          };
          await mainWindow.webContents.executeJavaScript(
            `window.__kt_demo = ${JSON.stringify(demoData)};` +
            `if (typeof stats !== 'undefined' && stats.load) { stats.load(window.__kt_demo); }` +
            `if (typeof recentKeys !== 'undefined') { recentKeys.length = 0; ['Space','KeyA','KeyS','KeyD','Enter','Backspace','KeyE','KeyT','KeyI','KeyN','KeyO','KeyR','ShiftLeft','KeyH','KeyJ','KeyK','KeyL','Semicolon'].forEach(c => recentKeys.push(c)); }` +
            `var vk = document.getElementById('lastKeyValue'); var ck = document.getElementById('lastKeyCode'); if (vk && ck) { vk.textContent = '空格'; ck.textContent = 'Space'; }`
          );
          await new Promise((r) => setTimeout(r, 300));

          // 注入初始标签页切换
          if (process.env.KT_INITIAL_TAB) {
            await mainWindow.webContents.executeJavaScript(
              `document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));` +
              `document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));` +
              `document.querySelector('.tab[data-tab="${process.env.KT_INITIAL_TAB}"]').classList.add('active');` +
              `document.getElementById('panel-${process.env.KT_INITIAL_TAB}').classList.add('active');`
            );
            await new Promise((r) => setTimeout(r, 300));
          }

          // 重新渲染所有 UI（使用注入的数据）
          await mainWindow.webContents.executeJavaScript(
            `if (typeof renderKeyboard === 'function') { renderKeyboard('keyboardWrap', false); renderKeyboard('heatmapKeyboard', true); }` +
            `if (typeof updateStatsUI === 'function') { updateStatsUI(); }` +
            `if (typeof updateTotalKeysMini === 'function') { updateTotalKeysMini(); }` +
            `if (typeof renderRecentKeys === 'function') { renderRecentKeys(); }` +
            `if (typeof updateMouseUI === 'function') { updateMouseUI(); }`
          );
          await new Promise((r) => setTimeout(r, 800));

          const img = await mainWindow.webContents.capturePage();
          const buf = img.toPNG();
          fs.writeFileSync(process.env.KT_AUTO_SCREENSHOT, buf);
          console.log('[screenshot] saved:', process.env.KT_AUTO_SCREENSHOT, buf.length, 'bytes');
        } catch (e) {
          console.error('[screenshot] error:', e.message);
        }
      }, 1000);
    });
  }
}

app.whenReady().then(() => {
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
ipcMain.handle('stats:get', () => ensureStore().stats.toJSON());
ipcMain.handle('stats:pressKey', (e, code) => {
  ensureStore().stats.pressKey(code);
  ensureStore().save();
  return ensureStore().stats.toJSON();
});
ipcMain.handle('stats:clickMouse', (e, button) => {
  ensureStore().stats.clickMouse(button);
  ensureStore().save();
  return ensureStore().stats.toJSON();
});
ipcMain.handle('stats:wheel', (e, direction) => {
  ensureStore().stats.wheelScroll(direction);
  ensureStore().save();
  return ensureStore().stats.toJSON();
});
ipcMain.handle('stats:move', (e, dx, dy) => {
  ensureStore().stats.moveMouse(dx, dy);
  return ensureStore().stats.toJSON();
});
ipcMain.handle('stats:save', (e, snapshot) => {
  // 渲染层批量提交时直接覆盖
  const s = ensureStore().stats;
  if (snapshot && snapshot.keyCount) s.keyCount = snapshot.keyCount;
  if (snapshot && snapshot.mouseClick) s.mouseClick = snapshot.mouseClick;
  if (snapshot && snapshot.wheel) s.wheel = snapshot.wheel;
  if (snapshot && typeof snapshot.distance === 'number') s.distance = snapshot.distance;
  if (snapshot && typeof snapshot.totalKeys === 'number') s.totalKeys = snapshot.totalKeys;
  ensureStore().save();
  return s.toJSON();
});
ipcMain.handle('stats:reset', () => {
  ensureStore().stats.reset();
  ensureStore().save();
  return ensureStore().stats.toJSON();
});

ipcMain.handle('history:list', () => ensureStore().history);
ipcMain.handle('history:add', (e, record) => {
  ensureStore().addHistory(record);
  return ensureStore().history;
});
ipcMain.handle('history:clear', () => {
  ensureStore().clearHistory();
  return ensureStore().history;
});

ipcMain.handle('data:clearAll', () => {
  ensureStore().clearAll();
  return { stats: ensureStore().stats.toJSON(), history: ensureStore().history };
});

ipcMain.handle('data:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: '导出数据',
    defaultPath: `keyboard-tester-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return null;
  const data = { stats: ensureStore().stats.toJSON(), history: ensureStore().history };
  fs.writeFileSync(res.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return res.filePath;
});
