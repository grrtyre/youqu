# -*- coding: utf-8 -*-
"""audio_engine.py - 多通道混音引擎（sounddevice 移植自 audio-engine.js）

负责：缓冲区准备、多路播放/停止、独立音量、主音量。
所有声音循环播放，平滑启停无咔嗒。基于 sounddevice 回调实时混音。
"""
import threading
import numpy as np

try:
    import sounddevice as sd
    _HAS_SD = True
except Exception:
    _HAS_SD = False

import synth

FADE_MS = 80          # 启停淡入淡出时长，避免咔嗒
SAMPLE_RATE = 44100
BLOCK_SIZE = 1024     # 每次回调的帧数


class SoundEngine:
    """多通道混音引擎，线程安全"""

    def __init__(self):
        self._lock = threading.Lock()
        # 预生成的缓冲区：id -> float32 numpy 数组
        self.buffers = {}
        # 播放状态：id -> { pos, volume, target_vol, fade }
        self.sources = {}
        # 独立音量
        self.volumes = {s["id"]: 0.6 for s in synth.SOUNDS}
        # 主音量
        self.master = 0.8
        self._prepared = False
        self._stream = None
        self._demo_mode = False

    def prepare(self):
        """后台预生成所有声音缓冲区（启动时调用）"""
        if self._prepared:
            return
        for s in synth.SOUNDS:
            try:
                self.buffers[s["id"]] = synth.generate_buffer(s["id"], SAMPLE_RATE)
            except Exception as e:
                print(f"[AmbientEngine] 合成失败 {s['id']}: {e}")
        self._prepared = True

    def start_output(self):
        """启动 sounddevice 输出流"""
        if not _HAS_SD or self._stream is not None:
            return False
        try:
            self._stream = sd.OutputStream(
                samplerate=SAMPLE_RATE,
                blocksize=BLOCK_SIZE,
                dtype="float32",
                channels=1,
                callback=self._audio_callback,
            )
            self._stream.start()
            return True
        except Exception as e:
            print(f"[AmbientEngine] 音频流启动失败: {e}")
            self._stream = None
            return False

    def stop_output(self):
        """停止音频输出流"""
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None

    def _audio_callback(self, outdata, frames, time_info, status):
        """sounddevice 回调：实时混音所有激活的声音"""
        # 输出缓冲区清零
        outdata[:] = 0
        if self._demo_mode:
            # 演示模式：生成模拟频谱用的伪数据，不真正播放
            return
        with self._lock:
            master = self.master
            to_remove = []
            for sid, src in self.sources.items():
                buf = self.buffers.get(sid)
                if buf is None:
                    to_remove.append(sid)
                    continue
                pos = src["pos"]
                vol = src["volume"]
                target = src["target_vol"]
                fade = src["fade"]
                # 计算淡入淡出系数
                fade_rate = 1.0 / (SAMPLE_RATE * FADE_MS / 1000)
                chunk = np.zeros(frames, dtype=np.float32)
                remaining = frames
                offset = 0
                while remaining > 0:
                    avail = min(remaining, len(buf) - pos)
                    seg = buf[pos:pos + avail]
                    # 逐帧应用淡变
                    for k in range(avail):
                        if vol < target:
                            vol = min(target, vol + fade_rate)
                        elif vol > target:
                            vol = max(target, vol - fade_rate)
                        chunk[offset + k] = seg[k] * vol
                    pos = (pos + avail) % len(buf)
                    offset += avail
                    remaining -= avail
                src["pos"] = pos
                src["volume"] = vol
                # 若已淡出到 0 且目标是 0，标记移除
                if target <= 0 and vol <= 0.001:
                    to_remove.append(sid)
                outdata[:, 0] += chunk * master
            for sid in to_remove:
                self.sources.pop(sid, None)
        # 防止削波
        np.clip(outdata, -1.0, 1.0, out=outdata)

    # ---- 播放控制 ----

    def play(self, sound_id):
        """播放某个声音（带淡入）"""
        if sound_id not in self.buffers:
            return
        with self._lock:
            self.sources[sound_id] = {
                "pos": 0,
                "volume": 0.0,
                "target_vol": self.volumes.get(sound_id, 0.6),
                "fade": 1,
            }

    def stop(self, sound_id):
        """停止某个声音（带淡出）"""
        with self._lock:
            src = self.sources.get(sound_id)
            if src:
                src["target_vol"] = 0.0

    def stop_all(self):
        """停止所有声音"""
        with self._lock:
            for src in self.sources.values():
                src["target_vol"] = 0.0

    def set_volume(self, sound_id, v):
        """设置独立音量"""
        self.volumes[sound_id] = v
        with self._lock:
            src = self.sources.get(sound_id)
            if src:
                src["target_vol"] = v

    def set_master(self, v):
        """设置主音量"""
        with self._lock:
            self.master = v

    def is_playing(self, sound_id):
        with self._lock:
            return sound_id in self.sources

    def active_ids(self):
        with self._lock:
            return list(self.sources.keys())

    def active_count(self):
        with self._lock:
            return len(self.sources)

    def set_demo_mode(self, on):
        self._demo_mode = on

    def get_rms(self):
        """获取当前输出 RMS（用于简易频谱可视化）"""
        with self._lock:
            if not self.sources:
                return 0.0
            total = 0.0
            count = 0
            for sid, src in self.sources.items():
                buf = self.buffers.get(sid)
                if buf is not None:
                    pos = src["pos"]
                    seg = buf[pos:pos + 256]
                    if len(seg) > 0:
                        total += np.sqrt(np.mean(seg ** 2)) * src["volume"]
                        count += 1
            return min(1.0, total * self.master / max(count, 1))
