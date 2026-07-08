// 磁盘扫描器：递归遍历目录，统计大小，构建树
'use strict';

const fs = require('fs');
const path = require('path');
const { getExt, classifyExt } = require('./format-utils');

// 扫描配置
const DEFAULT_OPTIONS = {
  // 跳过的目录名（大小写不敏感）—— 系统/虚拟目录，扫了无意义且可能极慢或报错
  skipDirs: new Set([
    '$recycle.bin', 'system volume information', '$windows.~bt', '$windows.~ws',
    'windowsapps', 'packages',
  ]),
  // 是否跟随符号链接（默认不跟随，避免环路）
  followSymlinks: false,
  // 单次扫描最多文件数（防止极端情况 OOM）
  maxFiles: 5_000_000,
};

// 创建一个空目录节点
function makeDirNode(name, fullPath) {
  return {
    type: 'dir',
    name: name,
    path: fullPath,
    size: 0,
    children: [],
    fileCount: 0,
    dirCount: 0,
    mtime: 0,
    errors: 0,
  };
}

// 创建一个空文件节点
function makeFileNode(name, fullPath, stat) {
  return {
    type: 'file',
    name: name,
    path: fullPath,
    size: stat.size || 0,
    mtime: stat.mtimeMs || 0,
    ext: getExt(name),
    category: classifyExt(getExt(name)),
  };
}

// 扫描单个目录（递归）
// root: 目录节点
// onProgress: 可选，回调 ({files, dirs, bytes})
// shouldStop: 可选，返回 true 则停止
// 返回：该目录节点（已填充 size/children）
async function scanDir(root, onProgress, shouldStop, options, depth) {
  options = Object.assign({}, DEFAULT_OPTIONS, options || {});
  depth = depth || 0;
  let totalFiles = 0;
  let totalDirs = 0;
  let totalBytes = 0;
  let stopped = false;

  let entries;
  try {
    entries = await fs.promises.readdir(root.path, { withFileTypes: true });
  } catch (e) {
    root.errors++;
    return { files: 0, dirs: 0, bytes: 0, stopped: false };
  }

  // 为了让大目录优先展示（treemap 更好看），先收集再排序
  const childPromises = [];
  // 但是递归需要顺序执行以控制并发与进度频率，这里采用顺序 await
  for (let i = 0; i < entries.length; i++) {
    if (shouldStop && shouldStop()) { stopped = true; break; }
    const entry = entries[i];
    const full = path.join(root.path, entry.name);

    // 符号链接处理
    if (entry.isSymbolicLink() && !options.followSymlinks) continue;

    let stat;
    try {
      // withFileTypes 已有类型，但取 size 仍需 stat
      stat = await fs.promises.stat(full);
    } catch (e) {
      root.errors++;
      continue;
    }

    if (stat.isDirectory()) {
      // 跳过系统目录
      const lower = entry.name.toLowerCase();
      if (options.skipDirs.has(lower)) continue;
      const child = makeDirNode(entry.name, full);
      child.mtime = stat.mtimeMs || 0;
      root.children.push(child);
      root.dirCount++;
      totalDirs++;
      const sub = await scanDir(child, onProgress, shouldStop, options, depth + 1);
      child.size = sub.bytes;
      root.size += sub.bytes;
      totalFiles += sub.files;
      totalDirs += sub.dirs;
      totalBytes += sub.bytes;
      if (sub.stopped) { stopped = true; break; }
    } else if (stat.isFile()) {
      const file = makeFileNode(entry.name, full, stat);
      root.children.push(file);
      root.size += file.size;
      root.fileCount++;
      totalFiles++;
      totalBytes += file.size;
      if (onProgress && (totalFiles & 0x3FF) === 0) {
        onProgress({ files: totalFiles, dirs: totalDirs, bytes: totalBytes });
      }
      if (totalFiles > options.maxFiles) { stopped = true; break; }
    }
    // 其他类型（设备、管道等）忽略
  }

  // 排序：目录在前，按 size 降序
  root.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return b.size - a.size;
  });

  if (onProgress) onProgress({ files: totalFiles, dirs: totalDirs, bytes: totalBytes });
  return { files: totalFiles, dirs: totalDirs, bytes: totalBytes, stopped };
}

// 从扫描结果中收集 Top N 大文件
function collectTopFiles(root, n) {
  n = n || 100;
  const result = [];
  function walk(node) {
    if (result.length >= n * 4) return; // 收集足够多再排序截断
    if (node.type === 'file') {
      result.push(node);
      return;
    }
    for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
  }
  walk(root);
  result.sort((a, b) => b.size - a.size);
  return result.slice(0, n);
}

// 按扩展名/大类聚合统计
function collectStats(root) {
  const byExt = new Map(); // ext -> { count, size }
  const byCategory = new Map(); // cat -> { count, size }
  function walk(node) {
    if (node.type === 'file') {
      const e = node.ext || '(无扩展名)';
      if (!byExt.has(e)) byExt.set(e, { count: 0, size: 0 });
      const ex = byExt.get(e);
      ex.count++; ex.size += node.size;
      const c = node.category || 'other';
      if (!byCategory.has(c)) byCategory.set(c, { count: 0, size: 0 });
      const cat = byCategory.get(c);
      cat.count++; cat.size += node.size;
      return;
    }
    for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
  }
  walk(root);
  const extArr = Array.from(byExt.entries()).map(([k, v]) => ({ ext: k, count: v.count, size: v.size }));
  extArr.sort((a, b) => b.size - a.size);
  const catArr = Array.from(byCategory.entries()).map(([k, v]) => ({ category: k, count: v.count, size: v.size }));
  catArr.sort((a, b) => b.size - a.size);
  return { byExt: extArr, byCategory: catArr };
}

// 扁平化：把树压成一维数组（用于 treemap，只取目录或文件，可选最小大小阈值）
function flatten(node, minSize) {
  minSize = minSize || 0;
  const out = [];
  function walk(n) {
    if (n.size < minSize) return;
    out.push(n);
    if (n.type === 'dir') {
      for (let i = 0; i < n.children.length; i++) walk(n.children[i]);
    }
  }
  walk(node);
  return out;
}

module.exports = {
  scanDir,
  collectTopFiles,
  collectStats,
  flatten,
  makeDirNode,
  makeFileNode,
  DEFAULT_OPTIONS,
};
