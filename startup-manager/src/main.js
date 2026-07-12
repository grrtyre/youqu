'use strict';
// 启动项管家 - Electron 主进程
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, exec } = require('child_process');
const core = require('./core/startup-core');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 880,
    minHeight: 640,
    title: '启动项管家',
    backgroundColor: '#f5f5f7',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    // 显示但不激活到前台，避免抢用户焦点
    try { win.showInactive(); } catch (_) { win.show(); }
  });
  win.setMenuBarVisibility(false);
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

// ---- 系统交互工具 ----

// 运行 PowerShell 脚本（用 -EncodedCommand 避免 -Command 的引号/转义/编码问题）
function runPowerShell(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { maxBuffer: 32 * 1024 * 1024, windowsHide: true, encoding: 'utf8' },
      (err, stdout) => resolve({ err, stdout: stdout || '' })
    );
  });
}

// 用 PowerShell 读取注册表 Run/RunOnce + StartupApproved，返回 UTF-8 JSON
// 一次性读取，避免 reg.exe 的 GBK 中文乱码问题
function readRegistryViaPowerShell() {
  const script =
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;" +
    "$ErrorActionPreference='SilentlyContinue';" +
    "$keys=@(" +
    "@{h='HKCU';p='Software\\Microsoft\\Windows\\CurrentVersion\\Run';a='Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'}," +
    "@{h='HKLM';p='Software\\Microsoft\\Windows\\CurrentVersion\\Run';a='Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'}," +
    "@{h='HKCU';p='Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce';a=$null}," +
    "@{h='HKLM';p='Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce';a=$null}" +
    ");" +
    "$out=@();" +
    "foreach($k in $keys){" +
      "$regPath='Registry::'+$k.h+'\\'+$k.p;" +
      "$props=Get-ItemProperty -Path $regPath;" +
      "if($props){" +
        "foreach($pn in $props.PSObject.Properties.Name){" +
          "if($pn -eq 'PSPath' -or $pn -eq 'PSParentPath' -or $pn -eq 'PSChildName' -or $pn -eq 'PSDrive' -or $pn -eq 'PSProvider'){continue;}" +
          "$val=$props.$pn;" +
          "$hex=$null;" +
          "if($val -is [byte[]]){$hex=([System.BitConverter]::ToString($val)).Replace('-','');}" +
          "$out+=@{hive=$k.h;key=$k.p;name=$pn;value=([string]$val);binaryHex=$hex};" +
        "}" +
      "}" +
      "if($k.a){" +
        "$aPath='Registry::'+$k.h+'\\'+$k.a;" +
        "$aprops=Get-ItemProperty -Path $aPath;" +
        "if($aprops){" +
          "foreach($pn in $aprops.PSObject.Properties.Name){" +
            "if($pn -eq 'PSPath' -or $pn -eq 'PSParentPath' -or $pn -eq 'PSChildName' -or $pn -eq 'PSDrive' -or $pn -eq 'PSProvider'){continue;}" +
            "$val=$aprops.$pn;" +
            "$hex=$null;" +
            "if($val -is [byte[]]){$hex=([System.BitConverter]::ToString($val)).Replace('-','');}" +
            "$out+=@{hive=$k.h;key=$k.a;name=$pn;value=$null;binaryHex=$hex};" +
          "}" +
        "}" +
      "}" +
    "}" +
    "$out | ConvertTo-Json -Compress -Depth 3";
  return new Promise((resolve) => {
    runPowerShell(script).then(({ stdout }) => {
      if (!stdout || !stdout.trim()) { resolve([]); return; }
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (_) { resolve([]); }
    });
  });
}

// 把 PowerShell 返回的扁平数组拆成 启动项 + 状态列表
function splitRegistryData(rows) {
  const runPaths = new Set(core.REG_RUN_KEYS.map(k => k.path));
  const approvedPaths = new Set(core.STARTUP_APPROVED_PATHS.map(k => k.path));
  const entries = [];
  const approved = [];
  for (const r of rows || []) {
    if (runPaths.has(r.key)) {
      const loc = core.REG_RUN_KEYS.find(k => k.path === r.key && k.hive === r.hive);
      const decorated = core.decorateEntry({
        name: r.name,
        value: r.value || '',
        type: 'REG_SZ',
        hive: r.hive,
        regPath: r.key,
        label: loc ? loc.label : r.key,
        source: loc ? loc.label : r.key
      });
      entries.push(decorated);
    } else if (approvedPaths.has(r.key) && r.binaryHex) {
      const status = core.parseStartupApprovedHex(r.binaryHex);
      approved.push({ hive: r.hive, name: r.name, status });
    }
  }
  return { entries, approved };
}

// 读取注册表启动项（Run/RunOnce）+ 状态
async function readRegistryEntries() {
  const rows = await readRegistryViaPowerShell();
  return splitRegistryData(rows);
}

