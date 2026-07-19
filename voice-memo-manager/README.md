# 语音备忘录 · Voice Memo Manager

> 苹果白风格的桌面语音备忘录管理工具 —— 一键录音、列表管理、流畅播放。

[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)](#)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Style](https://img.shields.io/badge/style-苹果白-007aff?style=flat-square)](#)

## ✨ 功能特性

- 🎙️ **一键录音** — 大圆点按钮，单击即录，再次单击结束。录音时实时波形动画。
- ⏱️ **精确计时** — 录音过程中显示精确到秒的计时器。
- 📋 **录音列表** — 自动按时间倒序列出所有录音，显示日期、时长、文件大小。
- ▶️ **流畅播放** — 内置播放器，进度条可拖动跳转，时间实时显示。
- 🔍 **快速搜索** — 按标题模糊搜索录音。
- ✏️ **重命名 / 删除** — 鼠标悬停显示操作按钮，展开后可重命名或删除。
- 📁 **打开目录** — 一键在文件管理器中定位录音文件。
- 🟦 **系统托盘** — 关闭窗口时隐藏到托盘，常驻后台，点击托盘图标恢复。
- ⌨️ **快捷键** — 空格键开始/停止录音（输入框聚焦时除外）；ESC 取消重命名。
- 🎨 **苹果白风格** — 浅色背景 + 蓝色强调 (#007aff) + 系统字体 + 细腻阴影。

## 🖼️ 效果截图

![语音备忘录主界面](assets/icon.png)

> 截图说明：界面采用苹果白高端风格，顶部为可拖拽标题栏，中间是录音区（计时器 + 实时波形 + 大圆点录音按钮），下方是搜索栏与录音列表。

## ⬇️ 下载安装

### 方式一：从源码运行

```bash
# 1. 安装依赖
npm install

# 2. 开发模式运行
npm start

# 3. 运行单元测试
npm test

# 4. 打包为 Windows 安装包
npm run build
```

### 方式二：下载便携版

前往 [Releases](../../releases) 页面下载最新版本的安装包。

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Space` | 开始 / 停止录音（输入框聚焦时除外） |
| `ESC` | 取消重命名 |
| `Enter` | 保存重命名 |

## 📁 项目结构

```
voice-memo-manager/
├── main.js              # Electron 主进程：窗口、托盘、文件系统、IPC
├── src/
│   ├── index.html       # 应用界面
│   ├── styles.css       # 苹果白风格样式
│   ├── renderer.js      # 渲染进程：录音、播放、列表逻辑
│   └── preload.js       # 安全 IPC 桥接
├── test/
│   └── logic.test.js    # 核心逻辑单元测试
├── assets/
│   └── icon.png         # 应用图标
├── package.json
├── LICENSE
└── README.md
```

## 🛠️ 技术栈

- **Electron 28** — 跨平台桌面应用框架
- **MediaRecorder API** — 浏览器原生录音能力
- **Web Audio API + AnalyserNode** — 实时音频频谱（驱动波形）
- **原生 IPC** — 主进程负责文件系统读写，渲染进程负责 UI
- **零第三方 UI 依赖** — 纯 CSS 实现苹果白设计语言

## 📝 更新日志

### v1.0.0 (2026-07-19)

- 🎉 首次发布
- 实现录音、播放、列表、搜索、重命名、删除、托盘等核心功能
- 苹果白高端风格 UI

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡：

[爱发电](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

[MIT License](LICENSE)
