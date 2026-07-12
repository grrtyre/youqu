// 启动 Electron 截图模式，捕获 stdout/stderr 用于调试
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = 'D:\\Ai\\mimo\\youqu\\json-manager';
const electronExe = path.join(projectDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const oldShot = 'D:\\Ai\\mimo\\screenshots\\json-manager.png';

if (fs.existsSync(oldShot)) {
  try { fs.unlinkSync(oldShot); } catch (_) {}
}

console.log('[shot] 启动 Electron:', electronExe);
const proc = spawn(electronExe, ['.', '--no-sandbox', '--disable-gpu'], {
  cwd: projectDir,
  env: { ...process.env, JSON_MANAGER_SHOT: '1', JSON_MANAGER_DEMO: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

proc.stdout.on('data', (d) => process.stdout.write('[electron] ' + d.toString()));
proc.stderr.on('data', (d) => process.stderr.write('[electron-err] ' + d.toString()));

proc.on('exit', (code) => {
  console.log('[shot] Electron 退出，code=' + code);
  if (fs.existsSync(oldShot)) {
    const stat = fs.statSync(oldShot);
    console.log('[shot] 截图已保存: ' + oldShot + ' (' + stat.size + ' bytes)');
    process.exit(0);
  } else {
    console.log('[shot] 错误：截图文件未生成');
    process.exit(1);
  }
});

// 40 秒后强制 kill
setTimeout(() => {
  console.log('[shot] 超时，强制结束 Electron...');
  try { proc.kill(); } catch (_) {}
  try { execSync('taskkill /IM electron.exe /F', { stdio: 'ignore' }); } catch (_) {}
  setTimeout(() => {
    if (fs.existsSync(oldShot)) {
      const stat = fs.statSync(oldShot);
      console.log('[shot] 截图已保存（超时后）: ' + oldShot + ' (' + stat.size + ' bytes)');
      process.exit(0);
    }
    console.log('[shot] 错误：截图文件未生成');
    process.exit(1);
  }, 1000);
}, 40000);
