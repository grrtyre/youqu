# 代码片段管家 · 便携版

原生 PySide6 重写 —— 像输入法一样的代码片段速取小组件。

## 特性

- **全局热键** `Ctrl+Shift+S` 唤起/隐藏
- **失焦自动隐藏** - 输入法式体验，需要时出现，不需要时隐藏
- **系统托盘常驻** - 后台运行，不占桌面
- **小界面** 390×490，贴系统的小组件
- **苹果白高端风格** - 白色/浅灰背景、细腻阴影、系统字体、蓝色强调 #007aff
- **搜索 + 键盘导航** - 上下选择、回车复制粘贴
- **语法高亮预览** - 支持 10+ 语言
- **与原版数据格式完全兼容** - 可与 Electron 版互换数据

## 使用方式

### 方式一：下载便携版 EXE（推荐）

1. 从 [Releases](../../../../releases/tag/snippet-manager-portable-v1.0.0) 下载 `SnippetManager-Portable.exe`
2. 双击运行
3. 按 `Ctrl+Shift+S` 唤起窗口

### 方式二：从源码运行

```bash
pip install -r requirements.txt
python main.py
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+S` | 唤起/隐藏窗口 |
| `↑` `↓` | 选择片段 |
| `Enter` | 复制并自动粘贴 |
| `Esc` | 隐藏窗口 |

## 技术栈

- Python 3.12
- PySide6 6.x（Qt for Python）
- Windows API（RegisterHotKey / SendInput）
- PyInstaller（单 EXE 打包）

## 数据存储

数据文件位置：`%APPDATA%/SnippetManagerPortable/snippets.json`

与 Electron 原版格式完全兼容，可直接导入原版数据。

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们：

[爱发电](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_
