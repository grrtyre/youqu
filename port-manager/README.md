# 端口管家

> 本地网络端口监控与管理桌面应用

## ⬇️ 直接下载

| 版本 | 下载链接 | 说明 |
|---|---|---|
| 安装版 v1.1.0 | [端口管家-Setup-1.1.0.exe](https://github.com/grrtyre/youqu/releases/download/port-manager-v1.1.0/端口管家-Setup-1.1.0.exe) | 推荐安装，支持开始菜单和桌面快捷方式 |
| 便携版 v1.1.0 | [端口管家-1.1.0.exe](https://github.com/grrtyre/youqu/releases/download/port-manager-v1.1.0/端口管家-1.1.0.exe) | 免安装，双击即用 |
| 安装版 v1.0.0 | [port-manager-setup-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/port-manager-v1.0.0/port-manager-setup-1.0.0.exe) | 旧版本 |
| 便携版 v1.0.0 | [port-manager-portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/port-manager-v1.0.0/port-manager-portable-1.0.0.exe) | 旧版本 |

## 功能说明

端口管家是一款轻量级的 Windows 桌面工具，帮助开发者和系统管理员快速查看本机所有网络连接、监控端口占用、一键结束占用进程。

### 核心功能

- **端口扫描** — 一键扫描本机所有 TCP/UDP 连接，显示协议、本地地址、外部地址、状态、PID、进程名、内存占用
- **进程管理** — 点击 PID 查看进程详情（路径、连接数、监听端口），一键结束占用端口的进程
- **端口收藏** — 收藏常用端口，快速查看监听状态
- **搜索筛选** — 按端口、进程名、地址、PID 实时搜索；按状态（监听/已连接/TIME_WAIT/CLOSE_WAIT/UDP）筛选
- **状态识别** — 完整支持 LISTENING/ESTABLISHED/TIME_WAIT/CLOSE_WAIT/SYN_SENT/FIN_WAIT 等状态，语义化配色
- **自动刷新** — 可选 5 秒自动刷新，实时监控连接变化
- **数据导出** — 导出 CSV / JSON 格式，便于分析和记录
- **端口小知识** — 侧边栏内置端口状态说明，帮助理解 CLOSE_WAIT 等异常状态

### v1.1.0 更新内容

- 新增 CLOSE_WAIT 筛选标签，便于排查网络异常
- 新增 SYN_SENT 演示数据，状态标签语义化配色（紫/粉/绿/蓝/橙/红）
- 修复收藏端口刷新后星标丢失的问题
- 优化扫描为空时显示空状态，不再静默填充演示数据
- 移除表格斑马纹，改用纯白+细分割线（苹果白一致性）
- 加宽侧边栏，新增端口小知识提示卡片

## 使用方式

### 方式一：直接下载（推荐）

1. 前往 [Releases](../../releases) 下载最新版本的 `端口管家-Setup-1.0.0.exe`
2. 双击安装，按提示完成
3. 从开始菜单或桌面快捷方式启动

### 方式二：免安装版

1. 下载 `端口管家-1.0.0.exe`（便携版）
2. 双击即可运行，无需安装

### 方式三：源码运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 运行测试
npm test

# 打包
npm run dist
```

## 技术栈

- **Electron 31** — 跨平台桌面应用框架
- **原生 Node.js** — 调用系统命令（netstat、tasklist、taskkill）
- **contextBridge** — 安全的进程间通信
- **PrintWindow API** — 后台截图测试
- **electron-builder** — 打包发布

## 项目结构

```
port-manager/
├── src/
│   ├── main.js              # 主进程（IPC、系统命令调用）
│   ├── preload.js           # 预加载桥接
│   ├── core/
│   │   └── port-scanner.js  # 核心纯函数模块
│   └── renderer/
│       ├── index.html       # 页面结构
│       ├── styles.css       # 苹果白风格样式
│       └── renderer.js      # 渲染层逻辑
├── test/
│   └── test.js              # 单元测试（50 项）
├── build/
│   ├── icon.ico             # 应用图标
│   └── screenshot.ps1       # 后台截图脚本
├── package.json
└── LICENSE
```

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们持续开发更多实用工具：

[爱发电](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## License

MIT
