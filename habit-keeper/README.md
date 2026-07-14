<div align="center">
  <img src="./build/icon-256.png" width="120" height="120" alt="习惯管家">
  <h1>📋 习惯管家</h1>
  <p><b>本地优先的每日习惯打卡桌面应用</b></p>
  <p>数据完全离线 · 苹果白高端风格 · 打开即用</p>
  <br>
  <p>
    <img src="https://img.shields.io/badge/版本-1.0.0-007aff?style=flat-square" alt="version">
    &nbsp;
    <img src="https://img.shields.io/badge/协议-MIT-007aff?style=flat-square" alt="license">
    &nbsp;
    <img src="https://img.shields.io/badge/平台-Windows%20x64-007aff?style=flat-square" alt="platform">
    &nbsp;
    <img src="https://img.shields.io/badge/测试-26项全通过-007aff?style=flat-square" alt="tests">
  </p>
</div>

<br>

## ⬇️ 直接下载

<table>
<tr>
<td align="center" bgcolor="#eef4fc" width="50%" style="padding:24px">
<b>🪟 Windows 安装版</b><br>
<sub>NSIS 安装包 · 支持自定义路径</sub><br><br>
<a href="https://github.com/grrtyre/youqu/releases/download/habit-keeper-v1.0.0/habit-keeper-setup-1.0.0.exe"><b>⬇️ 下载 Setup 1.0.0.exe</b></a>
</td>
<td align="center" bgcolor="#eef4fc" width="50%" style="padding:24px">
<b>🪟 Windows 便携版</b><br>
<sub>免安装 · 双击即用</sub><br><br>
<a href="https://github.com/grrtyre/youqu/releases/download/habit-keeper-v1.0.0/habit-keeper-1.0.0.exe"><b>⬇️ 下载便携版 1.0.0.exe</b></a>
</td>
</tr>
</table>

> 📌 完整发布说明见 [Release v1.0.0](https://github.com/grrtyre/youqu/releases/tag/habit-keeper-v1.0.0)

<br>

## ✨ 核心功能

<table>
<tr>
<td width="50%" bgcolor="#f6f8fa" valign="top" style="padding:20px">
<h3>🎯 打卡与追踪</h3>
<ul>
<li><b>一键打卡</b> — 大圆形按钮，点击即完成今日习惯</li>
<li><b>连续天数</b> — 实时计算当前连续与历史最长记录</li>
<li><b>空格快捷键</b> — 键盘流操作，无需鼠标</li>
</ul>
</td>
<td width="50%" bgcolor="#f6f8fa" valign="top" style="padding:20px">
<h3>📊 统计与可视化</h3>
<ul>
<li><b>月历视图</b> — 已打卡日期高亮，支持补卡</li>
<li><b>完成率统计</b> — 本周 + 本月完成率量化</li>
<li><b>多习惯管理</b> — 自定义图标与主题色</li>
</ul>
</td>
</tr>
<tr>
<td width="50%" bgcolor="#f6f8fa" valign="top" style="padding:20px">
<h3>💾 数据管理</h3>
<ul>
<li><b>JSON 导入导出</b> — 方便备份与迁移</li>
<li><b>原子写入</b> — 数据安全不丢失</li>
</ul>
</td>
<td width="50%" bgcolor="#f6f8fa" valign="top" style="padding:20px">
<h3>🔒 隐私优先</h3>
<ul>
<li><b>完全本地</b> — 数据绝不上传</li>
<li><b>零网络请求</b> — 应用不发起任何联网</li>
</ul>
</td>
</tr>
</table>

<br>

## 📸 效果展示

<div align="center">
<img src="../docs/assets/img/habit-keeper.webp" width="520" alt="习惯管家主界面">
<br><br>
<sub><b>苹果白高端风格</b> · 月历视图 · 连续天数 · 完成率统计</sub>
</div>

<br>

## 🚀 快速开始

**普通用户**：下载上方安装包 → 双击运行 → 从侧边栏选择习惯 → 按 `Space` 打卡 → `Esc` 关闭弹窗

**开发者从源码运行**：

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/habit-keeper
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
npm start
npm run dist
```

<br>

## 🗂️ 项目结构

```
habit-keeper/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # contextBridge 安全桥接
│   ├── core/
│   │   ├── habit-utils.js   # 纯函数工具（streak / 月历 / 统计）
│   │   └── habit-store.js   # 本地 JSON 存储（原子写入）
│   └── renderer/
│       ├── index.html       # 三栏布局
│       ├── styles.css       # 苹果白风格样式
│       └── renderer.js      # 渲染层逻辑
├── test/
│   └── test.js              # 26 项单元测试
└── package.json
```

<br>

## 🎨 设计语言

| 设计要素 | 规范 |
| --- | --- |
| 🎨 风格 | 苹果白高端 — 白色 / 浅灰背景、细腻阴影 |
| 🔤 字体 | `-apple-system, "PingFang SC"` 系统字体 |
| 🔵 主色 | `#007aff`（iOS 系统蓝） |
| ✏️ 图标 | 全套自绘 SVG 线条图标，`stroke-width` 1.6–1.8 |
| 📐 圆角 | 8 / 12 / 16 / 20px 四级圆角体系 |

<br>

## 🧪 测试

```bash
node test/test.js
```

覆盖习惯工具（日期转换、连续天数计算、月历生成、完成率统计）与本地存储（增删改查、原子写入、导入导出）共 **26 项**单元测试全部通过。

<br>

## 🔒 隐私说明

- 所有习惯数据存储在 `用户目录/AppData/Roaming/habit-keeper/habits.json`
- 数据完全本地，应用本身不发起任何网络请求
- 导出功能仅在你主动点击时生成 JSON 文件到自选位置

<br>

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡：

👉 **[爱发电支持](https://www.ifdian.net/a/giquwei)**

<br>

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

<br>

## 📝 更新日志

### v1.0.0
- 🎉 首次发布
- ✅ 一键打卡、连续天数、月历视图、完成率统计
- ✅ 多习惯管理、自定义图标与主题色
- ✅ JSON 数据导入导出
- ✅ 26 项单元测试覆盖核心逻辑

<br>

## 📄 License

[MIT License](../LICENSE) © 2026 youqu
