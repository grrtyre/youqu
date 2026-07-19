using System;
using System.Collections.Generic;

namespace AlarmManager.Portable.Core
{
    /// <summary>
    /// 农历转换模块 - 移植自 alarm-manager/src/lunar.js
    /// 范围：1900-2100 年
    /// 算法：经典农历查表法（基于 1900-2100 农历数据表）
    /// </summary>
    public static class Lunar
    {
        // 农历 1900-2100 年信息表
        // 每个 16 位整数编码一年农历信息：
        //   bit15-bit4（12 位）：当年农历各月大小，1=大月30天，0=小月29天
        //   bit3-bit0：闰月月份（0 表示无闰月）
        private static readonly int[] LUNAR_INFO = new int[]
        {
            0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
            0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
            0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
            0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
            0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
            0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
            0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
            0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
            0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
            0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
            0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
            0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
            0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
            0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
            0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
            0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
            0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
            0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
            0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
            0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
            0x0d520
        };

        private static readonly string[] MONTH_NAMES = { "正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊" };
        private static readonly string[] DAY_PREFIX = { "初", "十", "廿", "卅" };
        private static readonly string[] DAY_SUFFIX = { "", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十" };
        private static readonly string[] GAN = { "甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸" };
        private static readonly string[] ZHI = { "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥" };
        private static readonly string[] ANIMALS = { "鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪" };

        /// <summary>
        /// 1900-01-31 = 农历 1900 正月初一（基准日期）
        /// </summary>
        private static readonly DateTime BASE_DATE = new DateTime(1900, 1, 31);

        public static int LunarYearDays(int y)
        {
            int sum = 348;
            for (int i = 0x8000; i > 0x8; i >>= 1)
            {
                sum += (LUNAR_INFO[y - 1900] & i) != 0 ? 1 : 0;
            }
            return sum + LeapDays(y);
        }

        public static int LeapDays(int y)
        {
            if (LeapMonth(y) != 0)
            {
                return (LUNAR_INFO[y - 1900] & 0x10000) != 0 ? 30 : 29;
            }
            return 0;
        }

        public static int LeapMonth(int y)
        {
            return LUNAR_INFO[y - 1900] & 0xf;
        }

        public static int MonthDays(int y, int m)
        {
            return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) != 0 ? 30 : 29;
        }

        public static string MonthName(int m, bool isLeap)
        {
            return (isLeap ? "闰" : "") + MONTH_NAMES[m - 1] + "月";
        }

        public static string DayName(int d)
        {
            if (d == 10) return "初十";
            if (d == 20) return "二十";
            if (d == 30) return "三十";
            return DAY_PREFIX[(d - 1) / 10] + DAY_SUFFIX[d % 10];
        }

        public static string GanZhiYear(int y)
        {
            int offset = y - 4;
            return GAN[((offset % 10) + 10) % 10] + ZHI[((offset % 12) + 12) % 12];
        }

        public static string AnimalName(int y)
        {
            return ANIMALS[((y - 4) % 12 + 12) % 12];
        }

        public static string YearName(int y)
        {
            return GanZhiYear(y) + "(" + AnimalName(y) + ")年";
        }

        /// <summary>
        /// 公历转农历
        /// </summary>
        public static LunarResult SolarToLunar(int year, int month, int day)
        {
            if (year < 1900 || year > 2100)
                throw new ArgumentOutOfRangeException(nameof(year), "农历转换仅支持 1900-2100 年");

            int offset = (int)(new DateTime(year, month, day) - BASE_DATE).TotalDays;
            int y;
            int temp = 0;
            for (y = 1900; y < 2100 && offset > 0; y++)
            {
                temp = LunarYearDays(y);
                offset -= temp;
            }
            if (offset < 0)
            {
                offset += temp;
                y--;
            }

            int leap = LeapMonth(y);
            bool isLeap = false;
            int m = 1;
            int daysInMonth = 0;
            for (m = 1; m < 13 && offset > 0; m++)
            {
                if (leap > 0 && m == leap + 1 && !isLeap)
                {
                    m--;
                    isLeap = true;
                    daysInMonth = LeapDays(y);
                }
                else
                {
                    daysInMonth = MonthDays(y, m);
                }
                if (isLeap && m == leap + 1) isLeap = false;
                offset -= daysInMonth;
            }
            if (offset == 0 && leap > 0 && m == leap + 1)
            {
                if (isLeap) isLeap = false;
                else { isLeap = true; m--; }
            }
            if (offset < 0)
            {
                offset += daysInMonth;
                m--;
            }
            return new LunarResult
            {
                Year = y,
                Month = m,
                Day = offset + 1,
                IsLeap = isLeap,
                MonthName = MonthName(m, isLeap),
                DayName = DayName(offset + 1),
                YearName = YearName(y),
                Animal = AnimalName(y),
                GanZhi = GanZhiYear(y)
            };
        }

        /// <summary>
        /// 农历转公历
        /// </summary>
        public static DateTime? LunarToSolar(int year, int month, int day, bool isLeap)
        {
            if (year < 1900 || year > 2100) return null;
            int offset = 0;
            for (int y = 1900; y < year; y++)
            {
                offset += LunarYearDays(y);
            }
            int leap = LeapMonth(year);
            bool leapPassed = false;
            for (int m = 1; m < month; m++)
            {
                offset += MonthDays(year, m);
                if (m == leap && !leapPassed)
                {
                    offset += LeapDays(year);
                    leapPassed = true;
                }
            }
            if (isLeap && leap == month)
            {
                offset += MonthDays(year, month);
            }
            offset += day - 1;
            return BASE_DATE.AddDays(offset);
        }

        public static string LunarString(int year, int month, int day)
        {
            var l = SolarToLunar(year, month, day);
            return l.MonthName + l.DayName;
        }
    }

    public class LunarResult
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public int Day { get; set; }
        public bool IsLeap { get; set; }
        public string MonthName { get; set; } = "";
        public string DayName { get; set; } = "";
        public string YearName { get; set; } = "";
        public string Animal { get; set; } = "";
        public string GanZhi { get; set; } = "";
    }
}
