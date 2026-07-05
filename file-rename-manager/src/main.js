// main.js —— Electron 主进程
// 重命名管家：窗口管理、文件扫描、重命名执行、预设持久化

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { createFileItem, generatePreview, executeRename, undoRename } = require('./core/rename-engine');
const { readExifDate } = require('./core/exif-reader');
const { loadPresets, addPreset, deletePreset } = require('./core/preset-store');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.tif', '.tiff']);
let mainWindow = null;
let lastHistory = []; // 最近一次重命名的历史（用于撤销）

const userDataPath = () => app.getPath('userData');
const presetFile = () => path.join(userDataPath(), 'presets.json');

// ---------- 文件扫描 ----------

/** 递归扫描路径列表（文件/文件夹混合），返回所有文件路径 */
async function scanFilePaths(inputPaths, recursive) {
  const result = [];
  for (const p of inputPaths) {
    try {
      const stat = await fs.promises.stat(p);
      if (stat.isFile()) {
        result.push(p);
      } else if (stat.isDirectory()) {
        if (!recursive) continue;
        const entries = await fs.promises.readdir(p, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(p, entry.name);
          if (entry.isFile()) {
            result.push(fullPath);
          } else if (entry.isDirectory() && recursive) {
            const sub = await scanFilePaths([fullPath], recursive);
            result.push(...sub);
          }
        }
      }
    } catch (e) {
      // 跳过无法访问的路径
    }
  }
  return result;
}

/** 并发读取文件项（含 stat + EXIF），限制并发数 */
async function buildFileItems(filePaths) {
  const CONCURRENCY = 16;
  const results = new Array(filePaths.length);
  let idx = 0;
  async function worker() {
    while (idx < filePaths.length) {
      const i = idx++;
      const fp = filePaths[i];
      try {
        const stat = await fs.promises.stat(fp);
        let exifDate = null;
        const ext = path.extname(fp).toLowerCase();
        if (IMAGE_EXTS.has(ext) && stat.size < 50 * 1024 * 1024) {
          try { exifDate = await readExifDate(fp); } catch (_) {}
        }
        results[i] = createFileItem(fp, stat, i, exifDate);
      } catch (e) {
        results[i] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, filePaths.length) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

// ---------- 窗口 ----------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // 直接关闭
    app.isQuitting = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.once('ready-to-show', () => {
    if (process.argv.includes('--dev') || process.argv.includes('--show') || process.argv.includes('--demo')) {
      mainWindow.show();
      mainWindow.focus();
      if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
      // demo 模式：自动加载示例文件和规则，便于截图展示
      if (process.argv.includes('--demo')) {
        loadDemoData();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------- IPC ----------

function setupIPC() {
  // 打开文件选择对话框
  ipcMain.handle('pick-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文件',
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  // 打开文件夹选择对话框
  ipcMain.handle('pick-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择文件夹',
      properties: ['openDirectory']
    });
    if (result.canceled) return [];
    return result.filePaths;
  });

  // 扫描路径列表，返回文件项
  ipcMain.handle('scan-paths', async (event, paths, recursive = true) => {
    if (!Array.isArray(paths) || paths.length === 0) return [];
    const filePaths = await scanFilePaths(paths, recursive);
    const items = await buildFileItems(filePaths);
    return items;
  });

  // 生成预览（引擎在 main 侧执行，避免渲染层重复加载）
  ipcMain.handle('generate-preview', (event, items, rules) => {
    return generatePreview(items || [], rules || []);
  });

  // 执行重命名
  ipcMain.handle('execute-rename', async (event, preview) => {
    const result = await executeRename(preview || []);
    lastHistory = result.history;
    return { success: result.success, failed: result.failed };
  });

  // 撤销最近一次重命名
  ipcMain.handle('undo-rename', async () => {
    if (lastHistory.length === 0) return { success: 0, failed: 0, empty: true };
    const result = await undoRename(lastHistory);
    lastHistory = [];
    return result;
  });

  // 是否有可撤销的历史
  ipcMain.handle('has-undo-history', () => lastHistory.length > 0);

  // 预设管理
  ipcMain.handle('preset-list', () => loadPresets(presetFile()));
  ipcMain.handle('preset-add', (event, name, rules) => addPreset(presetFile(), name, rules));
  ipcMain.handle('preset-delete', (event, id) => deletePreset(presetFile(), id));

  // 打开外部链接（爱发电等）
  ipcMain.handle('open-external', (event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    shell.openExternal(url);
    return true;
  });

  // 获取爱发电链接
  ipcMain.handle('get-afdian-url', () => AFDIAN_URL);

  // 窗口控制（自定义标题栏）
  ipcMain.handle('win-minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('win-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('win-close', () => {
    app.isQuitting = true;
    if (mainWindow) mainWindow.close();
  });
}

// ---------- Demo 数据（用于截图展示） ----------

async function loadDemoData() {
  const os = require('os');
  const demoDir = path.join(os.tmpdir(), 'rename-demo-' + Date.now());
  try {
    fs.mkdirSync(demoDir, { recursive: true });
    const demoFiles = [
      'IMG_20240115_001.jpg',
      'IMG_20240115_002.jpg',
      'photo_beijing.jpg',
      'photo_shanghai.jpg',
      'screenshot_001.png',
      'screenshot_002.png',
      'DSC_0001.NEF',
      'DSC_0002.NEF',
      'vacation_2024.mov',
      'document_final_v2.pdf'
    ];
    demoFiles.forEach(f => {
      fs.writeFileSync(path.join(demoDir, f), 'demo content');
    });
    const items = await buildFileItems(demoFiles.map(f => path.join(demoDir, f)));
    const demoRules = [
      { type: 'sequence', prefix: '照片_', start: 1, step: 1, pad: 3, suffix: '', position: 'replace' }
    ];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('demo-data', { items, rules: demoRules });
    }
  } catch (e) {
    console.error('Demo 数据加载失败:', e.message);
  }
}

// ---------- 生命周期 ----------

app.whenReady().then(() => {
  createWindow();
  setupIPC();
});

app.on('window-all-closed', () => {
  app.quit();
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
