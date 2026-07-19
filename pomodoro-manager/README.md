<div align="center">

# 🍅 番茄管家

**本地优先 · 苹果白设计 · 隐私守护**

专注 · 休息 · 心流 · 打卡 · 统计

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.4.0-007aff?style=flat-square&logo=semver&logoColor=white">
  <img alt="platform" src="https://img.shields.io/badge/Windows-10%2B-007aff?style=flat-square&logo=windows10&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/License-MIT-007aff?style=flat-square&logo=opensourceinitiative&logoColor=white">
  <img alt="stars" src="https://img.shields.io/github/stars/grrtyre/youqu?style=flat-square&color=007aff&logo=github&logoColor=white&label=%E7%82%B9%E8%B5%9E">
</p>

</div>

> 用经典番茄工作法管理专注与休息，配合任务清单、统计分析与连续打卡，帮你进入心流。
> **所有数据本地存储，零网络请求，隐私优先。**

<p align="center">
  <img src="./docs/screenshot.png" alt="番茄管家主界面预览" width="560" style="border-radius:14px; box-shadow:0 8px 28px rgba(0,0,0,.12); border:1px solid rgba(0,0,0,.05);">
</p>

---

## ✨ 亮点速览

<table>
<tr>
<td width="50%" valign="top">

### 🔒 隐私优先 · 100% 本地

无网络请求、无账号、无追踪。数据存为本地 JSON，可随时导出/备份，完全归你所有。

</td>
<td width="50%" valign="top">

### 🍏 苹果白原生设计

参考 macOS Big Sur 视觉语言：#007aff 主色、圆角卡片、柔和阴影、呼吸光晕，克制不喧宾夺主。

</td>
</tr>
<tr>
<td width="50%" valign="top">

### ⚡ 轻量 Electron 容器

Electron 28 + 原生 JavaScript，启动快、内存省；Web Audio 合成提示音，零外部资源依赖。

</td>
<td width="50%" valign="top">

### 🧪 119 项自动化测试

核心状态机、计时逻辑、任务管理、统计计算全部覆盖测试，迭代不破坏既有行为。

</td>
</tr>
</table>

---

## ⬇️ 下载与运行

