<div align="center">

# 🍅 番茄管家

**本地优先的番茄工作法专注桌面应用**

专注 · 休息 · 心流 · 打卡 · 统计 —— 苹果白高端风格，隐私优先，零网络

<img alt="version" src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.1.0-007aff?style=flat-square">
<img alt="license" src="https://img.shields.io/badge/License-MIT-34c759?style=flat-square">
<img alt="platform" src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-007aff?style=flat-square">
<img alt="electron" src="https://img.shields.io/badge/Electron-28-34c759?style=flat-square">
<img alt="tests" src="https://img.shields.io/badge/%E6%B5%8B%E8%AF%95-87%20%E7%94%A8%E4%BE%8B-ff9500?style=flat-square">
<img alt="privacy" src="https://img.shields.io/badge/%E9%9A%90%E7%A7%81-%E6%9C%AC%E5%9C%B0%E4%BC%98%E5%85%88-34c759?style=flat-square">
<img alt="stars" src="https://img.shields.io/github/stars/grrtyre/youqu?style=flat-square&color=ff9500">

</div>

> 用经典番茄工作法管理专注与休息，配合任务清单、统计分析与连续打卡，帮你进入心流。所有数据存本地，无网络请求，隐私优先。

## 🖼 效果展示

<p align="center">
  <img src="./docs/screenshot.png" alt="番茄管家主界面预览" width="880">
</p>

<details>
<summary><b>📷 查看更多细节（点击展开）</b></summary>

- **圆环计时** —— 专注 / 短休息 / 长休息三阶段，圆环进度随阶段色微妙脉动
- **呼吸光晕** —— 计时运行中圆环呈现生命感呼吸动效
- **完成庆祝** —— 每完成一个番茄，圆环扩散波纹 + 时间数字弹跳
- **任务清单** —— 当前任务自动累计完成进度，inline 编辑预估番茄数
- **统计面板** —— 今日进度、本周番茄数、累计专注时长、最近 7 天柱状图

</details>

## ⬇️ 直接下载

