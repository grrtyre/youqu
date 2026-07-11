// 截图管家 - 核心逻辑测试
// 测试 main.js 中可独立测试的纯函数：历史管理、UUID、裁剪坐标

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
      fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
    },
    add(item) {
      const list = this.load();
      list.unshift(item);
      if (list.length > 100) list.length = 100;
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-test-'));
  const store = makeHistoryStore(tmp);

  // 空
  assert.deepEqual(store.load(), [], '初始应为空');

  // 添加 3 条
  store.add({ id: 'a', time: 1 });
  store.add({ id: 'b', time: 2 });
  store.add({ id: 'c', time: 3 });
  let list = store.load();
  assert.equal(list.length, 3, '应有 3 条');
  assert.equal(list[0].id, 'c', '最新在前');
  assert.equal(list[2].id, 'a', '最旧在后');

  // 删除
  store.remove('b');
  list = store.load();
  assert.equal(list.length, 2, '删除后应剩 2 条');
  assert.ok(!list.find(x => x.id === 'b'), 'b 应被删除');

  // 上限 100
  for (let i = 0; i < 110; i++) store.add({ id: 'x' + i, time: i });
  list = store.load();
  assert.equal(list.length, 100, '应被截断到 100 条');
  assert.equal(list[0].id, 'x109', '最新是 x109');

  // 清理
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 历史管理测试通过（增/删/上限100/最新在前）');
})();

// 3. 裁剪坐标转换测试
// picker 选区 CSS 像素 → 物理像素：rect_phys = rect_css * scaleFactor
(function testCropCoords() {
  function toPhys(cssRect, scale) {
    return {
      x: Math.round(cssRect.x * scale),
      y: Math.round(cssRect.y * scale),
      w: Math.round(cssRect.w * scale),
      h: Math.round(cssRect.h * scale)
    };
  }
  // scale 1.5
  const css = { x: 100, y: 200, w: 300, h: 150 };
  const phys = toPhys(css, 1.5);
  assert.deepEqual(phys, { x: 150, y: 300, w: 450, h: 225 }, '1.5x 缩放正确');

  // scale 1.0
  const phys2 = toPhys({ x: 10, y: 20, w: 100, h: 50 }, 1);
  assert.deepEqual(phys2, { x: 10, y: 20, w: 100, h: 50 }, '1.0x 不变');

  // scale 2.0
  const phys3 = toPhys({ x: 50, y: 50, w: 200, h: 100 }, 2);
  assert.deepEqual(phys3, { x: 100, y: 100, w: 400, h: 200 }, '2.0x 缩放正确');
  console.log('✓ 裁剪坐标转换测试通过');
})();

// 4. 标注形状几何测试
// 矩形：两点 → (x, y, w, h)
(function testShapeGeometry() {
  function rectFromPoints(a, b) {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y)
    };
  }
  // 正向拖拽
  assert.deepEqual(
    rectFromPoints({ x: 10, y: 20 }, { x: 110, y: 220 }),
    { x: 10, y: 20, w: 100, h: 200 }
  );
  // 反向拖拽（起点在右下）
  assert.deepEqual(
    rectFromPoints({ x: 110, y: 220 }, { x: 10, y: 20 }),
    { x: 10, y: 20, w: 100, h: 200 }
  );
  console.log('✓ 标注形状几何测试通过');
})();

// 5. 箭头方向测试
(function testArrow() {
  function arrowHead(a, b, headLen) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const angle = Math.atan2(dy, dx);
    return [
      { x: b.x - headLen * Math.cos(angle - Math.PI / 6), y: b.y - headLen * Math.sin(angle - Math.PI / 6) },
      { x: b.x - headLen * Math.cos(angle + Math.PI / 6), y: b.y - headLen * Math.sin(angle + Math.PI / 6) }
    ];
  }
  // 水平向右
  const h1 = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
  assert.ok(Math.abs(h1[0].x - 91.34) < 0.5, '水平箭头左点 x 正确: ' + h1[0].x);
  assert.ok(Math.abs(h1[0].y - 5) < 0.5, '水平箭头左点 y 正确: ' + h1[0].y);
  assert.ok(Math.abs(h1[1].y - (-5)) < 0.5, '水平箭头右点 y 正确: ' + h1[1].y);
  console.log('✓ 箭头方向测试通过');
})();

