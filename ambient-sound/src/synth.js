// synth.js - 环境音纯程序合成
// 所有声音通过 Web Audio API 实时数学合成，无需外部音频文件
// 生成 30 秒可无缝循环的 AudioBuffer，做首尾交叉淡化与峰值归一化
(function () {
  'use strict';

  // 声音元数据（与 renderer.js 共享）
  const SOUNDS = [
    { id: 'white',  name: '白噪音',  desc: '全频段均匀噪声' },
    { id: 'pink',   name: '粉噪音',  desc: '柔和衰减，放松专注' },
    { id: 'brown',  name: '棕噪音',  desc: '低频偏重，温暖助眠' },
    { id: 'rain',   name: '雨声',    desc: '细密雨幕，宁静沉浸' },
    { id: 'waves',  name: '海浪',    desc: '潮起潮落，舒缓呼吸' },
    { id: 'wind',   name: '风声',    desc: '林间微风，自然流动' },
    { id: 'fire',   name: '篝火',    desc: '噼啪燃烧，温暖夜话' },
    { id: 'stream', name: '溪流',    desc: '潺潺流水，清澈轻灵' },
  ];

  const DURATION = 30;       // 30 秒循环缓冲区
  const TARGET_PEAK = 0.85;  // 峰值归一化目标
  const FADE_SECONDS = 0.3;  // 首尾交叉淡化时长

  // 构造 AudioBuffer（单声道）
  function makeBuffer(ctx, channelData) {
    const sr = ctx.sampleRate || 44100;
    const buf = ctx.createBuffer(1, channelData.length, sr);
    buf.getChannelData(0).set(channelData);
    return buf;
  }

  // 峰值归一化，防止削波
  function normalize(samples, target) {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    if (peak < 1e-6) return samples;
    const g = target / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= g;
    return samples;
  }

  // 首尾交叉淡化：把末尾 fadeOut 与开头 fadeIn 段叠加到开头，
  // 同时让末尾衰减为 0，确保 source.loop=true 切回开头时无咔嗒
  function crossfade(samples, sr) {
    const n = samples.length;
    const f = Math.min(Math.floor(sr * FADE_SECONDS), Math.floor(n / 4));
    if (f < 8) return samples;
    // 把末尾 f 个样本叠加到开头对应位置（淡入叠加）
    for (let i = 0; i < f; i++) {
      const t = i / f;            // 0 -> 1
      const tail = samples[n - f + i];
      samples[i] = samples[i] * t + tail * (1 - t);
    }
    // 让末尾 f 个样本也按 t 衰减（这样切回开头时再次叠加不会重复）
    for (let i = 0; i < f; i++) {
      const t = i / f;            // 0 -> 1（靠近末尾）
      samples[n - f + i] *= t;
    }
    return samples;
  }

  // ---------- 基础噪声 ----------

  function genWhite(n) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.random() * 2 - 1;
    return out;
  }

  // Voss-McCartney 粉噪音：多个频段独立更新，叠加得到 1/f 谱
  function genPink(n) {
    const out = new Float32Array(n);
    const numBands = 16;
    const values = new Array(numBands);
    for (let k = 0; k < numBands; k++) values[k] = Math.random() * 2 - 1;
    let counter = 0;
    for (let i = 0; i < n; i++) {
      // 根据 counter 末尾连续 0 的个数决定更新哪个频段
      let idx = 0;
      let c = counter;
      while ((c & 1) === 0 && idx < numBands - 1) { c >>= 1; idx++; }
      values[idx] = Math.random() * 2 - 1;
      let sum = 0;
      for (let k = 0; k < numBands; k++) sum += values[k];
      out[i] = sum / numBands;
      counter = (counter + 1) & 0xFFFF;
    }
    return out;
  }

  // 棕噪音：白噪音的漏式积分，强化低频
  function genBrown(n) {
    const out = new Float32Array(n);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      out[i] = last * 3.5;
    }
    return out;
  }

  // ---------- 滤波器 ----------

  // 一阶低通
  function lowpass(samples, sr, cutoff) {
    const out = new Float32Array(samples.length);
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sr;
    const a = dt / (rc + dt);
    let last = 0;
    for (let i = 0; i < samples.length; i++) {
      last = last + a * (samples[i] - last);
      out[i] = last;
    }
    return out;
  }

  // 一阶高通
  function highpass(samples, sr, cutoff) {
    const out = new Float32Array(samples.length);
    const rc = 1 / (2 * Math.PI * cutoff);
    const dt = 1 / sr;
    const a = rc / (rc + dt);
    let last = 0;
    let lastIn = 0;
    for (let i = 0; i < samples.length; i++) {
      const cur = samples[i];
      last = a * (last + cur - lastIn);
      out[i] = last;
      lastIn = cur;
    }
    return out;
  }

  // 带通 = 低通 + 高通
  function bandpass(samples, sr, low, high) {
    return highpass(lowpass(samples, sr, high), sr, low);
  }

  // ---------- 自然环境音 ----------

  // 雨声：白噪音 -> 高通 + 密度调制 + 随机雨滴脉冲
  function genRain(n, sr) {
    let s = genWhite(n);
    s = highpass(s, sr, 800);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // 多重 LFO 模拟雨幕密度起伏
      const lfo = 0.7 + 0.25 * Math.sin(2 * Math.PI * 1.2 * t)
                + 0.08 * Math.sin(2 * Math.PI * 2.7 * t + 0.5);
      out[i] = s[i] * lfo;
    }
    // 随机雨滴脉冲
    let i = Math.floor(Math.random() * sr * 0.1);
    while (i < n) {
      const dur = Math.floor(sr * 0.01);
      for (let j = 0; j < dur && i + j < n; j++) {
        const env = Math.exp(-j / (sr * 0.002));
        out[i + j] += (Math.random() * 2 - 1) * env * 0.3;
      }
      i += Math.floor(sr * (0.05 + Math.random() * 0.4));
    }
    return out;
  }

  // 海浪：棕噪音 -> 低通 + 10 秒潮汐包络
  function genWaves(n, sr) {
    let s = genBrown(n);
    s = lowpass(s, sr, 600);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const tide = Math.sin(2 * Math.PI * 0.1 * t) * 0.5 + 0.5; // 0..1, 10s 周期
      const env = Math.pow(tide, 1.5);
      out[i] = s[i] * (0.25 + 0.75 * env);
    }
    return out;
  }

  // 风声：粉噪音 -> 动态截止频率低通（模拟风忽强忽弱）
  function genWind(n, sr) {
    const s = genPink(n);
    const out = new Float32Array(n);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // 截止频率 200-1500 Hz，多重 LFO
      const cutoff = 400
        + 600 * (Math.sin(2 * Math.PI * 0.15 * t) * 0.5 + 0.5)
        + 200 * Math.sin(2 * Math.PI * 0.37 * t + 0.3);
      const rc = 1 / (2 * Math.PI * cutoff);
      const dt = 1 / sr;
      const a = dt / (rc + dt);
      last = last + a * (s[i] - last);
      out[i] = last * 1.4;
    }
    return out;
  }

  // 篝火：棕噪音底层 + 随机爆裂脉冲（噼啪声）
  function genFire(n, sr) {
    const bed = lowpass(genBrown(n), sr, 400);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = bed[i] * 0.5;
    let i = 0;
    while (i < n) {
      const dur = Math.floor(sr * 0.008);
      const amp = 0.3 + Math.random() * 0.6;
      for (let j = 0; j < dur && i + j < n; j++) {
        const env = Math.exp(-j / (sr * 0.002));
        out[i + j] += (Math.random() * 2 - 1) * env * amp;
      }
      i += Math.floor(sr * (0.02 + Math.random() * 0.25));
    }
    return out;
  }

  // 溪流：粉噪音 -> 带通 + 双频调制包络
  function genStream(n, sr) {
    let s = genPink(n);
    s = bandpass(s, sr, 600, 3000);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const mod = 0.7
        + 0.2 * Math.sin(2 * Math.PI * 0.3 * t)
        + 0.1 * Math.sin(2 * Math.PI * 1.1 * t + 0.7);
      out[i] = s[i] * mod;
    }
    return out;
  }

  const GENERATORS = {
    white:  (n, sr) => genWhite(n),
    pink:   (n, sr) => genPink(n),
    brown:  (n, sr) => genBrown(n),
    rain:   (n, sr) => genRain(n, sr),
    waves:  (n, sr) => genWaves(n, sr),
    wind:   (n, sr) => genWind(n, sr),
    fire:   (n, sr) => genFire(n, sr),
    stream: (n, sr) => genStream(n, sr),
  };

  // 对外接口：为指定声音生成可循环的 AudioBuffer
  function generateBuffer(ctx, id) {
    const sr = ctx.sampleRate || 44100;
    const gen = GENERATORS[id];
    if (!gen) throw new Error('unknown sound id: ' + id);
    const n = Math.floor(sr * DURATION);
    let samples = gen(n, sr);
    if (!samples || samples.length !== n) throw new Error('synth failed: ' + id);
    samples = normalize(samples, TARGET_PEAK);
    samples = crossfade(samples, sr);
    return makeBuffer(ctx, samples);
  }

  // 暴露到全局（renderer.js 通过 window.AmbientSynth 访问）
  window.AmbientSynth = { SOUNDS, generateBuffer, DURATION, TARGET_PEAK };
})();
