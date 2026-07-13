// 录屏管家 - 核心逻辑测试
// 测试 main.js / app.js 中可独立测试的纯函数：UUID、历史管理、路径白名单、原子写入、时间/大小格式化、mimeType 选择、计时累计

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 1. UUID 生成测试
const { v4: uuidv4 } = require('../src/uuid-lite');
(function testUuid() {
  const id1 = uuidv4();
  const id2 = uuidv4();
  assert.ok(id1 !== id2, '两次 UUID 不应相同');
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id1), 'UUID 格式合法: ' + id1);
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id2), 'UUID 格式合法: ' + id2);
  console.log('✓ UUID 生成测试通过：', id1, id2);
})();

// 2. 历史管理逻辑测试（独立实现，模拟 main.js 行为）
function makeHistoryStore(dir) {
  const file = path.join(dir, 'history.json');
  return {
    load() {
      try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {}
      return [];
    },
    save(list) {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tmp, file);
    },
    add(item) {
      const list = this.load();
      list.unshift(item);
      if (list.length > 200) list.length = 200;   // 录屏管家上限 200
      this.save(list);
      return list;
    },
    remove(id) {
      const list = this.load().filter(x => x.id !== id);
      this.save(list);
      return list;
    }
  };
}

(function testHistory() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-test-'));
  const store = makeHistoryStore(tmp);

  // 空
  assert.deepEqual(store.load(), [], '初始应为空');

  // 添加 3 条（带录屏特有字段 duration/size/format）
  store.add({ id: 'a', time: 1, duration: 10, size: 1024, sourceName: '屏幕 1', format: 'webm' });
  store.add({ id: 'b', time: 2, duration: 20, size: 2048, sourceName: '窗口 X', format: 'webm' });
  store.add({ id: 'c', time: 3, duration: 30, size: 4096, sourceName: '屏幕 2', format: 'mp4' });
  let list = store.load();
  assert.equal(list.length, 3, '应有 3 条');
  assert.equal(list[0].id, 'c', '最新在前');
  assert.equal(list[2].id, 'a', '最旧在后');
  assert.equal(list[0].duration, 30, 'duration 字段保留');
  assert.equal(list[0].format, 'mp4', 'format 字段保留');

  // 删除
  store.remove('b');
  list = store.load();
  assert.equal(list.length, 2, '删除后应剩 2 条');
  assert.ok(!list.find(x => x.id === 'b'), 'b 应被删除');

  // 上限 200
  for (let i = 0; i < 210; i++) store.add({ id: 'x' + i, time: i, duration: i });
  list = store.load();
  assert.equal(list.length, 200, '应被截断到 200 条');
  assert.equal(list[0].id, 'x209', '最新是 x209');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 历史管理测试通过（增/删/上限200/最新在前/字段保留）');
})();

// 3. 时间格式化测试（fmtTime：秒 → MM:SS）
(function testFmtTime() {
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  assert.equal(fmtTime(0), '00:00', '0 秒');
  assert.equal(fmtTime(9), '00:09', '9 秒');
  assert.equal(fmtTime(65), '01:05', '65 秒 = 01:05');
  assert.equal(fmtTime(3661), '61:01', '3661 秒 = 61:01（超过 1 小时不显示时）');
  assert.equal(fmtTime(59.7), '00:59', '小数向下取整');
  assert.equal(fmtTime(120), '02:00', '120 秒 = 02:00');
  console.log('✓ 时间格式化测试通过');
})();

// 4. 文件大小格式化测试（fmtSize）
(function testFmtSize() {
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  assert.equal(fmtSize(0), '0 B', '0 字节');
  assert.equal(fmtSize(512), '512 B', '512 字节');
  assert.equal(fmtSize(1024), '1.0 KB', '1 KB');
  assert.equal(fmtSize(1536), '1.5 KB', '1.5 KB');
  assert.equal(fmtSize(1048576), '1.0 MB', '1 MB');
  assert.equal(fmtSize(1572864), '1.5 MB', '1.5 MB');
  assert.equal(fmtSize(1073741824), '1.00 GB', '1 GB');
  assert.equal(fmtSize(5368709120), '5.00 GB', '5 GB');
  console.log('✓ 文件大小格式化测试通过');
})();

