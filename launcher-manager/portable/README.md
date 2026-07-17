# Launcher Manager 便携版

> macOS Spotlight 风格的 Windows 快速应用启动器 —— **原生 PySide6 实现，无 Electron 依赖**。
> 按下 `Alt+Space` 唤起，模糊搜索已安装应用，回车秒开。

![platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![PySide6](https://img.shields.io/badge/PySide6-6.11-41CD52?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![version](https://img.shields.io/badge/version-1.0.0--portable-007aff?style=flat-square)

---

## ✨ 便携版特性

- 🪶 **原生轻量** —— Python + PySide6 原生实现，无 Electron 套壳，启动快、内存低
- ⚡ **全局热键唤起** —— 任意位置按 `Alt+Space`，唤起搜索框，不打断当前工作流
- 🔍 **智能模糊搜索** —— 子序列匹配 + 连续加分 + 词边界加分，输入即命中
- 📚 **自动索引本地应用** —— 扫描开始菜单、桌面等 `.lnk` / `.url` / `.exe`
- 🕘 **最近使用排序** —— 记录启动次数与时间，常用应用自动置顶
- 🎨 **苹果白高端风格** —— 浅色背景、细腻多层阴影、系统字体、`#007aff` 强调色
- 📌 **系统融入** —— 系统托盘常驻、失焦自动隐藏、像输入法一样即用即隐
- ⌨️ **全键盘操作** —— `↑↓` 选择、`Enter` 启动、`Esc` 关闭

---

## 📦 下载

| 类型 | 说明 | 链接 |
| --- | --- | --- |
| 🟢 便携版 | 单文件 EXE，免安装即用 | [Releases](../../releases) |

> 最低系统要求：Windows 10 1809+

---

## 🚀 快速开始

### 使用便携版 EXE
1. 从 [Releases](../../releases) 下载 `LauncherManager-Portable.exe`
2. 双击运行，启动器自动驻留系统托盘
3. 按下 `Alt+Space` 唤起搜索框，输入应用名称，回车启动

### 源码运行
```bash
cd youqu/launcher-manager/portable
pip install -r requirements.txt
python launcher.py
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Alt + Space` | 全局唤起 / 隐藏搜索框 |
| `↑` / `↓` | 上下选择结果 |
| `Enter` | 启动选中应用 |
| `Esc` | 隐藏搜索框 |
| `鼠标悬停` | 选中对应项 |

---

## 🏗️ 项目结构

```
portable/
├── launcher.py          # 主程序：窗口、托盘、热键、UI
├── fuzzy_search.py      # 模糊搜索算法（子序列+连续+词边界）
├── app_indexer.py       # Windows 应用索引器
├── global_hotkey.py     # Win32 全局热键（RegisterHotKey + nativeEventFilter）
├── screenshot.py        # PrintWindow 后台截图工具（测试用）
├── build.bat            # PyInstaller 单文件打包脚本
├── requirements.txt     # Python 依赖
├── assets/
│   ├── icon.ico         # 应用图标 ICO
│   └── icon.png         # 应用图标 PNG
└── README.md            # 本文档
```

---

## 🔧 技术栈

- **Python 3.12** —— 原生运行，无 Web 引擎
- **PySide6 6.11** —— Qt6 Python 绑定，QSS 样式 + QGraphicsDropShadowEffect 多层阴影
- **Win32 API（ctypes）** —— RegisterHotKey 全局热键、PrintWindow 后台截图
- **QFileIconProvider** —— 系统应用图标提取
- **PyInstaller** —— 单文件 EXE 打包

---

## 📐 设计理念

像输入法一样的体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。
不是 Electron 外壳，不是网页套壳，是原生、轻量、贴系统的小组件。

---

## 📝 更新日志

### v1.0.0-portable
- 🎉 便携版首次发布（原生 PySide6 重写）
- 全局热键 `Alt+Space` 唤起
- 模糊搜索 + 最近使用排序
- 系统托盘常驻 + 失焦自动隐藏
- 苹果白高端 UI + 多层阴影

---

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡 ☕

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff5c5c?style=for-the-badge&logo=like&logoColor=white)](https://www.ifdian.net/a/giquwei)

**爱发电链接：** https://www.ifdian.net/a/giquwei

---

## 🙏 鸣谢
感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

---

## 📄 许可证

[MIT License](../LICENSE) © 2026 grrtyre
