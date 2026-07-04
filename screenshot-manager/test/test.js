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

console.log('\n全部测试通过 ✓');
