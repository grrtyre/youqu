// 统计引擎 - 累计按键计数、鼠标计数、NKRO 检测
// 纯逻辑模块，可被 Node 测试

class StatsEngine {
  constructor() {
    this.keyCount = {}; // code -> 次数
    this.mouseClick = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };
    this.wheel = { up: 0, down: 0 };
    this.distance = 0; // 鼠标移动距离（像素）
    this.totalKeys = 0;
  }

  // 记录一次按键
  pressKey(code) {
    if (!code) return;
    this.keyCount[code] = (this.keyCount[code] || 0) + 1;
    this.totalKeys += 1;
  }

  // 记录一次鼠标点击
  clickMouse(button) {
    const m = this.mouseClick;
    if (m[button] === undefined) return;
    m[button] += 1;
  }

  // 记录滚轮
  wheelScroll(direction) {
    if (direction !== 'up' && direction !== 'down') return;
    this.wheel[direction] += 1;
  }

  // 记录鼠标移动
  moveMouse(dx, dy) {
    this.distance += Math.sqrt(dx * dx + dy * dy);
  }

  // 获取 Top N 按键
  topKeys(n = 10) {
    return Object.entries(this.keyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([code, count]) => ({ code, count }));
  }

  // 获取最大值（用于热力图归一化）
  maxCount() {
    const vals = Object.values(this.keyCount);
    if (vals.length === 0) return 0;
    return Math.max(...vals);
  }

  // 序列化
  toJSON() {
    return {
      keyCount: this.keyCount,
      mouseClick: this.mouseClick,
      wheel: this.wheel,
      distance: this.distance,
      totalKeys: this.totalKeys,
    };
  }

  // 反序列化
  static fromJSON(data) {
    const e = new StatsEngine();
    if (!data) return e;
    e.keyCount = data.keyCount || {};
    e.mouseClick = Object.assign(
      { left: 0, right: 0, middle: 0, back: 0, forward: 0 },
      data.mouseClick || {}
    );
    e.wheel = Object.assign({ up: 0, down: 0 }, data.wheel || {});
    e.distance = data.distance || 0;
    e.totalKeys = data.totalKeys || 0;
    // 校正 totalKeys
    const sum = Object.values(e.keyCount).reduce((a, b) => a + b, 0);
    if (e.totalKeys < sum) e.totalKeys = sum;
    return e;
  }

  // 重置
  reset() {
    this.keyCount = {};
    this.mouseClick = { left: 0, right: 0, middle: 0, back: 0, forward: 0 };
    this.wheel = { up: 0, down: 0 };
    this.distance = 0;
    this.totalKeys = 0;
  }
}

module.exports = { StatsEngine };
