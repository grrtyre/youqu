// 应用索引器 - 扫描 Windows 开始菜单和桌面快捷方式
const fs = require('fs');
const path = require('path');
const os = require('os');

class AppIndexer {
  constructor() {
    this.apps = [];
    this.scannedDirs = new Set();
  }

  getApps() {
    return this.apps;
  }

  async scan() {
    const dirs = this.getScanDirs();
    const found = [];
    const seen = new Set();

    for (const dir of dirs) {
      try {
        this.scanDir(dir, found, seen);
      } catch (e) {
        // 目录不存在或无权限，跳过
      }
    }

    found.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    this.apps = found;
    return found;
  }

  getScanDirs() {
    const user = os.homedir();
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    const dirs = [
      path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(user, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(user, 'Desktop'),
      path.join('C:', 'Users', 'Public', 'Desktop')
    ];
    return dirs;
  }

  scanDir(dir, found, seen, depth = 0) {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.scanDir(full, found, seen, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.lnk' || ext === '.url' || ext === '.exe') {
          const name = path.basename(entry.name, ext);
          if (seen.has(full)) continue;
          seen.add(full);
          if (this.isUnwanted(name)) continue;
          found.push({
            name: name.trim(),
            path: full,
            icon: null,
            ext: ext
          });
        }
      }
    }
  }

  isUnwanted(name) {
    const n = name.toLowerCase();
    const keywords = ['uninstall', '卸载', 'help', 'readme', 'license', '访问网站', 'website'];
    return keywords.some(k => n.includes(k));
  }
}

module.exports = { AppIndexer };
