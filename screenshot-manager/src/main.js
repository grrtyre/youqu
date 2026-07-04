// 截图管家 - 主进程
// 苹果白高端风格截图标注工具
const { app, BrowserWindow, globalShortcut, screen, ipcMain, Tray, Menu, nativeImage, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('./uuid-lite');

// 状态
let tray = null;
let pickerWin = null;
let editorWin = null;
let mainWin = null;
let pinWindows = new Set();
let lastScreenshotPath = null;

// 历史目录
function getHistoryDir() {
  const dir = path.join(app.getPath('userData'), 'screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getHistoryFile() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    const f = getHistoryFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {}
  return [];
}

function saveHistory(list) {
  try {
    fs.writeFileSync(getHistoryFile(), JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

function addToHistory(item) {
  const list = loadHistory();
  list.unshift(item);
  // 最多保留 100 条
  if (list.length > 100) list.length = 100;
  saveHistory(list);
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('history-updated', list);
  }
}

// 创建托盘
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '截图 (Ctrl+Shift+A)', click: () => startScreenshot() },
    { label: '上次截图再编辑', click: () => { if (lastScreenshotPath) openEditor(lastScreenshotPath); } },
    { type: 'separator' },
    { label: '打开主窗口', click: () => { showMainWindow(); } },
    { label: '退出', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('截图管家 - Ctrl+Shift+A 截图');
  tray.setContextMenu(menu);
  tray.on('click', () => showMainWindow());
}

// 主窗口
function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 980,
    height: 640,
    minWidth: 760,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWin.once('ready-to-show', () => {
    mainWin.show();
  });
  mainWin.on('close', (e) => {
    e.preventDefault();
    mainWin.hide();
  });
}

function showMainWindow() {
  if (!mainWin) createMainWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  mainWin.webContents.send('history-updated', loadHistory());
}

// 截图流程：获取整屏 → picker 选区
function startScreenshot() {
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  const displays = screen.getAllDisplays();
  // 取主屏
  const primary = displays.find(d => d.bounds.x === 0 && d.bounds.y === 0) || displays[0];
  captureDisplay(primary).then(imgPath => {
    openPicker(imgPath, primary);
  }).catch(err => {
    dialog.showErrorBox('截图失败', String(err));
  });
}

function captureDisplay(display) {
  return new Promise((resolve, reject) => {
    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: display.bounds.width, height: display.bounds.height }
    }).then(sources => {
      // 找到对应 display
      const target = sources.find(s => s.display_id === String(display.id)) || sources[0];
      if (!target) return reject(new Error('未找到屏幕源'));
      const png = target.thumbnail.toPNG();
      const file = path.join(getHistoryDir(), `raw_${Date.now()}.png`);
      fs.writeFileSync(file, png);
      resolve(file);
    }).catch(reject);
  });
}

// 拾取窗口：全屏透明覆盖
function openPicker(rawPath, display) {
  pickerWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: false,
    frame: false,
    movable: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  pickerWin.setAlwaysOnTop(true, 'screen-saver');
  pickerWin.loadFile(path.join(__dirname, 'renderer', 'picker.html'));
  pickerWin.webContents.on('did-finish-load', () => {
    pickerWin.webContents.send('picker-init', {
      rawPath: rawPath,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor || 1
    });
  });
  pickerWin.on('closed', () => { pickerWin = null; });
}

