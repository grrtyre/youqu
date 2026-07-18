# 🖼️ 壁纸管理器

> 苹果白高端风格的本地壁纸管理工具——优雅地管理、切换和发现你的桌面壁纸。

![platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![electron](https://img.shields.io/badge/Electron-28-47848F?style=flat-square)
![style](https://img.shields.io/badge/style-苹果白-007aff?style=flat-square)

## ✨ 特性

- **📁 多来源管理** — 添加任意多个壁纸文件夹，自动扫描图片
- **🖼️ 网格瀑布预览** — 卡片式缩略图，悬停查看详情
- **⭐ 收藏管理** — 标记最爱的壁纸，一键筛选
- **🕐 定时切换** — 1/2/4/6/12/24 小时自动轮换壁纸
- **🌅 必应每日壁纸** — 一键拉取并设置为桌面壁纸
- **🔍 全文搜索** — 按文件名快速过滤壁纸
- **📦 系统托盘常驻** — 关闭主窗口后台运行，托盘快速切换
- **🎨 苹果白设计语言** — 白色背景 · 细腻阴影 · 系统字体 · #007aff 蓝色强调

## 📥 下载安装

| 平台 | 类型 | 大小 | 链接 |
|------|------|------|------|
| Windows x64 | 安装包 (.exe) | ~85 MB | [Releases](../../releases) |
| Windows x64 | 便携版 (.exe) | ~75 MB | [Releases](../../releases) |

> 首次运行请点击右上「添加文件夹」选择你的壁纸目录。

## 🚀 快速开始

### 方式一：使用预构建版本

1. 在 [Releases](../../releases) 下载最新版本的安装包或便携版
2. 双击运行，按提示完成安装
3. 启动后点击「添加文件夹」选择壁纸目录
4. 享受优雅的壁纸管理体验

### 方式二：从源码运行

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/wallpaper-manager
npm install
npm start
```

### 方式三：构建自己的版本

```bash
npm run build          # 生成 NSIS 安装包
npm run build:portable # 生成便携版单文件
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Esc` | 关闭大图预览 |
| 单击卡片 | 预览大图 |
| 双击 / 「设为壁纸」按钮 | 设置为桌面壁纸 |
| 卡片右上 ⭐ 按钮 | 收藏/取消收藏 |

## 📁 项目结构

```
wallpaper-manager/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 上下文隔离 IPC
│   ├── utils.js             # 纯函数工具模块
│   ├── assets/
│   │   ├── icon.png         # 应用图标
│   │   └── icon.ico         # Windows 图标
│   └── renderer/
│       ├── index.html       # 主界面
│       ├── styles.css       # 苹果白样式
│       └── renderer.js      # 渲染逻辑
├── test/
│   └── logic.test.js        # 核心逻辑测试
├── package.json
├── LICENSE
└── README.md
```

## 🎨 设计哲学

壁纸管理器遵循苹果白高端风格设计语言：

- **白色基底** — `#f5f5f7` 背景 + `#ffffff` 卡片，呼吸感留白
- **细腻阴影** — 三级阴影体系（sm/md/lg），层次分明
- **系统字体** — `-apple-system` 优先，原生体验
- **蓝色强调** — `#007aff` 主色调，苹果经典蓝
- **过渡曲线** — `cubic-bezier(0.4, 0, 0.2, 1)`，丝滑自然

## 🛠️ 技术栈

- **Electron 28** — 跨平台桌面应用框架
- **原生 JavaScript** — 零运行时依赖
- **PowerShell / Win32 API** — 通过 `SystemParametersInfo` 设置桌面壁纸
- **必应官方 API** — `HPImageArchive` 获取每日壁纸
- **Node.js fs** — 递归扫描壁纸文件夹

## 🔒 隐私说明

- 所有壁纸均存储在用户本地，不上传任何数据
- 仅与 `bing.com` 通信以获取每日壁纸（可选功能）
- 不收集任何使用统计

## 📝 更新日志

### v1.0.0 — 2026-07-18

- 🎉 首个正式版本
- 实现壁纸网格、收藏、定时切换、必应每日、系统托盘等核心功能
- 完成苹果白高端风格 UI 设计

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们继续开发更多优质工具：

[爱发电](https://www.ifdian.net/a/giquwei) · 你的支持是我们持续迭代的动力

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

---

## 📄 License

MIT © 2026 [youqu](https://github.com/grrtyre)
