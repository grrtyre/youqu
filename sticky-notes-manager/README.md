# 📝 便签管家 · sticky-notes-manager

> 苹果白高端风格的本地便签桌面应用：快速记录、分类管理、置顶标记、全文搜索、颜色标签、导入导出，纯本地隐私优先。

一款轻量级桌面便签工具，灵感来自 macOS 便签 + Apple Notes 的设计语言。所有数据存储在本地，不联网、不上传、不登录，打开即用。

## ⬇️ 直接下载

| 平台 | 下载 |
|---|---|
| Windows x64 | [便签管家 Setup 1.0.0.exe](../../releases/tag/sticky-notes-manager-v1.0.0) |

## ✨ 功能特性

- **快速记录** —— 全局快捷键 `Ctrl+Alt+N` 随时唤起新建便签，不打断思路
- **分类管理** —— 工作 / 个人 / 灵感 / 待办 / 其他 五大分类，侧边栏一键筛选
- **置顶标记** —— 右键卡片快速置顶，重要内容永远排在最前
- **全文搜索** —— 标题 + 内容实时搜索，毫秒级响应
- **颜色标签** —— 7 种颜色标记便签，左侧色条直观区分
- **排序策略** —— 置顶优先 → 按更新时间倒序，自动排列
- **导入导出** —— JSON 格式导入导出，数据可迁移不锁定
- **统计概览** —— 便签数 / 置顶数 / 总字数 一目了然
- **托盘常驻** —— 关闭窗口后台常驻，快捷键随时唤起
- **纯本地隐私** —— 所有数据存在本地 JSON 文件，绝不联网

## 🚀 使用

### 安装版
下载上方的 `便签管家 Setup 1.0.0.exe`，双击安装即可。

### 开发模式
```bash
npm install
npm start
```

### 打包
```bash
npm run build
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + Alt + N` | 新建便签（全局） |
| `Ctrl + Alt + S` | 唤起主窗口（全局） |
| `Ctrl + Enter` | 保存便签（编辑弹窗内） |
| `Esc` | 关闭编辑弹窗 |
| `右键卡片` | 切换置顶状态 |

## 📁 项目结构

```
sticky-notes-manager/
├── src/
│   ├── main.js              # Electron 主进程（窗口、托盘、全局快捷键）
│   ├── preload.js           # 预加载脚本（contextBridge 安全通信）
│   ├── core/
│   │   └── note-store.js    # 核心存储逻辑（CRUD + 搜索 + 排序 + 统计）
│   └── renderer/
│       ├── index.html       # 页面结构
│       ├── styles.css       # 苹果白高端风格样式
│       └── renderer.js      # 渲染层逻辑
├── test/
│   └── test.js              # 核心逻辑测试（86 个用例）
├── build/
│   ├── icon.ico             # 应用图标
│   ├── make_icon.py         # 图标生成脚本
│   ├── gen-demo-data.js     # 演示数据生成
│   └── screenshot.ps1       # 后台截图脚本
├── .gitignore
├── LICENSE
└── README.md
```

## 🛠 技术栈

- Electron 33（桌面应用框架）
- 原生 JavaScript（零运行时依赖）
- contextBridge + ipcRenderer.invoke/handle（安全 IPC 通信）
- electron-builder（NSIS 安装包打包）
- 苹果白高端风格（参考 macOS / iOS 原生设计）

## 🧪 测试

```bash
node test/test.js
```

86 个用例覆盖：ID 生成、创建便签、读写存储、新增 / 更新 / 删除便签、切换置顶、搜索便签、分类筛选、排序逻辑、统计计算、导入导出、常量定义、默认路径。

## 🎨 设计理念

- **苹果白风格** —— 白色 / 浅灰背景、细腻多层阴影、系统字体（-apple-system, PingFang SC）、蓝色 `#007aff` 强调
- **隐私第一** —— 所有数据本地存储，绝不联网上传
- **极简极速** —— 打开即用，毫秒级响应
- **桌面原生感** —— 托盘常驻 + 全局快捷键，真正的桌面工具体验

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

MIT
