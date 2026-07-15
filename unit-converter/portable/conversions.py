# -*- coding: utf-8 -*-
"""单位转换核心逻辑 - 支持 14 大类单位互转。
设计思路：每类设基准单位，普通单位用 factor（乘法）换算；
温度等非线性换算用 to_base / from_base 自定义函数。
移植自原 Electron 版 conversions.js，保证换算结果一致。
"""

from __future__ import annotations
import math


# ---- 自定义换算单元（温度）----------------------------------------------------
def _temp_c(v): return v
def _temp_c_from(v): return v
def _temp_f(v): return (v - 32) * 5 / 9
def _temp_f_from(v): return v * 9 / 5 + 32
def _temp_k(v): return v - 273.15
def _temp_k_from(v): return v + 273.15
def _temp_r(v): return (v - 491.67) * 5 / 9
def _temp_r_from(v): return v * 9 / 5 + 491.67


# 每个单位：name 显示名, factor 相对基准的倍数；
# 自定义类用 to_base / from_base 替代 factor
CATEGORIES = {
    "length": {
        "name": "长度", "icon": "📏", "base": "m",
        "units": {
            "nm":  ("纳米 nm", 1e-9),
            "um":  ("微米 μm", 1e-6),
            "mm":  ("毫米 mm", 0.001),
            "cm":  ("厘米 cm", 0.01),
            "dm":  ("分米 dm", 0.1),
            "m":   ("米 m", 1),
            "km":  ("千米 km", 1000),
            "in":  ("英寸 in", 0.0254),
            "ft":  ("英尺 ft", 0.3048),
            "yd":  ("码 yd", 0.9144),
            "mi":  ("英里 mi", 1609.344),
            "nmi": ("海里 nmi", 1852),
            "li":  ("市里", 500),
            "chi": ("市尺", 1 / 3),
            "cun": ("市寸", 1 / 30),
        },
    },
    "weight": {
        "name": "重量", "icon": "⚖️", "base": "kg",
        "units": {
            "mg":    ("毫克 mg", 1e-6),
            "g":     ("克 g", 0.001),
            "kg":    ("千克 kg", 1),
            "t":     ("吨 t", 1000),
            "ct":    ("克拉 ct", 0.0002),
            "oz":    ("盎司 oz", 0.028349523125),
            "lb":    ("磅 lb", 0.45359237),
            "jin":   ("市斤", 0.5),
            "liang": ("市两", 0.05),
        },
    },
    "temperature": {
        "name": "温度", "icon": "🌡️", "base": "C", "custom": True,
        "units": {
            "C": ("摄氏度 °C", _temp_c, _temp_c_from),
            "F": ("华氏度 °F", _temp_f, _temp_f_from),
            "K": ("开尔文 K", _temp_k, _temp_k_from),
            "R": ("兰氏度 °R", _temp_r, _temp_r_from),
        },
    },
    "area": {
        "name": "面积", "icon": "📐", "base": "m2",
        "units": {
            "mm2":  ("平方毫米 mm²", 1e-6),
            "cm2":  ("平方厘米 cm²", 0.0001),
            "m2":   ("平方米 m²", 1),
            "km2":  ("平方千米 km²", 1e6),
            "ha":   ("公顷 ha", 1e4),
            "mu":   ("亩", 666.6666667),
            "qing": ("顷", 66666.66667),
            "in2":  ("平方英寸 in²", 0.00064516),
            "ft2":  ("平方英尺 ft²", 0.09290304),
            "yd2":  ("平方码 yd²", 0.83612736),
            "acre": ("英亩 acre", 4046.8564224),
            "muUK": ("英亩(亩)", 4046.8564224),
        },
    },
    "volume": {
        "name": "体积", "icon": "🧪", "base": "L",
        "units": {
            "mL":   ("毫升 mL", 0.001),
            "L":    ("升 L", 1),
            "m3":   ("立方米 m³", 1000),
            "cm3":  ("立方厘米 cm³", 0.001),
            "gal":  ("加仑(美) gal", 3.785411784),
            "qt":   ("夸脱(美) qt", 0.946352946),
            "pt":   ("品脱(美) pt", 0.473176473),
            "cup":  ("杯 cup", 0.2365882365),
            "floz": ("液量盎司 fl oz", 0.0295735295625),
            "tbsp": ("汤匙 tbsp", 0.01478676478125),
            "tsp":  ("茶匙 tsp", 0.00492892159375),
        },
    },
    "speed": {
        "name": "速度", "icon": "🚀", "base": "mps",
        "units": {
            "mps":  ("米/秒 m/s", 1),
            "kmh":  ("千米/时 km/h", 1 / 3.6),
            "mph":  ("英里/时 mph", 0.44704),
            "knot": ("节 knot", 0.514444444),
            "mach": ("马赫 mach", 340.3),
            "fps":  ("英尺/秒 ft/s", 0.3048),
        },
    },
    "data": {
        "name": "数据存储", "icon": "💾", "base": "B",
        "units": {
            "bit": ("比特 bit", 0.125),
            "B":   ("字节 B", 1),
            "KB":  ("千字节 KB", 1024),
            "MB":  ("兆字节 MB", 1048576),
            "GB":  ("吉字节 GB", 1073741824),
            "TB":  ("太字节 TB", 1099511627776),
            "PB":  ("拍字节 PB", 1125899906842624),
            "Kb":  ("千比特 Kb", 125),
            "Mb":  ("兆比特 Mb", 125000),
            "Gb":  ("吉比特 Gb", 125000000),
        },
    },
    "time": {
        "name": "时间", "icon": "⏱️", "base": "s",
        "units": {
            "ns":    ("纳秒 ns", 1e-9),
            "us":    ("微秒 μs", 1e-6),
            "ms":    ("毫秒 ms", 0.001),
            "s":     ("秒 s", 1),
            "min":   ("分 min", 60),
            "h":     ("时 h", 3600),
            "day":   ("天 day", 86400),
            "week":  ("周 week", 604800),
            "month": ("月(30天)", 2592000),
            "year":  ("年(365天)", 31536000),
        },
    },
    "pressure": {
        "name": "压力", "icon": "🎈", "base": "Pa",
        "units": {
            "Pa":   ("帕 Pa", 1),
            "kPa":  ("千帕 kPa", 1000),
            "MPa":  ("兆帕 MPa", 1e6),
            "GPa":  ("吉帕 GPa", 1e9),
            "bar":  ("巴 bar", 1e5),
            "mbar": ("毫巴 mbar", 100),
            "atm":  ("标准大气压 atm", 101325),
            "psi":  ("磅/平方英寸 psi", 6894.757293168),
            "mmHg": ("毫米汞柱 mmHg", 133.322368421),
            "torr": ("托 torr", 133.322368421),
        },
    },
    "energy": {
        "name": "能量", "icon": "⚡", "base": "J",
        "units": {
            "J":    ("焦耳 J", 1),
            "kJ":   ("千焦 kJ", 1000),
            "cal":  ("卡 cal", 4.184),
            "kcal": ("千卡 kcal", 4184),
            "Wh":   ("瓦时 Wh", 3600),
            "kWh":  ("千瓦时 kWh", 3.6e6),
            "eV":   ("电子伏 eV", 1.602176634e-19),
            "BTU":  ("英热 BTU", 1055.05585262),
            "ftlb": ("英尺磅 ft·lb", 1.3558179483314),
        },
    },
    "power": {
        "name": "功率", "icon": "🔧", "base": "W",
        "units": {
            "mW":    ("毫瓦 mW", 0.001),
            "W":     ("瓦 W", 1),
            "kW":    ("千瓦 kW", 1000),
            "MW":    ("兆瓦 MW", 1e6),
            "hp":    ("马力(公制) hp", 735.49875),
            "hpUK":  ("马力(英制) hp", 745.6998715822702),
            "kcalh": ("千卡/时", 1.1622222222),
        },
    },
    "angle": {
        "name": "角度", "icon": "📐", "base": "deg",
        "units": {
            "deg":    ("度 °", 1),
            "rad":    ("弧度 rad", 57.29577951308232),
            "grad":   ("梯度 grad", 0.9),
            "arcmin": ("角分 ′", 1 / 60),
            "arcsec": ("角秒 ″", 1 / 3600),
            "turn":   ("转 turn", 360),
        },
    },
    "frequency": {
        "name": "频率", "icon": "📡", "base": "Hz",
        "units": {
            "mHz": ("毫赫 mHz", 0.001),
            "Hz":  ("赫兹 Hz", 1),
            "kHz": ("千赫 kHz", 1000),
            "MHz": ("兆赫 MHz", 1e6),
            "GHz": ("吉赫 GHz", 1e9),
            "THz": ("太赫 THz", 1e12),
            "rpm": ("转/分 rpm", 1 / 60),
        },
    },
    "datarate": {
        "name": "数据传输", "icon": "📶", "base": "bps",
        "units": {
            "bps":  ("比特/秒 bps", 1),
            "Kbps": ("千比特/秒 Kbps", 1000),
            "Mbps": ("兆比特/秒 Mbps", 1e6),
            "Gbps": ("吉比特/秒 Gbps", 1e9),
            "Bps":  ("字节/秒 B/s", 8),
            "KBps": ("千字节/秒 KB/s", 8000),
            "MBps": ("兆字节/秒 MB/s", 8e6),
            "GBps": ("吉字节/秒 GB/s", 8e9),
        },
    },
}


