// src/main.js — 识字管家主进程
// 负责：窗口、tesseract.js OCR worker、屏幕截图捕获、剪贴板图片读取、历史持久化、导出。

const { app, BrowserWindow, ipcMain, screen, desktopCapturer, clipboard, dialog, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { createWorker } = require('tesseract.js');
const core = require('./core/ocr-core.js');

const store = new Store({ name: 'ocr-manager-config' });
let main = null;
let captureWin = null;

// 兜底：捕获未处理异常，避免 Electron 弹出 Error 对话框中断界面
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ============ tesseract worker 管理 ============
let worker = null;
let workerLang = null;
let workerReady = false;

// 本地语言包目录（离线优先）
function localLangPath() {
  return path.join(__dirname, 'langs');
}

function hasLocalLangs() {
  const dir = localLangPath();
  if (!fs.existsSync(dir)) return false;
  try {
    const files = fs.readdirSync(dir);
    return files.some(f => /traineddata(\.gz)?$/i.test(f));
  } catch (e) {
    return false;
  }
}

async function getWorker(lang) {
  const safeLang = core.parseLangs(lang);
  if (worker && workerLang === safeLang && workerReady) return worker;
  // 切换语言需重建 worker
  if (worker) {
    try { await worker.terminate(); } catch (e) {}
    worker = null; workerReady = false;
  }
  const options = { logger: m => {
    if (main && !main.isDestroyed()) {
      main.webContents.send('ocr-progress', {
        status: m.status, progress: typeof m.progress === 'number' ? m.progress : 0
      });
    }
  }};
  if (hasLocalLangs()) options.langPath = localLangPath();
  worker = await createWorker(safeLang, 1, options);
  workerLang = safeLang;
  workerReady = true;
  return worker;
}

// 预热 worker（应用启动后静默加载，缩短首次识别等待）
function warmupWorker() {
  const defaultLang = (store.get('settings', {}) || {}).lang || 'chi_sim+eng';
  getWorker(defaultLang).catch(() => {});
}

// ============ 窗口 ============
function createWindow() {
  main = new BrowserWindow({
    width: 1200, height: 780, minWidth: 980, minHeight: 640,
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
  // 启动后预热
  setTimeout(warmupWorker, 800);
}

app.whenReady().then(() => {
  createWindow();
  // 全局快捷键：Ctrl+Shift+O 触发截图识别
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (main) main.webContents.send('trigger-screenshot-ocr');
  });
  // 截图模式：--screenshot=路径 → 截图后退出
  const shotArg = process.argv.find(a => a.startsWith('--screenshot='));
  if (shotArg) {
    const shotPath = shotArg.split('=')[1];
    main.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await main.webContents.capturePage();
          const buf = img.toPNG();
          if (buf.length === 0) { console.error('SCREENSHOT_EMPTY'); app.quit(); return; }
          fs.mkdirSync(path.dirname(shotPath), { recursive: true });
          fs.writeFileSync(shotPath, buf);
          console.log('SCREENSHOT_SAVED ' + shotPath + ' (' + buf.length + ' bytes)');
        } catch (e) {
          console.error('SCREENSHOT_ERROR', e);
        }
        app.quit();
      }, 2500);
    });
  }
});
app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => { if (!main) createWindow(); });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (worker) { try { worker.terminate(); } catch (e) {} }
});

