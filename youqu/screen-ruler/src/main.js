const { app, BrowserWindow, globalShortcut, screen, ipcMain, desktopCapturer, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let overlayWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 560,
    minWidth: 600,
    minHeight: 480,
    title: '屏幕标尺管家',
    backgroundColor: '#f7f8fa',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.bounds;
  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width,
    height,
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

// 截屏并传给 overlay
async function captureAndSend() {
  const display = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: display.bounds.width, height: display.bounds.height }
  });
  const source = sources[0];
  if (!source) return null;
  const png = source.thumbnail.toPNG();
  return png.toString('base64');
}

app.whenReady().then(() => {
  createMainWindow();

  // 全局快捷键：Ctrl+Shift+R 切换 overlay
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      if (!overlayWindow) createOverlayWindow();
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

// IPC
ipcMain.handle('overlay:capture', async () => {
  const b64 = await captureAndSend();
  return b64;
});

ipcMain.handle('overlay:close', () => {
  if (overlayWindow) overlayWindow.hide();
});

ipcMain.handle('app:open-overlay', async () => {
  if (!overlayWindow) createOverlayWindow();
  overlayWindow.show();
  overlayWindow.focus();
  const b64 = await captureAndSend();
  if (overlayWindow && overlayWindow.webContents) {
    overlayWindow.webContents.send('overlay:screenshot', b64);
  }
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d === screen.getPrimaryDisplay()
  }));
});
