# 世界时钟·便携版

> 像输入法一样的看时间体验 —— 需要时出现，不需要时隐藏，融入系统，不占桌面。

Windows 桌面端便携版，基于 Python + PySide6 原生开发，单 EXE 分发，无需安装。

## 下载

前往 [Releases](https://github.com/grrtyre/youqu/releases) 下载 `WorldClock-Portable.exe`（约 180MB），双击即可运行，无需安装。

## 功能

- **全局热键唤起**：`Ctrl+Shift+W` 随时呼出/隐藏面板
- **失焦自动隐藏**：点击其他区域自动收起，不抢焦点
- **系统托盘常驻**：后台静默运行，单击托盘图标也可唤起
- **小界面**：380×460（含边框 396×499），定位在屏幕右下角
- **多时区时钟**：添加/删除城市，每秒刷新，点击卡片复制时间
- **时间戳转换**：Unix 时间戳 / ISO 字符串互转，支持多时区
- **昼夜标识**：色点 + 文字标注白天/夜晚
- **本地配置**：城市列表保存在本地 `config.json`

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+W` | 唤起 / 隐藏面板 |
| `Esc` | 隐藏面板（不退出） |
| 单击托盘图标 | 显示 / 隐藏面板 |
| 中键点击托盘 | 显示面板 |
| 右键托盘 | 菜单（显示面板 / 退出） |

## 项目结构

```
portable/
├── src/
│   ├── main.py         # 主入口：热键、托盘、单实例锁
│   ├── panel.py        # 面板 UI：时区卡片、时间戳转换
│   ├── styles.py       # QSS 苹果白样式
│   └── tz_core.py      # 时区计算核心
├── build/
│   ├── build_exe.ps1   # PyInstaller 构建脚本
│   ├── screenshot.ps1  # PrintWindow 后台截图脚本
│   ├── hard_cleanup.ps1  # 强制清理残留进程
│   └── clean_temp.ps1    # 清理 PyInstaller 临时文件
├── requirements.txt    # PySide6==6.11.1
└── README.md
```

## 技术栈

- Python 3.12 + PySide6 6.11.1（Qt 6 for Python）
- PyInstaller 6.15.0（--onefile --noconsole 单 EXE 打包）
- Win32 API（ctypes）：RegisterHotKey、CreateMutex、PrintWindow
- zoneinfo 标准库（IANA 时区数据库）

## 构建

```powershell
# 安装依赖
pip install PySide6==6.11.1 pyinstaller

# 构建 EXE
powershell -ExecutionPolicy Bypass -File build/build_exe.ps1
```

## 设计理念

苹果白高端风格：白色/浅灰背景、细腻阴影、系统字体、蓝色强调色（#007aff）。
参考 Windows 输入法候选框 / macOS 菜单栏小部件的交互模式。

## ☕ 支持我们

如果这个项目对你有帮助，欢迎支持：

[爱发电](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

- PySide6 / Qt 项目
- PyInstaller 项目
- 所有时区数据贡献者

## 更新日志

- 2026-07-21：便携版 v1.0 发布
