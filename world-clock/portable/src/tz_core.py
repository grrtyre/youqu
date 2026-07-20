# -*- coding: utf-8 -*-
"""
世界时钟·便携版 —— 时区核心逻辑
移植自 world-clock/timezone-core.js，使用 Python 3.9+ 标准库 zoneinfo
所有函数纯函数无副作用，便于测试
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional


# 常用时区清单（城市 → IANA 时区名 → 国家/地区）
COMMON_TIMEZONES = [
    ("北京", "Asia/Shanghai", "中国"),
    ("上海", "Asia/Shanghai", "中国"),
    ("深圳", "Asia/Shanghai", "中国"),
    ("香港", "Asia/Hong_Kong", "中国香港"),
    ("台北", "Asia/Taipei", "中国台湾"),
    ("东京", "Asia/Tokyo", "日本"),
    ("首尔", "Asia/Seoul", "韩国"),
    ("新加坡", "Asia/Singapore", "新加坡"),
    ("曼谷", "Asia/Bangkok", "泰国"),
    ("雅加达", "Asia/Jakarta", "印尼"),
    ("孟买", "Asia/Kolkata", "印度"),
    ("迪拜", "Asia/Dubai", "阿联酋"),
    ("德黑兰", "Asia/Tehran", "伊朗"),
    ("莫斯科", "Europe/Moscow", "俄罗斯"),
    ("伊斯坦布尔", "Europe/Istanbul", "土耳其"),
    ("柏林", "Europe/Berlin", "德国"),
    ("巴黎", "Europe/Paris", "法国"),
    ("阿姆斯特丹", "Europe/Amsterdam", "荷兰"),
    ("伦敦", "Europe/London", "英国"),
    ("都柏林", "Europe/Dublin", "爱尔兰"),
    ("开罗", "Africa/Cairo", "埃及"),
    ("约堡", "Africa/Johannesburg", "南非"),
    ("纽约", "America/New_York", "美国"),
    ("华盛顿", "America/New_York", "美国"),
    ("迈阿密", "America/New_York", "美国"),
    ("多伦多", "America/Toronto", "加拿大"),
    ("芝加哥", "America/Chicago", "美国"),
    ("墨西哥城", "America/Mexico_City", "墨西哥"),
    ("丹佛", "America/Denver", "美国"),
    ("凤凰城", "America/Phoenix", "美国"),
    ("洛杉矶", "America/Los_Angeles", "美国"),
    ("旧金山", "America/Los_Angeles", "美国"),
    ("西雅图", "America/Los_Angeles", "美国"),
    ("温哥华", "America/Vancouver", "加拿大"),
    ("安克雷奇", "America/Anchorage", "美国"),
    ("夏威夷", "Pacific/Honolulu", "美国"),
    ("圣保罗", "America/Sao_Paulo", "巴西"),
    ("布宜诺斯艾利斯", "America/Argentina/Buenos_Aires", "阿根廷"),
    ("悉尼", "Australia/Sydney", "澳大利亚"),
    ("墨尔本", "Australia/Melbourne", "澳大利亚"),
    ("珀斯", "Australia/Perth", "澳大利亚"),
    ("奥克兰", "Pacific/Auckland", "新西兰"),
    ("斐济", "Pacific/Fiji", "斐济"),
]


# 默认选中的时区（去重后）
DEFAULT_ZONES = [
    ("北京", "Asia/Shanghai"),
    ("东京", "Asia/Tokyo"),
    ("伦敦", "Europe/London"),
    ("纽约", "America/New_York"),
    ("旧金山", "America/Los_Angeles"),
]


# 默认工作时段（当地时钟 9:00-18:00）
DEFAULT_WORK_HOURS = (9, 18)


@dataclass
class ZoneParts:
    year: int
    month: int   # 1-12
    day: int
    hour: int    # 0-23
    minute: int
    second: int
    weekday: str  # 周一/周二/...

    @property
    def hours_float(self) -> float:
        """0-23.999 的小时数"""
        return self.hour + self.minute / 60 + self.second / 3600


# 中文星期映射
_WEEKDAY_CN = {
    0: "周一", 1: "周二", 2: "周三", 3: "周四",
    4: "周五", 5: "周六", 6: "周日",
}


def _zoneinfo(tz_name: str) -> ZoneInfo:
    """缓存友好的 ZoneInfo 构造（ZoneInfo 内部已缓存键）"""
    return ZoneInfo(tz_name)


def get_zone_parts(tz_name: str, dt: Optional[datetime] = None) -> ZoneParts:
    """
    把 datetime 在某时区下的各部分字段解析出来
    dt 默认为当前 UTC 时间
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(_zoneinfo(tz_name))
    return ZoneParts(
        year=local.year,
        month=local.month,
        day=local.day,
        hour=local.hour,
        minute=local.minute,
        second=local.second,
        weekday=_WEEKDAY_CN[local.weekday()],
    )


