const { app, BrowserWindow, globalShortcut, screen, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;
let overlayWindow = null;

// 跨平台统一使用无边框窗口 + 自定义红黄绿小圆点
// 解决 Windows 上 titleBarStyle:'hiddenInset' 导致的双重标题栏问题
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 600,
    minHeight: 480,
    title: '屏幕标尺管家',
    frame: false,
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  // 同步最大化状态给渲染进程（用于切换圆点图标）
  mainWindow.on('maximize', () => { if (mainWindow) mainWindow.webContents.send('win:maximize-change', true); });
  mainWindow.on('unmaximize', () => { if (mainWindow) mainWindow.webContents.send('win:maximize-change', false); });
}

// 在指定显示器上创建覆盖层
function createOverlayWindowOn(display) {
  const { x, y, width, height } = display.bounds;
  overlayWindow = new BrowserWindow({
    x, y, width, height,
    fullscreen: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

// 找到光标所在显示器
function displayUnderCursor() {
  const cursor = screen.getCursorScreenPoint();
  const displays = screen.getAllDisplays();
  // 优先返回包含光标的显示器
  const found = displays.find(d => {
    const { x, y, width, height } = d.bounds;
    return cursor.x >= x && cursor.x < x + width && cursor.y >= y && cursor.y < y + height;
  });
  return found || screen.getPrimaryDisplay();
}

// 截取指定显示器的画面
async function captureDisplay(display) {
  const target = display || screen.getPrimaryDisplay();
  const { width, height } = target.bounds;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * (target.scaleFactor || 1)), height: Math.round(height * (target.scaleFactor || 1)) }
  });
  // 优先匹配该显示器的 source
  const source = sources.find(s => s.display_id === String(target.id)) || sources[0];
  if (!source) return null;
  return source.thumbnail.toPNG().toString('base64');
}

app.whenReady().then(() => {
  createMainWindow();

  // 全局快捷键：Ctrl+Shift+R 切换 overlay
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      const display = displayUnderCursor();
      if (!overlayWindow) createOverlayWindowOn(display);
      else {
        // 若已存在但不在当前显示器，重新定位
        const [ox, oy] = overlayWindow.getPosition();
        if (ox !== display.bounds.x || oy !== display.bounds.y) {
          overlayWindow.setBounds(display.bounds);
        }
      }
      overlayWindow.show();
      overlayWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// ── 窗口控制 IPC（自定义标题栏）──
ipcMain.handle('win:minimize', () => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  if (w) w.minimize();
});
ipcMain.handle('win:maximize-toggle', () => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!w) return false;
  if (w.isMaximized()) { w.unmaximize(); return false; }
  w.maximize(); return true;
});
ipcMain.handle('win:close', () => {
  const w = BrowserWindow.getFocusedWindow() || mainWindow;
  if (w) w.close();
});
ipcMain.handle('win:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ── 覆盖层 IPC ──
ipcMain.handle('overlay:capture', async () => {
  const display = displayUnderCursor();
  return await captureDisplay(display);
});

ipcMain.handle('overlay:close', () => {
  if (overlayWindow) overlayWindow.hide();
});

ipcMain.handle('app:open-overlay', async () => {
  const display = displayUnderCursor();
  if (!overlayWindow) createOverlayWindowOn(display);
  else {
    const [ox, oy] = overlayWindow.getPosition();
    if (ox !== display.bounds.x || oy !== display.bounds.y) {
      overlayWindow.setBounds(display.bounds);
    }
  }
  overlayWindow.show();
  overlayWindow.focus();
  const b64 = await captureDisplay(display);
  if (overlayWindow && overlayWindow.webContents) {
    overlayWindow.webContents.send('overlay:screenshot', b64);
  }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d === screen.getPrimaryDisplay()
  }));
});
