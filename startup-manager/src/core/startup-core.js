'use strict';
// 启动项管家 - 核心逻辑模块
// 全部为纯函数，可脱离 Electron 单独测试

// 注册表根键映射：把 reg.exe 输出的根键名映射为内部 hive 标识
const HIVE_MAP = {
  'HKEY_LOCAL_MACHINE': 'HKLM',
  'HKEY_CURRENT_USER': 'HKCU',
  'HKEY_USERS': 'HKU'
};

// 需要扫描的启动项注册表位置（相对路径）
const REG_RUN_KEYS = [
  { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run', label: '注册表·当前用户' },
  { hive: 'HKLM', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Run', label: '注册表·所有用户' },
  { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce', label: '注册表·运行一次(当前)' },
  { hive: 'HKLM', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce', label: '注册表·运行一次(所有)' }
];

// StartupApproved 路径（任务管理器禁用启动项时写入这里）
// HKCU 和 HKLM 各一份
const STARTUP_APPROVED_PATHS = [
  { hive: 'HKCU', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run' },
  { hive: 'HKLM', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run' }
];

/**
 * 解析 reg query 命令的标准输出，提取键值对
 * 输入示例：
 *   HKEY_CURRENT_USER\Software\...\Run
 *       SecurityHealth    REG_SZ    %windir%\system32\SecurityHealthSystray.exe
 *       OneDrive    REG_SZ    "C:\Users\x\AppData\Local\...\OneDrive.exe"
 * 返回：[{ name, type, value }]
 */
function parseRegQueryOutput(output) {
  const entries = [];
  if (!output) return entries;
  // 按 4 个空格或制表符分隔字段；reg.exe 输出形如：    Name    REG_SZ    Value
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    // 跳过空行和键头行（以 HKEY 开头）
    if (!line.trim()) continue;
    if (/^\s*HKEY_/i.test(line)) continue;
    if (/^\s*$/ .test(line)) continue;
    // 匹配：缩进 + 名称 + REG_类型 + 值
    const m = line.match(/^\s+(.+?)\s{2,}REG_(\w+)\s+(.*)$/);
    if (!m) continue;
    entries.push({
      name: m[1].trim(),
      type: 'REG_' + m[2].trim(),
      value: m[3].trim()
    });
  }
  return entries;
}

/**
 * 把 reg query 输出最上方的 HKEY 行解析出 hive 与完整路径
 * 输入：'HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run'
 * 返回：{ hive: 'HKCU', fullPath: '...' }
 */
function parseRegKeyHeader(headerLine) {
  if (!headerLine) return null;
  const trimmed = headerLine.trim();
  const parts = trimmed.split('\\');
  const root = parts[0].toUpperCase();
  const hive = HIVE_MAP[root];
  if (!hive) return null;
  return { hive, fullPath: trimmed };
}

/**
 * 从启动命令字符串中提取可执行文件路径
 * 处理：
 *   "C:\Program Files\App\app.exe" /arg  -> C:\Program Files\App\app.exe
 *   C:\Windows\app.exe /arg              -> C:\Windows\app.exe
 *   rundll32.exe dllname,func            -> rundll32.exe
 *   %windir%\system32\app.exe            -> %windir%\system32\app.exe
 */
function extractExePath(command) {
  if (!command) return '';
  const s = command.trim();
  // 带引号的情况
  const quoted = s.match(/^"([^"]+\.exe)"/i);
  if (quoted) return quoted[1];
  // rundll32 / regsvr32 等：取第一个 token
  const dllLike = s.match(/^(\S+\.exe)/i);
  if (dllLike) return dllLike[1];
  // 兜底：第一个空格前
  const sp = s.indexOf(' ');
  return sp === -1 ? s : s.slice(0, sp);
}

/**
 * 从可执行路径提取显示用的文件名（去 .exe 后缀，作为标题）
 */
function exeBaseName(exePath) {
  if (!exePath) return '';
  // 兼容环境变量与反斜杠
  const cleaned = exePath.replace(/\\\\/g, '\\');
  const parts = cleaned.split(/[\\/]/);
  let last = parts[parts.length - 1] || '';
  last = last.replace(/\.exe$/i, '');
  return last;
}

/**
 * 解析 StartupApproved 的二进制值，判断启动项启用/禁用状态
 * Windows 任务管理器禁用启动项时写入 12 字节二进制：
 *   第一字节 0x02 = 启用；0x03 = 禁用
 * 其余 11 字节为时间戳/标志
 * 输入可以是：
 *   - Buffer / Uint8Array
 *   - hex 字符串（如 '03000000000000000000000000000000'）
 *   - 逗号分隔的字节串（reg query 输出）
 */
function parseStartupApprovedHex(value) {
  if (!value) return 'unknown';
  let bytes;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    bytes = Buffer.from(value);
  } else if (typeof value === 'string') {
    let hex = value.replace(/[\s,]/g, '');
    // reg query 输出形如 0x03,0x00,... 直接拼接的 hex
    if (/^0x/i.test(hex)) hex = hex.replace(/0x/gi, '');
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 2) return 'unknown';
    bytes = Buffer.from(hex, 'hex');
  } else {
    return 'unknown';
  }
  if (bytes.length < 1) return 'unknown';
  const flag = bytes[0];
  if (flag === 0x02) return 'enabled';
  if (flag === 0x03) return 'disabled';
  return 'unknown';
}

/**
 * 为单个启动项条目补充来源分类与可读信息
 */
function decorateEntry(entry) {
  const cmd = entry.value || '';
  const exe = extractExePath(cmd);
  const baseName = exeBaseName(exe);
  return Object.assign({}, entry, {
    exe,
    baseName: baseName || entry.name,
    source: entry.source || entry.label || '未知'
  });
}

/**
 * 合并启动项与 StartupApproved 状态
 * entries: 启动项列表（已 decorate）
 * approved: [{ hive, name, status }] 来自 StartupApproved
 * 同名 + 同 hive 优先匹配；若仅同名也匹配
 */
function mergeStatus(entries, approvedList) {
  if (!Array.isArray(entries)) return [];
  if (!Array.isArray(approvedList) || approvedList.length === 0) {
    return entries.map(e => Object.assign({}, e, { status: 'enabled' }));
  }
  // 构建 (hive,name) -> status 映射
  const byHiveName = new Map();
  const byName = new Map();
  for (const a of approvedList) {
    byHiveName.set(a.hive + '::' + (a.name || '').toLowerCase(), a.status);
    byName.set((a.name || '').toLowerCase(), a.status);
  }
  return entries.map(e => {
    const key = (e.hive || '') + '::' + (e.name || '').toLowerCase();
    let status = byHiveName.get(key);
    if (!status) status = byName.get((e.name || '').toLowerCase());
    if (!status) status = 'enabled'; // 没有 approved 记录默认启用
    return Object.assign({}, e, { status });
  });
}

/**
 * 统计：总数 / 启用 / 禁用 / 各来源分布
 */
function computeStats(entries) {
  const stats = {
    total: entries.length,
    enabled: 0,
    disabled: 0,
    bySource: {}
  };
  for (const e of entries) {
    if (e.status === 'disabled') stats.disabled++;
    else stats.enabled++;
    const src = e.source || e.label || '未知';
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;
  }
  return stats;
}

/**
 * 按关键字过滤启动项（名称/命令/来源）
 */
function filterEntries(entries, keyword) {
  if (!keyword) return entries;
  const kw = keyword.toLowerCase();
  return entries.filter(e =>
    (e.name && e.name.toLowerCase().includes(kw)) ||
    (e.value && e.value.toLowerCase().includes(kw)) ||
    (e.source && e.source.toLowerCase().includes(kw))
  );
}

/**
 * 给启动文件夹项生成统一结构
 * path: 文件完整路径
 */
function makeFolderEntry(path, isCommon) {
  const baseName = exeBaseName(path);
  return {
    name: baseName,
    type: 'REG_SZ', // 仅占位
    value: path,
    exe: path,
    baseName,
    hive: isCommon ? 'HKLM' : 'HKCU',
    source: isCommon ? '启动文件夹·所有用户' : '启动文件夹·当前用户',
    status: 'enabled'
  };
}

/**
 * 校验新增启动项输入
 * 返回 { ok: boolean, error?: string }
 */
function validateNewEntry(input) {
  if (!input) return { ok: false, error: '输入为空' };
  if (!input.name || !input.name.trim()) return { ok: false, error: '名称不能为空' };
  if (!input.command || !input.command.trim()) return { ok: false, error: '命令不能为空' };
  if (input.name.length > 128) return { ok: false, error: '名称过长（>128 字符）' };
  // 名称不能包含非法字符（注册表值名限制较少，但仍禁止 \ 和反斜杠序列）
  if (/\\/.test(input.name)) return { ok: false, error: '名称不能包含反斜杠' };
  return { ok: true };
}

module.exports = {
  REG_RUN_KEYS,
  STARTUP_APPROVED_PATHS,
  HIVE_MAP,
  parseRegQueryOutput,
  parseRegKeyHeader,
  extractExePath,
  exeBaseName,
  parseStartupApprovedHex,
  decorateEntry,
  mergeStatus,
  computeStats,
  filterEntries,
  makeFolderEntry,
  validateNewEntry
};
