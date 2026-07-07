// src/main.js — 二维码管家主进程
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { generateDataURL, generateSVG, decodeFromPNGBuffer } = require('./core/qr-core');

const store = new Store({ name: 'qr-manager-config' });
let main = null;

function createWindow() {
  main = new BrowserWindow({
    width: 1240, height: 800, minWidth: 980, minHeight: 640,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'hiddenInset',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  main.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  main.on('closed', () => { main = null; });
  // 自动截图（仅测试用：QR_AUTOSHOT=1 时加载完成后截图并退出）
  if (process.env.QR_AUTOSHOT === '1') {
    main.webContents.on('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const img = await main.webContents.capturePage();
          const dir = 'D:\\Ai\\mimo\\screenshots';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'qr-manager.png'), img.toPNG());
          console.log('SHOT_OK');
        } catch (e) { console.error('SHOT_ERR', e); }
        app.quit();
      }, 3000);
    });
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!main) createWindow(); });

// ============ 生成 ============
ipcMain.handle('qr-generate', async (_e, { text, opts }) => {
  try {
    const result = await generateDataURL(text, opts);
    return { ok: true, dataURL: result.dataURL, width: result.width };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

ipcMain.handle('qr-generate-svg', async (_e, { text, opts }) => {
  try {
    const svg = await generateSVG(text, opts);
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, error: e.message, code: e.code };
  }
});

// ============ 识别 ============
// 从本地图片文件识别
ipcMain.handle('qr-decode-file', async (_e, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const r = decodeFromPNGBuffer(buf);
    if (!r) return { ok: false, error: '未识别到二维码（仅支持 PNG）' };
    return { ok: true, data: r.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 从 nativeImage 转 PNG buffer 后识别（支持 JPEG 等）
ipcMain.handle('qr-decode-native', async (_e, { source }) => {
  try {
    const { nativeImage } = require('electron');
    let img;
    if (source && source.startsWith('data:')) {
      img = nativeImage.createFromDataURL(source);
    } else {
      return { ok: false, error: '无效图片来源' };
    }
    const pngBuf = img.toPNG();
    const r = decodeFromPNGBuffer(pngBuf);
    if (!r) return { ok: false, error: '未识别到二维码' };
    return { ok: true, data: r.data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 截屏识别：截取所有屏幕，逐张解码
ipcMain.handle('qr-decode-screen', async () => {
  try {
    // 先隐藏主窗口，避免遮挡
    const wasVisible = main && main.isVisible();
    if (wasVisible) main.hide();
    // 等待一帧让窗口真正隐藏
    await new Promise(r => setTimeout(r, 220));
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false
    });
    if (wasVisible) main.show();
    if (!sources.length) return { ok: false, error: '未找到屏幕' };
    for (const s of sources) {
      const pngBuf = s.thumbnail.toPNG();
      const r = decodeFromPNGBuffer(pngBuf);
      if (r) return { ok: true, data: r.data, screen: s.name };
    }
    return { ok: false, error: '截屏中未识别到二维码' };
  } catch (e) {
    if (main && !main.isVisible()) main.show();
    return { ok: false, error: e.message };
  }
});

// 选择图片文件
ipcMain.handle('qr-pick-image', async () => {
  const r = await dialog.showOpenDialog(main, {
    title: '选择包含二维码的图片',
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
    properties: ['openFile']
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  const p = r.filePaths[0];
  // 用 nativeImage 读取以支持多种格式，再转 PNG 解码
  const { nativeImage } = require('electron');
  const img = nativeImage.createFromPath(p);
  if (img.isEmpty()) return { ok: false, error: '无法读取图片' };
  const pngBuf = img.toPNG();
  const dec = decodeFromPNGBuffer(pngBuf);
  if (!dec) return { ok: false, error: '未识别到二维码' };
  return { ok: true, data: dec.data, path: p };
});

// ============ 保存 ============
ipcMain.handle('qr-save-png', async (_e, { dataURL, defaultName }) => {
  const r = await dialog.showSaveDialog(main, {
    title: '保存二维码图片',
    defaultPath: defaultName || 'qrcode.png',
    filters: [{ name: 'PNG 图片', extensions: ['png'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false };
  try {
    const base64 = dataURL.split(',')[1];
    fs.writeFileSync(r.filePath, Buffer.from(base64, 'base64'));
    return { ok: true, path: r.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('qr-save-svg', async (_e, { svg, defaultName }) => {
  const r = await dialog.showSaveDialog(main, {
    title: '保存二维码 SVG',
    defaultPath: defaultName || 'qrcode.svg',
    filters: [{ name: 'SVG 矢量图', extensions: ['svg'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false };
  try {
    fs.writeFileSync(r.filePath, svg, 'utf8');
    return { ok: true, path: r.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============ 历史 / 收藏 ============
ipcMain.handle('history-get', () => store.get('history', []));
ipcMain.handle('history-add', (_e, item) => {
  const list = store.get('history', []);
  const entry = { ...item, id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), time: new Date().toISOString() };
  list.unshift(entry);
  if (list.length > 100) list.length = 100;
  store.set('history', list);
  return { ok: true, entry };
});
ipcMain.handle('history-clear', () => { store.set('history', []); return { ok: true }; });

ipcMain.handle('fav-get', () => store.get('favorites', []));
ipcMain.handle('fav-add', (_e, item) => {
  const list = store.get('favorites', []);
  const entry = { ...item, id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), time: new Date().toISOString() };
  list.unshift(entry);
  store.set('favorites', list);
  return { ok: true, entry };
});
ipcMain.handle('fav-remove', (_e, id) => {
  const list = store.get('favorites', []).filter(x => x.id !== id);
  store.set('favorites', list);
  return { ok: true };
});
ipcMain.handle('fav-clear', () => { store.set('favorites', []); return { ok: true }; });

// ============ 窗口控制 ============
ipcMain.handle('window-min', () => { if (main) main.minimize(); return true; });
ipcMain.handle('window-close', () => { if (main) main.close(); return true; });

// 打开外链
ipcMain.handle('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
  return true;
});

// ============ 剪贴板 ============
const { clipboard, nativeImage } = require('electron');
ipcMain.handle('clipboard-write-image', (_e, dataURL) => {
  try {
    const img = nativeImage.createFromDataURL(dataURL);
    clipboard.writeImage(img);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('clipboard-write-text', (_e, text) => {
  clipboard.writeText(String(text));
  return { ok: true };
});
