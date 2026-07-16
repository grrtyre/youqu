# 🎨 调色板管理器

> 一款优雅的桌面配色方案生成与管理工具，基于色彩理论自动生成和谐调色板，助力设计与开发。

![Platform](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)
![Framework](https://img.shields.io/badge/Electron-31-47848F?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-34C759?style=flat-square)
![Style](https://img.shields.io/badge/风格-苹果白-007aff?style=flat-square)
![Version](https://img.shields.io/badge/版本-1.0.0-007aff?style=flat-square)

---

## ✨ 功能特性

- **色彩理论生成**：基于类比、互补、三元、四元、分裂互补、同色系等理论自动生成和谐配色
- **一键随机**：空格键瞬间生成全新调色板，灵感不竭
- **锁定与微调**：锁定满意的颜色，其余重新生成；支持单色 HSL 微调
- **图片取色**：从任意图片智能提取主色调（K-means 聚类算法）
- **WCAG 对比度检查**：实时计算前景/背景对比度，标注 AA / AAA 无障碍等级
- **多格式导出**：支持 CSS 变量、SCSS 变量、JSON、Tailwind 配置及 PNG 预览图
- **本地收藏**：保存喜欢的调色板，随时调用
- **系统托盘常驻**：失焦自动隐藏，全局快捷键随时唤出，类似输入法般轻巧
- **苹果白高端风格**：白色背景、细腻阴影、系统字体、蓝色强调，视觉清爽

## 📸 效果展示

> 主界面采用大色块横向铺陈，悬停浮现操作按钮，底部工具栏聚合生成、取色、导出能力。

```
┌─────────────────────────────────────────────────┐
│  🎨 调色板管理器    [类比|互补|三元…]   🔍 ♥ ↗   │
├─────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             │
│ │ 01 │ │ 02 │ │ 03 │ │ 04 │ │ 05 │  色块展示   │
│ │    │ │    │ │ 🔒 │ │    │ │    │             │
│ │#XXX│ │#XXX│ │#XXX│ │#XXX│ │#XXX│             │
│ └────┘ └────┘ └────┘ └────┘ └────┘             │
├─────────────────────────────────────────────────┤
│ [生成调色板] [图片取色]    点击复制·空格生成   │
└─────────────────────────────────────────────────┘
```

## ⬇️ 下载安装

### 方式一：源码运行
```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/palette-manager
npm install
npm start
```

### 方式二：打包版
前往 [Releases 页面](https://github.com/grrtyre/youqu/releases) 下载对应平台的安装包。

## 🎯 使用方法

1. 启动后自动生成一组调色板
2. 顶部切换色彩理论模式（类比 / 互补 / 三元等）
3. 按 `空格键` 生成新方案
4. 点击色块右上角锁图标锁定满意颜色
5. 点击色块复制 HEX 值
6. 点击「图片取色」从图片提取配色
7. 点击右上角图标进行对比度检查 / 收藏 / 导出

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Space` | 生成新调色板 |
| `Ctrl + Shift + P` | 全局唤出主窗口 |
| `Esc` | 关闭浮动面板 |
| 点击色块 | 复制 HEX 值 |
| 点击锁图标 | 锁定/解锁颜色 |

## 📁 项目结构

```
palette-manager/
├── src/
│   ├── main.js              # Electron 主进程（窗口、托盘、快捷键）
│   ├── preload.js           # 预加载脚本（安全 API 桥接）
│   ├── renderer/
│   │   ├── index.html       # 主界面
│   │   ├── styles.css       # 苹果白样式
│   │   ├── color-theory.js  # 色彩理论核心算法
│   │   └── app.js           # 渲染器交互逻辑
│   └── assets/
│       ├── icon.png         # 应用图标
│       └── tray-icon.png    # 托盘图标
├── test/
│   └── color-theory.test.js # 核心逻辑单元测试
├── package.json
├── LICENSE
└── README.md
```

## 🎨 设计规范

| 项目 | 取值 |
|------|------|
| 主背景 | `#ffffff` / `#fbfbfd` |
| 强调色 | `#007aff` |
| 正文色 | `#1d1d1f` |
| 字体 | SF Pro / Segoe UI / 苹方 |
| 圆角 | 8 / 12 / 16 / 22 px |
| 阴影 | 多层细腻投影 |

## 🧪 测试

核心色彩算法通过 32 项单元测试覆盖：

```bash
npm test
```

涵盖：颜色空间转换（HEX/RGB/HSL）、WCAG 对比度、六种色彩理论模式、锁定重生成、图片取色（K-means）、亮度排序。

## 📝 更新日志

### v1.0.0
- 首个正式版本
- 实现色彩理论生成、图片取色、对比度检查、多格式导出、本地收藏
- 苹果白高端风格 UI
- 系统托盘常驻 + 全局快捷键

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡，支持持续开发：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff5c5c?style=flat-square)](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢
感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

---

<p align="center">Made with care · youqu</p>