// 读取启动文件夹（.lnk / .exe / .bat 等）
function readStartupFolders() {
  const entries = [];
  const appData = process.env.APPDATA;
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const userStartup = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const commonStartup = path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  for (const [folder, isCommon] of [[userStartup, false], [commonStartup, true]]) {
    if (!fs.existsSync(folder)) continue;
    let files = [];
    try { files = fs.readdirSync(folder); } catch (_) { /* 无权限 */ }
    for (const f of files) {
      const full = path.join(folder, f);
      try {
        const stat = fs.statSync(full);
        if (!stat.isFile()) continue;
      } catch (_) { continue; }
      const entry = core.makeFolderEntry(full, isCommon);
      entry.name = f.replace(/\.(lnk|exe|bat|cmd|ps1|vbs)$/i, '');
      entry.baseName = entry.name;
      entries.push(entry);
    }
  }
  return entries;
}

// ---- IPC 接口 ----

ipcMain.handle('startup:list', async () => {
  try {
    const { entries: regEntries, approved } = await readRegistryEntries();
    const folderEntries = readStartupFolders();
    const merged = core.mergeStatus(regEntries, approved);
    // 文件夹项默认启用
    const all = merged.concat(folderEntries);
    return { ok: true, data: all, stats: core.computeStats(all) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 启用/禁用：写入 StartupApproved\Run 的二进制值
// 禁用：0x03 开头；启用：删除该值（恢复默认启用）
ipcMain.handle('startup:toggle', async (_evt, entry, disable) => {
  try {
    if (!entry || !entry.name) return { ok: false, error: '缺少启动项名称' };
    // 仅注册表项可被任务管理器式禁用；文件夹项需删除文件
    if (!entry.regPath) {
      return { ok: false, error: '该类型暂不支持在此切换，请到启动文件夹手动管理' };
    }
    const hive = entry.hive;
    // StartupApproved 路径与 Run 对应
    const approvedPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
    const full = `${hive}\\${approvedPath}`;
    if (disable) {
      // 写入 12 字节，首字节 0x03
      const hex = '03000000000000000000000000000000';
      await new Promise((resolve, reject) => {
        execFile('reg.exe', ['add', full, '/v', entry.name, '/t', 'REG_BINARY', '/d', hex, '/f'],
          { windowsHide: true }, (err) => err ? reject(err) : resolve());
      });
    } else {
      // 删除该值（恢复启用）
      await new Promise((resolve) => {
        execFile('reg.exe', ['delete', full, '/v', entry.name, '/f'],
          { windowsHide: true }, () => resolve());
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '操作失败：' + e.message + '（HKLM 需要管理员权限）' };
  }
});

// 删除启动项
ipcMain.handle('startup:delete', async (_evt, entry) => {
  try {
    if (!entry) return { ok: false, error: '缺少启动项' };
    if (entry.regPath && entry.hive) {
      const full = `${entry.hive}\\${entry.regPath}`;
      await new Promise((resolve, reject) => {
        execFile('reg.exe', ['delete', full, '/v', entry.name, '/f'],
          { windowsHide: true }, (err) => err ? reject(err) : resolve());
      });
      // 同时清理 StartupApproved
      const approvedPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
      execFile('reg.exe', ['delete', `${entry.hive}\\${approvedPath}`, '/v', entry.name, '/f'],
        { windowsHide: true }, () => {});
      return { ok: true };
    }
    if (entry.value && fs.existsSync(entry.value)) {
      // 启动文件夹项：移到回收站不可直接做，这里删除文件（带确认由前端处理）
      fs.unlinkSync(entry.value);
      return { ok: true };
    }
    return { ok: false, error: '无法识别的启动项类型' };
  } catch (e) {
    return { ok: false, error: '删除失败：' + e.message };
  }
});

// 新增启动项（写入 HKCU Run）
ipcMain.handle('startup:add', async (_evt, input) => {
  try {
    const v = core.validateNewEntry(input);
    if (!v.ok) return { ok: false, error: v.error };
    const full = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    await new Promise((resolve, reject) => {
      execFile('reg.exe', ['add', full, '/v', input.name, '/t', 'REG_SZ', '/d', input.command, '/f'],
        { windowsHide: true }, (err) => err ? reject(err) : resolve());
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '新增失败：' + e.message };
  }
});

// 打开文件所在位置
ipcMain.handle('startup:openLocation', async (_evt, entry) => {
  try {
    const exe = entry && entry.exe;
    if (!exe) return { ok: false, error: '未找到可执行文件路径' };
    // explorer /select,"path"
    exec(`explorer.exe /select,${JSON.stringify(exe)}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 打开外部链接（爱发电）
ipcMain.handle('shell:openExternal', async (_evt, url) => {
  try {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false, error: '非法链接' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