def get_offset_minutes(tz_name: str, dt: Optional[datetime] = None) -> int:
    """
    获取某时区相对 UTC 的偏移（分钟）。东八区返回 480。
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    local = dt.astimezone(_zoneinfo(tz_name))
    offset = local.utcoffset()
    return int(offset.total_seconds() // 60)


def format_offset(minutes: int) -> str:
    """把偏移分钟转成 "UTC+8:00" 形式"""
    sign = "+" if minutes >= 0 else "-"
    abs_m = abs(minutes)
    h = abs_m // 60
    m = abs_m % 60
    return f"UTC{sign}{h}" + (f":{m:02d}" if m else "")


def get_hours_in_zone(tz_name: str, dt: Optional[datetime] = None) -> float:
    """获取某时区当前的小时数（含分钟小数，0-23.999）"""
    return get_zone_parts(tz_name, dt).hours_float


def format_in_zone(tz_name: str, dt: Optional[datetime] = None, fmt: str = "HH:mm") -> str:
    """
    把 datetime 格式化为某时区下的时间字符串
    支持占位符: YYYY MM DD HH mm ss W
    W 为中文星期（周一/周二/...）
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    p = get_zone_parts(tz_name, dt)
    return (
        fmt
        .replace("YYYY", f"{p.year:04d}")
        .replace("MM", f"{p.month:02d}")
        .replace("DD", f"{p.day:02d}")
        .replace("HH", f"{p.hour:02d}")
        .replace("mm", f"{p.minute:02d}")
        .replace("ss", f"{p.second:02d}")
        .replace("W", p.weekday)
    )


def is_daytime(tz_name: str, dt: Optional[datetime] = None) -> bool:
    """判断某时区在某时刻是白天还是夜晚（6:00-18:00 为白天）"""
    h = get_hours_in_zone(tz_name, dt)
    return 6 <= h < 18


def get_hour_diff(base_tz: str, target_tz: str, dt: Optional[datetime] = None) -> float:
    """
    计算两个时区在某时刻的小时差（带正负，base - target，单位小时）
    例：base=北京, target=纽约 → 返回 +13（北京比纽约快13小时）
    """
    base_off = get_offset_minutes(base_tz, dt)
    target_off = get_offset_minutes(target_tz, dt)
    return (base_off - target_off) / 60


def work_hours_to_utc(tz_name: str, work_hours: tuple, dt: Optional[datetime] = None) -> tuple:
    """
    把工作时段（当地时钟）转换成 UTC 区间（分钟）
    work_hours: (start, end) 如 (9, 18)
    返回 (start_utc, end_utc)（分钟，0-1440，可能跨天）
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    offset = get_offset_minutes(tz_name, dt)
    start_utc = (work_hours[0] * 60 - offset) % 1440
    end_utc = (work_hours[1] * 60 - offset) % 1440
    return start_utc, end_utc


def compute_overlap(zones, work_hours, dt: Optional[datetime] = None) -> list:
    """
    计算多个时区工作时段在 UTC 上的重叠区间
    zones: [(city, tz), ...]
    work_hours: (start, end)
    返回 [(start_utc, end_utc), ...]（UTC 分钟，已归一化到 [0,1440)，已合并）
    若无重叠返回 []
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if not zones:
        return []

    # 每个时区的工作时段在 UTC 上的区间（考虑跨天），展开到 [-1440, 2880]
    intervals_list = []
    for city, tz in zones:
        s, e = work_hours_to_utc(tz, work_hours, dt)
        if s < e:
            intervals_list.append([
                (s - 1440, e - 1440),
                (s, e),
                (s + 1440, e + 1440),
            ])
        else:
            # 跨天区间，拆成两段
            intervals_list.append([
                (s - 1440, 1440),
                (0, e),
                (s, 1440 + e),
                (1440, e + 1440),
            ])

    # 以 [0, 1440] 为种子，依次求交
    result = [(0, 1440)]
    for intervals in intervals_list:
        nxt = []
        for a_s, a_e in result:
            for b_s, b_e in intervals:
                s = max(a_s, b_s)
                e = min(a_e, b_e)
                if e > s:
                    nxt.append((s, e))
        result = nxt
        if not result:
            break

    # 归一化到 [0, 1440)
    normalized = [(s % 1440, e % 1440) for s, e in result]
    return _merge_intervals(normalized)


