using System;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Windows;
using AlarmManager.Portable.Core;
using AlarmManager.Portable.Models;
using Hardcodet.Wpf.TaskbarNotification;
using System.Windows.Controls;
using System.Windows.Media;

namespace AlarmManager.Portable
{
    /// <summary>
    /// 闹钟管家便携版 - 应用入口
    /// 职责：单实例锁、托盘常驻、全局热键 Ctrl+Alt+A、后台巡检触发、Apple 白主题
    /// </summary>
    public partial class App : Application
    {
        private static Mutex? _singleMutex;
        private const string MUTEX_NAME = "Global\\AlarmManager-Portable-SingleInstance-Mutex";

        public static TaskbarIcon? TrayIcon { get; private set; }
        public static MainWindow? MainWnd { get; private set; }
        public static GlobalHotkey? Hotkey { get; private set; }
        public static SoundSynth Synth { get; private set; } = new SoundSynth();
        public static AlarmData Data { get; set; } = new AlarmData();
        public static string DataFile => Store.DefaultFile;

        private System.Threading.Timer? _checkTimer;
        private long _lastCheckMs;
        private TriggerWindow? _triggerWnd;

        /// <summary>是否为演示模式（用于截图测试）</summary>
        public static bool IsDemoMode { get; private set; } = false;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // 检测 --demo 参数（演示模式：跳过单实例锁，预置示例闹钟，启动即显示窗口）
            foreach (var arg in e.Args)
            {
                if (string.Equals(arg, "--demo", StringComparison.OrdinalIgnoreCase))
                {
                    IsDemoMode = true;
                }
                else if (string.Equals(arg, "--test", StringComparison.OrdinalIgnoreCase))
                {
                    // 运行内部测试并退出
                    int failures = RunInternalTests();
                    MessageBox.Show($"核心逻辑测试完成：{failures} 项失败",
                        failures == 0 ? "✓ 测试通过" : "✗ 测试失败",
                        MessageBoxButton.OK,
                        failures == 0 ? MessageBoxImage.Information : MessageBoxImage.Warning);
                    Shutdown();
                    return;
                }
            }

            // 单实例锁（演示模式跳过）
            if (!IsDemoMode)
            {
                bool createdNew;
                _singleMutex = new Mutex(true, MUTEX_NAME, out createdNew);
                if (!createdNew)
                {
                    Shutdown();
                    return;
                }
            }

