const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 720,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#f5f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '..', 'build', 'icon-source.png')
  });

  // 支持 --demo 参数用于截图展示
  const isDemo = process.argv.includes('--demo');
  const loadUrl = isDemo
    ? 'file://' + path.join(__dirname, 'renderer', 'index.html') + '?demo=1'
    : path.join(__dirname, 'renderer', 'index.html');
  if (isDemo) mainWindow.loadURL(loadUrl);
  else mainWindow.loadFile(loadUrl);

  // 准备就绪后再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 单实例锁，避免重复启动
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 移除默认菜单栏，营造原生应用质感
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// ========== 图片压缩核心逻辑 ==========

/**
 * 压缩单张图片
 * @param {string} inputPath 输入路径
 * @param {string} outputPath 输出路径
 * @param {object} options 压缩选项 { quality, format, resize }
 */
async function compressImage(inputPath, outputPath, options) {
  const { quality = 80, format = 'keep', resize = null } = options;

  let pipeline = sharp(inputPath, { failOn: 'truncated' });

  // 可选尺寸调整
  if (resize && resize.enabled) {
    pipeline = pipeline.resize({
      width: resize.width || null,
      height: resize.height || null,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // 输出格式与质量
  let outputFormat = format;
  if (format === 'keep') {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') outputFormat = 'jpeg';
    else if (ext === '.png') outputFormat = 'png';
    else if (ext === '.webp') outputFormat = 'webp';
    else outputFormat = 'jpeg'; // 默认转 jpeg
  }

  const qualityVal = Math.max(1, Math.min(100, parseInt(quality, 10) || 80));

  if (outputFormat === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: qualityVal, mozjpeg: true, progressive: true });
  } else if (outputFormat === 'png') {
    pipeline = pipeline.png({
      quality: qualityVal,
      compressionLevel: 9,
      palette: qualityVal < 100,
      effort: 10
    });
  } else if (outputFormat === 'webp') {
    pipeline = pipeline.webp({ quality: qualityVal, effort: 6 });
  } else {
    pipeline = pipeline.jpeg({ quality: qualityVal });
  }

  await pipeline.toFile(outputPath);
  const stat = await fs.promises.stat(outputPath);
  return { outputPath, outputSize: stat.size };
}

// ========== IPC 通信 ==========

// 选择输出目录
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 选择图片文件
ipcMain.handle('dialog:selectImages', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择图片',
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return [];
  return result.filePaths;
});

// 读取图片元信息
ipcMain.handle('image:getInfo', async (event, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    const meta = await sharp(filePath).metadata();
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      width: meta.width,
      height: meta.height,
      format: meta.format
    };
  } catch (err) {
    return { path: filePath, name: path.basename(filePath), size: 0, error: err.message };
  }
});

// 批量压缩
ipcMain.handle('image:compressBatch', async (event, payload) => {
  const { files, options, outputDir } = payload;
  // 默认输出目录：取首个文件所在目录
  const finalOutputDir = outputDir || (files.length ? path.dirname(files[0]) : process.cwd());
  try { await fs.promises.mkdir(finalOutputDir, { recursive: true }); } catch (e) {}
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const baseName = path.basename(filePath, path.extname(filePath));
    const format = options.format || 'keep';
    let ext = path.extname(filePath).toLowerCase();
    if (format !== 'keep') ext = '.' + format;
    const outName = baseName + '_compressed' + ext;
    const outputPath = path.join(finalOutputDir, outName);
    try {
      // 进度回调
      mainWindow.webContents.send('compress:progress', {
        index: i,
        total: files.length,
        current: path.basename(filePath)
      });
      const r = await compressImage(filePath, outputPath, options);
      const originalSize = (await fs.promises.stat(filePath)).size;
      const reduction = originalSize > 0
        ? Math.round(((originalSize - r.outputSize) / originalSize) * 100)
        : 0;
      results.push({
        input: filePath,
        output: r.outputPath,
        originalSize,
        compressedSize: r.outputSize,
        reduction,
        success: true
      });
    } catch (err) {
      results.push({
        input: filePath,
        output: null,
        originalSize: 0,
        compressedSize: 0,
        reduction: 0,
        success: false,
        error: err.message
      });
    }
  }
  return results;
});

// 获取应用版本信息
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});