def _merge_intervals(intervals: list) -> list:
    """合并相邻/重叠区间（处理 end < start 的跨天情况）"""
    if not intervals:
        return []
    expanded = []
    for s, e in intervals:
        if s == e:
            continue
        if s < e:
            expanded.append((s, e))
        else:
            expanded.append((s, 1440))
            expanded.append((0, e))
    expanded.sort()
    merged = []
    for s, e in expanded:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    # 首尾相连
    if len(merged) >= 2 and merged[0][0] == 0 and merged[-1][1] == 1440:
        first = merged.pop(0)
        merged[-1] = (merged[-1][0], first[1])
    return merged


def utc_minutes_to_zone_hour(utc_minutes: float, tz_name: str, dt: Optional[datetime] = None) -> float:
    """把 UTC 分钟转换成参考时区的"墙上时间"小时数（0-23.999）"""
    if dt is None:
        dt = datetime.now(timezone.utc)
    offset = get_offset_minutes(tz_name, dt)
    local = (utc_minutes + offset) % 1440
    return local / 60


def utc_minutes_to_zone_time(utc_minutes: float, tz_name: str, dt: Optional[datetime] = None) -> str:
    """把 UTC 分钟转成参考时区的 HH:mm 字符串"""
    h = utc_minutes_to_zone_hour(utc_minutes, tz_name, dt)
    hh = int(h)
    mm = round((h - hh) * 60)
    if mm == 60:
        hh = (hh + 1) % 24
        mm = 0
    return f"{hh:02d}:{mm:02d}"


def convert_timestamp(ts: int, tz_name: str, fmt: str = "YYYY-MM-DD HH:mm:ss") -> str:
    """Unix 时间戳 → 指定时区的格式化字符串（秒/毫秒自动识别）"""
    ms = ts if ts > 10**12 else ts * 1000
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return format_in_zone(tz_name, dt, fmt)


def convert_iso(iso_str: str, tz_name: str, fmt: str = "YYYY-MM-DD HH:mm:ss") -> str:
    """ISO 字符串 → 指定时区格式化字符串"""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return format_in_zone(tz_name, dt, fmt)


def parse_local_input(value: str, tz_name: str) -> Optional[datetime]:
    """
    把 "YYYY-MM-DDTHH:mm" 本地输入框值，按指定时区解析成 UTC datetime
    """
    import re
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", value)
    if not m:
        return None
    y, mo, d, h, mi = (int(x) for x in m.groups())
    if not (y and mo and d):
        return None
    # 用该日期的"正午"估算 offset（避开 DST 切换临界点）
    guess = datetime(y, mo, d, 12, 0, 0, tzinfo=timezone.utc)
    offset = get_offset_minutes(tz_name, guess)
    naive = datetime(y, mo, d, h, mi, 0)
    return naive.replace(tzinfo=timezone.utc) - timedelta(minutes=offset)


def _hour_weight(h: float) -> float:
    """单个小时的权重（参考时区墙上时间）"""
    if 9 <= h < 12:
        return 1.0  # 上午黄金
    if 14 <= h < 18:
        return 1.0  # 下午黄金
    if 12 <= h < 14:
        return 0.55  # 午餐
    if 8 <= h < 9:
        return 0.6
    if 18 <= h < 19:
        return 0.6
    if 7 <= h < 8:
        return 0.3
    if 19 <= h < 20:
        return 0.3
    return 0.05  # 深夜/清晨


def golden_hour_score(start_h: float, end_h: float) -> float:
    """
    评估 [start, end]（参考时区墙上小时，可跨天）的"黄金度"
    """
    pts = 24
    span = end_h - start_h if end_h > start_h else end_h + 24 - start_h
    total = 0.0
    for i in range(pts):
        h = (start_h + span * i / pts) % 24
        total += _hour_weight(h)
    return total / pts


def rank_overlap_slots(overlap, ref_tz: str, dt: Optional[datetime] = None) -> list:
    """
    智能会议推荐：对重叠时段按"便利度"打分并排序
    overlap: compute_overlap 的返回值 [(start_utc, end_utc), ...]
    返回 [{start, end, full_day, score, label, start_hour, end_hour, dur_min}, ...]
    score 0~1，越高越好；label 为 "极佳"/"较好"/"勉强"
    """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if not overlap:
        return []
    result = []
    for s_utc, e_utc in overlap:
        full_day = (s_utc == 0 and e_utc == 1440) or (s_utc == e_utc)
        dur_min = 1440 if full_day else ((e_utc - s_utc) + (1440 if e_utc <= s_utc else 0))
        start_h = utc_minutes_to_zone_hour(s_utc, ref_tz, dt)
        end_h = utc_minutes_to_zone_hour(e_utc, ref_tz, dt)
        golden = golden_hour_score(start_h, end_h)
        dur_score = min(1.0, dur_min / 180)
        score = max(0.0, min(1.0, golden * 0.65 + dur_score * 0.35))
        if full_day or score >= 0.8:
            label = "极佳"
        elif score >= 0.5:
            label = "较好"
        else:
            label = "勉强"
        result.append({
            "start": s_utc, "end": e_utc,
            "full_day": full_day,
            "score": round(score, 2),
            "label": label,
            "start_hour": start_h,
            "end_hour": end_h,
            "dur_min": dur_min,
        })
    result.sort(key=lambda x: -x["score"])
    return result


