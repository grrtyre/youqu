// 拾色管家 - Electron 主进程
// 苹果白高端风格 · 屏幕取色 · 调色板管理 · 系统托盘常驻

'use strict';

const { app, BrowserWindow, ipcMain, globalShortcut, screen, clipboard, Tray, Menu, nativeImage, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const storage = require('./core/storage');
const colorUtils = require('./core/color-utils');
const paletteExport = require('./core/palette-export');

// 移除默认菜单栏，让 UI 更纯粹（苹果白沉浸感）
Menu.setApplicationMenu(null);

let mainWindow = null;
let pickerWindow = null;
let tray = null;
let store = null;

// 取色时缓存的屏幕快照
let cachedSnapshot = null; // { data: Buffer, width, height, bounds, scaleFactor }

// ---------- 主窗口 ----------
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 560,
    title: '拾色管家',
    backgroundColor: '#f5f5f7',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------- 取色覆盖窗口 ----------
function createPickerWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;
  pickerWindow = new BrowserWindow({
    width,
    height,
    x: display.bounds.x,
    y: display.bounds.y,
    fullscreen: false,
    frame: false,
    movable: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  pickerWindow.loadFile(path.join(__dirname, 'renderer', 'picker.html'));
  pickerWindow.on('closed', () => { pickerWindow = null; });
}

// ---------- 取色流程 ----------
async function startPicking() {
  if (!pickerWindow) createPickerWindow();
  // 先隐藏主窗口，避免出现在截图里
  if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
  // 等待一帧让窗口真正隐藏
  await new Promise((r) => setTimeout(r, 120));
  try {
    const primary = screen.getPrimaryDisplay();
    const bounds = primary.bounds;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.max(bounds.width, 100), height: Math.max(bounds.height, 100) },
      fetchWindowIcons: false,
    });
    const source = sources.find((s) => s.display_id === String(primary.id)) || sources[0];
    if (!source || !source.thumbnail) return;
    const img = source.thumbnail;
    const size = img.getSize();
    cachedSnapshot = {
      data: img.getBitmap(),
      width: size.width,
      height: size.height,
      bounds,
      scaleFactor: primary.scaleFactor || 1,
    };
    pickerWindow.show();
    pickerWindow.focus();
    pickerWindow.setFullScreen(true);
    // 把截图一次性发给渲染进程（避免逐像素 IPC）
    const dataUrl = img.toDataURL();
    pickerWindow.webContents.send('picker:ready', {
      width: size.width,
      height: size.height,
      dataUrl,
    });
  } catch (e) {
    console.error('取色失败', e);
    if (mainWindow) mainWindow.show();
  }
}

function endPicking() {
  if (pickerWindow) {
    pickerWindow.setFullScreen(false);
    pickerWindow.hide();
  }
  cachedSnapshot = null;
}

