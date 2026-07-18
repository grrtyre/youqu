<div align="center">

# 📔 日记本 · Daily Journal

**一款极简、克制的桌面日记应用**

苹果白风格 · 本地存储 · 心情追踪 · 全文搜索 · Markdown 导出

<img alt="version" src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.0.0-007aff?style=flat-square">
<img alt="platform" src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-007aff?style=flat-square">
<img alt="license" src="https://img.shields.io/badge/License-MIT-007aff?style=flat-square">
<img alt="stars" src="https://img.shields.io/github/stars/grrtyre/youqu?style=flat-square&color=007aff">
<img alt="electron" src="https://img.shields.io/badge/Electron-31-007aff?style=flat-square">

</div>

> 记录每天值得记住的事，不为社交，只为自己的内心。衬线字体、舒适行距，让记录变成享受。

---

## 效果展示

<p align="center">
  <img src="./preview.png" alt="日记本 效果示意" width="880">
</p>

## ✨ 功能特性

| 分类 | 能力 | 说明 |
|---|---|---|
| 日历视图 | 一眼回望 | 日历高亮显示哪些日子写过日记，点选即跳转 |
| 沉浸写作 | 衬线排版 | 系统衬线字体 + 舒适行距，专注记录本身 |
| 心情追踪 | emoji 标记 | 用 emoji 给每天打情绪标签，回看情绪轨迹 |
| 标签管理 | 快速归类 | 给日记打标签，按标签筛选与检索 |
| 全文搜索 | 多维查找 | 关键词、标签、日期皆可搜索，结果即时呈现 |
| 本地存储 | 隐私无忧 | 数据仅存在本机，绝不上传，完全离线可用 |
| Markdown 导出 | 一键分享 | 某天日记一键导出为 `.md` 文件 |
| 苹果白风格 | 视觉克制 | 白色背景、细腻阴影、系统字体、`#007aff` 蓝色点缀 |

## ⬇️ 下载与使用

| 方式 | 下载 | 说明 |
|---|---|---|
| Windows 安装版 | [日记本-1.0.0-setup.exe](https://github.com/grrtyre/youqu/releases/download/diary-manager-v1.0.0/日记本-1.0.0-setup.exe) | NSIS 安装程序，支持自定义安装路径 |
| 源码运行 | [youqu/diary-manager](./) | 克隆仓库后本地启动，详见下方快速开始 |

> 安装版发布包正在准备中。如急需使用，可从源码运行（约 2 分钟即可启动）。

## 🚀 快速开始

### 方式一：直接使用（推荐）

下载上方的安装包，双击安装即可。

### 方式二：从源码运行

```bash
# 克隆仓库
git clone https://github.com/grrtyre/youqu.git
cd youqu/diary-manager

# 安装依赖（国内建议使用镜像加速）
npm config set registry https://registry.npmmirror.com
npm install

# 启动应用
npm start
```

### 构建安装包

```bash
npm run build
```

构建产物位于 `dist/` 目录。

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl` / `⌘` + `S` | 保存当前日记 |
| `Enter` / `,` | 确认添加标签 |
| `Backspace` | 标签输入为空时删除最后一个标签 |

## 📁 项目结构

```
diary-manager/
├── src/
│   ├── main.js          # 主进程：窗口、IPC、文件读写
│   ├── preload.js       # 预加载脚本：安全 API 桥
│   ├── index.html       # 主界面结构
│   ├── renderer.js      # 渲染进程：UI 逻辑
│   └── styles.css       # 苹果白风格样式
├── test/
│   └── test.js          # 核心函数单元测试
├── assets/              # 图标等资源
├── preview.png          # 效果展示截图
├── package.json
├── LICENSE
└── README.md
```

## 🔒 隐私说明

- 所有日记数据仅保存在本地（系统 `userData/diary-data/` 目录）
- 不联网、不上传、不分析
- 完全离线可用

## 🛠️ 技术栈

- **Electron 31** — 跨平台桌面应用框架
- **原生 HTML/CSS/JS** — 不依赖前端框架，轻量高效
- **contenteditable** — 富文本编辑
- **JSON 文件存储** — 按日期一个文件，简单可靠
- **苹果白高端风格** — 参考 macOS/iOS 原生设计，白色背景、细腻阴影、系统字体、`#007aff` 蓝色强调

## 💻 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 启动开发
npm start

# 打包
npm run build
```

## 📝 更新日志

### v1.0.0 (2026-07-17)

- 🎉 首个正式版本
- 日历视图、日记编辑、心情追踪、标签管理
- 全文搜索（关键词 / 标签 / 日期）
- Markdown 导出
- 苹果白高端风格 UI

## ☕ 支持我们

如果这个应用对你有帮助，欢迎请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_欢迎成为第一位支持者。_

## 📄 License

[MIT License](./LICENSE) —— 可自由使用、修改、分发。

## 🔗 相关项目

日记本是 [youqu 工具集](https://github.com/grrtyre/youqu) 的一员，更多苹果白风格的实用小工具欢迎访问主仓库。
