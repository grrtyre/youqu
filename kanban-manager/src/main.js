// Electron 主进程 - 看板管家
// 苹果白风格本地优先看板任务管理工具
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// 把 userData 重定向到 D 盘，不污染 C 盘（必须在 ready 前设置）
const customUserData = path.join('D:', 'Ai', 'mimo', 'youqu', 'kanban-manager', '.appdata');
try { app.setPath('userData', customUserData); } catch (e) { /* 忽略 */ }

// 禁用 Chromium 后台节流与遮挡检测，确保后台截图能渲染内容
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// 禁用 GPU 合成，使用软件渲染（PrintWindow 后台截图需要）
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('in-process-gpu');

// 数据存储路径：用户目录下 youqu/kanban-manager/data.json
const userDataDir = path.join(app.getPath('userData'), 'youqu-kanban');
const dataFile = path.join(userDataDir, 'kanban-data.json');

function ensureDataDir() {
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  if (!fs.existsSync(dataFile)) {
    const now = Date.now();
    const day = 86400000;
    const initialData = {
      boards: [
        {
          id: 'default',
          name: '我的看板',
          lists: [
            {
              id: 'l1', name: '待办',
              cards: [
                { id: 'c1', title: '完成看板管家 v1.0 发布稿', desc: '撰写 README 与更新日志，准备截图素材', labels: ['文档'], priority: 'high', due: new Date(now + day).toISOString(), createdAt: now, completed: false },
                { id: 'c2', title: '调研竞品功能差异', desc: '对比 Trello / Notion / 飞书看板', labels: ['调研', '产品'], priority: 'med', due: new Date(now + 2 * day).toISOString(), createdAt: now, completed: false },
                { id: 'c3', title: '设计应用图标', labels: ['设计'], priority: 'low', due: null, createdAt: now, completed: false }
              ]
            },
            {
              id: 'l2', name: '进行中',
              cards: [
                { id: 'c4', title: '实现拖拽排序逻辑', desc: '支持卡片在列表间拖拽与列表内重排', labels: ['开发'], priority: 'high', due: new Date(now + 0.5 * day).toISOString(), createdAt: now, completed: false },
                { id: 'c5', title: '苹果白样式调优', labels: ['设计', '开发'], priority: 'med', due: null, createdAt: now, completed: false }
              ]
            },
            {
              id: 'l3', name: '已完成',
              cards: [
                { id: 'c6', title: '搭建项目骨架', labels: ['开发'], priority: 'med', due: null, createdAt: now, completed: true },
                { id: 'c7', title: '核心逻辑单元测试', labels: ['测试'], priority: 'high', due: null, createdAt: now, completed: true }
              ]
            }
          ],
          createdAt: now
        }
      ],
      settings: { theme: 'light', accent: '#007aff' }
    };
    fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

function readData() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
  } catch (e) {
    return { boards: [], settings: { theme: 'light', accent: '#007aff' } };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderers', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 禁用外部链接默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC: 数据读写
ipcMain.handle('data:read', () => readData());
ipcMain.handle('data:write', (event, data) => {
  writeData(data);
  return { success: true };
});

// IPC: 导出 JSON
ipcMain.handle('data:export', async (event, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出看板数据',
    defaultPath: `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false, message: '取消导出' };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return { success: true, filePath };
});

// IPC: 导入 JSON
ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '导入看板数据',
    properties: ['openFile'],
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (canceled || !filePaths.length) return { success: false, message: '取消导入' };
  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (e) {
    return { success: false, message: '文件格式错误：' + e.message };
  }
});

// 应用菜单
function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '导出数据...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export') },
        { label: '导入数据...', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:import') },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于看板管家', click: () => mainWindow?.webContents.send('menu:about') },
        { label: '爱发电支持', click: () => shell.openExternal('https://www.ifdian.net/a/giquwei') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  ensureDataDir();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
