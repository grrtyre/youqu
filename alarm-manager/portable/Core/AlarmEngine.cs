using System;
using System.Collections.Generic;
using System.Linq;
using AlarmManager.Portable.Models;

namespace AlarmManager.Portable.Core
{
    /// <summary>
    /// 闹钟调度引擎 - 移植自 alarm-manager/src/alarm-engine.js
    /// 纯函数模块，可在主进程和测试中复用
    /// </summary>
    public static class AlarmEngine
    {
        public static readonly string[] WEEKDAY_CN = { "日", "一", "二", "三", "四", "五", "六" };

        /// <summary>返回今天 0 点的 DateTime（本地时区）</summary>
        public static DateTime StartOfDay(DateTime date) =>
            new DateTime(date.Year, date.Month, date.Day, 0, 0, 0, DateTimeKind.Local);

        /// <summary>返回明天的 DateTime</summary>
        public static DateTime NextDay(DateTime date) => date.AddDays(1);

        /// <summary>构造今天的指定时刻</summary>
        public static DateTime TodayAt(DateTime date, int hour, int minute) =>
            new DateTime(date.Year, date.Month, date.Day, hour, minute, 0, DateTimeKind.Local);

        public static bool IsLeapYear(int y) => DateTime.IsLeapYear(y);

        public static int SolarDaysInMonth(int y, int m) => DateTime.DaysInMonth(y, m);

        public static bool SameDay(long a, long b)
        {
            DateTime da = DateTimeOffset.FromUnixTimeMilliseconds(a).LocalDateTime;
            DateTime db = DateTimeOffset.FromUnixTimeMilliseconds(b).LocalDateTime;
            return da.Year == db.Year && da.Month == db.Month && da.Day == db.Day;
        }

        /// <summary>计算下一次触发时间（基于 from，默认 now）</summary>
        public static long? NextTrigger(Alarm alarm, long? fromMs = null)
        {
            if (alarm == null || !alarm.Enabled) return null;
            long from = fromMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var rep = alarm.Repeat ?? new RepeatRule();
            string type = rep.Type ?? "once";

            // 当前本地时间
            DateTime fromLocal = DateTimeOffset.FromUnixTimeMilliseconds(from).LocalDateTime;

            switch (type)
            {
                case "once":
                    {
                        var candidate = TodayAt(fromLocal, alarm.Hour, alarm.Minute);
                        long candidateMs = new DateTimeOffset(candidate, TimeZoneInfo.Local.GetUtcOffset(candidate)).ToUnixTimeMilliseconds();
                        if (candidateMs < from) return null;
                        return candidateMs;
                    }
                case "daily":
                    return FindNextDaily(from, alarm.Hour, alarm.Minute, new[] { 0, 1, 2, 3, 4, 5, 6 });
                case "weekdays":
                    return FindNextDaily(from, alarm.Hour, alarm.Minute, new[] { 1, 2, 3, 4, 5 });
                case "weekend":
                    return FindNextDaily(from, alarm.Hour, alarm.Minute, new[] { 0, 6 });
                case "custom":
                    {
                        var wd = rep.Weekdays ?? Array.Empty<int>();
                        if (wd.Length == 0) return null;
                        return FindNextDaily(from, alarm.Hour, alarm.Minute, wd);
                    }
                case "lunar-annual":
                    return FindNextLunarAnnual(from, rep.LunarMonth, rep.LunarDay, rep.IsLeap, alarm.Hour, alarm.Minute);
                case "lunar-once":
                    {
                        int lunarYear = rep.LunarYear ?? fromLocal.Year;
                        return FindNextLunarOnce(from, lunarYear, rep.LunarMonth, rep.LunarDay, rep.IsLeap, alarm.Hour, alarm.Minute);
                    }
                default:
                    return null;
            }
        }