| 平台 | 下载 | 大小 | 版本 |
|---|---|---|---|
| Windows (x64) | [pomodoro-manager-setup-1.1.0.exe](https://github.com/grrtyre/youqu/releases/download/pomodoro-manager-v1.1.0/pomodoro-manager-setup-1.1.0.exe) | ~72 MB | v1.1.0 |

> 也可前往 [Release 页面](https://github.com/grrtyre/youqu/releases/tag/pomodoro-manager-v1.1.0) 查看所有版本。

## ✨ 功能特性

| 分类 | 能力 | 说明 |
|---|---|---|
| 🍅 计时核心 | 三阶段轮转 | 专注 / 短休息 / 长休息自动轮转，每 4 个番茄进入长休息，圆环进度可视化 |
| ✨ 视觉动效 | 专注呼吸光晕 | 计时运行中圆环随阶段颜色微妙脉动，让「正在专注」有生命感 |
| 🎉 仪式感 | 完成庆祝动效 | 每完成一个番茄，圆环扩散波纹 + 时间数字弹跳 |
| 📋 任务管理 | 任务清单 | 添加任务并预估番茄数，设为当前任务后自动累计完成进度 |
| ✏️ 任务编辑 | inline 编辑 | 双击任务标题即可原地修改名称与预估番茄数，回车保存、Esc 取消 |
| 📊 统计分析 | 多维数据 | 今日进度、专注分钟数、本周番茄数、累计专注时长、最近 7 天柱状图 |
| 🔥 连续打卡 | 每日目标 | 达成每日目标自动累计连续天数，激励持续专注 |
| 🔒 严格模式 | 守护节奏 | 开启后不可跳过休息，守护番茄工作法节奏 |
| ⚙️ 自动开始 | 无缝衔接 | 可配置工作结束后是否自动开始休息、休息结束后是否自动开始专注 |
| 🔔 提示音 | Web Audio 合成 | 清脆钟声，无需外部音频文件 |
| 🎧 白噪音 | 内置合成 | 帮助屏蔽环境干扰，专注更沉浸 |
| ☕ 系统托盘 | 常驻待命 | 右键菜单快速控制，关闭窗口不退出 |
| 📢 桌面通知 | 自动提醒 | 番茄完成 / 休息结束自动通知，点击唤起主窗口 |
| 💾 数据备份 | 导入导出 | JSON 格式备份恢复，纯本地隐私优先 |

## 🚀 快速开始

### 方式一 · 直接下载（推荐）

前往本页顶部的 [⬇️ 直接下载](#-直接下载) 章节，下载 `pomodoro-manager-setup-1.1.0.exe`，双击安装即可运行。

### 方式二 · 源码运行

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/pomodoro-manager
npm install
npm start
```

### 打包

```bash
npx electron-builder --win --x64
```

## ⌨️ 快捷键

| 操作 | 快捷键 | 说明 |
|---|---|---|
| 开始 / 暂停 | `空格` | 或点击中央蓝色按钮，或托盘菜单「开始/暂停」 |
| 重置 | `R` | 左侧圆形按钮 |
| 跳过 | `S` | 右侧圆形按钮（严格模式下休息不可跳过） |
| 切换阶段 | 点击标签 | 点击顶部「专注 / 短休息 / 长休息」标签直接切换 |
| 添加任务 | 输入框 + `回车` | 左侧输入任务名与预估番茄数，或点 ＋ |
| 设为当前任务 | 点击任务行 | 或点击右侧圆点 |
| 编辑任务 | 双击任务标题 | 回车保存、Esc 取消 |
| 完成任务 | 点击圆圈 | 任务左侧圆圈 |
| 删除任务 | 鼠标悬停 × | 任务行右侧 |
| 设置 | 齿轮图标 | 右上角，配置时长 / 目标 / 严格模式 / 自动开始 / 提示音 / 白噪音 |
| 关闭窗口 | 关闭按钮 | 自动隐藏到托盘，不退出；托盘菜单点「退出」彻底关闭 |

## 🛠 技术栈

- **Electron 28** —— 跨平台桌面应用框架
- **原生 JavaScript** —— 无框架依赖，纯净轻量
- **Web Audio API** —— 合成提示音与白噪音，零外部依赖
- **本地 JSON 持久化** —— userData 目录，原子写入 + 自动备份
- **SVG 圆环进度** —— 矢量渲染，任意缩放清晰
- **苹果白设计系统** —— 浅色背景、细腻阴影、系统字体、#007aff 强调色

## 📁 项目结构

```
pomodoro-manager/
├── src/
│   ├── core/pomodoro-core.js   # 核心状态机（可独立测试）
│   ├── renderer/
│   │   ├── index.html          # 主界面
│   │   ├── styles.css          # 苹果白样式
│   │   └── renderer.js         # 渲染逻辑
│   ├── main.js                 # Electron 主进程
│   └── preload.js              # 预加载桥接
├── test/test.js                # 核心逻辑测试（87 项）
├── build/make_icon.py          # 图标生成
└── package.json
```

## 🧪 测试

```bash
npm test
```

覆盖 87 项测试：计时状态机、阶段切换、长休息触发、暂停恢复、重置、跳过、严格模式、手动切换阶段、自动开始配置、任务管理、统计、连续打卡、序列化、格式化、进度计算。

## 📜 更新日志

### v1.1.0（2026-07）

**新功能**
- ✨ 专注呼吸光晕：计时运行中圆环随阶段颜色微妙脉动
- 🎉 完成庆祝动效：圆环扩散波纹 + 时间数字弹跳
- ✏️ 任务 inline 编辑：双击任务标题原地修改名称与预估番茄数
- 🎧 内置白噪音：合成背景音，帮助屏蔽环境干扰

**体验优化**
- 圆环阶段色与呼吸节奏调优
- 任务清单交互细节打磨
- 统计面板信息层级梳理

### v1.0.0（初始版本）
- 番茄计时器、任务清单、统计分析、连续打卡、严格模式、自动开始、提示音、系统托盘、桌面通知、数据导入导出

## ☕ 支持我们

如果番茄管家帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](./LICENSE)
