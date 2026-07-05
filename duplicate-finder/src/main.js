// main.js — Electron 主进程
// 职责：创建窗口、注册 IPC、调用扫描引擎、执行删除（移到回收站）
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { scanDirectory, formatBytes } = require('./core/scanner');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

let mainWindow = null;
let scanning = false;
let cancelRequested = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: '清重管家',
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, '..', 'build', 'icon.ico')
  });

  // --demo 模式：必须在 loadFile 之前注册 did-finish-load，避免错过事件
  if (process.argv.includes('--demo')) {
    mainWindow.setBounds({ x: 0, y: 0, width: 1180, height: 780 });
    mainWindow.webContents.on('did-finish-load', () => {
      runDemoScan(mainWindow);
    });
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// 生成 demo 测试目录并自动扫描，把结果推给 renderer 展示
async function runDemoScan(win) {
  try {
    const demoDir = path.join(os.tmpdir(), 'qingzhong-demo-' + Date.now());
    fs.mkdirSync(demoDir, { recursive: true });
    // 子目录：模拟真实文件夹结构
    const sub1 = path.join(demoDir, '旅行照片');
    const sub2 = path.join(demoDir, '工作文档');
    fs.mkdirSync(sub1, { recursive: true });
    fs.mkdirSync(sub2, { recursive: true });

    // 用真实风景图作为"重复图片"（演示预览效果）
    const photoSrc = path.join(__dirname, '..', 'build', 'demo-photo.jpg');
    if (fs.existsSync(photoSrc)) {
      const photoBuf = fs.readFileSync(photoSrc);
      fs.writeFileSync(path.join(sub1, 'IMG_2024_001.jpg'), photoBuf);
      fs.writeFileSync(path.join(sub1, 'IMG_备份.jpg'), photoBuf);
      fs.writeFileSync(path.join(demoDir, '封面.jpg'), photoBuf);
    }
    // 重复文本文件
    const txt = '项目周报\n第 12 周\n完成：登录模块、支付联调\n下周计划：性能优化';
    fs.writeFileSync(path.join(sub2, '周报-本周.txt'), txt);
    fs.writeFileSync(path.join(sub2, '周报-副本.txt'), txt);
    fs.writeFileSync(path.join(demoDir, 'old-周报.txt'), txt);

    // 推送进度假装在扫描
    const phases = [
      { phase: 'scan', scanned: 8 },
      { phase: 'size-done', scanned: 8, ignored: 5, candidates: 8 },
      { phase: 'partial', processed: 4, total: 8 },
      { phase: 'partial-done', groups: 2 },
      { phase: 'full', done: 4, total: 8 },
      { phase: 'done' }
    ];
    for (const p of phases) {
      win.webContents.send('scan-progress', p);
      await new Promise(r => setTimeout(r, 180));
    }

    const result = await scanDirectory(demoDir, { minSize: 1 }, (p) => {
      try { win.webContents.send('scan-progress', p); } catch (_) {}
    });
    win.webContents.send('demo-result', { dir: demoDir, result });
  } catch (e) {
    console.error('[demo] error:', e);
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== IPC =====

// 选目录
ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// 扫描
ipcMain.handle('scan-directory', async (event, dir, opts) => {
  if (scanning) return { error: '已有扫描进行中' };
  scanning = true;
  cancelRequested = false;
  try {
    const result = await scanDirectory(dir, opts || {}, (p) => {
      if (cancelRequested) throw new Error('cancelled');
      // 实时推送进度
      try { event.sender.send('scan-progress', p); } catch (_) { /* win closed */ }
    });
    return result;
  } catch (e) {
    if (e.message === 'cancelled') return { cancelled: true };
    return { error: e.message };
  } finally {
    scanning = false;
  }
});

// 取消扫描
ipcMain.handle('scan-cancel', async () => {
  cancelRequested = true;
  return true;
});

// 打开文件所在目录并选中
ipcMain.handle('reveal-file', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

// 打开文件（用系统默认程序）
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

// 读取图片为 dataURL（用于图片预览对比）
ipcMain.handle('read-image-dataurl', async (event, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    return { error: e.message };
  }
});

// 读取文本前 N 字节（用于文本预览）
ipcMain.handle('read-text-preview', async (event, filePath, maxBytes) => {
  try {
    maxBytes = maxBytes || 4096;
    const fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(maxBytes, size);
    const buf = Buffer.allocUnsafe(len);
    const n = fs.readSync(fd, buf, 0, len, 0);
    fs.closeSync(fd);
    return { text: buf.slice(0, n).toString('utf-8'), truncated: size > len, size };
  } catch (e) {
    return { error: e.message };
  }
});

// 删除文件（移到回收站，安全可恢复）
ipcMain.handle('trash-files', async (event, filePaths) => {
  const results = [];
  for (const p of filePaths) {
    try {
      await shell.trashItem(p);
      results.push({ path: p, ok: true });
    } catch (e) {
      results.push({ path: p, ok: false, error: e.message });
    }
  }
  return results;
});

// 打开外部链接（爱发电等）
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (e) {
    return { error: e.message };
  }
});

// 获取爱发电链接
ipcMain.handle('get-afdian-url', async () => AFDIAN_URL);

// 获取应用版本
ipcMain.handle('get-app-info', async () => ({
  name: '清重管家',
  version: app.getVersion(),
  afdian: AFDIAN_URL
}));
