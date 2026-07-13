# 🎬 录屏管家

> 苹果白高端风格本地屏幕录制工具：屏幕/窗口录制、系统声音+麦克风混音、暂停继续、历史管理、全局快捷键、托盘常驻，纯本地隐私优先

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [录屏管家 Setup 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/screen-recorder-manager-v1.0.0/screen-recorder-manager-setup-1.0.0.exe) | NSIS 安装包 |
| Windows x64 | [录屏管家 1.0.0.exe](https://github.com/grrtyre/youqu/releases/download/screen-recorder-manager-v1.0.0/screen-recorder-manager-portable-1.0.0.exe) | 便携版（免安装） |

## ✨ 功能特性

- **屏幕/窗口录制** —— 支持选择整个屏幕或特定窗口，desktopCapturer 实时预览
- **音频混音** —— 系统声音 + 麦克风同时录制，AudioContext 混音输出
- **三档画质** —— 流畅 10fps / 标准 24fps / 高清 30fps，自适应 VP9/VP8 编码
- **暂停继续** —— 录制中可暂停/继续，时长自动累计
- **取消录制** —— 误操作可取消，不保存文件
- **历史管理** —— 按今天/昨天/更早自动分组，预览播放、另存为、在文件夹中显示、删除
- **格式标签** —— webm/mp4 彩色标签区分，文件大小、时长一目了然
- **全局快捷键** —— Ctrl+Shift+R 一键开始/停止录制，无需切换窗口
- **托盘常驻** —— 关闭窗口后驻留托盘，不占用任务栏
- **单实例锁** —— 防止多开冲突
- **纯本地隐私** —— 所有录制文件保存在本地 userData，不上传任何数据

## 🎨 设计风格

- **苹果白高端风格** —— 白色/浅灰背景、细腻阴影、系统字体
- **蓝色强调** —— #007aff 主色调，参考 macOS/iOS 原生设计
- **统一组件** —— 胶囊选择器、圆角卡片、一致的间距节奏
- **精致细节** —— 选中态光晕、悬停反馈、空状态插画

## 🚀 使用方式

### 方式一：直接下载（推荐）

从上方下载表格中选择安装包或便携版，双击运行即可。

### 方式二：源码运行

```bash
# 安装依赖（使用镜像加速）
npm install

# 开发模式运行
npm start

# 打包
npm run build
```

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+Shift+R` | 开始/停止录制（全局） |

## 📂 项目结构

```
screen-recorder-manager/
├── src/
│   ├── main.js              # 主进程（窗口、IPC、托盘、快捷键）
│   ├── preload.js           # 预加载（contextBridge 安全桥接）
│   ├── uuid-lite.js         # 极简 UUID v4
│   └── renderer/
│       ├── index.html       # 主窗口 HTML
│       ├── app.js           # 渲染进程逻辑（录制、历史、预览）
│       └── styles.css       # 苹果白风格样式
├── build/
│   ├── icon.ico             # 应用图标（多尺寸）
│   ├── make_icon.py         # 图标生成脚本
│   └── shot-bg.ps1          # PrintWindow 后台截图脚本
├── test/
│   └── test.js              # 14 项核心逻辑测试
├── package.json
├── LICENSE
└── .gitignore
```

## 🔒 安全特性

- **contextIsolation** —— 渲染进程与 Node.js 完全隔离
- **路径白名单** —— 文件读写限制在 recordings 目录和历史列表内
- **原子写入** —— history.json 先写 .tmp 再 rename，防止崩溃损坏
- **链接白名单** —— 外部链接仅允许 http/https 协议
- **HTML 转义** —— 所有用户输入和历史数据均经过 HTML 转义

## 🧪 测试覆盖

14 项核心逻辑测试全部通过：

- UUID 生成
- 历史管理（增/删/上限 200/最新在前/字段保留）
- 时间/日期/文件大小格式化
- mimeType 选择（VP9/VP8 优先）
- 录制时长累计（含暂停/继续）
- 路径白名单校验
- 原子写入
- 外部链接协议白名单
- 扩展名推断
- 画质选项
- 源类型过滤
- HTML 转义

```bash
node test/test.js
```

## ☕ 支持我们

如果这个工具帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位 -->

_暂无，期待第一个支持者的出现。_

## 📄 License

[MIT License](./LICENSE)
