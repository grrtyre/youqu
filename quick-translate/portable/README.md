# 快速翻译器 · 便携版

> 像输入法一样的翻译体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

[![style](https://img.shields.io/badge/%E9%A3%8E%E6%A0%BC-%E8%8B%B9%E6%9E%9C%E7%99%BD-007aff?style=flat-square)]()
[![tech](https://img.shields.io/badge/%E6%8A%80%E6%9C%AF%E6%A0%88-Python%20%2B%20PySide6-3776ab?style=flat-square)]()
[![version](https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.0.0-007aff?style=flat-square)]()
[![platform](https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%2010%2F11-007aff?style=flat-square)]()

便携版基于 [quick-translate](../README.md) 原生重写，**不依赖 Electron**，单 EXE 即可运行。

## ✨ 核心理念

> 像输入法一样 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

不是 Electron 外壳，不是网页套壳，是原生、轻量、贴系统的小组件。

## 🎯 核心特性

### 输入法式体验
- **全局热键唤起** —— 默认 `Ctrl+Shift+T`，随时调用，无需切窗口
- **失焦自动隐藏** —— 点击别处自动消失，不占桌面
- **系统托盘常驻** —— 后台常驻，资源占用极低
- **小界面（380×500）** —— 贴近鼠标出现，复制文本即翻译
- **单实例运行** —— 重复启动自动检测，避免多开

### 翻译能力
- **20 种语言** —— 中英日韩法德西意俄葡阿泰越印尼马来土耳其荷兰波兰印地
- **自动检测源语言** —— 不用选源语言，自动识别
- **双引擎智能切换** —— Google gtx（主）+ MyMemory（备），双保险
- **历史记录** —— 自动保存最近 100 条，一键回填
- **复制即用** —— 译文一键复制，立即粘贴到 AI 工具或聊天框

### 苹果白高端风格
- 浅灰背景 `#f5f5f7` · 白色卡片 · 细腻阴影 · 系统字体
- 蓝色强调 `#007aff`，圆角 6/8/10/12 四级体系
- 渐变图标徽标 · 源文浅灰底 · 译文浅蓝底
- 禁止赛博朋克霓虹、深色毛玻璃

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + T` | 全局唤起面板 + 翻译剪贴板 |
| `Ctrl + Enter` | 翻译当前源文 |
| `Esc` | 隐藏面板（不退出） |
| `Tab` | 切换焦点（源文 ↔ 译文） |

## 📥 下载

- 前往 [Releases 页面](../../releases) 下载单文件 EXE
- 双击即用，无需安装、无需 Python 环境
- 数据保存在 `~/.mimo-quick-translate/data.json`

## 🚀 使用流程

1. 双击 `快速翻译器-便携版.exe` 启动，托盘出现翻译图标
2. 在任何地方复制文本（网页、文档、聊天框）
3. 按 `Ctrl+Shift+T` 唤起面板，自动翻译剪贴板内容
4. 译文显示后，点击「复制译文」或按 `Ctrl+C` 复制
5. 按 `Esc` 或点击别处，面板自动隐藏到托盘

## 🛠️ 技术栈

- **Python 3.12** + **PySide6 6.x**
- 全局热键：Windows `RegisterHotKey` API（ctypes，无第三方依赖）
- 后台截图：`PrintWindow` API + `PW_RENDERFULLCONTENT`
- 单文件分发：`PyInstaller --onefile --noconsole`
- 翻译引擎：Google gtx（主） + MyMemory（备）
- 数据存储：用户家目录 `~/.mimo-quick-translate/data.json`

## 📁 项目结构

```
portable/
├── main.py              # 入口 · 系统托盘 · 全局热键 · 应用生命周期
├── quick_panel.py       # 快速面板（输入法式小组件）
├── engine.py            # 翻译引擎（Google gtx + MyMemory）
├── store.py             # 数据持久化 · 历史记录 · 设置
├── hotkey.py            # Windows API 全局热键（ctypes）
├── styles.py            # 苹果白 QSS 样式表
├── capture.py           # 后台 PrintWindow 截图脚本
├── test_core.py         # 核心逻辑单元测试
├── build.py             # PyInstaller 打包脚本
├── make_icon.py         # 图标生成脚本（PIL）
├── requirements.txt
├── assets/
│   ├── icon.png         # 应用图标（256×256）
│   ├── icon.ico         # 应用图标（多尺寸）
│   └── arrow-down.svg   # 下拉箭头 SVG
└── README.md
```

## 🧪 测试

```bash
cd portable
python test_core.py
```

覆盖翻译引擎纯函数（URL 构造、响应解析、语言检测）和数据存储（CRUD、历史去重、最大数量限制）。

## 📦 构建

```bash
cd portable
python build.py
# 输出：dist/快速翻译器-便携版.exe（约 45 MB）
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
