# 提示词速唤 · 便携版

> 输入法式提示词库 —— 像输入法一样，需要时出现，不需要时隐藏，融入系统。

[![style](https://img.shields.io/badge/风格-苹果白-007aff?style=flat-square)]()
[![tech](https://img.shields.io/badge/技术栈-Python%20%2B%20PySide6-3776ab?style=flat-square)]()
[![version](https://img.shields.io/badge/版本-v1.0.0-007aff?style=flat-square)]()
[![platform](https://img.shields.io/badge/平台-Windows%2010%2F11-007aff?style=flat-square)]()

便携版基于 [prompt-manager](../README.md) 原生重写，**不依赖 Electron**，单 EXE 即可运行。

## ✨ 核心特性

### 输入法式体验
- **全局热键唤起** —— 默认 `Ctrl+Shift+P`，随时调用，无需切窗口
- **失焦自动隐藏** —— 点击别处自动消失，不占桌面
- **系统托盘常驻** —— 后台常驻，资源占用极低
- **小界面（380×460）** —— 贴近鼠标出现，输入即搜，回车即复制

### 苹果白高端风格
- 浅灰背景 `#f5f5f7` · 白色卡片 · 细腻阴影 · 系统字体
- 蓝色强调 `#007aff`，圆角 8/10/14 三级体系
- 禁止赛博朋克霓虹、深色毛玻璃

### 双模式
- **快速面板**：热键唤起 → 搜索 → 复制 / `Tab` 填变量 → 自动隐藏 → 粘贴到 AI 工具
- **管理窗口**：完整 CRUD、分类标签、收藏、导入导出

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + P` | 全局唤起快速面板 |
| `↑` / `↓` | 列表选择 |
| `Enter` | 复制选中（无变量时）/ 焦点切换（变量填写时） |
| `Tab` | 打开变量填写弹窗 |
| `Esc` | 隐藏 / 取消 |
| `Ctrl + N` | 管理窗口中新建 |

## 📥 下载

- 前往 [Releases 页面](../../releases) 下载单文件 EXE
- 双击即用，无需安装、无需 Python 环境

## 🛠 技术栈

- **Python 3.12** + **PySide6 6.x**
- 全局热键：Windows `RegisterHotKey` API（无第三方依赖）
- 单文件分发：`PyInstaller --onefile --noconsole`
- 数据存储：用户家目录 `~/.mimo-prompt-manager/prompts.json`

## 📁 项目结构

```
portable/
├── main.py              # 入口 · 系统托盘 · 全局热键 · 应用生命周期
├── store.py             # 数据持久化 · CRUD · 变量提取与填充
├── quick_panel.py       # 快速面板（输入法式小组件）
├── manager_window.py    # 管理窗口（完整 CRUD）
├── global_hotkey.py     # Windows API 全局热键
├── styles.py            # 苹果白 QSS 样式
├── icon.ico             # 应用图标
├── requirements.txt
└── README.md
```

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](../LICENSE)
