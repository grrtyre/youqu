# -*- coding: utf-8 -*-
"""synth.py - 环境音纯程序合成（numpy 移植自 synth.js）

所有声音通过数学算法实时合成，生成 30 秒可无缝循环的缓冲区。
做首尾交叉淡化与峰值归一化，确保 source.loop 切回开头时无咔嗒。
"""
import numpy as np

# 声音元数据
SOUNDS = [
    {"id": "white",  "name": "白噪音", "desc": "全频段均匀噪声"},
    {"id": "pink",   "name": "粉噪音", "desc": "柔和衰减，放松专注"},
    {"id": "brown",  "name": "棕噪音", "desc": "低频偏重，温暖助眠"},
    {"id": "rain",   "name": "雨声",   "desc": "细密雨幕，宁静沉浸"},
    {"id": "waves",  "name": "海浪",   "desc": "潮起潮落，舒缓呼吸"},
    {"id": "wind",   "name": "风声",   "desc": "林间微风，自然流动"},
    {"id": "fire",   "name": "篝火",   "desc": "噼啪燃烧，温暖夜话"},
    {"id": "stream", "name": "溪流",   "desc": "潺潺流水，清澈轻灵"},
]

DURATION = 30        # 30 秒循环缓冲区
TARGET_PEAK = 0.85   # 峰值归一化目标
FADE_SECONDS = 0.3   # 首尾交叉淡化时长
SAMPLE_RATE = 44100


def normalize(samples, target=TARGET_PEAK):
    """峰值归一化，防止削波"""
    peak = np.max(np.abs(samples))
    if peak < 1e-6:
        return samples
    return samples * (target / peak)


