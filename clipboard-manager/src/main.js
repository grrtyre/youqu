const { app, BrowserWindow, Tray, Menu, clipboard, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// 爱发电统一链接
const AFDIAN_URL = 'https://www.ifdian.net/a/giquwei';

const POLL_INTERVAL = 500;
const MAX_ITEMS = 500;
// 图片单独上限：图片占磁盘，单独限制最多保留 50 张
const MAX_IMAGE_ITEMS = 50;

let mainWindow = null;
let tray = null;
let clipboardHistory = [];
let lastContent = '';
let lastImageFp = ''; // 图片指纹：用于去重
let pollTimer = null;

const userDataPath = app.getPath('userData');
const historyFile = path.join(userDataPath, 'clipboard-history.json');
const imagesDir = path.join(userDataPath, 'clipboard-images');

// 确保图片存储目录存在
function ensureImagesDir() {
  try {
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create images dir:', e.message);
  }
}

// 计算图片指纹：宽×高 + PNG 编码后字节数
// 注：Electron nativeImage 没有 .size() 方法，字节数用 toPNG().length
function imageFingerprint(nativeImg) {
  if (!nativeImg || nativeImg.isEmpty()) return '';
  const size = nativeImg.getSize(); // {width, height}
  return size.width + 'x' + size.height + ':' + nativeImg.toPNG().length;
}

// 清理孤儿图片文件（条目已不存在但文件还在）
function cleanupOrphanImages() {
  try {
    if (!fs.existsSync(imagesDir)) return;
    const validPaths = new Set(
      clipboardHistory
        .filter(i => i.type === 'image' && i.imagePath)
        .map(i => path.resolve(i.imagePath))
    );
    const files = fs.readdirSync(imagesDir);
    for (const f of files) {
      if (!f.endsWith('.png')) continue;
      const full = path.resolve(path.join(imagesDir, f));
      if (!validPaths.has(full)) {
        try { fs.unlinkSync(full); } catch (e) { /* 忽略单个删除失败 */ }
      }
    }
  } catch (e) {
    console.error('cleanupOrphanImages error:', e.message);
  }
}

// 删除条目对应的图片文件（如果是图片条目）
function deleteImageFileOfItem(item) {
  if (item && item.type === 'image' && item.imagePath) {
    try {
      if (fs.existsSync(item.imagePath)) fs.unlinkSync(item.imagePath);
    } catch (e) { /* 忽略 */ }
  }
}

// 限制图片条目数量：超出则删除最旧的未置顶未收藏图片条目
function enforceImageLimit() {
  const imageItems = clipboardHistory.filter(i => i.type === 'image');
  if (imageItems.length <= MAX_IMAGE_ITEMS) return;
  // 按 timestamp 升序，跳过置顶/收藏，删除最旧的
  const sorted = imageItems
    .filter(i => !i.pinned && !i.favorite)
    .sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = sorted.slice(0, imageItems.length - MAX_IMAGE_ITEMS);
  for (const item of toRemove) {
    deleteImageFileOfItem(item);
    const idx = clipboardHistory.findIndex(i => i.id === item.id);
    if (idx !== -1) clipboardHistory.splice(idx, 1);
  }
}

// --- Data persistence ---

function loadHistory() {
  try {
    if (fs.existsSync(historyFile)) {
      let raw = fs.readFileSync(historyFile, 'utf-8');
      // 容错：去掉 UTF-8 BOM（外部编辑器可能写入 BOM）
      if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
      const data = JSON.parse(raw);
      clipboardHistory = Array.isArray(data.items) ? data.items : [];
    } else {
      clipboardHistory = [];
    }
  } catch (e) {
    console.error('Failed to load clipboard history:', e.message);
    clipboardHistory = [];
  }
}

function saveHistory() {
  try {
    const dir = path.dirname(historyFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(historyFile, JSON.stringify({ items: clipboardHistory }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save clipboard history:', e.message);
  }
}

// --- Classification ---

function classifyContent(text) {
  if (typeof text !== 'string' || text.length === 0) return 'text';
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) return 'link';
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return 'email';
  if (/^1[3-9]\d{9}$/.test(trimmed)) return 'phone';
  if (/(?:function|const|let|var|import|export|=>|class |return |if\s*\(|for\s*\(|while\s*\(|switch\s*\(|\.map\(|\.filter\(|\.forEach\(|async |await )/.test(trimmed)) return 'code';
  if (trimmed.includes('\n') && trimmed.split('\n').length >= 2) {
    const lines = trimmed.split('\n');
    const indentedLines = lines.filter(l => /^\s{2,}/.test(l));
    if (indentedLines.length >= Math.floor(lines.length / 2)) return 'code';
  }
  return 'text';
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- Clipboard polling ---

// 生成缩略图 dataURL：限制最大边 240px，JPEG 80 质量（避免 history JSON 过大）
function makeThumbnailDataURL(nativeImg) {
  try {
    const size = nativeImg.getSize();
    const maxEdge = 240;
    let w = size.width, h = size.height;
    if (w > maxEdge || h > maxEdge) {
      if (w >= h) { h = Math.round(h * maxEdge / w); w = maxEdge; }
      else { w = Math.round(w * maxEdge / h); h = maxEdge; }
    }
    const thumb = nativeImg.resize({ width: w, height: h, quality: 'good' });
    // Electron 28: toDataURL(options) 接受 {format, quality} 对象
    return thumb.toDataURL({ format: 'image/jpeg', quality: 0.8 });
  } catch (e) {
    console.error('makeThumbnailDataURL error:', e.message);
    return '';
  }
}

// 把图片保存为 PNG 文件并加入历史
function addImageItem(nativeImg) {
  ensureImagesDir();
  const id = genId();
  const file = path.join(imagesDir, id + '.png');
  try {
    fs.writeFileSync(file, nativeImg.toPNG());
  } catch (e) {
    console.error('Failed to save image file:', e.message);
    return;
  }
  const size = nativeImg.getSize();
  const item = {
    id,
    content: '[图片] ' + size.width + '×' + size.height,
    type: 'image',
    imagePath: file,
    thumb: makeThumbnailDataURL(nativeImg), // 缩略图 dataURL，渲染时直接用，避免 file:// 加载问题
    width: size.width,
    height: size.height,
    timestamp: Date.now(),
    pinned: false,
    favorite: false
  };
  clipboardHistory.unshift(item);
  enforceImageLimit();
  if (clipboardHistory.length > MAX_ITEMS) {
    clipboardHistory = clipboardHistory.slice(0, MAX_ITEMS);
  }
  saveHistory();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('history-updated');
  }
}

function startClipboardPolling() {
  // 初始化：记录当前剪贴板状态，避免启动时把已有内容重复加入
  lastContent = clipboard.readText() || '';
  try {
    const formats = clipboard.availableFormats();
    if (formats.some(f => f.startsWith('image/'))) {
      const img = clipboard.readImage();
      if (!img.isEmpty()) lastImageFp = imageFingerprint(img);
    }
  } catch (e) { /* 忽略 */ }

  pollTimer = setInterval(() => {
    try {
      const current = clipboard.readText() || '';
      // 优先处理文本变化
      if (current && current !== lastContent) {
        lastContent = current;
        // 去重：与最新条目内容相同则跳过
        if (clipboardHistory.length > 0 && clipboardHistory[0].content === current) {
          return;
        }
        const item = {
          id: genId(),
          content: current,
          type: classifyContent(current),
          timestamp: Date.now(),
          pinned: false,
          favorite: false
        };
        clipboardHistory.unshift(item);
        if (clipboardHistory.length > MAX_ITEMS) {
          clipboardHistory = clipboardHistory.slice(0, MAX_ITEMS);
        }
        saveHistory();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('history-updated');
        }
        return;
      }
      // 文本未变化：检查是否有图片（截图、复制图片等场景）
      const formats = clipboard.availableFormats();
      if (formats.some(f => f.startsWith('image/'))) {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const size = img.getSize();
          const dims = size.width + 'x' + size.height;
          // 两阶段去重：先比尺寸（廉价），尺寸相同再比 PNG 字节数（区分同尺寸不同内容）
          const lastDims = lastImageFp ? lastImageFp.split(':')[0] : '';
          let fp;
          if (dims !== lastDims) {
            // 尺寸不同 → 必定是新图片，直接用尺寸+字节数
            fp = dims + ':' + img.toPNG().length;
          } else {
            // 尺寸相同 → 需要字节数才能判断
            fp = dims + ':' + img.toPNG().length;
          }
          if (fp !== lastImageFp) {
            lastImageFp = fp;
            addImageItem(img);
          }
        }
      } else {
        // 剪贴板既无文本也无图片：重置图片指纹，便于下次复制相同图片能被捕获
        if (lastImageFp) lastImageFp = '';
      }
    } catch (e) {
      console.error('Clipboard poll error:', e.message);
    }
  }, POLL_INTERVAL);
}

function stopClipboardPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// --- Window ---

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    frame: false,
    transparent: false,
    show: false,
    skipTaskbar: true,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    // minimize-to-tray: hide instead of close
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Position near the tray (bottom-right, above taskbar)
    const { screen } = require('electron');
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea; // {x, y, width, height}
    const winWidth = 480;
    const winHeight = 600;
    mainWindow.setBounds({
      x: wa.x + wa.width - winWidth - 16,
      y: wa.y + wa.height - winHeight - 16,
      width: winWidth,
      height: winHeight
    });
    mainWindow.show();
    mainWindow.focus();
  }
}

// --- IPC handlers ---

function setupIPC() {
  ipcMain.handle('get-items', () => {
    return clipboardHistory;
  });

  ipcMain.handle('search-items', (event, query) => {
    if (!query || typeof query !== 'string') return clipboardHistory;
    const q = query.toLowerCase();
    return clipboardHistory.filter(item =>
      item.content.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    );
  });

  ipcMain.handle('copy-item', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      if (item.type === 'image' && item.imagePath) {
        // 图片条目：从文件读取并写入剪贴板
        try {
          if (!fs.existsSync(item.imagePath)) return false;
          const img = nativeImage.createFromPath(item.imagePath);
          if (img.isEmpty()) return false;
          clipboard.writeImage(img);
          lastImageFp = imageFingerprint(img);
          // 写入图片后清空 lastContent，避免下一次轮询误把旧文本当新内容
          lastContent = '';
          return true;
        } catch (e) {
          console.error('copy image item error:', e.message);
          return false;
        }
      }
      // 文本条目：写入文本
      clipboard.writeText(item.content);
      lastContent = item.content;
      return true;
    }
    return false;
  });

  ipcMain.handle('toggle-favorite', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      item.favorite = !item.favorite;
      saveHistory();
      return item;
    }
    return null;
  });

  ipcMain.handle('toggle-pin', (event, id) => {
    const item = clipboardHistory.find(i => i.id === id);
    if (item) {
      item.pinned = !item.pinned;
      saveHistory();
      return item;
    }
    return null;
  });

  ipcMain.handle('delete-item', (event, id) => {
    const idx = clipboardHistory.findIndex(i => i.id === id);
    if (idx !== -1) {
      const item = clipboardHistory[idx];
      deleteImageFileOfItem(item);
      clipboardHistory.splice(idx, 1);
      saveHistory();
      return true;
    }
    return false;
  });

  // 清空：保留置顶和收藏（与按钮文案一致）
  ipcMain.handle('clear-all', () => {
    const removed = clipboardHistory.filter(i => !(i.pinned || i.favorite));
    for (const item of removed) deleteImageFileOfItem(item);
    clipboardHistory = clipboardHistory.filter(i => i.pinned || i.favorite);
    saveHistory();
    return true;
  });

  // 编辑条目内容（仅文本类条目；图片条目不允许编辑）
  ipcMain.handle('edit-item', (event, id, newContent) => {
    if (typeof newContent !== 'string' || newContent.trim().length === 0) return false;
    const item = clipboardHistory.find(i => i.id === id);
    if (!item) return false;
    if (item.type === 'image') return false; // 图片不可编辑
    const trimmed = newContent.replace(/\r\n/g, '\n');
    item.content = trimmed;
    // 重新分类（编辑后类型可能变化）
    item.type = classifyContent(trimmed);
    saveHistory();
    return item;
  });

  // 打开外部链接（用于爱发电等）
  ipcMain.handle('open-external', (event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
    shell.openExternal(url);
    return true;
  });

  // 获取数据存储路径（供设置面板展示）
  ipcMain.handle('get-data-path', () => historyFile);

  // 获取爱发电链接
  ipcMain.handle('get-afdian-url', () => AFDIAN_URL);

  // 一键粘贴到前台窗口：隐藏自己 → 等待 → 发送 Ctrl+V
  ipcMain.handle('paste-to-front', () => {
    return new Promise((resolve) => {
      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
      }
      // 等待 80ms 让焦点回到目标窗口，再发送 Ctrl+V
      setTimeout(() => {
        const ps = [
          '$wshell = New-Object -ComObject WScript.Shell;',
          'Start-Sleep -Milliseconds 100;',
          '$wshell.SendKeys("^v")'
        ].join(' ');
        execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }, (err) => {
          if (err) console.error('paste-to-front error:', err.message);
          resolve(!err);
        });
      }, 80);
    });
  });
}

