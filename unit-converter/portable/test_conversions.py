# -*- coding: utf-8 -*-
"""转换逻辑冒烟测试 —— 验证移植正确性"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import conversions as C

fails = 0
def check(name, got, want, tol=1e-9):
    global fails
    ok = abs(got - want) < tol if isinstance(want, (int, float)) else got == want
    if not ok:
        fails += 1
        print("FAIL %s: got=%r want=%r" % (name, got, want))
    else:
        print("ok   %s -> %r" % (name, got))

# 长度
check("1m->cm", C.convert("length", 1, "m", "cm"), 100)
check("1km->mi", C.convert("length", 1, "km", "mi"), 1000/1609.344)
check("1mi->km", C.convert("length", 1, "mi", "km"), 1609.344/1000)
check("3chi->m", C.convert("length", 3, "chi", "m"), 1.0)
# 温度
check("0C->F", C.convert("temperature", 0, "C", "F"), 32)
check("100C->F", C.convert("temperature", 100, "C", "F"), 212)
check("0C->K", C.convert("temperature", 0, "C", "K"), 273.15)
check("32F->C", C.convert("temperature", 32, "F", "C"), 0)
check("273.15K->C", C.convert("temperature", 273.15, "K", "C"), 0)
check("C->C", C.convert("temperature", 25, "C", "C"), 25)
# 数据
check("1KB->B", C.convert("data", 1, "KB", "B"), 1024)
check("1MB->bit", C.convert("data", 1, "MB", "bit"), 8388608)
# 速度
check("1kmh->mps", C.convert("speed", 1, "kmh", "mps"), 1/3.6)
# 时间
check("1h->s", C.convert("time", 1, "h", "s"), 3600)
check("1day->h", C.convert("time", 1, "day", "h"), 24)
# 格式化
check("fmt 0", C.format_number(0), "0")
check("fmt 1.0", C.format_number(1.0), "1")
check("fmt 100", C.format_number(100), "100")
check("fmt 0.1", C.format_number(0.1), "0.1")
check("fmt big", C.format_number(1e16), "1.000000e+16")
check("fmt small", C.format_number(1e-8), "1.000000e-08")

print("\n类别数:", len(C.CATEGORIES), "期望 14")
print("总单位数:", sum(len(v["units"]) for v in C.CATEGORIES.values()))
print("\n%s" % ("全部通过" if fails == 0 else "失败 %d 项" % fails))
sys.exit(1 if fails else 0)