def format_slot_local(slot, ref_tz: str, dt: Optional[datetime] = None) -> str:
    """把 UTC 时段在参考时区下格式化成 "HH:00–HH:00" """
    if dt is None:
        dt = datetime.now(timezone.utc)
    if slot.get("full_day"):
        return "全天可约"
    s = utc_minutes_to_zone_time(slot["start"], ref_tz, dt)
    e = utc_minutes_to_zone_time(slot["end"], ref_tz, dt)
    return f"{s}–{e}"


# Windows 时区名 → IANA 时区名映射（常见项）
_WINDOWS_TO_IANA = {
    "China Standard Time": "Asia/Shanghai",
    "Taipei Standard Time": "Asia/Taipei",
    "Hong Kong Standard Time": "Asia/Hong_Kong",
    "Tokyo Standard Time": "Asia/Tokyo",
    "Korea Standard Time": "Asia/Seoul",
    "Singapore Standard Time": "Asia/Singapore",
    "SE Asia Standard Time": "Asia/Bangkok",
    "W. Mongolia Standard Time": "Asia/Ulaanbaatar",
    "India Standard Time": "Asia/Kolkata",
    "Arabian Standard Time": "Asia/Dubai",
    "Iran Standard Time": "Asia/Tehran",
    "Russian Standard Time": "Europe/Moscow",
    "Turkey Standard Time": "Europe/Istanbul",
    "W. Europe Standard Time": "Europe/Berlin",
    "Romance Standard Time": "Europe/Paris",
    "GTB Standard Time": "Europe/Athens",
    "GMT Standard Time": "Europe/London",
    "Egypt Standard Time": "Africa/Cairo",
    "South Africa Standard Time": "Africa/Johannesburg",
    "Eastern Standard Time": "America/New_York",
    "Central Standard Time": "America/Chicago",
    "Mountain Standard Time": "America/Denver",
    "Pacific Standard Time": "America/Los_Angeles",
    "Alaskan Standard Time": "America/Anchorage",
    "Hawaiian Standard Time": "Pacific/Honolulu",
    "SA Eastern Standard Time": "America/Sao_Paulo",
    "AUS Eastern Standard Time": "Australia/Sydney",
    "W. Australia Standard Time": "Australia/Perth",
    "New Zealand Standard Time": "Pacific/Auckland",
    "UTC": "UTC",
}


# 本地时区名（用于"与本地时差"显示）
def get_local_tz_name() -> str:
    """
    获取本机时区 IANA 名（如 'Asia/Shanghai'）
    Windows 上 datetime.now().astimezone().tzinfo 可能返回 datetime.timezone，
    没有 .key 属性，需要兜底从注册表读取并映射到 IANA 名
    """
    tzinfo = datetime.now().astimezone().tzinfo
    key = getattr(tzinfo, "key", None)
    if key:
        return key
    # Windows 兜底：从注册表读 TimeZoneKeyName 并映射
    try:
        import winreg
        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SYSTEM\CurrentControlSet\Control\TimeZoneInformation",
        ) as k:
            name, _ = winreg.QueryValueEx(k, "TimeZoneKeyName")
            if name:
                # 直接是 IANA 名（部分 Windows 版本）
                if "/" in name:
                    return name
                # Windows 时区名 → IANA
                if name in _WINDOWS_TO_IANA:
                    return _WINDOWS_TO_IANA[name]
                # 未知，尝试在 COMMON_TIMEZONES 中按 tzname 模糊匹配
                for c, t, ct in COMMON_TIMEZONES:
                    try:
                        zi = ZoneInfo(t)
                        if datetime.now(zi).tzname() == datetime.now().astimezone().tzname():
                            return t
                    except Exception:
                        pass
    except Exception:
        pass
    # 最后兜底：在 COMMON_TIMEZONES 中找第一个偏移相同的
    try:
        local_off = datetime.now().astimezone().utcoffset()
        for c, t, ct in COMMON_TIMEZONES:
            try:
                zi_off = datetime.now(ZoneInfo(t)).utcoffset()
                if zi_off == local_off:
                    return t
            except Exception:
                pass
    except Exception:
        pass
    return "UTC"