// ============ IPC：OCR 识别 ============
// payload: { lang, image } image 可为：文件路径 / dataURL / base64
ipcMain.handle('ocr-recognize', async (_e, payload) => {
  try {
    if (!payload || !payload.image) return { error: '未提供图像' };
    const lang = core.parseLangs(payload.lang);
    const w = await getWorker(lang);
    let input = payload.image;
    // 若是文件路径，直接传路径；若是 dataURL/base64 也可直接识别
    const { data } = await w.recognize(input);
    const text = core.cleanText(data.text || '');
    const confidence = typeof data.confidence === 'number' ? Math.round(data.confidence * 10) / 10 : null;
    return { text, confidence, lang };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
});

// 取消当前识别（终止 worker 并重建）
ipcMain.handle('ocr-cancel', async () => {
  if (worker) {
    try { await worker.terminate(); } catch (e) {}
    worker = null; workerReady = false;
  }
  return true;
});

// ============ IPC：读取剪贴板图片 ============
ipcMain.handle('read-clipboard-image', () => {
  try {
    const img = clipboard.readImage();
    if (img.isEmpty()) return { empty: true };
    const dataUrl = img.toDataURL();
    const size = img.getSize();
    return { dataUrl, width: size.width, height: size.height };
  } catch (e) {
    return { error: String(e) };
  }
});

// ============ IPC：屏幕截图捕获 ============
ipcMain.handle('capture-screen', async () => {
  try {
    const display = screen.getPrimaryDisplay();
    const maxDim = Math.max(display.size.width, display.size.height);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.ceil(maxDim * (display.scaleFactor || 1)), height: Math.ceil(maxDim * (display.scaleFactor || 1)) }
    });
    const src = sources.find(s => s.display_id === String(display.id)) || sources[0];
    if (!src) return { error: '无法获取屏幕图像' };
    const fullImage = src.thumbnail;
    // 打开选择遮罩窗口，让用户框选区域
    const result = await openCaptureOverlay(fullImage, display);
    if (!result) return { cancelled: true };
    return { dataUrl: result.dataUrl, width: result.width, height: result.height };
  } catch (e) {
    return { error: String(e) };
  }
});

function openCaptureOverlay(fullImage, display) {
  return new Promise((resolve) => {
    const { width, height } = display.size;
    captureWin = new BrowserWindow({
      x: display.bounds.x, y: display.bounds.y, width, height,
      fullscreen: false, frame: false, movable: false, resizable: false,
      alwaysOnTop: true, skipTaskbar: true, show: false,
      backgroundColor: '#000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    captureWin.loadFile(path.join(__dirname, 'renderer', 'capture.html'));
    captureWin.once('ready-to-show', () => {
      captureWin.show();
      captureWin.focus();
      captureWin.setAlwaysOnTop(true, 'screen-saver');
    });
    // 传递屏幕底图 dataURL 给遮罩
    captureWin.webContents.on('did-finish-load', () => {
      captureWin.webContents.send('capture-bg', {
        dataUrl: fullImage.toDataURL(),
        width: fullImage.getSize().width,
        height: fullImage.getSize().height,
        cssWidth: width,
        cssHeight: height,
        scale: display.scaleFactor || 1
      });
    });
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      if (captureWin) { captureWin.close(); captureWin = null; }
      resolve(val);
    };
    // 遮罩选择完成
    const onSelected = (_e, rect) => {
      if (!rect) return finish(null);
      try {
        const crop = fullImage.crop(rect);
        const size = crop.getSize();
        finish({ dataUrl: crop.toDataURL(), width: size.width, height: size.height });
      } catch (err) {
        finish({ error: String(err) });
      }
    };
    const onCancel = () => finish(null);
    ipcMain.once('capture-selected', onSelected);
    ipcMain.once('capture-cancelled', onCancel);
    captureWin.on('closed', () => {
      ipcMain.removeListener('capture-selected', onSelected);
      ipcMain.removeListener('capture-cancelled', onCancel);
      finish(null);
    });
  });
}

// ============ IPC：历史记录持久化 ============
ipcMain.handle('get-history', () => store.get('history', []));
ipcMain.handle('set-history', (_e, list) => { store.set('history', list); return true; });

ipcMain.handle('get-settings', () => store.get('settings', { lang: 'chi_sim+eng', autoCopy: false }));
ipcMain.handle('set-settings', (_e, s) => { store.set('settings', s); return true; });

// ============ IPC：导出文本 ============
ipcMain.handle('export-text', async (_e, payload) => {
  try {
    const exp = core.buildExport(payload.text, payload.name);
    const res = await dialog.showSaveDialog(main, {
      title: '导出识别结果',
      defaultPath: exp.filename,
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (res.canceled || !res.filePath) return { cancelled: true };
    fs.writeFileSync(res.filePath, exp.content, 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { error: String(e) };
  }
});

// 写剪贴板文本
ipcMain.handle('write-clipboard-text', (_e, text) => {
  try { clipboard.writeText(String(text || '')); return true; } catch (e) { return false; }
});

// 窗口控制
ipcMain.handle('window-min', () => { if (main) main.minimize(); return true; });
ipcMain.handle('window-close', () => { if (main) main.close(); return true; });