// ---------- 托盘 ----------
function buildTrayMenu() {
  const sc = (store && store.settings && store.settings.shortcut) || 'CommandOrControl+Shift+C';
  // 把 CommandOrControl 显示为 Ctrl（Windows）
  const scLabel = sc.replace(/CommandOrControl|CmdOrCtrl/g, 'Ctrl');
  return Menu.buildFromTemplate([
    { label: '拾色管家', enabled: false },
    { type: 'separator' },
    { label: `开始取色 (${scLabel})`, click: () => startPicking() },
    { label: '显示主窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon = nativeImage.createEmpty();
  try {
    if (fs.existsSync(iconPath)) icon = nativeImage.createFromPath(iconPath);
  } catch (e) {}
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromBuffer(makeTrayIconPng()) : icon);
  tray.setToolTip('拾色管家 - 屏幕取色器');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

/** 重新设置托盘菜单（快捷键变更后调用） */
function refreshTrayMenu() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

/** 重新注册全局快捷键 */
function reregisterShortcut(newShortcut) {
  const target = newShortcut || (store && store.settings && store.settings.shortcut) || 'CommandOrControl+Shift+C';
  try { globalShortcut.unregisterAll(); } catch (e) {}
  const ok = globalShortcut.register(target, () => { startPicking(); });
  return ok;
}

// 生成一个 16x16 蓝色圆点 PNG（兜底托盘图标）
function makeTrayIconPng() {
  // 简单 16x16 #007AFF 实心方块 PNG（base64 内嵌）
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAW0lEQVR4AcXOMQqDQBCF4d/R9W9oY7eJg7AQtEKwgrCQsBEs5CZsDOzS9SWBhZUW8iV8mM3MZ2aSOjPvTkaTXi5+8n0wSZpGdRmNolE0i2Z5r94F3uQD0fYOgn7l9gkAAAAASUVORK5CYII=';
  return Buffer.from(b64, 'base64');
}

// ---------- IPC ----------
function setupIpc() {
  ipcMain.handle('store:get', () => store);

  ipcMain.handle('store:save', (e, data) => {
    store = data;
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('history:add', (e, hex, rgb) => {
    storage.pushHistory(store, hex, rgb);
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('palette:addColor', (e, paletteId, hex) => {
    storage.addColorToPalette(store, paletteId, hex);
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('palette:removeColor', (e, paletteId, hex) => {
    storage.removeColorFromPalette(store, paletteId, hex);
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('palette:create', (e, name) => {
    storage.createPalette(store, name);
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('palette:delete', (e, id) => {
    storage.deletePalette(store, id);
    storage.save(app, store);
    return store;
  });

  ipcMain.handle('palette:rename', (e, id, name) => {
    const p = store.palettes.find((x) => x.id === id);
    if (p) { p.name = name; storage.save(app, store); }
    return store;
  });

  ipcMain.handle('clipboard:write', (e, text) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('picker:start', () => { startPicking(); return true; });

  ipcMain.handle('picker:sample', (e, x, y) => {
    if (!cachedSnapshot) return null;
    const sx = Math.floor(x);
    const sy = Math.floor(y);
    const idx = (sy * cachedSnapshot.width + sx) * 4;
    if (idx < 0 || idx + 2 >= cachedSnapshot.data.length) return null;
    const r = cachedSnapshot.data[idx];
    const g = cachedSnapshot.data[idx + 1];
    const b = cachedSnapshot.data[idx + 2];
    return { r, g, b, hex: colorUtils.rgbToHex(r, g, b) };
  });

  ipcMain.handle('picker:done', (e, color) => {
    endPicking();
    if (color) {
      storage.pushHistory(store, color.hex, color);
      storage.save(app, store);
      if (mainWindow) {
        mainWindow.webContents.send('picker:result', color);
        mainWindow.show();
        mainWindow.focus();
      }
    }
    return store;
  });

  ipcMain.handle('picker:cancel', () => { endPicking(); return true; });

  // ---------- 导出调色板 ----------
  ipcMain.handle('palette:export', async (e, palette, format) => {
    try {
      const { content, ext, filters } = paletteExport.exportByFormat(palette, format);
      const safeName = (palette.name || '调色板').replace(/[\\/:*?"<>|]/g, '_');
      const defaultName = `${safeName}.${ext}`;
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出调色板',
        defaultPath: defaultName,
        filters: filters,
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      fs.writeFileSync(result.filePath, data);
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ---------- 复制导出内容到剪贴板（不弹保存框） ----------
  ipcMain.handle('palette:copyExport', (e, palette, format) => {
    try {
      const { content } = paletteExport.exportByFormat(palette, format);
      if (Buffer.isBuffer(content)) {
        // 二进制格式（ASE）不支持直接写剪贴板文本，提示用户用导出
        return { ok: false, error: '二进制格式请使用导出文件' };
      }
      clipboard.writeText(content);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ---------- 设置快捷键 ----------
  ipcMain.handle('settings:setShortcut', (e, newShortcut) => {
    if (!storage.validateShortcut(newShortcut)) {
      return { ok: false, error: '快捷键格式不合法，需至少一个修饰键 + 一个按键' };
    }
    const old = store.settings.shortcut;
    store.settings.shortcut = newShortcut;
    const regOk = reregisterShortcut(newShortcut);
    if (!regOk) {
      // 注册失败，回滚
      store.settings.shortcut = old;
      reregisterShortcut(old);
      return { ok: false, error: '快捷键注册失败，可能被其他应用占用' };
    }
    storage.save(app, store);
    refreshTrayMenu();
    return { ok: true, shortcut: newShortcut };
  });
}

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  store = storage.load(app);
  createMainWindow();
  createPickerWindow();
  createTray();
  setupIpc();

  const ret = globalShortcut.register(store.settings.shortcut || 'CommandOrControl+Shift+C', () => {
    startPicking();
  });
  if (!ret) console.error('全局快捷键注册失败');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}
