// 键鼠管家 - 核心逻辑测试
const { StatsEngine } = require('../src/core/stats-engine');
const { TypingTest, SAMPLES, randomSample } = require('../src/core/typing-test');
const { ROWS, KEY_MAP, KEY_NAMES, keyName } = require('../src/core/keyboard-layout');
const { Store } = require('../src/core/store');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + msg);
  } else {
    failed++;
    console.error('  ✗ ' + msg);
  }
}

function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} (期望 ${expected}, 实际 ${actual})`);
}

console.log('\n=== 键盘布局 ===');
assert(ROWS.length === 6, '键盘共 6 行');
assert(KEY_MAP['KeyA'] !== undefined, 'KeyA 在映射表中');
assert(KEY_MAP['Space'] !== undefined, 'Space 在映射表中');
assertEqual(keyName('KeyA'), 'A', 'keyName(KeyA) = A');
assertEqual(keyName('Space'), '空格', 'keyName(Space) = 空格');
assertEqual(keyName('ShiftLeft'), '左 Shift', 'keyName(ShiftLeft) = 左 Shift');
assertEqual(keyName('UnknownCode'), 'UnknownCode', '未知 code 原样返回');
// 检查每个键都有 code/label/w
let allKeysValid = true;
ROWS.forEach((row) => {
  row.forEach((k) => {
    if (!k.code || !k.label || typeof k.w !== 'number') allKeysValid = false;
  });
});
assert(allKeysValid, '所有键都有 code/label/w 字段');

console.log('\n=== 统计引擎 ===');
const s = new StatsEngine();
s.pressKey('KeyA');
s.pressKey('KeyA');
s.pressKey('KeyS');
assertEqual(s.keyCount['KeyA'], 2, 'KeyA 按下 2 次');
assertEqual(s.keyCount['KeyS'], 1, 'KeyS 按下 1 次');
assertEqual(s.totalKeys, 3, '总按键数 = 3');
assertEqual(s.maxCount(), 2, '最大单键计数 = 2');

s.clickMouse('left');
s.clickMouse('left');
s.clickMouse('right');
assertEqual(s.mouseClick.left, 2, '左键点击 2 次');
assertEqual(s.mouseClick.right, 1, '右键点击 1 次');
assertEqual(s.mouseClick.middle, 0, '中键未点击');

s.wheelScroll('up');
s.wheelScroll('up');
s.wheelScroll('down');
assertEqual(s.wheel.up, 2, '滚轮上 2 次');
assertEqual(s.wheel.down, 1, '滚轮下 1 次');

s.moveMouse(3, 4); // 距离 5
s.moveMouse(0, 5); // 距离 5
assert(Math.abs(s.distance - 10) < 0.001, '鼠标移动距离 = 10');

// 非法按钮忽略
s.clickMouse('unknown');
assertEqual(s.mouseClick.left, 2, '非法按钮不影响计数');
s.wheelScroll('sideways');
assertEqual(s.wheel.up, 2, '非法滚轮方向不影响计数');

// Top keys
const top = s.topKeys(2);
assertEqual(top[0].code, 'KeyA', 'Top1 = KeyA');
assertEqual(top[0].count, 2, 'Top1 count = 2');
assertEqual(top[1].code, 'KeyS', 'Top2 = KeyS');

// 序列化/反序列化往返
const json = s.toJSON();
const s2 = StatsEngine.fromJSON(json);
assertEqual(s2.totalKeys, 3, '反序列化后 totalKeys = 3');
assertEqual(s2.keyCount['KeyA'], 2, '反序列化后 KeyA = 2');
assertEqual(s2.mouseClick.left, 2, '反序列化后 左键 = 2');
assertEqual(s2.distance, 10, '反序列化后 distance = 10');

// fromJSON 容错
const s3 = StatsEngine.fromJSON(null);
assertEqual(s3.totalKeys, 0, 'fromJSON(null) 返回空实例');
const s4 = StatsEngine.fromJSON({});
assertEqual(s4.totalKeys, 0, 'fromJSON({}) 返回空实例');

// totalKeys 校正：如果 keyCount 总和大于 totalKeys
const s5 = StatsEngine.fromJSON({ keyCount: { KeyA: 5 }, totalKeys: 2 });
assertEqual(s5.totalKeys, 5, 'totalKeys 自动校正为 keyCount 总和');

// reset
s.reset();
assertEqual(s.totalKeys, 0, 'reset 后 totalKeys = 0');
assertEqual(Object.keys(s.keyCount).length, 0, 'reset 后 keyCount 为空');
assertEqual(s.mouseClick.left, 0, 'reset 后鼠标点击为 0');

console.log('\n=== 打字测试 ===');
const t = new TypingTest('abc');
assertEqual(t.text, 'abc', '文本 = abc');
assertEqual(t.accuracy(), 100, '初始准确率 100%');
assertEqual(t.wpm(), 0, '未开始 WPM = 0');

// 正确输入
let r1 = t.input('a');
assert(r1.ok, '输入 a 正确');
assertEqual(t.typed, 'a', 'typed = a');
assert(!t.finished, '未完成');

let r2 = t.input('x'); // 错误
assert(!r2.ok, '输入 x 错误');
assertEqual(t.errors, 1, '错误数 = 1');

t.input('b');
t.input('c');
assert(t.finished, '输入 abc 完成后 finished = true');
assertEqual(t.typed, 'abc', 'typed = abc');
// typed=3, errors=1 => accuracy = 3/4 = 75%
assertEqual(t.accuracy(), 75, '准确率 = 75%');

// 已完成后继续输入被拒绝
const before = t.typed;
t.input('d');
assertEqual(t.typed, before, '完成后输入被拒绝');

// 退格
const t2 = new TypingTest('hello');
t2.input('h');
t2.input('e');
t2.backspace();
assertEqual(t2.typed, 'h', '退格后 typed = h');
t2.backspace();
t2.backspace(); // 多退一次不越界
assertEqual(t2.typed, '', '退格到空');

// WPM 计算：输入 5 字符用 1 秒 => 60 WPM
const t3 = new TypingTest('hello');
t3.startTime = Date.now() - 1000;
t3.typed = 'hello';
t3.endTime = Date.now();
// words = 5/5 = 1, mins = 1/60 => wpm = 60
const wpm = t3.wpm();
assert(wpm >= 59 && wpm <= 61, `WPM 约 60 (实际 ${wpm})`);

// SAMPLES 非空
assert(SAMPLES.length > 0, '语料库非空');
assert(randomSample().length > 0, 'randomSample 返回非空字符串');

// 序列化往返
const tj = t.toJSON();
const t4 = TypingTest.fromJSON(tj);
assertEqual(t4.text, 'abc', '反序列化 text = abc');
assertEqual(t4.errors, 1, '反序列化 errors = 1');
assert(t4.finished, '反序列化 finished = true');

console.log('\n=== 数据存储 ===');
const tmpDir = os.tmpdir();
const tmpFile = path.join(tmpDir, `kt-test-${Date.now()}.json`);
const store = new Store(tmpFile);
store.stats.pressKey('KeyA');
store.stats.pressKey('KeyB');
store.stats.clickMouse('left');
store.addHistory({ wpm: 60, accuracy: 95, durationSec: 10, errors: 2, length: 50 });
store.save();

// 重新加载
const store2 = new Store(tmpFile);
assertEqual(store2.stats.keyCount['KeyA'], 1, '重新加载后 KeyA = 1');
assertEqual(store2.stats.keyCount['KeyB'], 1, '重新加载后 KeyB = 1');
assertEqual(store2.stats.mouseClick.left, 1, '重新加载后 左键 = 1');
assertEqual(store2.history.length, 1, '重新加载后历史 = 1 条');
assertEqual(store2.history[0].wpm, 60, '历史 wpm = 60');

// 清空
store.clearAll();
const store3 = new Store(tmpFile);
assertEqual(store3.stats.totalKeys, 0, '清空后 totalKeys = 0');
assertEqual(store3.history.length, 0, '清空后历史为空');

// 文件损坏容错
fs.writeFileSync(tmpFile, '{invalid json', 'utf-8');
const store4 = new Store(tmpFile);
assertEqual(store4.stats.totalKeys, 0, '文件损坏时返回空实例');

// 清理
try { fs.unlinkSync(tmpFile); } catch (e) {}

console.log('\n========================');
console.log(`通过 ${passed} · 失败 ${failed}`);
console.log('========================\n');
if (failed > 0) process.exit(1);
