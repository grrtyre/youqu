<div align="center">

# 📱 二维码便携版 · QR Manager Portable

**像输入法一样贴系统的小组件 · 原生 PySide6 · 苹果白高端风格**

<img alt="version" src="https://img.shields.io/badge/%E7%89%88%E6%9C%AC-v1.0.0-007aff?style=flat-square">
<img alt="platform" src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-007aff?style=flat-square">
<img alt="license" src="https://img.shields.io/badge/License-MIT-007aff?style=flat-square">
<img alt="lang" src="https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-Python%203.12-007aff?style=flat-square">
<img alt="size" src="https://img.shields.io/badge/%E5%8E%9F%E7%94%9F-PySide6-007aff?style=flat-square">

</div>

> 全局热键 `Ctrl+Alt+Q` 唤起 · 失焦自动隐藏 · 系统托盘常驻 · ≤400×500 小界面
> 不依赖 Electron · 不联网 · 数据全部本地

---

## 🎯 设计理念

不是 Electron 外壳，不是网页套壳。原生 Python + PySide6 实现，
像输入法候选框一样 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

| 特性 | 说明 |
|---|---|
| 🔥 全局热键 | `Ctrl+Alt+Q` 任意位置一键唤起 / 隐藏 |
| 👻 失焦自动隐藏 | 切到其他窗口 250ms 后自动消失，不抢桌面 |
| 📌 系统托盘常驻 | 关闭窗口不退出，后台静默运行 |
| 🪟 小界面 ≤400×500 | 380×500 紧凑布局，鼠标附近弹出 |
| 🎨 苹果白高端风格 | `#007aff` 蓝色强调 · 细腻阴影 · 系统字体 |

## ✨ 功能特性

| 分类 | 能力 |
|---|---|
| 📝 多类型生成 | 文本 / 网址 / WiFi / 邮箱 / 电话 / 短信，一键切换 |
| ⚡ 实时预览 | 输入即生成，无需点击按钮 |
| 📋 一键复制图片 | 复制 QR 位图到剪贴板，可直接粘贴到微信/QQ |
| 💾 导出 PNG | 高清 512×512 PNG 保存 |
| 🔍 图片识别 | 选择本地图片识别其中的二维码 |
| 📜 历史记录 | 自动保存最近 20 条，一键复用 |
| ⌨️ 剪贴板生成 | 托盘菜单「用剪贴板内容生成」快速生码 |
| 🔒 纯本地离线 | 无网络请求，不上传任何数据 |

## ⬇️ 下载与使用

| 方式 | 下载 | 说明 |
|---|---|---|
| 便携版单 EXE | [QR-Manager-Portable-1.0.0.exe](../../releases/download/qr-manager-portable-v1.0.0/QR-Manager-Portable-1.0.0.exe) | 免安装，双击即用，约 50MB |
| 源码运行 | 见下方「开发」 | 需 Python 3.10+ |

## 📖 使用方式

### 基础用法

1. 双击 `QR-Manager-Portable.exe` 启动
2. 系统托盘出现📱图标，主界面自动弹出
3. 选择类型（文本/网址/WiFi/邮箱/电话）
4. 输入内容，右侧实时生成 QR
5. 点击「复制图片」或「保存 PNG」即可

### 进阶技巧

- **任意位置按 `Ctrl+Alt+Q`** → 在鼠标附近唤起小窗口
- **切到其他窗口** → 250ms 后自动隐藏，不占桌面
- **右键托盘图标 → 用剪贴板内容生成** → 复制一段文字后直接生码
- **历史记录点击** → 一键复用之前的内容

### WiFi 二维码示例

在「WiFi」标签页输入 WiFi 名称、密码、加密方式，生成后手机扫码即可连接，无需手动输入密码。

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + Alt + Q` | 全局：唤起 / 隐藏主窗口 |
| `Esc`（隐含） | 失焦自动隐藏 |
| 单击托盘图标 | 显示 / 隐藏主窗口 |

## 🛠 技术栈

| 类别 | 实现 |
|---|---|
| 语言 | Python 3.12 |
| UI 框架 | PySide6 6.11（Qt for Python） |
| QR 生成 | `qrcode` 库 |
| QR 识别 | `pyzbar` + ZBar |
| 全局热键 | `keyboard` 库 |
| 系统托盘 | `QSystemTrayIcon` |
| 打包 | PyInstaller `--onefile --noconsole` |
| 设计风格 | 苹果白高端风格 · `#007aff` 蓝色强调 |

## 💻 开发

```bash
# 进入便携版目录
cd youqu/qr-manager/portable

# 安装依赖
pip install -r requirements.txt

# 运行核心逻辑测试
python test_core.py

# 启动应用
python qr_widget.py

# 构建便携版单 EXE
build.bat
```

## 📁 项目结构

```
qr-manager/
├── (Electron 原版文件…)
└── portable/                  # ← 便携版（本目录）
    ├── qr_widget.py           # 主程序（UI + 核心逻辑）
    ├── test_core.py           # 核心逻辑单元测试
    ├── requirements.txt       # Python 依赖
    ├── build.bat              # PyInstaller 构建脚本
    └── README.md              # 本文件
```

## 🎨 设计语言

- **风格** —— 苹果白高端风格，参考 macOS / iOS 原生设计
- **背景** —— 浅灰 `#f5f5f7` + 白色卡片
- **强调色** —— Apple Blue `#007aff`
- **字体** —— 系统字体栈（SF Pro / PingFang SC / Microsoft YaHei）
- **阴影** —— 细腻柔和，`0 4px 28px rgba(0,0,0,0.05)`
- **圆角** —— 卡片 12px · 按钮 8px · 输入框 8px

## 🧪 测试

核心逻辑有 **10 项自动化测试** 覆盖：

```bash
python test_core.py
```

覆盖范围：6 种类型内容构建（含 WiFi 特殊字符转义）、QR 生成、图片识别往返、历史记录去重与裁剪。

## 🔒 隐私说明

- **完全本地** —— 配置和历史保存在 `~/.qr-manager-portable/`
- **无网络请求** —— 不联网、不上传、不统计
- **无第三方云服务** —— 仅依赖本地 Python 库

## 📝 更新日志

### v1.0.0（便携版首发）

- 原生 PySide6 重写，摆脱 Electron 依赖
- 全局热键 `Ctrl+Alt+Q` 唤起 / 隐藏
- 失焦自动隐藏 + 系统托盘常驻
- 5 种类型生成：文本 / 网址 / WiFi / 邮箱 / 电话
- 实时预览 + 一键复制图片 + 保存 PNG
- 图片识别（pyzbar）
- 历史记录（最近 20 条，去重）
- 苹果白高端风格 UI

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](../../LICENSE) —— 可自由使用、修改、分发。

## 🔗 相关项目

- [二维码管家（Electron 原版）](../README.md) —— youqu 工具集一员
- [youqu 工具集](https://github.com/grrtyre/youqu) —— 更多苹果白风格的实用小工具
