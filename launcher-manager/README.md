# Launcher Manager

> 一款 macOS Spotlight 风格的 Windows 快速应用启动器。按 `Alt+Space` 唤起，模糊搜索已安装应用，回车秒开。

![platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![electron](https://img.shields.io/badge/Electron-30-47848F?style=flat-square)
![license](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![version](https://img.shields.io/badge/version-1.1.0-007aff?style=flat-square)

---

## ✨ 特性

- ⚡ **全局热键唤起** —— 任意位置按 `Alt+Space`，唤起搜索框，不打断当前工作流
- 🔍 **智能模糊搜索** —— 自研评分算法（精确匹配 / 单词边界 / 前缀匹配 / 子序列匹配），输入即可命中
- 📚 **自动索引本地应用** —— 扫描开始菜单、桌面、用户目录等所有 `.lnk` / `.url` / `.exe` 文件
- 🕘 **最近使用排序** —— 自动记录启动次数与时间，常用应用置顶显示
- 🏷️ **智能分组小节** —— 空查询时自动按"最近使用 / 全部应用"分组，搜索态自动合并
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

### v1.1.0
- 🏷️ 空查询时按"最近使用 / 全部应用"分组，新增小节标签与计数
- 🎨 选中态改为 Apple Spotlight 风格：纯净实色块 + 内描边，移除原发光阴影与左侧竖条
- 🪶 状态栏移除亮绿圆点，改用低饱和蓝点；底栏背景统一为白色，去除生硬分割线
- 🧹 空状态去掉方框包裹，纯 SVG 居中，更克制
- ⌨️ hint-kbd 改为圆角 pill 风格；底部 kbd 改为 chip 样式（浅灰底 + 细边框 + 圆角）
- 🖼️ 截图演示数据扩充至 8 个应用，更饱满
- 📝 副标题统一显示安装位置类型（Program Files / Local / Roaming / WindowsApps），消除信息层级混乱
- 🎨 字母占位符图标改为蓝色渐变底 + 白字，统一品牌感；图标尺寸 32→34px
- 💡 阴影调整为垂直扩散为主，水平收窄，让卡片"浮"得更精致
- 🎨 小节标签加深颜色与字重；第二小节加细分割线强化分组分隔

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
