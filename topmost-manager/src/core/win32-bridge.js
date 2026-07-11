// win32-bridge.js - 管理常驻 PowerShell 桥接进程，行协议 JSON 通信
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class Win32Bridge {
  constructor() {
    this.proc = null;
    this.queue = [];
    this.waiting = null;
    this.buf = '';
    this.starting = null;
    this.lastError = '';
  }

  start() {
    if (this.proc) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = new Promise((resolve, reject) => {
      const ps1 = path.join(__dirname, 'bridge.ps1');
      if (!fs.existsSync(ps1)) {
        this.starting = null;
        return reject(new Error('bridge.ps1 不存在: ' + ps1));
      }
      let p;
      try {
        p = spawn('powershell.exe',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1],
          { windowsHide: true });
      } catch (e) {
        this.starting = null;
        return reject(e);
      }
      this.proc = p;
      this.buf = '';
      p.stdout.setEncoding('utf-8');
      p.stderr.setEncoding('utf-8');
      p.stdout.on('data', (d) => this._onOut(d));
      p.stderr.on('data', (d) => { this.lastError += d; });
      p.on('error', (e) => {
        this.proc = null;
        this.starting = null;
        reject(e);
      });
      p.on('exit', (code) => {
        this.proc = null;
        if (this.waiting) {
          this.waiting.reject(new Error('桥接进程退出 code=' + code + ' err=' + this.lastError.slice(-300)));
          this.waiting = null;
        }
        this._drain();
      });
      // 用 ping 确认 Add-Type 编译完成、就绪
      this._send({ cmd: 'ping' })
        .then(() => { this.starting = null; resolve(); })
        .catch((e) => { this.starting = null; reject(e); });
    });
    return this.starting;
  }

  _onOut(d) {
    this.buf += d;
    let i;
    while ((i = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, i).replace(/\r$/, '');
      this.buf = this.buf.slice(i + 1);
      if (line.trim() === '') continue;
      if (this.waiting) {
        let parsed;
        try { parsed = JSON.parse(line); }
        catch (e) { parsed = { ok: false, error: '解析失败: ' + line.slice(0, 200) }; }
        const w = this.waiting;
        this.waiting = null;
        w.resolve(parsed);
        this._drain();
      }
    }
  }

  _send(obj) {
    return new Promise((resolve, reject) => {
      this.queue.push({ obj, resolve, reject });
      this._drain();
    });
  }

  _drain() {
    if (this.waiting || !this.proc) return;
    const item = this.queue.shift();
    if (!item) return;
    this.waiting = item;
    try {
      this.proc.stdin.write(JSON.stringify(item.obj) + '\n');
    } catch (e) {
      item.reject(e);
      this.waiting = null;
      this._drain();
    }
  }

  listWindows(exclude) {
    return this._send({ cmd: 'list', exclude: exclude ? String(exclude) : '' });
  }
  setTopmost(hwnd, on) {
    return this._send({ cmd: 'top', hwnd: String(hwnd), on: !!on });
  }
  setAlpha(hwnd, percent) {
    return this._send({ cmd: 'alpha', hwnd: String(hwnd), percent: Math.round(percent) });
  }
  resetAlpha(hwnd) {
    return this._send({ cmd: 'reset', hwnd: String(hwnd) });
  }
  getForeground() {
    return this._send({ cmd: 'fg' });
  }
  toggleTopmostForeground() {
    return this._send({ cmd: 'topfg' });
  }

  stop() {
    if (this.proc) {
      try { this.proc.stdin.end(); } catch (e) {}
      try { this.proc.kill(); } catch (e) {}
      this.proc = null;
    }
  }
}

module.exports = { Win32Bridge };