            // 加载数据
            Data = Store.Load(DataFile);
            // 演示模式：预置示例闹钟
            if (IsDemoMode && Data.Alarms.Count == 0)
            {
                Data.Alarms.Add(AlarmEngine.CreateAlarm("起床", 7, 0, true, new RepeatRule { Type = "daily" }));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("午休", 13, 30, true, new RepeatRule { Type = "weekdays" }));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("下班提醒", 18, 0, true, new RepeatRule { Type = "weekdays" }, "bell"));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("睡前", 22, 30, true, new RepeatRule { Type = "daily" }, "chime", 10, 5, 0.6));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("周日大扫除", 9, 0, true, new RepeatRule { Type = "custom", Weekdays = new[] { 0 } }));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("元宵节", 19, 0, true, new RepeatRule { Type = "lunar-annual", LunarMonth = 1, LunarDay = 15 }));
                Data.Alarms.Add(AlarmEngine.CreateAlarm("一次性提醒", 20, 30, false, new RepeatRule { Type = "once" }));
            }
            // 启动时重算所有闹钟的 nextTrigger（保证与系统时钟同步）
            foreach (var a in Data.Alarms)
            {
                if (a.Enabled) a.NextTrigger = AlarmEngine.NextTrigger(a);
            }
            Store.Save(Data, DataFile);

            // 初始化托盘图标
            InitTrayIcon();

            // 创建主窗口（演示模式启动即显示，否则隐藏仅托盘显示）
            MainWnd = new MainWindow();
            if (IsDemoMode)
            {
                MainWnd.Show();
                MainWnd.RefreshList();
            }
            else
            {
                MainWnd.Hide();
            }

            // 注册全局热键 Ctrl+Alt+A（演示模式跳过，避免与其他实例冲突）
            if (!IsDemoMode)
            {
                try
                {
                    Hotkey = new GlobalHotkey(MainWnd, OnHotkeyPressed);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine("[App] 注册热键失败: " + ex.Message);
                }
            }

            // 启动后台巡检定时器（每 5 秒检查一次，演示模式不触发）
            _lastCheckMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (!IsDemoMode)
            {
                _checkTimer = new System.Threading.Timer(_ => CheckAlarms(), null, 1000, 5000);
            }

            // 启动时检查系统通知（演示模式不弹通知）
            if (!IsDemoMode && Data.Settings.NotificationEnabled)
            {
                var startupTimer = new System.Threading.Timer(_ =>
                {
                    Dispatcher.BeginInvoke(new Action(() =>
                    {
                        TrayIcon?.ShowBalloonTip("闹钟管家便携版",
                            "已在后台运行，按 Ctrl+Alt+A 唤起窗口",
                            BalloonIcon.Info);
                    }));
                }, null, 2000, Timeout.Infinite);
            }
        }

        /// <summary>初始化系统托盘图标</summary>
        private void InitTrayIcon()
        {
            TrayIcon = new TaskbarIcon
            {
                Icon = CreateAppleWhiteIcon(),
                ToolTipText = "闹钟管家便携版",
                Visibility = Visibility.Visible,
            };
            // 右键菜单
            var menu = new ContextMenu();
            var miShow = new MenuItem { Header = "显示主窗口  Ctrl+Alt+A" };
            miShow.Click += (s, e) => ShowMainWindow();
            var miTrigger = new MenuItem { Header = "测试触发铃声" };
            miTrigger.Click += (s, e) => TestTrigger();
            var miExit = new MenuItem { Header = "退出" };
            miExit.Click += (s, e) => ExitApp();
            menu.Items.Add(miShow);
            menu.Items.Add(new Separator());
            menu.Items.Add(miTrigger);
            menu.Items.Add(new Separator());
            menu.Items.Add(miExit);
            TrayIcon.ContextMenu = menu;
            TrayIcon.TrayLeftMouseUp += (s, e) => ShowMainWindow();
        }

        /// <summary>用代码生成一个简洁的 16x16 蓝底白色闹钟图标</summary>
        private System.Drawing.Icon CreateAppleWhiteIcon()
        {
            // 优先使用嵌入资源中的图标（如果有），否则用代码绘制
            try
            {
                var bmp = new System.Drawing.Bitmap(32, 32);
                using (var g = System.Drawing.Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                    g.Clear(System.Drawing.Color.Transparent);
                    // 蓝色圆形底
                    using (var brush = new System.Drawing.SolidBrush(System.Drawing.ColorTranslator.FromHtml("#007aff")))
                    {
                        g.FillEllipse(brush, 1, 1, 30, 30);
                    }
                    // 白色时钟外圈
                    using (var pen = new System.Drawing.Pen(System.Drawing.Color.White, 2.2f))
                    {
                        g.DrawEllipse(pen, 8, 8, 16, 16);
                    }
                    // 白色时针 + 分针
                    using (var pen = new System.Drawing.Pen(System.Drawing.Color.White, 2.0f))
                    {
                        g.DrawLine(pen, 16, 16, 16, 11);
                        g.DrawLine(pen, 16, 16, 21, 16);
                    }
                }
                var handle = bmp.GetHicon();
                return System.Drawing.Icon.FromHandle(handle);
            }
            catch
            {
                return System.Drawing.SystemIcons.Application;
            }
        }

        /// <summary>全局热键触发 - 唤起/隐藏主窗口</summary>
        private void OnHotkeyPressed()
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                if (MainWnd == null) return;
                if (MainWnd.IsVisible)
                {
                    MainWnd.Hide();
                }
                else
                {
                    ShowMainWindow();
                }
            }));
        }

        /// <summary>显示主窗口并激活</summary>
        public static void ShowMainWindow()
        {
            if (MainWnd == null) return;
            MainWnd.Show();
            MainWnd.Activate();
            MainWnd.Topmost = true;
            MainWnd.Topmost = false;
            MainWnd.RefreshList();
        }

        /// <summary>触发测试铃声</summary>
        private void TestTrigger()
        {
            Dispatcher.BeginInvoke(new Action(() =>
            {
                Synth.Play("chime", Data.Settings.MaxVolume, 0);
                TrayIcon?.ShowBalloonTip("测试铃声", "正在播放风铃声...", BalloonIcon.Info);
                // 3 秒后停止
                var t = new System.Threading.Timer(_ => Dispatcher.BeginInvoke(new Action(() => Synth.Stop())), null, 3000, Timeout.Infinite);
            }));
        }

        /// <summary>后台巡检：触发到点闹钟</summary>
        private void CheckAlarms()
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            long lastCheck = _lastCheckMs;
            _lastCheckMs = now;

            var alarmsToFire = new System.Collections.Generic.List<Alarm>();
            lock (Data)
            {
                foreach (var a in Data.Alarms)
                {
                    if (AlarmEngine.ShouldFire(a, now, lastCheck))
                    {
                        alarmsToFire.Add(a);
                    }
                }
            }

            if (alarmsToFire.Count > 0)
            {
                Dispatcher.BeginInvoke(new Action(() =>
                {
                    foreach (var a in alarmsToFire)
                    {
                        FireAlarm(a);
                    }
                }));
            }
        }

        /// <summary>触发某个闹钟</summary>
        public void FireAlarm(Alarm alarm)
        {
            // 更新引擎状态
            AlarmEngine.AfterFired(alarm);
            Store.AppendLog(Data, new TriggerLog
            {
                Time = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                AlarmId = alarm.Id,
                Label = alarm.Label,
                Action = "fired"
            });
            Store.Save(Data, DataFile);

            // 播放铃声（带渐强）
            int fade = Data.Settings.VolumeFadeIn ? Data.Settings.VolumeFadeInDuration : 0;
            Synth.Play(alarm.Sound, alarm.Volume * Data.Settings.MaxVolume, fade);

            // 系统通知
            if (Data.Settings.NotificationEnabled && TrayIcon != null)
            {
                TrayIcon.ShowBalloonTip("⏰ 闹钟触发", alarm.Label + " - " + AlarmEngine.FormatTime(alarm.Hour, alarm.Minute),
                    BalloonIcon.Warning);
            }

            // 弹出触发窗口（置顶）
            Dispatcher.BeginInvoke(new Action(() =>
            {
                if (_triggerWnd != null)
                {
                    // 已有触发窗口，先关闭
                    _triggerWnd.Close();
                    _triggerWnd = null;
                }
                _triggerWnd = new TriggerWindow(alarm);
                _triggerWnd.Closed += (s, e) => _triggerWnd = null;
                if (Data.Settings.BringToFront)
                {
                    _triggerWnd.Topmost = true;
                }
                _triggerWnd.Show();
            }));

            // 刷新主窗口列表（如果可见）
            MainWnd?.RefreshList();
        }

        /// <summary>停止铃声并关闭触发窗口</summary>
        public void StopRinging()
        {
            Synth.Stop();
            _triggerWnd?.Close();
            _triggerWnd = null;
        }

        /// <summary>退出应用</summary>
        public void ExitApp()
        {
            Synth.Stop();
            Store.Save(Data, DataFile);
            _checkTimer?.Dispose();
            Hotkey?.Dispose();
            TrayIcon?.Dispose();
            _singleMutex?.ReleaseMutex();
            _singleMutex?.Dispose();
            Shutdown();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            try
            {
                Synth?.Dispose();
                Store.Save(Data, DataFile);
            }
            catch { }
            base.OnExit(e);
        }

        /// <summary>
        /// 内部核心逻辑测试（农历 + 闹钟引擎）
        /// 返回失败用例数，0 = 全部通过
        /// </summary>
        private int RunInternalTests()
        {
            int fails = 0;
            void Assert(bool cond, string name)
            {
                if (!cond)
                {
                    System.Diagnostics.Debug.WriteLine("[FAIL] " + name);
                    fails++;
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("[OK]   " + name);
                }
            }

            // ============ 农历转换测试 ============
            // 2024-02-10 = 农历甲辰(龙)年 正月初一
            var r1 = Lunar.SolarToLunar(2024, 2, 10);
            Assert(r1.Year == 2024 && r1.Month == 1 && r1.Day == 1, "2024-02-10 = 正月初一");
            Assert(r1.Animal == "龙", "2024 = 龙年");
            Assert(r1.GanZhi == "甲辰", "2024 = 甲辰");

            // 2024-06-10 = 农历五月初五（端午节）
            var r2 = Lunar.SolarToLunar(2024, 6, 10);
            Assert(r2.Month == 5 && r2.Day == 5, "2024-06-10 = 五月初五");

            // 2023-06-22 = 农历五月初五（端午节）
            var r3 = Lunar.SolarToLunar(2023, 6, 22);
            Assert(r3.Month == 5 && r3.Day == 5, "2023-06-22 = 五月初五");

            // 2024-09-17 = 农历八月十五（中秋节）
            var r4 = Lunar.SolarToLunar(2024, 9, 17);
            Assert(r4.Month == 8 && r4.Day == 15, "2024-09-17 = 八月十五");

            // 2025-01-29 = 农历正月初一（春节）
            var r5 = Lunar.SolarToLunar(2025, 1, 29);
            Assert(r5.Month == 1 && r5.Day == 1, "2025-01-29 = 正月初一");

            // 闰月测试：2025 年闰六月
            Assert(Lunar.LeapMonth(2025) == 6, "2025 闰六月");

            // 农历转公历：2024 农历正月初一 = 2024-02-10
            var s1 = Lunar.LunarToSolar(2024, 1, 1, false);
            Assert(s1.HasValue && s1.Value.Year == 2024 && s1.Value.Month == 2 && s1.Value.Day == 10, "农历2024正月初一 = 2024-02-10");

            // 农历转公历：2024 农历八月十五 = 2024-09-17
            var s2 = Lunar.LunarToSolar(2024, 8, 15, false);
            Assert(s2.HasValue && s2.Value.Year == 2024 && s2.Value.Month == 9 && s2.Value.Day == 17, "农历2024八月十五 = 2024-09-17");

            // ============ 闹钟引擎测试 ============
            // now = 2024-06-15 08:00 UTC = 2024-06-15 16:00 本地时区(UTC+8)
            long now = new DateTimeOffset(2024, 6, 15, 8, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();

            // 一次性闹钟：今天的未来时刻
            var once = AlarmEngine.CreateAlarm("once-test", 20, 0, true, new RepeatRule { Type = "once" });
            once.NextTrigger = AlarmEngine.NextTrigger(once, now);
            Assert(once.NextTrigger != null, "一次性闹钟未来时刻触发");

            // 一次性闹钟：今天的过去时刻 → null
            var pastOnce = AlarmEngine.CreateAlarm("past-once", 5, 0, true, new RepeatRule { Type = "once" });
            var nt = AlarmEngine.NextTrigger(pastOnce, now);
            Assert(nt == null, "一次性闹钟过去时刻 → null");

            // daily 闹钟
            var daily = AlarmEngine.CreateAlarm("daily", 9, 0, true, new RepeatRule { Type = "daily" });
            daily.NextTrigger = AlarmEngine.NextTrigger(daily, now);
            Assert(daily.NextTrigger != null, "daily 闹钟有下次触发");

            // weekdays 闹钟
            var wd = AlarmEngine.CreateAlarm("wd", 9, 0, true, new RepeatRule { Type = "weekdays" });
            wd.NextTrigger = AlarmEngine.NextTrigger(wd, now);
            Assert(wd.NextTrigger != null, "weekdays 闹钟有下次触发");

            // 自定义周几
            var custom = AlarmEngine.CreateAlarm("custom", 9, 0, true,
                new RepeatRule { Type = "custom", Weekdays = new[] { 0, 6 } });
            custom.NextTrigger = AlarmEngine.NextTrigger(custom, now);
            Assert(custom.NextTrigger != null, "custom 周末闹钟有下次触发");

            // 农历每年闹钟
            var lunarAnn = AlarmEngine.CreateAlarm("元宵", 19, 0, true,
                new RepeatRule { Type = "lunar-annual", LunarMonth = 1, LunarDay = 15 });
            lunarAnn.NextTrigger = AlarmEngine.NextTrigger(lunarAnn, now);
            Assert(lunarAnn.NextTrigger != null, "农历每年元宵节闹钟有下次触发");

            // 应该触发：nextTrigger 在区间内
            var fireTest = new Alarm
            {
                Hour = 9,
                Minute = 0,
                Enabled = true,
                Repeat = new RepeatRule { Type = "daily" },
                NextTrigger = now - 1000, // 1 秒前
            };
            Assert(AlarmEngine.ShouldFire(fireTest, now, now - 60000), "ShouldFire 在区间内");

            // 触发后 daily 应该计算下次
            AlarmEngine.AfterFired(fireTest, now);
            Assert(fireTest.NextTrigger != null && fireTest.NextTrigger > now, "AfterFired daily 计算下次");

            // 触发后 once 应该被禁用
            var onceFire = new Alarm
            {
                Hour = 9,
                Minute = 0,
                Enabled = true,
                Repeat = new RepeatRule { Type = "once" },
                NextTrigger = now - 1000,
            };
            AlarmEngine.AfterFired(onceFire, now);
            Assert(!onceFire.Enabled, "AfterFired once 禁用");

            // 贪睡：在 maxSnoozeCount 内返回 true
            var snoozeAlarm = new Alarm
            {
                SnoozeMinutes = 5,
                MaxSnoozeCount = 3,
                SnoozeCount = 0,
                NextTrigger = now - 1000,
            };
            Assert(AlarmEngine.Snooze(snoozeAlarm, now), "Snooze 第1次");
            Assert(snoozeAlarm.SnoozeCount == 1, "SnoozeCount=1");
            Assert(snoozeAlarm.NextTrigger == now + 5 * 60 * 1000, "Snooze nextTrigger=now+5min");

            // 贪睡：超过 maxSnoozeCount 返回 false
            snoozeAlarm.SnoozeCount = 3;
            Assert(!AlarmEngine.Snooze(snoozeAlarm, now), "Snooze 超过上限 → false");

            // ============ 描述函数测试 ============
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "daily" }) == "每天", "DescribeRepeat daily");
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "once" }) == "一次性", "DescribeRepeat once");
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "weekdays" }) == "工作日", "DescribeRepeat weekdays");
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "lunar-annual", LunarMonth = 1, LunarDay = 15 }).Contains("农历每年"), "DescribeRepeat lunar-annual");
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "lunar-annual", LunarMonth = 1, LunarDay = 15 }).Contains("正月"), "DescribeRepeat lunar-annual month");
            Assert(AlarmEngine.DescribeRepeat(new RepeatRule { Type = "lunar-annual", LunarMonth = 1, LunarDay = 15 }).Contains("十五"), "DescribeRepeat lunar-annual day");

            Assert(AlarmEngine.FormatTime(7, 30) == "07:30", "FormatTime");
            Assert(AlarmEngine.FormatTime(0, 0) == "00:00", "FormatTime 00:00");
            Assert(AlarmEngine.FormatTime(23, 59) == "23:59", "FormatTime 23:59");

            // ============ 存储测试 ============
            var tempFile = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "alarm-test-" + Guid.NewGuid().ToString("N") + ".json");
            try
            {
                var testData = new AlarmData();
                testData.Alarms.Add(AlarmEngine.CreateAlarm("test", 7, 0));
                Store.Save(testData, tempFile);
                var loaded = Store.Load(tempFile);
                Assert(loaded.Alarms.Count == 1, "Store save/load round-trip");
                Assert(loaded.Alarms[0].Label == "test", "Store round-trip label");
                Assert(loaded.Settings.MaxVolume > 0, "Store 默认 settings 合并");
            }
            finally
            {
                try { if (System.IO.File.Exists(tempFile)) System.IO.File.Delete(tempFile); } catch { }
                try { if (System.IO.File.Exists(tempFile + ".bak")) System.IO.File.Delete(tempFile + ".bak"); } catch { }
            }

            return fails;
        }
    }
}
