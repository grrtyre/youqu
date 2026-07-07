# 📋 习惯管家

> 本地优先的每日习惯打卡桌面应用 · 数据完全离线 · 苹果白高端风格

一个专注、克制、不打扰的习惯追踪工具。所有数据存储在本地，无需注册、无需联网，打开即用。基于 Electron 构建，拥有原生桌面应用的流畅体验。

## ⬇️ 直接下载

| 文件 | 平台 | 说明 | 下载 |
| --- | --- | --- | --- |
| 习惯管家-Setup-1.0.0.exe | Windows x64 | NSIS 安装包，支持自定义安装路径 | [⬇️ 下载](https://github.com/grrtyre/youqu/releases/download/habit-keeper-v1.0.0/habit-keeper-setup-1.0.0.exe) |
| 习惯管家-1.0.0.exe | Windows x64 | 便携版，双击即用 | [⬇️ 下载](https://github.com/grrtyre/youqu/releases/download/habit-keeper-v1.0.0/habit-keeper-1.0.0.exe) |

## ✨ 核心功能

- **一键打卡** — 大圆形打卡按钮，点击即可完成今日习惯，配合空格键快捷打卡
- **连续天数** — 实时计算当前连续打卡天数与历史最长连续天数
- **月历视图** — 直观的月度日历，已打卡日期高亮，支持点击任意历史日期补卡
- **完成率统计** — 本周完成率 + 本月完成率，量化习惯坚持程度
- **多习惯管理** — 侧边栏管理多个习惯，每个习惯可自定义图标和主题色
- **数据导入导出** — JSON 格式导出/导入，方便备份和迁移
- **完全本地** — 数据存储在本地 JSON 文件，绝不上传，隐私安全

## 🎨 设计语言

- **苹果白高端风格** — 白色/浅灰背景、细腻阴影、系统字体（-apple-system, "PingFang SC"）
- **蓝色强调** — #007aff 主色调，源自 iOS 系统蓝
- **统一图标** — 全套自绘 SVG 线条图标，stroke-width 统一为 1.6-1.8
- **克制圆角** — 8/12/16/20px 四级圆角体系，呼应 macOS 原生设计

## 📦 使用方式

### 方式一：直接下载（推荐）

下载下方安装包，双击安装即可使用。

| 平台 | 下载链接 | 说明 |
| --- | --- | --- |
| Windows x64 | [即将发布] | NSIS 安装包，支持自定义安装路径 |

### 方式二：从源码运行

```bash
# 克隆仓库
git clone https://github.com/grrtyre/youqu.git
cd youqu/habit-keeper

# 安装依赖（国内用户建议使用镜像）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install

# 启动应用
npm start

# 打包
npm run dist
```

## 🗂️ 项目结构

```
habit-keeper/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # contextBridge 安全桥接
│   ├── core/
│   │   ├── habit-utils.js   # 纯函数工具（streak/月历/统计）
│   │   └── habit-store.js   # 本地 JSON 存储（原子写入）
│   └── renderer/
│       ├── index.html       # 三栏布局
│       ├── styles.css       # 苹果白风格样式
│       └── renderer.js       # 渲染层逻辑
├── test/
│   └── test.js              # 26 项单元测试
├── build/
│   ├── icon.ico             # 应用图标（多尺寸）
│   └── make_icon.py         # 图标生成脚本
└── package.json
```

## ⌨️ 快捷键

- `空格` — 切换当前习惯的今日打卡状态
- `Esc` — 关闭弹窗

## 🔒 隐私说明

- 所有习惯数据存储在 `用户目录/AppData/Roaming/habit-keeper/habits.json`
- 数据完全本地，应用本身不发起任何网络请求
- 导出功能仅在你主动点击时生成 JSON 文件到自选位置

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡：

👉 [爱发电支持](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📝 License

MIT License © 2026 youqu
