# 📸 截图管家

> 苹果白高端风格截图标注工具。截屏 · 标注 · 贴图 · 历史，一站式解决屏幕截图协作流程。

由 **Trae + MiMo Code** 人机协作打造。

---

## ⬇️ 直接下载

| 平台 | 下载 | 说明 |
|---|---|---|
| Windows x64 | [截图管家 Setup 1.2.0.exe](https://github.com/grrtyre/youqu/releases/download/screenshot-manager-v1.2.0/Setup.1.2.0.exe) | v1.2.0 安装版，支持开机自启 |
| Windows x64 | [截图管家 Portable 1.2.0.exe](https://github.com/grrtyre/youqu/releases/download/screenshot-manager-v1.2.0/Portable.1.2.0.exe) | v1.2.0 免安装单文件版 |

> 若上方链接失效，请到 [Releases 页](https://github.com/grrtyre/youqu/releases) 手动下载最新版。

---

## ✨ 核心功能

- **全局快捷键截图** — `Ctrl + Shift + A` 任意位置启动，区域拖拽选区
- **6 种标注工具**
  - 🟦 矩形框
  - ➡️ 箭头
  - ✏️ 画笔（自由曲线）
  - 🔤 文字
  - 🔢 序号标记（自动递增，标注步骤神器）
  - 🧩 马赛克（保护敏感信息）
- **8 色调色板** — 红 / 橙 / 黄 / 绿 / 蓝 / 紫 / 黑 / 白
- **4 档线宽** — 适配不同场景
- **一键贴图** — 标注完钉在屏幕最上层，对比演示利器
- **截图历史** — 最近 100 张本地保存，回看 / 再编辑 / 删除
- **多端导出** — 复制到剪贴板 / 另存为 / 保存到历史
- **纯本地隐私** — 所有图片存本地，不上传任何服务器

---

## 🎯 适用场景

- **程序员**：提 bug、code review 截图标注
- **产品经理**：标注需求图、原型反馈
- **运营 / 自媒体**：教程截图打码加文字
- **老师 / 讲师**：制作带序号步骤的教学截图
- **设计师**：灵感收集、对比参考贴屏

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl + Shift + A` | 启动截图 |
| `Ctrl + Shift + Q` | 备用截图键 |
| `Esc` | 取消截图 / 关闭文字输入 |
| `Ctrl + Z` | 编辑器撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | 编辑器重做 |
| 贴图右键 | 另存为 / 复制 / 关闭贴图 |

---

## 🚀 使用方式

### 方式一：下载安装包
1. 从上方下载表选择 Setup 或 Portable 版本
2. Setup 版双击安装，Portable 版直接双击运行
3. 启动后程序常驻托盘，按 `Ctrl + Shift + A` 开始截图

### 方式二：源码运行
```bash
cd screenshot-manager
npm install
npm start
```

### 方式三：自己打包
```bash
npm install
npm run build   # 产物在 build-output/
```

---

## 📜 更新日志

### v1.2.0（2026-07-11）

**安全**
- 新增 Content-Security-Policy（CSP）meta 标签，限制脚本/样式/图片来源
- 修复 file:/// 直连加载缩略图绕过路径白名单的问题，改为 IPC readImage 安全通道
- 新增 open-external IPC handler，仅放行 http/https 协议，防止任意协议执行

**可靠性**
- saveHistory 改为原子写入（.tmp → rename），避免崩溃导致 history.json 损坏
- 新增 cleanupOrphanTempFiles()：启动时自动清理崩溃残留的 raw_/pin_/raw_composed_ 临时文件
- delete-history 添加 isDestroyed 检查，避免窗口关闭后发送 IPC 报错
- save-as 对话框添加 parent 空值保护
- globalShortcut.register 返回值检查，注册失败时 console.warn

**功能**
- 新增贴图滚轮缩放（上滚放大 1.1x / 下滚缩小 0.9x，钳制在工作区范围内）
- 关于页新增爱发电入口按钮
- 侧边栏底部新增「支持我们」+ 版本号页脚

**UI 精修**
- 阴影系统柔化（减少 opacity，更接近 macOS 原生质感）
- 空状态重新设计：截图主题图标 + 大号标题 + 引导文案
- 导航图标统一 stroke-width（1.6），视觉重量一致
- 快捷键展示改为纯文本胶囊，不再碎片化
- 侧边栏宽度收窄至 232px，内容区比例更舒展
- panel-head h2 字号从 24px 降至 20px，降低视觉压迫
- kbd 样式精简（薄边框、小圆角、轻阴影）

**清理**
- 移除 crop-screenshot 死代码 handler
- 移除 window-all-closed 死参数
- 补充 pin.html 滚轮缩放事件绑定（替换空 handler）

**测试**
- 新增 4 项测试：原子写入、孤儿清理、pin-zoom 缩放系数、open-external 协议白名单
- 全部 15 项测试通过

### v1.1.0（2026-07-05）

**安全**
- 新增 IPC 路径白名单校验，防止任意文件读取（`isPathSafe`）

**功能**
- 新增编辑器重做（Redo）功能：`Ctrl + Shift + Z` / `Ctrl + Y`
- 新增贴图右键菜单：另存为 / 复制到剪贴板 / 关闭
- 新增主窗口"立即截图"按钮，一键触发截图流程
- 多屏支持：拼接所有显示器为虚拟桌面，picker 跨屏选区
- HiDPI 修复：`thumbnailSize` 乘 `scaleFactor`，避免高 DPI 模糊

**Bug 修复**
- 修复磁盘泄漏：编辑器关闭时清理临时 raw 文件，pin 关闭时清理 pin 临时文件
- 修复贴图位置：基于编辑器实际 bounds 计算贴图坐标（右/下/左 fallback）
- 修复 `ready-to-show` 阶段 IPC 消息丢失：等 `did-finish-load` 后再发送
- 修复托盘"上次截图再编辑"引用已清理的 raw 文件

**UI**
- 苹果白高端风格细化：阴影、间距、badge、标题栏、kbd 样式
- hero 卡片重写：标题+按钮+快捷键居中布局
- 空状态垂直居中

### v1.0.0（初始版本）
- 区域截图、6 种标注工具、贴图、历史、纯本地隐私

---

## 🛠️ 技术栈

- **Electron 28** — 跨平台桌面框架
- **原生 JavaScript** — 零前端框架依赖
- **Canvas API** — 标注绘制核心
- **desktopCapturer** — 屏幕捕获
- **electron-builder** — 打包分发
- 设计风格：苹果白高端风格（参考 macOS / iOS HIG）

---

## 📁 项目结构

```
screenshot-manager/
├── src/
│   ├── main.js              # 主进程：截图流程、托盘、快捷键、历史管理
│   ├── preload.js           # IPC 桥接
│   ├── uuid-lite.js         # 极简 UUID 生成
│   └── renderer/
│       ├── index.html       # 主窗口（历史 / 快捷键 / 关于）
│       ├── styles.css       # 主窗口样式
│       ├── renderer.js      # 主窗口逻辑
│       ├── picker.html/css/js  # 截图选区覆盖层
│       ├── editor.html/css/js  # 标注编辑器（核心）
│       └── pin.html         # 屏幕贴图窗口
├── build/
│   ├── icon.ico             # 应用图标
│   └── icon-source.png      # 图标源文件
├── test/
│   └── test.js              # 核心逻辑单元测试
├── package.json
├── LICENSE
└── README.md
```

---

## 🧪 测试

```bash
npm test
```

测试覆盖：UUID 生成、历史管理（增/删/上限/排序）、裁剪坐标转换、标注形状几何、箭头方向、序号自增/撤销、重做栈、IPC 路径白名单校验、多屏 bounds 并集、HiDPI 物理像素计算、贴图位置定位。

---

## ☕ 支持我们

如果截图管家帮到了你，欢迎在爱发电请我们喝杯咖啡：

👉 [https://www.ifdian.net/a/giquwei](https://www.ifdian.net/a/giquwei)

你的支持是我们持续做下去的动力。

---

## 🙏 鸣谢

感谢以下朋友的支持（按支持时间排序）：

<!-- 鸣谢名单占位：有了支持者后在这里添加，格式：- [@用户名](主页链接) -->

_暂无，期待第一个支持者的出现。_

---

## 📄 License

[MIT License](./LICENSE) · 可自由使用、修改、分发。