def crossfade(samples, sr=SAMPLE_RATE, fade=FADE_SECONDS):
    """首尾交叉淡化：把末尾 fadeOut 与开头 fadeIn 段叠加到开头，
    同时让末尾衰减为 0，确保循环切回开头时无咔嗒。"""
    n = len(samples)
    f = min(int(sr * fade), n // 4)
    if f < 8:
        return samples
    t = np.linspace(0, 1, f, dtype=np.float32)
    tail = samples[n - f:n].copy()
    samples[:f] = samples[:f] * t + tail * (1 - t)
    samples[n - f:] *= t
    return samples


# ---------------- 基础噪声 ----------------

def gen_white(n, sr=SAMPLE_RATE):
    """均匀分布白噪音"""
    return np.random.uniform(-1, 1, n).astype(np.float32)


def gen_pink(n, sr=SAMPLE_RATE):
    """粉噪音：FFT 方法生成 1/f 频谱（比 Voss-McCartney 快 100 倍）

    生成白噪音 -> FFT -> 按 1/sqrt(f) 缩放 -> 逆 FFT，得到粉红噪音。
    """
    white = np.random.uniform(-1, 1, n).astype(np.float32)
    fft = np.fft.rfft(white)
    freqs = np.fft.rfftfreq(n, 1.0 / sr)
    freqs[0] = 1.0  # 避免 0 除
    fft *= 1.0 / np.sqrt(freqs)
    out = np.fft.irfft(fft, n).astype(np.float32)
    return out


def gen_brown(n, sr=SAMPLE_RATE):
    """棕噪音：白噪音的漏式积分，强化低频"""
    w = np.random.uniform(-1, 1, n).astype(np.float32)
    last = 0.0
    out = np.zeros(n, dtype=np.float32)
    for i in range(n):
        last = (last + 0.02 * w[i]) / 1.02
        out[i] = last * 3.5
    return out


# ---------------- 滤波器 ----------------

def lowpass(samples, sr, cutoff):
    """一阶低通滤波"""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / sr
    a = dt / (rc + dt)
    last = 0.0
    out = np.zeros(len(samples), dtype=np.float32)
    for i in range(len(samples)):
        last = last + a * (samples[i] - last)
        out[i] = last
    return out


def highpass(samples, sr, cutoff):
    """一阶高通滤波"""
    rc = 1.0 / (2 * np.pi * cutoff)
    dt = 1.0 / sr
    a = rc / (rc + dt)
    last = 0.0
    last_in = 0.0
    out = np.zeros(len(samples), dtype=np.float32)
    for i in range(len(samples)):
        cur = samples[i]
        last = a * (last + cur - last_in)
        out[i] = last
        last_in = cur
    return out


def bandpass(samples, sr, low, high):
    """带通 = 低通 + 高通"""
    return highpass(lowpass(samples, sr, high), sr, low)


# ---------------- 自然环境音 ----------------

def gen_rain(n, sr):
    """雨声：白噪音 -> 高通 + 密度调制 + 随机雨滴脉冲"""
    s = highpass(gen_white(n), sr, 800)
    t = np.arange(n, dtype=np.float32) / sr
    lfo = (0.7 + 0.25 * np.sin(2 * np.pi * 1.2 * t)
           + 0.08 * np.sin(2 * np.pi * 2.7 * t + 0.5))
    out = s * lfo
    # 随机雨滴脉冲
    i = int(np.random.uniform(0, sr * 0.1))
    while i < n:
        dur = int(sr * 0.01)
        j = np.arange(dur, dtype=np.float32)
        env = np.exp(-j / (sr * 0.002))
        end = min(i + dur, n)
        out[i:end] += (np.random.uniform(-1, 1, end - i) * env[:end - i]) * 0.3
        i += int(sr * (0.05 + np.random.uniform(0, 0.4)))
    return out


def gen_waves(n, sr):
    """海浪：棕噪音 -> 低通 + 10 秒潮汐包络"""
    s = lowpass(gen_brown(n), sr, 600)
    t = np.arange(n, dtype=np.float32) / sr
    tide = np.sin(2 * np.pi * 0.1 * t) * 0.5 + 0.5  # 0..1, 10s 周期
    env = np.power(tide, 1.5)
    return s * (0.25 + 0.75 * env)


def gen_wind(n, sr):
    """风声：粉噪音 -> 动态截止频率低通（模拟风忽强忽弱）"""
    s = gen_pink(n)
    t = np.arange(n, dtype=np.float32) / sr
    cutoff = (400
              + 600 * (np.sin(2 * np.pi * 0.15 * t) * 0.5 + 0.5)
              + 200 * np.sin(2 * np.pi * 0.37 * t + 0.3))
    out = np.zeros(n, dtype=np.float32)
    last = 0.0
    for i in range(n):
        rc = 1.0 / (2 * np.pi * cutoff[i])
        dt = 1.0 / sr
        a = dt / (rc + dt)
        last = last + a * (s[i] - last)
        out[i] = last * 1.4
    return out


def gen_fire(n, sr):
    """篝火：棕噪音底层 + 随机爆裂脉冲（噼啪声）"""
    bed = lowpass(gen_brown(n), sr, 400) * 0.5
    out = bed.copy()
    i = 0
    while i < n:
        dur = int(sr * 0.008)
        amp = 0.3 + np.random.uniform(0, 0.6)
        j = np.arange(dur, dtype=np.float32)
        env = np.exp(-j / (sr * 0.002))
        end = min(i + dur, n)
        out[i:end] += (np.random.uniform(-1, 1, end - i) * env[:end - i]) * amp
        i += int(sr * (0.02 + np.random.uniform(0, 0.25)))
    return out


def gen_stream(n, sr):
    """溪流：粉噪音 -> 带通 + 双频调制包络"""
    s = bandpass(gen_pink(n), sr, 600, 3000)
    t = np.arange(n, dtype=np.float32) / sr
    mod = (0.7
           + 0.2 * np.sin(2 * np.pi * 0.3 * t)
           + 0.1 * np.sin(2 * np.pi * 1.1 * t + 0.7))
    return s * mod


GENERATORS = {
    "white":  gen_white,
    "pink":   gen_pink,
    "brown":  gen_brown,
    "rain":   gen_rain,
    "waves":  gen_waves,
    "wind":   gen_wind,
    "fire":   gen_fire,
    "stream": gen_stream,
}


def generate_buffer(sound_id, sr=SAMPLE_RATE):
    """为指定声音生成可循环的 float32 numpy 缓冲区

    返回：归一化 + 交叉淡化后的 30 秒单声道缓冲区
    """
    gen = GENERATORS.get(sound_id)
    if gen is None:
        raise ValueError(f"未知声音 id: {sound_id}")
    n = int(sr * DURATION)
    samples = gen(n, sr)
    if len(samples) != n:
        raise RuntimeError(f"合成失败: {sound_id}")
    samples = normalize(samples)
    samples = crossfade(samples, sr)
    return np.ascontiguousarray(samples, dtype=np.float32)
