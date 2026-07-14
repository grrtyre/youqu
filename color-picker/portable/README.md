# 拾色管家·便携版

> 像输入法一样的取色体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

[![平台](https://img.shields.io/badge/平台-Windows-blue?style=flat-square)](https://github.com/grrtyre/youqu)
[![技术栈](https://img.shields.io/badge/技术栈-Python+PySide6-green?style=flat-square)](https://www.qt.io/)
[![版本](https://img.shields.io/badge/版本-v1.0.0-orange?style=flat-square)](https://github.com/grrtyre/youqu/releases)
[![风格](https://img.shields.io/badge/风格-苹果白-lightgrey?style=flat-square)](#)

---

## 📥 下载

### 便携版单文件（推荐）

👉 [**点击下载 ColorPicker-Portable.exe**](https://github.com/grrtyre/youqu/releases/tag/color-picker-portable-v1.0.0)

- 单文件 exe，无需安装，双击即用
- 体积约 43MB，内存占用 <50MB
- Windows 10/11 64 位

### 源码

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/color-picker/portable
pip install -r requirements.txt
python src/main.py
```

---

## ✨ 功能特性

| 特性 | 说明 |
|------|------|
| 🎨 **屏幕取色** | 全局热键唤起，放大镜精准取色 |
| 📋 **多格式复制** | HEX / RGB / HSL 一键复制 |
| 📚 **历史记录** | 自动保存最近 50 条取色历史 |
| 🎯 **调色板管理** | 内置苹果系统色，支持增删 |
| 🔒 **单实例锁** | 防止多开，托盘常驻 |
| ⌨️ **全局热键** | Ctrl+Shift+C 随时唤起 |
| 🪟 **输入法式体验** | 失焦自动隐藏，不占桌面 |
| 🍎 **苹果白风格** | 白色/浅灰背景、细腻阴影、系统字体 |

---

## 🎨 效果截图

![拾色管家便携版主面板](./build/screenshot.png)

> 苹果白高端风格 · 380×500 紧凑面板 · 输入法式弹出体验

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+C` | 全局唤起取色 |
| `Esc` | 取消取色 / 隐藏面板 |
| `鼠标左键` | 确认取色 |
| `鼠标右键` | 取消取色 |
| `托盘单击` | 显示面板 |
| `托盘中键` | 开始取色 |

---

## 📁 项目结构

```
portable/
├── src/
│   ├── main.py            # 主程序入口（热键 + 托盘 + 单实例锁）
│   ├── panel.py           # 主面板 UI（380×500 弹出面板）
│   ├── picker_overlay.py  # 全屏取色覆盖层（放大镜）
│   ├── color_core.py      # 颜色核心逻辑（转换/存储/WCAG）
│   └── styles.py          # 苹果白 QSS 样式表
├── assets/
│   └── icon.ico           # 应用图标
├── build/
│   ├── screenshot.ps1     # 后台截图脚本（PrintWindow）
│   └── build_exe.ps1      # PyInstaller 构建脚本
├── tests/
│   └── test_core.py       # 78 项单元测试
├── requirements.txt       # PySide6==6.11.1
└── README.md
```

---

## 🛠️ 技术栈

- **Python 3.12** + **PySide6 6.11.1**（Qt 6 for Python）
- **Win32 API**（ctypes）：RegisterHotKey、PrintWindow、CreateMutex
- **PyInstaller**：单 exe 便携分发

### 为什么不用 Electron？

便携版追求极致轻量：内存 <50MB、单 exe 分发、秒级启动。Electron 动辄 100MB+ 内存、200MB+ 安装包，不符合"像输入法一样"的体验理念。

---

## 📝 更新日志

### v1.0.0（2026-07-14）

- 🎉 首个便携版发布
- 全局热键 Ctrl+Shift+C 唤起取色
- 输入法式弹出面板（380×500），失焦自动隐藏
- 系统托盘常驻，单实例锁
- HEX/RGB/HSL 多格式复制
- 历史记录（50 条）+ 苹果系统色调色板
- WCAG 2.1 对比度计算
- 苹果白高端风格 QSS
- 单 exe 便携分发（43MB）

---

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们继续开发更多优质软件：

👉 [**爱发电 · 支持我们**](https://www.ifdian.net/a/giquwei)

---

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

---

## 📄 许可证

MIT License © 2026 youqu
