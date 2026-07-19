using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using AlarmManager.Portable.Models;

namespace AlarmManager.Portable.Core
{
    /// <summary>
    /// 本地存储模块 - 移植自 alarm-manager/src/store.js
    /// 设计目标：原子写入、UTF-8 编码、自动备份、导入导出
    /// </summary>
    public static class Store
    {
        private static readonly JsonSerializerOptions JsonOpts = new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.Never,
        };

        /// <summary>
        /// 默认数据文件：%APPDATA%/alarm-manager-portable/alarms.json
        /// </summary>
        public static string DefaultFile
        {
            get
            {
                string baseDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                return Path.Combine(baseDir, "alarm-manager-portable", "alarms.json");
            }
        }

        public static AlarmData DefaultData() => new AlarmData();

        /// <summary>合并默认值与读取值（避免新字段缺失）</summary>
        public static AlarmData MergeWithDefaults(AlarmData? raw)
        {
            var baseData = DefaultData();
            if (raw == null) return baseData;
            return new AlarmData
            {
                Version = raw.Version == 0 ? baseData.Version : raw.Version,
                Alarms = raw.Alarms ?? new System.Collections.Generic.List<Alarm>(),
                Settings = MergeSettings(baseData.Settings, raw.Settings),
                Logs = (raw.Logs ?? new System.Collections.Generic.List<TriggerLog>())
                    .Skip(Math.Max(0, (raw.Logs?.Count ?? 0) - 200)).Take(200).ToList()
            };
        }

        private static AppSettings MergeSettings(AppSettings def, AppSettings? raw)
        {
            if (raw == null) return def;
            // 简单合并：raw 中存在的字段优先，缺失的用默认
            return new AppSettings
            {
                DefaultSound = string.IsNullOrEmpty(raw.DefaultSound) ? def.DefaultSound : raw.DefaultSound,
                DefaultSnoozeMinutes = raw.DefaultSnoozeMinutes == 0 ? def.DefaultSnoozeMinutes : raw.DefaultSnoozeMinutes,
                MaxSnoozeCount = raw.MaxSnoozeCount == 0 ? def.MaxSnoozeCount : raw.MaxSnoozeCount,
                VolumeFadeIn = raw.VolumeFadeIn,
                VolumeFadeInDuration = raw.VolumeFadeInDuration == 0 ? def.VolumeFadeInDuration : raw.VolumeFadeInDuration,
                MaxVolume = raw.MaxVolume <= 0 ? def.MaxVolume : raw.MaxVolume,
                NotificationEnabled = raw.NotificationEnabled,
                BringToFront = raw.BringToFront,
                AutoStartAtLogin = raw.AutoStartAtLogin,
            };
        }

        public static void EnsureDir(string file)
        {
            string dir = Path.GetDirectoryName(file);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        /// <summary>读取数据，失败返回默认值</summary>
        public static AlarmData Load(string? file = null)
        {
            file = file ?? DefaultFile;
            try
            {
                if (!File.Exists(file)) return DefaultData();
                string text = File.ReadAllText(file, Encoding.UTF8);
                var parsed = JsonSerializer.Deserialize<AlarmData>(text, JsonOpts);
                return MergeWithDefaults(parsed);
            }
            catch
            {
                return DefaultData();
            }
        }

        /// <summary>原子写入：写到 .tmp，再重命名 + 自动备份</summary>
        public static void Save(AlarmData data, string? file = null)
        {
            file = file ?? DefaultFile;
            EnsureDir(file);
            string text = JsonSerializer.Serialize(data, JsonOpts);
            string tmp = file + ".tmp";
            File.WriteAllText(tmp, text, new UTF8Encoding(false));
            try
            {
                if (File.Exists(file))
                {
                    string bak = file + ".bak";
                    File.Copy(file, bak, true);
                }
            }
            catch { /* 备份失败不影响保存 */ }
            File.Move(tmp, file, true);
        }

        /// <summary>添加日志，保留最近 200 条</summary>
        public static void AppendLog(AlarmData data, TriggerLog entry)
        {
            if (data.Logs == null) data.Logs = new System.Collections.Generic.List<TriggerLog>();
            data.Logs.Add(entry);
            if (data.Logs.Count > 200)
            {
                data.Logs = data.Logs.Skip(data.Logs.Count - 200).Take(200).ToList();
            }
        }

        /// <summary>导出 JSON</summary>
        public static string ExportJson(AlarmData data) => JsonSerializer.Serialize(data, JsonOpts);

        /// <summary>导入 JSON</summary>
        public static AlarmData ImportJson(string text)
        {
            var parsed = JsonSerializer.Deserialize<AlarmData>(text, JsonOpts);
            return MergeWithDefaults(parsed);
        }

        /// <summary>生成新闹钟 ID</summary>
        public static string NewId() =>
            "a_" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString("x") + "_" + Guid.NewGuid().ToString("N").Substring(0, 6);
    }
}
