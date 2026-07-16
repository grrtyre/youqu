# 系统监控器 · System Monitor

> 实时系统资源监控仪表盘 · 苹果白高端风格 · 本地运行，数据不外传

一个轻量、精致的系统资源监控工具，以苹果白风格实时呈现 **CPU / 内存 / 磁盘 / 网络 / 进程** 状态，帮助你一眼掌握电脑运行状况。完全本地运行，无需联网，不收集任何数据。

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![style](https://img.shields.io/badge/style-苹果白%20Apple%20White-lightgrey)

---

## 📥 下载与运行

```bash
cd system-monitor
npm install
npm start
```

启动后终端会输出本地地址（默认 `http://127.0.0.1:3210/`），用浏览器打开即可看到实时仪表盘。

**环境要求**：Node.js ≥ 16，无需任何编译工具链。

---

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 💻 CPU 监控 | 实时占用率、核心数、型号、温度（如可读取） |
| 🧠 内存监控 | 已用 / 总量、占用率、交换分区状态 |
| 💾 磁盘监控 | 各分区容量与占比、实时读写速率 |
| 🌐 网络监控 | 实时上传 / 下载速率、活动接口 |
| 📈 历史曲线 | CPU / 内存 / 网络近 2 分钟趋势图（含 Y 轴刻度） |
| 📋 进程排行 | 按 CPU 占用排序的 Top 8 进程 |
| 🖥️ 系统信息 | CPU / GPU / 系统 / 内核 / 架构 / 主机名 |

### 设计亮点

- **苹果白高端风格**：浅色背景、细腻阴影、系统字体、柔和蓝 `#3a8dff` 强调
- **统一单色系**：克制配色，符合 Apple 设计语言
- **圆环仪表盘**：CPU / 内存 / 磁盘占用一目了然，平滑过渡动画
- **实时曲线图**：原生 Canvas 绘制，零依赖，高 DPI 清晰，含 Y 轴刻度
- **斑马纹进程表**：提升密集数据可读性
- **完全本地**：所有数据来自本机，不上传任何信息

---

## ⌨️ 快捷键 / 操作

| 操作 | 说明 |
| --- | --- |
| 浏览器打开 `http://127.0.0.1:3210/` | 查看仪表盘 |
| 页面自动刷新 | 每 1.5 秒自动更新数据 |
| `Ctrl + C`（终端） | 退出监控服务 |
| 窗口缩放 | 仪表盘自适应宽度，支持响应式布局 |

---

## 📁 项目结构

```
system-monitor/
├── src/
│   ├── server.js            # 后端：HTTP 服务 + systeminformation 数据采集
│   ├── net.ps1              # Windows 性能计数器网络流量采集
│   └── public/              # 前端静态资源
│       ├── index.html       # 仪表盘页面
│       ├── styles.css       # 苹果白风格样式
│       ├── app.js           # 前端逻辑 + Canvas 图表绘制
│       └── icon.svg         # 应用图标
├── test/
│   └── core.test.js         # 核心数据采集逻辑测试
├── package.json
├── LICENSE
└── README.md
```

---

## 🛠️ 技术栈

- **后端**：Node.js 原生 `http` 模块 + [`systeminformation`](https://www.npmjs.com/package/systeminformation) + Windows 性能计数器
- **前端**：原生 HTML / CSS / JavaScript（零前端依赖）
- **图表**：原生 Canvas 绘制
- **风格**：苹果白（Apple White）设计语言

---

## 📝 更新日志

### v1.0.0 — 2026-07-16

- 🎉 首个版本发布
- 实现 CPU / 内存 / 磁盘 / 网络 / 进程实时监控
- 苹果白高端风格仪表盘，统一柔和蓝单色系
- 圆环占比 + 历史曲线图（含 Y 轴刻度）
- 斑马纹进程表提升可读性
- 完全本地运行，零数据外传

---

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们持续开发更多精致小工具：

👉 [爱发电支持](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_
