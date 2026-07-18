<div align="center">

# 👁 护眼管家 · 便携版

**像输入法一样的护眼提醒 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。**

基于 20-20-20 法则，原生 Python 重写，托盘常驻 + 全局热键 + 失焦自动隐藏 + 定时休息覆盖层。

<img src="https://img.shields.io/badge/平台-Windows%2010%2F11-007aff?style=flat-square" alt="platform">
<img src="https://img.shields.io/badge/技术栈-Python%203.12%20%2B%20customtkinter-34c759?style=flat-square" alt="stack">
<img src="https://img.shields.io/badge/版本-v1.0.0-ff9500?style=flat-square" alt="version">
<img src="https://img.shields.io/badge/风格-苹果白-f5f5f7?style=flat-square&logo=apple&logoColor=1d1d1f" alt="style">
<img src="https://img.shields.io/badge/体积-~18MB%20单exe-5856d6?style=flat-square" alt="size">
<img src="https://img.shields.io/badge/测试-33%20passing-34c759?style=flat-square" alt="tests">

</div>

---

> 🍎 苹果白高端风格 · 纯本地运行不联网 · 单 exe 便携分发 · 内存 <40MB · 秒级启动
> 不是 Electron 外壳，不是网页套壳，是原生、轻量、贴系统的小组件。

## 📥 下载

### 便携版单文件（推荐）