        private static long? FindNextDaily(long from, int hour, int minute, int[] weekdays)
        {
            DateTime fromLocal = DateTimeOffset.FromUnixTimeMilliseconds(from).LocalDateTime;
            DateTime d = fromLocal;
            for (int i = 0; i < 8; i++)
            {
                var candidate = TodayAt(d, hour, minute);
                long candidateMs = new DateTimeOffset(candidate, TimeZoneInfo.Local.GetUtcOffset(candidate)).ToUnixTimeMilliseconds();
                if (candidateMs > from && weekdays.Contains((int)candidate.DayOfWeek))
                {
                    return candidateMs;
                }
                d = NextDay(d);
            }
            return null;
        }

        private static long? FindNextLunarAnnual(long from, int lunarMonth, int lunarDay, bool isLeap, int hour, int minute)
        {
            int startYear = DateTimeOffset.FromUnixTimeMilliseconds(from).LocalDateTime.Year;
            for (int y = startYear; y < startYear + 5; y++)
            {
                try
                {
                    DateTime? solar;
                    if (isLeap)
                    {
                        if (Lunar.LeapMonth(y) != lunarMonth) continue;
                        solar = Lunar.LunarToSolar(y, lunarMonth, lunarDay, true);
                    }
                    else
                    {
                        solar = Lunar.LunarToSolar(y, lunarMonth, lunarDay, false);
                    }
                    if (solar == null) continue;
                    var candidate = new DateTime(solar.Value.Year, solar.Value.Month, solar.Value.Day, hour, minute, 0, DateTimeKind.Local);
                    long candidateMs = new DateTimeOffset(candidate, TimeZoneInfo.Local.GetUtcOffset(candidate)).ToUnixTimeMilliseconds();
                    if (candidateMs > from) return candidateMs;
                }
                catch { continue; }
            }
            return null;
        }

        private static long? FindNextLunarOnce(long from, int lunarYear, int lunarMonth, int lunarDay, bool isLeap, int hour, int minute)
        {
            try
            {
                var solar = Lunar.LunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap);
                if (solar == null) return null;
                var candidate = new DateTime(solar.Value.Year, solar.Value.Month, solar.Value.Day, hour, minute, 0, DateTimeKind.Local);
                long candidateMs = new DateTimeOffset(candidate, TimeZoneInfo.Local.GetUtcOffset(candidate)).ToUnixTimeMilliseconds();
                if (candidateMs > from) return candidateMs;
                return null;
            }
            catch { return null; }
        }

        /// <summary>判断某个闹钟在 [lastCheck, now] 区间内是否应该触发</summary>
        public static bool ShouldFire(Alarm alarm, long? nowMs = null, long? lastCheckMs = null)
        {
            if (alarm == null || !alarm.Enabled) return false;
            long now = nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            long lastCheck = lastCheckMs ?? alarm.LastTriggered ?? (now - 60000);
            var next = alarm.NextTrigger;
            if (next == null) return false;
            return next >= lastCheck && next <= now;
        }

        /// <summary>触发后：更新 lastTriggered，并计算新的 nextTrigger</summary>
        public static void AfterFired(Alarm alarm, long? firedAtMs = null)
        {
            long firedAt = firedAtMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            alarm.LastTriggered = firedAt;
            alarm.SnoozeCount = 0;
            string type = alarm.Repeat?.Type ?? "once";
            if (type == "once" || type == "lunar-once")
            {
                alarm.Enabled = false;
                alarm.NextTrigger = null;
            }
            else
            {
                alarm.NextTrigger = NextTrigger(alarm, firedAt + 1000);
            }
        }

        /// <summary>贪睡：增加 snoozeCount，nextTrigger = now + snoozeMinutes</summary>
        public static bool Snooze(Alarm alarm, long? nowMs = null)
        {
            long now = nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            int max = alarm.MaxSnoozeCount;
            if (alarm.SnoozeCount >= max) return false;
            alarm.SnoozeCount++;
            int mins = alarm.SnoozeMinutes;
            alarm.NextTrigger = now + mins * 60L * 1000L;
            return true;
        }

        /// <summary>取消贪睡：恢复到正常下一次触发</summary>
        public static void CancelSnooze(Alarm alarm, long? nowMs = null)
        {
            long now = nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            alarm.SnoozeCount = 0;
            alarm.NextTrigger = NextTrigger(alarm, now);
        }

