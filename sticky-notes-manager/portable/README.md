<div align="center">

# 📝 便签管家便携版 · sticky-notes-manager portable

> 像输入法一样的便签体验：需要时出现，不需要时隐藏，融入系统，不占桌面。

<br>

![Version](https://img.shields.io/badge/版本-v1.0.0-007aff?style=flat-square)
![Platform](https://img.shields.io/badge/平台-Windows%2010%2F11-007aff?style=flat-square&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-007aff?style=flat-square)
![PySide6](https://img.shields.io/badge/PySide6-6.11-007aff?style=flat-square)
![风格](https://img.shields.io/badge/风格-苹果白高端-f5f5f7?style=flat-square)
![隐私](https://img.shields.io/badge/隐私-纯本地存储-34c759?style=flat-square)

<br>

**原生 Python + PySide6 重构**，非 Electron、非网页套壳。  
单 EXE 便携分发，零安装、零依赖、零联网。

</div>

---

## ⬇️ 直接下载

| 版本 | 下载链接 | 说明 |
|:---:|---|---|
| 📦 便携版 | [便签管家便携版 v1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/sticky-notes-manager-portable-v1.0.0/StickyNotesPortable.exe) | 双击即用，无需安装，不写注册表 |

> 系统要求：Windows 10/11 x64 ｜ 🔒 所有数据本地存储，绝不联网上传

---

## ✨ 设计理念

> 像输入法一样的体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面，不用切到主界面才能用。

不是 Electron 外壳，不是网页套壳，是原生、轻量、贴系统的小组件。

| 特性 | 说明 |
|---|---|
| 🎯 全局热键唤起 | `Ctrl+Alt+N` 唤起快速记录小窗（鼠标附近浮现） |
| 📚 便签列表小窗 | `Ctrl+Alt+L` 唤起便签列表（搜索/筛选/编辑/置顶/删除） |
| 🫥 失焦自动隐藏 | 输入完成点击别处自动淡出隐藏，不抢焦点 |
| 📌 系统托盘常驻 | 后台静默运行，托盘菜单快速访问所有功能 |
| 🪟 小界面（380×320 / 380×500）| 严格小窗口设计，参考输入法候选框/macOS 菜单栏小组件 |
| 🎨 苹果白高端风格 | 白色背景、细腻阴影、系统字体、蓝色 `#007aff` 强调 |
| 💾 数据兼容 | 与 Electron 版数据格式互通（version 2），可互相导入导出 |

---

## 🎮 快捷键

| 快捷键 | 功能 |
|:---:|---|
| `Ctrl+Alt+N` | 全局唤起「快速记录」小窗 |
| `Ctrl+Alt+L` | 全局唤起「便签列表」小窗 |
| `Ctrl+Enter` | 保存便签并关闭窗口 |
| `Ctrl+Shift+Enter` | 保存便签并继续记录下一条 |
| `Esc` | 关闭当前小窗 |

---

## 🖼️ 界面预览

### 快速记录小窗（输入法式唤起）

```
┌────────────────────────────────────────┐
│ 📝 快速记录     Esc 关闭 · Ctrl+Enter  │
├────────────────────────────────────────┤
│ 明天的会议议程                          │
├────────────────────────────────────────┤
│ 1. 开场介绍                             │
│ 2. 项目进度同步                         │
│ 3. 问题与决策                           │
│ 4. 下一步行动项                         │
├────────────────────────────────────────┤
│ 颜色 ● ● ● ● ● ● ●   分类 [工作 ▾]     │
├────────────────────────────────────────┤
│ 保存并继续      0 字  [取消] [保存并关闭]│
└────────────────────────────────────────┘
```

### 便签列表小窗

```
┌────────────────────────────────────────┐
│ 📚 便签列表              [＋ 新建] [×] │
│ 共 5 条 · 置顶 1 · 回收站 0 条          │
├────────────────────────────────────────┤
│ 🔍 搜索标题或内容…           [全部 ▾] │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ● 项目周会要点                📌 │ │
│ │ 1. Q4 路线图讨论…                │ │
│ │ [工作]  刚刚          [编辑][删除]│ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ● 灵感：苹果白配色方案          📍 │ │
│ │ 主色 #007aff · 背景 #f5f5f7…     │ │
│ │ [灵感]  2 分钟前      [编辑][删除]│ │
│ └──────────────────────────────────┘ │
│ ...                                    │
├────────────────────────────────────────┤
│ 🗑 回收站                  暂无便签   │
└────────────────────────────────────────┘
```

---

## 🛠️ 技术栈

| 模块 | 技术 |
|---|---|
| UI 框架 | PySide6 6.11（Qt 6 原生绑定） |
| 全局热键 | `keyboard` 库（系统级钩子，子线程注册） |
| 数据存储 | JSON 本地文件（`%APPDATA%\sticky-notes-portable\notes.json`） |
| 系统托盘 | `QSystemTrayIcon`（原生 Windows 托盘） |
| 窗口效果 | `Qt.FramelessWindowHint` + `QGraphicsDropShadowEffect` + 淡入淡出动画 |
| 截图测试 | Win32 `PrintWindow` API（PW_RENDERFULLCONTENT，后台无打扰截取） |
| 打包 | PyInstaller `--onefile --noconsole` 单 EXE 分发 |

### 与 Electron 版对比

| 维度 | Electron 版 | 便携版 |
|---|---|---|
| 启动时间 | 2-3 秒 | < 1 秒 |
| 内存占用 | ~150MB | ~50MB |
| 安装方式 | NSIS 安装包 | 单 EXE 双击即用 |
| 体积 | ~120MB | ~50MB（含 PySide6 运行时） |
| 用户体验 | 主窗口模式 | 输入法式小窗 |

---

## 📁 项目结构

```
portable/
├── main.py              # 入口：托盘 + 全局热键 + 单实例锁
├── note_store.py        # 数据层（与 Electron 版格式兼容）
├── capture_window.py    # 快速捕获小窗（输入法式）
├── list_window.py       # 便签列表小窗
├── styles.py            # QSS 苹果白风格表
├── screenshot_harness.py# 后台截图脚本（PrintWindow + Qt.grab）
├── test_note_store.py   # 数据层测试（65 项全通过）
├── build.bat            # PyInstaller 打包脚本
├── requirements.txt     # Python 依赖
└── README.md            # 本文档
```

---

## 🚀 从源码运行

```bash
# 安装依赖
pip install -r requirements.txt

# 运行
python main.py

# 打包
build.bat
```

---

## 🔒 隐私

- 所有便签数据存储在 `%APPDATA%\sticky-notes-portable\notes.json`
- 不联网、不上传、不收集任何信息
- 数据格式与 Electron 版互通，可手动迁移

---

## ☕ 支持我们

如果这个工具对你有帮助，欢迎支持我们持续开发：

[![爱发电](https://img.shields.io/badge/爱发电-支持我们-ff5e5e?style=for-the-badge)](https://www.ifdian.net/a/giquwei)

---

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

---

## 📜 License

MIT License © 2026 grrtyre