// 6. 序号自增测试
(function testNumberSequence() {
  let idx = 1;
  const shapes = [];
  function addNumber(x, y) {
    shapes.push({ type: 'number', x, y, num: idx++ });
  }
  addNumber(10, 10);
  addNumber(50, 50);
  addNumber(100, 100);
  assert.equal(shapes.length, 3, '应有 3 个序号');
  assert.equal(shapes[0].num, 1, '第一个序号是 1');
  assert.equal(shapes[1].num, 2, '第二个序号是 2');
  assert.equal(shapes[2].num, 3, '第三个序号是 3');

  // 撤销序号
  const last = shapes.pop();
  if (last.type === 'number') idx = Math.max(1, idx - 1);
  addNumber(200, 200);
  assert.equal(shapes[shapes.length - 1].num, 3, '撤销后新序号应回退到 3');
  console.log('✓ 序号自增/撤销测试通过');
})();

// 7. 重做栈测试
(function testRedoStack() {
  let shapes = [];
  let redoStack = [];

  function pushShape(s) {
    shapes.push(s);
    redoStack = [];   // 新操作清空 redo 栈
  }
  function undo() {
    if (shapes.length === 0) return;
    redoStack.push(shapes.pop());
  }
  function redo() {
    if (redoStack.length === 0) return;
    shapes.push(redoStack.pop());
  }

  pushShape({ type: 'rect' });
  pushShape({ type: 'arrow' });
  pushShape({ type: 'pen' });
  assert.equal(shapes.length, 3, '初始 3 个标注');
  assert.equal(redoStack.length, 0, 'redo 栈为空');

  undo();
  undo();
  assert.equal(shapes.length, 1, '撤销 2 次后剩 1 个');
  assert.equal(redoStack.length, 2, 'redo 栈有 2 个');

  redo();
  assert.equal(shapes.length, 2, '重做 1 次后变 2 个');
  assert.equal(redoStack.length, 1, 'redo 栈剩 1 个');

  // 新操作清空 redo 栈
  pushShape({ type: 'text' });
  assert.equal(redoStack.length, 0, '新操作后 redo 栈被清空');
  assert.equal(shapes.length, 3, '形状变 3 个');

  // 全部撤销后重做到顶
  while (shapes.length > 0) undo();
  assert.equal(shapes.length, 0, '全部撤销');
  while (redoStack.length > 0) redo();
  assert.equal(shapes.length, 3, '全部重做');

  // redo 栈空时 redo 不报错
  redo();
  assert.equal(shapes.length, 3, 'redo 栈空时 redo 无变化');
  console.log('✓ 重做栈测试通过（撤销/重做/新操作清空/边界）');
})();