        /// <summary>友好的重复模式描述</summary>
        public static string DescribeRepeat(RepeatRule? rep)
        {
            if (rep == null || string.IsNullOrEmpty(rep.Type)) return "一次性";
            switch (rep.Type)
            {
                case "once": return "一次性";
                case "daily": return "每天";
                case "weekdays": return "工作日";
                case "weekend": return "周末";
                case "custom":
                    {
                        if (rep.Weekdays == null || rep.Weekdays.Length == 0) return "自定义（未选）";
                        var list = rep.Weekdays.OrderBy(x => x).Select(w => "周" + WEEKDAY_CN[w]);
                        return "每周 " + string.Join("、", list);
                    }
                case "lunar-annual":
                    return "农历每年 " + (rep.IsLeap ? "闰" : "") + rep.LunarMonth + "月" + Lunar.DayName(rep.LunarDay);
                case "lunar-once":
                    return "农历 " + (rep.LunarYear?.ToString() ?? "") + "年" + (rep.IsLeap ? "闰" : "") + rep.LunarMonth + "月" + Lunar.DayName(rep.LunarDay);
                default: return "未知";
            }
        }

        /// <summary>友好的下次触发倒计时文本</summary>
        public static string DescribeCountdown(long? nextTs, long? nowMs = null)
        {
            long now = nowMs ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (nextTs == null) return "已停用";
            long diff = nextTs.Value - now;
            if (diff < 0) diff = 0;
            long days = diff / 86400000;
            long hours = (diff % 86400000) / 3600000;
            long mins = (diff % 3600000) / 60000;
            long secs = (diff % 60000) / 1000;
            if (days > 0) return days + "天 " + hours + "小时";
            if (hours > 0) return hours + "小时 " + mins + "分";
            if (mins > 0) return mins + "分 " + secs + "秒";
            return secs + "秒";
        }

        /// <summary>友好的下次触发时间文本</summary>
        public static string DescribeNextTime(long? nextTs)
        {
            if (nextTs == null) return "—";
            var d = DateTimeOffset.FromUnixTimeMilliseconds(nextTs.Value).LocalDateTime;
            var now = DateTime.Now;
            bool sameD = d.Year == now.Year && d.Month == now.Month && d.Day == now.Day;
            var tomorrow = now.AddDays(1);
            bool isTomorrow = d.Year == tomorrow.Year && d.Month == tomorrow.Month && d.Day == tomorrow.Day;
            string hh = d.Hour.ToString("D2");
            string mm = d.Minute.ToString("D2");
            if (sameD) return "今天 " + hh + ":" + mm;
            if (isTomorrow) return "明天 " + hh + ":" + mm;
            return (d.Month) + "月" + d.Day + "日 " + hh + ":" + mm;
        }

        /// <summary>创建新闹钟（带默认值）</summary>
        public static Alarm CreateAlarm(
            string? label = null,
            int? hour = null,
            int? minute = null,
            bool enabled = true,
            RepeatRule? repeat = null,
            string? sound = null,
            int? snoozeMinutes = null,
            int? maxSnoozeCount = null,
            double? volume = null)
        {
            var alarm = new Alarm
            {
                Label = string.IsNullOrEmpty(label) ? "闹钟" : label,
                Hour = hour ?? 7,
                Minute = minute ?? 0,
                Enabled = enabled,
                Repeat = repeat ?? new RepeatRule { Type = "once" },
                Sound = string.IsNullOrEmpty(sound) ? "chime" : sound,
                SnoozeMinutes = snoozeMinutes ?? 5,
                MaxSnoozeCount = maxSnoozeCount ?? 3,
                Volume = volume ?? 0.9,
            };
            alarm.NextTrigger = NextTrigger(alarm);
            return alarm;
        }

        /// <summary>当前小时与分钟（两位数）</summary>
        public static string FormatTime(int hour, int minute)
        {
            return hour.ToString("D2") + ":" + minute.ToString("D2");
        }
    }
}
