# Launcher Manager

> 一款 macOS Spotlight 风格的 Windows 快速应用启动器。按 `Alt+Space` 唤起，模糊搜索已安装应用，回车秒开。

![platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![electron](https://img.shields.io/badge/Electron-30-47848F?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![version](https://img.shields.io/badge/version-1.0.0-007aff?style=flat-square)

---

## ✨ 特性

- ⚡ **全局热键唤起** —— 任意位置按 `Alt+Space`，唤起搜索框，不打断当前工作流
- 🔍 **智能模糊搜索** —— 自研评分算法（精确匹配 / 单词边界 / 前缀匹配 / 子序列匹配），输入即可命中
- 📚 **自动索引本地应用** —— 扫描开始菜单、桌面、用户目录等所有 `.lnk` / `.url` / `.exe` 文件
- 🕘 **最近使用排序** —— 自动记录启动次数与时间，常用应用置顶显示
- 🎨 **苹果白高端风格** —— 浅色背景、细腻多层阴影、系统字体、`#007aff` 强调色
- ⌨️ **全键盘操作** —— `↑↓` 选择、`Enter` 启动、`Esc` 关闭，无需鼠标
- 🚀 **轻量极速** —— 单窗口、5 分钟增量索引、内存占用低

---

## 📦 下载安装

| 类型 | 说明 | 链接 |
| --- | --- | --- |
| 🟢 便携版 | 单文件 EXE，免安装即用 | [Releases](../../releases) |
| 🛠️ 安装版 | NSIS 安装程序，自带开始菜单快捷方式 | [Releases](../../releases) |

> 最低系统要求：Windows 10 1809+

---

## 🚀 快速开始

### 方式一：使用预编译版本
1. 从 [Releases](../../releases) 下载最新版 `LauncherManager-Setup.exe` 或便携版 EXE
2. 双击运行（便携版）或安装后从开始菜单启动
3. 按下 `Alt+Space` 唤起搜索框，输入应用名称，回车启动

### 方式二：源码运行
```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/launcher-manager
npm install
npm start
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

## 🖼️ 效果截图

![Launcher Manager 主界面](assets/icon.png)

> 苹果白风格、模糊搜索结果、最近使用标记

---

## 🏗️ 项目结构

```
launcher-manager/
├── src/
│   ├── main.js              # 主进程：窗口管理、全局热键、IPC
│   ├── preload.js           # 安全 IPC 桥接
│   ├── lib/
│   │   ├── fuzzySearch.js   # 自研模糊搜索算法
│   │   └── appIndexer.js    # Windows 应用索引器
│   └── renderer/
│       ├── index.html       # 渲染层结构
│       ├── renderer.js      # 渲染层逻辑
│       └── styles.css       # 苹果白样式
├── test/
│   └── test-fuzzy.js        # 模糊搜索单元测试
├── assets/
│   ├── icon.png             # 应用图标 PNG
│   └── icon.ico             # 应用图标 ICO（含 6 种尺寸）
├── package.json
├── LICENSE
└── README.md
```

---

## 🔧 技术栈

- **Electron 30** —— 跨平台桌面应用框架
- **原生 Node.js** —— 无第三方 UI 框架依赖
- **PowerShell + P/Invoke** —— 后台 PrintWindow 截图
- **自研算法** —— 模糊搜索评分、应用索引、最近使用排序

---

## 📝 更新日志

### v1.0.0
- 🎉 首次发布
- 全局热键 `Alt+Space` 唤起
- 模糊搜索 + 最近使用排序
- 苹果白高端 UI

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

[MIT License](LICENSE) © 2026 grrtyre