def _unit_info(cat, key):
    """返回 (name, factor_or_tuple)"""
    u = cat["units"][key]
    return u[0], u[1] if not cat.get("custom") else (u[1], u[2])


def convert(category, value, from_unit, to_unit):
    """将 value 从 from_unit 转为 to_unit。"""
    cat = CATEGORIES.get(category)
    if cat is None:
        raise ValueError("未知类别: %s" % category)
    if from_unit not in cat["units"] or to_unit not in cat["units"]:
        raise ValueError("未知单位")
    if cat.get("custom"):
        to_base = cat["units"][from_unit][1]
        from_base = cat["units"][to_unit][2]
        return from_base(to_base(value))
    f_from = cat["units"][from_unit][1]
    f_to = cat["units"][to_unit][1]
    base_value = value * f_from
    return base_value / f_to


def format_number(num):
    """格式化数字：去多余尾零，极大极小用科学计数法。
    接近整数则取整，避免浮点误差长尾（如 999999999.99999988）。"""
    if not math.isfinite(num):
        return "—"
    if num == 0:
        return "0"
    ab = abs(num)
    if ab < 1e-6 or ab >= 1e15:
        return "%.6e" % num
    # 接近整数（相对误差 < 1e-9）则取整，消除浮点长尾
    ri = round(num)
    if ri != 0 and abs(num - ri) < 1e-9 * max(1.0, ab):
        return str(int(ri))
    fixed = round(num, 8)
    # 去尾零
    s = ("%.8f" % fixed).rstrip("0").rstrip(".")
    if s == "-0":
        s = "0"
    return s


def unit_display_name(category, key):
    return CATEGORIES[category]["units"][key][0]


def category_list():
    """返回 [(key, 'icon name'), ...] 保持顺序"""
    return [(k, v["icon"], v["name"]) for k, v in CATEGORIES.items()]
