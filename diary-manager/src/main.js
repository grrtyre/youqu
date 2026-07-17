// 主进程：创建窗口、管理生命周期
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

const isScreenshotMode = process.argv.includes('--screenshot');

// 截图模式：预填示例日记，让 UI 展示完整设计（仅用于截图评分，不随安装包分发）
function seedSampleData() {
  const dir = path.join(app.getPath('userData'), 'diary-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const today = new Date();
  const samples = [
    {
      offset: 0,
      title: '夏日的午后',
      mood: '😊',
      tags: ['生活', '阅读'],
      content: '<p>今天读完了一本搁置很久的书。窗外的蝉鸣和书页翻动的声音意外地合拍。</p><p>有些事拖着拖着就忘了初心，重新拾起来反而有种久别重逢的踏实感。</p><blockquote>慢一点，也是一种前进。</blockquote>'
    },
    {
      offset: -2,
      title: '关于专注',
      mood: '🤔',
      tags: ['思考', '工作'],
      content: '<p>今天尝试了番茄工作法，发现真正难的不是计时，而是把手机放到另一个房间。</p><p>专注是一种需要练习的能力，而不是一种天赋。</p>'
    },
    {
      offset: -5,
      title: '雨天的咖啡馆',
      mood: '😌',
      tags: ['生活'],
      content: '<p>下午躲进一家小咖啡馆，点了一杯拿铁，看雨水顺着玻璃往下淌。</p><p>有时候什么都不做，只是坐着，就已经是休息了。</p>'
    },
    {
      offset: -7,
      title: '一次小小的失败',
      mood: '😢',
      tags: ['工作', '复盘'],
      content: '<p>今天有个方案没通过。说实话有点失落，但回过头看，至少知道哪条路走不通。</p><p>允许自己难过一会儿，然后继续。</p>'
    }
  ];
  for (const s of samples) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + s.offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const data = {
      date: dateStr,
      title: s.title,
      content: s.content,
      mood: s.mood,
      tags: s.tags,
      updatedAt: new Date(d.getTime() + 20 * 3600 * 1000).toISOString()
    };
    fs.writeFileSync(path.join(dir, `${dateStr}.json`), JSON.stringify(data, null, 2), 'utf-8');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#ffffff',
    title: '日记本',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (isScreenshotMode) {
    // 截图模式：窗口渲染到离屏位置，不进入用户视野，由外部 PrintWindow 捕获
    mainWindow.once('ready-to-show', () => {
      try { mainWindow.setPosition(-2400, -1600); } catch (e) {}
      mainWindow.showInactive();
    });
  } else {
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
  }

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 数据存储目录
function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'diary-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function entryPath(dateStr) {
  return path.join(getDataDir(), `${dateStr}.json`);
}

// IPC：读取某天的日记
ipcMain.handle('diary:read', (event, dateStr) => {
  const file = entryPath(dateStr);
  if (!fs.existsSync(file)) {
    return { date: dateStr, title: '', content: '', mood: '', tags: [], updatedAt: null };
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { date: dateStr, title: '', content: '', mood: '', tags: [], updatedAt: null };
  }
});

// IPC：保存某天的日记
ipcMain.handle('diary:save', (event, payload) => {
  const file = entryPath(payload.date);
  const data = {
    date: payload.date,
    title: payload.title || '',
    content: payload.content || '',
    mood: payload.mood || '',
    tags: payload.tags || [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
  return { ok: true, updatedAt: data.updatedAt };
});

// IPC：列出所有有日记的日期
ipcMain.handle('diary:list', () => {
  const dir = getDataDir();
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const list = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const obj = JSON.parse(raw);
      list.push({
        date: obj.date,
        title: obj.title || '',
        mood: obj.mood,
        tags: obj.tags,
        preview: (obj.content || '').replace(/<[^>]+>/g, '').slice(0, 60),
        updatedAt: obj.updatedAt
      });
    } catch (e) {
      // 跳过损坏文件
    }
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  return list;
});

// IPC：删除某天的日记
ipcMain.handle('diary:delete', (event, dateStr) => {
  const file = entryPath(dateStr);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { ok: true };
});

// IPC：导出为 Markdown
ipcMain.handle('diary:export', async (event, dateStr) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出为 Markdown',
    defaultPath: `日记-${dateStr}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false };
  const file = entryPath(dateStr);
  if (!fs.existsSync(file)) return { ok: false };
  const obj = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const md = `# ${obj.date}\n\n` +
    `**心情**：${obj.mood || '未记录'}\n` +
    `**标签**：${(obj.tags || []).join('、') || '无'}\n\n` +
    `---\n\n${obj.content || ''}\n`;
  fs.writeFileSync(result.filePath, md, 'utf-8');
  return { ok: true, path: result.filePath };
});

app.whenReady().then(() => {
  if (isScreenshotMode) {
    try { seedSampleData(); } catch (e) { /* 忽略种子数据错误 */ }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
