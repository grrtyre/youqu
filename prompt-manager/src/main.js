// 主进程 - 创建窗口与管理应用生命周期
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// 用户数据文件路径
function getDataPath() {
  return path.join(app.getPath('userData'), 'prompts.json');
}

// 初始化空数据
function initDataFile() {
  const p = getDataPath();
  if (!fs.existsSync(p)) {
    const seed = {
      prompts: [
        {
          id: 'seed-1',
          title: '智能翻译',
          content: '请将以下内容翻译为{{目标语言}}，保持语气自然流畅：\n\n{{待翻译内容}}',
          category: '翻译',
          tags: ['翻译', '语言'],
          favorite: true,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        },
        {
          id: 'seed-2',
          title: '周报生成',
          content: '请根据以下要点撰写一份结构清晰的周报，分为本周进展、下周计划、风险与求助三部分：\n\n{{本周要点}}',
          category: '写作',
          tags: ['工作', '周报'],
          favorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        },
        {
          id: 'seed-3',
          title: '代码审查助手',
          content: '请审查以下代码，重点关注：可读性、性能、安全性、潜在 Bug，并给出改进建议：\n\n```{{语言}}\n{{代码}}\n```',
          category: '编程',
          tags: ['代码', '审查'],
          favorite: true,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        },
        {
          id: 'seed-4',
          title: '会议纪要整理',
          content: '请把下面的会议记录整理成结构化纪要，包含：议题、讨论要点、决议、待办事项与负责人：\n\n{{会议记录}}',
          category: '写作',
          tags: ['会议', '纪要'],
          favorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        },
        {
          id: 'seed-5',
          title: '一句话扩写',
          content: '请把下面的核心观点扩写为一段 150 字左右、逻辑通顺的段落：\n\n{{核心观点}}',
          category: '写作',
          tags: ['扩写', '润色'],
          favorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        },
        {
          id: 'seed-6',
          title: 'SQL 生成',
          content: '请根据需求用 {{数据库类型}} 编写 SQL：\n需求：{{需求描述}}\n表结构：{{表结构}}',
          category: '编程',
          tags: ['SQL', '数据库'],
          favorite: false,
          usageCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastUsedAt: null
        }
      ]
    };
    fs.writeFileSync(p, JSON.stringify(seed, null, 2), 'utf-8');
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f5f5f7',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// IPC: 读取数据
ipcMain.handle('data:read', () => {
  try {
    const p = getDataPath();
    if (!fs.existsSync(p)) initDataFile();
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { prompts: [] };
  }
});

// IPC: 写入数据
ipcMain.handle('data:write', (event, data) => {
  try {
    fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: 导出文件
ipcMain.handle('data:export', async (event, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '导出提示词库',
    defaultPath: `prompts-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// IPC: 导入文件
ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '导入提示词库',
    filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.prompts)) {
      return { ok: false, error: '文件格式不正确，缺少 prompts 数组' };
    }
    return { ok: true, data: obj };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

app.whenReady().then(() => {
  initDataFile();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