// --- Tray ---

function createTray() {
  // 使用真实图标（多尺寸 ico），避免托盘栏无图标
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  let icon;
  try {
    icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  } catch (e) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip('剪贴板管家');

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示面板', click: () => toggleWindow() },
    { type: 'separator' },
    {
      label: '退出', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => toggleWindow());
}

// --- App lifecycle ---

app.whenReady().then(() => {
  ensureImagesDir();
  loadHistory();
  cleanupOrphanImages();
  createWindow();
  createTray();
  setupIPC();
  startClipboardPolling();

  // 开发模式或 --show 参数：启动时直接显示窗口
  if (process.argv.includes('--dev') || process.argv.includes('--show')) {
    if (mainWindow) {
      const { screen } = require('electron');
      const display = screen.getPrimaryDisplay();
      const wa = display.workArea;
      mainWindow.setBounds({
        x: wa.x + wa.width - 480 - 16,
        y: wa.y + wa.height - 600 - 16,
        width: 480,
        height: 600
      });
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // Global shortcut
  const { globalShortcut } = require('electron');
  globalShortcut.register('Ctrl+Shift+V', () => {
    toggleWindow();
  });
});

app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
  stopClipboardPolling();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      toggleWindow();
    }
  });
}

app.on('window-all-closed', (e) => {
  // On Windows/Linux don't quit when all windows closed (tray app)
  e.preventDefault?.();
});
