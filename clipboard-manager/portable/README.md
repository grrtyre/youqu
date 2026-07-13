# 📋 剪贴板管家·便携版

> 输入法式体验的剪贴板历史管理器。原生 Python + PySide6，单 EXE 便携分发，无需安装、不写注册表、不联网。

全局热键 `Ctrl+Shift+V` 唤起，失焦自动隐藏，系统托盘常驻。界面尺寸 380×500，参考 Windows 输入法候选框 / macOS 菜单栏 widget 设计，与原版剪贴板管家完全独立、互不干扰。

## ⬇️ 直接下载

| 版本 | 下载链接 | 说明 |
| --- | --- | --- |
| v1.0.0 便携版 | [ClipboardManager-Portable.exe](https://github.com/grrtyre/youqu/releases/download/clipboard-manager-portable-v1.0.0/ClipboardManager-Portable.exe) | 42.65 MB · 双击即用，不写注册表 |

> 完整发布说明见 [Release v1.0.0](https://github.com/grrtyre/youqu/releases/tag/clipboard-manager-portable-v1.0.0)。

系统要求：Windows 10/11 x64

## ✨ 功能特性

- **输入法式体验** —— 全局热键 `Ctrl+Shift+V` 唤起、失焦自动隐藏、系统托盘常驻，不打断当前工作流
- **小界面** —— 380×500 紧凑窗口，光标附近弹出，参考 Windows 输入法候选框设计
- **自动记录** —— 后台静默捕获所有剪贴板文本，去重存储，最多保留 500 条
- **智能分类** —— 自动识别代码 / 链接 / 邮箱 / 电话 / 文本，左侧色条 + 类型 pill 双重视觉标记
- **键盘导航** —— `↑ ↓` 选择条目，`Enter` 复制并自动粘贴到前台窗口，`Esc` 关闭
- **一键粘贴到前台窗口** —— 选中条目后自动模拟 `Ctrl+V` 粘贴到上一个前台窗口
- **置顶与收藏** —— 常用片段可置顶或收藏，置顶项始终排在列表最前
- **即时搜索 + 筛选** —— 实时搜索历史内容，按类型筛选（全部 / 收藏 / 代码 / 链接 / 文本）
- **隐私优先** —— 数据全部本地存储（JSON），不联网、不上传、不登录
- **单实例锁** —— 同时只能运行一个实例，避免冲突
- **苹果白高端风格** —— 浅色背景、细腻阴影、系统字体、`#007aff` 蓝色强调

## 🚀 使用方式

### 普通用户

1. 下载 `ClipboardManager-Portable.exe`
2. 双击运行（首次启动会在 EXE 同级目录创建 `data/` 文件夹存储数据）
3. 复制任何文本内容，会自动记录
4. 按 `Ctrl+Shift+V` 唤起面板
5. `↑ ↓` 选择条目，`Enter` 粘贴到当前光标位置
6. 点击托盘图标可显示/隐藏面板，右键托盘可退出

### 开发者

```bash
# 安装依赖
pip install -r requirements.txt

# 开发模式运行
python src/main.py

# 注入示例数据并显示窗口（用于截图测试）
python src/main.py --demo --show

# 运行单元测试
python -m pytest tests/

# 构建单 EXE
powershell -ExecutionPolicy Bypass -File build/build_exe.ps1

# 生成 UI 截图（后台 PrintWindow，不干扰前台）
powershell -ExecutionPolicy Bypass -File build/screenshot.ps1
```

## 🎨 设计风格

采用苹果白高端设计语言：

- 白色 / 浅灰背景，细腻阴影层次
- 系统字体 `Segoe UI, PingFang SC, Microsoft YaHei UI`
- 蓝色强调 `#007aff`（iOS 系统蓝）
- 类型色条：代码紫 `#6f42c1` · 链接蓝 `#007aff` · 邮箱绿 `#34c759` · 电话橙 `#ff9500` · 文本灰 `#5a5a5e`
- 卡片投影 `blurRadius 18, alpha 28, offset (0, 3)`，提供清晰层次

## 🛠 技术栈

- **Python 3.12** —— 原生开发，无 Web 包装
- **PySide6 6.11 (Qt 6)** —— GUI 框架，仅使用 QtCore / QtGui / QtWidgets
- **ctypes + Win32 API** —— 全局热键 `RegisterHotKey`、窗口粘贴 `keybd_event`、单实例锁 `CreateMutexW`
- **QAbstractNativeEventFilter** —— 拦截 `WM_HOTKEY` 消息实现全局热键
- **PyInstaller 6.15** —— `--onefile --noconsole` 打包，排除 30+ 个未使用的 PySide6 模块后体积 42.65 MB
- **PrintWindow API** —— 后台截图（flag 2 = `PW_RENDERFULLCONTENT`），不使用 `CopyFromScreen`，不打扰用户

## 📂 项目结构

```
clipboard-manager/portable/
├── src/
│   ├── main.py              # 主程序（窗口、热键、托盘、剪贴板监听）
│   ├── clipboard_core.py    # 核心数据逻辑（ClipboardStore, ClipboardItem, classify）
│   └── styles.py            # 苹果白 QSS 样式表
├── tests/
│   └── test_core.py         # 50 个单元测试
├── build/
│   ├── build_exe.ps1        # PyInstaller 构建脚本（纯 ASCII）
│   ├── screenshot.ps1       # PrintWindow 后台截图脚本（纯 ASCII）
│   └── icon.ico             # 应用图标
├── assets/
│   └── icon.ico             # 应用图标（与 build 共享）
├── dist/
│   └── ClipboardManager-Portable.exe  # 构建产物（42.65 MB）
├── requirements.txt
└── README.md
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Shift + V` | 唤起 / 隐藏面板 |
| `↑` / `↓` | 上 / 下选择条目 |
| `Enter` | 复制并粘贴到前台窗口 |
| `Esc` | 关闭面板 |
| 托盘单击 | 唤起 / 隐藏面板 |
| 托盘右键 → 退出 | 退出程序 |

## ☕ 支持我们

如果这个工具对你有帮助，欢迎请我们喝杯咖啡支持持续维护：

- 💝 爱发电：[https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：
<!-- 鸣谢名单占位 -->
_暂无，期待第一个支持者的出现。_

## 📄 License

MIT © youqu