// 8. 路径白名单校验测试
// 模拟 main.js 的 isPathSafe 逻辑：路径必须在 historyDir 内或在历史列表中
(function testPathWhitelist() {
  function makeIsPathSafe(historyDir, historyList) {
    return function (p) {
      if (typeof p !== 'string' || !p) return false;
      const resolved = path.resolve(p);
      if (resolved.startsWith(historyDir + path.sep) || resolved === historyDir) return true;
      return historyList.some(item => item.path && path.resolve(item.path) === resolved);
    };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-safe-'));
  const historyDir = path.join(tmp, 'screenshots');
  fs.mkdirSync(historyDir, { recursive: true });
  const historyList = [
    { id: 'a', path: path.join(historyDir, 'final_a.png') },
    { id: 'b', path: path.join(historyDir, 'final_b.png') }
  ];

  const isPathSafe = makeIsPathSafe(historyDir, historyList);

  // 在 historyDir 内：允许
  assert.ok(isPathSafe(path.join(historyDir, 'raw_123.png')), 'historyDir 内的文件允许');
  assert.ok(isPathSafe(path.join(historyDir, 'sub', 'x.png')), 'historyDir 子目录允许');

  // 历史列表中的路径：允许
  assert.ok(isPathSafe(path.join(historyDir, 'final_a.png')), '历史列表中的路径允许');

  // 历史列表外的路径：拒绝
  assert.ok(!isPathSafe('C:\\Windows\\System32\\config\\SAM'), '系统文件拒绝');
  assert.ok(!isPathSafe(path.join(os.tmpdir(), 'random.png')), 'historyDir 外的临时文件拒绝');
  assert.ok(!isPathSafe(''), '空字符串拒绝');
  assert.ok(!isPathSafe(null), 'null 拒绝');
  assert.ok(!isPathSafe(undefined), 'undefined 拒绝');
  assert.ok(!isPathSafe(123), '非字符串拒绝');

  // 路径遍历攻击：拒绝
  const traversal = path.join(historyDir, '..', '..', 'evil.png');
  assert.ok(!isPathSafe(traversal), '路径遍历攻击拒绝');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 路径白名单校验测试通过（historyDir 内/历史列表/系统文件/路径遍历）');
})();

// 9. 多屏虚拟桌面 bounds 计算测试
// 模拟 main.js 的 startScreenshot 中的桌面 bounds 并集计算
(function testDesktopBounds() {
  function computeDesktopBounds(displays) {
    const minX = Math.min(...displays.map(d => d.bounds.x));
    const minY = Math.min(...displays.map(d => d.bounds.y));
    const maxX = Math.max(...displays.map(d => d.bounds.x + d.bounds.width));
    const maxY = Math.max(...displays.map(d => d.bounds.y + d.bounds.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // 单屏
  const single = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
  assert.deepEqual(computeDesktopBounds(single), { x: 0, y: 0, width: 1920, height: 1080 }, '单屏 bounds 正确');

  // 双屏左右排列
  const dual = [
    { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { bounds: { x: 1920, y: 0, width: 2560, height: 1440 } }
  ];
  assert.deepEqual(computeDesktopBounds(dual), { x: 0, y: 0, width: 4480, height: 1440 }, '双屏左右 bounds 正确');

  // 双屏上下排列
  const vertical = [
    { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { bounds: { x: 0, y: 1080, width: 1920, height: 1080 } }
  ];
  assert.deepEqual(computeDesktopBounds(vertical), { x: 0, y: 0, width: 1920, height: 2160 }, '双屏上下 bounds 正确');

  // 副屏在主屏左上（负坐标）
  const neg = [
    { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }
  ];
  assert.deepEqual(computeDesktopBounds(neg), { x: -1920, y: 0, width: 3840, height: 1080 }, '副屏负坐标 bounds 正确');
  console.log('✓ 多屏虚拟桌面 bounds 计算测试通过');
})();

// 10. 高 DPI 物理像素计算测试
// captureDisplay 中 thumbnailSize 应乘 scaleFactor
(function testHiDPI() {
  function computeThumbnailSize(bounds, scaleFactor) {
    const sf = scaleFactor || 1;
    return {
      width: Math.round(bounds.width * sf),
      height: Math.round(bounds.height * sf)
    };
  }

  // 100% 缩放
  assert.deepEqual(computeThumbnailSize({ width: 1920, height: 1080 }, 1), { width: 1920, height: 1080 }, '100% 缩放不变');

  // 150% 缩放
  assert.deepEqual(computeThumbnailSize({ width: 1920, height: 1080 }, 1.5), { width: 2880, height: 1620 }, '150% 缩放正确');

  // 200% 缩放
  assert.deepEqual(computeThumbnailSize({ width: 1280, height: 720 }, 2), { width: 2560, height: 1440 }, '200% 缩放正确');

  // 未提供 scaleFactor 默认 1
  assert.deepEqual(computeThumbnailSize({ width: 1920, height: 1080 }), { width: 1920, height: 1080 }, '默认 scaleFactor=1');
  console.log('✓ 高 DPI 物理像素计算测试通过');
})();

// 11. 贴图位置计算测试（贴在编辑器右侧/下方/左侧）
(function testPinPosition() {
  function computePinPos(editorBounds, pinSize, screenAvail, gap) {
    gap = gap || 16;
    let x = editorBounds.x + editorBounds.w + gap;
    let y = editorBounds.y;
    if (x + pinSize.w > screenAvail.w) {
      x = editorBounds.x;
      y = editorBounds.y + editorBounds.h + gap;
    }
    if (y + pinSize.h > screenAvail.h) {
      x = Math.max(0, editorBounds.x - pinSize.w - gap);
      y = editorBounds.y;
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  // 编辑器在左上，右侧有空间
  const r1 = computePinPos({ x: 100, y: 100, w: 800, h: 600 }, { w: 400, h: 300 }, { w: 1920, h: 1080 });
  assert.deepEqual(r1, { x: 916, y: 100 }, '右侧贴图');

  // 编辑器右侧空间不够，下方贴图
  const r2 = computePinPos({ x: 1500, y: 100, w: 800, h: 600 }, { w: 400, h: 300 }, { w: 1920, h: 1080 });
  assert.deepEqual(r2, { x: 1500, y: 716 }, '下方贴图');

  // 右侧下方都不够，左侧贴图
  const r3 = computePinPos({ x: 1500, y: 800, w: 800, h: 600 }, { w: 400, h: 300 }, { w: 1920, h: 1080 });
  assert.deepEqual(r3, { x: 1084, y: 800 }, '左侧贴图');
  console.log('✓ 贴图位置计算测试通过（右/下/左 fallback）');
})();

// 12. 原子写入测试（saveHistory：先写 .tmp 再 rename，崩溃不损坏主文件）
(function testAtomicSave() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-atomic-'));
  const file = path.join(tmp, 'history.json');
  const tmpFile = file + '.tmp';
  // 模拟 main.js 的 saveHistory 行为
  function saveAtomic(list) {
    fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf8');
    fs.renameSync(tmpFile, file);
  }
  saveAtomic([{ id: 'a', time: 1 }]);
  assert.ok(fs.existsSync(file), '原子写入后主文件存在');
  assert.ok(!fs.existsSync(tmpFile), '原子写入后 .tmp 已被 rename 掉');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ id: 'a', time: 1 }], '内容正确');

  // 覆盖写
  saveAtomic([{ id: 'b', time: 2 }, { id: 'c', time: 3 }]);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 2, '覆盖写后内容更新');
  assert.ok(!fs.existsSync(tmpFile), '覆盖写后 .tmp 仍不存在');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 原子写入测试通过（.tmp → rename，不残留临时文件）');
})();

// 13. 启动时孤儿临时文件清理测试
// raw_*.png / pin_*.png / raw_composed_*.png 不在历史列表中则删除；final_*.png 保留
(function testOrphanCleanup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-orphan-'));
  // 模拟历史目录内容
  const finalPath = path.join(tmp, 'final_1.png');      // 真实历史图，保留
  const rawOrphan = path.join(tmp, 'raw_123.png');        // 崩溃残留 raw，删除
  const pinOrphan = path.join(tmp, 'pin_456.png');        // 崩溃残留 pin，删除
  const composedOrphan = path.join(tmp, 'raw_composed_789.png'); // 崩溃残留 composed，删除
  const finalKeep = path.join(tmp, 'final_2.png');       // 真实历史图，保留
  [finalPath, rawOrphan, pinOrphan, composedOrphan, finalKeep].forEach(f => fs.writeFileSync(f, 'x'));

  const historyList = [{ id: '1', path: finalPath }, { id: '2', path: finalKeep }];
  const knownPaths = new Set(historyList.map(it => path.resolve(it.path)));

  // 模拟 cleanupOrphanTempFiles 逻辑
  for (const name of fs.readdirSync(tmp)) {
    if (/^(raw_|pin_|raw_composed_)/.test(name)) {
      const full = path.join(tmp, name);
      if (!knownPaths.has(path.resolve(full))) {
        fs.unlinkSync(full);
      }
    }
  }

  assert.ok(fs.existsSync(finalPath), 'final_1.png 历史图保留');
  assert.ok(fs.existsSync(finalKeep), 'final_2.png 历史图保留');
  assert.ok(!fs.existsSync(rawOrphan), 'raw_*.png 孤儿已清理');
  assert.ok(!fs.existsSync(pinOrphan), 'pin_*.png 孤儿已清理');
  assert.ok(!fs.existsSync(composedOrphan), 'raw_composed_*.png 孤儿已清理');
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('✓ 孤儿临时文件清理测试通过（final 保留 / raw·pin·composed 清理）');
})();

// 14. 贴图滚轮缩放系数计算测试（pin-zoom：上滚 1.1x，下滚 0.9x，带 min/max 钳制）
(function testPinZoomFactor() {
  function computeZoom(w, h, delta, maxW, maxH) {
    const factor = (typeof delta === 'number' && delta < 0) ? 1.1 : 0.9;
    let newW = Math.round(w * factor);
    let newH = Math.round(h * factor);
    if (newW > maxW) newW = maxW;
    if (newH > maxH) newH = maxH;
    if (newW < 80) newW = 80;
    if (newH < 60) newH = 60;
    return { width: newW, height: newH };
  }
  // 上滚放大（deltaY < 0）
  assert.deepEqual(computeZoom(400, 300, -100, 1920, 1080), { width: 440, height: 330 }, '上滚放大 1.1x');
  // 下滚缩小（deltaY > 0）
  assert.deepEqual(computeZoom(400, 300, 100, 1920, 1080), { width: 360, height: 270 }, '下滚缩小 0.9x');
  // 最小尺寸钳制
  assert.deepEqual(computeZoom(80, 60, 100, 1920, 1080), { width: 80, height: 60 }, '最小尺寸钳制 80x60');
  // 最大尺寸钳制（超过工作区）
  const r = computeZoom(1800, 1000, -100, 1920, 1080);
  assert.ok(r.width <= 1920 && r.height <= 1080, '超过工作区时被钳制');
  console.log('✓ 贴图滚轮缩放系数测试通过（上滚放大/下滚缩小/最小最大钳制）');
})();

// 15. 外部链接协议白名单测试（open-external：仅允许 http/https）
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
  console.log('✓ 外部链接协议白名单测试通过（http/https 放行，其他拒绝）');
})();

console.log('\n全部测试通过 ✓');