// 5. 日期格式化测试（fmtDate）
(function testFmtDate() {
  function fmtDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const ts = new Date(2026, 6, 13, 9, 30).getTime();  // 2026-07-13 09:30
  assert.equal(fmtDate(ts), '2026-07-13 09:30', '日期格式正确');
  const ts2 = new Date(2026, 0, 1, 0, 5).getTime();   // 2026-01-01 00:05
  assert.equal(fmtDate(ts2), '2026-01-01 00:05', '补零正确');
  const ts3 = new Date(2026, 11, 31, 23, 59).getTime(); // 2026-12-31 23:59
  assert.equal(fmtDate(ts3), '2026-12-31 23:59', '年末正确');
  console.log('✓ 日期格式化测试通过');
})();

// 6. MediaRecorder mimeType 选择逻辑测试
// 模拟 app.js 中按优先级选择支持的 mimeType
(function testMimeTypeSelection() {
  function pickMime(supported) {
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const m of candidates) {
      if (supported(m)) return m;
    }
    return '';
  }
  // 全部支持 → 选 vp9+opus
  assert.equal(pickMime(() => true), 'video/webm;codecs=vp9,opus', '全支持选 vp9+opus');
  // 只支持 vp8
  assert.equal(pickMime(m => m.indexOf('vp8') >= 0), 'video/webm;codecs=vp8,opus', '只支持 vp8 选 vp8+opus');
  // 只支持基础 webm
  assert.equal(pickMime(m => m === 'video/webm'), 'video/webm', '只支持基础 webm');
  // 全不支持 → 空字符串（交由 MediaRecorder 默认）
  assert.equal(pickMime(() => false), '', '全不支持返回空');
  console.log('✓ mimeType 选择测试通过');
})();

// 7. 录制时长累计测试（暂停/继续：elapsedBeforePause + 当前段）
(function testDurationAccum() {
  // 模拟 updateTimer / stopRecording 中的累计逻辑
  function computeTotal(elapsedBeforePause, timerStart, now, isPaused) {
    let total = elapsedBeforePause;
    if (!isPaused) {
      total += Math.floor((now - timerStart) / 1000);
    }
    return total;
  }
  // 录制 10 秒
  assert.equal(computeTotal(0, 1000, 11000, false), 10, '录制 10 秒');
  // 暂停时不再增加
  assert.equal(computeTotal(10, 0, 99999, true), 10, '暂停时累计不变');
  // 暂停 5 秒后继续 3 秒
  assert.equal(computeTotal(5, 2000, 5000, false), 8, '暂停后继续 3 秒 = 5+3');
  console.log('✓ 录制时长累计测试通过（含暂停/继续）');
})();

// 8. 路径白名单校验测试（模拟 main.js isPathSafe）
(function testPathWhitelist() {
  function makeIsPathSafe(historyDir, historyList) {
    return function (p) {
      if (typeof p !== 'string' || !p) return false;
      const resolved = path.resolve(p);
      if (resolved.startsWith(historyDir + path.sep) || resolved === historyDir) return true;
      return historyList.some(item => item.path && path.resolve(item.path) === resolved);
    };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-safe-'));
  const historyDir = path.join(tmp, 'recordings');
  fs.mkdirSync(historyDir, { recursive: true });
  const historyList = [
    { id: 'a', path: path.join(historyDir, 'rec_a.webm') },
    { id: 'b', path: path.join(historyDir, 'rec_b.mp4') }
  ];
  const isPathSafe = makeIsPathSafe(historyDir, historyList);

  assert.ok(isPathSafe(path.join(historyDir, 'rec_123.webm')), 'historyDir 内允许');
  assert.ok(isPathSafe(path.join(historyDir, 'sub', 'x.webm')), '子目录允许');
  assert.ok(isPathSafe(path.join(historyDir, 'rec_a.webm')), '历史列表中的路径允许');
  assert.ok(!isPathSafe('C:\\Windows\\System32\\config\\SAM'), '系统文件拒绝');
  assert.ok(!isPathSafe(path.join(os.tmpdir(), 'random.webm')), 'historyDir 外拒绝');
  assert.ok(!isPathSafe(''), '空字符串拒绝');
  assert.ok(!isPathSafe(null), 'null 拒绝');
  assert.ok(!isPathSafe(123), '非字符串拒绝');
  const traversal = path.join(historyDir, '..', '..', 'evil.webm');
  assert.ok(!isPathSafe(traversal), '路径遍历攻击拒绝');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 路径白名单校验测试通过');
})();

// 9. 原子写入测试（saveHistory：.tmp → rename）
(function testAtomicSave() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-atomic-'));
  const file = path.join(tmp, 'history.json');
  const tmpFile = file + '.tmp';
  function saveAtomic(list) {
    fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmpFile, file);
  }
  saveAtomic([{ id: 'a', duration: 10 }]);
  assert.ok(fs.existsSync(file), '原子写入后主文件存在');
  assert.ok(!fs.existsSync(tmpFile), '.tmp 已被 rename 掉');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ id: 'a', duration: 10 }], '内容正确');
  saveAtomic([{ id: 'b', duration: 20 }, { id: 'c', duration: 30 }]);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 2, '覆盖写后更新');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 原子写入测试通过');
})();

