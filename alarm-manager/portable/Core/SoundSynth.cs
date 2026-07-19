using System;
using System.Threading;
using NAudio.Wave;

namespace AlarmManager.Portable.Core
{
    /// <summary>
    /// 铃声合成模块 - 用 NAudio 实时合成 5 种铃声（替代 Electron 版 Web Audio 合成）
    /// 支持：chime 风铃 / bell 钟声 / marimba 马林巴 / buzzer 蜂鸣 / birdsong 鸟鸣
    /// 支持：渐强音量、循环播放、停止
    /// </summary>
    public class SoundSynth : IDisposable
    {
        private WaveOutEvent? _waveOut;
        private ISampleProvider? _provider;
        private bool _disposed;

        /// <summary>当前是否正在播放</summary>
        public bool IsPlaying => _waveOut != null && _waveOut.PlaybackState == PlaybackState.Playing;

        /// <summary>当前音量（0..1）</summary>
        public float CurrentVolume { get; private set; } = 0f;

        /// <summary>目标最大音量</summary>
        public float TargetVolume { get; set; } = 0.9f;

        /// <summary>渐强秒数（0 = 立即达到目标音量）</summary>
        public int FadeInSeconds { get; set; } = 15;

        private readonly System.Threading.Timer? _fadeTimer;
        private DateTime _startTime;
        private float _startVolume;

        public SoundSynth()
        {
            // 渐强定时器（每 200ms 调整一次）
            _fadeTimer = new System.Threading.Timer(_ => TickFade(), null, Timeout.Infinite, Timeout.Infinite);
        }

        /// <summary>
        /// 开始播放指定铃声
        /// </summary>
        public void Play(string soundKey, double volume = 0.9, int fadeInSeconds = 15)
        {
            Stop();
            TargetVolume = (float)Math.Clamp(volume, 0, 1);
            FadeInSeconds = Math.Max(0, fadeInSeconds);
            CurrentVolume = 0f;
            _startVolume = 0f;
            _startTime = DateTime.UtcNow;

            var synth = new AlarmSoundProvider(soundKey, 44100);
            _provider = synth;
            _waveOut = new WaveOutEvent { DesiredLatency = 100 };
            _waveOut.Init(_provider);
            _waveOut.Volume = 0f;
            _waveOut.Play();

            if (FadeInSeconds > 0)
            {
                _fadeTimer?.Change(0, 200);
            }
            else
            {
                CurrentVolume = TargetVolume;
                if (_waveOut != null) _waveOut.Volume = TargetVolume;
            }
        }

        /// <summary>停止播放</summary>
        public void Stop()
        {
            _fadeTimer?.Change(Timeout.Infinite, Timeout.Infinite);
            if (_waveOut != null)
            {
                try { _waveOut.Stop(); } catch { }
                try { _waveOut.Dispose(); } catch { }
                _waveOut = null;
            }
            CurrentVolume = 0f;
        }

        private void TickFade()
        {
            try
            {
                if (_waveOut == null) return;
                double elapsed = (DateTime.UtcNow - _startTime).TotalSeconds;
                double ratio = FadeInSeconds > 0 ? Math.Min(1, elapsed / FadeInSeconds) : 1;
                float v = (float)(_startVolume + (TargetVolume - _startVolume) * EaseInOut(ratio));
                v = Math.Clamp(v, 0, 1);
                CurrentVolume = v;
                _waveOut.Volume = v;
                if (ratio >= 1)
                {
                    _fadeTimer?.Change(Timeout.Infinite, Timeout.Infinite);
                }
            }
            catch { }
        }

        private static double EaseInOut(double t) => t < 0.5 ? 2 * t * t : 1 - Math.Pow(-2 * t + 2, 2) / 2;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Stop();
            _fadeTimer?.Dispose();
        }
    }

    /// <summary>
    /// 5 种铃声的 NAudio 合成 Provider（无限循环）
    /// </summary>
    public class AlarmSoundProvider : ISampleProvider
    {
        public WaveFormat WaveFormat { get; }

        private readonly string _sound;
        private long _phase;
        private readonly Random _rng = new Random();
        private const double TwoPi = 2 * Math.PI;

        public AlarmSoundProvider(string sound, int sampleRate)
        {
            WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, 1);
            _sound = sound;
        }

        public int Read(float[] buffer, int offset, int count)
        {
            for (int i = 0; i < count; i++)
            {
                buffer[offset + i] = (float)Synth(_sound, _phase);
                _phase++;
            }
            return count;
        }

        /// <summary>
        /// 在 phase（采样序号）处的合成样本值，范围 -1..1
        /// </summary>
        private double Synth(string sound, long phase)
        {
            int sr = WaveFormat.SampleRate;
            double t = (double)phase / sr; // 秒
            switch (sound)
            {
                case "chime":
                    {
                        // 风铃：3 个高频正弦叠加，缓慢振幅调制
                        double baseFreq = 880;
                        double cycle = t % 4.0; // 4 秒周期
                        double env = Math.Exp(-cycle * 0.6) * (1 + 0.3 * Math.Sin(TwoPi * 0.5 * cycle));
                        double s = 0.4 * Math.Sin(TwoPi * baseFreq * t)
                                 + 0.3 * Math.Sin(TwoPi * baseFreq * 1.5 * t)
                                 + 0.2 * Math.Sin(TwoPi * baseFreq * 2.0 * t);
                        return s * env * 0.6;
                    }
                case "bell":
                    {
                        // 钟声：低频谐波 + 较慢衰减
                        double baseFreq = 440;
                        double cycle = t % 6.0; // 6 秒周期
                        double env = Math.Exp(-cycle * 0.35);
                        double s = 0.5 * Math.Sin(TwoPi * baseFreq * t)
                                 + 0.35 * Math.Sin(TwoPi * baseFreq * 2.76 * t)
                                 + 0.2 * Math.Sin(TwoPi * baseFreq * 5.4 * t);
                        return s * env * 0.7;
                    }
                case "marimba":
                    {
                        // 马林巴：暖音 + 中等衰减 + 节奏脉冲
                        double baseFreq = 523;
                        double cycle = t % 0.5; // 0.5 秒一次脉冲
                        double env = Math.Exp(-cycle * 6);
                        double s = 0.5 * Math.Sin(TwoPi * baseFreq * t)
                                 + 0.3 * Math.Sin(TwoPi * baseFreq * 2 * t)
                                 + 0.1 * Math.Sin(TwoPi * baseFreq * 3 * t);
                        return s * env * 0.6;
                    }
                case "buzzer":
                    {
                        // 蜂鸣：方波 + 中频 + 节奏
                        double baseFreq = 1000;
                        double cycle = t % 0.3;
                        double env = (cycle < 0.15) ? 1 : 0;
                        double square = Math.Sin(TwoPi * baseFreq * t) > 0 ? 1 : -1;
                        return square * env * 0.5;
                    }
                case "birdsong":
                    {
                        // 鸟鸣：扫频 + 包络脉冲
                        double baseFreq = 2200;
                        double cycle = t % 1.5;
                        double env;
                        if (cycle < 0.1) env = cycle / 0.1;
                        else if (cycle < 0.3) env = 1;
                        else if (cycle < 0.5) env = (0.5 - cycle) / 0.2;
                        else env = 0;
                        double freqMod = baseFreq + 600 * Math.Sin(TwoPi * 8 * t);
                        return Math.Sin(TwoPi * freqMod * t) * env * 0.5;
                    }
                default:
                    // 默认 880Hz 正弦
                    return 0.5 * Math.Sin(TwoPi * 880 * t);
            }
        }
    }
}
