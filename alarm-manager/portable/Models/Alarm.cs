using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AlarmManager.Portable.Models
{
    /// <summary>
    /// 闹钟数据模型 - 与 Electron 版数据结构完全兼容
    /// </summary>
    public class Alarm
    {
        public string Id { get; set; } = "a_" + DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString("x") + "_" + Guid.NewGuid().ToString("N").Substring(0, 6);
        public string Label { get; set; } = "闹钟";
        public int Hour { get; set; } = 7;
        public int Minute { get; set; } = 0;
        public bool Enabled { get; set; } = true;
        public RepeatRule Repeat { get; set; } = new RepeatRule();
        public string Sound { get; set; } = "chime";
        public int SnoozeMinutes { get; set; } = 5;
        public int MaxSnoozeCount { get; set; } = 3;
        public double Volume { get; set; } = 0.9;
        public long? LastTriggered { get; set; }
        public long? NextTrigger { get; set; }
        public int SnoozeCount { get; set; } = 0;
        public long CreatedAt { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    /// <summary>
    /// 重复规则
    /// </summary>
    public class RepeatRule
    {
        /// <summary>
        /// once | daily | weekdays | weekend | custom | lunar-annual | lunar-once
        /// </summary>
        public string Type { get; set; } = "once";

        /// <summary>仅 type=custom 时使用，0=周日..6=周六</summary>
        public int[]? Weekdays { get; set; }

        /// <summary>仅 lunar-* 时使用，1..12</summary>
        public int LunarMonth { get; set; }

        /// <summary>仅 lunar-* 时使用，1..30</summary>
        public int LunarDay { get; set; }

        /// <summary>仅 lunar-once 时使用，公历年份</summary>
        public int? LunarYear { get; set; }

        /// <summary>是否闰月</summary>
        public bool IsLeap { get; set; }
    }

    /// <summary>
    /// 数据根对象
    /// </summary>
    public class AlarmData
    {
        public int Version { get; set; } = 1;
        public List<Alarm> Alarms { get; set; } = new();
        public AppSettings Settings { get; set; } = new();
        public List<TriggerLog> Logs { get; set; } = new();
    }

    public class AppSettings
    {
        public string DefaultSound { get; set; } = "chime";
        public int DefaultSnoozeMinutes { get; set; } = 5;
        public int MaxSnoozeCount { get; set; } = 3;
        public bool VolumeFadeIn { get; set; } = true;
        public int VolumeFadeInDuration { get; set; } = 15;
        public double MaxVolume { get; set; } = 0.9;
        public bool NotificationEnabled { get; set; } = true;
        public bool BringToFront { get; set; } = true;
        public bool AutoStartAtLogin { get; set; } = false;
    }

    public class TriggerLog
    {
        public long Time { get; set; }
        public string? AlarmId { get; set; }
        public string? Label { get; set; }
        public string? Action { get; set; } // fired | snoozed | dismissed
    }
}
