# 🧮 计算器便携版

> 苹果白高端风格的 Spotlight 式计算器小组件。全局热键唤起、失焦自动隐藏、系统托盘常驻、实时求值，像输入法一样融入系统。原生 PySide6 重写，非 Electron 外壳。

## ✨ 便携版 vs 原版

| 特性 | 原版（Electron） | 便携版（PySide6 原生） |
|---|---|---|
| 体积 | ~73 MB 安装包 | 44 MB 单 exe，免安装 |
| 内存 | ~150-200 MB | <10 MB |
| 启动 | 1-2 秒 | 瞬间启动 |
| 界面 | 主窗口 + 多模式切换 | 小组件式（420×320），输入法候选框体验 |
| 唤起 | 点击图标/快捷方式 | 全局热键 Ctrl+Alt+C 随时唤起 |
| 隐藏 | 最化到任务栏 | 失焦自动隐藏，托盘常驻 |
| 依赖 | 需安装 | 单 exe 直接运行，无运行时依赖 |

## 🎯 系统融入特性

- **全局热键唤起** —— `Ctrl+Alt+C` 随时唤出计算器，无需切窗口
- **失焦自动隐藏** —— 点击别处立刻消失，像输入法候选框
- **系统托盘常驻** —— 托盘图标 + 右键菜单（显示/退出），关闭即隐藏
- **跟随光标位置弹出** —— 在屏幕中上方出现，贴近视线焦点
- **小界面** —— 420×320 紧凑尺寸，半透明圆角阴影
- **实时求值** —— 输入即计算，无需按等号
- **结果自动复制** —— Enter 确认后结果自动进剪贴板
- **历史记录** —— 上下键浏览历史表达式
- **变量系统** —— 支持 `x = 5` 定义变量，持久化存储
- **快捷符号** —— π e ^ ! ( ) √ sin 一键插入

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [calculator-portable.exe](../../releases/download/calculator-manager-portable-v1.0.0/calculator-portable.exe) | v1.0.0 单文件便携版，免安装 |

> 也可在 [Releases 页面](../../releases) 查看所有版本。

## 🚀 使用方式

1. 下载 `calculator-portable.exe`
2. 双击运行（无需安装）
3. 系统托盘出现蓝色计算器图标，应用已在后台运行
4. 任意时刻按 `Ctrl+Alt+C` 唤起计算器
5. 输入表达式，实时显示结果
6. 按 `Enter` 确认并复制结果到剪贴板
7. 按 `Esc` 清空或隐藏

## ⌨️ 操作示例

```
2 + 3 * 4              → 14
sin(pi/2)              → 1
sqrt(16)               → 4
5!                     → 120
x = 5                  → 已设置 x = 5
x * x + 1              → 26
0xFF + 0x01            → 256
```

## 🛠 技术栈

- **Python 3.12 + PySide6** —— 原生 QWidget，非网页套壳
- **Windows API** —— RegisterHotKey 全局热键、PrintWindow 后台截图
- **自研表达式引擎** —— 词法分析 + Shunting Yard + RPN 求值，移植自原版
- **PyInstaller** —— 单 exe 便携分发，无运行时依赖
- **苹果白设计系统** —— 白底浅灰、细腻阴影、系统字体、#007aff 强调色

## 📁 目录结构

```
calculator-manager/portable/
├── src/
│   ├── app.py              # 主程序：UI、热键、托盘、失焦隐藏
│   └── calc_engine.py      # 表达式引擎（词法+语法+求值）
├── assets/
│   ├── icon.png            # 应用图标
│   └── icon.ico            # Windows 图标（多尺寸）
├── tests/
│   └── test_calc_engine.py # 64 个单元测试
├── build/
│   ├── shot_bg.py          # 后台截图脚本（PrintWindow）
│   └── make_icon.py        # 图标生成脚本
├── build.ps1               # 构建脚本
├── README.md               # 本文档
└── calculator-portable.exe # 编译产物
```

## 🧪 测试

```bash
cd portable
python -m pytest tests/
```

覆盖 64 项测试：词法、四则运算、函数、常量、变量、阶乘（含 Gamma）、进制、位运算、格式化、错误处理。

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](../LICENSE) —— 可自由使用、修改、分发。
