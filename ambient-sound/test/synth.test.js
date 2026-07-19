// test/synth.test.js - 合成算法单元测试
// 由于 synth.js 依赖浏览器 window/AudioContext，这里用 stub 加载并验证
// 运行：node test/synth.test.js
const fs = require('fs');
const path = require('path');

// ---------- 极简 AudioContext stub（仅支持 createBuffer）----------
class FakeBuffer {
  constructor(length, sampleRate) {
    this.length = length;
    this.sampleRate = sampleRate;
    this._data = new Float32Array(length);
  }
  getChannelData(ch) { return ch === 0 ? this._data : new Float32Array(this.length); }
}
class FakeCtx {
  constructor() { this.sampleRate = 44100; }
  createBuffer(ch, length, sr) { return new FakeBuffer(length, sr); }
}

// ---------- 加载 synth.js 到 fake window ----------
const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'synth.js'), 'utf8');
const fakeWindow = {};
const fn = new Function('window', code);
fn(fakeWindow);

const { SOUNDS, generateBuffer } = fakeWindow.AmbientSynth;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS:', msg); }
  else { fail++; console.error('  FAIL:', msg); }
}

console.log('Ambient Sound synth test');
console.log('------------------------');
console.log('Sound count:', SOUNDS.length);
assert(SOUNDS.length === 8, 'should have 8 sounds');

const ctx = new FakeCtx();
for (const s of SOUNDS) {
  const buf = generateBuffer(ctx, s.id);
  const data = buf.getChannelData(0);
  let hasNaN = false, peak = 0, sum = 0;
  for (let i = 0; i < data.length; i++) {
    if (Number.isNaN(data[i])) { hasNaN = true; break; }
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
    sum += a;
  }
  // 长度正确（30 秒）
  assert(buf.length === 44100 * 30, s.id + ' buffer length = 30s');
  // 无 NaN
  assert(!hasNaN, s.id + ' has no NaN');
  // 峰值在合理范围（归一化到 0.85 附近）
  assert(peak > 0.5 && peak <= 1.0, s.id + ' peak in [0.5, 1.0], got ' + peak.toFixed(3));
  // 首尾能量连续（无缝循环）：开头和结尾 100ms RMS 应相近
  const fadeN = Math.floor(44100 * 0.1);
  let headRms = 0, tailRms = 0;
  for (let i = 0; i < fadeN; i++) {
    headRms += data[i] * data[i];
    tailRms += data[data.length - fadeN + i] * data[data.length - fadeN + i];
  }
  headRms = Math.sqrt(headRms / fadeN);
  tailRms = Math.sqrt(tailRms / fadeN);
  const ratio = Math.min(headRms, tailRms) / Math.max(headRms, tailRms || 1e-6);
  assert(ratio > 0.3, s.id + ' head/tail RMS ratio > 0.3, got ' + ratio.toFixed(3));
}

console.log('------------------------');
console.log('Result: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
