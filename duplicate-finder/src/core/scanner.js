// scanner.js — 重复文件扫描引擎
// 三阶段算法：
//   阶段1 sizeKey  ：按文件大小分组（零内容读，最快）
//   阶段2 partial  ：对大小相同的文件计算部分哈希，过滤掉绝大部分
//   阶段3 full     ：对部分哈希仍相同的文件计算完整 SHA-256，定论
// 通过事件回调向 UI 推送进度，避免 UI 卡死。
const fs = require('fs');
const path = require('path');
const { partialHash, fullHash } = require('./hash-utils');

// 默认忽略的目录名（系统/版本控制/缓存，扫描无意义且耗时）
const DEFAULT_IGNORED_DIRS = new Set([
  '$RECYCLE.BIN', 'System Volume Information', 'Windows', '$WinREAgent',
  'node_modules', '.git', '.svn', '__pycache__', '.cache', 'AppData',
  'ProgramData', '.Trash-1000'
]);

// 默认忽略的扩展名（伪文件、符号链接占位等）
const DEFAULT_IGNORED_EXTS = new Set(['.tmp', '.temp', '.log', '.bak', '.lnk']);

// 拓展名分类（用于前端图标/预览选择）
function classifyExt(ext) {
  const e = ext.toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.ico', '.svg'].includes(e)) return 'image';
  if (['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'].includes(e)) return 'video';
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma'].includes(e)) return 'audio';
  if (['.pdf'].includes(e)) return 'pdf';
  if (['.doc', '.docx', '.rtf', '.odt'].includes(e)) return 'doc';
  if (['.xls', '.xlsx', '.csv'].includes(e)) return 'sheet';
  if (['.ppt', '.pptx'].includes(e)) return 'slide';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(e)) return 'archive';
  if (['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.sh', '.json', '.xml', '.html', '.css', '.md', '.yml', '.yaml'].includes(e)) return 'code';
  if (['.txt', '.log'].includes(e)) return 'text';
  return 'other';
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// 阶段1：递归遍历目录，按文件大小分组
function collectBySize(rootDir, opts, onProgress) {
  const sizeMap = new Map(); // size -> [{path, size, ext, name}]
  let scanned = 0;
  let ignored = 0;
  const minSize = opts.minSize || 0;
  const maxSize = opts.maxSize || Infinity;
  const ignoredDirs = opts.ignoredDirs || DEFAULT_IGNORED_DIRS;
  const ignoredExts = opts.ignoredExts || DEFAULT_IGNORED_EXTS;
  const followSymlinks = !!opts.followSymlinks;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return; // 无权限或目录不存在
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          if (ignoredDirs.has(entry.name)) { ignored++; continue; }
          walk(full);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ignoredExts.has(ext)) { ignored++; continue; }
          const stat = fs.statSync(full);
          if (stat.isSymbolicLink() && !followSymlinks) { ignored++; continue; }
          const size = stat.size;
          if (size < minSize || size > maxSize) { ignored++; continue; }
          scanned++;
          if (scanned % 200 === 0 && typeof onProgress === 'function') {
            onProgress({ phase: 'scan', scanned, ignored });
          }
          const list = sizeMap.get(size);
          const item = { path: full, name: entry.name, size, ext, dir, mtime: stat.mtimeMs };
          if (list) list.push(item); else sizeMap.set(size, [item]);
        }
      } catch (_) { /* ignore single file errors */ }
    }
  }

  walk(rootDir);
  // 仅保留 >=2 个同大小的桶
  const candidates = [];
  for (const [size, list] of sizeMap) {
    if (list.length >= 2) candidates.push(...list);
  }
  return { candidates, scanned, ignored };
}

// 阶段2：对候选按部分哈希分组
function groupByPartial(candidates, onProgress) {
  const map = new Map(); // partialHash -> items
  let processed = 0;
  for (const item of candidates) {
    try {
      const ph = partialHash(item.path, item.size);
      const key = `${item.size}:${ph}`;
      const list = map.get(key);
      if (list) list.push(item); else map.set(key, [item]);
    } catch (_) { /* ignore unreadable */ }
    processed++;
    if (processed % 50 === 0 && typeof onProgress === 'function') {
      onProgress({ phase: 'partial', processed, total: candidates.length });
    }
  }
  const out = [];
  for (const list of map.values()) {
    if (list.length >= 2) out.push(list);
  }
  return out;
}

// 阶段3：对部分哈希相同的组，再做完整 SHA-256，最终定论
async function confirmByFull(groups, onProgress) {
  const final = [];
  let total = groups.reduce((s, g) => s + g.length, 0);
  let done = 0;
  for (const group of groups) {
    const byFull = new Map(); // fullHash -> items
    for (const item of group) {
      try {
        const fh = await fullHash(item.path, item.size);
        const list = byFull.get(fh);
        if (list) list.push(item); else byFull.set(fh, [item]);
      } catch (_) { /* ignore */ }
      done++;
      if (done % 20 === 0 && typeof onProgress === 'function') {
        onProgress({ phase: 'full', done, total });
      }
    }
    for (const list of byFull.values()) {
      if (list.length >= 2) {
        // 标记类型 + 计算每组浪费空间
        const sample = list[0];
        const waste = sample.size * (list.length - 1);
        final.push({
          hash: list[0].path, // 占位，前端按内容生成 key
          files: list.map(f => ({
            path: f.path,
            name: f.name,
            size: f.size,
            ext: f.ext,
            type: classifyExt(f.ext),
            mtime: f.mtime,
            dir: f.dir
          })),
          size: sample.size,
          type: sample.ext,
          waste
        });
      }
    }
  }
  // 按浪费空间降序
  final.sort((a, b) => b.waste - a.waste);
  return final;
}

// 主入口：扫描指定目录
async function scanDirectory(rootDir, opts, onProgress) {
  opts = opts || {};
  const { candidates, scanned, ignored } = collectBySize(rootDir, opts, onProgress);
  if (typeof onProgress === 'function') onProgress({ phase: 'size-done', scanned, ignored, candidates: candidates.length });
  const groups = groupByPartial(candidates, onProgress);
  if (typeof onProgress === 'function') onProgress({ phase: 'partial-done', groups: groups.length });
  const final = await confirmByFull(groups, onProgress);
  if (typeof onProgress === 'function') onProgress({ phase: 'done' });
  // 汇总
  const totalWaste = final.reduce((s, g) => s + g.waste, 0);
  const totalFiles = final.reduce((s, g) => s + g.files.length, 0);
  return {
    groups: final,
    stats: {
      scanned,
      ignored,
      candidates: candidates.length,
      duplicateGroups: final.length,
      duplicateFiles: totalFiles,
      wasteBytes: totalWaste,
      wasteText: formatBytes(totalWaste)
    }
  };
}

module.exports = { scanDirectory, classifyExt, formatBytes, DEFAULT_IGNORED_DIRS };
