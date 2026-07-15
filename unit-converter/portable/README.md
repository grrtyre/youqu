# 📐 单位转换器 · 便携版

> 像输入法一样的体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

本便携版基于 [youqu/unit-converter](../) 原版重构，使用 **Python 3 + PySide6** 原生重写，无 Electron / 网页套壳，单 EXE 即开即用。

## ✨ 特性

| 特性 | 说明 |
| --- | --- |
| 🎈 全局热键 | `Ctrl + Shift + U` 一键唤起 / 隐藏 |
| 🫥 失焦自动隐藏 | 点击外部任意区域自动收起，不抢焦点 |
| 📌 系统托盘常驻 | 关闭窗口后驻留托盘，右键菜单退出 |
| 🪟 小巧界面 | 372 × 490，类输入法候选框尺寸 |
| 🧮 14 大类 124 单位 | 长度、重量、温度、面积、体积、速度、时间、数据、压力、功率、能量、角度、频率、燃料 |
| ⚡ 实时双向换算 | 输入即算，回车或按钮可互换源/目标单位 |
| 📋 一键复制结果 | 点击结果框即可复制到剪贴板 |
| 🎨 苹果白高端风格 | 白底浅灰填充、细腻阴影、系统字体、`#007aff` 蓝色强调 |

## 🚀 使用方法

1. 下载 [最新 Release](https://github.com/grrtyre/youqu/releases/tag/unit-converter-portable-v1.0.0) 中的 `unit-converter-portable.exe`
2. 双击运行（首次启动会创建托盘图标）
3. 任意场景下按 `Ctrl + Shift + U` 唤出界面
4. 选择类别 → 输入数值 → 自动显示换算结果
5. 失焦或再按热键即隐藏；右键托盘图标 → 退出

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + U` | 唤起 / 隐藏 |
| `Enter` | 互换源/目标单位 |
| `Esc` | 隐藏窗口 |

## 📁 项目结构

```
portable/
├── main.py                 # PySide6 主程序（窗口、热键、托盘、样式）
├── conversions.py          # 换算核心逻辑（14 类、124 单位）
├── test_conversions.py     # 单元测试
├── icon.ico                # 多尺寸图标（16/32/48/64/128/256）
└── README.md               # 本文件
```

## 🛠️ 从源码构建

```bash
# 环境要求：Python 3.10+，PySide6 6.5+
pip install PySide6 pyinstaller

# 构建
pyinstaller --onefile --noconsole --name "unit-converter-portable" \
  --icon icon.ico --add-data "icon.ico;." \
  --collect-all PySide6 main.py

# 产物：dist/unit-converter-portable.exe
```

## 🎨 设计语言

- 主色：`#007aff`（系统蓝）
- 背景：`#ffffff` / 填充 `#f5f5f7`
- 主文本：`#1d1d1f` / 次文本 `#6e6e73`
- 圆角：`10px`，细腻投影 `0 2 12 rgba(0,0,0,0.08)`
- 字体：系统默认无衬线（Segoe UI / PingFang SC / Microsoft YaHei UI）

## 📝 更新日志

### v1.0.0 （2026-07-15）
- 首个原生便携版
- 14 类 124 单位完整迁移自原版 Electron 实现
- 全局热键、失焦隐藏、托盘常驻三件套
- 苹果白高端风格 UI

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ☕

👉 [爱发电支持](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_