> ### 📦 便携版 v1.0.0 ✅
>
> 单文件 EXE · 约 20 MB · 免安装、U 盘随身带、办公电脑无管理员权限
>
> **[⬇️ 下载 PomodoroPortable.exe](https://github.com/grrtyre/youqu/releases/download/pomodoro-manager-portable-v1.0.0/PomodoroPortable.exe)**
>
> ---
>
> 🚧 桌面安装版（setup.exe）正在打包中，将提供系统级集成与开机自启能力，敬请期待。
>
> 🔐 **安全提示**：首次运行 Windows 可能弹出 SmartScreen 警告（未累积足够下载量），点击「更多信息 → 仍要运行」即可。本应用完全开源，可自行审查与编译。
>
> 📦 前往 [Releases 页面](https://github.com/grrtyre/youqu/releases?q=pomodoro-manager) 查看全部版本与更新日志。

<details>
<summary><b>💻 开发者：从源码运行</b></summary>

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/pomodoro-manager
npm install
npm start
```

> 测试 `npm test` · 打包 `npm run dist`

</details>

---

## 🎯 功能特性

<table>
<tr>
<td width="50%" valign="top">

### 🍅 计时核心

- 三阶段轮转：专注 / 短休 / 长休自动切换
- SVG 圆环进度 + 阶段色（专注蓝 / 休息绿 / 长休紫）
- 呼吸光晕 + 完成波纹庆祝动效

</td>
<td width="50%" valign="top">

### 📋 任务管理

- 任务清单 + 番茄预估，自动累计进度
- 番茄进度条可视化 `pomodoros/estimate`
- 双击 inline 编辑：<kbd>Enter</kbd> 保存 / <kbd>Esc</kbd> 取消

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📊 统计与激励

- 多维统计：今日 / 本周 / 累计专注时长
- 7 天柱状图 + 13 周专注热力图
- 周目标进度 + 连续打卡火焰 🔥

</td>
<td width="50%" valign="top">

### ⚙️ 专注守护

- 严格模式：不可跳过休息，守护节奏
- 工作 ↔ 休息自动衔接
- Web Audio 合成提示音 + 白噪音

</td>
</tr>
</table>

## 🖥 系统集成 · 体验细节

<table>
<tr>
<td width="50%" valign="top">

### 📌 托盘常驻

右键菜单快速控制，关闭窗口不退出。

</td>
<td width="50%" valign="top">

### 🔔 桌面通知

番茄完成自动通知，点击即可唤起。

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💾 数据备份

JSON 格式导入导出，跨设备迁移零摩擦。

</td>
<td width="50%" valign="top">

### ⚡ 便携版专属

全局热键 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> 唤起 · 失焦自动隐藏。

</td>
</tr>
</table>

---

## ⌨️ 快捷键

<table>
<tr>
<td width="50%" valign="top">

**⏱️ 计时控制**

| 操作 | 快捷键 |
|---|---|
| 开始 / 暂停 | <kbd>空格</kbd> |
| 重置当前阶段 | <kbd>R</kbd> |
| 跳过当前阶段 | <kbd>S</kbd> |
| 切换到专注 | <kbd>1</kbd> |
| 切换到短休息 | <kbd>2</kbd> |
| 切换到长休息 | <kbd>3</kbd> |

</td>
<td width="50%" valign="top">

**📋 任务管理**

| 操作 | 快捷键 |
|---|---|
| 新建任务 | <kbd>N</kbd> |
| 添加任务 | <kbd>输入</kbd> + <kbd>Enter</kbd> |
| 编辑任务 | <kbd>双击</kbd> |
| 保存编辑 | <kbd>Enter</kbd> |
| 取消编辑 | <kbd>Esc</kbd> |
| 打开设置 | <kbd>齿轮</kbd> |

</td>
</tr>
</table>

> 🖥️ **便携版专属**：全局热键 <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd> 唤起 · 失焦自动隐藏 · 右键托盘菜单控制 · 严格模式开启时 <kbd>S</kbd> 跳过无效。

---

## 🛠 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **Electron 28** | 跨平台桌面容器，本应用专注 Windows |
| UI | **原生 JavaScript** | 无框架依赖，启动快、体积小 |
| 音频 | **Web Audio API** | 合成提示音与白噪音，零外部音频文件 |
| 数据 | **本地 JSON** | 原子写入 + 自动备份，可读可校验 |
| 设计 | **苹果白 #007aff** | 主色统一，圆角卡片 + 柔和阴影 |
| 测试 | **119 项自动化用例** | 覆盖核心状态机与业务逻辑 |

---

## 📁 项目结构

<details>
<summary><b>展开查看项目目录树</b></summary>

```
pomodoro-manager/
├── src/
│   ├── core/pomodoro-core.js     # 核心状态机
│   ├── renderer/
│   │   ├── index.html            # 主界面
│   │   ├── styles.css            # 苹果白样式
│   │   └── renderer.js           # 渲染逻辑
│   ├── main.js                   # Electron 主进程
│   └── preload.js                # 预加载桥接
├── portable/                     # 便携版（Python/C++ 原生实现）
├── test/test.js                  # 119 项测试
├── docs/screenshot.png           # 主界面截图
└── package.json
```

</details>

---

## 📜 更新日志

| 版本 | 类型 | 摘要 |
|---|---|---|
| **v1.4.0** | 视觉精修 | 配色统一苹果蓝、热力图 5 级单色阶、卡片标题加粗 |
| **v1.3.1** | 体验优化 | 自定义 tooltip、任务空状态升级、快捷键提示精修 |
| **v1.3.0** | 功能增强 | 任务番茄进度条、`N` 键新建任务、火焰动效 |
| **v1.2.0** | 功能增强 | 13 周专注热力图、周目标进度条 |
| **v1.1.0** | 功能增强 | 呼吸光晕、完成庆祝、inline 编辑、白噪音 |
| **v1.0.0** | 首次发布 | 计时器、任务清单、统计、连续打卡、严格模式 |
| **便携版 v1.0.0** | 便携版首发 | Python/C++ 原生、全局热键、失焦隐藏、单 EXE |

<details>
<summary><b>📋 查看完整变更明细</b></summary>

- **v1.4.0**：streak 徽章蓝色主题 · 热力图回归苹果蓝 5 级单色阶 · 图例简化为 3 级降噪 · 卡片标题 15→16px 加粗 · 快捷键提示 10→12px · 任务进度条与主进度条风格统一 · 环形进度条 stroke-width 统一为 10 · 左右分栏 286→310px 平衡重心 · 任务输入区增加分隔线 · 火焰动效更克制
- **v1.3.1**：专注热力图自定义 tooltip（苹果白样式）· 任务空状态视觉升级（番茄图标+主副标题）· 快捷键提示精修（柔和胶囊+蓝色 kbd 标签）· README 测试用例数同步
- **v1.3.0**：任务番茄进度条（可视化 pomodoros/estimate）· `N` 键快速新建任务 · 连续打卡火焰动效增强 · 当前任务条与计时圆环视觉整合 · 任务间距统一；修复截图演示模式启动崩溃
- **v1.2.0**：专注热力图（13 周贡献图）· 周目标进度条 · 每周目标自定义
- **v1.1.0**：呼吸光晕 · 完成庆祝动效 · 任务 inline 编辑 · 内置白噪音
- **v1.0.0**：番茄计时器 · 任务清单 · 统计分析 · 连续打卡 · 严格模式 · 托盘常驻
- **便携版 v1.0.0**：Python/C++ 原生实现 · 全局热键唤起 · 失焦自动隐藏 · 系统托盘常驻 · 单 EXE 即用即走 · 内存 <50MB

</details>

---

## ❓ 常见问题

<details>
<summary><b>🔑 数据存在哪里？换电脑怎么迁移？</b></summary>

数据存为本地 JSON 文件（便携版在同目录的 `data/`，安装版在用户目录的 `AppData\pomodoro-manager\`）。复制整个 JSON 文件到新机器对应位置即可完成迁移，也可在「设置 → 数据备份」中导出/导入。

</details>

<details>
<summary><b>🔒 软件会联网吗？会发送我的数据吗？</b></summary>

**完全不会。** 应用不包含任何网络请求代码，没有遥测、没有崩溃上报、没有自动更新检查。所有功能（提示音、白噪音、统计图表）都靠本地计算与 Web Audio 合成实现。欢迎审查源码。

</details>

<details>
<summary><b>🛡️ Windows 弹出 SmartScreen 警告怎么办？</b></summary>

因应用未经过 EV 代码签名证书累积信誉，首次运行 Windows 可能拦截。点击「更多信息 → 仍要运行」即可。如不放心，可下载源码自行 `npm start` 或编译。

</details>

<details>
<summary><b>⏱️ 严格模式开启后想跳过休息怎么办？</b></summary>

严格模式的设计目的就是阻止「跳过休息」的冲动。如确需跳过，请到「设置 → 专注守护」中先关闭严格模式，再使用 <kbd>S</kbd> 跳过。这是有意为之的摩擦力。

</details>

<details>
<summary><b>🍎 为什么默认是浅色（苹果白）而不是深色？</b></summary>

深色主题会作为后续可选项提供。默认浅色是基于苹果白高端风格的整体设计语言决策——浅色背景 + #007aff 强调色 + 柔和阴影，更适合长时间专注阅读。

</details>

---

## ☕ 支持我们

> 番茄管家是一款 **完全开源、零广告、零追踪** 的本地软件。如果它帮到了你，欢迎在爱发电请我们喝杯咖啡。

<table>
<tr>
<td width="50%" valign="top">

### 🌟 爱发电支持

<a href="https://www.ifdian.net/a/giquwei">
  <img src="https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-%E7%AB%8B%E5%8D%B3%E6%94%AF%E6%8C%81-007aff?style=for-the-badge&logo=buymeacoffee&logoColor=white" alt="爱发电支持">
</a>

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

</td>
<td width="50%" valign="top">

### 💎 支持者权益

- 📛 **鸣谢墙留名**（可署名 / 匿名）
- 🎁 **优先内测**新版本与新功能
- 🗳 **投票权**：决定下一阶段优化方向
- 💌 **专属反馈通道**：直达开发者

</td>
</tr>
</table>

> 即使不捐款，**给项目点个 Star ⭐** 也是对我们最大的鼓励。

---

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加 -->

_暂无，期待第一个支持者的出现。_

---

## 📄 License

[MIT](./LICENSE) · © 2026 youqu · 自由使用、修改、分发

<p align="center">
  <sub>🍅 专注 25 分钟 · 休息 5 分钟 · 重复直到心流</sub>
</p>
