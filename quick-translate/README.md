# 快速翻译器 · Quick Translate

> 一款驻留系统托盘的快速翻译工具 —— 一个快捷键，即刻翻译。苹果白高端风格，支持 20 种语言，自动检测源语言。

![平台](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![技术栈](https://img.shields.io/badge/技术栈-Electron%2030-green)
![许可证](https://img.shields.io/badge/许可证-MIT-success)
![版本](https://img.shields.io/badge/版本-1.0.0-orange)

## ✨ 特性

- **托盘驻留** —— 关闭窗口即最小化到系统托盘，永不打扰
- **全局快捷键** —— `Ctrl+Shift+T` 唤起窗口并自动翻译剪贴板内容
- **双引擎翻译** —— Google gtx（免费、自动检测）+ MyMemory 备用引擎
- **20 种语言** —— 中英日韩法德西意俄葡阿泰越印尼马来土耳其荷兰波兰印地
- **剪贴板监听** —— 开启后复制即翻译，无需手动粘贴
- **历史记录** —— 自动保存最近 100 条翻译，一键回填
- **苹果白风格** —— 浅色背景、细腻阴影、#007aff 蓝色强调，无毛玻璃无赛博朋克

## 📸 效果截图

![快速翻译器界面](src/assets/icon.png)

## 📥 下载安装

| 平台 | 下载 | 说明 |
|------|------|------|
| Windows | 见 [Releases](../../releases) | 便携版 EXE |
| 源码 | `git clone` 本仓库 | 需 Node.js 18+ |

### 从源码运行

```bash
# 安装依赖
npm install

# 开发模式
npm start

# 运行测试
npm test

# 打包（需 electron-builder）
npm run dist
```

## 🚀 快速开始

1. 启动应用后，自动驻留系统托盘
2. 复制任意文本，按 `Ctrl+Shift+T` 唤起翻译
3. 译文自动填充，可一键复制
4. 按 `Esc` 或关闭按钮回到托盘

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Enter` | 翻译当前源文 |
| `Ctrl+Shift+T` | 全局唤起 + 翻译剪贴板 |
| `Ctrl+Shift+S` | 交换源语言与目标语言 |

## 📁 项目结构

```
quick-translate/
├── src/
│   ├── main.js              # Electron 主进程（托盘+快捷键+IPC）
│   ├── preload.js           # 上下文隔离桥接
│   ├── engines/
│   │   └── translate.js     # 翻译引擎核心（Google+MyMemory，纯函数可测）
│   ├── renderer/
│   │   ├── index.html       # 渲染进程 HTML
│   │   ├── styles.css       # 苹果白高端风格样式
│   │   └── renderer.js      # 渲染进程逻辑
│   └── assets/
│       └── icon.png         # 应用图标
├── test/
│   └── translate.test.js    # 11 项单元测试
├── package.json
├── LICENSE
└── README.md
```

## 🛠 技术栈

- **Electron 30** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无框架依赖，纯净轻量
- **Google gtx API** —— 免费翻译端点，无需 API Key
- **MyMemory API** —— 备用翻译引擎
- **Node.js 内置模块** —— https、clipboard、globalShortcut

## 📝 更新日志

### v1.0.0
- 首次发布
- 双引擎翻译（Google + MyMemory）
- 全局快捷键 Ctrl+Shift+T
- 剪贴板监听模式
- 20 种语言支持
- 苹果白高端风格 UI
- 历史记录（最多 100 条）

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们继续开发更多实用工具：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff69b4)](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 许可证

MIT License © 2026 Quick Translate
