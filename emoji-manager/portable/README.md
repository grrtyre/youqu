# 😊 表情管家便携版

> 苹果白高端风格的输入法式 emoji 选择器。全局热键唤起、光标处弹出、点击复制、失焦自动隐藏、系统托盘常驻，像输入法一样融入系统。原生 PySide6 重写，非 Electron 外壳。

## ✨ 便携版 vs 原版

| 特性 | 原版（Electron） | 便携版（PySide6 原生） |
|---|---|---|
| 体积 | ~73 MB 安装包 | 44 MB 单 exe，免安装 |
| 内存 | ~150-200 MB | <60 MB |
| 启动 | 1-2 秒 | 瞬间启动 |
| 界面 | 主窗口 1080×720 | 输入法式小组件 380×460 |
| 唤起 | 点击图标/快捷方式 | 全局热键 Ctrl+Shift+E 随时唤起 |
| 隐藏 | 最小化到任务栏 | 失焦自动隐藏，托盘常驻 |
| 弹出位置 | 屏幕中央 | 跟随光标，像输入法候选框 |
| 依赖 | 需安装 | 单 exe 直接运行，无运行时依赖 |

## 🎯 系统融入特性

- **全局热键唤起** —— `Ctrl+Shift+E` 随时唤出表情面板，无需切窗口
- **失焦自动隐藏** —— 点击别处立刻消失，像输入法候选框
- **系统托盘常驻** —— 托盘图标 + 右键菜单（显示/清空历史/退出）
- **跟随光标位置弹出** —— 在光标附近出现，像输入法
- **小界面** —— 380×460 紧凑尺寸，圆角阴影
- **点击即复制** —— 点击任意 emoji 立即复制到剪贴板并隐藏
- **本地收藏** —— 常用表情加星收藏，橙色标记一目了然
- **使用历史** —— 自动记录最近使用的 50 个表情
- **关键词搜索** —— 支持中文名、关键词、字符三种搜索方式
- **11 大分类** —— 笑脸、手势、动物、食物、活动、旅行、物品、符号、旗帜、颜文字、特殊符号

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [emoji-portable.exe](../../releases/download/emoji-manager-portable-v1.0.0/emoji-portable.exe) | v1.0.0 单文件便携版，免安装 |

> 也可在 [Releases 页面](../../releases) 查看所有版本。

## 🚀 使用方式

1. 下载 `emoji-portable.exe`
2. 双击运行（无需安装）
3. 系统托盘出现表情管家图标，应用已在后台运行
4. 任意时刻按 `Ctrl+Shift+E` 唤出表情面板
5. 点击分类图标切换分类，或输入关键词搜索
6. 点击任意 emoji 立即复制到剪贴板
7. 点击右侧星标收藏/取消收藏
7. 按 `Esc` 或点击别处隐藏面板

## ⌨️ 操作示例

```
Ctrl+Shift+E          → 唤起/隐藏表情面板
输入 "猫"             → 搜索猫相关表情
输入 "开心"           → 搜索关键词匹配
点击 😀              → 复制 😀 到剪贴板，面板隐藏
点击 ☆               → 加入收藏，变橙色 ★
点击托盘图标           → 显示表情面板
```

## 🛠 技术栈

- **Python 3.12 + PySide6** —— 原生 QWidget，非网页套壳
- **Windows API** —— RegisterHotKey 全局热键、PrintWindow 后台截图
- **本地 JSON 存储** —— 收藏与历史持久化到 %APPDATA%
- **PyInstaller** —— 单 exe 便携分发，无运行时依赖
- **苹果白设计系统** —— 白底浅灰、细腻阴影、系统字体、#007aff 强调色

## 📁 目录结构

```
emoji-manager/portable/
├── src/
│   ├── main.py              # 主程序：UI、热键、托盘、失焦隐藏
│   ├── emoji_core.py        # 搜索/过滤/去重逻辑
│   ├── emoji_data.py        # 1287 个 emoji 数据（11 分类）
│   └── store.py             # 收藏与历史本地存储
├── assets/
│   ├── icon.png             # 应用图标
│   └── icon.ico             # Windows 图标（多尺寸）
├── tests/
│   └── test_core.py         # 14 个单元测试
├── build/
│   ├── convert_data.py      # JS 数据转 Python 模块
│   ├── shot_bg.py           # 后台截图脚本（按 PID）
│   ├── shot_by_title.py     # 后台截图脚本（按标题，兼容 onefile）
│   └── build_exe.ps1        # PyInstaller 打包脚本
├── emoji-portable.spec      # PyInstaller 配置
├── requirements.txt         # Python 依赖
├── README.md                # 本文档
└── emoji-portable.exe       # 编译产物
```

## 🧪 测试

```bash
cd portable
python tests/test_core.py
```

覆盖 14 项测试：分类加载、数据完整性、搜索（中文名/关键词/字符/大小写）、分类过滤、去重、结果合并、收藏切换、历史去重与上限、持久化。

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
