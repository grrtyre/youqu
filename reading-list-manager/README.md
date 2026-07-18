# 稍后阅读管理器 · Reading List Manager

> 收集、整理、追踪你想要稍后阅读的文章。本地存储、隐私优先、苹果白美学。

一个轻量级的桌面「稍后阅读」工具，帮你摆脱浏览器标签爆炸。把感兴趣的链接快速收藏进来，按状态/标签整理，专注读完。

## 特性

- **快速收藏**：粘贴 URL 即可，自动提取域名与 favicon
- **全局热键**：`Ctrl+Shift+L` 一键将剪贴板 URL 添加到稍后阅读清单（无需切换窗口）
- **状态管理**：未读 / 阅读中 / 已读 / 已归档，点击标题自动转「阅读中」
- **标签分类**：自由打标签，按标签侧栏筛选
- **搜索过滤**：按标题、URL、笔记、标签即时搜索
- **多种排序**：添加时间、更新时间、标题
- **导入导出**：JSON 格式备份/迁移
- **系统托盘**：关闭窗口自动隐藏到托盘，不打扰
- **本地存储**：所有数据存在 `userData/reading-list.json`，无云同步、无账号
- **苹果白风格**：浅色背景、细腻阴影、系统字体、`#007aff` 蓝色强调

## 下载

| 平台 | 类型 | 下载 |
| --- | --- | --- |
| Windows | 安装包 (NSIS) | [稍后阅读管理器-Setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/latest) |
| Windows | 便携版 (Portable) | [稍后阅读管理器-Portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/latest) |

> 便携版为单文件 EXE，解压即用，不写注册表。

## 快速开始

### 方式一：直接使用预编译版本

前往 [Releases](https://github.com/grrtyre/youqu/releases/latest) 下载对应平台的安装包/便携版，双击运行即可。

### 方式二：源码运行

```bash
# 1. 安装依赖（使用淘宝镜像加速）
npm install --registry=https://registry.npmmirror.com

# 2. 启动开发版
npm start

# 3. 跑测试
npm test

# 4. 打包（Windows 安装包 + 便携版）
npm run build
npm run build:portable
```

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Shift+L` | 全局热键：将剪贴板 URL 添加到清单 |
| `Ctrl+N` | 应用内：快速添加文章 |
| `Esc` | 关闭弹窗 |

## 项目结构

```
reading-list-manager/
├── src/
│   ├── main.js          # Electron 主进程：窗口/托盘/热键/IPC/存储
│   ├── preload.js       # contextBridge 安全 API 桥
│   ├── logic.js         # 纯函数逻辑（URL 校验/过滤/排序/统计）
│   └── renderer/
│       ├── index.html   # 主界面
│       ├── styles.css   # 苹果白风格样式
│       └── app.js       # 渲染进程 UI 逻辑
├── test/
│   └── core.test.js     # 单元测试（node:test）
├── README.md
├── LICENSE
├── .gitignore
└── package.json
```

## 数据存储

- **存储位置**：`%APPDATA%/reading-list-manager/reading-list.json`（Windows）
- **格式**：JSON
- **隐私**：所有数据本地保存，不上传任何服务器
- **导入导出**：设置按钮可导出 JSON 备份，或在另一台机器导入

## 设计语言

| 元素 | 值 |
| --- | --- |
| 背景 | `#f5f5f7` |
| 卡片 | `#ffffff` |
| 强调色 | `#007aff` |
| 字体 | `-apple-system, "PingFang SC", "Microsoft YaHei"` |
| 圆角 | 8–20px |
| 阴影 | 细腻（rgba 0.04–0.12） |

## 更新日志

### v1.0.0 (2026-07-18)

- 首次发布
- 实现文章 CRUD、状态管理、标签分类、搜索过滤、排序
- 全局热键 `Ctrl+Shift+L` 从剪贴板快速添加
- 系统托盘常驻、关闭隐藏到托盘
- JSON 导入导出
- 完整苹果白风格 UI
- 15 个单元测试覆盖核心逻辑

## ☕ 支持我们

如果这个工具帮到了你，欢迎到 [爱发电](https://www.ifdian.net/a/giquwei) 支持我们持续维护与开发新工具。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## License

[MIT](./LICENSE)