// 裁剪截图：根据选区从原始整屏图截取
ipcMain.handle('crop-screenshot', async (event, args) => {
  const { rawPath, rect, scaleFactor } = args;
  // rect 是显示器物理像素坐标（已乘 scale）
  try {
    const buf = fs.readFileSync(rawPath);
    const base64 = buf.toString('base64');
    // 用 editor 窗口内的 canvas 裁剪，这里直接把 rawPath + rect 传给 editor
    return { ok: true, rawPath, rect, base64 };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 打开编辑器：把整屏图 + 选区 rect 传给 editor，editor 内 canvas 裁剪显示
ipcMain.handle('open-editor', async (event, args) => {
  const { rawPath, rect, scaleFactor } = args;
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  lastScreenshotPath = rawPath;
  openEditor(rawPath, null, rect, scaleFactor);
  return { ok: true };
});

function openEditor(imagePath, existingItem, rect, scaleFactor) {
  if (editorWin && !editorWin.isDestroyed()) {
    editorWin.close();
  }
  const display = screen.getPrimaryDisplay();
  const w = Math.min(display.workAreaSize.width - 80, 1200);
  const h = Math.min(display.workAreaSize.height - 80, 760);
  editorWin = new BrowserWindow({
    width: w,
    height: h,
    minWidth: 720,
    minHeight: 480,
    frame: false,
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  editorWin.loadFile(path.join(__dirname, 'renderer', 'editor.html'));
  editorWin.webContents.on('did-finish-load', () => {
    editorWin.webContents.send('editor-init', {
      imagePath: imagePath,
      rect: rect || null,
      scaleFactor: scaleFactor || 1,
      existingItem: existingItem || null
    });
  });
  editorWin.on('closed', () => { editorWin = null; });
  editorWin.show();
  editorWin.focus();
}

// 编辑器保存：接收 base64 图片，保存到历史
ipcMain.handle('save-screenshot', async (event, args) => {
  const { base64, width, height } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const file = path.join(getHistoryDir(), `final_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    const item = {
      id: uuidv4(),
      path: file,
      time: Date.now(),
      width: width,
      height: height
    };
    addToHistory(item);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 复制到剪贴板
ipcMain.handle('copy-to-clipboard', async (event, args) => {
  const { base64 } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const img = nativeImage.createFromBuffer(buf);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 贴图钉屏幕
ipcMain.handle('pin-screenshot', async (event, args) => {
  const { base64, x, y, width, height } = args;
  try {
    const buf = Buffer.from(base64, 'base64');
    const file = path.join(getHistoryDir(), `pin_${Date.now()}.png`);
    fs.writeFileSync(file, buf);
    const pin = new BrowserWindow({
      x: x || 100,
      y: y || 100,
      width: width || 400,
      height: height || 300,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    pin.loadFile(path.join(__dirname, 'renderer', 'pin.html'));
    pin.webContents.on('did-finish-load', () => {
      pin.webContents.send('pin-init', { imagePath: file });
    });
    pinWindows.add(pin);
    pin.on('closed', () => { pinWindows.delete(pin); });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 读取图片为 base64
ipcMain.handle('read-image', async (event, args) => {
  const { path: p } = args;
  try {
    const buf = fs.readFileSync(p);
    return { ok: true, base64: buf.toString('base64') };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 获取历史
ipcMain.handle('get-history', async () => {
  return loadHistory();
});

// 删除历史项
ipcMain.handle('delete-history', async (event, args) => {
  const { id } = args;
  const list = loadHistory();
  const item = list.find(x => x.id === id);
  if (item) {
    try { fs.unlinkSync(item.path); } catch (e) {}
  }
  const newList = list.filter(x => x.id !== id);
  saveHistory(newList);
  if (mainWin) mainWin.webContents.send('history-updated', newList);
  return { ok: true };
});

// 在文件夹中显示
ipcMain.handle('show-in-folder', async (event, args) => {
  const { path: p } = args;
  shell.showItemInFolder(p);
  return { ok: true };
});

// 保存到指定位置
ipcMain.handle('save-as', async (event, args) => {
  const { base64 } = args;
  const result = await dialog.showSaveDialog(editorWin || mainWin, {
    title: '保存截图',
    defaultPath: `截图_${Date.now()}.png`,
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (result.canceled) return { ok: false, canceled: true };
  try {
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(result.filePath, buf);
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// 从历史打开编辑器
ipcMain.handle('edit-from-history', async (event, args) => {
  const { id } = args;
  const list = loadHistory();
  const item = list.find(x => x.id === id);
  if (item && fs.existsSync(item.path)) {
    openEditor(item.path, item);
    return { ok: true };
  }
  return { ok: false, error: '文件不存在' };
});

// 窗口控制
ipcMain.handle('win-close', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
  return { ok: true };
});
ipcMain.handle('win-minimize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
  return { ok: true };
});
ipcMain.handle('win-maximize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
  return { ok: true };
});

ipcMain.handle('picker-cancel', async () => {
  if (pickerWin) { pickerWin.close(); pickerWin = null; }
  return { ok: true };
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    createMainWindow();
    createTray();
    // 注册全局快捷键
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      startScreenshot();
    });
    // 也支持 Ctrl+Shift+Q 作为备用
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
      startScreenshot();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// 不退出，留在托盘
app.on('window-all-closed', (e) => {
  // Windows 上不退出，留在托盘
  // do nothing
});
