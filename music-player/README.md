# 🎵 音乐 (Music Player)

> 一个苹果白高端风格的本地音乐播放器，简洁、纯粹、不打扰。

## ✨ 特性

- 🎨 **苹果白美学** — 白色 / 浅灰背景，细腻阴影，系统字体，#007aff 蓝色强调
- 📁 **本地音乐** — 支持添加文件 / 文件夹 / 拖拽导入
- 🎧 **多种格式** — MP3 / WAV / OGG / FLAC / M4A / AAC
- 🎛️ **完整控制** — 播放/暂停/上一首/下一首/进度拖拽/音量
- 🔀 **三种模式** — 顺序 / 随机 / 列表循环 / 单曲循环
- 💾 **持久化** — 播放列表自动保存，下次打开继续听
- ⌨️ **快捷键** — 空格暂停，Shift+←/→ 快进/快退
- 🎨 **动态封面** — 根据歌曲名生成柔和渐变封面
- 🪶 **轻量纯净** — 无广告、无遥测、无网络请求

## 📦 下载

| 平台 | 下载 | 大小 |
| --- | --- | --- |
| Windows x64 | [MusicPlayer-Setup.exe](../../releases/latest) | ~85 MB |

> 便携版单文件 EXE 即将推出。

## 🚀 快速开始

### 方式一：直接使用（推荐）

下载上方安装包，双击安装即可。

### 方式二：从源码运行

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/music-player
npm install
npm start
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Space` | 播放 / 暂停 |
| `Shift + ←` | 快退 5 秒 |
| `Shift + →` | 快进 5 秒 |
| `Ctrl + N` | 下一首 |
| `Ctrl + P` | 上一首 |

## 📁 项目结构

```
music-player/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 安全桥接
│   ├── renderer/
│   │   ├── index.html       # 主界面
│   │   ├── styles.css       # 苹果白样式
│   │   └── app.js           # 播放逻辑
│   └── assets/
│       └── icon.png         # 应用图标
├── test/
│   └── test.js              # 单元测试
├── package.json
├── LICENSE
└── README.md
```

## 🛠️ 技术栈

- **Electron 30** — 跨平台桌面应用框架
- **原生 HTML5 Audio** — 无依赖音频播放
- **原生 CSS** — 苹果白设计系统，无 UI 框架
- **IPC + Preload** — 安全的进程间通信

## 🎨 设计语言

| 设计元素 | 数值 |
| --- | --- |
| 主背景 | `#ffffff` |
| 次背景 | `#f5f5f7` |
| 主文字 | `#1d1d1f` |
| 次文字 | `#6e6e73` |
| 强调色 | `#007aff` |
| 圆角 | 6 / 10 / 16 / 20 px |
| 字体 | -apple-system, SF Pro, PingFang SC |

## 📝 更新日志

### v1.0.0 (2026-07-18)

- 🎉 首次发布
- 完整的播放列表管理
- 拖拽 / 文件 / 文件夹导入
- 随机 / 循环模式
- 持久化播放列表
- 苹果白 UI

## ☕ 支持我们

如果这个工具帮到了你，欢迎请我们喝杯咖啡：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-007aff?style=flat-square&logo=buy-me-a-coffee&logoColor=white)](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

[MIT License](./LICENSE) © 2026 youqu
