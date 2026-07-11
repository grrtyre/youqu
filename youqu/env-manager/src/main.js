// src/main.js - 环境变量管家 · Electron 主进程
// 负责：窗口创建、IPC（读/写/删环境变量、备份恢复、管理员检测与重启）

'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const utils = require('./core/env-utils.js');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: '环境变量管家',
    backgroundColor: '#f5f5f7',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

// ---------- 工具：执行命令 ----------
function runCmd(command, options) {
  return new Promise((resolve, reject) => {
    exec(command, Object.assign({ maxBuffer: 10 * 1024 * 1024, windowsHide: true }, options), (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || err.message).toString().trim() || err.message));
      } else {
        resolve(stdout.toString());
      }
    });
  });
}

// 注册表路径
const REG_USER = 'HKCU\\Environment';
const REG_SYSTEM = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';

// ---------- 读取环境变量 ----------
async function readEnv(scope) {
  const key = scope === 'system' ? REG_SYSTEM : REG_USER;
  let out;
  try {
    out = await runCmd(`reg query "${key}"`);
  } catch (e) {
    // 系统变量读取失败通常是权限问题
    throw new Error('读取' + (scope === 'system' ? '系统' : '用户') + '变量失败：' + e.message);
  }
  const vars = utils.parseRegOutput(out);
  return utils.sortEnvVars(vars);
}

// ---------- 写入环境变量（用 PowerShell Set-ItemProperty + 广播 WM_SETTINGCHANGE）----------
async function setEnvVar(scope, name, value, type) {
  const valid = utils.validateVarName(name);
  if (!valid.valid) throw new Error('变量名不合法：' + valid.reason);

  const regPath = scope === 'system' ? 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment' : 'HKCU:\\Environment';
  const psType = type === 'REG_EXPAND_SZ' ? 'ExpandString' : 'String';

  // 名称和值用 base64 传递，彻底规避 PowerShell 转义问题
  const b64Name = Buffer.from(name, 'utf8').toString('base64');
  const b64Value = Buffer.from(value, 'utf8').toString('base64');

  const ps = [
    '$ErrorActionPreference = "Stop"',
    `$n = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Name}"))`,
    `$v = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Value}"))`,
    `Set-ItemProperty -Path "${regPath}" -Name $n -Value $v -Type ${psType}`,
    // 广播 WM_SETTINGCHANGE，让其他应用感知变化
    'Add-Type -Namespace Win32 -Name NM -MemberDefinition \'[DllImport("user32.dll", CharSet=System.Runtime.InteropServices.CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);\'',
    '$r = [IntPtr]::Zero',
    '[Win32.NM]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [IntPtr]::Zero, "Environment", 2, 5000, [ref]$r) | Out-Null',
    'Write-Output "OK"'
  ].join('; ');

  try {
    await runCmd(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`);
  } catch (e) {
    throw new Error('写入失败：' + e.message);
  }
}

// ---------- 删除环境变量 ----------
async function deleteEnvVar(scope, name) {
  const valid = utils.validateVarName(name);
  if (!valid.valid) throw new Error('变量名不合法：' + valid.reason);

  const regPath = scope === 'system' ? 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment' : 'HKCU:\\Environment';
  const b64Name = Buffer.from(name, 'utf8').toString('base64');

  const ps = [
    '$ErrorActionPreference = "Stop"',
    `$n = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Name}"))`,
    `Remove-ItemProperty -Path "${regPath}" -Name $n -ErrorAction SilentlyContinue`,
    'Add-Type -Namespace Win32 -Name NM -MemberDefinition \'[DllImport("user32.dll", CharSet=System.Runtime.InteropServices.CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out IntPtr lpdwResult);\'',
    '$r = [IntPtr]::Zero',
    '[Win32.NM]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [IntPtr]::Zero, "Environment", 2, 5000, [ref]$r) | Out-Null',
    'Write-Output "OK"'
  ].join('; ');

  try {
    await runCmd(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`);
  } catch (e) {
    throw new Error('删除失败：' + e.message);
  }
}

// ---------- 检测是否管理员 ----------
async function isAdmin() {
  try {
    const out = await runCmd('powershell -NoProfile -Command "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"');
    return out.trim().toLowerCase() === 'true';
  } catch (e) {
    return false;
  }
}

// ---------- IPC ----------
ipcMain.handle('env:read', async (evt, scope) => {
  try {
    return { ok: true, data: await readEnv(scope) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('env:set', async (evt, args) => {
  try {
    await setEnvVar(args.scope, args.name, args.value, args.type);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('env:delete', async (evt, args) => {
  try {
    await deleteEnvVar(args.scope, args.name);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('env:isAdmin', async () => {
  return { ok: true, data: await isAdmin() };
});

ipcMain.handle('env:relaunchAsAdmin', async () => {
  // 以管理员身份重启自身
  try {
    const { exec } = require('child_process');
    const exe = process.execPath;
    // 通过 PowerShell Start-Process -Verb RunAs 触发 UAC
    exec(`powershell -NoProfile -Command "Start-Process -FilePath '${exe}' -ArgumentList '.' -Verb RunAs"`, () => {});
    // 给 UAC 一点时间，然后退出当前实例
    setTimeout(() => {
      app.exit(0);
    }, 800);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- 备份导出 ----------
ipcMain.handle('env:exportBackup', async (evt, args) => {
  try {
    const data = { user: args.user || [], system: args.system || [] };
    const json = utils.buildBackupJson(data);
    const res = await dialog.showSaveDialog(mainWindow, {
      title: '导出环境变量备份',
      defaultPath: `env-backup-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, json, 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- 备份导入（仅读取文件并返回内容，实际恢复由前端逐步确认）----------
ipcMain.handle('env:importBackup', async () => {
  try {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '导入环境变量备份',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true };
    const text = fs.readFileSync(res.filePaths[0], 'utf8');
    const data = utils.parseBackupJson(text);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- 复制到剪贴板（前端可 navigator.clipboard，但保留主进程兜底）----------
ipcMain.handle('env:copy', async (evt, text) => {
  try {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------- 打开外部链接 ----------
ipcMain.handle('env:openExternal', async (evt, url) => {
  try {
    await shell.openExternal(url);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
