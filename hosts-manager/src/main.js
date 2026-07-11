'use strict';
// Hosts管家 - Electron 主进程
// 苹果白风格窗口 + hosts 文件读写 + 方案管理 IPC

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, execSync } = require('child_process');
const { parseHosts, serializeHosts, TEMPLATES } = require('./core/hosts-core');

// 捕获未处理异常，写入日志
process.on('uncaughtException', (err) => {
  try {
    const fs2 = require('fs');
    const os2 = require('os');
    fs2.appendFileSync(os2.tmpdir() + '\\hosts-manager-error.log',
      new Date().toISOString() + ' UNCAUGHT: ' + err.stack + '\n');
  } catch (_) {}
});

// ==================== 路径常量 ====================

// 系统 hosts 文件路径
const HOSTS_PATH = process.platform === 'win32'
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

// 用户数据目录（延迟获取，app ready 后才有值）
function getProfilesFile() {
  return path.join(app.getPath('userData'), 'profiles.json');
}
function getBackupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

// ==================== hosts 文件读写 ====================

/**
 * 读取系统 hosts 文件内容
 */
function readHostsFile() {
  try {
    return fs.readFileSync(HOSTS_PATH, 'utf8');
  } catch (err) {
    // 读取失败，返回默认内容
    return '# Hosts 文件读取失败，可能需要管理员权限\n127.0.0.1 localhost\n';
  }
}

/**
 * 检查是否有 hosts 文件写入权限
 */
function canWriteHosts() {
  try {
    fs.accessSync(HOSTS_PATH, fs.constants.W_OK);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 备份当前 hosts 文件
 */
function backupHosts() {
  try {
    if (!fs.existsSync(getBackupDir())) {
      fs.mkdirSync(getBackupDir(), { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupPath = path.join(getBackupDir(), 'hosts_' + stamp);
    const content = readHostsFile();
    fs.writeFileSync(backupPath, content, 'utf8');
    return backupPath;
  } catch (err) {
    return null;
  }
}

/**
 * 获取备份列表
 */
function listBackups() {
  try {
    if (!fs.existsSync(getBackupDir())) return [];
    const files = fs.readdirSync(getBackupDir())
      .filter(f => f.startsWith('hosts_'))
      .map(f => {
        const fullPath = path.join(getBackupDir(), f);
        const stat = fs.statSync(fullPath);
        return { name: f, path: fullPath, size: stat.size, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20);
    return files;
  } catch (_) {
    return [];
  }
}

/**
 * 读取备份内容
 */
function readBackup(name) {
  try {
    const fullPath = path.join(getBackupDir(), name);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (_) {
    return '';
  }
}

/**
 * 将内容写入 hosts 文件
 * 如果没有权限，尝试通过 UAC 提升权限（仅 Windows）
 */
function writeHostsFile(content) {
  // 先备份
  backupHosts();
  if (canWriteHosts()) {
    // 直接写入
    try {
      fs.writeFileSync(HOSTS_PATH, content, 'utf8');
      // 刷新 DNS 缓存（Windows）
      if (process.platform === 'win32') {
        exec('ipconfig /flushdns', () => {});
      }
      return { success: true, elevated: false };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  // Windows: 通过 UAC 提升权限写入
  if (process.platform === 'win32') {
    try {
      const result = writeHostsWithUAC(content);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: '无写入权限，请以管理员身份运行' };
}

/**
 * Windows 下通过 UAC 提升权限写入 hosts 文件
 */
function writeHostsWithUAC(content) {
  // 将内容写入临时文件
  const tempPath = path.join(os.tmpdir(), 'hosts_mgr_temp_' + Date.now() + '.txt');
  fs.writeFileSync(tempPath, content, 'utf8');

  // 构造 PowerShell 脚本（备份 + 复制 + 刷新 DNS）
  const tempEscaped = tempPath.replace(/\\/g, '\\\\');
  const hostsEscaped = HOSTS_PATH.replace(/\\/g, '\\\\');
  const psScript = `Copy-Item -LiteralPath '${tempPath}' -Destination '${HOSTS_PATH}' -Force; ipconfig /flushdns | Out-Null; Remove-Item -LiteralPath '${tempPath}' -Force`;

  // 使用 Start-Process -Verb RunAs 提升权限执行
  // -Wait 等待完成
  const cmd = `Start-Process -FilePath powershell -Verb RunAs -ArgumentList '-NoProfile','-Command','${psScript.replace(/'/g, "''")}' -Wait`;
  
  try {
    execSync(`powershell -NoProfile -Command "${cmd.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    return { success: true, elevated: true };
  } catch (err) {
    // 用户可能取消了 UAC 提示
    try { fs.unlinkSync(tempPath); } catch (_) {}
    return { success: false, error: '用户取消了权限提升或写入失败' };
  }
}

// ==================== 方案管理 ====================

function loadProfiles() {
  try {
    const raw = fs.readFileSync(getProfilesFile(), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.profiles) ? data.profiles : [];
  } catch (_) {
    return [];
  }
}

function saveProfiles(profiles) {
  try {
    fs.writeFileSync(getProfilesFile(), JSON.stringify({ profiles }, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
}

// ==================== 窗口创建 ====================

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    title: 'Hosts管家',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
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

// ==================== IPC 处理 ====================

// 读取系统 hosts 内容
ipcMain.handle('hosts:read', async () => {
  const content = readHostsFile();
  const items = parseHosts(content);
  return { content, items, canWrite: canWriteHosts() };
});

// 写入系统 hosts
ipcMain.handle('hosts:write', async (_e, content) => {
  const result = writeHostsFile(content);
  return result;
});

// 检查写入权限
ipcMain.handle('hosts:canWrite', async () => {
  return canWriteHosts();
});

// 获取模板列表
ipcMain.handle('templates:list', async () => {
  return TEMPLATES;
});

// 方案管理
ipcMain.handle('profiles:load', async () => {
  return loadProfiles();
});

ipcMain.handle('profiles:save', async (_e, profiles) => {
  return saveProfiles(profiles);
});

// 备份管理
ipcMain.handle('backup:list', async () => {
  return listBackups();
});

ipcMain.handle('backup:read', async (_e, name) => {
  return readBackup(name);
});

// 在文件管理器中打开备份目录
ipcMain.handle('backup:openDir', async () => {
  try {
    if (!fs.existsSync(getBackupDir())) {
      fs.mkdirSync(getBackupDir(), { recursive: true });
    }
    shell.openPath(getBackupDir());
    return true;
  } catch (_) {
    return false;
  }
});

// 打开 hosts 文件所在目录
ipcMain.handle('hosts:openLocation', async () => {
  try {
    shell.openPath(path.dirname(HOSTS_PATH));
    return true;
  } catch (_) {
    return false;
  }
});
