# ⏰ 闹钟管家 · 便携版（Portable）

> 像「输入法候选框」一样融入系统的小闹钟组件 —— 需要时出现，不需要时隐藏，托盘常驻，全局热键唤起。
> **原生 C# WPF .NET 8 实现，零 Electron 外壳，单 EXE 便携分发。**

## ✨ 便携版特性

- **原生轻量** —— C# WPF .NET 8 自包含单文件，启动亚秒级，内存占用 <50MB
- **输入法式体验** —— 失焦自动隐藏、贴右下角小窗 (360×480)，需要时一键唤起
- **全局热键唤起** —— `Ctrl + Alt + A` 一键显示/隐藏主窗口
- **系统托盘常驻** —— 关闭窗口不退出，托盘显示运行状态
- **单实例锁** —— 防止多开冲突
- **农历支持** —— 1900-2100 农历计算（移植自 Electron 版 `lunar.js`）
- **5 种合成铃声** —— 风铃 / 钟声 / 马林巴 / 蜂鸣 / 鸟鸣，全部 NAudio 实时合成，零外部音频文件
- **渐强音量** —— 触发后音量从 0 渐进至最大，避免突然大声惊吓
- **智能贪睡** —— 自定义贪睡时长、最大贪睡次数上限，防过度赖床
- **桌面通知** —— Windows 原生通知 + 弹出全屏触发窗口
- **本地存储** —— 原子写入 + 自动备份（`%APPDATA%/alarm-manager-portable/alarms.json`）
- **导入导出** —— JSON 备份/恢复，与 Electron 版数据兼容
- **触发历史** —— 最近 200 条触发日志
- **苹果白高端风格** —— 白色背景、细腻多层阴影、系统字体、蓝色 `#007aff` 强调

## ⬇️ 直接下载

| 版本 | 下载 | 说明 |
| --- | --- | --- |
| 便携版（单 EXE） | [闹钟管家-Portable-1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/alarm-manager-portable-v1.0.0/alarm-manager-portable-1.0.0.exe) | 免安装，双击即用，体积约 80MB |

## 🚀 使用方式

1. 下载 `闹钟管家-Portable-1.0.0.exe`，双击运行
2. 程序自动在系统托盘显示蓝色闹钟图标
3. 按 `Ctrl + Alt + A` 唤起主窗口
4. 点击右上角 + 创建闹钟
5. 失焦后窗口自动隐藏到托盘
6. 闹钟到点会弹出触发窗口并播放铃声

## ⌨️ 快捷键

| 操作 | 说明 |
| --- | --- |
| `Ctrl + Alt + A` | 唤起 / 隐藏主窗口 |
| `Esc`（触发窗口） | 关闭触发窗口（停止铃声） |
| `Space`（触发窗口） | 贪睡 |
| 托盘左键单击 | 显示主窗口 |
| 托盘右键 | 上下文菜单 |

## 🛠 技术栈

- **运行时**：.NET 8 WPF（self-contained + single-file）
- **托盘**：Hardcodet.NotifyIcon.Wpf
- **音频**：NAudio 2.2 实时合成
- **全局热键**：Win32 `RegisterHotKey` API
- **存储**：本地 JSON + 原子写入
- **数据兼容**：与 Electron 版 `alarm-manager` 同结构，可互相导入导出

## 📁 项目结构

```
portable/
├── AlarmManager.Portable.csproj   # 项目文件
├── app.manifest                   # DPI 感知 + 兼容性
├── App.xaml / App.xaml.cs          # 应用入口：单实例、托盘、热键、巡检
├── MainWindow.xaml(.cs)            # 主窗口：列表 + 编辑 + 设置
├── TriggerWindow.xaml(.cs)        # 闹钟触发弹窗
├── Styles/Theme.xaml               # 苹果白主题资源字典
├── Models/Alarm.cs                 # 闹钟数据模型
└── Core/
    ├── AlarmEngine.cs              # 闹钟调度引擎（移植自 alarm-engine.js）
    ├── Lunar.cs                    # 农历转换（移植自 lunar.js）
    ├── Store.cs                    # 本地存储（移植自 store.js）
    ├── SoundSynth.cs               # 5 种铃声合成
    └── GlobalHotkey.cs             # Win32 全局热键
```

## ☕ 支持我们

[爱发电 · giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📝 许可

MIT License