👉 [**EyeRestPortable.exe**](https://github.com/grrtyre/youqu/releases/tag/eye-rest-manager-portable-v1.0.0)

- 单文件 exe，无需安装，双击即用
- 体积约 18MB，内存占用 <40MB
- Windows 10/11 64 位 · 无需 Python 环境

### 源码运行

```bash
git clone https://github.com/grrtyre/youqu.git
cd youqu/eye-rest-manager/portable
pip install -r requirements.txt
python src/main.py
```

---

## ✨ 功能特性

| 特性 | 说明 |
|------|------|
| 🎯 **20-20-20 法则** | 每 20 分钟看 20 英尺外 20 秒，科学缓解眼疲劳 |
| ⏰ **三级休息周期** | 微休息 20s / 短休息 3min / 长休息 10min，间隔时长可自定义 |
| 👁 **眼保健操引导** | 6 种护眼动作（眨眼/远眺/转动/捂眼/聚焦/喝水），休息时轮播引导 |
| 🖥 **休息覆盖层** | 全屏半透明遮罩 + 中央投影白卡 + 大圆环倒计时 + 动作引导 |
| 📊 **本地统计** | 今日完成/跳过、连续天数、近 7 天柱状图，纯本地存储 |
| 🔕 **智能调度** | 免打扰时段、全屏自动推迟、休息前预警，不打扰专注 |
| 🔒 **严格模式** | 休息时不可跳过/延后/关闭，强制完成完整倒计时 |
| 🪟 **输入法式体验** | 失焦自动隐藏、托盘常驻、单实例锁，不占桌面 |
| ⌨️ **全局热键** | Ctrl+Shift+E 唤起 / Ctrl+Shift+B 立即休息 / Ctrl+Shift+P 暂停 |
| 🍎 **苹果白风格** | 白底卡片、细腻弥散阴影、#007aff 蓝色强调、系统字体 |

---

## 🎨 效果展示

<div align="center">

<sub><b>主面板（380×500）</b> —— 圆环倒计时 · 统计卡片 · 7 天柱状图</sub>

![主面板](./build/screenshot-panel.png)

<sub><b>休息覆盖层</b> —— 半透明遮罩 · 投影白卡 · 大圆环倒计时 · 护眼动作引导</sub>

![休息覆盖层](./build/screenshot-overlay.png)

<sub><b>严格模式</b> —— pill 徽章 · 休息时间锁定 · 不可跳过</sub>

![严格模式](./build/screenshot-strict.png)

</div>

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|:---:|:---|
| `Ctrl + Shift + E` | 显示 / 隐藏主面板 |
| `Ctrl + Shift + B` | 立即开始一次休息 |
| `Ctrl + Shift + P` | 暂停 / 恢复计时 |
| `Esc` | 隐藏面板 / 取消休息（非严格模式） |
| `托盘单击` | 显示主面板 |
| `托盘右键` | 菜单（立即休息/暂停/设置/退出） |

---

## 🚀 使用方式

1. 下载 `EyeRestPortable.exe`，双击运行
2. 应用自动驻留系统托盘，按 20-20-20 法则开始计时
3. 按 `Ctrl+Shift+E` 唤出主面板查看倒计时与统计
4. 倒计时结束时自动弹出休息覆盖层，跟随引导完成护眼动作
5. 右键托盘 →「设置」调整间隔、时长、严格模式与免打扰时段

---

## 📁 项目结构

```
portable/
├── src/
│   ├── main.py              # 入口：单实例 + 托盘 + 全局热键 + 调度引擎 + 失焦隐藏
│   ├── panel.py             # 主面板（380×500，圆环倒计时 + 统计 + 柱状图）
│   ├── overlay.py           # 全屏休息覆盖层（半透明遮罩 + 投影白卡 + 动作引导）
│   ├── settings_window.py   # 设置窗口（休息周期 + 严格模式 + 免打扰）
│   ├── core.py              # 核心逻辑（调度引擎 + 动作库 + 持久化 + 统计）
│   ├── styles.py            # 苹果白主题配色
│   └── winapi.py            # Win32 API（热键 + 单实例 + PrintWindow 后台截图）
├── assets/
│   └── icon.ico             # 应用图标
├── build/
│   ├── screenshot.py        # 后台截图脚本（PrintWindow，不抢焦点）
│   ├── build_exe.py         # PyInstaller 单 exe 构建脚本
│   └── make_icon.py         # 图标生成脚本
├── tests/
│   └── test_core.py         # 33 个单元测试
├── requirements.txt
└── README.md
```

---

## 🛠 技术栈

- **Python 3.12** + **customtkinter 6.0**（现代化苹果白控件）
- **pystray**（系统托盘）+ **Pillow**（图标处理）
- **Win32 API**（ctypes）：RegisterHotKey 全局热键、CreateMutex 单实例、PrintWindow 后台截图
- **PyInstaller**：单 exe 便携分发

### 为什么不用 Electron？

便携版追求极致轻量：内存 <40MB、单 exe 分发、秒级启动。Electron 动辄 100MB+ 内存、200MB+ 安装包，不符合"像输入法一样"的体验理念。原生 Python + customtkinter 在保留苹果白精致视觉的同时，体积仅 ~18MB。

---

## 🧪 测试

```bash
python tests/test_core.py
```

33 个单元测试覆盖：设置归一化（7）、免打扰时段（4）、休息调度（2）、状态机（4）、时间计算（2）、动作库（4）、存储持久化（8）、格式化（2）。

---

## 📝 更新日志

### v1.0.0（2026-07-18）

- 🎉 首个便携版发布（原生 Python 重写，非 Electron）
- 输入法式体验：托盘常驻 + 全局热键 + 失焦自动隐藏 + 单实例锁
- 20-20-20 法则三级休息调度（微/短/长），间隔时长可自定义
- 全屏休息覆盖层：半透明遮罩 + 投影白卡 + 大圆环倒计时 + 6 种护眼动作引导
- 严格模式：pill 徽章 + 休息时间锁定，不可跳过/延后/关闭
- 本地统计：今日完成/跳过、连续天数、近 7 天柱状图
- 智能调度：免打扰时段、全屏自动推迟、休息前预警
- 苹果白高端风格：圆环断点渐隐、Canvas 阴影卡片、鲜亮绿圆环、SF Symbols 线性图标
- 单 exe 便携分发（~18MB），mimo 审美评分通过

---

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡 —— 你的支持是我们持续优化的动力 ☕

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

---

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

---

## 📄 License

[MIT License](../../LICENSE) · © 2026 grrtyre
