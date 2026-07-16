# 🧮 计算器管家·便携版（原生 Python 重写）

> 苹果白高端风格的"输入法式"计算器小组件。全局热键唤起、失焦自动隐藏、系统托盘常驻、实时求值，像输入法一样融入系统。原生 Python + customtkinter 重写，非 Electron、非 PySide6。

## ✨ 与 PySide6 版本对比

| 特性 | PySide6 版本 | 本版本（customtkinter） |
|---|---|---|
| 体积 | 44 MB | **33 MB**（更轻量） |
| GUI 框架 | PySide6 (Qt) | customtkinter (Tkinter) |
| 启动 | 瞬间 | 瞬间 |
| 内存 | <10 MB | <10 MB |
| 代码结构 | 多文件模块 | 单文件（含全部逻辑） |
| 依赖 | PySide6 + PIL | customtkinter + PIL + pystray |

## 🎯 系统融入特性

- **全局热键唤起** —— `Ctrl+Alt+C` 随时唤出计算器，无需切窗口
- **失焦自动隐藏** —— 点击别处立刻消失，像输入法候选框
- **系统托盘常驻** —— 托盘图标 + 右键菜单（显示/退出），关闭即隐藏
- **小界面** —— 380×520 紧凑尺寸，三模式切换（科学/程序员/转换）
- **实时求值** —— 输入即计算，无需按等号
- **历史记录** —— 上下键浏览历史表达式
- **变量系统** —— 支持 `x = 5` 定义变量，持久化存储
- **单位转换** —— 10 大类单位互转（长度/质量/温度/面积/体积/速度/时间/数据/角度/能量）

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [CalculatorPortable.exe](./CalculatorPortable.exe) | 单文件便携版，免安装，33 MB |

> 下载后双击运行，无需安装任何运行时。

## 🚀 使用方式

1. 下载 `CalculatorPortable.exe`
2. 双击运行（无需安装）
3. 系统托盘出现计算器图标，应用已在后台运行
4. 任意时刻按 `Ctrl+Alt+C` 唤起计算器
5. 输入表达式，实时显示结果
6. 按 `Enter` 确认并复制结果到剪贴板
7. 按 `Esc` 清空或隐藏

## ⌨️ 操作示例

```
2 + 3 * 4              → 14
sin(pi/2)              → 1
sqrt(16)               → 4
5!                     → 120
x = 5                  → 已设置 x = 5
x * x + 1              → 26
0xFF + 0x01            → 256
1 km to mile           → 0.6214 mile
```

## 🎨 苹果白设计系统

- **主色**：#007AFF（苹果系统蓝）
- **背景**：#FFFFFF 主白 + #ECECEF 浅灰
- **文字**：#1D1D1F 主文字 + #86868B 次文字
- **按钮**：白底 + 1px 描边，浮在浅灰 keypad 上
- **强调**：蓝底白字（accent 按钮、Tab 选中态）
- **圆角**：12px 按钮、14px 卡片、16px Tab 胶囊
- **留白**：模块间 8-12px 呼吸感

> Mimo 审美评分：**8.2/10** 通过

## 🛠 技术栈

- **Python 3.12 + customtkinter** —— 原生 Tkinter 封装，非网页套壳
- **Windows API (ctypes)** —— RegisterHotKey 全局热键、PrintWindow 后台截图
- **pystray** —— 系统托盘常驻
- **PIL/Pillow** —— 托盘图标绘制、截图处理
- **自研表达式引擎** —— 词法分析 + Shunting Yard + RPN 求值
- **PyInstaller --onefile** —— 单 exe 便携分发，无运行时依赖

## 📁 文件结构

```
calculator-manager/portable/native/
├── CalculatorPortable.exe      # 单 exe 便携版（33 MB）
├── calc_portable_app.py        # 单文件源码（含全部逻辑）
└── README.md                   # 本文档
```

## 🔧 从源码构建

```bash
pip install customtkinter pillow pystray pyinstaller

pyinstaller --onefile --noconsole --name CalculatorPortable \
  --collect-all customtkinter \
  --hidden-import pystray --hidden-import PIL \
  --clean --noconfirm calc_portable_app.py
```

输出在 `dist/CalculatorPortable.exe`。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](../../../LICENSE) —— 可自由使用、修改、分发。
