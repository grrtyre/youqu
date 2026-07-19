// main.js - 语音备忘录管理器 主进程
// 苹果白高端风格 Electron 桌面应用

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

// 录音存储目录（用户数据目录下）
function getRecordingsDir() {
  const dir = path.join(app.getPath('userData'), 'recordings');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 元数据 JSON 文件
function getMetaFile() {
  return path.join(app.getPath('userData'), 'meta.json');
}

// 读取元数据
async function readMeta() {
  try {
    const data = await fsp.readFile(getMetaFile(), 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { recordings: [] };
  }
}

// 写入元数据
async function writeMeta(meta) {
  await fsp.writeFile(getMetaFile(), JSON.stringify(meta, null, 2), 'utf8');
}

let mainWindow = null;
let tray = null;

// 后台截图模式：通过 MIMO_CAPTURE=1 启用，窗口定位到屏幕外，绝不抢占前台
const MIMO_CAPTURE = process.env.MIMO_CAPTURE === '1';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 640,
    minWidth: 720,
    minHeight: 520,
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f5f5f7',
    title: '语音备忘录',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    x: MIMO_CAPTURE ? -32000 : undefined,
    y: MIMO_CAPTURE ? -32000 : undefined,
    focusable: !MIMO_CAPTURE,
    skipTaskbar: MIMO_CAPTURE,
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (MIMO_CAPTURE) {
      // 后台模式：不调用 show()，但 offscreen rendering 仍生效（PrintWindow 可捕获）
      // 仍需调用 showInactive 在屏幕外位置渲染首帧
      mainWindow.showInactive();
    } else {
      mainWindow.show();
    }
  });

  // 关闭时隐藏到托盘而不是退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting && !MIMO_CAPTURE) {
      e.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // 生成一个 16x16 蓝色圆点作为托盘图标（无外部图标资源时的兜底）
  let trayIcon = nativeImage.createEmpty();
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  }
  if (trayIcon.isEmpty()) {
    // 1x1 透明兜底
    trayIcon = nativeImage.createFromBuffer(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQElEQVR4nGNgGAWjYBSMglEwCkbBKAORsIjBVDBAAhgBANo+DXQ7Q2oHAMk+Ac0gkLkBsQuQOXcCkQMAJ/sBjF0PC0kAAAAASUVORK5CYII=', 'base64'));
  }
  tray = new Tray(trayIcon);
  tray.setToolTip('语音备忘录');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// 单实例锁
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    getRecordingsDir();
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else if (mainWindow) mainWindow.show();
    });
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

// ============= IPC 处理 =============

// 保存录音文件：接收 buffer + 元信息，落盘并写入 meta
ipcMain.handle('recording:save', async (event, { bufferBase64, mimeType, title }) => {
  try {
    const dir = getRecordingsDir();
    const id = 'rec_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const ext = mimeType && mimeType.includes('webm') ? '.webm'
              : mimeType && mimeType.includes('mp3') ? '.mp3'
              : mimeType && mimeType.includes('ogg') ? '.ogg'
              : '.webm';
    const fileName = id + ext;
    const filePath = path.join(dir, fileName);
    const buf = Buffer.from(bufferBase64, 'base64');
    await fsp.writeFile(filePath, buf);

    const stat = await fsp.stat(filePath);
    const meta = await readMeta();
    const item = {
      id,
      title: title || ('录音 ' + new Date().toLocaleString('zh-CN')),
      fileName,
      size: stat.size,
      createdAt: Date.now(),
      duration: 0
    };
    meta.recordings.unshift(item);
    await writeMeta(meta);
    return { ok: true, item };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 更新录音时长
ipcMain.handle('recording:updateDuration', async (event, { id, duration }) => {
  try {
    const meta = await readMeta();
    const item = meta.recordings.find(r => r.id === id);
    if (item) {
      item.duration = duration;
      await writeMeta(meta);
      return { ok: true };
    }
    return { ok: false, error: 'not found' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 获取列表
ipcMain.handle('recording:list', async () => {
  try {
    const meta = await readMeta();
    // 过滤掉文件已不存在的
    const dir = getRecordingsDir();
    const valid = [];
    for (const r of meta.recordings) {
      const p = path.join(dir, r.fileName);
      if (fs.existsSync(p)) valid.push(r);
      else console.warn('missing file:', r.fileName);
    }
    if (valid.length !== meta.recordings.length) {
      meta.recordings = valid;
      await writeMeta(meta);
    }
    return { ok: true, recordings: valid };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 读取录音文件（返回 base64 给渲染进程播放）
ipcMain.handle('recording:read', async (event, { id }) => {
  try {
    const meta = await readMeta();
    const item = meta.recordings.find(r => r.id === id);
    if (!item) return { ok: false, error: 'not found' };
    const p = path.join(getRecordingsDir(), item.fileName);
    const buf = await fsp.readFile(p);
    return {
      ok: true,
      base64: buf.toString('base64'),
      mimeType: item.fileName.endsWith('.mp3') ? 'audio/mp3'
              : item.fileName.endsWith('.ogg') ? 'audio/ogg'
              : 'audio/webm'
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 重命名
ipcMain.handle('recording:rename', async (event, { id, title }) => {
  try {
    const meta = await readMeta();
    const item = meta.recordings.find(r => r.id === id);
    if (!item) return { ok: false, error: 'not found' };
    item.title = title;
    await writeMeta(meta);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 删除
ipcMain.handle('recording:delete', async (event, { id }) => {
  try {
    const meta = await readMeta();
    const idx = meta.recordings.findIndex(r => r.id === id);
    if (idx < 0) return { ok: false, error: 'not found' };
    const item = meta.recordings[idx];
    const p = path.join(getRecordingsDir(), item.fileName);
    if (fs.existsSync(p)) await fsp.unlink(p);
    meta.recordings.splice(idx, 1);
    await writeMeta(meta);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 在文件管理器中显示
ipcMain.handle('recording:reveal', async (event, { id }) => {
  try {
    const meta = await readMeta();
    const item = meta.recordings.find(r => r.id === id);
    if (!item) return { ok: false, error: 'not found' };
    const p = path.join(getRecordingsDir(), item.fileName);
    shell.showItemInFolder(p);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 打开录音目录
ipcMain.handle('recording:openDir', async () => {
  shell.openPath(getRecordingsDir());
  return { ok: true };
});
