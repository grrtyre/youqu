# 📌 置顶管家 · 便携版

> Windows 窗口置顶管理小组件 —— 像输入法一样驻留系统托盘，需要时出现，不需要时隐藏。原生 Python 重写，单文件 EXE，启动快、内存低。

## ✨ 便携版特点

- **原生重写** —— Python + customtkinter + ctypes 直调 Win32 API，无 Electron / 网页套壳
- **单文件 EXE** —— PyInstaller --onefile 打包，免安装双击即用
- **轻量低耗** —— 内存占用 ~30MB，冷启动 <1 秒
- **输入法式体验** —— 托盘常驻，全局热键唤起，失焦自动隐藏，小界面 380×480
- **苹果白风格** —— 白底浅灰、细腻边框、#007aff 蓝色强调、系统字体
- **核心功能完整** —— 窗口列表、一键置顶、透明度调节、自动置顶规则、星标快速入规则、搜索过滤

## 🚀 使用方式

1. 双击 `置顶管家-便携版.exe` 启动
2. 启动后驻留系统托盘，并弹出 toast 提示
3. 按 `Ctrl+Alt+T` 切换当前前台窗口的置顶状态
4. 单击托盘图标唤起主窗口，可视化操作

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Alt+T` | 全局：置顶 / 取消置顶当前前台窗口 |
| `Esc` | 关闭主窗口（驻留托盘） |

## 🖼 主界面

- 顶部：标题栏（可拖动）+ 关闭 + 刷新
- 搜索框：按标题或进程名即时过滤
- 窗口列表：每行显示头像 + 标题 + 进程名 + 置顶开关 + 透明度滑条 + 星标
  - 置顶窗口排前面，蓝色高亮
  - 置顶时显示透明度滑条（10%–100%）
  - ★ 把当前进程加入自动置顶规则；☆ 表示未在规则
- 底部：自动置顶总开关 + 规则数 + 版本号

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| UI | customtkinter 6（基于 tkinter，苹果白主题） |
| Win32 API | ctypes 直接调用（EnumWindows / SetWindowPos / SetLayeredWindowAttributes） |
| 系统托盘 | pystray |
| 全局热键 | keyboard |
| 图标 | Pillow 纯代码生成 |
| 打包 | PyInstaller --onefile |

## 📁 项目结构

```
portable/
├── main.py            # 入口：托盘+热键+主窗口+自动置顶定时器
├── win32_api.py       # ctypes Win32 封装（枚举/置顶/透明度/前台窗口）
├── store.py           # 自动置顶规则持久化（纯函数，可单测）
├── ui.py              # customtkinter 主窗口（苹果白）
├── tray.py            # pystray 系统托盘
├── hotkey.py          # keyboard 全局热键
├── toast.py           # 轻量 toast 通知
├── icon.py            # PIL 生成托盘图标
├── test_core.py       # 核心逻辑测试
├── build.py           # PyInstaller 打包脚本
├── requirements.txt
└── README.md
```

## 🧪 测试

```bash
python test_core.py
```

覆盖：规则持久化往返、大小写归一化、去重、启用/禁用、命中判断、Win32 枚举健壮性、透明度边界、图标生成。

## 📊 与 Electron 原版对比

| 维度 | Electron 原版 | 便携版 |
|---|---|---|
| 体积 | ~75 MB | ~15-20 MB |
| 内存 | ~120-180 MB | ~30 MB |
| 启动 | 2-3 秒 | <1 秒 |
| 依赖 | Node.js + npm | 单 EXE |
| Win32 调用 | C# + PowerShell 常驻桥接进程 | ctypes 直调，无桥接进程 |
| 界面 | Chromium 渲染 | 原生 tkinter |

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](../LICENSE)