// 10. 外部链接协议白名单测试（open-external：仅 http/https）
(function testOpenExternalScheme() {
  function isOpenable(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }
  assert.ok(isOpenable('https://www.ifdian.net/a/giquwei'), 'https 允许');
  assert.ok(isOpenable('http://example.com'), 'http 允许');
  assert.ok(!isOpenable('file:///C:/secret.txt'), 'file:// 拒绝');
  assert.ok(!isOpenable('javascript:alert(1)'), 'javascript: 拒绝');
  assert.ok(!isOpenable('C:\\Windows\\system32'), '本地路径拒绝');
  assert.ok(!isOpenable(123), '非字符串拒绝');
  assert.ok(!isOpenable(null), 'null 拒绝');
  console.log('✓ 外部链接协议白名单测试通过');
})();

// 11. 扩展名推断测试（save-recording：根据 mimeType 决定 .mp4/.webm）
(function testExtInference() {
  function inferExt(mimeType) {
    return (mimeType && mimeType.indexOf('mp4') >= 0) ? 'mp4' : 'webm';
  }
  assert.equal(inferExt('video/webm;codecs=vp9,opus'), 'webm', 'webm mime → webm');
  assert.equal(inferExt('video/mp4'), 'mp4', 'mp4 mime → mp4');
  assert.equal(inferExt(''), 'webm', '空 mime 默认 webm');
  assert.equal(inferExt(null), 'webm', 'null 默认 webm');
  assert.equal(inferExt(undefined), 'webm', 'undefined 默认 webm');
  console.log('✓ 扩展名推断测试通过');
})();

// 12. 画质 fps 选项测试
(function testQualityOptions() {
  const opts = [
    { fps: 10, label: '流畅' },
    { fps: 24, label: '标准' },
    { fps: 30, label: '高清' }
  ];
  assert.equal(opts.length, 3, '三档画质');
  assert.equal(opts[0].fps, 10, '流畅 10fps');
  assert.equal(opts[1].fps, 24, '标准 24fps');
  assert.equal(opts[2].fps, 30, '高清 30fps');
  // 默认标准
  const defaultOpt = opts.find(o => o.label === '标准');
  assert.equal(defaultOpt.fps, 24, '默认标准 24fps');
  console.log('✓ 画质选项测试通过');
})();

// 13. 源类型过滤测试（screen / window 分类）
(function testSourceFilter() {
  const sources = [
    { id: 'screen:1', name: '屏幕 1', display_id: '1' },
    { id: 'screen:2', name: '屏幕 2', display_id: '2' },
    { id: 'window:100', name: '记事本', display_id: undefined },
    { id: 'window:101', name: '浏览器', display_id: undefined }
  ];
  const screens = sources.filter(s => /^screen/i.test(s.id) || s.display_id);
  const windows = sources.filter(s => /^window/i.test(s.id) && !s.display_id);
  assert.equal(screens.length, 2, '屏幕源 2 个');
  assert.equal(windows.length, 2, '窗口源 2 个');
  assert.ok(screens.every(s => /^screen/i.test(s.id)), '屏幕源 id 以 screen 开头');
  assert.ok(windows.every(s => /^window/i.test(s.id)), '窗口源 id 以 window 开头');
  console.log('✓ 源类型过滤测试通过');
})();

// 14. HTML 转义测试（escapeHtml，防止历史名称 XSS）
(function testEscapeHtml() {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  assert.equal(escapeHtml('屏幕 1'), '屏幕 1', '普通文本不变');
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'script 标签转义');
  assert.equal(escapeHtml('a&b'), 'a&amp;b', '& 转义');
  assert.equal(escapeHtml('"hi"'), '&quot;hi&quot;', '引号转义');
  assert.equal(escapeHtml("it's"), "it&#39;s", '单引号转义');
  console.log('✓ HTML 转义测试通过');
})();

console.log('\n全部测试通过 ✓');
