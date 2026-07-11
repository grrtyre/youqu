# 🌐 Hosts管家

> Windows 上优雅的 hosts 文件编辑与方案管理工具。苹果白高端风格，支持一键切换方案、UAC 提权写入、自动备份、模板库。

可视化编辑系统 hosts 文件，逐条开关启用/禁用，方案管理一键切换不同环境配置，内置 GitHub 加速/本地开发/广告屏蔽等常用模板，每次应用自动备份，纯本地运行不联网。

## ⬇️ 直接下载

> 不想自己打包？直接下载下方 exe 即可使用，无需安装 Node.js 或任何依赖。

| 版本 | 下载链接 | 说明 |
|---|---|---|
| 安装版（推荐） | [Hosts管家 Setup 1.1.0.exe](https://github.com/grrtyre/youqu/releases/download/hosts-manager-v1.1.0/Hosts管Setup.1.1.0.exe) | 双击安装，自动创建桌面快捷方式 |
| 免安装便携版 | [Hosts管家 1.1.0.exe](https://github.com/grrtyre/youqu/releases/download/hosts-manager-v1.1.0/Hosts管家.1.1.0.exe) | 双击即用，不写注册表 |

系统要求：Windows 10/11 x64

## ✨ 功能特性

- **可视化编辑** —— 逐条解析 hosts 文件，每行一个卡片，iOS 风格开关一键启用/禁用，双击编辑 IP/域名/注释
- **源码模式** —— 切换到原始文本编辑，直接修改 hosts 源码，与列表模式双向同步
- **方案管理** —— 保存当前配置为方案（如"工作环境""测试环境"），一键切换不同配置，随时加载恢复
- **模板库** —— 内置 GitHub 加速、本地开发、广告屏蔽等常用模板，一键应用
- **UAC 提权写入** —— 自动检测写入权限，无权限时通过 UAC 弹窗提升权限写入系统 hosts 文件
- **自动备份** —— 每次应用到系统前自动备份当前 hosts，最多保留 20 份，可随时恢复
- **DNS 刷新** —— 写入后自动执行 `ipconfig /flushdns` 刷新 DNS 缓存
- **实时搜索** —— 按 IP 或域名即时过滤条目
- **统计概览** —— 启用/禁用条目数量与比例条
- **LCS 差异对比** —— 基于 LCS 算法的内容差异对比，正确识别中间插入/删除
- **苹果白高端风格** —— 参考 macOS/iOS 原生设计，白底浅灰、细腻多层阴影、蓝色 `#007aff` 强调

## 🚀 使用

### 开发运行
```bash
npm install
npm start
```

### 打包成 exe
```bash
npm run build
```
生成的安装包在 `dist/` 目录：
- `Hosts管家 Setup 1.1.0.exe` —— NSIS 安装包
- `Hosts管家 1.1.0.exe` —— 免安装便携版

## 🎯 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + S` | 应用到系统（写入 hosts 文件） |
| 双击条目 | 进入编辑模式 |
| `Enter` | 保存编辑 |
| `Esc` | 取消编辑 |

## 📁 项目结构

```
hosts-manager/
├── src/
│   ├── main.js              # Electron 主进程（窗口、hosts 读写、UAC 提权、备份、IPC）
│   ├── preload.js           # 安全 IPC 桥
│   ├── core/
│   │   └── hosts-core.js    # 核心逻辑（解析、序列化、方案管理、LCS diff、统计）
│   └── renderer/
│       ├── index.html       # 界面
│       ├── styles.css       # 苹果白高端风格样式
│       └── renderer.js      # 渲染进程逻辑（列表、搜索、编辑、方案管理）
├── build/
│   ├── icon.ico             # 应用图标（多尺寸）
│   └── icon-source.png      # 图标源文件
├── test/
│   └── test.js              # 核心逻辑测试（31 项）
├── package.json
└── README.md
```

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面框架
- **纯 JavaScript** —— 无框架依赖，原生 HTML/CSS/JS
- **electron-builder** —— 打包成 Windows 安装包/便携版
- **苹果白高端风格** —— 参考 macOS/iOS 原生设计，白底浅灰、细腻多层阴影、蓝色 `#007aff` 强调

## 🧪 测试

```bash
npm test
```

31 个用例覆盖：hosts 解析（正常条目/注释条目/纯注释/空行/多域名/IPv6/复杂多行）、序列化（往返一致性/禁用条目/带注释）、条目操作（切换/添加/删除/更新）、统计、LCS 差异对比（新增行/删除行/相同行/中间插入/中间删除/完全替换）、地址校验（IPv4/IPv6/非法拒绝）、模板、边界情况。

## 📝 更新日志

### v1.1.0（2026-07-11）
- 🐛 **修复非法 HTML**：分段按钮 `<button>` 嵌套改为 `<div>` 容器，修复非法 HTML 结构
- 🐛 **修复打包配置**：`build.files` 补充 `package.json`，修复打包后应用无法启动的问题
- 🔧 **升级 diff 算法**：`diffContent` 从逐行对比升级为 LCS（最长公共子序列）算法，正确识别中间插入/删除
- 🎨 **修复 CSS 注释语法**：条目列表区注释语法错误修复
- 🧹 **清理调试日志**：移除 4 个遗留的 electron-*.log 调试文件
- 📝 **补充 README 文档**：新增完整项目文档

### v1.0.0
- 首次发布：可视化编辑、方案管理、模板库、UAC 提权、自动备份、DNS 刷新、搜索

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

MIT
