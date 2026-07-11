# 📌 置顶管家

> 苹果白高端风格的 Windows 窗口置顶管理桌面应用：可视化窗口列表、一键置顶、透明度调节、全局热键、自动置顶规则、系统托盘常驻，纯本地隐私优先。

Windows 缺少原生的"窗口置顶"能力。当你一边查资料、一边写文档、一边用计算器时，频繁切换窗口非常打断思路。**置顶管家**让任意窗口始终浮在最前面，把参照物钉在屏幕上，专注做事。

## ✨ 功能特性

- **可视化窗口列表** —— 自动列出当前所有可见的顶层窗口，显示程序名、窗口标题、PID，实时刷新
- **一键置顶/取消** —— iOS 风格开关，逐窗口切换置顶状态，置顶窗口带蓝色高亮
- **透明度调节** —— 置顶窗口可拖动滑条调节透明度（10%–100%），半透明参照不打扰底层操作
- **全局热键** —— `Ctrl+Alt+T` 一键置顶/取消当前前台窗口，配合托盘常驻，随时唤起
- **自动置顶规则** —— 按程序名（如 `notepad`、`calc`）设置规则，命中窗口出现即自动置顶；每条规则可单独开关
- **星标快速入规则** —— 在任意窗口点 ★ 即可加入/移出自动置顶规则
- **搜索过滤** —— 按窗口标题或程序名即时筛选
- **系统托盘** —— 关闭主窗口驻留托盘，不占任务栏；托盘菜单可显示窗口、热键置顶、退出
- **纯本地隐私** —— 所有操作本地完成，不上传任何信息，规则保存在本地 userData

## 📥 下载安装

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | 见 [Releases](https://github.com/grrtyre/youqu/releases) | 安装版 `.exe`（NSIS）或便携版 `.exe` |

> 在 Release 页面搜索 `置顶管家` 即可找到对应版本的下载链接。

## 🚀 使用方式

### 方式一：直接下载（推荐）

1. 前往 [Releases](https://github.com/grrtyre/youqu/releases) 下载 `置顶管家 Setup 1.0.0.exe`（安装版）或 `置顶管家 1.0.0.exe`（便携版）
2. 安装版双击安装；便携版双击直接运行
3. 启动后主窗口列出所有窗口，点开关置顶；或按 `Ctrl+Alt+T` 置顶当前窗口

### 方式二：源码运行

```bash
cd topmost-manager
npm install
npm start
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Alt+T` | 置顶 / 取消置顶当前前台窗口（全局，任何应用中可用） |

## 🛠️ 技术栈

- **Electron 31** —— 跨平台桌面壳
- **Win32 API（PowerShell + C# 桥接）** —— `EnumWindows` / `SetWindowPos` / `SetLayeredWindowAttributes` / `GetForegroundWindow`，常驻桥接进程行协议通信
- **原生 JS** —— 渲染层无框架依赖
- **electron-builder** —— 打包 NSIS 安装版与便携版

### 架构

```
src/
├── core/
│   ├── bridge.cs          # C# Win32 P/Invoke：枚举/置顶/透明度/前台窗口
│   ├── bridge.ps1         # PowerShell 包装器，行协议分发（ASCII，中文走运行时 Unicode 通道）
│   ├── win32-bridge.js    # Node 端常驻进程管理 + JSON 行协议
│   └── topmost-store.js   # 自动置顶规则持久化（纯函数，可单测）
├── renderer/
│   ├── index.html / styles.css / renderer.js   # 苹果白 UI
├── main.js                # 主进程：窗口、托盘、全局热键、IPC、自动置顶
└── preload.js             # contextBridge 安全桥接
```

## 🧪 测试

核心逻辑（规则管理、持久化往返与容错、桥接 JSON 协议解析、透明度换算、头像配色哈希）有自动化测试：

```bash
npm test
```

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
