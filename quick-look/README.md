# 速览管家

> Windows 平台仿 Mac QuickLook 的极速文件预览工具，按 `Alt + Q` 一键唤起，无需打开任何应用即可预览各类文件。

<p align="center">
  <img src="build/icon-source.png" alt="速览管家" width="120">
</p>

## ✨ 功能特性

- **一键唤起**：全局快捷键 `Alt + Q` 随时唤起，再次按下或失焦自动隐藏，不打断工作流
- **资源管理器集成**：自动读取当前选中的文件并预览，零学习成本
- **多通道预览**：拖拽文件到窗口、点击选择、从历史记录打开均可
- **全格式支持**：
  - 图片：JPG / PNG / GIF / WebP / BMP / SVG / AVIF / TIFF / ICO
  - 视频：MP4 / WebM / MOV / MKV / AVI / M4V / OGV / WMV / FLV
  - 音频：MP3 / WAV / FLAC / AAC / OGG / M4A / WMA / Opus / AIFF
  - 文档：PDF（内置浏览器渲染）
  - 文本/代码：TXT / LOG / INI / CSV 等 + 30+ 编程语言代码
  - Markdown：内置渲染，支持标题/列表/代码块/链接/粗体斜体
  - JSON：自动格式化美化
  - 字体：TTF / OTF / WOFF / WOFF2 实时预览
  - Office：识别并提示用系统应用打开
- **历史记录**：最近 50 条预览记录，一键回溯
- **元信息栏**：文件名、体积、修改时间、扩展名一目了然
- **快捷操作**：在文件夹中显示、系统打开、复制路径
- **本地运行**：完全离线，不依赖网络，不收集任何数据
- **苹果白设计**：参考 macOS 原生，白底浅灰、#007aff 蓝色强调、系统字体、细腻阴影

## ⬇️ 直接下载

| 版本 | 下载 | 说明 |
| --- | --- | --- |
| 安装版（推荐） | [速览管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/quick-look-v1.0.0/quick-look-setup-1.0.0.exe) | NSIS 安装包，可选安装目录，自动创建快捷方式 |
| 便携版 | [速览管家 Portable 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/quick-look-v1.0.0/quick-look-portable-1.0.0.exe) | 免安装，双击即用 |

> 全部版本：[Releases](../../releases)

## 🚀 使用方式

### 安装版
1. 下载 `速览管家 Setup 1.0.0.exe`
2. 双击安装（可选择安装目录）
3. 启动后会在系统托盘出现图标
4. 在文件资源管理器中选中任意文件，按 `Alt + Q` 即可预览

### 便携版
1. 下载 `速览管家 Portable 1.0.0.exe`
2. 双击运行，无需安装
3. 使用方式同上

### 操作技巧

| 操作 | 说明 |
| --- | --- |
| `Alt + Q` | 唤起 / 隐藏预览窗口 |
| `Esc` | 关闭预览窗口 |
| 拖拽文件 | 直接拖到窗口任意位置即可预览 |
| 失焦 | 窗口自动隐藏（仿 Mac QuickLook） |
| 托盘点击 | 显示主窗口 |
| 历史按钮 | 查看最近 50 条预览记录 |

## 🛠 技术栈

- **框架**：Electron 28
- **UI**：原生 HTML / CSS / JavaScript（无前端框架，零依赖，启动快）
- **样式**：苹果白高端风格，参考 macOS 原生 QuickLook
- **存储**：本地 JSON 文件（配置 + 历史），SQLite 免依赖
- **集成**：PowerShell COM 读取 Explorer 选中文件
- **打包**：electron-builder（NSIS 安装包 + 便携版）

## 📁 项目结构

```
quick-look/
├── src/
│   ├── main.js              # Electron 主进程：窗口/快捷键/IPC/托盘
│   ├── preload.js           # 预加载：暴露受限 IPC API
│   ├── quick-look-core.js   # 核心引擎：分类/策略/历史（纯 Node，可测）
│   └── renderer/
│       ├── index.html        # 渲染层入口
│       ├── styles.css        # 苹果白高端风格样式
│       └── renderer.js       # 渲染层逻辑
├── test/
│   └── test.js               # 47 项单元测试
├── build/
│   ├── icon.ico              # 应用图标
│   └── icon-source.png       # 图标源文件
└── package.json
```

## 🧪 测试

```bash
node test/test.js
```

覆盖：文件分类、可预览判断、代码语言映射、体积格式化、元信息提取、预览策略、历史记录、配置合并、类型表完整性（共 47 项断言全部通过）。

## 💡 设计理念

Windows 自带的文件预览功能极弱，预览任何文件都需打开完整应用（如 Word、Photoshop），效率低下且打断工作流。速览管家把 Mac 上体验极佳的 QuickLook 空格键预览搬到 Windows，让你**选中即看，看完即走**。

**与同类工具差异**：
- 比 QuickLook 官方版更轻：纯本地、无广告、无账号
- 比 Seer 更现代：苹果白设计语言，原生 Windows 11 视觉
- 比 PowerToys 的预览更专注：不捆绑其他工具，单功能做到极致

## ☕ 支持我们

如果速览管家让你的工作更顺手，欢迎请我们喝杯咖啡：

👉 [爱发电支持](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT](LICENSE)
