// audio-engine.js - 多通道混音引擎
// 基于 Web Audio API，负责：缓冲区准备、多路播放/停止、独立音量、
// 主音量、频谱分析数据输出。所有声音循环播放，平滑启停无咔嗒。
(function () {
  'use strict';

  const FADE_MS = 80; // 启停淡入淡出时长，避免咔嗒

  class SoundEngine {
    constructor() {
      // AudioContext 可能因浏览器策略在 suspended 状态启动，需用户手势 resume
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio API not supported');
      this.ctx = new Ctor();

      // 主音量节点 -> 分析仪 -> 输出
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.78;

      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.buffers = {};   // id -> AudioBuffer
      this.sources = {};   // id -> { source, gain }
      this.volumes = {};   // id -> 0..1
      this._demoMode = false;
      this._prepared = false;
    }

    // 后台预生成所有声音缓冲区（启动时调用）
    async prepare() {
      if (this._prepared) return;
      const synth = window.AmbientSynth;
      if (!synth) throw new Error('AmbientSynth not loaded');
      for (const s of synth.SOUNDS) {
        try {
          this.buffers[s.id] = synth.generateBuffer(this.ctx, s.id);
          if (this.volumes[s.id] === undefined) this.volumes[s.id] = 0.6;
        } catch (e) {
          // 单个声音合成失败不阻断其他声音
          console.warn('[AmbientEngine] synth failed for', s.id, e);
        }
      }
      this._prepared = true;
    }

    resume() {
      if (this.ctx.state !== 'running') {
        try { return this.ctx.resume(); } catch (e) {}
      }
      return Promise.resolve();
    }

    // 播放某个声音（带淡入，避免咔嗒）
    play(id) {
      if (!this.buffers[id]) return;
      this._stopImmediate(id);
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers[id];
      source.loop = true;
      const gain = this.ctx.createGain();
      const vol = this.volumes[id] ?? 0.6;
      // 淡入：从 0 到目标值
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + FADE_MS / 1000);
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      this.sources[id] = { source, gain };
    }

    // 停止某个声音（带淡出）
    stop(id) {
      const s = this.sources[id];
      if (!s) return;
      const now = this.ctx.currentTime;
      try {
        s.gain.gain.cancelScheduledValues(now);
        s.gain.gain.setValueAtTime(s.gain.gain.value, now);
        s.gain.gain.linearRampToValueAtTime(0, now + FADE_MS / 1000);
        // 淡出后真正停止
        setTimeout(() => this._stopImmediate(id), FADE_MS + 10);
      } catch (e) {
        this._stopImmediate(id);
      }
    }

    _stopImmediate(id) {
      const s = this.sources[id];
      if (!s) return;
      try { s.source.stop(); } catch (e) {}
      try { s.source.disconnect(); } catch (e) {}
      try { s.gain.disconnect(); } catch (e) {}
      delete this.sources[id];
    }

    stopAll() {
      Object.keys(this.sources).forEach((id) => this.stop(id));
    }

    setVolume(id, v) {
      this.volumes[id] = v;
      const s = this.sources[id];
      if (s) {
        // 平滑过渡到新音量
        try {
          s.gain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05);
        } catch (e) {
          s.gain.gain.value = v;
        }
      }
    }

    setMaster(v) {
      try {
        this.master.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.05);
      } catch (e) {
        this.master.gain.value = v;
      }
    }

    isPlaying(id) { return !!this.sources[id]; }
    activeIds() { return Object.keys(this.sources); }
    activeCount() { return Object.keys(this.sources).length; }

    // 频谱数据（用于 renderer.js 的可视化）
    getFrequencyData() {
      const arr = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(arr);
      return arr;
    }
  }

  window.AmbientEngine = SoundEngine;
})();
