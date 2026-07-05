const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const pdf = require('./core/pdf-ops.js');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'default',
    title: 'PDF管家',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------- IPC 处理器 ----------

function setupIPC() {
  // 选择多个 PDF 文件
  ipcMain.handle('select-pdfs', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 PDF 文件',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  // 选择多个图片文件
  ipcMain.handle('select-images', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择图片文件',
      filters: [{ name: '图片文件', extensions: ['jpg', 'jpeg', 'png'] }],
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  });

  // 选择单个 PDF 文件
  ipcMain.handle('select-pdf', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 PDF 文件',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      properties: ['openFile']
    });
    if (result.canceled || result.filePaths.length === 0) return '';
    return result.filePaths[0];
  });

  // 选择输出文件路径
  ipcMain.handle('save-pdf', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存为',
      defaultPath: defaultName || 'output.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    });
    if (result.canceled) return '';
    return result.filePath;
  });

  // 选择输出目录
  ipcMain.handle('select-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择输出目录',
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return '';
    return result.filePaths[0];
  });

  // 获取文件大小（KB/MB）
  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      return {
        size: stat.size,
        sizeText: pdf.formatSize(stat.size),
        mtime: stat.mtimeMs
      };
    } catch (e) {
      return null;
    }
  });

  // 打开文件所在目录
  ipcMain.handle('open-in-folder', async (event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return false;
    shell.showItemInFolder(filePath);
    return true;
  });

  // 打开外部链接（爱发电等）
  ipcMain.handle('open-external', async (event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    shell.openExternal(url);
    return true;
  });

  ipcMain.handle('get-afdian-url', async () => AFDIAN_URL);

  // ---------- 业务操作 ----------

  // 1. 合并 PDF
  ipcMain.handle('merge-pdfs', async (event, filePaths, outputPath) => {
    return await pdf.mergePDFs(filePaths, outputPath, (p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('op-progress', p);
      }
    });
  });

  // 2. 拆分 PDF
  ipcMain.handle('split-pdf', async (event, inputPath, outputDir, opts) => {
    return await pdf.splitPDF(inputPath, outputDir, opts);
  });

  // 3. 压缩 PDF
  ipcMain.handle('compress-pdf', async (event, inputPath, outputPath) => {
    return await pdf.compressPDF(inputPath, outputPath);
  });

  // 4. 加密 PDF
  ipcMain.handle('encrypt-pdf', async (event, inputPath, outputPath, opts) => {
    return await pdf.encryptPDF(inputPath, outputPath, opts);
  });

  // 5. 解密 PDF
  ipcMain.handle('decrypt-pdf', async (event, inputPath, outputPath, password) => {
    return await pdf.decryptPDF(inputPath, outputPath, password);
  });

  // 6. 加水印
  ipcMain.handle('add-watermark', async (event, inputPath, outputPath, opts) => {
    return await pdf.addWatermark(inputPath, outputPath, opts);
  });

  // 7. 图片转 PDF
  ipcMain.handle('images-to-pdf', async (event, imagePaths, outputPath, opts) => {
    return await pdf.imagesToPDF(imagePaths, outputPath, opts);
  });
}

// ---------- 应用生命周期 ----------

app.whenReady().then(() => {
  createWindow();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 单实例锁
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
